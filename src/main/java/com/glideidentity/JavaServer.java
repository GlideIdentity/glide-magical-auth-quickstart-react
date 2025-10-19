package com.glideidentity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@SpringBootApplication
public class JavaServer {

    public static void main(String[] args) {
        SpringApplication.run(JavaServer.class, args);
        
        // Log startup information
        System.out.println("🚀 Java server running on http://localhost:" + 
                          System.getProperty("server.port", "3001"));
        
        // Check both system properties and environment variables
        boolean hasApiKey = System.getProperty("GLIDE_API_KEY") != null || 
                            System.getenv("GLIDE_API_KEY") != null;
        
        if (!hasApiKey) {
            System.out.println("⚠️  Missing Glide API key. Please check your .env file.");
        } else {
            System.out.println("✅ Glide API key loaded successfully!");
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