/**
 * Tool registry — registers all built-in tools into the ToolEngine.
 * Call registerBuiltTools(toolEngine) during startup.
 */

import { ToolEngine } from "../core/toolEngine.js";
import { filesystemTools } from "./filesystem.js";
import { terminalTools } from "./terminal.js";
import { gitTools } from "./git.js";
import { codeTools } from "./code.js";

export function registerBuiltinTools(engine: ToolEngine): void {
  for (const tool of [...filesystemTools, ...terminalTools, ...gitTools, ...codeTools]) {
    engine.register(tool);
  }
}

export const BUILTIN_TOOL_CATEGORIES = {
  filesystem: filesystemTools.map((t) => t.name),
  terminal: terminalTools.map((t) => t.name),
  git: gitTools.map((t) => t.name),
  code: codeTools.map((t) => t.name),
};
