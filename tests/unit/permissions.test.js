/**
 * Unit tests for the permission engine defaults.
 */

import assert from "node:assert/strict";
import { permissionEngine } from "../../dist/permissions/engine.js";

// Default readFile should be ALLOW
const readPerm = permissionEngine.resolve({ tool: "readFile" });
assert.strictEqual(readPerm.level, "ALLOW");

// Default writeFile should be ASK
const writePerm = permissionEngine.resolve({ tool: "writeFile" });
assert.strictEqual(writePerm.level, "ASK");

// Agent override takes priority
permissionEngine.setAgent("agent-1", { writeFile: "DENY" });
const agentPerm = permissionEngine.resolve({ tool: "writeFile", agentId: "agent-1" });
assert.strictEqual(agentPerm.level, "DENY");
assert.strictEqual(agentPerm.source, "agent");

// Project override
permissionEngine.setProject("/proj", { writeFile: "ALLOW" });
const projectPerm = permissionEngine.resolve({ tool: "writeFile", projectPath: "/proj" });
assert.strictEqual(projectPerm.level, "ALLOW");

// Sensitive file restriction
const sensitive = permissionEngine.pathRestriction("/home/user/.env");
assert.strictEqual(sensitive.allowed, false);

// Destructive command restriction
const destructive = permissionEngine.commandRestriction("rm -rf /");
assert.strictEqual(destructive.allowed, false);

console.log("✓ permission engine unit tests passed");
