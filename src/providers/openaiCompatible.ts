/**
 * OpenAI-compatible provider adapter.
 *
 * Covers: OpenAI, OpenRouter, NVIDIA NIM, Groq, DeepSeek, Together AI,
 * Cerebras, LM Studio, and any custom OpenAI-compatible endpoint.
 *
 * Capabilities are declared per-provider (not assumed), because not every
 * OpenAI-compatible endpoint supports tool calling or multimodal.
 */

import { ProviderAdapter, ProviderError, ChatOptions, ChatResponse, ModelEntry, Message } from "./base.js";
import { estimateTokens } from "../utils/tokens.js";
import { debug, error, redactSecret } from "../utils/logger.js";

interface OpenAICompatibleConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  timeoutMs: number;
  capabilities: {
    toolCalling: boolean;
    multimodal: boolean;
    structuredOutput: boolean;
    streaming: boolean;
  };
  defaultModel?: string;
  models?: string[];
}

function headers(cfg: OpenAICompatibleConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  // OpenRouter recommends these headers
  if (cfg.id === "openrouter") {
    h["HTTP-Referer"] = "https://zc-code.local";
    h["X-Title"] = "ZC CODE";
  }
  for (const [k, v] of Object.entries(cfg.customHeaders || {})) h[k] = v;
  return h;
}

function withTimeout(ms: number, promise: Promise<Response>): Promise<Response> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<Response>((_, reject) => {
    timer = setTimeout(() => reject(new Error("request timed out")), ms);
  });
  return Promise.race([promise, timeout]).then((r) => { if (timer) clearTimeout(timer); return r; });
}

export class OpenAICompatibleProvider implements ProviderAdapter {
  id: string;
  name: string;
  enabled: boolean;
  private cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.enabled = true;
    this.cfg = cfg;
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  capabilities(): { toolCalling: boolean; multimodal: boolean; structuredOutput: boolean; streaming: boolean } {
    return this.cfg.capabilities;
  }

  async listModels(): Promise<ModelEntry[]> {
    // If explicit models configured, return those; otherwise try /models endpoint.
    if (this.cfg.models && this.cfg.models.length) {
      return this.cfg.models.map((id) => ({
        id, name: id, provider: this.id,
        capabilities: this.cfg.capabilities,
      }));
    }
    try {
      const res = await withTimeout(this.cfg.timeoutMs, fetch(`${this.cfg.baseURL.replace(/\/+$/, "")}/models`, { headers: headers(this.cfg) }));
      if (!res.ok) throw new ProviderError(this.id, `list models failed: ${res.status}`, res.status, true);
      const data = (await res.json()) as any;
      const models = (data.data || []).map((m: any) => ({
        id: m.id, name: m.id, provider: this.id, capabilities: this.cfg.capabilities,
        contextWindow: m.context_window,
      }));
      return models;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      debug("list models fallback", this.id, (err as Error).message);
      return [];
    }
  }

  private toOpenAIMessages(messages: Message[]): any[] {
    return messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
      }
      return { role: m.role, content: m.content };
    });
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = `${this.cfg.baseURL.replace(/\/+$/, "")}/chat/completions`;
    const body: any = {
      model: options.model,
      messages: this.toOpenAIMessages(options.messages),
      temperature: options.temperature ?? 0.7,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.tools && this.cfg.capabilities.toolCalling) {
      body.tools = options.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = options.toolChoice ?? "auto";
    }
    debug("chat", this.id, options.model, `tools=${!!options.tools} stream=false`);
    try {
      const res = await withTimeout(this.cfg.timeoutMs, fetch(url, { method: "POST", headers: headers(this.cfg), body: JSON.stringify(body) }));
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new ProviderError(this.id, `chat failed: ${res.status} ${txt.slice(0, 200)}`, res.status, res.status === 429);
      }
      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const message = choice?.message || {};
      const text = message.content || "";
      const toolCalls: any[] = message.tool_calls || [];
      const usage = data.usage || {};
      return {
        text,
        toolCalls: toolCalls.map((tc: any) => ({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments })),
        usage: {
          input: usage.prompt_tokens ?? estimateTokens(JSON.stringify(options.messages)),
          output: usage.completion_tokens ?? estimateTokens(text),
          total: usage.total_tokens ?? 0,
        },
        provider: this.id,
        model: options.model,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.id, `chat error: ${(err as Error).message}`, undefined, true);
    }
  }

  async stream(options: ChatOptions, onChunk: (chunk: string) => void): Promise<ChatResponse> {
    const url = `${this.cfg.baseURL.replace(/\/+$/, "")}/chat/completions`;
    const body: any = {
      model: options.model,
      messages: this.toOpenAIMessages(options.messages),
      temperature: options.temperature ?? 0.7,
      stream: true,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.tools && this.cfg.capabilities.toolCalling) {
      body.tools = options.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = options.toolChoice ?? "auto";
    }
    debug("stream", this.id, options.model, `tools=${!!options.tools}`);
    let fullText = "";
    let toolCallBuffer: Record<string, { name?: string; args: string }> = {};
    try {
      const res = await withTimeout(this.cfg.timeoutMs, fetch(url, { method: "POST", headers: headers(this.cfg), body: JSON.stringify(body) }));
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new ProviderError(this.id, `stream failed: ${res.status} ${txt.slice(0, 200)}`, res.status, res.status === 429);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new ProviderError(this.id, "stream: no response body");
      const decoder = new TextDecoder();
      let leftover = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        leftover += decoder.decode(value, { stream: true });
        const lines = leftover.split("\n");
        leftover = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload);
            const choice = data.choices?.[0];
            const delta = choice?.delta || {};
            if (delta.content) {
              fullText += delta.content;
              onChunk(delta.content);
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallBuffer[idx]) toolCallBuffer[idx] = { name: "", args: "" };
                if (tc.function?.name) toolCallBuffer[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallBuffer[idx].args += tc.function.arguments;
              }
            }
          } catch {
            // ignore unparseable SSE lines
          }
        }
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.id, `stream error: ${(err as Error).message}`, undefined, true);
    }
    const toolCalls = Object.values(toolCallBuffer).map((tc, i) => ({ id: `tc_${i}`, name: tc.name || "", arguments: tc.args ? JSON.parse(tc.args || "{}") : {} }));
    return {
      text: fullText,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: { input: estimateTokens(JSON.stringify(options.messages)), output: estimateTokens(fullText), total: estimateTokens(JSON.stringify(options.messages)) + estimateTokens(fullText) },
      provider: this.id,
      model: options.model,
    };
  }
}
