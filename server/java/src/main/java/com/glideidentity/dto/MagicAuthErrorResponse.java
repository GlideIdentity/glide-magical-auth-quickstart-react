package com.glideidentity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class MagicAuthErrorResponse {
    private String error;  // Error code
    private String message;
    
    @JsonProperty("request_id")
    private String requestId;
    
    private Map<String, Object> details;
} 