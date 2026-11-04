/**
 * Obfuscated secret store for provider API keys and MCP credentials.
 *
 * Secrets are stored under DATA_ROOT/auth/ as individual files keyed by provider.
 * Obfuscation is XOR + base64: a deterrent against accidental exposure, NOT a
 * substitute for full-disk encryption. Users are encouraged to encrypt their
 * home directory / Termux storage.
 *
 * Secrets are NEVER logged, never included in error messages, and never
 * transmitted anywhere except to the configured provider base URL.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_ROOT } from "../utils/paths.js";
import { debug, error, info, redactSecret } from "../utils/logger.js";

const XOR_KEY = 0x5a;

function obfuscate(plain: string): string {
  const bytes = Buffer.from(plain, "utf8");
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= XOR_KEY;
  return bytes.toString("base64");
}

function deobfuscate(b64: string): string {
  const bytes = Buffer.from(b64, "base64");
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= XOR_KEY;
  return bytes.toString("utf8");
}

export function secretPath(provider: string): string {
  return join(AUTH_ROOT, `${provider}.key`);
}

export function hasSecret(provider: string): boolean {
  try {
    return existsSync(secretPath(provider));
  } catch {
    return false;
  }
}

export function getSecret(provider: string): string | null {
  try {
    if (!hasSecret(provider)) return null;
    const b64 = readFileSync(secretPath(provider), "utf8").trim();
    return deobfuscate(b64);
  } catch (err) {
    error("failed to read secret for provider", provider, err);
    return null;
  }
}

export function setSecret(provider: string, secret: string): void {
  try {
    mkdirSync(AUTH_ROOT, { recursive: true });
    writeFileSync(secretPath(provider), obfuscate(secret), { mode: 0o600 });
    debug("secret stored for provider", provider);
  } catch (err) {
    error("failed to store secret for provider", provider, err);
    throw err;
  }
}

export function removeSecret(provider: string): boolean {
  try {
    if (!hasSecret(provider)) return false;
    // Best-effort secure overwrite before unlink.
    try {
      writeFileSync(secretPath(provider), Buffer.alloc(secretPath(provider).length), { mode: 0o600 });
    } catch {}
    unlinkSync(secretPath(provider));
    return true;
  } catch {
    return false;
  }
}

export function listSecretProviders(): string[] {
  try {
    if (!existsSync(AUTH_ROOT)) return [];
    return readdirSync(AUTH_ROOT)
      .filter((f: string) => f.endsWith(".key"))
      .map((f: string) => f.replace(/\.key$/, ""));
  } catch {
    return [];
  }
}

export function secretSummary(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of listSecretProviders()) {
    out[p] = redactSecret(getSecret(p) || "");
  }
  return out;
}

export function ensureAuthDir(): void {
  mkdirSync(AUTH_ROOT, { recursive: true });
}
