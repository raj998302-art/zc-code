/**
 * Built-in tool: File System.
 * Actually reads/writes the disk — results are real, never faked.
 */

import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, renameSync, copyFileSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { type ToolDefinition, type ToolContext } from "../core/toolEngine.js";
import { debug } from "../utils/logger.js";

const SENSITIVE_BASENAMES = [".env", ".env.local", "secrets", "id_rsa", "id_ed25519", ".pem", ".key"];

function isSensitive(path: string): boolean {
  const base = path.split(sep).pop() || "";
  const lower = base.toLowerCase();
  return SENSITIVE_BASENAMES.some((s) => lower.includes(s.toLowerCase()));
}

function isPathWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !rel.startsWith("\\"));
}

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read the contents of a file.",
  inputSchema: z.object({ path: z.string().describe("File path to read") }),
  permission: "readFile",
  timeoutMs: 10000,
  execute: async (args: { path: string }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    try {
      if (!existsSync(filePath)) return { ok: false, error: `File not found: ${args.path}` };
      const st = statSync(filePath);
      if (!st.isFile()) return { ok: false, error: `Not a file: ${args.path}` };
      if (st.size > 2_000_000) return { ok: false, error: `File too large (${st.size} bytes)` };
      const content = readFileSync(filePath, "utf8");
      debug("read_file", args.path);
      return { ok: true, output: content };
    } catch (err) {
      return { ok: false, error: `read_file failed: ${(err as Error).message}` };
    }
  },
};

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Create or overwrite a file.",
  inputSchema: z.object({
    path: z.string().describe("File path to write"),
    content: z.string().describe("File content"),
  }),
  permission: "writeFile",
  timeoutMs: 10000,
  execute: async (args: { path: string; content: string }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    if (isSensitive(filePath)) {
      return { ok: false, error: `Refusing to write sensitive file: ${args.path}` };
    }
    try {
      mkdirSync(resolve(ctx.cwd, relative(process.cwd(), filePath)).split(sep).slice(0, -1).join(sep), { recursive: true });
      // Simpler: ensure parent dir of filePath exists
      const parent = filePath.split(sep).slice(0, -1).join(sep);
      if (parent) mkdirSync(parent, { recursive: true });
      writeFileSync(filePath, args.content, "utf8");
      debug("write_file", args.path);
      return { ok: true, output: `Wrote ${args.content.length} bytes to ${args.path}` };
    } catch (err) {
      return { ok: false, error: `write_file failed: ${(err as Error).message}` };
    }
  },
};

export const editFileTool: ToolDefinition = {
  name: "edit_file",
  description: "Replace exact old text with new text in a file.",
  inputSchema: z.object({
    path: z.string().describe("File path to edit"),
    oldStr: z.string().describe("Exact text to replace"),
    newStr: z.string().describe("Replacement text"),
    replaceAll: z.boolean().default(false).describe("Replace all occurrences"),
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
      debug("edit_file", args.path, `replacements=${count}`);
      return { ok: true, output: `Replaced ${count} occurrence(s) in ${args.path}` };
    } catch (err) {
      return { ok: false, error: `edit_file failed: ${(err as Error).message}` };
    }
  },
};

export const deleteFileTool: ToolDefinition = {
  name: "delete_file",
  description: "Delete a file.",
  inputSchema: z.object({ path: z.string().describe("File path to delete") }),
  permission: "deleteFile",
  timeoutMs: 10000,
  execute: async (args: { path: string }, ctx: ToolContext) => {
    const filePath = resolve(ctx.cwd, args.path);
    if (isSensitive(filePath)) {
      return { ok: false, error: `Refusing to delete sensitive file: ${args.path}` };
    }
    try {
      if (!existsSync(filePath)) return { ok: false, error: `File not found: ${args.path}` };
      unlinkSync(filePath);
      debug("delete_file", args.path);
      return { ok: true, output: `Deleted ${args.path}` };
    } catch (err) {
      return { ok: false, error: `delete_file failed: ${(err as Error).message}` };
    }
  },
};

export const createDirectoryTool: ToolDefinition = {
  name: "create_directory",
  description: "Create a directory (including parents).",
  inputSchema: z.object({ path: z.string().describe("Directory path to create") }),
  permission: "createDirectory",
  timeoutMs: 10000,
  execute: async (args: { path: string }, ctx: ToolContext) => {
    const dirPath = resolve(ctx.cwd, args.path);
    try {
      mkdirSync(dirPath, { recursive: true });
      debug("create_directory", args.path);
      return { ok: true, output: `Created directory ${args.path}` };
    } catch (err) {
      return { ok: false, error: `create_directory failed: ${(err as Error).message}` };
    }
  },
};

export const listDirectoryTool: ToolDefinition = {
  name: "list_directory",
  description: "List entries in a directory.",
  inputSchema: z.object({ path: z.string().default(".").describe("Directory path") }),
  permission: "listDirectory",
  timeoutMs: 10000,
  execute: async (args: { path?: string }, ctx: ToolContext) => {
    const dirPath = resolve(ctx.cwd, args.path || ".");
    try {
      if (!existsSync(dirPath)) return { ok: false, error: `Directory not found: ${args.path || "."}` };
      const entries = readdirSync(dirPath, { withFileTypes: true });
      const list = entries.map((e) => `${e.isDirectory() ? "[dir] " : "[file] "}${e.name}`);
      debug("list_directory", args.path || ".", `count=${list.length}`);
      return { ok: true, output: list };
    } catch (err) {
      return { ok: false, error: `list_directory failed: ${(err as Error).message}` };
    }
  },
};

export const searchFilesTool: ToolDefinition = {
  name: "search_files",
  description: "Search file contents for a pattern.",
  inputSchema: z.object({
    path: z.string().default(".").describe("Directory to search"),
    pattern: z.string().describe("Text pattern to search for"),
  }),
  permission: "searchFiles",
  timeoutMs: 15000,
  execute: async (args: { path?: string; pattern: string }, ctx: ToolContext) => {
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
            if (content.includes(args.pattern)) results.push(full);
          } catch {}
        }
      };
      walk(dirPath);
      debug("search_files", args.path || ".", `pattern=${args.pattern} results=${results.length}`);
      return { ok: true, output: results.length ? results : ["(no matches)"] };
    } catch (err) {
      return { ok: false, error: `search_files failed: ${(err as Error).message}` };
    }
  },
};

export const moveFileTool: ToolDefinition = {
  name: "move_file",
  description: "Move or rename a file/directory.",
  inputSchema: z.object({ source: z.string(), destination: z.string() }),
  permission: "writeFile",
  timeoutMs: 10000,
  execute: async (args: { source: string; destination: string }, ctx: ToolContext) => {
    const src = resolve(ctx.cwd, args.source);
    const dest = resolve(ctx.cwd, args.destination);
    if (isSensitive(src) || isSensitive(dest)) {
      return { ok: false, error: "Refusing to move sensitive files" };
    }
    try {
      const parent = dest.split(sep).slice(0, -1).join(sep);
      if (parent) mkdirSync(parent, { recursive: true });
      renameSync(src, dest);
      debug("move_file", args.source, "->", args.destination);
      return { ok: true, output: `Moved ${args.source} to ${args.destination}` };
    } catch (err) {
      return { ok: false, error: `move_file failed: ${(err as Error).message}` };
    }
  },
};

export const copyFileTool: ToolDefinition = {
  name: "copy_file",
  description: "Copy a file.",
  inputSchema: z.object({ source: z.string(), destination: z.string() }),
  permission: "writeFile",
  timeoutMs: 10000,
  execute: async (args: { source: string; destination: string }, ctx: ToolContext) => {
    const src = resolve(ctx.cwd, args.source);
    const dest = resolve(ctx.cwd, args.destination);
    if (isSensitive(src) || isSensitive(dest)) {
      return { ok: false, error: "Refusing to copy sensitive files" };
    }
    try {
      const parent = dest.split(sep).slice(0, -1).join(sep);
      if (parent) mkdirSync(parent, { recursive: true });
      copyFileSync(src, dest);
      debug("copy_file", args.source, "->", args.destination);
      return { ok: true, output: `Copied ${args.source} to ${args.destination}` };
    } catch (err) {
      return { ok: false, error: `copy_file failed: ${(err as Error).message}` };
    }
  },
};

export const filesystemTools = [
  readFileTool,
  writeFileTool,
  editFileTool,
  deleteFileTool,
  createDirectoryTool,
  listDirectoryTool,
  searchFilesTool,
  moveFileTool,
  copyFileTool,
];
