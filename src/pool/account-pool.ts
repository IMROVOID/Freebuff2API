import type { AccountRecord } from "../types/config";
import {
  DEFAULT_BASE_COOLDOWN_MS,
  DEFAULT_MAX_COOLDOWN_MS,
  getCooldownRemainingSeconds,
  isAccountAvailable,
  markAccountRateLimited,
  markAccountSuccess,
} from "./account-state";

export interface PoolStats {
  readonly total: number;
  readonly available: number;
  readonly coolingDown: number;
  readonly nextCooldownSeconds: number;
}

export class AccountPoolManager {
  private accounts: readonly AccountRecord[];
  private currentIndex: number;
  private readonly baseCooldownMs: number;
  private readonly maxCooldownMs: number;

  constructor(
    initialAccounts: readonly AccountRecord[] = [],
    baseCooldownMs = DEFAULT_BASE_COOLDOWN_MS,
    maxCooldownMs = DEFAULT_MAX_COOLDOWN_MS
  ) {
    this.accounts = [...initialAccounts];
    this.currentIndex = 0;
    this.baseCooldownMs = baseCooldownMs;
    this.maxCooldownMs = maxCooldownMs;
  }

  /**
   * Sets or updates the active accounts in the pool.
   */
  public setAccounts(newAccounts: readonly AccountRecord[]): void {
    this.accounts = [...newAccounts];
    if (this.currentIndex >= this.accounts.length) {
      this.currentIndex = 0;
    }
  }

  /**
   * Selects the next available account via round-robin, skipping cooled down accounts.
   */
  public getNextAccount(now = Date.now()): AccountRecord | null {
    if (this.accounts.length === 0) {
      return null;
    }

    const total = this.accounts.length;
    for (let i = 0; i < total; i++) {
      const idx = (this.currentIndex + i) % total;
      const candidate = this.accounts[idx];

      if (isAccountAvailable(candidate, now)) {
        this.currentIndex = (idx + 1) % total;
        return candidate;
      }
    }

    return null;
  }

  /**
   * Records a rate-limit event against a token, placing that account into exponential cooldown.
   */
  public reportRateLimit(token: string, now = Date.now()): void {
    const clean = token.trim();
    this.accounts = this.accounts.map((acc) => {
      if (acc.authToken === clean) {
        return markAccountRateLimited(acc, this.baseCooldownMs, this.maxCooldownMs, now);
      }
      return acc;
    });
  }

  /**
   * Records a successful request, clearing previous failure counters.
   */
  public reportSuccess(token: string, now = Date.now()): void {
    const clean = token.trim();
    this.accounts = this.accounts.map((acc) => {
      if (acc.authToken === clean) {
        return markAccountSuccess(acc, now);
      }
      return acc;
    });
  }

  /**
   * Returns high-level availability statistics for the pool.
   */
  public getStats(now = Date.now()): PoolStats {
    let available = 0;
    let coolingDown = 0;
    let minCooldownSeconds = Infinity;

    for (const acc of this.accounts) {
      if (isAccountAvailable(acc, now)) {
        available++;
      } else {
        coolingDown++;
        const rem = getCooldownRemainingSeconds(acc, now);
        if (rem < minCooldownSeconds) {
          minCooldownSeconds = rem;
        }
      }
    }

    return {
      total: this.accounts.length,
      available,
      coolingDown,
      nextCooldownSeconds: minCooldownSeconds === Infinity ? 0 : minCooldownSeconds,
    };
  }

  /**
   * Returns a snapshot of all accounts in the pool.
   */
  public getAllAccounts(): readonly AccountRecord[] {
    return this.accounts;
  }
}
