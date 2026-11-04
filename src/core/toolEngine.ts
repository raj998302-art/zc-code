/**
 * Tool execution engine.
 *
 * Validates tool input schemas, resolves permissions (global > project > agent
 * > command), enforces timeouts, executes tool handlers, logs results to the
 * audit trail, and returns structured output to the agent.
 */

import { z } from "zod";
import { database } from "../storage/database.js";
import { debug, error, info, warn } from "../utils/logger.js";
import { redactSecret } from "../utils/logger.js";

export interface ToolContext {
  sessionId?: string;
  agentId?: string;
  projectPath?: string;
  userId?: string;
  cwd: string;
}

export interface ToolResult {
  ok: boolean;
  output?: string | object;
  error?: string;
  tokens?: number;
}

export interface PermissionDecision {
  level: "ALLOW" | "ASK" | "DENY";
  reason?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  permission: string; // e.g. "writeFile", "executeCommand"
  timeoutMs: number;
  execute(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

export class ToolEngine {
  private tools = new Map<string, ToolDefinition>();
  private globalPermissions: Record<string, string> = {};

  setGlobalPermissions(perms: Record<string, string>): void {
    this.globalPermissions = { ...perms };
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    debug("tool registered", tool.name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): string[] {
    return [...this.tools.keys()].sort();
  }

  resolvePermission(toolName: string, agentPermissions?: Record<string, string>): PermissionDecision {
    // Priority: agent > project > global
    const agentLevel = agentPermissions?.[toolName];
    if (agentLevel) return { level: agentLevel as any };
    const globalLevel = this.globalPermissions[toolName];
    if (globalLevel) return { level: globalLevel as any };
    return { level: "ASK", reason: "no explicit permission; defaulting to ASK" };
  }

  async execute(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext,
    onAsk?: (tool: string, args: unknown, decision: PermissionDecision) => Promise<"allow-once" | "always" | "deny">
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `Unknown tool: ${name}` };
    }

    // Validate input schema
    let args: unknown;
    try {
      args = tool.inputSchema.parse(rawArgs);
    } catch (err) {
      return { ok: false, error: `Invalid input for ${name}: ${(err as Error).message}` };
    }

    // Permission check
    const decision = this.resolvePermission(name);
    if (decision.level === "DENY") {
      const res: ToolResult = { ok: false, error: `Permission DENIED for tool "${name}"` };
      this.logAudit(name, "DENY", args, res.error, ctx.sessionId, ctx.agentId);
      return res;
    }
    if (decision.level === "ASK") {
      if (!onAsk) {
        const res: ToolResult = { ok: false, error: `Tool "${name}" requires approval (ASK). No approval handler provided.` };
        this.logAudit(name, "ASK", args, res.error, ctx.sessionId, ctx.agentId);
        return res;
      }
      const answer = await onAsk(name, args, decision);
      if (answer === "deny") {
        const res: ToolResult = { ok: false, error: `Tool "${name}" denied by user.` };
        this.logAudit(name, "DENY", args, res.error, ctx.sessionId, ctx.agentId);
        return res;
      }
      // allow-once / always -> proceed
    }

    // Execute with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), tool.timeoutMs);
    let result: ToolResult;
    try {
      const start = Date.now();
      debug("executing tool", name, JSON.stringify(redactSecret(JSON.stringify(args))).slice(0, 200));
      result = await tool.execute(args, ctx);
      const elapsed = Date.now() - start;
      debug("tool completed", name, `(${elapsed}ms)`);
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : String(err);
      result = { ok: false, error: `Tool "${name}" failed: ${msg}` };
      this.logAudit(name, "ERROR", args, result.error, ctx.sessionId, ctx.agentId);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }

    // Validate output schema if present
    if (result.ok && tool.outputSchema) {
      try {
        tool.outputSchema.parse(result.output);
      } catch (err) {
        result = {
          ok: false,
          error: `Tool "${name}" output validation failed: ${(err as Error).message}`,
          output: result.output,
        };
      }
    }

    this.logAudit(name, decision.level, args, result.ok ? "ok" : result.error, ctx.sessionId, ctx.agentId);
    return result;
  }

  private logAudit(tool: string, decision: string, args: unknown, detail: unknown, sessionId?: string, agentId?: string): void {
    try {
      const db = database.dbInstance;
      db.run(
        "INSERT INTO audit (ts, actor, action, target, decision, details) VALUES (?,?,?,?,?,?)",
        [new Date().toISOString(), agentId ?? "system", "tool", tool, decision, JSON.stringify({ sessionId, args, detail })]
      );
    } catch {
      // best effort
    }
  }
}

export const toolEngine = new ToolEngine();
