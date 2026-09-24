import { resolveModelId } from "../models/catalog";
import { createCodebuffMetadata } from "../session/fingerprint";
import type { FreebuffUpstreamPayload } from "../types/freebuff";
import type { ChatCompletionRequest, ChatMessage } from "../types/openai";

export const BUFFY_CANONICAL_PREAMBLE =
  "You are Buffy, the strategic coding assistant. You are the AI agent behind the product, Freebuff, a tool where users can chat with you to code with AI for free.";

const FOREIGN_HARNESS_PATTERNS: readonly RegExp[] = [
  /You are Claude Code[^\n.]*[\n.]?/gi,
  /Anthropic's official CLI[^\n.]*[\n.]?/gi,
  /You are Kimi Code CLI[^\n.]*[\n.]?/gi,
  /You are Roo-Code[^\n.]*[\n.]?/gi,
  /You are Cline[^\n.]*[\n.]?/gi,
];

/**
 * Scrubs known client harness signatures that trigger Freebuff 403 anti-bot filters.
 */
export function scrubHarnessMarkers(text: string): string {
  let cleaned = text;
  for (const pattern of FOREIGN_HARNESS_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

/**
 * Normalizes messages to satisfy Freebuff's strict system prompt requirements.
 * Freebuff checks position 0 to confirm Buffy preamble presence.
 */
export function normalizeMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [{ role: "system", content: BUFFY_CANONICAL_PREAMBLE }];
  }

  const firstMsg = messages[0];
  const remaining = messages.slice(1);

  if (firstMsg.role === "system") {
    const scrubbed = scrubHarnessMarkers(firstMsg.content);
    const hasPreamble = scrubbed.startsWith("You are Buffy");
    const updatedContent = hasPreamble
      ? scrubbed
      : `${BUFFY_CANONICAL_PREAMBLE}\n\n${scrubbed}`.trim();

    return [
      {
        ...firstMsg,
        content: updatedContent,
      },
      ...remaining,
    ];
  }

  // Prepend canonical system prompt if first message is not a system prompt
  return [
    {
      role: "system",
      content: BUFFY_CANONICAL_PREAMBLE,
    },
    ...messages,
  ];
}

/**
 * Transforms an OpenAI ChatCompletionRequest into a FreebuffUpstreamPayload
 * with all anti-ban headers, preambles, and metadata attached.
 */
export function normalizeUpstreamRequest(
  request: ChatCompletionRequest,
  instanceId?: string
): FreebuffUpstreamPayload {
  const model = resolveModelId(request.model);
  const messages = normalizeMessages(request.messages);
  const metadata = createCodebuffMetadata(instanceId);

  return {
    model,
    messages,
    stream: true,
    provider: {
      data_collection: "deny",
    },
    codebuff_metadata: metadata,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.max_tokens !== undefined ? { max_tokens: request.max_tokens } : {}),
    ...(request.presence_penalty !== undefined
      ? { presence_penalty: request.presence_penalty }
      : {}),
    ...(request.frequency_penalty !== undefined
      ? { frequency_penalty: request.frequency_penalty }
      : {}),
    ...(request.stop !== undefined ? { stop: request.stop } : {}),
  };
}
