/**
 * Skills manager — reusable agent skills.
 *
 * Skills provide instructions (system prompt additions), metadata, and optional
 * resource files. They do NOT bypass permissions.
 */

import { existsSync, readFileSync, statSync, readdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { SKILLS_DIR } from "../utils/paths.js";
import { configManager } from "../config/manager.js";
import { debug, info, warn } from "../utils/logger.js";

export interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  instructions: string; // system prompt addition
  tools?: string[];
  permissions?: Record<string, string>;
  resources?: string[];
}

export class SkillsManager {
  list(): Skill[] {
    const out: Skill[] = [];
    if (!existsSync(SKILLS_DIR)) return out;
    for (const f of readdirSync(SKILLS_DIR)) {
      const dir = join(SKILLS_DIR, f);
      if (!statSync(dir).isDirectory()) continue;
      const metaPath = join(dir, "skill.json");
      if (!existsSync(metaPath)) continue;
      try {
        const m = JSON.parse(readFileSync(metaPath, "utf8")) as Skill;
        out.push(m);
      } catch {}
    }
    return out;
  }

  get(id: string): Skill | null {
    for (const s of this.list()) if (s.id === id) return s;
    return null;
  }

  install(skillDir: string): void {
    const metaPath = join(skillDir, "skill.json");
    if (!existsSync(metaPath)) throw new Error("skill.json not found");
    const skill = JSON.parse(readFileSync(metaPath, "utf8")) as Skill;
    cpSync(skillDir, join(SKILLS_DIR, skill.id), { recursive: true });
    info("skill installed", skill.id);
  }

  applyToAgent(skill: Skill, agentId: string): void {
    const agent = configManager.getAgent(agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);
    const updated = {
      ...agent,
      systemPrompt: `${agent.systemPrompt}\n\n--- Skill: ${skill.name} ---\n${skill.instructions}\n`,
      tools: [...new Set([...(agent.tools || []), ...(skill.tools || [])])],
      permissions: { ...agent.permissions, ...(skill.permissions || {}) },
    };
    configManager.addAgent(updated);
    info("skill applied to agent", agentId, skill.id);
  }
}

export const skillsManager = new SkillsManager();
