/**
 * Platform-appropriate directory resolution for ZC CODE.
 *
 * Respects XDG_CONFIG_HOME / XDG_DATA_HOME when set, otherwise falls back to
 * ~/.config/zc-code and ~/.local/share/zc-code. Works identically on Termux
 * (Android), Ubuntu/Debian, other Linux, and macOS.
 *
 * Secrets are kept strictly separate from ordinary configuration.
 */

import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();

export const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(home, ".config");
export const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(home, ".local", "share");

export const CONFIG_ROOT = join(XDG_CONFIG_HOME, "zc-code");
export const DATA_ROOT = join(XDG_DATA_HOME, "zc-code");

export const AUTH_ROOT = join(DATA_ROOT, "auth");
export const SESSIONS_ROOT = join(DATA_ROOT, "sessions");
export const DATABASE_ROOT = join(DATA_ROOT, "database");
export const LOGS_ROOT = join(DATA_ROOT, "logs");
export const CACHE_ROOT = join(DATA_ROOT, "cache");

export const CONFIG_FILE = join(CONFIG_ROOT, "config.json");
export const PROVIDERS_FILE = join(CONFIG_ROOT, "providers.json");
export const MODELS_FILE = join(CONFIG_ROOT, "models.json");
export const AGENTS_DIR = join(CONFIG_ROOT, "agents");
export const TOOLS_DIR = join(CONFIG_ROOT, "tools");
export const PLUGINS_DIR = join(CONFIG_ROOT, "plugins");
export const SKILLS_DIR = join(CONFIG_ROOT, "skills");
export const MCP_DIR = join(CONFIG_ROOT, "mcp");
export const PERMISSIONS_DIR = join(CONFIG_ROOT, "permissions");
export const PROJECTS_DIR = join(CONFIG_ROOT, "projects");

export const DATABASE_FILE = join(DATABASE_ROOT, "zc.db");

export function appDirs(): Record<string, string> {
  return {
    config: CONFIG_ROOT,
    data: DATA_ROOT,
    auth: AUTH_ROOT,
    sessions: SESSIONS_ROOT,
    database: DATABASE_ROOT,
    logs: LOGS_ROOT,
    cache: CACHE_ROOT,
    providers: PROVIDERS_FILE,
    models: MODELS_FILE,
    agents: AGENTS_DIR,
    tools: TOOLS_DIR,
    plugins: PLUGINS_DIR,
    skills: SKILLS_DIR,
    mcp: MCP_DIR,
    permissions: PERMISSIONS_DIR,
    projects: PROJECTS_DIR,
    databaseFile: DATABASE_FILE,
  };
}

export function isTermux(): boolean {
  return Boolean(process.env.PREFIX && process.env.PREFIX.includes("com.termux"));
}

export function isAndroid(): boolean {
  return /android/i.test(process.platform || "") || isTermux();
}

export function userFacingDataDir(): string {
  return DATA_ROOT;
}
