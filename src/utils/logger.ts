/**
 * Redacted logger. API keys and secrets are never written to logs.
 */

import chalk from "chalk";

const canColor = process.env.FORCE_COLOR ? process.env.FORCE_COLOR !== "0" : !!(process.stdout?.isTTY);

const color = (str: string) => (canColor ? chalk(str) : str);

let level: "debug" | "info" | "warn" | "error" = process.env.LOG_LEVEL as any || "info";

export function setLogLevel(l: "debug" | "info" | "warn" | "error") {
  level = l;
}

const priority: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const min = priority[level] ?? 1;

function formatTime(): string {
  return new Date().toISOString();
}

function log(sev: string, label: string, ...args: unknown[]) {
  if (priority[sev] < min) return;
  const ts = formatTime();
  const prefix = color(`[${sev.toUpperCase()}]`) + ` ${color("[zc]")} ${label}`;
  // eslint-disable-next-line no-console
  console.log(`${ts} ${prefix}`, ...args.map((a) => redact(a)));
}

export function debug(...args: unknown[]) {
  log("debug", "DEBUG", ...args);
}

export function info(...args: unknown[]) {
  log("info", "INFO", ...args);
}

export function warn(...args: unknown[]) {
  log("warn", "WARN", ...args);
}

export function error(...args: unknown[]) {
  log("error", "ERROR", ...args);
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,            // OpenAI-style
  /sk-ant-[A-Za-z0-9\-]{20,}/g,      // Anthropic
  /AIza[0-9A-Za-z\-_]{35}/g,         // Google API key
  /gh[pousr]_[A-Za-z0-9]{20,}/g,     // GitHub tokens
  /nvapi-[A-Za-z0-9\-_]{20,}/g,      // NVIDIA
  /gsk_[A-Za-z0-9]{20,}/g,           // Groq
  /tgv-[A-Za-z0-9\-_]{20,}/g,        // Together
];

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    let s = value;
    for (const re of SECRET_PATTERNS) {
      s = s.replace(re, (m) => m.slice(0, 4) + "…".repeat(Math.max(1, m.length - 4)));
    }
    return s;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (
        lower.includes("key") ||
        lower.includes("secret") ||
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("apiKey") ||
        lower.includes("apikey")
      ) {
        out[k] = typeof v === "string" && v.length ? `${v.slice(0, 2)}…REDACTED…` : v;
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function redactSecret(value: string): string {
  if (!value) return "";
  return value.slice(0, 2) + "…REDACTED…";
}
