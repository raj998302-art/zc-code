/**
 * Provider registry — registration, lookup, enable/disable.
 */

import { ProviderAdapter, ProviderError, ModelEntry } from "./base.js";
export { ProviderError };

export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();
  private enabled = new Set<string>();

  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.id, adapter);
    if (adapter.enabled) this.enabled.add(adapter.id);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.providers.get(id);
  }

  list(): string[] {
    return [...this.providers.keys()].sort();
  }

  listEnabled(): string[] {
    return [...this.enabled].sort();
  }

  isEnabled(id: string): boolean {
    return this.enabled.has(id);
  }

  enable(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Unknown provider: ${id}`);
    this.enabled.add(id);
  }

  disable(id: string): void {
    this.enabled.delete(id);
  }

  async listModels(providerId?: string): Promise<ModelEntry[]> {
    const ids = providerId ? [providerId] : this.listEnabled();
    const result: ModelEntry[] = [];
    for (const id of ids) {
      const adapter = this.providers.get(id);
      if (!adapter || !adapter.enabled) continue;
      try {
        const models = await adapter.listModels();
        result.push(...models);
      } catch (err) {
        // provider may not support dynamic listing; continue
      }
    }
    return result;
  }

  requireAdapter(id: string): ProviderAdapter {
    const adapter = this.providers.get(id);
    if (!adapter) throw new ProviderError(id, `Provider not registered: ${id}`);
    if (!adapter.enabled) throw new ProviderError(id, `Provider disabled: ${id}`);
    return adapter;
  }
}

export const providerRegistry = new ProviderRegistry();
