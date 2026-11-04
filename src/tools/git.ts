/**
 * Built-in tool: Git.
 * Read-only git operations plus checkout/commit (gated by permissions).
 */

import { z } from "zod";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { type ToolDefinition, type ToolContext } from "../core/toolEngine.js";
import { debug } from "../utils/logger.js";

function git(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child: any = require("node:child_process").spawn("git", args, { cwd });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("close", (code: number | null) => resolvePromise({ code: code ?? 1, stdout, stderr }));
    child.on("error", (err: Error) => resolvePromise({ code: 1, stdout: "", stderr: err.message }));
  });
}

export const gitStatusTool: ToolDefinition = {
  name: "git_status",
  description: "Show git working tree status.",
  inputSchema: z.object({ cwd: z.string().default(".") }),
  permission: "readFile",
  timeoutMs: 15000,
  execute: async (args: { cwd?: string }, ctx: ToolContext) => {
    const r = await git(["status", "--short", "--branch"], resolve(ctx.cwd, args.cwd || "."));
    return r.code === 0 ? { ok: true, output: r.stdout || "(clean)" } : { ok: false, error: r.stderr || "git status failed" };
  },
};

export const gitDiffTool: ToolDefinition = {
  name: "git_diff",
  description: "Show git diff.",
  inputSchema: z.object({ cwd: z.string().default("."), path: z.string().optional() }),
  permission: "readFile",
  timeoutMs: 15000,
  execute: async (args: { cwd?: string; path?: string }, ctx: ToolContext) => {
    const gitArgs = ["diff"];
    if (args.path) gitArgs.push("--", args.path);
    const r = await git(gitArgs, resolve(ctx.cwd, args.cwd || "."));
    return r.code === 0 ? { ok: true, output: r.stdout || "(no changes)" } : { ok: false, error: r.stderr || "git diff failed" };
  },
};

export const gitLogTool: ToolDefinition = {
  name: "git_log",
  description: "Show recent commit history.",
  inputSchema: z.object({ cwd: z.string().default("."), limit: z.number().default(10).optional() }),
  permission: "readFile",
  timeoutMs: 15000,
  execute: async (args: { cwd?: string; limit?: number }, ctx: ToolContext) => {
    const r = await git(["log", `--max-count=${args.limit ?? 10}`, "--oneline"], resolve(ctx.cwd, args.cwd || "."));
    return r.code === 0 ? { ok: true, output: r.stdout || "(no commits)" } : { ok: false, error: r.stderr || "git log failed" };
  },
};

export const gitBranchTool: ToolDefinition = {
  name: "git_branch",
  description: "List git branches.",
  inputSchema: z.object({ cwd: z.string().default(".") }),
  permission: "readFile",
  timeoutMs: 15000,
  execute: async (args: { cwd?: string }, ctx: ToolContext) => {
    const r = await git(["branch"], resolve(ctx.cwd, args.cwd || "."));
    return r.code === 0 ? { ok: true, output: r.stdout || "(no branches)" } : { ok: false, error: r.stderr || "git branch failed" };
  },
};

export const gitCheckoutTool: ToolDefinition = {
  name: "git_checkout",
  description: "Checkout a branch or path.",
  inputSchema: z.object({ cwd: z.string().default("."), ref: z.string().describe("Branch or path to checkout") }),
  permission: "gitCheckout",
  timeoutMs: 15000,
  execute: async (args: { cwd?: string; ref: string }, ctx: ToolContext) => {
    const r = await git(["checkout", args.ref], resolve(ctx.cwd, args.cwd || "."));
    return r.code === 0 ? { ok: true, output: r.stdout || `Checked out ${args.ref}` } : { ok: false, error: r.stderr || `git checkout ${args.ref} failed` };
  },
};

export const gitTools = [gitStatusTool, gitDiffTool, gitLogTool, gitBranchTool, gitCheckoutTool];
