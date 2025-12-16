package com.glideidentity.service;

import com.glideidentity.GlideClient;
import com.glideidentity.exceptions.MagicAuthError;
import com.glideidentity.services.dto.MagicAuthDtos;
import com.glideidentity.services.dto.MagicAuthDtos.ClientInfo;
import com.glideidentity.services.dto.MagicAuthDtos.ConsentData;
import com.glideidentity.services.dto.MagicAuthDtos.GetPhoneNumberRequest;
import com.glideidentity.services.dto.MagicAuthDtos.PLMN;
import com.glideidentity.services.dto.MagicAuthDtos.PrepareResponse;
import com.glideidentity.services.dto.MagicAuthDtos.SessionInfo;
import com.glideidentity.services.dto.MagicAuthDtos.UseCase;
import com.glideidentity.services.dto.MagicAuthDtos.VerifyPhoneNumberRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.List;

@Slf4j
@Service
public class GlideService {

    private GlideClient glideClient;
    private boolean initialized = false;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        String apiKey = System.getenv("GLIDE_API_KEY");

        if (apiKey != null) {
            log.info("Initializing Glide client with API key");
            
            // Check for debug mode and log format from environment variables
            String debugMode = System.getenv("GLIDE_DEBUG");
            String logLevel = System.getenv("GLIDE_LOG_LEVEL");
            String logFormat = System.getenv("GLIDE_LOG_FORMAT");
            
            if ("true".equals(debugMode) || "debug".equals(logLevel)) {
                log.info("🔍 Debug logging enabled for Glide SDK");
                log.info("📊 Configuration:");
                log.info("  - GLIDE_DEBUG: {}", debugMode);
                log.info("  - GLIDE_LOG_LEVEL: {}", logLevel);
                log.info("  - GLIDE_LOG_FORMAT: {}", logFormat);
                log.info("📡 You will see detailed logs for:");
                log.info("  - API request/response details");
                log.info("  - Performance metrics");
                log.info("  - Retry attempts");
                log.info("  - Error context");
                log.info("🔒 Sensitive data is automatically sanitized");
            }
            
            // Using GlideClient with API key authentication
            // The SDK will automatically pick up GLIDE_LOG_FORMAT and GLIDE_LOG_LEVEL from environment
            this.glideClient = new GlideClient(apiKey);
            this.initialized = true;
            log.info("Glide client initialized successfully with API key authentication");
        } else {
            log.warn("Missing Glide API key. Client not initialized.");
        }
    }

    /**
     * Prepare authentication request.
     * @return PrepareResponse for eligible users
     * @throws MagicAuthError with CARRIER_NOT_ELIGIBLE if user is not eligible (422 status)
     */
    public PrepareResponse prepare(com.glideidentity.dto.PrepareRequest request) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }

        // Build SDK request using the Builder pattern (best practice)
        MagicAuthDtos.PrepareRequest.Builder builder = new MagicAuthDtos.PrepareRequest.Builder();
        
        // Let the SDK handle use case validation and conversion
        if (request.getUseCase() != null) {
            // Simple conversion: just add underscores between words
            String enumValue = request.getUseCase()
                .replaceAll("([a-z])([A-Z])", "$1_$2")
                .toUpperCase();
            builder.withUseCase(UseCase.valueOf(enumValue));
        }
        
        // Pass through all fields - let SDK handle validation
        if (request.getPhoneNumber() != null) {
            builder.withPhoneNumber(request.getPhoneNumber());
        }
        
        if (request.getPlmn() != null) {
            var plmn = new PLMN(
                request.getPlmn().getMcc(), 
                request.getPlmn().getMnc()
            );
            builder.withPlmn(plmn);
        }
        
        if (request.getConsentData() != null) {
            var consent = new ConsentData(
                request.getConsentData().getConsentText(),
                request.getConsentData().getPolicyLink(),
                request.getConsentData().getPolicyText()
            );
            builder.withConsentData(consent);
        }
        
        if (request.getClientInfo() != null) {
            var clientInfo = new ClientInfo(
                request.getClientInfo().getUserAgent(),
                request.getClientInfo().getPlatform()
            );
            builder.withClientInfo(clientInfo);
        }

        // Build and execute - SDK will validate
        return glideClient.magicAuth.prepare(builder.build());
    }

    /**
     * Process credential for either phone verification or phone number retrieval.
     * Since Java doesn't have union types, we have to return Object here.
     * @return VerifyPhoneNumberResponse for VerifyPhoneNumber use case, 
     *         GetPhoneNumberResponse for GetPhoneNumber use case
     * @throws MagicAuthError for authentication errors
     */
    public Object processCredential(com.glideidentity.dto.PhoneAuthProcessRequest request) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }

        // Convert session to SDK type
        var sessionInfo = objectMapper.convertValue(
            request.getSession(), 
            SessionInfo.class
        );
        
        // Call appropriate SDK method based on use_case (let SDK validate)
        if ("VerifyPhoneNumber".equals(request.getUseCase())) {
            var verifyRequest = new VerifyPhoneNumberRequest();
            verifyRequest.setCredential(request.getCredential());
            verifyRequest.setSession(sessionInfo);
            return glideClient.magicAuth.verifyPhoneNumber(verifyRequest);
        } else if ("GetPhoneNumber".equals(request.getUseCase())) {
            var getRequest = new GetPhoneNumberRequest();
            getRequest.setCredential(request.getCredential());
            getRequest.setSession(sessionInfo);
            return glideClient.magicAuth.getPhoneNumber(getRequest);
        } else {
            // Let SDK handle invalid use cases
            throw new IllegalArgumentException("Invalid use_case: " + request.getUseCase());
        }
    }

    public boolean isInitialized() {
        return initialized;
    }

    public List<String> getProperties() {
        return initialized && glideClient != null ? 
            List.of("magicAuth", "initialized") : 
            List.of();
    }
} 