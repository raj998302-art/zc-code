/**
 * Unit tests for the ID utility.
 */

import assert from "node:assert/strict";
import { uuidv4 } from "../../dist/utils/id.js";

const id1 = uuidv4();
const id2 = uuidv4();
assert.strictEqual(id1.length, 36);
assert.notStrictEqual(id1, id2);
// UUID v4 format: 8-4-4-4-12
const parts = id1.split("-");
assert.strictEqual(parts.length, 5);
assert.strictEqual(parts[0].length, 8);
assert.strictEqual(parts[1].length, 4);
assert.strictEqual(parts[2].length, 4);
assert.strictEqual(parts[3].length, 4);
assert.strictEqual(parts[4].length, 12);

console.log("✓ id unit tests passed");
