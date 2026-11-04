/**
 * MCP manager — lifecycle for multiple MCP servers.
 */

import { configManager } from "../config/manager.js";
import { MCPClient } from "./client.js";
import { debug, info } from "../utils/logger.js";

export class MCPManager {
  private clients = new Map<string, MCPClient>();

  getServer(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  list(): Array<{ id: string; name: string; connected: boolean; transport: string }> {
    return [...this.clients.values()].map((c) => ({ id: c.id, name: c.name, connected: c.isConnected(), transport: c.transport }));
  }

  async addServer(id: string, name: string, transport: "stdio" | "http", config: { command?: string; args?: string[]; url?: string; env?: Record<string, string> }): Promise<void> {
    if (this.clients.has(id)) throw new Error(`MCP server already exists: ${id}`);
    const client = new MCPClient(id, name, transport);
    await client.connect(config);
    this.clients.set(id, client);
    configManager.addMCPServer({ id, name, transport, ...config });
    info("mcp server added", id);
  }

  async removeServer(id: string): Promise<boolean> {
    const c = this.clients.get(id);
    if (c) { await c.disconnect(); this.clients.delete(id); }
    configManager.removeMCPServer(id);
    return true;
  }

  async connectConfigured(): Promise<void> {
    const mcp = configManager.getMCP();
    for (const [id, s] of Object.entries(mcp.servers)) {
      if (!s.enabled) continue;
      if (this.clients.has(id)) continue;
      try {
        const client = new MCPClient(id, s.name, s.transport);
        await client.connect({
          command: s.command,
          args: s.args,
          url: s.url,
          env: s.env,
        });
        this.clients.set(id, client);
        info("mcp auto-connected", id);
      } catch (err) {
        debug("mcp auto-connect failed", id, (err as Error).message);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [id, c] of this.clients) {
      try { await c.disconnect(); } catch {}
    }
    this.clients.clear();
  }

  async listTools(serverId: string): Promise<any[]> {
    const c = this.clients.get(serverId);
    if (!c) return [];
    return c.listTools();
  }

  async callTool(serverId: string, name: string, args: Record<string, unknown>): Promise<any> {
    const c = this.clients.get(serverId);
    if (!c) throw new Error(`MCP server not connected: ${serverId}`);
    return c.callTool(name, args);
  }
}

export const mcpManager = new MCPManager();
