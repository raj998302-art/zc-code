/**
 * End-to-end smoke test: verifies the CLI entry point works.
 * Runs `zc --version`, `zc --help`, `zc doctor`.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ZC = join(__dirname, "..", "..", "dist", "index.js");

// Version
const version = execFileSync("node", [ZC, "--version"], { encoding: "utf8" }).trim();
assert.ok(version.includes("0.1.0"), `Expected version output, got: ${version}`);

// Help
const help = execFileSync("node", [ZC, "--help"], { encoding: "utf8" });
assert.ok(help.includes("ZC CODE"), "Help should mention ZC CODE");
assert.ok(help.includes("zc chat"), "Help should list chat command");

// Doctor
const doctor = execFileSync("node", [ZC, "doctor"], { encoding: "utf8" });
assert.ok(doctor.includes("All checks passed"), `Doctor should pass, got: ${doctor}`);

console.log("✓ e2e smoke test passed");
