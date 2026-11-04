/**
 * Zod schemas for all ZC CODE configuration shapes.
 * Central validation keeps config, providers, models, agents, tools, and
 * permissions strictly typed.
 */

import { z } from "zod";

export const PermissionLevelSchema = z.enum(["ALLOW", "ASK", "DENY"]);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const ToolPermissionSchema = z.record(z.string(), PermissionLevelSchema);
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKeyEnv: z.string().optional(),
  baseURL: z.string().url().optional(),
  models: z.array(z.string()).default([]),
  defaultModel: z.string().optional(),
  customHeaders: z.record(z.string()).default({}),
  timeoutMs: z.number().default(60000),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ProvidersConfigSchema = z.object({
  providers: z.record(ProviderConfigSchema).default({}),
});
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;

export const ModelCapabilitySchema = z.object({
  toolCalling: z.boolean().default(false),
  multimodal: z.boolean().default(false),
  structuredOutput: z.boolean().default(false),
  streaming: z.boolean().default(true),
});
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const ModelEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  provider: z.string(),
  capabilities: ModelCapabilitySchema.default({}),
  contextWindow: z.number().optional(),
  costPerInputToken: z.number().optional(),
  costPerOutputToken: z.number().optional(),
});
export type ModelEntry = z.infer<typeof ModelEntrySchema>;

export const ModelsConfigSchema = z.object({
  models: z.array(ModelEntrySchema).default([]),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemPrompt: z.string().default("You are a helpful coding agent."),
  model: z.string().optional(),
  provider: z.string().optional(),
  tools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  permissions: ToolPermissionSchema.default({}),
  context: z.array(z.string()).default([]),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentsConfigSchema = z.object({
  agents: z.record(AgentConfigSchema).default({}),
  defaultAgent: z.string().optional(),
});
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

export const GlobalPermissionsSchema = z.object({
  readFile: PermissionLevelSchema.default("ALLOW"),
  writeFile: PermissionLevelSchema.default("ASK"),
  editFile: PermissionLevelSchema.default("ASK"),
  deleteFile: PermissionLevelSchema.default("ASK"),
  createDirectory: PermissionLevelSchema.default("ASK"),
  listDirectory: PermissionLevelSchema.default("ALLOW"),
  searchFiles: PermissionLevelSchema.default("ALLOW"),
  executeCommand: PermissionLevelSchema.default("ASK"),
  executeScript: PermissionLevelSchema.default("ASK"),
  installDependencies: PermissionLevelSchema.default("ASK"),
  gitCommit: PermissionLevelSchema.default("ASK"),
  gitPush: PermissionLevelSchema.default("ASK"),
  gitPull: PermissionLevelSchema.default("ASK"),
  networkAccess: PermissionLevelSchema.default("ASK"),
  externalDirectory: PermissionLevelSchema.default("DENY"),
});
export type GlobalPermissions = z.infer<typeof GlobalPermissionsSchema>;

export const ConfigSchema = z.object({
  version: z.string().default("0.1.0"),
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultAgent: z.string().optional(),
  theme: z.enum(["dark", "light"]).default("dark"),
  animations: z.boolean().default(true),
  permissions: GlobalPermissionsSchema.default({}),
  sessions: z.object({
    maxHistory: z.number().default(200),
    autoSummarize: z.boolean().default(true),
    summarizeAfterTokens: z.number().default(8000),
  }).default({}),
  project: z.object({
    respectGitignore: z.boolean().default(true),
    maxFilesRead: z.number().default(50),
  }).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export const MCPServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  transport: z.enum(["stdio", "http"]).default("stdio"),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  env: z.record(z.string()).default({}),
  auth: z
    .object({
      type: z.enum(["none", "apiKey", "oauth"]).default("none"),
      apiKeyEnv: z.string().optional(),
      tokenEnv: z.string().optional(),
    })
    .default({ type: "none" }),
  timeoutMs: z.number().default(30000),
  permissions: ToolPermissionSchema.default({}),
});
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const MCPConfigSchema = z.object({
  servers: z.record(MCPServerConfigSchema).default({}),
});
export type MCPConfig = z.infer<typeof MCPConfigSchema>;

export const ToolConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeoutMs: z.number().default(30000),
});
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

export const ToolsConfigSchema = z.object({
  tools: z.record(ToolConfigSchema).default({}),
});
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;
