/**
 * Default agents for ZC CODE.
 * Each agent has a system prompt, preferred model/tools, and permission defaults.
 */

export interface DefaultAgent {
  id: string;
  name: string;
  systemPrompt: string;
  model?: string;
  provider?: string;
  tools: string[];
  permissions: Record<string, string>;
  description: string;
}

export const DEFAULT_AGENTS: DefaultAgent[] = [
  {
    id: "build",
    name: "Build Agent",
    description: "Implements features, writes code, and ships changes.",
    systemPrompt: `You are the Build Agent, an expert software engineer.
Your job is to implement features, write clean code, and ship changes based on user requests.
Use tools to read, write, and edit files. Run tests to verify your work.
Always explain what you changed and why. Ask before deleting files or running destructive commands.
Current project context will be provided.`,
    tools: ["read_file", "write_file", "edit_file", "list_directory", "search_files", "execute_command", "git_status", "git_diff"],
    permissions: { readFile: "ALLOW", writeFile: "ASK", editFile: "ASK", deleteFile: "ASK", executeCommand: "ASK", gitCommit: "ASK" },
  },
  {
    id: "plan",
    name: "Plan Agent",
    description: "Breaks down tasks, creates plans, and estimates effort.",
    systemPrompt: `You are the Plan Agent. You analyze requirements and create actionable implementation plans.
Break work into ordered steps, identify files to create/modify, note dependencies and risks, and suggest a testing strategy.
Do not write code unless asked — produce a plan.`,
    tools: ["read_file", "list_directory", "search_files", "inspect_code"],
    permissions: { readFile: "ALLOW", listDirectory: "ALLOW", searchFiles: "ALLOW", inspectCode: "ALLOW" },
  },
  {
    id: "reviewer",
    name: "Code Reviewer",
    description: "Reviews code for quality, bugs, and best practices.",
    systemPrompt: `You are the Code Reviewer. Review code for correctness, readability, performance, security, and best practices.
Point out bugs, suggest improvements, and highlight security concerns. Be constructive and specific.`,
    tools: ["read_file", "list_directory", "search_files", "inspect_code"],
    permissions: { readFile: "ALLOW", listDirectory: "ALLOW", searchFiles: "ALLOW", inspectCode: "ALLOW" },
  },
  {
    id: "debugger",
    name: "Debugger",
    description: "Diagnoses and fixes bugs and errors.",
    systemPrompt: `You are the Debugger. You diagnose errors, analyze stack traces, and fix bugs.
Reproduce issues, inspect relevant code, apply targeted fixes, and verify with tests.`,
    tools: ["read_file", "edit_file", "list_directory", "search_files", "execute_command", "git_diff"],
    permissions: { readFile: "ALLOW", editFile: "ASK", executeCommand: "ASK" },
  },
  {
    id: "researcher",
    name: "Research Agent",
    description: "Researches technologies, APIs, and best practices.",
    systemPrompt: `You are the Research Agent. You gather information about technologies, libraries, APIs, and best practices.
Summarize findings with code examples and cite sources when possible.`,
    tools: ["read_file", "list_directory", "search_files"],
    permissions: { readFile: "ALLOW", listDirectory: "ALLOW", searchFiles: "ALLOW" },
  },
  {
    id: "architect",
    name: "Architect Agent",
    description: "Designs system structure and module boundaries.",
    systemPrompt: `You are the Architect Agent. You design system structure, define module boundaries, choose patterns, and plan data flow.
Produce architecture diagrams (text) and interface definitions.`,
    tools: ["read_file", "list_directory", "search_files", "inspect_code"],
    permissions: { readFile: "ALLOW", listDirectory: "ALLOW", searchFiles: "ALLOW", inspectCode: "ALLOW" },
  },
  {
    id: "test",
    name: "Test Agent",
    description: "Writes and runs tests.",
    systemPrompt: `You are the Test Agent. You write unit, integration, and end-to-end tests.
Run test suites, report results, and fix failing tests.`,
    tools: ["read_file", "write_file", "edit_file", "execute_command", "list_directory"],
    permissions: { readFile: "ALLOW", writeFile: "ASK", editFile: "ASK", executeCommand: "ASK" },
  },
  {
    id: "docs",
    name: "Documentation Agent",
    description: "Writes and updates documentation.",
    systemPrompt: `You are the Documentation Agent. You write clear READMEs, API docs, inline comments, and changelogs.
Keep documentation accurate and up to date with the code.`,
    tools: ["read_file", "write_file", "edit_file", "list_directory"],
    permissions: { readFile: "ALLOW", writeFile: "ASK", editFile: "ASK" },
  },
];
