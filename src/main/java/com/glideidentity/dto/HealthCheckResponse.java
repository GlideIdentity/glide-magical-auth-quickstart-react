package com.glideidentity.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class HealthCheckResponse {
    private String status;
    private boolean glideInitialized;
    private List<String> glideProperties;
    private EnvInfo env;
    
    @Data
    @Builder
    public static class EnvInfo {
        private boolean hasApiKey;
    }
} 