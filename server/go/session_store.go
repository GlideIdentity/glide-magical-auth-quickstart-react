package main

import (
	"sync"
	"time"

	glide "github.com/GlideIdentity/glide-be-sdk-go"
)

// SessionStore stores status_url from prepare responses for the polling proxy.
// This allows the status proxy to use the exact URL provided by the API.

type sessionEntry struct {
	StatusURL string
	ExpiresAt time.Time
}

var (
	sessionStore = make(map[string]sessionEntry)
	sessionMutex sync.RWMutex
)

func init() {
	// Cleanup expired sessions every minute
	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			cleanupExpiredSessions()
		}
	}()
}

func cleanupExpiredSessions() {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()
	now := time.Now()
	for key, entry := range sessionStore {
		if entry.ExpiresAt.Before(now) {
			delete(sessionStore, key)
		}
	}
}

// StoreStatusURL stores a status URL for a session (5 minute TTL)
func StoreStatusURL(sessionKey, statusURL string) {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()
	sessionStore[sessionKey] = sessionEntry{
		StatusURL: statusURL,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
}

// GetStoredStatusURL retrieves the stored status URL for a session
func GetStoredStatusURL(sessionKey string) (string, bool) {
	sessionMutex.RLock()
	defer sessionMutex.RUnlock()
	entry, exists := sessionStore[sessionKey]
	if !exists || entry.ExpiresAt.Before(time.Now()) {
		return "", false
	}
	return entry.StatusURL, true
}

// ExtractStatusURL extracts status_url from a prepare response based on strategy
func ExtractStatusURL(response *glide.PrepareResponse) string {
	// SDK provides a helper function to extract status URL
	return glide.GetStatusURL(response)
}
