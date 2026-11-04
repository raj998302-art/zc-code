/**
 * Plugin manager — loads and validates plugins.
 *
 * Plugins are JavaScript/TypeScript modules that export a `plugin` object
 * conforming to the Plugin SDK. They can provide tools, providers, MCP
 * integrations, hooks, commands, and agents.
 *
 * Plugins are validated before loading and never executed without user consent.
 */

import { existsSync, readFileSync, statSync, readdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { PLUGINS_DIR, CONFIG_ROOT } from "../utils/paths.js";
import { configManager } from "../config/manager.js";
import { debug, error, info, warn } from "../utils/logger.js";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  main: string; // entry file
  provides?: {
    tools?: string[];
    providers?: string[];
    mcp?: string[];
    hooks?: string[];
    commands?: string[];
    agents?: string[];
  };
  permissions?: Record<string, string>;
}

export interface PluginSDK {
  registerTool: (def: any) => void;
  registerProvider: (def: any) => void;
  registerCommand: (def: any) => void;
  registerAgent: (def: any) => void;
}

export class PluginManager {
  private loaded = new Map<string, any>();

  list(): Array<{ id: string; name: string; version: string; enabled: boolean }> {
    const cfg = configManager.getTools(); // reuse tools storage for plugin state
    const out: Array<{ id: string; name: string; version: string; enabled: boolean }> = [];
    if (!existsSync(PLUGINS_DIR)) return out;
    for (const f of readdirSync(PLUGINS_DIR)) {
      const dir = join(PLUGINS_DIR, f);
      if (!statSync(dir).isDirectory()) continue;
      const manifestPath = join(dir, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const m = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifest;
        const enabled = cfg.tools[f]?.enabled !== false;
        out.push({ id: m.id, name: m.name, version: m.version, enabled });
      } catch {}
    }
    return out;
  }

  async install(pluginDir: string): Promise<void> {
    const manifestPath = join(pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) throw new Error("plugin.json not found");
    const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    // Validate
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
      throw new Error("Invalid plugin manifest: id, name, version, main required");
    }
    const dest = join(PLUGINS_DIR, manifest.id);
    cpSync(pluginDir, dest, { recursive: true });
    configManager.getTools(); // ensure
    // Mark enabled by default but require user consent before loading
    const toolsCfg = configManager.getTools();
    configManager.setTools({ ...toolsCfg, tools: { ...toolsCfg.tools, [manifest.id]: { enabled: false, timeoutMs: 30000 } } });
    info("plugin installed", manifest.id);
    warn("Plugin installed but not loaded. Use 'zc plugins enable <id>' to load after reviewing.");
  }

  async load(pluginId: string, sdk: PluginSDK): Promise<void> {
    const dir = join(PLUGINS_DIR, pluginId);
    const main = join(dir, "plugin.json");
    if (!existsSync(main)) throw new Error(`Plugin not found: ${pluginId}`);
    const manifest: PluginManifest = JSON.parse(readFileSync(main, "utf8"));
    const entry = join(dir, manifest.main);
    if (!existsSync(entry)) throw new Error(`Plugin entry not found: ${manifest.main}`);
    // eslint-disable-next-line no-undefined
    const mod = await import(entry);
    const plugin = mod.plugin || mod.default;
    if (!plugin) throw new Error("Plugin does not export 'plugin'");
    // Invoke plugin with SDK
    if (typeof plugin.setup === "function") await plugin.setup(sdk);
    this.loaded.set(pluginId, plugin);
    info("plugin loaded", pluginId);
  }

  unload(pluginId: string): void {
    this.loaded.delete(pluginId);
    debug("plugin unloaded", pluginId);
  }

  isLoaded(pluginId: string): boolean {
    return this.loaded.has(pluginId);
  }
}

export const pluginManager = new PluginManager();
