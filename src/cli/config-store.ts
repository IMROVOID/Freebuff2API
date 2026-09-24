import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AccountRecord } from "../types/config";

export interface StoredAccount {
  readonly id: string;
  readonly authToken: string;
  readonly email?: string;
  readonly name?: string;
  readonly addedAt: number;
}

export interface StoredConfig {
  readonly accounts: readonly StoredAccount[];
}

export function getConfigDir(): string {
  return path.join(os.homedir(), ".freebuff2api");
}

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function loadStoredConfig(): StoredConfig {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) {
    return { accounts: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    return { accounts };
  } catch {
    return { accounts: [] };
  }
}

export function saveStoredConfig(config: StoredConfig): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getConfigFilePath();
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export function addAccountToStore(account: StoredAccount): void {
  const current = loadStoredConfig();
  const filtered = current.accounts.filter((a) => a.authToken !== account.authToken);
  const updated: StoredConfig = {
    accounts: [...filtered, account],
  };
  saveStoredConfig(updated);
}

export function getStoredAccountsAsRecords(): AccountRecord[] {
  const config = loadStoredConfig();
  return config.accounts.map((a, index) => ({
    id: a.id || `stored_${index + 1}`,
    authToken: a.authToken,
    email: a.email,
    name: a.name,
    source: "config",
    failureCount: 0,
    cooldownUntil: 0,
    lastUsedAt: 0,
  }));
}
