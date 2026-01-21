package com.glideidentity.service;

import com.glideidentity.GlideClient;
import com.glideidentity.exception.MagicalAuthError;
import com.glideidentity.core.Types.*;
import com.glideidentity.core.Constants.UseCase;
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
        String clientId = System.getenv("GLIDE_CLIENT_ID");
        String clientSecret = System.getenv("GLIDE_CLIENT_SECRET");

        if (clientId != null && clientSecret != null) {
            // Using GlideClient with OAuth2 client credentials
            this.glideClient = new GlideClient(clientId, clientSecret);
            this.initialized = true;
            log.info("✅ Glide SDK initialized with OAuth2");
        } else {
            log.warn("⚠️ Missing OAuth2 credentials. Set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET");
        }
    }

    /**
     * Prepare authentication request.
     * @return PrepareResponse for eligible users
     * @throws MagicalAuthError with CARRIER_NOT_ELIGIBLE if user is not eligible (422 status)
     */
    public PrepareResponse prepare(com.glideidentity.dto.PrepareRequest request) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }

        // Build SDK request using the Builder pattern (best practice)
        PrepareRequest.Builder builder = new PrepareRequest.Builder();
        
        // Let the SDK handle use case validation and conversion
        if (request.getUseCase() != null) {
            // Simple conversion: just add underscores between words
            String enumValue = request.getUseCase()
                .replaceAll("([a-z])([A-Z])", "$1_$2")
                .toUpperCase();
            builder.useCase(UseCase.valueOf(enumValue));
        }
        
        // Pass through all fields - let SDK handle validation
        if (request.getPhoneNumber() != null) {
            builder.phoneNumber(request.getPhoneNumber());
        }
        
        if (request.getPlmn() != null) {
            var plmn = new PLMN(
                request.getPlmn().getMcc(), 
                request.getPlmn().getMnc()
            );
            builder.plmn(plmn);
        }
        
        if (request.getConsentData() != null) {
            var consent = new ConsentData(
                request.getConsentData().getConsentText(),
                request.getConsentData().getPolicyLink(),
                request.getConsentData().getPolicyText()
            );
            builder.consentData(consent);
        }
        
        if (request.getClientInfo() != null) {
            var clientInfo = new ClientInfo(
                request.getClientInfo().getUserAgent(),
                request.getClientInfo().getPlatform()
            );
            builder.clientInfo(clientInfo);
        }

        // Build and execute - SDK will validate
        return glideClient.magicalAuth.prepare(builder.build());
    }

    /**
     * Process credential for either phone verification or phone number retrieval.
     * Since Java doesn't have union types, we have to return Object here.
     * @return VerifyPhoneNumberResponse for VerifyPhoneNumber use case, 
     *         GetPhoneNumberResponse for GetPhoneNumber use case
     * @throws MagicalAuthError for authentication errors
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
            return glideClient.magicalAuth.verifyPhoneNumber(verifyRequest);
        } else if ("GetPhoneNumber".equals(request.getUseCase())) {
            var getRequest = new GetPhoneNumberRequest();
            getRequest.setCredential(request.getCredential());
            getRequest.setSession(sessionInfo);
            return glideClient.magicalAuth.getPhoneNumber(getRequest);
        } else {
            // Let SDK handle invalid use cases
            throw new IllegalArgumentException("Invalid use_case: " + request.getUseCase());
        }
    }

    /**
     * Report that an authentication flow was started.
     * Used for ASR (Authentication Success Rate) metric tracking.
     * 
     * @param sessionId The session ID from the prepare response
     * @return ReportInvocationResponse with success status
     * @throws Exception if the SDK call fails
     */
    public ReportInvocationResponse reportInvocation(String sessionId) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }
        
        var request = new ReportInvocationRequest(sessionId);
        return glideClient.magicalAuth.reportInvocation(request);
    }

    public boolean isInitialized() {
        return initialized;
    }

    public List<String> getProperties() {
        return initialized && glideClient != null ? 
            List.of("magicalAuth", "initialized") : 
            List.of();
    }
}
