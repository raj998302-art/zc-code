/**
 * Google Gemini provider adapter.
 * https://ai.google.dev/
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

export class GeminiProvider implements ProviderAdapter {
  id = "gemini";
  name = "Google Gemini";
  enabled = true;

  constructor(
    public apiKey: string,
    public baseURL = "https://generativelanguage.googleapis.com/v1beta",
    public timeoutMs = 60000,
    public defaultModel = "gemini-1.5-pro",
    private _capabilities = { toolCalling: true, multimodal: true, structuredOutput: false, streaming: true }
  ) {}

  capabilities(): { toolCalling: boolean; multimodal: boolean; structuredOutput: boolean; streaming: boolean } {
    return this._capabilities;
  }

  async listModels(): Promise<ModelEntry[]> {
    try {
      const res = await withTimeout(this.timeoutMs, fetch(`${this.baseURL.replace(/\/+$/, "")}/models?key=${this.apiKey}`));
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.models || []).map((m: any) => ({
        id: m.name.replace("models/", ""), name: m.displayName || m.name, provider: this.id, capabilities: this._capabilities,
        contextWindow: m.inputTokenLimit,
      }));
    } catch {
      return [
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: this.id, capabilities: this._capabilities },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: this.id, capabilities: this._capabilities },
      ];
    }
  }

  private toGeminiContents(messages: Message[]): any[] {
    const contents: any[] = [];
    for (const m of messages) {
      if (m.role === "system") continue; // Gemini uses systemInstruction separately
      contents.push({ role: m.role === "tool" ? "function" : m.role, parts: [{ text: m.content }] });
    }
    return contents;
  }

  private getSystemInstruction(messages: Message[]): any {
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    if (!sys) return undefined;
    return { parts: [{ text: sys }] };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseURL.replace(/\/+$/, "")}/models/${options.model}:generateContent?key=${this.apiKey}`;
    const body: any = {
      contents: this.toGeminiContents(options.messages),
      generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens },
      systemInstruction: this.getSystemInstruction(options.messages),
    };
    if (options.tools && this._capabilities.toolCalling) {
      body.tools = [{ functionDeclarations: options.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
      body.toolConfig = { functionCallingConfig: { mode: options.toolChoice === "none" ? "NONE" : options.toolChoice === "required" ? "ANY" : "AUTO" } };
    }
    debug("chat", this.id, options.model, `tools=${!!options.tools}`);
    try {
      const res = await withTimeout(this.timeoutMs, fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new ProviderError(this.id, `chat failed: ${res.status} ${txt.slice(0, 200)}`, res.status, res.status === 429);
      }
      const data = (await res.json()) as any;
      const cand = data.candidates?.[0];
      const parts = cand?.content?.parts || [];
      const text = parts.map((p: any) => p.text || "").join("");
      const toolCalls = parts
        .filter((p: any) => p.functionCall)
        .map((fc: any) => ({ id: `fc_${Date.now()}`, name: fc.functionCall.name, arguments: fc.functionCall.args || {} }));
      const usage = data.usageMetadata || {};
      return {
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        usage: { input: usage.promptTokenCount ?? estimateTokens(JSON.stringify(options.messages)), output: usage.candidatesTokenCount ?? estimateTokens(text), total: usage.totalTokenCount ?? 0 },
        provider: this.id,
        model: options.model,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.id, `chat error: ${(err as Error).message}`, undefined, true);
    }
  }

  async stream(options: ChatOptions, onChunk: (chunk: string) => void): Promise<ChatResponse> {
    const res = await this.chat(options);
    onChunk(res.text);
    return res;
  }
}
