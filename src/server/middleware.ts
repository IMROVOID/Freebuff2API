import type { Context, MiddlewareHandler } from "hono";
import { createOpenAiError } from "../proxy/errors";

/**
 * Universal CORS middleware for OpenAI-compatible endpoints.
 */
export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-api-key, x-freebuff-model, *",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  await next();

  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "*");
  return;
};

/**
 * Global error handler formatting errors into OpenAI JSON response.
 */
export function handleGlobalError(err: Error, c: Context): Response {
  console.error(`[Freebuff2API Error] ${err.name}: ${err.message}`, err.stack);
  const errorResponse = createOpenAiError(
    err.message || "Internal server error occurred in Freebuff2API proxy.",
    "api_error",
    500
  );
  return c.json(errorResponse, 500);
}
