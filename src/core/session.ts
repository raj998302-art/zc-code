/**
 * Session manager — persistent chat sessions, history, resume, export/import.
 * Backed by the DatabaseManager (sql.js with JSON fallback).
 */

import { uuidv4 } from "../utils/id.js";

import { database } from "../storage/database.js";
import { info, debug } from "../utils/logger.js";

let ready = false;
export async function ensureDb(): Promise<void> {
  if (!ready) {
    await database.init();
    ready = true;
  }
}

export interface SessionRecord {
  id: string;
  name: string;
  agentId?: string;
  provider?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  projectPath?: string;
  summary?: string;
}

export interface MessageRecord {
  id: number;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tokens?: number;
  toolCalls?: string;
  createdAt: string;
}

export class SessionManager {
  async listSessions(): Promise<SessionRecord[]> {
    await ensureDb();
    const rows = database.dbInstance.all(
      "SELECT * FROM sessions ORDER BY updated_at DESC"
    );
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      agentId: r.agent_id ? String(r.agent_id) : undefined,
      provider: r.provider ? String(r.provider) : undefined,
      model: r.model ? String(r.model) : undefined,
      createdAt: String(r.created_at || ""),
      updatedAt: String(r.updated_at || ""),
      projectPath: r.project_path ? String(r.project_path) : undefined,
      summary: r.summary ? String(r.summary) : undefined,
    }));
  }

  async createSession(opts: {
    name?: string;
    agentId?: string;
    provider?: string;
    model?: string;
    projectPath?: string;
  }): Promise<SessionRecord> {
    await ensureDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const name = opts.name || `Session ${new Date().toLocaleString()}`;
    database.dbInstance.run(
      "INSERT INTO sessions (id, name, agent_id, provider, model, created_at, updated_at, project_path, summary) VALUES (?,?,?,?,?,?,?,?,?)",
      [id, name, opts.agentId ?? null, opts.provider ?? null, opts.model ?? null, now, now, opts.projectPath ?? null, null]
    );
    const session: SessionRecord = { id, name, agentId: opts.agentId, provider: opts.provider, model: opts.model, createdAt: now, updatedAt: now, projectPath: opts.projectPath };
    info("session created", id);
    return session;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    await ensureDb();
    const row = database.dbInstance.get("SELECT * FROM sessions WHERE id = ?", [id]);
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name || ""),
      agentId: row.agent_id ? String(row.agent_id) : undefined,
      provider: row.provider ? String(row.provider) : undefined,
      model: row.model ? String(row.model) : undefined,
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
      projectPath: row.project_path ? String(row.project_path) : undefined,
      summary: row.summary ? String(row.summary) : undefined,
    };
  }

  async updateSession(id: string, patch: Partial<Pick<SessionRecord, "name" | "agentId" | "provider" | "model" | "projectPath" | "summary">>): Promise<void> {
    await ensureDb();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined) { fields.push("name = ?"); params.push(patch.name); }
    if (patch.agentId !== undefined) { fields.push("agent_id = ?"); params.push(patch.agentId); }
    if (patch.provider !== undefined) { fields.push("provider = ?"); params.push(patch.provider); }
    if (patch.model !== undefined) { fields.push("model = ?"); params.push(patch.model); }
    if (patch.projectPath !== undefined) { fields.push("project_path = ?"); params.push(patch.projectPath); }
    if (patch.summary !== undefined) { fields.push("summary = ?"); params.push(patch.summary); }
    if (!fields.length) return;
    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);
    database.dbInstance.run(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async deleteSession(id: string): Promise<boolean> {
    await ensureDb();
    database.dbInstance.run("DELETE FROM messages WHERE session_id = ?", [id]);
    const res = database.dbInstance.run("DELETE FROM sessions WHERE id = ?", [id]);
    return res.changes > 0;
  }

  async addMessage(sessionId: string, msg: Omit<MessageRecord, "id" | "sessionId" | "createdAt">): Promise<MessageRecord> {
    await ensureDb();
    const now = new Date().toISOString();
    const res = database.dbInstance.run(
      "INSERT INTO messages (session_id, role, content, tokens, tool_calls, created_at) VALUES (?,?,?,?,?,?)",
      [sessionId, msg.role, msg.content, msg.tokens ?? null, msg.toolCalls ?? null, now]
    );
    const record: MessageRecord = { id: res.lastInsertRowid, sessionId, role: msg.role, content: msg.content, tokens: msg.tokens, toolCalls: msg.toolCalls, createdAt: now };
    database.dbInstance.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [now, sessionId]);
    return record;
  }

  async getMessages(sessionId: string, limit?: number): Promise<MessageRecord[]> {
    await ensureDb();
    const lim = limit ? ` LIMIT ${limit}` : "";
    const rows = database.dbInstance.all(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC${lim}`,
      [sessionId]
    );
    return rows.map((r) => ({
      id: Number(r.id),
      sessionId: String(r.session_id),
      role: String(r.role) as any,
      content: String(r.content || ""),
      tokens: r.tokens ? Number(r.tokens) : undefined,
      toolCalls: r.tool_calls ? String(r.tool_calls) : undefined,
      createdAt: String(r.created_at || ""),
    }));
  }

  async exportSession(id: string): Promise<{ session: SessionRecord; messages: MessageRecord[] } | null> {
    const session = await this.getSession(id);
    if (!session) return null;
    const messages = await this.getMessages(id);
    return { session, messages };
  }

  async clearOldSessions(olderThanDays: number): Promise<number> {
    await ensureDb();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const res = database.dbInstance.run("DELETE FROM sessions WHERE updated_at < ?", [cutoff]);
    return res.changes;
  }
}

export const sessionManager = new SessionManager();
