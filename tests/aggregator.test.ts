import { describe, expect, it } from "vitest";
import { aggregateSseStream } from "../src/proxy/aggregator";
import {
  createOpenAiSseTransformStream,
  extractDeltaText,
  extractSseData,
} from "../src/proxy/sse-transform";

describe("SSE Transformer & Aggregator", () => {
  it("should extract SSE data payload correctly", () => {
    expect(extractSseData('data: {"choices":[]}')).toBe('{"choices":[]}');
    expect(extractSseData("data: [DONE]")).toBe("[DONE]");
    expect(extractSseData("event: message")).toBeNull();
    expect(extractSseData(": ping")).toBeNull();
  });

  it("should extract delta text from choice json", () => {
    const raw = {
      choices: [
        {
          index: 0,
          delta: { content: "Hello" },
          finish_reason: null,
        },
      ],
    };
    const delta = extractDeltaText(raw);
    expect(delta.content).toBe("Hello");
    expect(delta.finishReason).toBeNull();
  });

  it("should aggregate forced streaming SSE stream into complete ChatCompletionResponse", async () => {
    const sseLines = [
      'data: {"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of sseLines) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    });

    const result = await aggregateSseStream(stream, "deepseek/deepseek-v4-flash", "test-cmpl-123");

    expect(result.id).toBe("test-cmpl-123");
    expect(result.object).toBe("chat.completion");
    expect(result.model).toBe("deepseek/deepseek-v4-flash");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello world!");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage?.completion_tokens).toBeGreaterThan(0);
  });

  it("should transform upstream stream into OpenAI SSE stream", async () => {
    const sseLines = [
      'data: {"choices":[{"index":0,"delta":{"content":"Chunk1"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"Chunk2"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const encoder = new TextEncoder();
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of sseLines) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    });

    const transformedStream = createOpenAiSseTransformStream(
      upstreamStream,
      "deepseek/deepseek-v4-flash",
      "test-cmpl-456"
    );

    const reader = transformedStream.getReader();
    const decoder = new TextDecoder();
    let output = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(output).toContain("chat.completion.chunk");
    expect(output).toContain("Chunk1");
    expect(output).toContain("Chunk2");
    expect(output).toContain("data: [DONE]");
  });
});
