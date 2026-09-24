import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAdmissionCache,
  getAdmissionCacheKey,
  getSessionAdmission,
} from "../src/session/admission";

describe("Session Admission", () => {
  beforeEach(() => {
    clearAdmissionCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should generate deterministic cache key", () => {
    expect(getAdmissionCacheKey("token-a", "glm-5")).toBe("token-a:glm-5");
  });

  it("should request admission and cache instanceId", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          instanceId: "inst_test_12345",
          status: "active",
          expiresAt: Date.now() + 300_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", mockFetch);

    const instanceId1 = await getSessionAdmission("tok1", "deepseek/deepseek-v4-flash");
    expect(instanceId1).toBe("inst_test_12345");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should hit in-memory cache without fetch
    const instanceId2 = await getSessionAdmission("tok1", "deepseek/deepseek-v4-flash");
    expect(instanceId2).toBe("inst_test_12345");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should mint fallback instance ID if upstream admission fails", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    vi.stubGlobal("fetch", mockFetch);

    const fallbackInstance = await getSessionAdmission("tok2", "openai/gpt-6-luna");
    expect(fallbackInstance.startsWith("fb_inst_")).toBe(true);
    expect(fallbackInstance.length).toBeGreaterThan(10);
  });
});
