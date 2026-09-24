import { serve } from "@hono/node-server";
import { loadAllAccounts } from "../../auth/token-manager";
import { createFreebuffApp } from "../../index";
import { AccountPoolManager } from "../../pool/account-pool";

export interface ServeOptions {
  port?: number | string;
  host?: string;
  token?: string;
  upstream?: string;
}

export function startServer(options: ServeOptions): void {
  const port = Number(options.port) || 8787;
  const host = options.host || "127.0.0.1";
  const upstreamBase =
    options.upstream || process.env.FREEBUFF_UPSTREAM_BASE || "https://freebuff.com";

  // Load all accounts (explicit flag, env, config store, CLI creds)
  const accounts = loadAllAccounts({ explicitToken: options.token });
  const poolManager = new AccountPoolManager(accounts);

  const app = createFreebuffApp({
    upstreamBase,
    poolManager,
    getAuthToken: () => {
      const acc = poolManager.getNextAccount();
      return acc ? acc.authToken : null;
    },
  });

  const stats = poolManager.getStats();

  console.log(`\n🚀 Freebuff2API running at http://${host}:${port}`);
  console.log(`   - Pool Status:      ${stats.available} active account(s) ready`);
  console.log(`   - Chat Completions: http://${host}:${port}/v1/chat/completions`);
  console.log(`   - Models:           http://${host}:${port}/v1/models`);
  console.log(`   - Health:           http://${host}:${port}/v1/health\n`);

  if (stats.available === 0) {
    console.warn("⚠️  Warning: No Freebuff accounts found.");
    console.warn("   Run 'freebuff2api login' or pass '--token <token>'.\n");
  }

  serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });
}
