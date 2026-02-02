package com.glideidentity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@SpringBootApplication
@EnableScheduling
public class JavaServer {

    public static void main(String[] args) {
        SpringApplication.run(JavaServer.class, args);
        
        // Log startup information (use PORT env var to match application.properties)
        String port = System.getenv("PORT") != null ? System.getenv("PORT") : "3001";
        System.out.println("🚀 Java server running on http://localhost:" + port);
        
        // Check both system properties and environment variables for OAuth2 credentials
        boolean hasClientId = System.getProperty("GLIDE_CLIENT_ID") != null || 
                              System.getenv("GLIDE_CLIENT_ID") != null;
        boolean hasClientSecret = System.getProperty("GLIDE_CLIENT_SECRET") != null || 
                                  System.getenv("GLIDE_CLIENT_SECRET") != null;
        
        if (!hasClientId || !hasClientSecret) {
            System.out.println("⚠️  Missing OAuth2 credentials. Please set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET.");
        } else {
            System.out.println("✅ OAuth2 credentials loaded successfully!");
        }
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
} 