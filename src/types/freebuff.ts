export interface CodebuffMetadata {
  run_id: string;
  client_id: string;
  trace_session_id: string;
  freebuff_instance_id: string;
  cost_mode: "free";
}

export interface FreebuffUpstreamPayload {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }>;
  stream: true;
  provider: {
    data_collection: "deny";
  };
  codebuff_metadata: CodebuffMetadata;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string | string[];
}

export interface SessionAdmissionResponse {
  instanceId: string;
  status: "active" | "queued" | "expired";
  expiresAt?: number;
  model?: string;
  error?: string;
}

export interface CliAuthCodeResponse {
  loginUrl: string;
  fingerprintHash: string;
  expiresAt: number;
}

export interface FreebuffUser {
  authToken: string;
  id: string;
  email: string;
  name: string;
}

export interface CliAuthStatusResponse {
  user?: FreebuffUser;
  status?: string;
  error?: string;
}

export interface FreebuffModelDefinition {
  id: string;
  displayName: string;
  ownedBy: string;
  contextWindow: number;
  description: string;
  isDefault?: boolean;
}
