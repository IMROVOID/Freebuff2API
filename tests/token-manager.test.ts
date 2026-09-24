import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { maskToken } from "../src/cli/commands/accounts";
import { loadAllAccounts } from "../src/auth/token-manager";

describe("Token Manager & Masking", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FREEBUFF_AUTH_TOKEN;
    delete process.env.FREEBUFF_AUTH_TOKENS;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("should mask tokens safely", () => {
    expect(maskToken("12345")).toBe("********");
    expect(maskToken("fb_live_123456789abcdef")).toBe("fb_l...cdef");
  });

  it("should prioritize explicit token", () => {
    const accounts = loadAllAccounts({
      explicitToken: "explicit_token_123",
      skipCliDiscovery: true,
    });

    expect(accounts.length).toBeGreaterThanOrEqual(1);
    expect(accounts[0].authToken).toBe("explicit_token_123");
    expect(accounts[0].id).toBe("cli_arg");
  });

  it("should parse and deduplicate comma-separated FREEBUFF_AUTH_TOKENS", () => {
    process.env.FREEBUFF_AUTH_TOKENS = "tok_1, tok_2, tok_1, tok_3";
    const accounts = loadAllAccounts({ skipCliDiscovery: true });

    const tokens = accounts.map((a) => a.authToken);
    expect(tokens).toContain("tok_1");
    expect(tokens).toContain("tok_2");
    expect(tokens).toContain("tok_3");
    expect(tokens.filter((t) => t === "tok_1")).toHaveLength(1);
  });
});
