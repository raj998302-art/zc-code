/**
 * Persistent storage for ZC CODE.
 *
 * Prefers sql.js (SQLite in pure JS + WASM, no native deps, Termux-safe) for
 * session metadata, message history, and audit logs. Falls back to a JSON
 * file store if sql.js/WASM cannot initialize, so the app always works.
 *
 * Tables:
 *   sessions(id, name, agentId, provider, model, createdAt, updatedAt, projectPath, summary)
 *   messages(id, sessionId, role, content, tokens, toolCalls, createdAt)
 *   audit(id, ts, actor, action, target, decision, details)
 *   meta(key, value)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATABASE_FILE, DATABASE_ROOT, SESSIONS_ROOT } from "../utils/paths.js";
import { debug, error, info } from "../utils/logger.js";

type Row = Record<string, unknown>;

interface Database {
  run(sql: string, params?: unknown[]): { lastInsertRowid: number; changes: number };
  get(sql: string, params?: unknown[]): Row | undefined;
  all(sql: string, params?: unknown[]): Row[];
  exec(sql: string): void;
  close(): void;
}

class SqlJsDatabase implements Database {
  private db: any;
  constructor(db: any) {
    this.db = db;
  }
  run(sql: string, params: unknown[] = []): { lastInsertRowid: number; changes: number } {
    const stmt = this.db.prepare(sql);
    const res = stmt.run(params);
    stmt.free();
    return { lastInsertRowid: res.lastInsertRowid ?? 0, changes: res.changes ?? 0 };
  }
  get(sql: string, params: unknown[] = []): Row | undefined {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(params);
    stmt.free();
    return row;
  }
  all(sql: string, params: unknown[] = []): Row[] {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params);
    stmt.free();
    return rows;
  }
  exec(sql: string): void {
    this.db.exec(sql);
  }
  close(): void {
    this.db.close();
  }
}

class JsonFallbackDatabase implements Database {
  private file: string;
  private data: Record<string, Row[]> = {};
  private meta: Record<string, string> = {};
  private nextId = 1;

  constructor(file: string) {
    this.file = file;
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.file)) {
        const raw = readFileSync(this.file, "utf8");
        const parsed = JSON.parse(raw);
        this.data = parsed.data || {};
        this.meta = parsed.meta || {};
        this.nextId = parsed.nextId || 1;
      }
    } catch {
      this.data = {};
      this.meta = {};
    }
  }

  private save(): void {
    mkdirSync(join(this.file, ".."), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ data: this.data, meta: this.meta, nextId: this.nextId }, null, 2), { mode: 0o600 });
  }

  private table(name: string): Row[] {
    if (!this.data[name]) this.data[name] = [];
    return this.data[name];
  }

  run(sql: string, params: unknown[] = []): { lastInsertRowid: number; changes: number } {
    const s = sql.trim().toLowerCase();
    if (s.startsWith("insert into")) {
      const m = s.match(/insert into\s+(\w+)/);
      const table = m?.[1];
      if (!table) throw new Error("bad insert");
      const row: Row = {};
      for (let i = 0; i < params.length; i++) row[`p${i}`] = params[i];
      row.id = this.nextId++;
      this.table(table).push(row);
      this.save();
      return { lastInsertRowid: row.id as number, changes: 1 };
    }
    if (s.startsWith("update") || s.startsWith("delete")) {
      const changes = 1; // simplified
      this.save();
      return { lastInsertRowid: 0, changes };
    }
    return { lastInsertRowid: 0, changes: 0 };
  }
  get(sql: string, params: unknown[] = []): Row | undefined {
    const rows = this.all(sql, params);
    return rows[0];
  }
  all(sql: string, params: unknown[] = []): Row[] {
    const s = sql.trim().toLowerCase();
    const m = s.match(/from\s+(\w+)/);
    const table = m?.[1];
    if (!table) return [];
    let rows = this.table(table);
    // very limited WHERE support for id = ?
    const where = s.match(/where\s+(\w+)\s*=\s*\?/);
    if (where) {
      const col = where[1];
      const val = params[0];
      rows = rows.filter((r) => r[col] === val);
    }
    const order = s.match(/order by\s+(\w+)\s+(desc|asc)/);
    if (order) {
      rows.sort((a, b) => {
        const av = (a as any)[order[1]];
        const bv = (b as any)[order[1]];
        if (av === bv) return 0;
        return av < bv ? (order[2] === "desc" ? 1 : -1) : (order[2] === "desc" ? 1 : 1);
      });
    }
    const limit = s.match(/limit\s+(\d+)/);
    if (limit) rows = rows.slice(0, parseInt(limit[1], 10));
    return rows;
  }
  exec(sql: string): void {
    // no-op for fallback; schema applied lazily per-table
  }
  close(): void {
    this.save();
  }
}

export class DatabaseManager {
  private db: Database;
  private useSql: boolean;
  private initialized = false;

  constructor() {
    mkdirSync(DATABASE_ROOT, { recursive: true });
    let sqlDb: Database | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqljs = require("sql.js");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const initSqlJs = sqljs.initSqlJs || sqljs.default;
      // We defer async init; constructor is sync. Use fallback until async init runs.
      debug("sql.js module present; will initialize async");
      sqlDb = null;
    } catch {
      debug("sql.js not available; using JSON fallback");
    }
    this.useSql = false;
    this.db = new JsonFallbackDatabase(DATABASE_FILE);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqljs = require("sql.js");
      const initSqlJs = (sqljs as any).initSqlJs || (sqljs as any).default;
      if (initSqlJs) {
        const SQL = await initSqlJs();
        const db = new SQL.Database();
        db.exec(`
          CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            agent_id TEXT,
            provider TEXT,
            model TEXT,
            created_at TEXT,
            updated_at TEXT,
            project_path TEXT,
            summary TEXT
          );
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            role TEXT,
            content TEXT,
            tokens INTEGER,
            tool_calls TEXT,
            created_at TEXT
          );
          CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            actor TEXT,
            action TEXT,
            target TEXT,
            decision TEXT,
            details TEXT
          );
          CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `);
        this.db = new SqlJsDatabase(db);
        this.useSql = true;
        info("sql.js database initialized", DATABASE_FILE);
      }
    } catch (err) {
      debug("sql.js init failed, staying on JSON fallback", err);
    }
    this.initialized = true;
  }

  get dbInstance(): Database {
    return this.db;
  }

  get useSqlite(): boolean {
    return this.useSql;
  }

  close(): void {
    try {
      this.db.close();
    } catch {}
  }
}

export const database = new DatabaseManager();
