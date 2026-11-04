/**
 * Integration test: provider registry + adapter instantiation.
 * No real API calls — just verifies adapters can be constructed.
 */

import assert from "node:assert/strict";
import { providerRegistry } from "../../dist/providers/registry.js";
import { OpenAICompatibleProvider } from "../../dist/providers/openaiCompatible.js";
import { AnthropicProvider } from "../../dist/providers/anthropic.js";
import { GeminiProvider } from "../../dist/providers/gemini.js";
import { OllamaProvider } from "../../dist/providers/ollama.js";

// Register adapters
providerRegistry.register(new OpenAICompatibleProvider({ id: "openrouter", name: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", apiKey: "test", capabilities: { toolCalling: true, multimodal: false, structuredOutput: false, streaming: true } }));
providerRegistry.register(new AnthropicProvider("test-key"));
providerRegistry.register(new GeminiProvider("test-key"));
providerRegistry.register(new OllamaProvider());

const openrouter = providerRegistry.get("openrouter");
assert.ok(openrouter);
assert.strictEqual(openrouter.id, "openrouter");

const anthropic = providerRegistry.get("anthropic");
assert.ok(anthropic);
assert.strictEqual(anthropic.id, "anthropic");

const gemini = providerRegistry.get("gemini");
assert.ok(gemini);
assert.strictEqual(gemini.id, "gemini");

const ollama = providerRegistry.get("ollama");
assert.ok(ollama);
assert.strictEqual(ollama.id, "ollama");

const list = providerRegistry.list();
assert.ok(list.includes("openrouter"));
assert.ok(list.includes("anthropic"));
assert.ok(list.includes("gemini"));
assert.ok(list.includes("ollama"));

console.log("✓ provider registry integration test passed");
