package com.glideidentity.service;

import com.glideidentity.dto.PrepareRequest;
import com.glideidentity.dto.PhoneAuthProcessRequest;
import com.glideidentity.GlideClient;
import com.glideidentity.services.dto.MagicAuthDtos.*;
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
            // Using GlideClient with API key authentication
            this.glideClient = new GlideClient(apiKey);
            this.initialized = true;
            log.info("Glide client initialized successfully with API key authentication");
        } else {
            log.warn("Missing Glide API key. Client not initialized.");
        }
    }

    public Object prepare(PrepareRequest request) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }

        // Create SDK DTO
        com.glideidentity.services.dto.MagicAuthDtos.PrepareRequest prepDto = 
            new com.glideidentity.services.dto.MagicAuthDtos.PrepareRequest();
        
        // Set use case directly - expecting "GetPhoneNumber" or "VerifyPhoneNumber"
        if (request.getUseCase() != null) {
            // The SDK expects GET_PHONE_NUMBER format, but we receive GetPhoneNumber
            String enumValue = request.getUseCase()
                .replaceAll("([a-z])([A-Z])", "$1_$2")
                .toUpperCase();
            prepDto.setUseCase(UseCase.valueOf(enumValue));
        }
        
        // Set phone number if provided
        if (request.getPhoneNumber() != null) {
            prepDto.setPhoneNumber(request.getPhoneNumber());
        }
        
        // Set PLMN if provided
        if (request.getPlmn() != null && request.getPlmn().getMcc() != null && request.getPlmn().getMnc() != null) {
            PLMN plmn = new PLMN(request.getPlmn().getMcc(), request.getPlmn().getMnc());
            prepDto.setPlmn(plmn);
        } else if (request.getPhoneNumber() == null) {
            // If neither phone_number nor PLMN was provided, use default T-Mobile PLMN
            // This matches the TypeScript server behavior
            PLMN defaultPlmn = new PLMN("310", "160"); // T-Mobile USA
            prepDto.setPlmn(defaultPlmn);
        }
        
        // Set consent data if provided
        if (request.getConsentData() != null) {
            ConsentData consent = new ConsentData(
                request.getConsentData().getConsentText(),
                request.getConsentData().getPolicyLink(),
                request.getConsentData().getPolicyText()
            );
            prepDto.setConsentData(consent);
        }
        
        // Set client info if provided
        if (request.getClientInfo() != null) {
            com.glideidentity.services.dto.MagicAuthDtos.ClientInfo clientInfo = 
                new com.glideidentity.services.dto.MagicAuthDtos.ClientInfo(
                    request.getClientInfo().getUserAgent(),
                    request.getClientInfo().getPlatform()
                );
            prepDto.setClientInfo(clientInfo);
        }

        // Call SDK
        return glideClient.magicAuth.prepare(prepDto);
    }

    public Object processCredential(PhoneAuthProcessRequest request) throws Exception {
        if (!initialized) {
            throw new IllegalStateException("Glide client not initialized. Check your credentials.");
        }

        // Validate required fields
        if (request.getCredential() == null || request.getCredential().isEmpty()) {
            throw new IllegalArgumentException("credential is required");
        }
        if (request.getSession() == null) {
            throw new IllegalArgumentException("session is required");
        }
        if (request.getUseCase() == null) {
            throw new IllegalArgumentException("use_case is required");
        }
        
        // Convert session to SDK type
        SessionInfo sessionInfo = objectMapper.convertValue(
            request.getSession(), 
            SessionInfo.class
        );
        
        // Call appropriate SDK method based on use_case
        Object result;
        if (request.getUseCase().equals("VerifyPhoneNumber")) {
            VerifyPhoneNumberRequest verifyRequest = new VerifyPhoneNumberRequest();
            verifyRequest.setCredential(request.getCredential());
            verifyRequest.setSession(sessionInfo);
            result = glideClient.magicAuth.verifyPhoneNumber(verifyRequest);
        } else if (request.getUseCase().equals("GetPhoneNumber")) {
            GetPhoneNumberRequest getRequest = new GetPhoneNumberRequest();
            getRequest.setCredential(request.getCredential());
            getRequest.setSession(sessionInfo);
            result = glideClient.magicAuth.getPhoneNumber(getRequest);
        } else {
            throw new IllegalArgumentException("Invalid use_case: " + request.getUseCase());
        }
        
        // Return the SDK response directly
        return result;
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