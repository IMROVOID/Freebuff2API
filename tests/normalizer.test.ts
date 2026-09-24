import { describe, expect, it } from "vitest";
import { resolveModelId } from "../src/models/catalog";
import {
  BUFFY_CANONICAL_PREAMBLE,
  normalizeMessages,
  normalizeUpstreamRequest,
  scrubHarnessMarkers,
} from "../src/proxy/normalizer";

describe("Normalizer & Anti-Ban Guard", () => {
  it("should prepend Buffy canonical preamble when no system prompt exists", () => {
    const messages = [{ role: "user" as const, content: "Hello world" }];
    const normalized = normalizeMessages(messages);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].role).toBe("system");
    expect(normalized[0].content).toBe(BUFFY_CANONICAL_PREAMBLE);
    expect(normalized[1].content).toBe("Hello world");
  });

  it("should inject Buffy preamble into existing system prompt if missing", () => {
    const messages = [
      { role: "system" as const, content: "Be concise and accurate." },
      { role: "user" as const, content: "What is 2+2?" },
    ];
    const normalized = normalizeMessages(messages);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].role).toBe("system");
    expect(normalized[0].content.startsWith(BUFFY_CANONICAL_PREAMBLE)).toBe(true);
    expect(normalized[0].content.includes("Be concise and accurate.")).toBe(true);
  });

  it("should preserve system prompt that already has Buffy preamble", () => {
    const messages = [
      { role: "system" as const, content: `${BUFFY_CANONICAL_PREAMBLE}\nCustom rules here.` },
      { role: "user" as const, content: "Hi" },
    ];
    const normalized = normalizeMessages(messages);

    expect(normalized[0].content).toBe(`${BUFFY_CANONICAL_PREAMBLE}\nCustom rules here.`);
  });

  it("should scrub foreign harness markers that cause Freebuff 403 bans", () => {
    const hostilePrompt =
      "You are Claude Code, Anthropic's official CLI. You are Kimi Code CLI. Please help me write code.";
    const scrubbed = scrubHarnessMarkers(hostilePrompt);

    expect(scrubbed).not.toContain("Claude Code");
    expect(scrubbed).not.toContain("Anthropic's official CLI");
    expect(scrubbed).not.toContain("Kimi Code CLI");
    expect(scrubbed).toContain("Please help me write code.");
  });

  it("should resolve aliases and build complete Freebuff upstream payload", () => {
    const req = {
      model: "gpt-4o",
      messages: [{ role: "user" as const, content: "Write a poem" }],
      stream: false,
    };
    const payload = normalizeUpstreamRequest(req);

    expect(payload.model).toBe("deepseek/deepseek-v4-flash");
    expect(payload.stream).toBe(true); // Forced streaming
    expect(payload.provider.data_collection).toBe("deny");
    expect(payload.codebuff_metadata).toBeDefined();
    expect(payload.codebuff_metadata.cost_mode).toBe("free");
    expect(payload.codebuff_metadata.client_id).toHaveLength(13);
    expect(payload.codebuff_metadata.run_id).toBeDefined();
    expect(payload.codebuff_metadata.trace_session_id).toBeDefined();
  });

  it("should resolve model aliases correctly", () => {
    expect(resolveModelId("gpt-4o")).toBe("deepseek/deepseek-v4-flash");
    expect(resolveModelId("claude-3-7-sonnet")).toBe("z-ai/glm-5.3-flash");
    expect(resolveModelId("gemini-flash")).toBe("google/gemini-3.8-flash");
    expect(resolveModelId("deepseek/deepseek-v4-flash")).toBe("deepseek/deepseek-v4-flash");
  });
});
