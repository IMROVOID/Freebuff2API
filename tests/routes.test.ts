import { describe, expect, it, vi } from "vitest";
import { createFreebuffApp } from "../src/index";

describe("API Routes Integration", () => {
  it("GET /v1/health returns 200 and ok status", async () => {
    const app = createFreebuffApp();
    const res = await app.request("/v1/health");

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.service).toBe("Freebuff2API");
  });

  it("GET /v1/models returns model catalog in OpenAI format", async () => {
    const app = createFreebuffApp();
    const res = await app.request("/v1/models");

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.object).toBe("list");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].object).toBe("model");
    expect(json.data.some((m: any) => m.id === "deepseek/deepseek-v4-flash")).toBe(true);
  });

  it("POST /v1/chat/completions rejects invalid JSON or missing messages", async () => {
    const app = createFreebuffApp();
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error).toBeDefined();
    expect(json.error.type).toBe("invalid_request_error");
  });

  it("POST /v1/chat/completions returns 401 when no token is provided", async () => {
    const app = createFreebuffApp();
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("missing_auth_token");
  });

  it("POST /v1/chat/completions successfully proxies and aggregates non-streaming response", async () => {
    const fakeSseLines = [
      'data: {"choices":[{"index":0,"delta":{"content":"Pong!"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of fakeSseLines) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("/session/admission")) {
        return new Response(
          JSON.stringify({ instanceId: "inst_test_123", status: "active" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(mockStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const app = createFreebuffApp({
      getAuthToken: () => "mock-token-1234567890",
    });

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [{ role: "user", content: "Ping" }],
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.object).toBe("chat.completion");
    expect(json.choices[0].message.content).toBe("Pong!");
    expect(json.choices[0].finish_reason).toBe("stop");

    vi.unstubAllGlobals();
  });

  it("POST /v1/chat/completions returns text/event-stream when stream: true", async () => {
    const fakeSseLines = [
      'data: {"choices":[{"index":0,"delta":{"content":"StreamPong"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of fakeSseLines) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("/session/admission")) {
        return new Response(
          JSON.stringify({ instanceId: "inst_test_stream", status: "active" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(mockStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const app = createFreebuffApp({
      getAuthToken: () => "mock-token-1234567890",
    });

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [{ role: "user", content: "Ping" }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("StreamPong");
    expect(text).toContain("[DONE]");

    vi.unstubAllGlobals();
  });
});
