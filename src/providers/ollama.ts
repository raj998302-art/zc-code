/**
 * Ollama provider adapter (local).
 * https://github.com/ollama/ollama
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

export class OllamaProvider implements ProviderAdapter {
  id = "ollama";
  name = "Ollama";
  enabled = true;

  constructor(
    public baseURL = "http://localhost:11434",
    public timeoutMs = 120000,
    public defaultModel = "llama3.1",
    private _capabilities = { toolCalling: false, multimodal: false, structuredOutput: false, streaming: true }
  ) {}

  capabilities(): { toolCalling: boolean; multimodal: boolean; structuredOutput: boolean; streaming: boolean } {
    return this._capabilities;
  }

  async listModels(): Promise<ModelEntry[]> {
    try {
      const res = await withTimeout(this.timeoutMs, fetch(`${this.baseURL.replace(/\/+$/, "")}/api/tags`));
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.models || []).map((m: any) => ({
        id: m.name, name: m.name, provider: this.id, capabilities: this._capabilities,
      }));
    } catch {
      return [{ id: "llama3.1", name: "llama3.1", provider: this.id, capabilities: this._capabilities }];
    }
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    return this.stream(options, () => {}); // delegate to stream with no-op chunk handler, then collect
  }

  async stream(options: ChatOptions, onChunk: (chunk: string) => void): Promise<ChatResponse> {
    const url = `${this.baseURL.replace(/\/+$/, "")}/api/chat`;
    const body: any = {
      model: options.model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: { temperature: options.temperature ?? 0.7 },
    };
    if (options.maxTokens) body.options.num_predict = options.maxTokens;
    debug("stream", this.id, options.model);
    let fullText = "";
    try {
      const res = await withTimeout(this.timeoutMs, fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new ProviderError(this.id, `stream failed: ${res.status} ${txt.slice(0, 200)}`, res.status, false);
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
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.message?.content) {
              fullText += data.message.content;
              onChunk(data.message.content);
            }
            if (data.done) break;
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.id, `stream error: ${(err as Error).message}`, undefined, true);
    }
    return {
      text: fullText,
      usage: { input: estimateTokens(JSON.stringify(options.messages)), output: estimateTokens(fullText), total: estimateTokens(JSON.stringify(options.messages)) + estimateTokens(fullText) },
      provider: this.id,
      model: options.model,
    };
  }
}
