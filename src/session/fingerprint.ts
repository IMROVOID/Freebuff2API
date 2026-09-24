import type { CodebuffMetadata } from "../types/freebuff";

/**
 * Generates a 13-character random alphanumeric string in base36,
 * matching Codebuff CLI's client_id generation pattern.
 */
export function generateClientId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(13);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 13; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a standard UUID v4 string for run_id or trace_session_id.
 */
export function generateUuid(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Builds a complete, compliant CodebuffMetadata object for Freebuff requests.
 */
export function createCodebuffMetadata(instanceId?: string): CodebuffMetadata {
  return {
    run_id: generateUuid(),
    client_id: generateClientId(),
    trace_session_id: generateUuid(),
    freebuff_instance_id: instanceId || `inst_${generateClientId()}`,
    cost_mode: "free",
  };
}
