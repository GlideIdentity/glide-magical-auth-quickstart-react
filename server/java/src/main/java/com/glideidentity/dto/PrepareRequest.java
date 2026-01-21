package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PrepareRequest {
    @JsonProperty("use_case")
    private String useCase;
    
    @JsonProperty("phone_number")
    private String phoneNumber;
    
    private Plmn plmn;
    
    @JsonProperty("consent_data")
    private ConsentData consentData;
    
    @JsonProperty("client_info")
    private ClientInfo clientInfo;
    
    @Data
    public static class Plmn {
        private String mcc;
        private String mnc;
    }
    
    @Data
    public static class ConsentData {
        @JsonProperty("consent_text")
        private String consentText;
        
        @JsonProperty("policy_link")
        private String policyLink;
        
        @JsonProperty("policy_text")
        private String policyText;
    }
    
    @Data
    public static class ClientInfo {
        @JsonProperty("user_agent")
        private String userAgent;
        
        @JsonProperty("platform")
        private String platform;
    }
} 