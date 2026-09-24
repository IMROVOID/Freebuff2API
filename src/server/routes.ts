import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getOpenAIModelList, resolveModelId } from "../models/catalog";
import type { AccountPoolManager } from "../pool/account-pool";
import { aggregateSseStream } from "../proxy/aggregator";
import { createOpenAiError, mapUpstreamError } from "../proxy/errors";
import { normalizeUpstreamRequest } from "../proxy/normalizer";
import { createOpenAiSseTransformStream } from "../proxy/sse-transform";
import { dispatchUpstreamCompletion } from "../proxy/upstream";
import { getSessionAdmission } from "../session/admission";
import { generateUuid } from "../session/fingerprint";
import type { ChatCompletionRequest } from "../types/openai";

export interface RoutesConfig {
  getAuthToken?: () => Promise<string | null> | string | null;
  upstreamBase?: string;
  poolManager?: AccountPoolManager;
}

export function createApiRoutes(config: RoutesConfig = {}): Hono {
  const router = new Hono();

  // Health checks
  const healthHandler = (c: Context) => {
    const stats = config.poolManager ? config.poolManager.getStats() : undefined;
    return c.json({
      status: "ok",
      service: "Freebuff2API",
      timestamp: new Date().toISOString(),
      upstream: config.upstreamBase || "https://freebuff.com",
      pool: stats,
    });
  };

  router.get("/v1/health", healthHandler);
  router.get("/healthz", healthHandler);
  router.get("/", healthHandler);

  // Models catalog
  router.get("/v1/models", (c) => {
    return c.json(getOpenAIModelList());
  });

  // Chat completions
  router.post("/v1/chat/completions", async (c) => {
    let body: ChatCompletionRequest;
    try {
      body = await c.req.json<ChatCompletionRequest>();
    } catch {
      return c.json(
        createOpenAiError("Invalid JSON in request body", "invalid_request_error"),
        400
      );
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json(
        createOpenAiError("Field 'messages' must be a non-empty array", "invalid_request_error"),
        400
      );
    }

    // Determine auth token
    let token: string | null = null;
    const clientAuth = c.req.header("Authorization");
    if (clientAuth && clientAuth.startsWith("Bearer ")) {
      const parsedToken = clientAuth.slice(7).trim();
      if (parsedToken && !parsedToken.startsWith("sk-dummy") && parsedToken.length > 10) {
        token = parsedToken;
      }
    }

    // If client didn't supply a direct token, consult pool manager or getAuthToken
    if (!token && config.poolManager) {
      const selected = config.poolManager.getNextAccount();
      if (selected) {
        token = selected.authToken;
      } else {
        const stats = config.poolManager.getStats();
        if (stats.coolingDown > 0) {
          return c.json(
            createOpenAiError(
              `All Freebuff accounts are currently cooling down due to upstream rate limits. Try again in ${stats.nextCooldownSeconds}s.`,
              "rate_limit_error",
              "all_accounts_cooling_down"
            ),
            429
          );
        }
      }
    }

    if (!token && config.getAuthToken) {
      token = await config.getAuthToken();
    }

    if (!token) {
      return c.json(
        createOpenAiError(
          "No Freebuff auth token available. Please provide via Bearer auth, CLI login, or FREEBUFF_AUTH_TOKEN.",
          "authentication_error",
          "missing_auth_token"
        ),
        401
      );
    }

    const completionId = `chatcmpl-${generateUuid()}`;
    const resolvedModel = resolveModelId(body.model);

    // Obtain or verify session admission
    let instanceId: string | undefined;
    try {
      instanceId = await getSessionAdmission(token, resolvedModel, config.upstreamBase);
    } catch {
      // Non-fatal, normalizer will mint fallback instance
    }

    const normalizedPayload = normalizeUpstreamRequest(body, instanceId);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await dispatchUpstreamCompletion({
        upstreamBase: config.upstreamBase,
        authToken: token,
        payload: normalizedPayload,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(
        createOpenAiError(`Failed to connect to Freebuff upstream: ${message}`, "api_error"),
        502
      );
    }

    if (!upstreamResponse.ok) {
      if (upstreamResponse.status === 429 && config.poolManager) {
        config.poolManager.reportRateLimit(token);
      }
      const errText = await upstreamResponse.text();
      const mapped = mapUpstreamError(upstreamResponse.status, errText);
      return c.json(mapped.body, mapped.status as ContentfulStatusCode);
    }

    // Mark success on pool
    if (config.poolManager) {
      config.poolManager.reportSuccess(token);
    }

    if (!upstreamResponse.body) {
      return c.json(
        createOpenAiError("Empty response body from Freebuff upstream", "api_error"),
        502
      );
    }

    const isClientStreaming = Boolean(body.stream);

    if (isClientStreaming) {
      const transformStream = createOpenAiSseTransformStream(
        upstreamResponse.body,
        resolvedModel,
        completionId
      );

      return new Response(transformStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Non-streaming aggregation
    try {
      const aggregated = await aggregateSseStream(
        upstreamResponse.body,
        resolvedModel,
        completionId
      );
      return c.json(aggregated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(
        createOpenAiError(`Failed to aggregate Freebuff stream: ${message}`, "api_error"),
        500
      );
    }
  });

  return router;
}
