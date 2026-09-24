import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AccountRecord } from "../types/config";

export interface DiscoveredCredential {
  readonly authToken: string;
  readonly email?: string;
  readonly sourcePath: string;
}

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present at start of string.
 */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Returns candidate filesystem paths for Freebuff/Manicode CLI credentials.
 */
export function getCandidateCredentialPaths(): string[] {
  const home = os.homedir();
  const paths: string[] = [];

  // Environment overrides
  if (process.env.FREEBUFF_CREDENTIALS_PATH) {
    paths.push(path.resolve(process.env.FREEBUFF_CREDENTIALS_PATH));
  }
  if (process.env.FREEBUFF_CONFIG_DIR) {
    paths.push(path.join(path.resolve(process.env.FREEBUFF_CONFIG_DIR), "credentials.json"));
  }

  // Windows APPDATA paths
  if (process.platform === "win32" && process.env.APPDATA) {
    paths.push(path.join(process.env.APPDATA, "manicode", "credentials.json"));
    paths.push(path.join(process.env.APPDATA, "freebuff", "credentials.json"));
    paths.push(path.join(process.env.APPDATA, "codebuff", "credentials.json"));
  }

  // Standard POSIX / UserProfile config locations
  paths.push(path.join(home, ".config", "manicode", "credentials.json"));
  paths.push(path.join(home, ".config", "freebuff", "credentials.json"));
  paths.push(path.join(home, ".config", "codebuff", "credentials.json"));
  paths.push(path.join(home, ".manicode", "credentials.json"));

  return paths;
}

/**
 * Parses credentials file JSON content, handling multiple formats and BOMs.
 */
export function parseCredentialContent(content: string, filePath: string): DiscoveredCredential[] {
  const cleanContent = stripBom(content).trim();
  if (!cleanContent) return [];

  try {
    const parsed = JSON.parse(cleanContent) as Record<string, unknown>;
    const creds: DiscoveredCredential[] = [];

    // Format 1: { "default": { "authToken": "...", "email": "..." } }
    if (parsed.default && typeof parsed.default === "object") {
      const def = parsed.default as Record<string, unknown>;
      if (typeof def.authToken === "string" && def.authToken.trim() !== "") {
        creds.push({
          authToken: def.authToken.trim(),
          email: typeof def.email === "string" ? def.email : undefined,
          sourcePath: filePath,
        });
      }
    }

    // Format 2: Direct { "authToken": "...", "email": "..." }
    if (typeof parsed.authToken === "string" && parsed.authToken.trim() !== "") {
      creds.push({
        authToken: parsed.authToken.trim(),
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        sourcePath: filePath,
      });
    }

    return creds;
  } catch {
    return [];
  }
}

/**
 * Automatically discovers all available Freebuff CLI credentials on the local host.
 */
export function discoverLocalCliCredentials(): AccountRecord[] {
  const candidatePaths = getCandidateCredentialPaths();
  const accounts: AccountRecord[] = [];
  const seenTokens = new Set<string>();

  for (const filePath of candidatePaths) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const creds = parseCredentialContent(content, filePath);

      for (const cred of creds) {
        if (!seenTokens.has(cred.authToken)) {
          seenTokens.add(cred.authToken);
          accounts.push({
            id: `cli_${accounts.length + 1}`,
            authToken: cred.authToken,
            email: cred.email,
            source: "clicreds",
            failureCount: 0,
            cooldownUntil: 0,
            lastUsedAt: 0,
          });
        }
      }
    } catch {
      // Ignore unreadable files
    }
  }

  return accounts;
}
