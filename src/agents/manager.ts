/**
 * Agent manager — CRUD for agents, default agents, and resolution.
 */

import { configManager } from "../config/manager.js";
import { DEFAULT_AGENTS } from "./defaultAgents.js";
import { type AgentConfigInput } from "../config/manager.js";
import { debug, info } from "../utils/logger.js";

export function registerDefaultAgents(): void {
  for (const agent of DEFAULT_AGENTS) {
    const existing = configManager.getAgent(agent.id);
    if (!existing) {
      configManager.addAgent({
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        provider: agent.provider,
        tools: agent.tools,
        permissions: agent.permissions,
      });
    }
  }
  if (!configManager.getDefaultAgent()) {
    configManager.setDefaultAgent("build");
  }
  info("default agents registered");
}

export function listAgents(): Array<{ id: string; name: string; systemPrompt: string; model?: string; tools: string[]; permissions: Record<string, string> }> {
  const agents = configManager.getAgents();
  return Object.values(agents.agents).map((a: any) => ({
    id: a.id,
    name: a.name,
    systemPrompt: a.systemPrompt,
    model: a.model,
    tools: a.tools ?? [],
    permissions: a.permissions ?? {},
  }));
}

export function getAgent(id: string): any {
  return configManager.getAgent(id);
}

export function createAgent(input: AgentConfigInput): void {
  configManager.addAgent(input);
  info("agent created", input.id);
}

export function removeAgent(id: string): boolean {
  // Protect built-in ids? Allow removal of user agents; built-ins can be re-registered.
  return configManager.removeAgent(id);
}

export function useAgent(id: string): void {
  if (!configManager.getAgent(id)) throw new Error(`Unknown agent: ${id}`);
  configManager.setDefaultAgent(id);
  info("default agent set", id);
}

export function getDefaultAgentId(): string | undefined {
  return configManager.getDefaultAgent();
}
