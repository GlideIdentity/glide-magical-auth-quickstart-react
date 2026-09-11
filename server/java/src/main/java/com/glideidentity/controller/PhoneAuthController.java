package com.glideidentity.controller;

import com.glideidentity.dto.*;
import com.glideidentity.service.GlideService;
import com.glideidentity.magicalauth.exceptions.MagicalAuthException;
import com.glideidentity.magicalauth.DeviceBinding;
import com.glideidentity.magicalauth.models.PrepareResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.time.Duration;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
public class PhoneAuthController {

    private final GlideService glideService;
    
    public PhoneAuthController(GlideService glideService) {
        this.glideService = glideService;
    }
    
    /** Build a Set-Cookie header using Spring's ResponseCookie (framework-native, CRLF-safe). */
    private static String buildBindingCookie(String sessionKey, String value, boolean secure, Duration maxAge) {
        String cookieName = DeviceBinding.getBindingCookieName(sessionKey);
        return ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .sameSite("Lax")
                .secure(secure)
                .path("/")
                .maxAge(maxAge)
                .build()
                .toString();
    }

    @PostMapping("/magical-auth/prepare")
    public ResponseEntity<?> prepare(@RequestBody PrepareRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        log.info("📱 Prepare request: { use_case: '{}' }", request.getUseCase());

        try {
            PrepareResult response = glideService.prepare(request);
            log.info("✅ Prepare success: { strategy: '{}', session_key: '{}' }",
                response.getAuthenticationStrategy(), 
                response.getSession() != null ? response.getSession().getSessionKey() : "null");
            
            // Device binding: set HttpOnly cookie with fe_code for link strategy.
            // Each session gets its own cookie (_glide_bind_{sessionKey}), so parallel
            // sessions and retries don't interfere. Old cookies expire via Max-Age.
            if (response.getFeCode() != null && response.getSession() != null) {
                boolean isSecure = "https".equals(httpRequest.getScheme())
                        || "https".equals(httpRequest.getHeader("X-Forwarded-Proto"));
                String sessionKey = response.getSession().getSessionKey();
                httpResponse.addHeader(HttpHeaders.SET_COOKIE,
                        buildBindingCookie(sessionKey, response.getFeCode().toLowerCase(), isSecure,
                                Duration.ofSeconds(DeviceBinding.BINDING_COOKIE_MAX_AGE)));
                log.info("🔒 Device binding cookie set for link strategy");

            }
            
            // Return the inner PrepareResponse (flat: authentication_strategy, session, data)
            // PrepareResult is a wrapper that holds feCode — we don't send that to the client.
            return ResponseEntity.ok(response.getResponse());
        } catch (MagicalAuthException e) {
            log.error("❌ MagicalAuthException: code={}, status={}, message={}", 
                    e.getCode(), e.getStatus(), e.getMessage());
            
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error(e.getCode())
                    .message(e.getMessage())
                    .requestId(e.getRequestId())
                    .build();
            
            return ResponseEntity.status(e.getStatus()).body(errorResponse);
        } catch (IllegalArgumentException e) {
            // Handle validation errors
            log.warn("Validation error in prepare: {}", e.getMessage());
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("VALIDATION_ERROR")
                    .message(e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (Exception e) {
            // Handle unexpected errors
            log.error("❌ Unexpected error in phone auth prepare:", e);
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("INTERNAL_ERROR")
                    .message("An unexpected error occurred")
                    .details(getEnvironment().equals("development") ? 
                            Map.of("message", e.getMessage()) : null)
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/magical-auth/process")
    public ResponseEntity<?> process(@RequestBody PhoneAuthProcessRequest request, HttpServletRequest httpRequest) {
        log.info("🔐 Process request: { use_case: '{}' }", request.getUseCase());
        
        try {
            // Read the device binding code from the HttpOnly cookie set during prepare.
            // This extends device binding verification to the process step (link protocol only).
            String sessionKey = request.getSessionKey();
            String feCode = null;
            String cookieHeader = httpRequest.getHeader("Cookie");
            if (cookieHeader != null && sessionKey != null) {
                feCode = DeviceBinding.parseBindingCookie(cookieHeader, sessionKey);
            }
            if (feCode != null) {
                log.info("🔒 Device binding cookie found for process step");
            }

            var result = glideService.processCredential(request, feCode);
            log.info("✅ Process success: { use_case: '{}' }", request.getUseCase());

            // The device binding cookie auto-expires (5 min Max-Age), so explicit clearing
            // is optional. Developers can clear it here for immediate cleanup if desired.

            return ResponseEntity.ok(result);
        } catch (MagicalAuthException e) {
            log.error("❌ MagicalAuthException: code={}, status={}, message={}", 
                    e.getCode(), e.getStatus(), e.getMessage());
            
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error(e.getCode())
                    .message(e.getMessage())
                    .requestId(e.getRequestId())
                    .build();
            
            return ResponseEntity.status(e.getStatus()).body(errorResponse);
        } catch (IllegalArgumentException e) {
            // Handle validation errors
            log.warn("Validation error in process: {}", e.getMessage());
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("VALIDATION_ERROR")
                    .message(e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (Exception e) {
            // Handle unexpected errors
            log.error("❌ Unexpected error in phone auth process:", e);
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("INTERNAL_ERROR")
                    .message("An unexpected error occurred")
                    .details(getEnvironment().equals("development") ? 
                            Map.of("message", e.getMessage()) : null)
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Reports that an authentication flow was started.
     * This call can be made asynchronously without blocking the flow.
     */
    @PostMapping("/magical-auth/report-invocation")
    public ResponseEntity<?> invoke(@RequestBody Map<String, String> request) {
        // Frontend SDK sends session_id (not session_key)
        String sessionId = request.get("session_id");
        
        if (sessionId == null || sessionId.isEmpty()) {
            log.warn("⚠️ [Invoke] No session_id provided");
            return ResponseEntity.ok(Map.of("success", false, "reason", "missing_session_id"));
        }
        
        try {
            String sessionIdPreview = sessionId.length() > 8 
                ? sessionId.substring(0, 8) + "..." 
                : sessionId;
            log.info("📊 [Invoke] Reporting invocation for session: {}", sessionIdPreview);
            
            var result = glideService.reportInvocation(sessionId);
            log.info("✅ [Invoke] Report response: {}", result);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // Log the error but NEVER fail the response with an error status code
            log.error("❌ [Invoke] Failed to report invocation: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ==================== Device Binding: Complete ====================

    /**
     * Complete endpoint — called by the completion redirect page.
     * Reads fe_code from the HttpOnly cookie, agg_code from the body, and
     * forwards all three to the aggregator's /complete endpoint.
     */
    @PostMapping("/magical-auth/complete")
    public ResponseEntity<?> complete(@RequestBody Map<String, String> body, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String sessionKey = body.get("session_key");
        String aggCode = body.get("agg_code");

        if (sessionKey == null || aggCode == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "MISSING_REQUIRED_FIELD",
                    "message", "session_key and agg_code are required"));
        }

        // Read fe_code from the HttpOnly cookie (set during prepare)
        String feCode = null;
        String cookieHeader = httpRequest.getHeader("Cookie");
        if (cookieHeader != null) {
            feCode = DeviceBinding.parseBindingCookie(cookieHeader, sessionKey);
        }

        if (feCode == null) {
            log.error("❌ Complete: device binding cookie missing or invalid");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "MISSING_BINDING_COOKIE",
                    "message", "Device binding cookie is missing. The prepare and complete must happen in the same browser."));
        }

        try {
            String sessionPreview = sessionKey.length() > 8 ? sessionKey.substring(0, 8) + "..." : sessionKey;
            log.info("🔐 Complete request for session: {}", sessionPreview);

            glideService.complete(sessionKey, feCode, aggCode);

            log.info("✅ Complete succeeded");

            // The device binding cookie is intentionally not cleared here — it is needed
            // by the process step (/verify-phone-number or /get-phone-number) for continued
            // device binding validation. The cookie auto-expires after 5 minutes.

            return ResponseEntity.noContent().build();

        } catch (MagicalAuthException e) {
            log.error("❌ Complete MagicalAuthException: code={}, status={}, message={}", e.getCode(), e.getStatus(), e.getMessage());
            return ResponseEntity.status(e.getStatus()).body(Map.of(
                    "error", e.getCode(),
                    "message", e.getMessage()));
        } catch (Exception e) {
            log.error("❌ Complete unexpected error:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "INTERNAL_ERROR",
                    "message", "An unexpected error occurred"));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<HealthCheckResponse> health() {
        return ResponseEntity.ok(
                HealthCheckResponse.builder()
                        .status("ok")
                        .glideInitialized(glideService.isInitialized())
                        .glideProperties(glideService.getProperties())
                        .env(HealthCheckResponse.EnvInfo.builder()
                                .hasClientCredentials(
                                    (System.getenv("GLIDE_CLIENT_ID") != null && System.getenv("GLIDE_CLIENT_SECRET") != null))
                                .build())
                        .build()
        );
    }
    
    private String getEnvironment() {
        return System.getProperty("spring.profiles.active", "production");
    }
    
}
