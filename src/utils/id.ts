/**
 * Minimal UUID v4 generator (pure JS, no dependency).
 * Falls back to crypto.randomUUID when available (Node 14.17+).
 */

export function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID();
  }
  const r = (crypto as any).randomBytes || (require("node:crypto") as any).randomBytes;
  const buf = r(16);
  buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(buf, (b: number) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
