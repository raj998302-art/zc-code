/**
 * Unit tests for the config schema validation.
 * No external API keys required.
 */

import assert from "node:assert/strict";
import { ConfigSchema, ProvidersConfigSchema, ModelsConfigSchema } from "../../dist/config/schema.js";

// Valid minimal config
const config = ConfigSchema.parse({});
assert.strictEqual(config.theme, "dark");
assert.strictEqual(config.animations, true);
assert.ok(config.permissions);
assert.ok(config.sessions);
assert.ok(config.project);

// Providers config
const providers = ProvidersConfigSchema.parse({ providers: {} });
assert.deepStrictEqual(providers.providers, {});

// Models config
const models = ModelsConfigSchema.parse({ models: [] });
assert.deepStrictEqual(models.models, []);

// Invalid config rejected
assert.throws(() => ConfigSchema.parse({ theme: "invalid" }));

console.log("✓ config schema unit tests passed");
