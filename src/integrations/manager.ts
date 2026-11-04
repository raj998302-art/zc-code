/**
 * Third-party integrations manager (opt-in).
 *
 * Users define integrations with base URL, auth, headers, endpoints, schemas,
 * and timeouts. Credentials are stored in the secrets vault. Integrations are
 * never used unless explicitly configured by the user.
 */

import { configManager } from "../config/manager.js";
import { getSecret, setSecret, removeSecret, secretPath } from "../security/credentials.js";
import { debug, info } from "../utils/logger.js";

export interface Integration {
  id: string;
  name: string;
  baseURL: string;
  auth: { type: "none" | "apikey" | "bearer"; apiKeyEnv?: string; header?: string };
  headers: Record<string, string>;
  timeoutMs: number;
}

export class IntegrationsManager {
  private integrations = new Map<string, Integration>();

  list(): Integration[] {
    return [...this.integrations.values()];
  }

  add(integration: Integration): void {
    this.integrations.set(integration.id, { ...integration });
    if (integration.auth.apiKeyEnv) {
      const key = process.env[integration.auth.apiKeyEnv];
      if (key) setSecret(`integration:${integration.id}`, key);
    }
    info("integration added", integration.id);
  }

  remove(id: string): boolean {
    removeSecret(`integration:${id}`);
    return this.integrations.delete(id);
  }

  get(id: string): Integration | undefined {
    return this.integrations.get(id);
  }

  async request(id: string, path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<any> {
    const int = this.integrations.get(id);
    if (!int) throw new Error(`Unknown integration: ${id}`);
    const url = int.baseURL.replace(/\/+$/, "") + path;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...int.headers, ...(opts.headers || {}) };
    if (int.auth.type === "apikey" && int.auth.apiKeyEnv) {
      const key = getSecret(`integration:${id}`) || process.env[int.auth.apiKeyEnv];
      if (key) headers[int.auth.header || "X-API-Key"] = key;
    } else if (int.auth.type === "bearer") {
      const key = getSecret(`integration:${id}`) || process.env[int.auth.apiKeyEnv || ""];
      if (key) headers["Authorization"] = `Bearer ${key}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), int.timeoutMs);
    try {
      const res = await fetch(url, { method: opts.method ?? "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`integration request failed: ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      return ct.includes("application/json") ? await res.json() : await res.text();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}

export const integrationsManager = new IntegrationsManager();
