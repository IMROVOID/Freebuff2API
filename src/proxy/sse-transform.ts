import type { ChatCompletionChunk } from "../types/openai";

export const SSE_DONE_MESSAGE = "data: [DONE]\n\n";

/**
 * Parses a raw SSE event line and extracts JSON data payload.
 */
export function extractSseData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  const payload = trimmed.slice(5).trim();
  if (payload === "" || payload === "[DONE]") {
    return payload;
  }
  return payload;
}

/**
 * Creates a standard OpenAI-compatible SSE chunk string.
 */
export function formatOpenAiChunk(chunk: ChatCompletionChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Extracts delta text from an upstream Freebuff JSON chunk.
 */
export function extractDeltaText(parsedJson: unknown): {
  content: string;
  finishReason: "stop" | "length" | null;
} {
  if (typeof parsedJson !== "object" || parsedJson === null) {
    return { content: "", finishReason: null };
  }

  const obj = parsedJson as Record<string, unknown>;
  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  if (choices.length === 0) {
    return { content: "", finishReason: null };
  }

  const firstChoice = choices[0] as Record<string, unknown>;
  const delta = (firstChoice.delta || {}) as Record<string, unknown>;
  const content = typeof delta.content === "string" ? delta.content : "";
  const finishReason =
    typeof firstChoice.finish_reason === "string"
      ? (firstChoice.finish_reason as "stop" | "length")
      : null;

  return { content, finishReason };
}

/**
 * Transforms an upstream SSE stream into an OpenAI-compliant SSE ReadableStream.
 */
export function createOpenAiSseTransformStream(
  upstreamStream: ReadableStream<Uint8Array>,
  model: string,
  completionId: string
): ReadableStream<Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const reader = upstreamStream.getReader();
  const created = Math.floor(Date.now() / 1000);

  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush remaining buffer if needed
            if (buffer.trim().length > 0) {
              const data = extractSseData(buffer);
              if (data && data !== "[DONE]") {
                try {
                  const parsed = JSON.parse(data);
                  const { content, finishReason } = extractDeltaText(parsed);
                  if (content || finishReason) {
                    const chunk: ChatCompletionChunk = {
                      id: completionId,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{ index: 0, delta: { content }, finish_reason: finishReason }],
                    };
                    controller.enqueue(textEncoder.encode(formatOpenAiChunk(chunk)));
                  }
                } catch {
                  // ignore malformed tail
                }
              }
            }
            controller.enqueue(textEncoder.encode(SSE_DONE_MESSAGE));
            controller.close();
            return;
          }

          buffer += textDecoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last partial line in buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const data = extractSseData(line);
            if (!data) continue;

            if (data === "[DONE]") {
              controller.enqueue(textEncoder.encode(SSE_DONE_MESSAGE));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const { content, finishReason } = extractDeltaText(parsed);
              if (content || finishReason) {
                const chunk: ChatCompletionChunk = {
                  id: completionId,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  choices: [{ index: 0, delta: { content }, finish_reason: finishReason }],
                };
                controller.enqueue(textEncoder.encode(formatOpenAiChunk(chunk)));
              }
            } catch {
              // Ignore non-JSON lines or ping events
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
