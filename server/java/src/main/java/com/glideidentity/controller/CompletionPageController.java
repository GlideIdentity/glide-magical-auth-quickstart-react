package com.glideidentity.controller;

import com.glideidentity.service.MagicalAuth;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the device binding completion redirect page at the root path /glide-complete.
 * Separate from PhoneAuthController (which is prefixed with /api) because the aggregator
 * redirects directly to this URL after carrier authentication.
 */
@Slf4j
@RestController
public class CompletionPageController {

    @GetMapping(value = "/glide-complete", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> completionPage() {
        try {
            String html = MagicalAuth.getCompletionPageHtml("/api/phone-auth/complete");
            return ResponseEntity.ok()
                    .header("X-Content-Type-Options", "nosniff")
                    .header("X-Frame-Options", "DENY")
                    .header("Referrer-Policy", "no-referrer")
                    .body(html);
        } catch (Exception e) {
            log.error("Failed to generate completion page:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Internal server error");
        }
    }
}
