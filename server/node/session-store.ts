/**
 * Session Store for Status URLs
 * 
 * Stores status_url from prepare responses for the polling proxy.
 * This allows the status proxy to use the exact URL provided by the API.
 */

import type { PrepareResponse } from '@glideidentity/glide-be-sdk-node';
import { getStatusUrl as sdkGetStatusUrl } from '@glideidentity/glide-be-sdk-node';

interface SessionEntry {
  statusUrl: string;
  expiresAt: number;
}

const sessionStore = new Map<string, SessionEntry>();

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionStore.entries()) {
    if (entry.expiresAt < now) {
      sessionStore.delete(key);
    }
  }
}, 60 * 1000);

/** Store a status URL for a session (5 minute TTL) */
export function storeStatusUrl(sessionKey: string, statusUrl: string): void {
  sessionStore.set(sessionKey, {
    statusUrl,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

/** Get the stored status URL for a session */
export function getStatusUrl(sessionKey: string): string | undefined {
  const entry = sessionStore.get(sessionKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.statusUrl;
  }
  if (entry) {
    sessionStore.delete(sessionKey);
  }
  return undefined;
}

/** Extract status_url from a prepare response based on strategy */
export function extractStatusUrl(response: PrepareResponse): string | undefined {
  // SDK provides a helper function to extract status URL
  return sdkGetStatusUrl(response);
}
