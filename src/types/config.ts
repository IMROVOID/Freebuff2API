export interface AccountRecord {
  readonly id: string;
  readonly authToken: string;
  readonly email?: string;
  readonly name?: string;
  readonly source: "clicreds" | "login" | "env" | "config";
  readonly failureCount: number;
  readonly cooldownUntil: number; // Unix timestamp ms
  readonly lastUsedAt: number;
}

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly defaultModel: string;
  readonly upstreamBase: string;
  readonly cooldownDurationMs: number;
  readonly maxCooldownDurationMs: number;
}

export interface WorkerEnv {
  FREEBUFF_AUTH_TOKENS?: string;
  FREEBUFF_AUTH_TOKEN?: string;
  DEFAULT_MODEL?: string;
  UPSTREAM_BASE?: string;
}
