package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PhoneAuthProcessRequest {
    @JsonProperty("use_case")
    private String useCase;
    
    private String credential;
    private Object session;

    /** Extracts session_key from the session object for cookie lookup. */
    public String getSessionKey() {
        if (session instanceof java.util.Map) {
            Object key = ((java.util.Map<?, ?>) session).get("session_key");
            return key != null ? key.toString() : null;
        }
        return null;
    }
} 