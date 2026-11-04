/**
 * Unit tests for project intelligence.
 * No external dependencies required.
 */

import assert from "node:assert/strict";
import { inspectProject } from "../../dist/core/project.js";

// Test with current directory (the zc-code repo itself)
const intel = inspectProject(process.cwd(), true);
assert.ok(Array.isArray(intel.languages));
assert.ok(Array.isArray(intel.frameworks));
assert.ok(typeof intel.summary === "string");
assert.ok(intel.summary.length > 0);
assert.ok(typeof intel.git === "object");
assert.ok(typeof intel.git.isRepo === "boolean");

console.log("✓ project intelligence unit tests passed");
