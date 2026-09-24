import { afterEach, describe, expect, it, vi } from "vitest";
import workerApp from "../src/worker/index";

describe("Cloudflare Worker Integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /v1/health via worker returns 200 and pool status", async () => {
    const env = {
      FREEBUFF_AUTH_TOKENS: "tok_cf_1,tok_cf_2",
    };

    const req = new Request("http://worker.internal/v1/health");
    const res = await workerApp.fetch(req, env);

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.pool.total).toBe(2);
    expect(json.pool.available).toBe(2);
  });

  it("GET /v1/models via worker returns models list", async () => {
    const req = new Request("http://worker.internal/v1/models");
    const res = await workerApp.fetch(req, {});

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.object).toBe("list");
    expect(json.data.length).toBeGreaterThan(0);
  });

  it("POST /v1/chat/completions via worker proxies with environment token", async () => {
    const fakeSseLines = [
      'data: {"choices":[{"index":0,"delta":{"content":"WorkerResponse"},"finish_reason":"stop"}]}\n\n',
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
          JSON.stringify({ instanceId: "inst_cf_test", status: "active" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(mockStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const env = {
      FREEBUFF_AUTH_TOKEN: "cf_secret_token_12345",
    };

    const req = new Request("http://worker.internal/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [{ role: "user", content: "Hello Worker" }],
        stream: false,
      }),
    });

    const res = await workerApp.fetch(req, env);

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.object).toBe("chat.completion");
    expect(json.choices[0].message.content).toBe("WorkerResponse");
  });
});
