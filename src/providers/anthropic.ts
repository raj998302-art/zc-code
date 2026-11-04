/**
 * Anthropic provider adapter (Messages API).
 * https://docs.anthropic.com/
 */

import { ProviderAdapter, ProviderError, ChatOptions, ChatResponse, ModelEntry, Message } from "./base.js";
import { estimateTokens } from "../utils/tokens.js";
import { debug } from "../utils/logger.js";

function withTimeout(ms: number, promise: Promise<Response>): Promise<Response> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<Response>((_, reject) => {
    timer = setTimeout(() => reject(new Error("request timed out")), ms);
  });
  return Promise.race([promise, timeout]).then((r) => { if (timer) clearTimeout(timer); return r; });
}

export class AnthropicProvider implements ProviderAdapter {
  id = "anthropic";
  name = "Anthropic";
  enabled = true;

  constructor(
    public apiKey: string,
    public baseURL = "https://api.anthropic.com",
    public timeoutMs = 60000,
    public defaultModel = "claude-3-5-sonnet-20241022",
    private _capabilities = { toolCalling: true, multimodal: true, structuredOutput: false, streaming: true }
  ) {}

  capabilities(): { toolCalling: boolean; multimodal: boolean; structuredOutput: boolean; streaming: boolean } {
    return this._capabilities;
  }

  async listModels(): Promise<ModelEntry[]> {
    // Anthropic does not publish a public /models list without beta; return known defaults.
    return [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: this.id, capabilities: this._capabilities, contextWindow: 200000 },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: this.id, capabilities: this._capabilities, contextWindow: 200000 },
    ];
  }

  private extractSystem(messages: Message[]): { system: string; messages: any[] } {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const msgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as any, content: m.content }));
    return { system, messages: msgs };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseURL.replace(/\/+$/, "")}/v1/messages`;
    const { system, messages } = this.extractSystem(options.messages);
    const body: any = {
      model: options.model,
      max_tokens: options.maxTokens ?? 1024,
      messages,
      system,
      temperature: options.temperature ?? 0.7,
    };
    if (options.tools && this._capabilities.toolCalling) {
      body.tools = options.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
      body.tool_choice = options.toolChoice ?? "auto";
    }
    debug("chat", this.id, options.model, `tools=${!!options.tools}`);
    try {
      const res = await withTimeout(this.timeoutMs, fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      }));
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new ProviderError(this.id, `chat failed: ${res.status} ${txt.slice(0, 200)}`, res.status, res.status === 429);
      }
      const data = (await res.json()) as any;
      const text = (data.content || []).map((c: any) => c.type === "text" ? c.text : "").join("");
      const toolCalls = (data.content || [])
        .filter((c: any) => c.type === "tool_use")
        .map((tc: any) => ({ id: tc.id, name: tc.name, arguments: tc.input }));
      const usage = data.usage || {};
      return {
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        usage: { input: usage.input_tokens ?? estimateTokens(JSON.stringify(options.messages)), output: usage.output_tokens ?? estimateTokens(text), total: 0 },
        provider: this.id,
        model: options.model,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.id, `chat error: ${(err as Error).message}`, undefined, true);
    }
  }

  async stream(options: ChatOptions, onChunk: (chunk: string) => void): Promise<ChatResponse> {
    // Non-streaming fallback: call chat and feed text in one chunk (keeps interface uniform).
    const res = await this.chat(options);
    onChunk(res.text);
    return res;
  }
}
