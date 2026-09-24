import { getStoredAccountsAsRecords } from "../cli/config-store";
import type { AccountRecord } from "../types/config";
import { discoverLocalCliCredentials } from "./clicreds";

export interface LoadAccountsOptions {
  explicitToken?: string;
  skipCliDiscovery?: boolean;
}

/**
 * Loads and consolidates all available Freebuff accounts from all sources.
 */
export function loadAllAccounts(options: LoadAccountsOptions = {}): AccountRecord[] {
  const accounts: AccountRecord[] = [];
  const seenTokens = new Set<string>();

  const addAccount = (account: AccountRecord) => {
    const cleanToken = account.authToken.trim();
    if (!cleanToken || seenTokens.has(cleanToken)) return;
    seenTokens.add(cleanToken);
    accounts.push({
      ...account,
      authToken: cleanToken,
    });
  };

  // 1. Explicit CLI option --token
  if (options.explicitToken && options.explicitToken.trim()) {
    addAccount({
      id: "cli_arg",
      authToken: options.explicitToken.trim(),
      source: "env",
      failureCount: 0,
      cooldownUntil: 0,
      lastUsedAt: 0,
    });
  }

  // 2. Environment variables: FREEBUFF_AUTH_TOKENS (comma separated)
  if (process.env.FREEBUFF_AUTH_TOKENS) {
    const tokens = process.env.FREEBUFF_AUTH_TOKENS.split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (let i = 0; i < tokens.length; i++) {
      addAccount({
        id: `env_tokens_${i + 1}`,
        authToken: tokens[i],
        source: "env",
        failureCount: 0,
        cooldownUntil: 0,
        lastUsedAt: 0,
      });
    }
  }

  // 3. Environment variable: FREEBUFF_AUTH_TOKEN (single)
  if (process.env.FREEBUFF_AUTH_TOKEN && process.env.FREEBUFF_AUTH_TOKEN.trim()) {
    addAccount({
      id: "env_token",
      authToken: process.env.FREEBUFF_AUTH_TOKEN.trim(),
      source: "env",
      failureCount: 0,
      cooldownUntil: 0,
      lastUsedAt: 0,
    });
  }

  // 4. Stored accounts from ~/.freebuff2api/config.json
  const stored = getStoredAccountsAsRecords();
  for (const acc of stored) {
    addAccount(acc);
  }

  // 5. Auto-discovered credentials from Freebuff/Manicode CLI credentials.json
  if (!options.skipCliDiscovery) {
    const cliCreds = discoverLocalCliCredentials();
    for (const acc of cliCreds) {
      addAccount(acc);
    }
  }

  return accounts;
}
