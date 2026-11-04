/**
 * Configuration manager.
 *
 * Reads/writes ZC CODE config files under CONFIG_ROOT. Secrets are stored
 * separately in the AUTH_ROOT vault (see security/credentials.ts) and are
 * never part of these JSON files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import {
  AGENTS_DIR,
  AUTH_ROOT,
  CACHE_ROOT,
  CONFIG_FILE,
  CONFIG_ROOT,
  DATABASE_FILE,
  DATABASE_ROOT,
  LOGS_ROOT,
  MCP_DIR,
  MODELS_FILE,
  PERMISSIONS_DIR,
  PLUGINS_DIR,
  PROVIDERS_FILE,
  SESSIONS_ROOT,
  SKILLS_DIR,
  TOOLS_DIR,
} from "../utils/paths.js";
import { debug, error, info } from "../utils/logger.js";
import {
  AgentConfigSchema,
  AgentsConfig,
  AgentsConfigSchema,
  Config,
  ConfigSchema,
  MCPConfig,
  MCPConfigSchema,
  MCPServerConfigSchema,
  ModelEntrySchema,
  ModelsConfig,
  ModelsConfigSchema,
  ProviderConfigSchema,
  ProvidersConfig,
  ProvidersConfigSchema,
  ToolsConfig,
  ToolsConfigSchema,
} from "./schema.js";

type Json = Record<string, unknown>;

function ensureDirs(): void {
  for (const d of [
    CONFIG_ROOT,
    AUTH_ROOT,
    SESSIONS_ROOT,
    DATABASE_ROOT,
    LOGS_ROOT,
    CACHE_ROOT,
    AGENTS_DIR,
    TOOLS_DIR,
    PLUGINS_DIR,
    SKILLS_DIR,
    MCP_DIR,
    PERMISSIONS_DIR,
  ]) {
    mkdirSync(d, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    const raw = readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    error(`failed to read ${file}`, err);
    return fallback;
  }
}

function writeJson<T>(file: string, data: T): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  } catch (err) {
    error(`failed to write ${file}`, err);
    throw err;
  }
}

export class ConfigManager {
  private config: Config;
  private providers: ProvidersConfig;
  private models: ModelsConfig;
  private agents: AgentsConfig;
  private mcp: MCPConfig;
  private tools: ToolsConfig;

  constructor() {
    ensureDirs();
    this.config = ConfigSchema.parse(readJson(CONFIG_FILE, {}));
    this.providers = ProvidersConfigSchema.parse(readJson(PROVIDERS_FILE, { providers: {} }));
    this.models = ModelsConfigSchema.parse(readJson(MODELS_FILE, { models: [] }));
    this.agents = AgentsConfigSchema.parse(
      readJson(join(AGENTS_DIR, "agents.json"), { agents: {}, defaultAgent: undefined })
    );
    this.mcp = MCPConfigSchema.parse(readJson(join(MCP_DIR, "servers.json"), { servers: {} }));
    this.tools = ToolsConfigSchema.parse(readJson(join(TOOLS_DIR, "tools.json"), { tools: {} }));
    debug("config loaded", { configRoot: CONFIG_ROOT });
  }

  /* ---------- core config ---------- */
  getConfig(): Config {
    return { ...this.config };
  }

  setConfig(partial: Partial<Config>): void {
    this.config = ConfigSchema.parse({ ...this.config, ...partial });
    writeJson(CONFIG_FILE, this.config);
    info("config updated");
  }

  get(key: string): unknown {
    return (this.config as any)[key];
  }

  set(key: string, value: unknown): void {
    this.config = ConfigSchema.parse({ ...this.config, [key]: value });
    writeJson(CONFIG_FILE, this.config);
  }

  /* ---------- providers ---------- */
  getProviders(): ProvidersConfig {
    return { providers: { ...this.providers.providers } };
  }

  setProviders(providers: ProvidersConfig): void {
    this.providers = ProvidersConfigSchema.parse(providers);
    writeJson(PROVIDERS_FILE, this.providers);
    info("providers updated");
  }

  addProvider(id: string, cfg: ProviderConfigInput): void {
    const validated = ProviderConfigSchema.parse(cfg);
    this.providers = ProvidersConfigSchema.parse({
      providers: { ...this.providers.providers, [id]: validated },
    });
    writeJson(PROVIDERS_FILE, this.providers);
    info("provider added", id);
  }

  removeProvider(id: string): boolean {
    if (!this.providers.providers[id]) return false;
    const { [id]: removed, ...rest } = this.providers.providers;
    this.providers = ProvidersConfigSchema.parse({ providers: rest });
    writeJson(PROVIDERS_FILE, this.providers);
    info("provider removed", id);
    return true;
  }

  getProvider(id: string): ProviderConfigInput | null {
    return this.providers.providers[id] ?? null;
  }

  enableProvider(id: string, enabled: boolean): void {
    const p = this.getProvider(id);
    if (!p) throw new Error(`Unknown provider: ${id}`);
    this.addProvider(id, { ...p, enabled });
  }

  /* ---------- models ---------- */
  getModels(): ModelsConfig {
    return { models: [...this.models.models] };
  }

  setModels(models: ModelsConfig): void {
    this.models = ModelsConfigSchema.parse(models);
    writeJson(MODELS_FILE, this.models);
  }

  addModel(model: ModelEntryInput): void {
    const validated = ModelEntrySchema.parse(model);
    this.models = ModelsConfigSchema.parse({
      models: this.models.models.filter((m) => m.id !== validated.id).concat(validated),
    });
    writeJson(MODELS_FILE, this.models);
  }

  removeModel(id: string): boolean {
    const before = this.models.models.length;
    this.models = ModelsConfigSchema.parse({
      models: this.models.models.filter((m) => m.id !== id),
    });
    if (this.models.models.length !== before) {
      writeJson(MODELS_FILE, this.models);
      return true;
    }
    return false;
  }

  /* ---------- agents ---------- */
  getAgents(): AgentsConfig {
    return { agents: { ...this.agents.agents }, defaultAgent: this.agents.defaultAgent };
  }

  setAgents(agents: AgentsConfig): void {
    this.agents = AgentsConfigSchema.parse(agents);
    writeJson(join(AGENTS_DIR, "agents.json"), this.agents);
  }

  addAgent(agent: AgentConfigInput): void {
    const validated = AgentConfigSchema.parse(agent);
    this.agents = AgentsConfigSchema.parse({
      agents: { ...this.agents.agents, [validated.id]: validated },
    });
    writeJson(join(AGENTS_DIR, "agents.json"), this.agents);
    info("agent added", validated.id);
  }

  removeAgent(id: string): boolean {
    if (!this.agents.agents[id]) return false;
    const { [id]: removed, ...rest } = this.agents.agents;
    this.agents = AgentsConfigSchema.parse({ agents: rest });
    if (this.agents.defaultAgent === id) this.agents.defaultAgent = undefined;
    writeJson(join(AGENTS_DIR, "agents.json"), this.agents);
    info("agent removed", id);
    return true;
  }

  getAgent(id: string): AgentConfigInput | null {
    return this.agents.agents[id] ?? null;
  }

  getDefaultAgent(): string | undefined {
    return this.agents.defaultAgent;
  }

  setDefaultAgent(id: string): void {
    this.agents = AgentsConfigSchema.parse({ ...this.agents, defaultAgent: id });
    writeJson(join(AGENTS_DIR, "agents.json"), this.agents);
  }

  /* ---------- mcp ---------- */
  getMCP(): MCPConfig {
    return { servers: { ...this.mcp.servers } };
  }

  setMCP(mcp: MCPConfig): void {
    this.mcp = MCPConfigSchema.parse(mcp);
    writeJson(join(MCP_DIR, "servers.json"), this.mcp);
  }

  addMCPServer(server: MCPServerConfigInput): void {
    const validated = MCPServerConfigSchema.parse(server);
    this.mcp = MCPConfigSchema.parse({
      servers: { ...this.mcp.servers, [validated.id]: validated },
    });
    writeJson(join(MCP_DIR, "servers.json"), this.mcp);
    info("mcp server added", validated.id);
  }

  removeMCPServer(id: string): boolean {
    if (!this.mcp.servers[id]) return false;
    const { [id]: removed, ...rest } = this.mcp.servers;
    this.mcp = MCPConfigSchema.parse({ servers: rest });
    writeJson(join(MCP_DIR, "servers.json"), this.mcp);
    info("mcp server removed", id);
    return true;
  }

  getMCPServer(id: string): MCPServerConfigInput | null {
    return this.mcp.servers[id] ?? null;
  }

  enableMCPServer(id: string, enabled: boolean): void {
    const s = this.getMCPServer(id);
    if (!s) throw new Error(`Unknown MCP server: ${id}`);
    this.addMCPServer({ ...s, enabled });
  }

  /* ---------- tools ---------- */
  getTools(): ToolsConfig {
    return { tools: { ...this.tools.tools } };
  }

  enableTool(id: string, enabled: boolean): void {
    const t = this.tools.tools[id];
    if (!t) throw new Error(`Unknown tool: ${id}`);
    this.tools = ToolsConfigSchema.parse({
      tools: { ...this.tools.tools, [id]: { ...t, enabled } },
    });
    writeJson(join(TOOLS_DIR, "tools.json"), this.tools);
  }

  setTools(tools: ToolsConfig): void {
    this.tools = ToolsConfigSchema.parse(tools);
    writeJson(join(TOOLS_DIR, "tools.json"), this.tools);
  }

  /* ---------- permissions ---------- */
  getGlobalPermissions() {
    return { ...this.config.permissions };
  }

  setGlobalPermissions(perms: Record<string, string>): void {
    this.config = ConfigSchema.parse({ ...this.config, permissions: perms as any });
    writeJson(CONFIG_FILE, this.config);
  }

  /* ---------- persistence helpers ---------- */
  getConfigPath(): string {
    return CONFIG_FILE;
  }

  getProvidersPath(): string {
    return PROVIDERS_FILE;
  }
}

export const configManager = new ConfigManager();

// Input types (slightly looser for user-facing input)
export interface ProviderConfigInput {
  enabled?: boolean;
  apiKeyEnv?: string;
  baseURL?: string;
  models?: string[];
  defaultModel?: string;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export interface ModelEntryInput {
  id: string;
  name?: string;
  provider: string;
  capabilities?: {
    toolCalling?: boolean;
    multimodal?: boolean;
    structuredOutput?: boolean;
    streaming?: boolean;
  };
  contextWindow?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface AgentConfigInput {
  id: string;
  name: string;
  systemPrompt?: string;
  model?: string;
  provider?: string;
  tools?: string[];
  mcpServers?: string[];
  permissions?: Record<string, string>;
  context?: string[];
}

export interface MCPServerConfigInput {
  id: string;
  name: string;
  enabled?: boolean;
  transport?: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  auth?: {
    type?: "none" | "apiKey" | "oauth";
    apiKeyEnv?: string;
    tokenEnv?: string;
  };
  timeoutMs?: number;
  permissions?: Record<string, string>;
}
