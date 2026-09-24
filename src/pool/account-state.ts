import type { AccountRecord } from "../types/config";

export const DEFAULT_BASE_COOLDOWN_MS = 60_000; // 1 minute
export const DEFAULT_MAX_COOLDOWN_MS = 900_000; // 15 minutes

/**
 * Creates an immutable AccountRecord instance.
 */
export function createAccountRecord(
  id: string,
  authToken: string,
  options: Partial<Omit<AccountRecord, "id" | "authToken">> = {}
): AccountRecord {
  return {
    id,
    authToken: authToken.trim(),
    email: options.email,
    name: options.name,
    source: options.source ?? "env",
    failureCount: options.failureCount ?? 0,
    cooldownUntil: options.cooldownUntil ?? 0,
    lastUsedAt: options.lastUsedAt ?? 0,
  };
}

/**
 * Determines whether an account is currently healthy and eligible for requests.
 */
export function isAccountAvailable(account: AccountRecord, now = Date.now()): boolean {
  return account.cooldownUntil <= now;
}

/**
 * Immutably updates account state after a successful request.
 */
export function markAccountSuccess(account: AccountRecord, now = Date.now()): AccountRecord {
  return {
    ...account,
    failureCount: 0,
    cooldownUntil: 0,
    lastUsedAt: now,
  };
}

/**
 * Immutably applies exponential backoff cooldown to an account upon 429/5xx error.
 */
export function markAccountRateLimited(
  account: AccountRecord,
  baseCooldownMs = DEFAULT_BASE_COOLDOWN_MS,
  maxCooldownMs = DEFAULT_MAX_COOLDOWN_MS,
  now = Date.now()
): AccountRecord {
  const currentFailures = account.failureCount;
  const backoffMultiplier = Math.pow(2, Math.min(currentFailures, 6));
  const cooldownDuration = Math.min(baseCooldownMs * backoffMultiplier, maxCooldownMs);

  return {
    ...account,
    failureCount: currentFailures + 1,
    cooldownUntil: now + cooldownDuration,
    lastUsedAt: now,
  };
}

/**
 * Formats remaining cooldown duration in human-readable seconds.
 */
export function getCooldownRemainingSeconds(account: AccountRecord, now = Date.now()): number {
  if (account.cooldownUntil <= now) return 0;
  return Math.ceil((account.cooldownUntil - now) / 1000);
}
