/**
 * MCP client — connects to a single MCP server (STDIO or Streamable HTTP),
 * discovers tools/resources/prompts, and executes tool calls.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { debug, error, info, warn } from "../utils/logger.js";

export interface MCPServerStatus {
  id: string;
  connected: boolean;
  transport: "stdio" | "http";
  tools: string[];
  resources: string[];
  prompts: string[];
  error?: string;
}

export class MCPClient {
  public id: string;
  public name: string;
  public transport: "stdio" | "http";
  private client: Client | null = null;
  private transportInstance: any = null;
  private connected = false;
  private lastError: string | null = null;

  constructor(id: string, name: string, transport: "stdio" | "http") {
    this.id = id;
    this.name = name;
    this.transport = transport;
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  getStatus(): MCPServerStatus {
    return {
      id: this.id,
      connected: this.connected,
      transport: this.transport,
      tools: [],
      resources: [],
      prompts: [],
      error: this.lastError ?? undefined,
    };
  }

  async connect(config: { command?: string; args?: string[]; url?: string; env?: Record<string, string> }): Promise<void> {
    this.lastError = null;
    this.client = new Client({ name: "zc-code", version: "0.1.0" });
    try {
      if (this.transport === "stdio") {
        if (!config.command) throw new Error("STDIO transport requires a command");
        this.transportInstance = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
        });
      } else {
        if (!config.url) throw new Error("HTTP transport requires a url");
        this.transportInstance = new StreamableHTTPClientTransport(new URL(config.url));
      }
      await this.client.connect(this.transportInstance);
      this.connected = true;
      info("mcp connected", this.id, this.transport);
    } catch (err) {
      this.connected = false;
      this.lastError = (err as Error).message;
      error("mcp connect failed", this.id, this.lastError);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client?.close?.();
    } catch {}
    this.connected = false;
    this.client = null;
    this.transportInstance = null;
    debug("mcp disconnected", this.id);
  }

  async listTools(): Promise<any[]> {
    if (!this.client) return [];
    try {
      const res = await this.client.listTools();
      return res.tools || [];
    } catch (err) {
      this.lastError = (err as Error).message;
      error("mcp listTools failed", this.id, this.lastError);
      return [];
    }
  }

  async listResources(): Promise<any[]> {
    if (!this.client) return [];
    try {
      const res = await this.client.listResources();
      return res.resources || [];
    } catch {
      return [];
    }
  }

  async listPrompts(): Promise<any[]> {
    if (!this.client) return [];
    try {
      const res = await this.client.listPrompts();
      return res.prompts || [];
    } catch {
      return [];
    }
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<any> {
    if (!this.client) throw new Error(`MCP client ${this.id} not connected`);
    try {
      const res = await this.client.callTool({ name, arguments: arguments_ });
      return res;
    } catch (err) {
      this.lastError = (err as Error).message;
      error("mcp callTool failed", this.id, name, this.lastError);
      throw err;
    }
  }
}
