package com.glideidentity.service;

import com.glideidentity.TypeUtils;
import com.glideidentity.core.Types.PrepareResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Session Store for Status URLs
 * 
 * Stores status_url from prepare responses for the polling proxy.
 * This allows the status proxy to use the exact URL provided by the API.
 */
@Service
public class SessionStoreService {

    private static final long TTL_MINUTES = 5;
    
    private record SessionEntry(String statusUrl, Instant expiresAt) {}
    
    private final Map<String, SessionEntry> store = new ConcurrentHashMap<>();

    /** Store a status URL for a session (5 minute TTL) */
    public void storeStatusUrl(String sessionKey, String statusUrl) {
        store.put(sessionKey, new SessionEntry(
            statusUrl,
            Instant.now().plusSeconds(TTL_MINUTES * 60)
        ));
    }

    /** Get the stored status URL for a session */
    public Optional<String> getStatusUrl(String sessionKey) {
        SessionEntry entry = store.get(sessionKey);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.expiresAt.isBefore(Instant.now())) {
            store.remove(sessionKey);
            return Optional.empty();
        }
        return Optional.of(entry.statusUrl);
    }

    /** Extract status_url from a prepare response based on strategy */
    public Optional<String> extractStatusUrl(PrepareResponse response) {
        // SDK provides a helper function to extract status URL
        return Optional.ofNullable(TypeUtils.getStatusUrl(response));
    }

    /** Cleanup expired sessions every minute */
    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredSessions() {
        Instant now = Instant.now();
        store.entrySet().removeIf(e -> e.getValue().expiresAt.isBefore(now));
    }
}
