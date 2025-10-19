package com.glideidentity.controller;

import com.glideidentity.dto.*;
import com.glideidentity.service.GlideService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PhoneAuthController {

    private final GlideService glideService;

    @PostMapping("/phone-auth/prepare")
    public ResponseEntity<?> prepare(@RequestBody PrepareRequest request) {
        log.info("/api/phone-auth/prepare: {}", request);
        
        try {
            var response = glideService.prepare(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.info("Caught error:", e);
            
            // Check if this is a MagicAuthError
            if (e.getClass().getName().equals("com.glideapi.exceptions.MagicAuthError")) {
                try {
                    // Use reflection to get error details
                    var codeMethod = e.getClass().getMethod("getCode");
                    var statusMethod = e.getClass().getMethod("getStatus");
                    var requestIdMethod = e.getClass().getMethod("getRequestId");
                    var detailsMethod = e.getClass().getMethod("getDetails");
                    
                    String code = (String) codeMethod.invoke(e);
                    Integer status = (Integer) statusMethod.invoke(e);
                    String requestId = (String) requestIdMethod.invoke(e);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> details = (Map<String, Object>) detailsMethod.invoke(e);
                    
                    log.info("MagicAuthError details: code={}, message={}, status={}, requestId={}, details={}", 
                            code, e.getMessage(), status, requestId, details);
                    
                    var errorResponse = MagicAuthErrorResponse.builder()
                            .error(code)
                            .message(e.getMessage())
                            .requestId(requestId)
                            .details(details)
                            .build();
                    
                    return ResponseEntity.status(status != null ? status : 500).body(errorResponse);
                } catch (Exception reflectionError) {
                    log.error("Failed to extract MagicAuthError details", reflectionError);
                }
            }
            
            // Handle other errors
            log.error("Phone auth prepare error:", e);
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("UNEXPECTED_ERROR")
                    .message(e.getMessage())
                    .details(getEnvironment().equals("development") ? 
                            Map.of("stackTrace", e.getStackTrace()) : null)
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
        } catch (Exception e) {
            log.info("Caught error:", e);
            
            // Check if this is a MagicAuthError
            if (e.getClass().getName().equals("com.glideapi.exceptions.MagicAuthError")) {
                try {
                    // Use reflection to get error details
                    var codeMethod = e.getClass().getMethod("getCode");
                    var statusMethod = e.getClass().getMethod("getStatus");
                    var requestIdMethod = e.getClass().getMethod("getRequestId");
                    var detailsMethod = e.getClass().getMethod("getDetails");
                    
                    String code = (String) codeMethod.invoke(e);
                    Integer status = (Integer) statusMethod.invoke(e);
                    String requestId = (String) requestIdMethod.invoke(e);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> details = (Map<String, Object>) detailsMethod.invoke(e);
                    
                    log.info("MagicAuthError details: code={}, message={}, status={}, requestId={}, details={}", 
                            code, e.getMessage(), status, requestId, details);
                    
                    var errorResponse = MagicAuthErrorResponse.builder()
                            .error(code)
                            .message(e.getMessage())
                            .requestId(requestId)
                            .details(details)
                            .build();
                    
                    return ResponseEntity.status(status != null ? status : 500).body(errorResponse);
                } catch (Exception reflectionError) {
                    log.error("Failed to extract MagicAuthError details", reflectionError);
                }
            }
            
            // Handle other errors
            log.error("Phone auth process error:", e);
            var errorResponse = MagicAuthErrorResponse.builder()
                    .error("UNEXPECTED_ERROR")
                    .message(e.getMessage())
                    .details(getEnvironment().equals("development") ? 
                            Map.of("stackTrace", e.getStackTrace()) : null)
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
} 