import type { FreebuffUpstreamPayload } from "../types/freebuff";

export const DEFAULT_UPSTREAM_BASE = "https://freebuff.com";
export const COMPLETION_USER_AGENT = "ai-sdk/openai-compatible/1.0.0/codebuff";
export const AUTH_USER_AGENT = "Bun/1.3.14";

export interface UpstreamDispatchOptions {
  upstreamBase?: string;
  authToken: string;
  payload: FreebuffUpstreamPayload;
  signal?: AbortSignal;
}

/**
 * Dispatches an inference request to upstream Freebuff using strict anti-ban headers.
 */
export async function dispatchUpstreamCompletion({
  upstreamBase = DEFAULT_UPSTREAM_BASE,
  authToken,
  payload,
  signal,
}: UpstreamDispatchOptions): Promise<Response> {
  const url = `${upstreamBase.replace(/\/+$/, "")}/api/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken.trim()}`,
    "User-Agent": COMPLETION_USER_AGENT,
    Accept: "text/event-stream, application/json",
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: signal || AbortSignal.timeout(60_000),
  });

  return response;
}
