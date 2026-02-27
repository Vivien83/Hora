/**
 * HORA — Cross-Project Awareness
 * Detects shared dependencies, entities, and patterns between projects.
 */
import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

export interface ProjectInfo {
  name: string;
  dir: string;
  projectId: string;
  deps: string[];
  hasProjectKnowledge: boolean;
}

export interface CrossProjectLink {
  project: string;
  sharedDeps: string[];
  sharedEntities: string[];
  relevance: number;
}

interface CacheEntry {
  ts: number;
  links: CrossProjectLink[];
  currentProject: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_FILE = path.join(homedir(), ".hora", "cross-project-cache.json");

// Well-known project locations to search
const SEARCH_DIRS = [
  path.join(homedir(), "Desktop"),
  path.join(homedir(), "Projects"),
  path.join(homedir(), "dev"),
  homedir(),
];

/**
 * Parse project names from MEMORY/PROFILE/projects.md.
 * Format: "- project_name [env:cwd, date]"
 */
function parseProjectNames(profileDir: string): string[] {
  const projectsFile = path.join(profileDir, "projects.md");
  try {
    const content = fs.readFileSync(projectsFile, "utf-8");
    const names: string[] = [];
    for (const line of content.split("\n")) {
      const match = line.match(/^-\s+(.+?)\s+\[/);
      if (match) {
        names.push(match[1].trim());
      }
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Try to find the directory for a project name.
 * Searches well-known locations.
 */
function resolveProjectDir(name: string): string | null {
  for (const base of SEARCH_DIRS) {
    const candidate = path.join(base, name);
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // not found here, continue
    }
  }
  return null;
}

/**
 * Read package.json dependencies (dependencies + devDependencies keys).
 */
function readDeps(projectDir: string): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
    const deps = new Set<string>();
    if (pkg.dependencies) {
      for (const d of Object.keys(pkg.dependencies)) deps.add(d);
    }
    if (pkg.devDependencies) {
      for (const d of Object.keys(pkg.devDependencies)) deps.add(d);
    }
    return [...deps];
  } catch {
    return [];
  }
}

/**
 * Read project-id from .hora/project-id file.
 */
function readProjectId(projectDir: string): string {
  try {
    return fs.readFileSync(path.join(projectDir, ".hora", "project-id"), "utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Discover known projects from MEMORY/PROFILE/projects.md.
 */
export function discoverProjects(profileDir: string): ProjectInfo[] {
  const names = parseProjectNames(profileDir);
  const projects: ProjectInfo[] = [];

  for (const name of names) {
    const dir = resolveProjectDir(name);
    if (!dir) continue;

    projects.push({
      name,
      dir,
      projectId: readProjectId(dir),
      deps: readDeps(dir),
      hasProjectKnowledge: fs.existsSync(path.join(dir, ".hora", "project-knowledge.md")),
    });
  }

  return projects;
}

/**
 * Read cache if valid (< 1h old, same current project).
 */
function readCache(currentProjectName: string): CrossProjectLink[] | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const cache: CacheEntry = JSON.parse(raw);
    if (
      cache.currentProject === currentProjectName &&
      Date.now() - cache.ts < CACHE_TTL_MS
    ) {
      return cache.links;
    }
  } catch {
    // no cache or invalid
  }
  return null;
}

/**
 * Write cache.
 */
function writeCache(currentProjectName: string, links: CrossProjectLink[]): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const entry: CacheEntry = {
      ts: Date.now(),
      links,
      currentProject: currentProjectName,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry, null, 2), "utf-8");
  } catch {
    // cache write failure is non-critical
  }
}

/**
 * Find cross-project dependencies for the current project.
 * Returns links sorted by relevance (descending).
 */
export function findCrossProjectLinks(
  currentProjectDir: string,
  currentProjectName: string,
  profileDir: string,
  graphDir?: string,
): CrossProjectLink[] {
  // Check cache first
  const cached = readCache(currentProjectName);
  if (cached) return cached;

  const currentDeps = new Set(readDeps(currentProjectDir));
  if (currentDeps.size === 0) {
    // No package.json or no deps — still check entities if graph available
  }

  const otherProjects = discoverProjects(profileDir).filter(
    (p) =>
      path.resolve(p.dir) !== path.resolve(currentProjectDir) &&
      p.name.toLowerCase() !== currentProjectName.toLowerCase(),
  );

  // Load entity names from graph if available
  let graphEntityNames: Set<string> | null = null;
  if (graphDir) {
    try {
      // Dynamic import to avoid hard dependency when graph is absent
      const { HoraGraph } = require("./knowledge-graph.js") as typeof import("./knowledge-graph.js");
      const graph = new HoraGraph(graphDir);
      const entities = graph.getAllEntities();
      graphEntityNames = new Set(entities.map((e) => e.name.toLowerCase()));
    } catch {
      // graph unavailable
    }
  }

  const totalDeps = currentDeps.size || 1; // avoid division by zero
  const links: CrossProjectLink[] = [];

  for (const project of otherProjects) {
    const sharedDeps = project.deps.filter((d) => currentDeps.has(d));

    // Check shared entities: entity names that appear in both projects
    const sharedEntities: string[] = [];
    if (graphEntityNames && project.dir) {
      // Check if the other project has entities in the graph
      // Entity names that match the other project name or its deps
      const otherDepsLower = new Set(project.deps.map((d) => d.toLowerCase()));
      for (const entityName of graphEntityNames) {
        if (
          otherDepsLower.has(entityName) ||
          entityName.includes(project.name.toLowerCase())
        ) {
          sharedEntities.push(entityName);
        }
      }
    }

    const depScore = (sharedDeps.length / totalDeps) * 0.6;
    const entityScore = sharedEntities.length > 0 ? 0.4 : 0;
    const relevance = Math.min(depScore + entityScore, 1);

    if (relevance > 0 || sharedDeps.length > 0) {
      links.push({
        project: project.name,
        sharedDeps,
        sharedEntities,
        relevance: Math.round(relevance * 100) / 100,
      });
    }
  }

  links.sort((a, b) => b.relevance - a.relevance);

  writeCache(currentProjectName, links);

  return links;
}
