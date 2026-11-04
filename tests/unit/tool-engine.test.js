/**
 * Unit tests for the tool engine (schema validation + permission gating).
 * Uses mocked tools, no external APIs.
 */

import assert from "node:assert/strict";
import { z } from "zod";
import { ToolEngine } from "../../dist/core/toolEngine.js";

const engine = new ToolEngine();
engine.setGlobalPermissions({ readFile: "ALLOW", deleteFile: "DENY" });

// Register a test tool
engine.register({
  name: "test_tool",
  description: "A test tool",
  inputSchema: z.object({ value: z.string() }),
  permission: "readFile",
  timeoutMs: 5000,
  execute: async (args) => ({ ok: true, output: `echo: ${args.value}` }),
});

// Register a delete tool (DENY permission)
engine.register({
  name: "delete_file",
  description: "Delete a file",
  inputSchema: z.object({ path: z.string() }),
  permission: "deleteFile",
  timeoutMs: 5000,
  execute: async () => ({ ok: true, output: "deleted" }),
});

// ALLOW -> proceeds
const r1 = await engine.execute("test_tool", { value: "hello" }, { cwd: "/" });
assert.strictEqual(r1.ok, true);

// DENY -> blocked
const r2 = await engine.execute("delete_file", { path: "/tmp/x" }, { cwd: "/" });
assert.strictEqual(r2.ok, false);
assert.ok(r2.error.includes("DENIED"));

// Unknown tool
const r3 = await engine.execute("nonexistent", {}, { cwd: "/" });
assert.strictEqual(r3.ok, false);
assert.ok(r3.error.includes("Unknown tool"));

// Invalid input
const r4 = await engine.execute("test_tool", { value: 123 }, { cwd: "/" });
assert.strictEqual(r4.ok, false);

console.log("✓ tool engine unit tests passed");
