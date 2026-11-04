/**
 * Token estimation and cost helpers.
 *
 * Pure heuristic (characters / 4) unless a provider reports usage.
 * No external dependency, works in Termux.
 */

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough heuristic: ~4 characters per token for English text/code.
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: Array<{ role?: string; content?: string }>): number {
  let total = 0;
  for (const m of messages) {
    total += 4; // per-message overhead
    if (m.role) total += estimateTokens(m.role);
    if (m.content) total += estimateTokens(m.content);
  }
  return total;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    total: a.total + b.total,
  };
}

export function formatTokens(n: number): string {
  return n.toLocaleString();
}
