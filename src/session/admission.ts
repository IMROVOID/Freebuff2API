import { AUTH_USER_AGENT } from "../proxy/upstream";
import type { SessionAdmissionResponse } from "../types/freebuff";
import { generateClientId } from "./fingerprint";

export interface CachedAdmission {
  readonly instanceId: string;
  readonly expiresAt: number;
}

// In-memory cache for session instance IDs per (authToken, model)
const admissionCache = new Map<string, CachedAdmission>();

export function getAdmissionCacheKey(authToken: string, model: string): string {
  return `${authToken.trim()}:${model.trim()}`;
}

/**
 * Obtains or retrieves a cached active session admission instanceId for Freebuff.
 */
export async function getSessionAdmission(
  authToken: string,
  model: string,
  upstreamBase = "https://freebuff.com"
): Promise<string> {
  const cacheKey = getAdmissionCacheKey(authToken, model);
  const now = Date.now();
  const cached = admissionCache.get(cacheKey);

  // Return cached instance if valid for at least 30 more seconds
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.instanceId;
  }

  const endpoint = `${upstreamBase.replace(/\/+$/, "")}/api/v1/freebuff/session/admission`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken.trim()}`,
        "User-Agent": AUTH_USER_AGENT,
        "x-freebuff-model": model,
        "x-freebuff-wallet-spend-limit": "0",
        "x-fb-timezone": "UTC",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = (await res.json()) as SessionAdmissionResponse;
      if (data.instanceId) {
        const expiresAt = data.expiresAt || now + 300_000; // Default 5m TTL
        admissionCache.set(cacheKey, {
          instanceId: data.instanceId,
          expiresAt,
        });
        return data.instanceId;
      }
    }
  } catch {
    // Non-fatal if admission endpoint is temporarily down
  }

  // Graceful fallback: mint local session instance
  const fallbackInstanceId = `fb_inst_${generateClientId()}`;
  admissionCache.set(cacheKey, {
    instanceId: fallbackInstanceId,
    expiresAt: now + 120_000,
  });
  return fallbackInstanceId;
}

export function clearAdmissionCache(): void {
  admissionCache.clear();
}
