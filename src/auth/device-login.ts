import * as childProcess from "node:child_process";
import * as crypto from "node:crypto";
import { addAccountToStore } from "../cli/config-store";
import { AUTH_USER_AGENT } from "../proxy/upstream";
import type { CliAuthCodeResponse, CliAuthStatusResponse, FreebuffUser } from "../types/freebuff";

export { AUTH_USER_AGENT };

export interface DeviceLoginOptions {
  upstreamBase?: string;
  onCodeReceived?: (loginUrl: string) => void;
  signal?: AbortSignal;
}

/**
 * Attempts to launch system default browser to the given URL.
 */
export function openBrowser(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return;
    }
    const cleanUrl = parsed.toString();
    if (process.platform === "win32") {
      childProcess.exec(`start "" "${cleanUrl.replace(/"/g, "")}"`);
    } else if (process.platform === "darwin") {
      childProcess.spawn("open", [cleanUrl], { detached: true, stdio: "ignore" }).unref();
    } else {
      childProcess.spawn("xdg-open", [cleanUrl], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Non-fatal if browser cannot be launched in headless environments
  }
}

/**
 * Generates an enhanced base64url fingerprint identifier.
 */
export function generateFingerprintId(): string {
  const bytes = crypto.randomBytes(24);
  return `enhanced-${bytes.toString("base64url")}`;
}

/**
 * Executes the complete headless device-code OAuth flow with Freebuff.
 */
export async function executeDeviceCodeLogin(
  options: DeviceLoginOptions = {}
): Promise<FreebuffUser> {
  const upstreamBase = options.upstreamBase || "https://freebuff.com";
  const fingerprintId = generateFingerprintId();

  // 1. Request device code
  const codeEndpoint = `${upstreamBase.replace(/\/+$/, "")}/api/auth/cli/code`;
  const codeRes = await fetch(codeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": AUTH_USER_AGENT,
    },
    body: JSON.stringify({ fingerprintId }),
    signal: options.signal,
  });

  if (!codeRes.ok) {
    const text = await codeRes.text();
    throw new Error(`Failed to initiate CLI device login (${codeRes.status}): ${text}`);
  }

  const codeData = (await codeRes.json()) as CliAuthCodeResponse;
  const { loginUrl, fingerprintHash, expiresAt } = codeData;

  if (options.onCodeReceived) {
    options.onCodeReceived(loginUrl);
  } else {
    console.log(`\n🔑 Please open the following URL in your browser to sign in:`);
    console.log(`   ${loginUrl}\n`);
    openBrowser(loginUrl);
  }

  // 2. Poll status endpoint every 5 seconds until approved or expired
  const statusEndpoint = `${upstreamBase.replace(/\/+$/, "")}/api/auth/cli/status`;
  const pollParams = new URLSearchParams({
    fingerprintId,
    fingerprintHash,
    expiresAt: String(expiresAt),
  });
  const pollUrl = `${statusEndpoint}?${pollParams.toString()}`;

  while (Date.now() < expiresAt) {
    if (options.signal?.aborted) {
      throw new Error("Device login was cancelled.");
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const statusRes = await fetch(pollUrl, {
        headers: {
          "User-Agent": AUTH_USER_AGENT,
        },
        signal: options.signal,
      });

      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as CliAuthStatusResponse;
        if (statusData.user && statusData.user.authToken) {
          const user = statusData.user;
          // Save to local config store
          addAccountToStore({
            id: user.id,
            authToken: user.authToken,
            email: user.email,
            name: user.name,
            addedAt: Date.now(),
          });

          return user;
        }
      }
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw new Error("Device login was cancelled.");
      }
      // Continue polling on transient network error
    }
  }

  throw new Error("Login timed out. Please try again.");
}
