/**
 * Built-in tool: Code.
 * Code-specific helpers: apply patch, replace text, inspect code, search symbols.
 */

import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { type ToolDefinition, type ToolContext } from "../core/toolEngine.js";
import { debug } from "../utils/logger.js";

function parseUnifiedDiff(patch: string): Array<{ oldStart: number; contextLines: string[]; newLines: string[] }> {
  const hunks: Array<{ oldStart: number; contextLines: string[]; newLines: string[] }> = [];
  const lines = patch.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^@@ -\d+,?\d* \+(\d+)(,?\d*) @@/);
    if (m) {
      const oldStart = parseInt(m[1], 10) || 1;
      const contextLines: string[] = [];
      const newLines: string[] = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith("@@ ")) break;
        if (l.startsWith(" ")) { contextLines.push(l.slice(1)); newLines.push(l.slice(1)); }
        else if (l.startsWith("+")) { newLines.push(l.slice(1)); }
        else if (l.startsWith("-")) { /* removal only */ }
        i++;
      }
      hunks.push({ oldStart, contextLines, newLines });
    } else {
      i++;
    }
  }
  return hunks;
}

export const applyPatchTool: ToolDefinition = {  name: "apply_patch",
  description: "Apply a unified diff patch to a file.",
  inputSchema: z.object({
    path: z.string().describe("File to patch"),
    patch: z.string().describe("Unified diff patch content"),
  }),
  permission: "editFile",
  timeoutMs: 15000,
  execute: async (args: { path: string; patch: string }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    try {
      if (!existsSync(filePath)) return { ok: false, error: `File not found: ${args.path}` };
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const hunks = parseUnifiedDiff(args.patch);
      let offset = 0;
      let applied = 0;
      for (const hunk of hunks) {
        const start = Math.max(0, hunk.oldStart - 1 + offset);
        let matchIdx = -1;
        for (let i = start; i < Math.min(lines.length, start + 50); i++) {
          if (lines[i] === hunk.contextLines[0]) { matchIdx = i; break; }
        }
        if (matchIdx === -1) continue;
        const newLines = [...lines.slice(0, matchIdx)];
        for (const line of hunk.newLines) newLines.push(line);
        const afterCtx = matchIdx + hunk.contextLines.length;
        newLines.push(...lines.slice(afterCtx));
        lines.length = 0;
        lines.push(...newLines);
        offset += hunk.newLines.length - hunk.contextLines.length;
        applied++;
      }
      if (applied === 0) return { ok: false, error: "Could not apply patch: no matching context found" };
      writeFileSync(filePath, lines.join("\n"), "utf8");
      debug("apply_patch", args.path, `hunks=${applied}`);
      return { ok: true, output: `Applied ${applied} hunk(s) to ${args.path}` };
    } catch (err) {
      return { ok: false, error: `apply_patch failed: ${(err as Error).message}` };
    }
  },
};

export const replaceTextTool: ToolDefinition = {
  name: "replace_text",
  description: "Replace exact text across one or more files.",
  inputSchema: z.object({
    path: z.string().describe("File path"),
    oldStr: z.string().describe("Exact text to replace"),
    newStr: z.string().describe("Replacement text"),
    replaceAll: z.boolean().default(false),
  }),
  permission: "editFile",
  timeoutMs: 10000,
  execute: async (args: { path: string; oldStr: string; newStr: string; replaceAll?: boolean }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    try {
      if (!existsSync(filePath)) return { ok: false, error: `File not found: ${args.path}` };
      const content = readFileSync(filePath, "utf8");
      const count = (content.match(new RegExp(args.oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      if (count === 0) return { ok: false, error: `oldStr not found in ${args.path}` };
      const updated = args.replaceAll ? content.split(args.oldStr).join(args.newStr) : content.replace(args.oldStr, args.newStr);
      writeFileSync(filePath, updated, "utf8");
      debug("replace_text", args.path);
      return { ok: true, output: `Replaced ${count} occurrence(s) in ${args.path}` };
    } catch (err) {
      return { ok: false, error: `replace_text failed: ${(err as Error).message}` };
    }
  },
};

export const inspectCodeTool: ToolDefinition = {
  name: "inspect_code",
  description: "Inspect code structure of a file (functions, classes, imports).",
  inputSchema: z.object({ path: z.string().describe("File path to inspect") }),
  permission: "readFile",
  timeoutMs: 10000,
  execute: async (args: { path: string }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    try {
      if (!existsSync(filePath)) return { ok: false, error: `File not found: ${args.path}` };
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const findings: string[] = [];
      const fnRe = /^(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s*)?(?:function\s*)?\(|export\s+(?:async\s+)?function\s+(\w+))/;
      const classRe = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
      const importRe = /^\s*(?:import|export)\s+/;
      lines.forEach((line, i) => {
        if (classRe.test(line)) findings.push(`L${i + 1}: class ${line.match(classRegExp())?.[1] || line.trim()}`);
        else if (fnRe.test(line)) findings.push(`L${i + 1}: function ${line.trim().slice(0, 80)}`);
        else if (importRe.test(line)) findings.push(`L${i + 1}: import ${line.trim().slice(0, 80)}`);
      });
      function classRegExp() { return /class\s+(\w+)/; }
      debug("inspect_code", args.path);
      return { ok: true, output: findings.length ? findings.join("\n") : "(no symbols detected)" };
    } catch (err) {
      return { ok: false, error: `inspect_code failed: ${(err as Error).message}` };
    }
  },
};

export const searchSymbolsTool: ToolDefinition = {
  name: "search_symbols",
  description: "Search for symbol definitions across files.",
  inputSchema: z.object({ path: z.string().default("."), symbol: z.string().describe("Symbol name to find") }),
  permission: "searchFiles",
  timeoutMs: 15000,
  execute: async (args: { path?: string; symbol: string }, ctx: ToolContext) => {
    const dirPath = resolve(ctx.cwd, args.path || ".");
    const results: string[] = [];
    try {
      const walk = (dir: string): void => {
        let entries: any[];
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) { walk(full); continue; }
          try {
            const st = statSync(full);
            if (st.size > 500_000) continue;
            const content = readFileSync(full, "utf8");
            const lines = content.split("\n");
            lines.forEach((line, i) => {
              if (line.includes(args.symbol) && /(function|class|const|let|var|def|fn|public|private)\s/.test(line)) {
                results.push(`${full}:${i + 1}: ${line.trim().slice(0, 100)}`);
              }
            });
          } catch {}
        }
      };
      walk(dirPath);
      debug("search_symbols", args.path || ".", args.symbol);
      return { ok: true, output: results.length ? results.join("\n") : "(no symbols found)" };
    } catch (err) {
      return { ok: false, error: `search_symbols failed: ${(err as Error).message}` };
    }
  },
};

export const codeTools = [applyPatchTool, replaceTextTool, inspectCodeTool, searchSymbolsTool];
