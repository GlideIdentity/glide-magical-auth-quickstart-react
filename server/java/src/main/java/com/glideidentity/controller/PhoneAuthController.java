package com.glideidentity.controller;

import com.glideidentity.dto.*;
import com.glideidentity.service.GlideService;
import com.glideidentity.service.SessionStoreService;
import com.glideidentity.exception.MagicalAuthError;
import com.glideidentity.core.Types.PrepareResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api")
public class PhoneAuthController {

    private final GlideService glideService;
    private final SessionStoreService sessionStore;
    
    public PhoneAuthController(GlideService glideService, SessionStoreService sessionStore) {
        this.glideService = glideService;
        this.sessionStore = sessionStore;
    }

    @PostMapping("/phone-auth/prepare")
    public ResponseEntity<?> prepare(@RequestBody PrepareRequest request) {
        log.info("📱 Prepare request: { use_case: '{}' }", request.getUseCase());

        try {
            // Response is always PrepareResponse for success
            // Not eligible cases throw MagicalAuthError with CARRIER_NOT_ELIGIBLE
            PrepareResponse response = glideService.prepare(request);
            log.info("✅ Prepare success: { strategy: '{}', session_key: '{}' }",
                response.getAuthenticationStrategy(), 
                response.getSession() != null ? response.getSession().getSessionKey() : "null");
            
            // Store status_url for the polling proxy endpoint
            sessionStore.extractStatusUrl(response).ifPresent(statusUrl -> {
                if (response.getSession() != null) {
                    sessionStore.storeStatusUrl(response.getSession().getSessionKey(), statusUrl);
                }
            });
            
            return ResponseEntity.ok(response);
        } catch (MagicalAuthError e) {
            // Handle SDK errors properly (no reflection needed)
            log.error("❌ MagicalAuthError: code={}, status={}, message={}", 
                    e.getCode(), e.getStatus(), e.getMessage());
            
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error(e.getCode())
                    .message(e.getMessage())
                    .requestId(e.getRequestId())
                    .details(e.getDetails())
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

    @PostMapping("/phone-auth/process")
    public ResponseEntity<?> process(@RequestBody PhoneAuthProcessRequest request) {
        log.info("🔐 Process request: { use_case: '{}' }", request.getUseCase());
        
        try {
            var result = glideService.processCredential(request);
            return ResponseEntity.ok(result);
        } catch (MagicalAuthError e) {
            // Handle SDK errors properly (no reflection needed)
            log.error("❌ MagicalAuthError: code={}, status={}, message={}", 
                    e.getCode(), e.getStatus(), e.getMessage());
            
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error(e.getCode())
                    .message(e.getMessage())
                    .requestId(e.getRequestId())
                    .details(e.getDetails())
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
    @PostMapping("/phone-auth/invoke")
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
    
    /**
     * Status Proxy Endpoint for Desktop/QR Authentication Polling
     * 
     * Uses the stored status_url from the prepare response for polling.
     * This ensures we use the exact URL provided by the API.
     */
    @GetMapping("/phone-auth/status/{sessionId}")
    public ResponseEntity<?> getStatus(@PathVariable String sessionId) {
        // Get the stored status URL from prepare response
        Optional<String> statusUrlOpt = sessionStore.getStatusUrl(sessionId);
        
        if (statusUrlOpt.isEmpty()) {
            String sessionPreview = sessionId.length() > 8 
                ? sessionId.substring(0, 8) + "..." 
                : sessionId;
            log.warn("[Status Proxy] No stored status URL for session: {}", sessionPreview);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "SESSION_NOT_FOUND",
                "message", "Session not found. It may have expired or prepare was not called."
            ));
        }

        String sessionPreview = sessionId.length() > 8 
            ? sessionId.substring(0, 8) + "..." 
            : sessionId;
        log.info("[Status Proxy] Polling session: {}", sessionPreview);

        try {
            java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
            
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(statusUrlOpt.get()))
                .header("Accept", "application/json")
                .GET()
                .build();
            
            java.net.http.HttpResponse<String> response = httpClient.send(request, 
                java.net.http.HttpResponse.BodyHandlers.ofString());
            
            log.info("[Status Proxy] Status check returned {}", response.statusCode());
            
            if (response.statusCode() >= 400) {
                return ResponseEntity.status(response.statusCode()).body(response.body());
            }
            
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            Object jsonResponse = mapper.readValue(response.body(), Object.class);
            
            return ResponseEntity.ok(jsonResponse);
            
        } catch (Exception e) {
            log.error("[Status Proxy] Error:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "STATUS_CHECK_FAILED",
                "message", e.getMessage()
            ));
        }
    }
}
