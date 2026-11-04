/**
 * Context management — token estimation, context window tracking, summarization triggers.
 */

import { estimateMessagesTokens } from "../utils/tokens.js";

export interface ContextWindow {
  usedTokens: number;
  totalTokens: number;
  percent: number;
  withinLimit: boolean;
}

export class ContextManager {
  constructor(private maxTokens: number = 8000) {}

  estimate(messages: Array<{ role?: string; content?: string }>): ContextWindow {
    const used = estimateMessagesTokens(messages);
    const percent = Math.min(100, Math.round((used / this.maxTokens) * 100));
    return { usedTokens: used, totalTokens: this.maxTokens, percent, withinLimit: used < this.maxTokens };
  }

  shouldSummarize(messages: Array<{ role?: string; content?: string }>, threshold: number = 8000): boolean {
    return estimateMessagesTokens(messages) > threshold;
  }
}

export const contextManager = new ContextManager();
