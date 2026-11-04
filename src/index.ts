#!/usr/bin/env node
/**
 * ZC CODE — bin entry point.
 * Detects whether to run the interactive TUI or the CLI command router.
 */

import { runCLI } from "./cli.js";
import { ZCApp } from "./tui/app.js";
import { render } from "ink";
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));

async function main() {
  const args = process.argv.slice(2);

  // If no arguments, run interactive TUI
  if (args.length === 0) {
    await bootstrapAndLaunchTUI();
    return;
  }

  // Handle global flags only when they are the sole argument
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    console.log(`zc ${pkg.version}`);
    return;
  }
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log(`
ZC CODE — Personal AI Coding Agent

Usage:
  zc                          Open interactive TUI
  zc --version                Show version
  zc --help                   Show this help

Commands:
  zc chat                     Start interactive chat
  zc run "prompt"             Run a one-shot agent task
  zc plan | build | review | fix   Agent shortcuts
  zc models <list|add|remove|use>
  zc providers <list|add|remove>
  zc auth <login|logout|list>
  zc mcp <add|remove|list|enable|disable|auth>
  zc agent <create|list|use|remove>
  zc tools <list|enable|disable>
  zc plugins <install|list|update|remove>
  zc skills <list|install|create>
  zc permissions <show|reset>
  zc sessions <list|resume|delete>
  zc config <show|edit>
  zc doctor                   Diagnose installation
  zc update                   Check for updates
  zc uninstall                Remove ZC CODE

Examples:
  zc run "Create a login page"
  zc providers add openrouter
  zc models use openrouter/gpt-4o-mini --provider openrouter
  zc mcp add context7
  zc agent create

Documentation: https://github.com/raj998302-art/zc-code
    `);
    return;
  }

  await runCLI(args);
}

async function bootstrapAndLaunchTUI(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { bootstrapProviders } = await import("./cli.js");
  bootstrapProviders();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { database } = await import("./storage/database.js");
  await database.init();
  const config = (await import("./config/manager.js")).configManager.getConfig();
  const defaultProvider = config.defaultProvider || "(none)";
  const defaultModel = config.defaultModel || "(none)";
  const defaultAgent = config.defaultAgent || "build";

  const { unmount } = await render(
    React.createElement(ZCApp, {
      provider: defaultProvider,
      model: defaultModel,
      agent: defaultAgent,
      project: process.cwd(),
      onSubmit: async () => {
        // Placeholder — wired when provider/model configured
      },
    })
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("zc: fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
