/**
 * Agent orchestrator — the core turn loop.
 *
 * 1. Build system prompt from agent + project context.
 * 2. Call provider (chat or stream).
 * 3. If tool calls returned, request approval via callback, execute tools,
 *    feed results back to the model, repeat.
 * 4. Return final assistant text.
 */

import { ProviderRegistry } from "../providers/registry.js";
import { ToolEngine } from "../core/toolEngine.js";
import { PermissionEngine } from "../permissions/engine.js";
import { SessionManager } from "./session.js";
import { ContextManager } from "./context.js";
import { buildProjectContext, inspectProject } from "./project.js";
import { type ChatOptions, type Message, type ToolCall } from "../providers/base.js";
import { debug, error, info, warn } from "../utils/logger.js";

export interface AgentRunOptions {
  sessionId: string;
  agentId: string;
  userMessage: string;
  model?: string;
  providerId?: string;
  projectPath?: string;
  onChunk?: (text: string) => void;
  onToolCall?: (name: string, args: unknown, result: { ok: boolean; output?: any; error?: string }) => void;
  onApproval?: (tool: string, args: unknown, decide: () => Promise<boolean>) => Promise<boolean>;
  maxIterations?: number;
}

export interface AgentRunResult {
  text: string;
  toolCalls: number;
  iterations: number;
  sessionId: string;
}

export class AgentOrchestrator {
  constructor(
    private providers: ProviderRegistry,
    private tools: ToolEngine,
    private permissions: PermissionEngine,
    private sessions: SessionManager,
    private context: ContextManager,
  ) {}

  async run(opts: AgentRunOptions): Promise<AgentRunResult> {
    const agent = this.sessions; // placeholder
    // agent config resolved by caller; here we just run the loop with provider
    const maxIter = opts.maxIterations ?? 10;
    let iterations = 0;
    let toolCallsCount = 0;
    let finalText = "";

    const messages: Message[] = [{ role: "user", content: opts.userMessage }];

    // Determine provider + model (caller should pre-resolve; here we need agent config).
    // For simplicity, orchestrator expects providerId & model set on options; agent system prompt prepended as system message.
    const systemPrompt = opts.agentId ? `You are agent ${opts.agentId}.` : "You are a helpful coding agent.";
    messages.unshift({ role: "system", content: systemPrompt });

    // If project path given, append project context as a system message (once).
    if (opts.projectPath) {
      try {
        const intel = inspectProject(opts.projectPath);
        messages.push({ role: "system", content: buildProjectContext(intel) });
      } catch {}
    }

    let providerId = opts.providerId;
    let model = opts.model;

    while (iterations < maxIter) {
      iterations++;
      const adapter = providerId ? this.providers.requireAdapter(providerId) : null;
      if (!adapter) {
        error("no provider available");
        break;
      }
      if (!adapter.enabled) {
        error("provider disabled", providerId);
        break;
      }

      const toolsDefs = this.tools.list().map((name) => {
        const t = this.tools.get(name)!;
        return { name: t.name, description: t.description, parameters: t.inputSchema };
      });

      const ctx = {
        sessionId: opts.sessionId,
        agentId: opts.agentId,
        projectPath: opts.projectPath,
      };

      let response: any;
      try {
        if (opts.onChunk) {
          response = await adapter.stream(
            { messages, model: model!, tools: toolsDefs, toolChoice: "auto", stream: true },
            (chunk: string) => { opts.onChunk!(chunk); finalText += chunk; }
          );
        } else {
          response = await adapter.chat({ messages, model: model!, tools: toolsDefs, toolChoice: "auto", stream: false });
          finalText += response.text;
        }
      } catch (err) {
        error("provider call failed", err);
        finalText += `\n[provider error: ${(err as Error).message}]`;
        break;
      }

      // Add assistant message
      messages.push({ role: "assistant", content: response.text ?? "" });

      const toolCalls = response.toolCalls || [];
      if (!toolCalls || toolCalls.length === 0) break;

      toolCallsCount += toolCalls.length;

      // Execute each tool call (sequentially to avoid conflicting changes).
      for (const tc of toolCalls) {
        const tool = this.tools.get(tc.name);
        if (!tool) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: unknown tool ${tc.name}` });
          continue;
        }

        // Permission check
        const decision = this.permissions.resolve({ tool: tc.name, agentId: opts.agentId, projectPath: opts.projectPath });
        let proceed = false;
        if (decision.level === "ALLOW") proceed = true;
        else if (decision.level === "DENY") {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: permission denied for ${tc.name}` });
          continue;
        } else {
          // ASK
          if (opts.onApproval) {
            proceed = await opts.onApproval(tc.name, tc.arguments, async () => true);
          } else {
            messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: ${tc.name} requires user approval` });
            continue;
          }
        }

        if (!proceed) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: user denied ${tc.name}` });
          continue;
        }

        const result = await this.tools.execute(tc.name, tc.arguments, {
          ...ctx,
          cwd: opts.projectPath || process.cwd(),
        });
        toolCallsCount++;
        opts.onToolCall?.(tc.name, tc.arguments, result);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ ok: result.ok, output: result.output, error: result.error }) });
      }
    }

    return { text: finalText, toolCalls: toolCallsCount, iterations, sessionId: opts.sessionId };
  }
}
