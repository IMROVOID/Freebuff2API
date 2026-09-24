import { describe, expect, it } from "vitest";
import { AccountPoolManager } from "../src/pool/account-pool";
import {
  createAccountRecord,
  isAccountAvailable,
  markAccountRateLimited,
  markAccountSuccess,
} from "../src/pool/account-state";

describe("Account Pool & Resilience", () => {
  it("should create immutable account records with defaults", () => {
    const acc = createAccountRecord("acc1", "token-1");
    expect(acc.id).toBe("acc1");
    expect(acc.authToken).toBe("token-1");
    expect(acc.failureCount).toBe(0);
    expect(acc.cooldownUntil).toBe(0);
    expect(isAccountAvailable(acc)).toBe(true);
  });

  it("should apply exponential backoff on rate limits", () => {
    const now = 1000000;
    const baseCooldownMs = 10_000; // 10s base
    const maxCooldownMs = 100_000;

    let acc = createAccountRecord("acc1", "token-1");

    // Failure 1: 10s cooldown
    acc = markAccountRateLimited(acc, baseCooldownMs, maxCooldownMs, now);
    expect(acc.failureCount).toBe(1);
    expect(acc.cooldownUntil).toBe(now + 10_000);
    expect(isAccountAvailable(acc, now + 5000)).toBe(false);
    expect(isAccountAvailable(acc, now + 10_001)).toBe(true);

    // Failure 2: 20s cooldown
    acc = markAccountRateLimited(acc, baseCooldownMs, maxCooldownMs, now + 10_001);
    expect(acc.failureCount).toBe(2);
    expect(acc.cooldownUntil).toBe(now + 10_001 + 20_000);

    // Success resets failure count
    acc = markAccountSuccess(acc, now + 40_000);
    expect(acc.failureCount).toBe(0);
    expect(acc.cooldownUntil).toBe(0);
    expect(isAccountAvailable(acc, now + 40_000)).toBe(true);
  });

  it("should round-robin across available accounts", () => {
    const acc1 = createAccountRecord("acc1", "token-1");
    const acc2 = createAccountRecord("acc2", "token-2");
    const pool = new AccountPoolManager([acc1, acc2]);

    expect(pool.getNextAccount()?.authToken).toBe("token-1");
    expect(pool.getNextAccount()?.authToken).toBe("token-2");
    expect(pool.getNextAccount()?.authToken).toBe("token-1");
  });

  it("should automatically skip cooled-down accounts", () => {
    const acc1 = createAccountRecord("acc1", "token-1");
    const acc2 = createAccountRecord("acc2", "token-2");
    const pool = new AccountPoolManager([acc1, acc2], 30_000);

    const now = Date.now();
    // Put acc1 on rate limit cooldown
    pool.reportRateLimit("token-1", now);

    // Next account should be acc2
    expect(pool.getNextAccount(now)?.authToken).toBe("token-2");
    // Next account should still be acc2 because acc1 is cooling down
    expect(pool.getNextAccount(now)?.authToken).toBe("token-2");

    // After cooldown expires (now + 35s), acc1 is available again
    const later = now + 35_000;
    const nextAfterCooldown = pool.getNextAccount(later);
    expect(nextAfterCooldown).toBeDefined();
  });

  it("should return null and accurate stats when all accounts are cooling down", () => {
    const acc1 = createAccountRecord("acc1", "token-1");
    const pool = new AccountPoolManager([acc1], 60_000);
    const now = Date.now();

    pool.reportRateLimit("token-1", now);

    expect(pool.getNextAccount(now)).toBeNull();
    const stats = pool.getStats(now);
    expect(stats.total).toBe(1);
    expect(stats.available).toBe(0);
    expect(stats.coolingDown).toBe(1);
    expect(stats.nextCooldownSeconds).toBeGreaterThan(0);
  });
});
