/**
 * Unified provider interface.
 *
 * All provider adapters implement this. The core never depends on a specific
 * provider SDK — every adapter calls provider APIs via node:fetch and
 * normalizes requests/responses into a common shape.
 */

import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ChatOptions {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ name: string; description: string; parameters: z.ZodTypeAny }>;
  toolChoice?: "none" | "required" | "auto";
  stream?: boolean;
}

export interface ChatResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: { input: number; output: number; total: number };
  provider: string;
  model: string;
}

export interface ProviderCapabilities {
  toolCalling: boolean;
  multimodal: boolean;
  structuredOutput: boolean;
  streaming: boolean;
}

export interface ModelEntry {
  id: string;
  name?: string;
  provider: string;
  capabilities: ProviderCapabilities;
  contextWindow?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface ProviderConfig {
  enabled: boolean;
  apiKeyEnv?: string;
  baseURL?: string;
  models?: string[];
  defaultModel?: string;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  enabled: boolean;
  listModels(): Promise<ModelEntry[]>;
  chat(options: ChatOptions): Promise<ChatResponse>;
  stream(options: ChatOptions, onChunk: (chunk: string) => void): Promise<ChatResponse>;
  capabilities(): ProviderCapabilities;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
    public retryable: boolean = false,
    public code?: string
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
