/**
 * Built-in tool: Terminal / Shell execution.
 * Runs real shell commands. Gated by permission (executeCommand).
 * Never silently executes destructive commands — permission engine decides.
 */

import { z } from "zod";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { type ToolDefinition, type ToolContext } from "../core/toolEngine.js";
import { debug, redactSecret } from "../utils/logger.js";

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf\s+\/?$/,
  /rm\s+-rf\s+\~\/?/,
  /rm\s+-rf\s+\.\//,
  /rm\s+-rf\s+\.\.\//,
  /mkfs/,
  /dd\s+/,
  /fdisk/,
  /:\(\)\s*\{\s*:\|\s*:\s*&\s*\};/,
];

function looksDestructive(cmd: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(cmd));
}

export const executeCommandTool: ToolDefinition = {
  name: "execute_command",
  description: "Execute a shell command and return stdout/stderr.",
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
    cwd: z.string().default(".").describe("Working directory"),
    timeoutMs: z.number().default(30000).describe("Timeout in ms"),
  }),
  permission: "executeCommand",
  timeoutMs: 30000,
  execute: async (args: { command: string; cwd?: string; timeoutMs?: number }, ctx: ToolContext) => {
    const command = args.command.trim();
    if (!command) return { ok: false, error: "Empty command." };
    if (looksDestructive(command)) {
      return { ok: false, error: `Command blocked as potentially destructive: ${command.slice(0, 120)}` };
    }
    const cwd = resolve(ctx.cwd, args.cwd || ".");
    const timeoutMs = Math.min(args.timeoutMs ?? 30000, 300000);
    debug("execute_command", command.slice(0, 200), "cwd=", cwd);
    return new Promise<{ ok: boolean; output?: string; error?: string }>((resolvePromise) => {
      let stdout = "";
      let stderr = "";
      let killed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const child: any = require("node:child_process").spawn("sh", ["-c", command], { cwd });
      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      const timer = setTimeout(() => {
        killed = true;
        try { child.kill("SIGTERM"); } catch {}
        setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 2000);
      }, timeoutMs);
      child.on("close", (code: number | null) => {
        clearTimeout(timer);
        const out = `exit code: ${code ?? -1}\n${killed ? "[command timed out]\n" : ""}${stdout}${stderr ? "[stderr]\n" + stderr : ""}`.trim();
        resolvePromise({ ok: code === 0 && !killed, output: out || "(no output)", error: code !== 0 || killed ? out : undefined });
      });
      child.on("error", (err: Error) => {
        clearTimeout(timer);
        resolvePromise({ ok: false, error: `spawn failed: ${err.message}` });
      });
    });
  },
};

export const executeScriptTool: ToolDefinition = {
  name: "execute_script",
  description: "Execute a script file.",
  inputSchema: z.object({
    path: z.string().describe("Script file path"),
    args: z.array(z.string()).default([]).describe("Script arguments"),
    cwd: z.string().default(".").describe("Working directory"),
  }),
  permission: "executeScript",
  timeoutMs: 60000,
  execute: async (args: { path: string; args?: string[]; cwd?: string }, ctx: ToolContext) => {
    const scriptPath = resolve(ctx.cwd, args.path);
    const cwd = resolve(ctx.cwd, args.cwd || ".");
    try {
      const { existsSync } = await import("node:fs");
      if (!existsSync(scriptPath)) return { ok: false, error: `Script not found: ${args.path}` };
      const command = [process.execPath, scriptPath, ...(args.args || [])].join(" ");
      debug("execute_script", args.path);
      // reuse execute_command logic via spawn
      return new Promise<{ ok: boolean; output?: string; error?: string }>((resolvePromise) => {
        let stdout = "", stderr = "";
        let killed = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const child: any = require("node:child_process").spawn(process.execPath, [scriptPath, ...(args.args || [])], { cwd });
        child.stdout.on("data", (d: Buffer) => stdout += d.toString());
        child.stderr.on("data", (d: Buffer) => stderr += d.toString());
        const timer = setTimeout(() => { killed = true; try { child.kill("SIGTERM"); } catch {}; setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 2000); }, 120000);
        child.on("close", (code: number | null) => { clearTimeout(timer); const out = `[exit ${code ?? -1}]\n${stdout}${stderr ? "[stderr]\n"+stderr : ""}`; resolvePromise({ ok: code === 0 && !killed, output: out.trim() || "(no output)", error: (code !== 0 || killed) ? out : undefined }); });
        child.on("error", (err: Error) => { clearTimeout(timer); resolvePromise({ ok: false, error: `spawn failed: ${err.message}` }); });
      });
    } catch (err) {
      return { ok: false, error: `execute_script failed: ${(err as Error).message}` };
    }
  },
};

export const terminalTools = [executeCommandTool, executeScriptTool];
