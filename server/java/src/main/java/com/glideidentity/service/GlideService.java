package com.glideidentity.service;

import com.glideidentity.magicalauth.MagicalAuthClient;
import com.glideidentity.magicalauth.DeviceBinding;
import com.glideidentity.magicalauth.exceptions.MagicalAuthException;
import com.glideidentity.magicalauth.models.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.List;

@Slf4j
@Service
public class GlideService {

    private MagicalAuthClient magicalAuth;
    private boolean initialized = false;

    @PostConstruct
    public void init() {
        String clientId = System.getenv("GLIDE_CLIENT_ID");
        String clientSecret = System.getenv("GLIDE_CLIENT_SECRET");

        if (clientId != null && clientSecret != null) {
            MagicalAuthClient.Builder builder = MagicalAuthClient.builder()
                    .clientId(clientId)
                    .clientSecret(clientSecret);

            String baseUrl = System.getenv("GLIDE_API_BASE_URL");
            if (baseUrl != null && !baseUrl.isEmpty()) {
                builder.baseUrl(baseUrl);
            }

            this.magicalAuth = builder.build();
            this.initialized = true;
            log.info("✅ Magical Auth SDK initialized with OAuth2");
        } else {
            log.warn("⚠️ Missing OAuth2 credentials. Set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET");
        }
    }

    /**
     * Prepare authentication request.
     * The SDK auto-generates fe_code/fe_hash for device binding (link strategy).
     */
    public PrepareResult prepare(com.glideidentity.dto.PrepareRequest request) throws MagicalAuthException {
        if (!initialized) {
            throw new IllegalStateException("Magical Auth SDK not initialized. Check your credentials.");
        }

        PrepareRequest.Builder builder = PrepareRequest.builder()
                .useCase(UseCase.fromJson(request.getUseCase()));

        if (request.getPhoneNumber() != null) {
            builder.phoneNumber(request.getPhoneNumber());
        }

        if (request.getPlmn() != null) {
            builder.plmn(PLMN.builder()
                    .mcc(request.getPlmn().getMcc())
                    .mnc(request.getPlmn().getMnc())
                    .build());
        } else if ("GetPhoneNumber".equals(request.getUseCase())) {
            builder.plmn(PLMN.builder().mcc("310").mnc("260").build());
            log.info("📶 PLMN not provided, defaulting to T-Mobile US (MCC: 310, MNC: 260)");
        }

        if (request.getConsentData() != null) {
            builder.consentData(ConsentData.builder()
                    .consentText(request.getConsentData().getConsentText())
                    .policyLink(request.getConsentData().getPolicyLink())
                    .policyText(request.getConsentData().getPolicyText())
                    .build());
        }

        if (request.getClientInfo() != null) {
            builder.clientInfo(ClientInfo.builder()
                    .userAgent(request.getClientInfo().getUserAgent())
                    .platform(request.getClientInfo().getPlatform())
                    .build());
        }

        return magicalAuth.prepare(builder.build());
    }

    /**
     * Process credential for either phone verification or phone number retrieval.
     */
    public Object processCredential(com.glideidentity.dto.PhoneAuthProcessRequest request, String feCode) throws MagicalAuthException {
        if (!initialized) {
            throw new IllegalStateException("Magical Auth SDK not initialized. Check your credentials.");
        }

        SessionInfo sessionInfo = SessionInfo.builder()
                .sessionKey(request.getSession().getSessionKey())
                .nonce(request.getSession().getNonce())
                .build();

        if ("VerifyPhoneNumber".equals(request.getUseCase())) {
            VerifyPhoneNumberRequest verifyReq = VerifyPhoneNumberRequest.builder()
                    .session(sessionInfo)
                    .credential(request.getCredential())
                    .feCode(feCode)
                    .build();
            return magicalAuth.verifyPhoneNumber(verifyReq);
        } else if ("GetPhoneNumber".equals(request.getUseCase())) {
            GetPhoneNumberRequest getReq = GetPhoneNumberRequest.builder()
                    .session(sessionInfo)
                    .credential(request.getCredential())
                    .feCode(feCode)
                    .build();
            return magicalAuth.getPhoneNumber(getReq);
        } else {
            throw new IllegalArgumentException("Invalid use_case: " + request.getUseCase());
        }
    }

    /**
     * Complete a device-bound authentication session.
     */
    public void complete(String sessionKey, String feCode, String aggCode) throws MagicalAuthException {
        if (!initialized) {
            throw new IllegalStateException("Magical Auth SDK not initialized. Check your credentials.");
        }

        CompleteRequest completeReq = CompleteRequest.builder()
                .sessionKey(sessionKey)
                .feCode(feCode)
                .aggCode(aggCode)
                .build();
        magicalAuth.complete(completeReq);
    }

    /**
     * Report that an authentication flow was started (ASR tracking).
     */
    public ReportInvocationResponse reportInvocation(String sessionId) throws MagicalAuthException {
        if (!initialized) {
            throw new IllegalStateException("Magical Auth SDK not initialized. Check your credentials.");
        }

        return magicalAuth.reportInvocation(sessionId);
    }

    public boolean isInitialized() {
        return initialized;
    }

    public List<String> getProperties() {
        return initialized ? List.of("magicalAuth", "initialized") : List.of();
    }
}
