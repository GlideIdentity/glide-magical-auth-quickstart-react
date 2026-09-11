package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PhoneAuthProcessRequest {
    @JsonProperty("use_case")
    private String useCase;

    private String credential;
    private SessionDto session;

    @Data
    public static class SessionDto {
        @JsonProperty("session_key")
        private String sessionKey;
        private String nonce;
    }

    public String getSessionKey() {
        return session != null ? session.getSessionKey() : null;
    }
} 