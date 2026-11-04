/**
 * Integration test: config schema validation round-trip.
 * No external APIs, no file system writes to ~/.config.
 */

import assert from "node:assert/strict";
import { ConfigSchema } from "../../dist/config/schema.js";

const config = ConfigSchema.parse({
  defaultProvider: "openrouter",
  defaultModel: "openrouter/gpt-4o-mini",
  theme: "dark",
});
assert.strictEqual(config.defaultProvider, "openrouter");
assert.strictEqual(config.defaultModel, "openrouter/gpt-4o-mini");

// Update
const updated = ConfigSchema.parse({ ...config, theme: "light" });
assert.strictEqual(updated.theme, "light");

// Permissions default
assert.ok(config.permissions);
assert.strictEqual(config.permissions.externalDirectory, "DENY");

console.log("✓ config integration test passed");
