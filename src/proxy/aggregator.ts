import type { ChatCompletionResponse } from "../types/openai";
import { extractDeltaText, extractSseData } from "./sse-transform";

/**
 * Aggregates a forced upstream SSE stream into a single complete
 * OpenAI ChatCompletionResponse for clients requesting stream: false.
 */
export async function aggregateSseStream(
  upstreamStream: ReadableStream<Uint8Array>,
  model: string,
  completionId: string
): Promise<ChatCompletionResponse> {
  const textDecoder = new TextDecoder();
  const reader = upstreamStream.getReader();
  const created = Math.floor(Date.now() / 1000);

  let accumulatedContent = "";
  let finishReason: "stop" | "length" = "stop";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += textDecoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const data = extractSseData(line);
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = extractDeltaText(parsed);
          if (delta.content) {
            accumulatedContent += delta.content;
          }
          if (delta.finishReason) {
            finishReason = delta.finishReason;
          }
        } catch {
          // ignore non-json SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Estimate token counts roughly (1 token ~ 4 chars)
  const completionTokens = Math.max(1, Math.ceil(accumulatedContent.length / 4));

  return {
    id: completionId,
    object: "chat.completion",
    created,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: accumulatedContent,
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: completionTokens,
      total_tokens: completionTokens,
    },
  };
}
