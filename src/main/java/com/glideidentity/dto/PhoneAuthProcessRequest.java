package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PhoneAuthProcessRequest {
    @JsonProperty("use_case")
    private String useCase;
    
    private String credential;  // JWT string from Digital Credentials API
    private Object session;
} 