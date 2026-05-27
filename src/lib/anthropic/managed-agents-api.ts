const DEFAULT_ANTHROPIC_API_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";
const FILES_API_BETA = "files-api-2025-04-14";
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export type ManagedAgent = {
  id: string;
  type: "agent";
  name: string;
  model?: { id?: string; speed?: string } | string;
  version?: number;
  metadata?: Record<string, string>;
};

export type ManagedAgentToolConfig = {
  type: string;
  name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  configs?: Array<Record<string, unknown>>;
  mcp_server_name?: string;
};

export type ManagedEnvironment = {
  id: string;
  type: "environment";
  name: string;
  metadata?: Record<string, string>;
};

export type ManagedSession = {
  id: string;
  type: "session";
  status?: string;
  usage?: Record<string, unknown>;
};

export type ManagedSessionResource = {
  type: "file";
  file_id: string;
  mount_path?: string;
};

export type ManagedAgentEvent = {
  id?: string;
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
  name?: string;
  input?: Record<string, unknown>;
  stop_reason?: { type?: string; event_ids?: string[] };
  usage?: Record<string, unknown>;
  error?: unknown;
  processed_at?: string | null;
  [key: string]: unknown;
};

export type AnthropicFileMetadata = {
  id: string;
  type: "file";
  filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  downloadable?: boolean | null;
  created_at?: string;
  scope?: { id?: string; type?: string };
};

export class AnthropicApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly path: string;
  readonly method: string;
  readonly requestId?: string;

  constructor(input: {
    status: number;
    statusText: string;
    body: string;
    path: string;
    method: string;
    requestId?: string;
  }) {
    const endpoint = `${input.method} ${input.path}`;
    const requestId = input.requestId ? ` request_id=${input.requestId}` : "";
    super(
      `Anthropic Managed Agents API failed at ${endpoint}: ${input.status} ${input.statusText}${requestId}${
        input.body ? ` ${input.body}` : ""
      }`,
    );
    this.name = "AnthropicApiError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.body = input.body;
    this.path = input.path;
    this.method = input.method;
    this.requestId = input.requestId;
  }

  get retryable() {
    return RETRYABLE_STATUS_CODES.has(this.status);
  }
}

type ManagedAgentsClientOptions = {
  apiKey: string;
  betaHeader?: string;
  baseUrl?: string;
};

type ListResponse<T> = {
  data?: T[];
};

export class AnthropicManagedAgentsApi {
  private readonly apiKey: string;
  private readonly betaHeader: string;
  private readonly baseUrl: string;

  constructor(options: ManagedAgentsClientOptions) {
    this.apiKey = options.apiKey;
    this.betaHeader = options.betaHeader ?? DEFAULT_MANAGED_AGENTS_BETA;
    this.baseUrl = (options.baseUrl ?? DEFAULT_ANTHROPIC_API_BASE_URL).replace(/\/$/, "");
  }

  async listAgents() {
    const response = await this.request<ListResponse<ManagedAgent>>("/v1/agents");
    return response.data ?? [];
  }

  async createAgent(input: {
    name: string;
    model: string;
    system: string;
    description?: string;
    tools?: ManagedAgentToolConfig[];
    metadata?: Record<string, string>;
  }) {
    return this.request<ManagedAgent>("/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        model: { id: input.model },
        system: input.system,
        description: input.description,
        tools: input.tools ?? [defaultAgentToolset()],
        metadata: input.metadata ?? {},
      }),
    });
  }

  async updateAgent(input: {
    agentId: string;
    version: number;
    name?: string;
    model?: string;
    system?: string;
    description?: string;
    tools?: ManagedAgentToolConfig[];
    metadata?: Record<string, string>;
  }) {
    return this.request<ManagedAgent>(`/v1/agents/${encodeURIComponent(input.agentId)}`, {
      method: "POST",
      body: JSON.stringify({
        version: input.version,
        name: input.name,
        model: input.model ? { id: input.model } : undefined,
        system: input.system,
        description: input.description,
        tools: input.tools,
        metadata: input.metadata,
      }),
    });
  }

  async listEnvironments() {
    const response = await this.request<ListResponse<ManagedEnvironment>>("/v1/environments");
    return response.data ?? [];
  }

  async createEnvironment(input: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    return this.request<ManagedEnvironment>("/v1/environments", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        config: {
          type: "cloud",
          networking: {
            type: "limited",
            allowed_hosts: [],
            allow_mcp_servers: false,
            allow_package_managers: false,
          },
        },
        metadata: input.metadata ?? {},
      }),
    });
  }

  async createSession(input: {
    agentId: string;
    environmentId: string;
    title?: string;
    resources?: ManagedSessionResource[];
    metadata?: Record<string, string>;
  }) {
    const body: Record<string, unknown> = {
      agent: input.agentId,
      environment_id: input.environmentId,
      title: input.title,
      metadata: input.metadata ?? {},
    };
    if (input.resources?.length) {
      body.resources = input.resources;
    }

    return this.request<ManagedSession>("/v1/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async sendUserMessage(sessionId: string, text: string) {
    return this.request<{ data?: ManagedAgentEvent[] }>(`/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            type: "user.message",
            content: [{ type: "text", text }],
          },
        ],
      }),
    });
  }

  async sendCustomToolResult(sessionId: string, customToolUseId: string, text: string) {
    return this.request<{ data?: ManagedAgentEvent[] }>(`/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            type: "user.custom_tool_result",
            custom_tool_use_id: customToolUseId,
            content: [{ type: "text", text }],
          },
        ],
      }),
    });
  }

  async openEventStream(sessionId: string, signal?: AbortSignal) {
    const path = `/v1/sessions/${encodeURIComponent(sessionId)}/events/stream`;
    return this.fetchWithRetry(path, () => ({
      method: "GET",
      headers: this.headers(),
      signal,
    }));
  }

  async listSessionFiles(sessionId: string) {
    const searchParams = new URLSearchParams({ scope_id: sessionId });
    const response = await this.request<ListResponse<AnthropicFileMetadata>>(`/v1/files?${searchParams}`, {
      headers: this.filesHeaders(),
    });
    return response.data ?? [];
  }

  async uploadFile(input: { filename: string; bytes: ArrayBuffer; mimeType?: string | null }) {
    const response = await this.fetchWithRetry("/v1/files", () => {
      const formData = new FormData();
      const file = new Blob([input.bytes], { type: input.mimeType ?? "application/octet-stream" });
      formData.append("file", file, input.filename);
      return {
        method: "POST",
        headers: this.filesHeaders(),
        body: formData,
      };
    });
    return (await response.json()) as AnthropicFileMetadata;
  }

  async downloadFile(fileId: string) {
    const path = `/v1/files/${encodeURIComponent(fileId)}/content`;
    const response = await this.fetchWithRetry(path, () => ({
      method: "GET",
      headers: this.filesHeaders(),
    }));
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...this.headers(),
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body instanceof FormData) {
      delete headers["content-type"];
    }
    const response = await this.fetchWithRetry(path, () => ({
      ...init,
      headers,
    }));
    return (await response.json()) as T;
  }

  private async fetchWithRetry(path: string, initFactory: () => RequestInit) {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const init = initFactory();
        const response = await fetch(`${this.baseUrl}${path}`, init);
        if (response.ok) {
          return response;
        }

        const error = await apiErrorFromResponse(response, path, init.method ?? "GET");
        if (!error.retryable || attempt === maxAttempts - 1) {
          throw error;
        }
        lastError = error;
      } catch (error) {
        const retryable = error instanceof AnthropicApiError ? error.retryable : isRetryableNetworkError(error);
        if (!retryable || attempt === maxAttempts - 1) {
          throw error;
        }
        lastError = error;
      }

      await sleep(350 * 2 ** attempt);
    }

    throw lastError instanceof Error ? lastError : new Error("Anthropic Managed Agents API request failed.");
  }

  private headers() {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": DEFAULT_ANTHROPIC_VERSION,
      "anthropic-beta": this.betaHeader,
    };
  }

  private filesHeaders() {
    return {
      ...this.headers(),
      "anthropic-beta": `${this.betaHeader},${FILES_API_BETA}`,
    };
  }
}

function defaultAgentToolset(): ManagedAgentToolConfig {
  return {
    type: "agent_toolset_20260401",
    default_config: {
      permission_policy: { type: "always_allow" },
    },
  };
}

async function apiErrorFromResponse(response: Response, path: string, method: string) {
  const body = await response.text().catch(() => "");
  const requestId = response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? parseRequestId(body);
  return new AnthropicApiError({
    status: response.status,
    statusText: response.statusText,
    body,
    path,
    method,
    requestId: requestId ?? undefined,
  });
}

function parseRequestId(body: string) {
  try {
    const parsed = JSON.parse(body) as { request_id?: unknown };
    return typeof parsed.request_id === "string" ? parsed.request_id : null;
  } catch {
    return null;
  }
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.name === "TimeoutError" || error.message.includes("fetch failed");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getManagedAgentsClientFromEnv() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 필요합니다.");
  }

  return new AnthropicManagedAgentsApi({
    apiKey,
    betaHeader: process.env.ANTHROPIC_BETA_HEADER,
    baseUrl: process.env.ANTHROPIC_API_BASE_URL,
  });
}
