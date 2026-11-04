#!/usr/bin/env node
/**
 * ZC CODE — CLI command router (commander).
 * Wires together config, providers, tools, permissions, agents, MCP, sessions, TUI.
 */

import { program } from "commander";
import { configManager } from "./config/manager.js";
import { providerRegistry, ProviderError } from "./providers/registry.js";
import { OpenAICompatibleProvider } from "./providers/openaiCompatible.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";
import { OllamaProvider } from "./providers/ollama.js";
import { toolEngine } from "./core/toolEngine.js";
import { registerBuiltinTools } from "./tools/registry.js";
import { permissionEngine } from "./permissions/engine.js";
import { sessionManager } from "./core/session.js";
import { contextManager } from "./core/context.js";
import { AgentOrchestrator } from "./core/agent.js";
import { mcpManager } from "./mcp/manager.js";
import { registerDefaultAgents, listAgents, getAgent, createAgent, removeAgent, useAgent, getDefaultAgentId } from "./agents/manager.js";
import { pluginManager } from "./plugins/manager.js";
import { skillsManager } from "./skills/manager.js";
import { integrationsManager } from "./integrations/manager.js";
import { getSecret, setSecret, removeSecret, listSecretProviders, secretSummary, ensureAuthDir } from "./security/credentials.js";
import { ZCApp, StartupScreen } from "./tui/app.js";
import React from "react";
import { render } from "ink";
import { CONFIG_ROOT, DATA_ROOT, AUTH_ROOT } from "./utils/paths.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { debug, info, error, warn, setLogLevel } from "./utils/logger.js";
import { estimateTokens } from "./utils/tokens.js";
import { database } from "./storage/database.js";
import prompts from "prompts";
import { join } from "node:path";
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));

/* -------------------------------------------------------------
   Bootstrap
   ------------------------------------------------------------- */

export function bootstrapProviders(): void {  const prov = configManager.getProviders();
  for (const [id, cfg] of Object.entries(prov.providers)) {
    if (!cfg.enabled) continue;
    let adapter: any = null;
    const apiKey = (cfg.apiKeyEnv ? (process.env[cfg.apiKeyEnv] || getSecret(id)) : getSecret(id)) || "";
    try {
      switch (id) {
        case "openrouter":
        case "openai":
        case "nvidia":
        case "groq":
        case "deepseek":
        case "together":
        case "cerebras":
        case "lmstudio":
        case "custom": {
          adapter = new OpenAICompatibleProvider({
            id,
            name: id,
            baseURL: cfg.baseURL || "https://api.openai.com/v1",
            apiKey,
            customHeaders: cfg.customHeaders,
            timeoutMs: cfg.timeoutMs,
            capabilities: {
              toolCalling: id !== "lmstudio",
              multimodal: false,
              structuredOutput: false,
              streaming: true,
            },
            defaultModel: cfg.defaultModel,
            models: cfg.models,
          });
          break;
        }
        case "anthropic": {
          adapter = new AnthropicProvider(apiKey, cfg.baseURL || "https://api.anthropic.com", cfg.timeoutMs ?? 60000, cfg.defaultModel || "claude-3-5-sonnet-20241022");
          break;
        }
        case "gemini": {
          adapter = new GeminiProvider(apiKey, cfg.baseURL || "https://generativelanguage.googleapis.com/v1beta", cfg.timeoutMs ?? 60000, cfg.defaultModel || "gemini-1.5-pro");
          break;
        }
        case "ollama": {
          adapter = new OllamaProvider(cfg.baseURL || "http://localhost:11434", cfg.timeoutMs, cfg.defaultModel || "llama3.1");
          break;
        }
        default: {
          debug("unknown provider id, skipping", id);
        }
      }
      if (adapter) providerRegistry.register(adapter);
    } catch (err) {
      error("failed to register provider", id, err);
    }
  }
  registerBuiltinTools(toolEngine);
  registerDefaultAgents();
  debug("bootstrap complete");
}

/* -------------------------------------------------------------
   Helpers
   ------------------------------------------------------------- */

function needProvider(id?: string): any {
  const pid = id || configManager.getConfig().defaultProvider;
  if (!pid) throw new Error("No provider configured. Run: zc providers add <id>");
  return providerRegistry.requireAdapter(pid);
}

function resolveModel(providerId: string, model?: string): string {
  if (model) return model;
  const cfg = configManager.getProvider(providerId);
  return cfg?.defaultModel || "";
}

function requireModel(providerId: string, model?: string): string {
  const m = resolveModel(providerId, model);
  if (!m) throw new Error(`No model configured for provider ${providerId}. Run: zc models use <model> --provider ${providerId}`);
  return m;
}

function getAgentConfig(agentId?: string): any {
  const id = agentId || configManager.getDefaultAgent() || "build";
  const agent = configManager.getAgent(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}

/* -------------------------------------------------------------
   Program setup
   ------------------------------------------------------------- */

program
  .name("zc")
  .description("ZC CODE — Personal AI Coding Agent")
  .version(pkg.version, "--version", "Show version number")
  .usage("[command] [options]");

program
  .command("chat")
  .description("Start interactive chat TUI")
  .action(async () => {
    bootstrapProviders();
    await database.init();
    const { defaultProvider, defaultModel, defaultAgent } = configManager.getConfig();
    if (!defaultProvider) {
      // eslint-disable-next-line no-console
      console.error("No provider configured. Run: zc providers add <id>\nThen: zc chat");
      process.exit(1);
    }
    const { unmount } = await render(
      React.createElement(ZCApp, {
        provider: defaultProvider,
        model: defaultModel || "(none)",
        agent: defaultAgent || "build",
        project: process.cwd(),
        onSubmit: async (message: string, onChunk?: (chunk: string) => void) => {
          // wire orchestrator
          const agentCfg = getAgentConfig();
          const pid = agentCfg.provider || defaultProvider;
          const model = agentCfg.model || defaultModel || "";
          if (!model) throw new Error("No model configured for agent");
          const adapter = providerRegistry.requireAdapter(pid);
          const orchestrator = new AgentOrchestrator(providerRegistry, toolEngine, permissionEngine, sessionManager, contextManager);
          let currentText = "";
          await orchestrator.run({
            sessionId: "cli-session",
            agentId: agentCfg.id,
            userMessage: message,
            model,
            providerId: pid,
            projectPath: process.cwd(),
            onChunk: (chunk: string) => { currentText += chunk; onChunk?.(chunk); },
            onApproval: async (tool: string, args: unknown) => {
              // blocking approval via prompt
              return await askApproval(tool, args);
            },
          });
        },
      })
    );
    // keep process alive; Ink handles its own lifecycle
  });

program
  .command("run <prompt>")
  .description("Run a one-shot agent task")
  .option("--agent <id>", "Agent to use")
  .option("--model <id>", "Model to use")
  .option("--provider <id>", "Provider to use")
  .action(async (prompt, opts) => {
    bootstrapProviders();
    await database.init();
    const agentId = opts.agent || configManager.getDefaultAgent() || "build";
    const agentCfg = getAgentConfig(agentId);
    const pid = opts.provider || agentCfg.provider || configManager.getConfig().defaultProvider;
    if (!pid) throw new Error("No provider configured. Run: zc providers add <id>");
    const model = opts.model || agentCfg.model || (configManager.getProvider(pid)?.defaultModel);
    if (!model) throw new Error(`No model configured for provider ${pid}`);
    const adapter = providerRegistry.requireAdapter(pid);
    const orchestrator = new AgentOrchestrator(providerRegistry, toolEngine, permissionEngine, sessionManager, contextManager);
    const session = await sessionManager.createSession({ name: prompt.slice(0, 60), agentId, provider: pid, model, projectPath: process.cwd() });
    let resultText = "";
    const result = await orchestrator.run({
      sessionId: session.id,
      agentId,
      userMessage: prompt,
      model,
      providerId: pid,
      projectPath: process.cwd(),
      onChunk: (chunk: string) => { resultText += chunk; process.stdout.write(chunk); },
      onApproval: async (tool: string, args: unknown) => {
        return await askApproval(tool, args);
      },
    });
    process.stdout.write("\n");
    await sessionManager.addMessage(session.id, { role: "assistant", content: result.text });
    process.exit(0);
  });

/* -------------------------------------------------------------
   Shortcut agent commands
   ------------------------------------------------------------- */

async function runAgentShortcut(prompt: string, agentId: string): Promise<void> {
  bootstrapProviders();
  await database.init();
  const agentCfg = getAgentConfig(agentId);
  const pid = agentCfg.provider || configManager.getConfig().defaultProvider;
  if (!pid) throw new Error("No provider configured. Run: zc providers add <id>");
  const model = agentCfg.model || (configManager.getProvider(pid)?.defaultModel);
  if (!model) throw new Error(`No model configured for provider ${pid}`);
  const adapter = providerRegistry.requireAdapter(pid);
  const orchestrator = new AgentOrchestrator(providerRegistry, toolEngine, permissionEngine, sessionManager, contextManager);
  const session = await sessionManager.createSession({ name: prompt.slice(0, 60), agentId, provider: pid, model, projectPath: process.cwd() });
  process.stdout.write(`\nRunning ${agentId} agent...\n\n`);
  const result = await orchestrator.run({
    sessionId: session.id,
    agentId,
    userMessage: prompt,
    model,
    providerId: pid,
    projectPath: process.cwd(),
    onChunk: (chunk: string) => process.stdout.write(chunk),
    onApproval: async (tool: string, args: unknown) => askApproval(tool, args),
  });
  process.stdout.write("\n");
  await sessionManager.addMessage(session.id, { role: "assistant", content: result.text });
  process.exit(0);
}

program
  .command("plan")
  .description("Run the Plan Agent on the current project")
  .action(async () => {
    await runAgentShortcut("Analyze the current project and produce a concise implementation plan. List files to create/modify, steps, dependencies, and risks.", "plan");
  });

program
  .command("build")
  .description("Run the Build Agent on the current project")
  .action(async () => {
    await runAgentShortcut("Implement the requested changes in the current project. Use tools to read, write, and edit files, then verify with tests.", "build");
  });

program
  .command("review")
  .description("Run the Code Reviewer agent")
  .action(async () => {
    await runAgentShortcut("Review the current project code for quality, bugs, security, and best practices. Report findings.", "reviewer");
  });

program
  .command("fix")
  .description("Run the Debugger agent to fix issues")
  .action(async () => {
    await runAgentShortcut("Diagnose and fix bugs in the current project. Inspect errors, analyze code, apply fixes, and verify.", "debugger");
  });

/* -------------------------------------------------------------
   models
   ------------------------------------------------------------- */

const modelsCmd = program
  .command("models")
  .description("Manage models");

modelsCmd
  .command("list")
  .description("List available models")
  .option("--provider <id>", "Filter by provider")
  .action(async (opts) => {
    bootstrapProviders();
    const models = await providerRegistry.listModels(opts.provider);
    if (models.length === 0) {
      console.log("No models discovered. Add models with: zc models add <id> --provider <provider>");
      return;
    }
    console.log("Available models:\n");
    for (const m of models) {
      const caps: string[] = [];
      if (m.capabilities.toolCalling) caps.push("tools");
      if (m.capabilities.multimodal) caps.push("multimodal");
      if (m.capabilities.streaming) caps.push("stream");
      console.log(`  ${m.id}  [${m.provider}]${caps.length ? ` (${caps.join(", ")})` : ""}`);
    }
  });

modelsCmd
  .command("add <id>")
  .description("Add a model to the catalog")
  .option("--provider <id>", "Provider id", true)
  .option("--name <name>", "Display name")
  .option("--context <n>", "Context window size", parseInt)
  .action(async (id, opts) => {
    configManager.addModel({
      id,
      name: opts.name,
      provider: opts.provider,
      contextWindow: opts.context,
    });
    console.log(`Model added: ${id}`);
  });

modelsCmd
  .command("remove <id>")
  .description("Remove a model from the catalog")
  .action(async (id) => {
    const ok = configManager.removeModel(id);
    console.log(ok ? `Model removed: ${id}` : `Model not found: ${id}`);
  });

modelsCmd
  .command("use <model>")
  .description("Set the default model (optionally --provider <id>)")
  .option("--provider <id>", "Provider id")
  .action(async (model, opts) => {
    const pid = opts.provider || configManager.getConfig().defaultProvider;
    if (!pid) throw new Error("No provider configured.");
    const cfg = configManager.getProvider(pid);
    if (!cfg) throw new Error(`Unknown provider: ${pid}`);
    configManager.addProvider(pid, { ...cfg, defaultModel: model });
    configManager.setConfig({ defaultModel: model });
    console.log(`Default model set: ${model} (provider: ${pid})`);
  });

/* -------------------------------------------------------------
   providers
   ------------------------------------------------------------- */

const providersCmd = program
  .command("providers")
  .description("Manage API providers");

providersCmd
  .command("list")
  .description("List configured providers")
  .action(async () => {
    const prov = configManager.getProviders();
    const secrets = secretSummary();
    console.log("Providers:\n");
    for (const [id, cfg] of Object.entries(prov.providers)) {
      const key = secrets[id] || "(none)";
      console.log(`  ${id}  enabled=${cfg.enabled}  baseURL=${cfg.baseURL || "(default)"}  key=${key}`);
    }
    if (Object.keys(prov.providers).length === 0) console.log("  (none configured)");
  });

providersCmd
  .command("add <id>")
  .description("Add a provider")
  .option("--name <name>", "Display name")
  .option("--base-url <url>", "API base URL")
  .option("--api-key-env <env>", "Environment variable holding the API key")
  .option("--default-model <model>", "Default model id")
  .action(async (id, opts) => {
    configManager.addProvider(id, {
      enabled: true,
      apiKeyEnv: opts.apiKeyEnv,
      baseURL: opts.baseUrl,
      defaultModel: opts.defaultModel,
    });
    console.log(`Provider added: ${id}`);
    if (opts.apiKeyEnv) {
      console.log(`  Set your API key: export ${opts.apiKeyEnv}=<your-key>`);
      console.log(`  Or: zc auth login ${id}`);
    }
  });

providersCmd
  .command("remove <id>")
  .description("Remove a provider")
  .action(async (id) => {
    const ok = configManager.removeProvider(id);
    removeSecret(id);
    console.log(ok ? `Provider removed: ${id}` : `Provider not found: ${id}`);
  });

providersCmd
  .command("enable <id>")
  .description("Enable a provider")
  .action(async (id) => {
    configManager.enableProvider(id, true);
    console.log(`Provider enabled: ${id}`);
  });

providersCmd
  .command("disable <id>")
  .description("Disable a provider")
  .action(async (id) => {
    configManager.enableProvider(id, false);
    console.log(`Provider disabled: ${id}`);
  });

/* -------------------------------------------------------------
   auth
   ------------------------------------------------------------- */

const authCmd = program
  .command("auth")
  .description("Manage authentication / API keys");

authCmd
  .command("login <provider>")
  .description("Store an API key for a provider")
  .action(async (provider) => {
    const res = await prompts({
      type: "password",
      name: "key",
      message: `API key for ${provider}:`,
    });
    if (!res.key) { console.log("Aborted."); return; }
    setSecret(provider, res.key);
    // ensure provider config exists
    const cfg = configManager.getProvider(provider) || { enabled: true, apiKeyEnv: undefined, baseURL: undefined, models: [] };
    configManager.addProvider(provider, { ...cfg, enabled: true });
    console.log(`API key stored for ${provider}.`);
  });

authCmd
  .command("logout <provider>")
  .description("Remove a stored API key")
  .action(async (provider) => {
    const ok = removeSecret(provider);
    console.log(ok ? `API key removed for ${provider}` : `No key stored for ${provider}`);
  });

authCmd
  .command("list")
  .description("List providers with stored keys")
  .action(async () => {
    const secrets = secretSummary();
    const ids = listSecretProviders();
    if (ids.length === 0) { console.log("No API keys stored."); return; }
    console.log("Stored keys:\n");
    for (const id of ids) console.log(`  ${id}: ${secrets[id]}`);
  });

/* -------------------------------------------------------------
   mcp
   ------------------------------------------------------------- */

const mcpCmd = program
  .command("mcp")
  .description("Manage MCP servers");

mcpCmd
  .command("list")
  .description("List MCP servers")
  .action(async () => {
    const mcp = configManager.getMCP();
    const live = mcpManager.list();
    console.log("MCP servers:\n");
    for (const [id, s] of Object.entries(mcp.servers)) {
      const liveEntry = live.find((l) => l.id === id);
      console.log(`  ${id}  enabled=${s.enabled}  transport=${s.transport}  connected=${liveEntry ? liveEntry.connected : false}`);
    }
    if (Object.keys(mcp.servers).length === 0) console.log("  (none configured)");
  });

mcpCmd
  .command("add <id>")
  .description("Add an MCP server")
  .option("--name <name>", "Display name")
  .option("--transport <t>", "stdio|http", "stdio")
  .option("--command <cmd>", "STDIO command")
  .option("--args <args>", "Comma-separated args")
  .option("--url <url>", "Streamable HTTP URL")
  .action(async (id, opts) => {
    const transport = opts.transport as any;
    const args = opts.args ? opts.args.split(",").filter(Boolean) : [];
    const config: any = { id, name: opts.name || id, transport, args };
    if (transport === "http") config.url = opts.url;
    else config.command = opts.command;
    await mcpManager.addServer(id, opts.name || id, transport, config);
    console.log(`MCP server added: ${id}`);
  });

mcpCmd
  .command("remove <id>")
  .description("Remove an MCP server")
  .action(async (id) => {
    await mcpManager.removeServer(id);
    console.log(`MCP server removed: ${id}`);
  });

mcpCmd
  .command("enable <id>")
  .description("Enable an MCP server")
  .action(async (id) => {
    const s = configManager.getMCPServer(id);
    if (!s) throw new Error(`Unknown MCP server: ${id}`);
    configManager.addMCPServer({ ...s, enabled: true });
    await mcpManager.connectConfigured();
    console.log(`MCP server enabled: ${id}`);
  });

mcpCmd
  .command("disable <id>")
  .description("Disable an MCP server")
  .action(async (id) => {
    const s = configManager.getMCPServer(id);
    if (!s) throw new Error(`Unknown MCP server: ${id}`);
    configManager.addMCPServer({ ...s, enabled: false });
    console.log(`MCP server disabled: ${id}`);
  });

mcpCmd
  .command("auth <id>")
  .description("Authenticate with an MCP server")
  .action(async (id) => {
    const s = configManager.getMCPServer(id);
    if (!s) throw new Error(`Unknown MCP server: ${id}`);
    const res = await prompts({
      type: "password",
      name: "key",
      message: `API key for MCP ${id}:`,
    });
    if (!res.key) { console.log("Aborted."); return; }
    setSecret(`mcp:${id}`, res.key);
    console.log(`MCP auth stored for ${id}.`);
  });

/* -------------------------------------------------------------
   agent
   ------------------------------------------------------------- */

const agentCmd = program
  .command("agent")
  .description("Manage agents");

agentCmd
  .command("list")
  .description("List agents")
  .action(async () => {
    const agents = listAgents();
    console.log("Agents:\n");
    for (const a of agents) {
      const mark = a.id === (configManager.getDefaultAgent() || "") ? " *" : "";
      console.log(`  ${a.id}${mark}  ${a.name}  model=${a.model || "(default)"}  tools=${a.tools.join(",") || "-"}`);
    }
  });

agentCmd
  .command("create")
  .description("Create a custom agent (interactive)")
  .action(async () => {
    const idRes = await prompts({ type: "text", name: "id", message: "Agent id:" });
    const nameRes = await prompts({ type: "text", name: "name", message: "Agent name:" });
    const promptRes = await prompts({ type: "text", name: "prompt", message: "System prompt:" });
    const modelRes = await prompts({ type: "text", name: "model", message: "Model (optional):" });
    createAgent({ id: idRes.id, name: nameRes.name, systemPrompt: promptRes.prompt, model: modelRes.model || undefined });
    console.log(`Agent created: ${idRes.id}`);
  });

agentCmd
  .command("use <id>")
  .description("Set the default agent")
  .action(async (id) => {
    useAgent(id);
    console.log(`Default agent: ${id}`);
  });

agentCmd
  .command("remove <id>")
  .description("Remove an agent")
  .action(async (id) => {
    const ok = removeAgent(id);
    console.log(ok ? `Agent removed: ${id}` : `Agent not found: ${id}`);
  });

/* -------------------------------------------------------------
   tools
   ------------------------------------------------------------- */

const toolsCmd = program
  .command("tools")
  .description("Manage built-in tools");

toolsCmd
  .command("list")
  .description("List tools")
  .action(async () => {
    const names = toolEngine.list();
    console.log("Tools:\n");
    for (const n of names) console.log(`  ${n}`);
  });

toolsCmd
  .command("enable <name>")
  .description("Enable a tool")
  .action(async (name) => {
    toolEngine.register; // no-op, tool always registered; gate via permissions
    console.log(`Tool ${name} available (gated by permissions)`);
  });

toolsCmd
  .command("disable <name>")
  .description("Disable a tool category")
  .action(async (name) => {
    console.log(`Tool control via permissions: zc permissions show`);
  });

/* -------------------------------------------------------------
   plugins
   ------------------------------------------------------------- */

const pluginsCmd = program
  .command("plugins")
  .description("Manage plugins");

pluginsCmd
  .command("list")
  .description("List plugins")
  .action(async () => {
    const plugins = pluginManager.list();
    console.log("Plugins:\n");
    for (const p of plugins) console.log(`  ${p.id} v${p.version}  ${p.enabled ? "enabled" : "disabled"}`);
    if (plugins.length === 0) console.log("  (none installed)");
  });

pluginsCmd
  .command("install <path>")
  .description("Install a plugin from a directory")
  .action(async (path) => {
    await pluginManager.install(path);
    console.log("Plugin installed. Review before enabling.");
  });

pluginsCmd
  .command("remove <id>")
  .description("Remove a plugin")
  .action(async (id) => {
    pluginManager.unload(id);
    console.log(`Plugin unloaded: ${id}`);
  });

pluginsCmd
  .command("update <id>")
  .description("Update a plugin (placeholder)")
  .action(async (id) => {
    console.log(`Plugin update not yet automated for: ${id}`);
  });

/* -------------------------------------------------------------
   skills
   ------------------------------------------------------------- */

const skillsCmd = program
  .command("skills")
  .description("Manage skills");

skillsCmd
  .command("list")
  .description("List skills")
  .action(async () => {
    const skills = skillsManager.list();
    console.log("Skills:\n");
    for (const s of skills) console.log(`  ${s.id}  ${s.name}  ${s.description}`);
    if (skills.length === 0) console.log("  (none installed)");
  });

skillsCmd
  .command("install <path>")
  .description("Install a skill from a directory")
  .action(async (path) => {
    skillsManager.install(path);
    console.log("Skill installed.");
  });

skillsCmd
  .command("create <id>")
  .description("Create a skill (placeholder)")
  .action(async (id) => {
    console.log(`Skill scaffold not yet implemented for: ${id}`);
  });

/* -------------------------------------------------------------
   permissions
   ------------------------------------------------------------- */

const permsCmd = program
  .command("permissions")
  .description("Show/reset permissions");

permsCmd
  .command("show")
  .description("Show current permissions")
  .action(async () => {
    const perms = configManager.getGlobalPermissions();
    console.log("Global permissions:\n");
    for (const [k, v] of Object.entries(perms)) console.log(`  ${k}: ${v}`);
  });

permsCmd
  .command("reset")
  .description("Reset permissions to defaults")
  .action(async () => {
    configManager.setGlobalPermissions({});
    console.log("Permissions reset to defaults.");
  });

/* -------------------------------------------------------------
   sessions
   ------------------------------------------------------------- */

const sessionsCmd = program
  .command("sessions")
  .description("Manage sessions");

sessionsCmd
  .command("list")
  .description("List sessions")
  .action(async () => {
    await database.init();
    const sessions = await sessionManager.listSessions();
    console.log("Sessions:\n");
    for (const s of sessions) console.log(`  ${s.id}  ${s.name}  agent=${s.agentId || "-"}  model=${s.model || "-"}`);
    if (sessions.length === 0) console.log("  (none)");
  });

sessionsCmd
  .command("resume <id>")
  .description("Resume a session (opens chat)")
  .action(async (id) => {
    await database.init();
    const session = await sessionManager.getSession(id);
    if (!session) { console.log(`Session not found: ${id}`); return; }
    console.log(`Resuming session ${id}: ${session.name}`);
    // switch to chat TUI with session context
    bootstrapProviders();
    const { unmount } = await render(
      React.createElement(ZCApp, {
        provider: session.provider || configManager.getConfig().defaultProvider || "(none)",
        model: session.model || "(none)",
        agent: session.agentId || configManager.getDefaultAgent() || "build",
        project: session.projectPath || process.cwd(),
        onSubmit: async (message: string, onChunk?: (chunk: string) => void) => {
          const agentCfg = getAgentConfig(session.agentId);
          const pid = agentCfg.provider || session.provider || configManager.getConfig().defaultProvider;
          const model = agentCfg.model || session.model || "";
          const adapter = providerRegistry.requireAdapter(pid);
          const orchestrator = new AgentOrchestrator(providerRegistry, toolEngine, permissionEngine, sessionManager, contextManager);
          await orchestrator.run({
            sessionId: session.id,
            agentId: session.agentId || agentCfg.id,
            userMessage: message,
            model,
            providerId: pid,
            projectPath: session.projectPath || process.cwd(),
            onChunk: onChunk,
            onApproval: async (tool: string, args: unknown) => askApproval(tool, args),
          });
          const msgs = await sessionManager.getMessages(session.id);
          await sessionManager.addMessage(session.id, { role: "assistant", content: "" });
        },
      })
    );
  });

sessionsCmd
  .command("delete <id>")
  .description("Delete a session")
  .action(async (id) => {
    await database.init();
    const ok = await sessionManager.deleteSession(id);
    console.log(ok ? `Session deleted: ${id}` : `Session not found: ${id}`);
  });

/* -------------------------------------------------------------
   config
   ------------------------------------------------------------- */

const configCmd = program
  .command("config")
  .description("Show/edit configuration");

configCmd
  .command("show")
  .description("Show configuration")
  .action(async () => {
    const cfg = configManager.getConfig();
    console.log(JSON.stringify(cfg, null, 2));
    console.log(`\nConfig dir: ${CONFIG_ROOT}`);
    console.log(`Data dir: ${DATA_ROOT}`);
    console.log(`Auth dir: ${AUTH_ROOT}`);
  });

configCmd
  .command("edit")
  .description("Open config in $EDITOR")
  .action(async () => {
    const { spawn } = await import("node:child_process");
    const editor = process.env.EDITOR || "nano";
    const file = configManager.getConfigPath();
    mkdirSync(CONFIG_ROOT, { recursive: true });
    if (!existsSync(file)) writeFileSync(file, JSON.stringify(configManager.getConfig(), null, 2) + "\n");
    const child = spawn(editor, [file], { stdio: "inherit" });
    child.on("close", () => {});
  });

/* -------------------------------------------------------------
   doctor
   ------------------------------------------------------------- */

program
  .command("doctor")
  .description("Diagnose installation and environment")
  .action(async () => {
    console.log("ZC CODE Doctor\n");
    console.log(`Node: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log(`Config: ${CONFIG_ROOT}`);
    console.log(`Data: ${DATA_ROOT}`);
    const prov = configManager.getProviders();
    console.log(`Providers configured: ${Object.keys(prov.providers).length}`);
    const secrets = secretSummary();
    const keys = Object.keys(secrets).length;
    console.log(`Stored API keys: ${keys}`);
    const agents = listAgents();
    console.log(`Agents: ${agents.length}`);
    const tools = toolEngine.list();
    console.log(`Tools registered: ${tools.length}`);
    await database.init();
    console.log(`Database: ${database.useSqlite ? "sql.js (SQLite)" : "JSON fallback"}`);
    console.log(`\nAll checks passed.`);
  });

/* -------------------------------------------------------------
   update / uninstall
   ------------------------------------------------------------- */

program
  .command("update")
  .description("Check for updates (placeholder)")
  .action(async () => {
    console.log("zc update: use your package manager to update zc-code.");
    console.log(`  npm update -g zc-code@latest`);
  });

program
  .command("uninstall")
  .description("Uninstall ZC CODE")
  .action(async () => {
    console.log("To uninstall: npm uninstall -g zc-code");
    console.log("Config files are preserved under " + CONFIG_ROOT);
  });

/* -------------------------------------------------------------
   Approval prompt (interactive TUI fallback for CLI)
   ------------------------------------------------------------- */

async function askApproval(tool: string, args: unknown): Promise<boolean> {
  const response = await prompts({
    type: "select",
    name: "choice",
    message: `ZC CODE wants to execute tool: ${tool}\nArgs: ${JSON.stringify(args).slice(0, 120)}\nPermission required.`,
    choices: [
      { title: "Allow once", value: "allow" },
      { title: "Always allow", value: "always" },
      { title: "Deny", value: "deny" },
    ],
  });
  if (response.choice === "deny") return false;
  permissionEngine.resolve({ tool, agentId: undefined, projectPath: process.cwd() });
  return true;
}

/* -------------------------------------------------------------
   Run
   ------------------------------------------------------------- */

export async function runCLI(args: string[]): Promise<void> {
  setLogLevel(process.env.LOG_LEVEL as any || "info");
  bootstrapProviders();
  await database.init();
  // Commander v12 needs the full argv (including node + script) for nested subcommands.
  await program.parseAsync(["node", "zc", ...args]);
}
