import { Hono } from "hono";
import { AccountPoolManager } from "../pool/account-pool";
import { createAccountRecord } from "../pool/account-state";
import { corsMiddleware, handleGlobalError } from "../server/middleware";
import { createApiRoutes } from "../server/routes";
import type { AccountRecord, WorkerEnv } from "../types/config";

const app = new Hono<{ Bindings: WorkerEnv }>();

// Global middleware
app.use("*", corsMiddleware);
app.onError((err, c) => handleGlobalError(err, c));

// Worker request handler
app.all("*", async (c) => {
  const env = c.env || {};
  const accounts: AccountRecord[] = [];

  // Parse comma-separated or single tokens from Cloudflare secrets/env
  if (env.FREEBUFF_AUTH_TOKENS) {
    const tokens = env.FREEBUFF_AUTH_TOKENS.split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (let i = 0; i < tokens.length; i++) {
      accounts.push(createAccountRecord(`cf_token_${i + 1}`, tokens[i], { source: "env" }));
    }
  }

  if (env.FREEBUFF_AUTH_TOKEN && env.FREEBUFF_AUTH_TOKEN.trim()) {
    const singleToken = env.FREEBUFF_AUTH_TOKEN.trim();
    if (!accounts.some((a) => a.authToken === singleToken)) {
      accounts.push(createAccountRecord("cf_single_token", singleToken, { source: "env" }));
    }
  }

  const poolManager = new AccountPoolManager(accounts);
  const upstreamBase = env.UPSTREAM_BASE || "https://freebuff.com";

  const apiRouter = createApiRoutes({
    upstreamBase,
    poolManager,
    getAuthToken: () => {
      const selected = poolManager.getNextAccount();
      return selected ? selected.authToken : null;
    },
  });

  return apiRouter.fetch(c.req.raw);
});

export default app;
