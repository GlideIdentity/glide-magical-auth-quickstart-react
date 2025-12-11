package com.glideidentity.controller;

import com.glideidentity.dto.*;
import com.glideidentity.service.GlideService;
import com.glideapi.exceptions.MagicAuthError;
import com.glideapi.services.dto.MagicAuthDtos.PrepareResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
public class PhoneAuthController {

    private final GlideService glideService;
    private final String glideApiBaseUrl;
    private final String glideDevEnv;
    
    public PhoneAuthController(GlideService glideService) {
        this.glideService = glideService;
        
        // Load GLIDE_API_BASE_URL from environment (bootRun loads .env into env vars)
        String baseUrl = System.getenv("GLIDE_API_BASE_URL");
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "https://api.glideidentity.app";
        }
        this.glideApiBaseUrl = baseUrl;
        
        // Load GLIDE_DEV_ENV for developer header
        this.glideDevEnv = System.getenv("GLIDE_DEV_ENV");
        
        log.info("Status proxy config: baseUrl={}, devEnv={}", glideApiBaseUrl, glideDevEnv);
    }

    @PostMapping("/phone-auth/prepare")
    public ResponseEntity<?> prepare(@RequestBody PrepareRequest request) {
        log.info("/api/phone-auth/prepare: {}", request);

        try {
            // Response is always PrepareResponse for success
            // Not eligible cases throw MagicAuthError with CARRIER_NOT_ELIGIBLE
            PrepareResponse response = glideService.prepare(request);
            return ResponseEntity.ok(response);
        } catch (MagicAuthError e) {
            // Handle SDK errors properly (no reflection needed)
            log.info("MagicAuthError caught: code={}, status={}, message={}, requestId={}", 
                    e.getCode(), e.getStatus(), e.getMessage(), e.getRequestId());
            
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
            log.error("Unexpected error in phone auth prepare:", e);
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
        log.info("/api/phone-auth/process: {}", request);
        
        try {
            var result = glideService.processCredential(request);
            return ResponseEntity.ok(result);
        } catch (MagicAuthError e) {
            // Handle SDK errors properly (no reflection needed)
            log.info("MagicAuthError caught: code={}, status={}, message={}, requestId={}", 
                    e.getCode(), e.getStatus(), e.getMessage(), e.getRequestId());
            
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
            log.error("Unexpected error in phone auth process:", e);
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("INTERNAL_ERROR")
                    .message("An unexpected error occurred")
                    .details(getEnvironment().equals("development") ? 
                            Map.of("message", e.getMessage()) : null)
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
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
                                .hasApiKey(System.getProperty("GLIDE_API_KEY") != null || System.getenv("GLIDE_API_KEY") != null)
                                .build())
                        .build()
        );
    }
    
    private String getEnvironment() {
        return System.getProperty("spring.profiles.active", "production");
    }
    
    /**
     * Status proxy endpoint to avoid CORS issues
     * Forwards requests to the Glide public status endpoint
     */
    @GetMapping("/phone-auth/status/{sessionId}")
    public ResponseEntity<?> getStatus(@PathVariable String sessionId) {
        try {
            log.info("[Status Proxy] Fetching status for session: {}", sessionId);
            
            // Create HTTP client
            java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
            
            // Use the pre-loaded base URL (from .env or environment)
            String url = glideApiBaseUrl + "/public/status/" + sessionId;
            log.info("[Status Proxy] Using URL: {}", url);
            
            java.net.http.HttpRequest.Builder requestBuilder = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(url))
                .header("Accept", "application/json");
            
            // Add developer header if configured
            if (glideDevEnv != null && !glideDevEnv.isEmpty()) {
                requestBuilder.header("developer", glideDevEnv);
                log.info("[Status Proxy] Adding developer header: {}", glideDevEnv);
            }
            
            java.net.http.HttpRequest request = requestBuilder.GET().build();
            
            java.net.http.HttpResponse<String> response = httpClient.send(request, 
                java.net.http.HttpResponse.BodyHandlers.ofString());
            
            log.info("[Status Proxy] Status check returned {}", response.statusCode());
            
            if (response.statusCode() >= 400) {
                return ResponseEntity.status(response.statusCode()).body(response.body());
            }
            
            // Parse and return the JSON response
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            Object jsonResponse = mapper.readValue(response.body(), Object.class);
            log.info("[Status Proxy] Status response: {}", jsonResponse);
            
            return ResponseEntity.ok(jsonResponse);
            
        } catch (Exception e) {
            log.error("[Status Proxy] Error:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "Status check failed",
                "message", e.getMessage()
            ));
        }
    }
} 