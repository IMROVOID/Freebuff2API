import type { OpenAIErrorResponse } from "../types/openai";

export function createOpenAiError(
  message: string,
  type = "invalid_request_error",
  code: string | number | null = null,
  param: string | null = null
): OpenAIErrorResponse {
  return {
    error: {
      message,
      type,
      param,
      code,
    },
  };
}

export function mapUpstreamError(
  statusCode: number,
  responseText: string
): { status: number; body: OpenAIErrorResponse } {
  let message = responseText;
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    if (typeof parsed.error === "string") {
      message = parsed.error;
    } else if (typeof parsed.message === "string") {
      message = parsed.message;
    }
  } catch {
    // Keep raw response text
  }

  if (statusCode === 401) {
    return {
      status: 401,
      body: createOpenAiError(
        `Invalid or expired Freebuff auth token: ${message}`,
        "authentication_error",
        "invalid_api_key"
      ),
    };
  }

  if (statusCode === 403) {
    return {
      status: 403,
      body: createOpenAiError(
        `Freebuff anti-ban guard rejected request: ${message}`,
        "permission_error",
        "free_mode_cli_required"
      ),
    };
  }

  if (statusCode === 429) {
    return {
      status: 429,
      body: createOpenAiError(
        `Freebuff rate limit exceeded. Please wait or cycle account: ${message}`,
        "rate_limit_error",
        "rate_limit_exceeded"
      ),
    };
  }

  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    body: createOpenAiError(`Upstream Freebuff error: ${message}`, "api_error", statusCode),
  };
}
