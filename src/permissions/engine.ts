/**
 * Permission & security engine.
 *
 * Granular ALLOW / ASK / DENY with priority:
 *   agent override > project override > global default
 *
 * Also enforces:
 *   - file path restrictions (external directories DENY by default)
 *   - sensitive file protection
 *   - command validation for destructive operations
 *   - permission audit log
 */

import { z } from "zod";
import { resolve, sep } from "node:path";
import { database } from "../storage/database.js";
import { debug, error, info } from "../utils/logger.js";

export type PermissionLevel = "ALLOW" | "ASK" | "DENY";

export const PERMISSION_LEVEL_SCHEMA = z.enum(["ALLOW", "ASK", "DENY"]);

export interface PermissionContext {
  tool: string;
  agentId?: string;
  projectPath?: string;
  command?: string; // for shell commands
  filePath?: string;
}

export interface PermissionDecision {
  level: PermissionLevel;
  source: "agent" | "project" | "global" | "default";
  reason: string;
}

const SENSITIVE_NAMES = [".env", "secrets", "id_rsa", "id_ed25519", ".pem", ".key"];
function isSensitiveFile(filePath: string): boolean {
  const base = filePath.split(sep).pop() || "";
  const lower = base.toLowerCase();
  return SENSITIVE_NAMES.some((s) => lower.includes(s.toLowerCase()));
}

const DESTRUCTIVE_COMMANDS = [/rm\s+-rf/, /sudo\s+/, /chmod\s+777/, /mkfs/, /dd\s+/];
function isDestructiveCommand(command: string): boolean {
  return DESTRUCTIVE_COMMANDS.some((re) => re.test(command));
}

export class PermissionEngine {
  private global: Record<string, PermissionLevel> = {};
  private project: Map<string, Record<string, PermissionLevel>> = new Map();
  private agent: Map<string, Record<string, PermissionLevel>> = new Map();

  setGlobal(perms: Record<string, PermissionLevel>): void {
    this.global = { ...perms };
    debug("global permissions set", Object.keys(perms).length);
  }

  setProject(projectPath: string, perms: Record<string, PermissionLevel>): void {
    this.project.set(projectPath, { ...perms });
  }

  setAgent(agentId: string, perms: Record<string, PermissionLevel>): void {
    this.agent.set(agentId, { ...perms });
  }

  resolve(ctx: PermissionContext): PermissionDecision {
    // 1. agent override
    if (ctx.agentId) {
      const ag = this.agent.get(ctx.agentId);
      if (ag && ag[ctx.tool] !== undefined) {
        return { level: ag[ctx.tool], source: "agent", reason: "agent-level permission" };
      }
    }
    // 2. project override
    if (ctx.projectPath) {
      const pr = this.project.get(ctx.projectPath);
      if (pr && pr[ctx.tool] !== undefined) {
        return { level: pr[ctx.tool], source: "project", reason: "project-level permission" };
      }
    }
    // 3. global
    if (this.global[ctx.tool] !== undefined) {
      return { level: this.global[ctx.tool], source: "global", reason: "global permission" };
    }
    // 4. defaults by category
    const defaultLevel = defaultFor(ctx.tool, ctx);
    return { level: defaultLevel, source: "default", reason: `default for ${ctx.tool}` };
  }

  /** Additional path-based restrictions, independent of tool permission. */
  pathRestriction(filePath: string, projectPath?: string): { allowed: boolean; reason?: string } {
    if (isSensitiveFile(filePath)) {
      return { allowed: false, reason: "sensitive file protected" };
    }
    if (projectPath && !isWithin(filePath, projectPath)) {
      return { allowed: false, reason: "external directory access denied by default" };
    }
    return { allowed: true };
  }

  commandRestriction(command: string): { allowed: boolean; reason?: string } {
    if (isDestructiveCommand(command)) {
      return { allowed: false, reason: "potentially destructive command; requires explicit ASK/ALLOW" };
    }
    return { allowed: true };
  }

  async audit(ctx: PermissionContext, decision: PermissionDecision, userChoice?: "allow-once" | "always" | "deny"): Promise<void> {
    try {
      const db = database.dbInstance;
      db.run(
        "INSERT INTO audit (ts, actor, action, target, decision, details) VALUES (?,?,?,?,?,?)",
        [new Date().toISOString(), ctx.agentId ?? "system", "permission", ctx.tool, decision.level, JSON.stringify({ source: decision.source, reason: decision.reason, command: ctx.command, filePath: ctx.filePath, userChoice })]
      );
    } catch {}
  }
}

function defaultFor(tool: string, ctx: PermissionContext): PermissionLevel {
  const readTools = ["readFile", "listDirectory", "searchFiles", "git_status", "git_diff", "git_log", "git_branch"];
  const writeTools = ["writeFile", "editFile", "apply_patch", "replace_text"];
  if (readTools.includes(tool)) return "ALLOW";
  if (writeTools.includes(tool)) return "ASK";
  if (tool === "deleteFile") return "ASK";
  if (tool === "executeCommand" || tool === "executeScript") return "ASK";
  if (tool === "gitCheckout" || tool === "gitCommit" || tool === "gitPush") return "ASK";
  if (tool === "installDependencies" || tool === "networkAccess") return "ASK";
  if (tool === "externalDirectory") return "DENY";
  return "ASK";
}

function isWithin(child: string, parent: string): boolean {
  try {
    const rel = resolve(child).startsWith(resolve(parent) + sep) || resolve(child) === resolve(parent);
    return rel;
  } catch {
    return false;
  }
}

export const permissionEngine = new PermissionEngine();
