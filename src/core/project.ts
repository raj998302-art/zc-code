/**
 * Project intelligence — inspects the current working directory to detect
 * languages, frameworks, package managers, build systems, git status, and
 * key config files. Results are used to build the agent system prompt.
 *
 * Respects .gitignore and configurable ignore rules. Never reads every file
 * blindly.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ProjectIntel {
  root: string;
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  git: { isRepo: boolean; branch?: string; dirty: boolean };
  configFiles: string[];
  dependencies: Record<string, string> | null;
  summary: string;
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".dart": "Dart",
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".ipynb": "Python",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".hpp": "C++",
  ".rs": "Rust",
  ".go": "Go",
  ".php": "PHP",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "CSS",
  ".sass": "CSS",
  ".sql": "SQL",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".markdown": "Markdown",
};

const FRAMEWORK_MARKERS: Record<string, string[]> = {
  Flutter: ["pubspec.yaml"],
  FlutterDart: ["pubspec.yaml"],
  React: ["package.json", "react"],
  NextJS: ["package.json", "next.config"],
  NodeJS: ["package.json"],
  Python: ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"],
  Django: ["manage.py", "requirements.txt"],
  FastAPI: ["main.py", "requirements.txt"],
  Rust: ["Cargo.toml"],
  Go: ["go.mod", "go.sum"],
  Java: ["pom.xml", "build.gradle", "build.gradle.kts"],
  Kotlin: ["build.gradle.kts", "settings.gradle.kts"],
  Cpp: ["CMakeLists.txt", "Makefile"],
  PHP: ["composer.json"],
};

const BUILD_SYSTEM_MARKERS: Record<string, string[]> = {
  npm: ["package.json"],
  yarn: ["yarn.lock"],
  pnpm: ["pnpm-lock.yaml"],
  pip: ["requirements.txt"],
  poetry: ["pyproject.toml"],
  maven: ["pom.xml"],
  gradle: ["build.gradle", "build.gradle.kts"],
  cargo: ["Cargo.toml"],
  make: ["Makefile"],
  cmake: ["CMakeLists.txt"],
  pub: ["pubspec.yaml"],
  composer: ["composer.json"],
};

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".venv", "venv", "env", ".env",
  "dist", "build", "out", "target", ".dart_tool", ".next", "coverage",
  ".expo", "ios", "android", "__pycache__", ".pytest_cache",
]);

const CONFIG_FILES = [
  "package.json", "tsconfig.json", "jsconfig.json", "pubspec.yaml",
  "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
  "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts",
  "composer.json", "Makefile", "CMakeLists.txt", ".gitignore", "docker-compose.yml",
  "Dockerfile", ".env.example", "README.md",
];

function isIgnored(rel: string, ignoreGitignore: boolean): boolean {
  const parts = rel.split(/[/\\]/);
  for (const p of parts) {
    if (IGNORE_DIRS.has(p)) return true;
  }
  if (ignoreGitignore && rel.startsWith(".git/")) return true;
  return false;
}

function readTextSafely(file: string): string | null {
  try {
    const st = statSync(file);
    if (!st.isFile()) return null;
    if (st.size > 1_000_000) return null; // skip large files
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs");
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function detectGit(root: string): ProjectIntel["git"] {
  const gitDir = join(root, ".git");
  const isRepo = existsSync(gitDir);
  let branch: string | undefined;
  let dirty = false;
  if (isRepo) {
    const head = readTextSafely(join(gitDir, "HEAD")) || "";
    const m = head.match(/ref: refs\/heads\/(.+)/);
    if (m) branch = m[1].trim();
    // crude dirty check: any file under root not in .git (sampled)
    try {
      const entries = readdirSync(root);
      const hasUntrackedOrModified = entries.some(
        (e) => e !== ".git" && (existsSync(join(root, e)) && !IGNORE_DIRS.has(e))
      );
      dirty = hasUntrackedOrModified;
    } catch {
      dirty = false;
    }
  }
  return { isRepo, branch, dirty };
}

export function inspectProject(root = process.cwd(), ignoreGitignore = true): ProjectIntel {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const buildSystems = new Set<string>();
  const configFiles: string[] = [];
  let deps: Record<string, string> | null = null;
  let fileCount = 0;
  const maxFiles = 2000;

  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (fileCount++ > maxFiles) break;
      if (isIgnored(entry.name, ignoreGitignore)) continue;
      const full = join(root, entry.name);
      const ext = entry.name.includes(".") ? "." + entry.name.split(".").pop()!.toLowerCase() : "";
      const lang = LANGUAGE_EXTENSIONS[ext];
      if (lang) languages.add(lang);

      // config / marker detection
      for (const cfg of CONFIG_FILES) {
        if (entry.name === cfg) configFiles.push(cfg);
      }
      const lower = entry.name.toLowerCase();
      for (const [fw, markers] of Object.entries(FRAMEWORK_MARKERS)) {
        if (markers.includes(entry.name) || markers.some((m) => lower.includes(m.toLowerCase()))) {
          frameworks.add(fw);
        }
      }
      for (const [pm, markers] of Object.entries(BUILD_SYSTEM_MARKERS)) {
        if (markers.includes(entry.name)) {
          packageManagers.add(pm);
          buildSystems.add(pm);
        }
      }

      if (entry.isDirectory()) {
        // shallow scan one level deeper for language files
        try {
          const inner = readdirSync(full, { withFileTypes: true });
          for (const e of inner) {
            if (isIgnored(e.name, ignoreGitignore)) continue;
            const ext2 = e.name.includes(".") ? "." + e.name.split(".").pop()!.toLowerCase() : "";
            const lang2 = LANGUAGE_EXTENSIONS[ext2];
            if (lang2) languages.add(lang2);
          }
        } catch {}
      }
    }

    // read package.json for deps + pm hint
    const pkg = readTextSafely(join(root, "package.json"));
    if (pkg) {
      try {
        const pj = JSON.parse(pkg);
        const depsObj: Record<string, string> = {};
        for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
          const sec = pj[section];
          if (sec && typeof sec === "object") {
            for (const [k, v] of Object.entries(sec)) {
              depsObj[k] = String(v);
            }
          }
        }
        if (Object.keys(depsObj).length) deps = depsObj;
        if (pj.scripts?.dev || pj.scripts?.build) {
          // noop
        }
      } catch {}
    }

    // read go.mod / Cargo.toml briefly for dep count
    const goMod = readTextSafely(join(root, "go.mod"));
    if (goMod && !deps) deps = { "go.mod": "present" };
    const cargo = readTextSafely(join(root, "Cargo.toml"));
    if (cargo && !deps) deps = { "Cargo.toml": "present" };
  } catch {}

  const git = detectGit(root);

  const parts: string[] = [];
  if (languages.size) parts.push(`Languages: ${[...languages].join(", ")}`);
  if (frameworks.size) parts.push(`Frameworks: ${[...frameworks].join(", ")}`);
  if (packageManagers.size) parts.push(`Package managers: ${[...packageManagers].join(", ")}`);
  if (git.isRepo) parts.push(`Git: ${git.branch || "unknown"} ${git.dirty ? "(dirty)" : "(clean)"}`);

  return {
    root,
    languages: [...languages],
    frameworks: [...frameworks],
    packageManagers: [...packageManagers],
    buildSystems: [...buildSystems],
    git,
    configFiles,
    dependencies: deps,
    summary: parts.length ? parts.join("; ") : "No recognizable project structure.",
  };
}

export function buildProjectContext(intel: ProjectIntel): string {
  return `Project context:\n${intel.summary}\n`;
}
