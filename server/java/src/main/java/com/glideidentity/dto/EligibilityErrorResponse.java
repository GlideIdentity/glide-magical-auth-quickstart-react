package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EligibilityErrorResponse {
    private String error;
    private String message;
    private Details details;
    
    @Data
    @Builder
    public static class Details {
        private boolean eligible;
        
        @JsonProperty("carrier_name")
        private String carrierName;
        
        private String reason;
    }
} 