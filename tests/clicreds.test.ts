import { describe, expect, it } from "vitest";
import {
  getCandidateCredentialPaths,
  parseCredentialContent,
  stripBom,
} from "../src/auth/clicreds";

describe("CLI Credentials Discovery", () => {
  it("should strip UTF-8 BOM if present", () => {
    const withBom = "\uFEFF{\"default\":{\"authToken\":\"test-token\"}}";
    expect(withBom.charCodeAt(0)).toBe(0xfeff);
    const stripped = stripBom(withBom);
    expect(stripped.charCodeAt(0)).not.toBe(0xfeff);
    expect(stripped).toBe("{\"default\":{\"authToken\":\"test-token\"}}");
  });

  it("should return candidate credential paths for host", () => {
    const paths = getCandidateCredentialPaths();
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((p) => p.includes("manicode"))).toBe(true);
    expect(paths.some((p) => p.includes("credentials.json"))).toBe(true);
  });

  it("should parse standard nested format credentials JSON", () => {
    const json = JSON.stringify({
      default: {
        authToken: "fb_live_123456789",
        email: "coder@example.com",
      },
    });

    const parsed = parseCredentialContent(json, "/mock/credentials.json");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].authToken).toBe("fb_live_123456789");
    expect(parsed[0].email).toBe("coder@example.com");
    expect(parsed[0].sourcePath).toBe("/mock/credentials.json");
  });

  it("should parse flat format credentials JSON with BOM", () => {
    const raw = "\uFEFF" + JSON.stringify({
      authToken: "fb_live_flat_987",
      email: "flat@example.com",
    });

    const parsed = parseCredentialContent(raw, "/mock/flat.json");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].authToken).toBe("fb_live_flat_987");
  });

  it("should gracefully handle malformed or empty content", () => {
    expect(parseCredentialContent("", "/mock/empty.json")).toHaveLength(0);
    expect(parseCredentialContent("{invalid json}", "/mock/bad.json")).toHaveLength(0);
    expect(parseCredentialContent("{}", "/mock/none.json")).toHaveLength(0);
  });
});
