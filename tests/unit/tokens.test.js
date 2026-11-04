/**
 * Unit tests for the tokens utility.
 * No external dependencies required.
 */

import assert from "node:assert/strict";
import { estimateTokens, estimateMessagesTokens, mergeUsage, formatTokens } from "../../dist/utils/tokens.js";

assert.strictEqual(estimateTokens(""), 0);
assert.strictEqual(estimateTokens("abcd"), 1);
assert.strictEqual(estimateTokens("abcdefgh"), 2);
assert.strictEqual(typeof formatTokens(1000), "string");

const usage = mergeUsage({ input: 10, output: 20, total: 30 }, { input: 5, output: 5, total: 10 });
assert.strictEqual(usage.input, 15);
assert.strictEqual(usage.output, 25);
assert.strictEqual(usage.total, 40);

const msgTokens = estimateMessagesTokens([{ role: "user", content: "hello world" }]);
assert.ok(msgTokens > 0);

console.log("✓ tokens unit tests passed");
