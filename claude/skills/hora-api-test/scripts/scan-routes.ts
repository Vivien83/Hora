#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/scan-routes.ts [project-dir]
// Scans a Next.js App Router project for API routes.
// Outputs JSON to stdout, human-readable summary to stderr.

import * as fs from "node:fs";
import * as path from "node:path";

interface RouteParam {
  name: string;
  catchAll: boolean;
  optional: boolean;
}

interface RouteInfo {
  path: string;
  filePath: string;
  methods: string[];
  params: RouteParam[];
  hasValidation: boolean;
}

interface ScanResult {
  projectDir: string;
  apiDir: string;
  routes: RouteInfo[];
  totalRoutes: number;
  totalEndpoints: number;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function findApiDir(projectDir: string): string | null {
  const candidates = [
    path.join(projectDir, "app", "api"),
    path.join(projectDir, "src", "app", "api"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function extractParamsFromPath(routePath: string): RouteParam[] {
  const params: RouteParam[] = [];
  const segments = routePath.split(path.sep);

  for (const segment of segments) {
    // [[...slug]] — optional catch-all
    const optionalCatchAll = segment.match(/^\[\[\.\.\.(\w+)\]\]$/);
    if (optionalCatchAll) {
      params.push({ name: optionalCatchAll[1], catchAll: true, optional: true });
      continue;
    }
    // [...slug] — catch-all
    const catchAll = segment.match(/^\[\.\.\.(\w+)\]$/);
    if (catchAll) {
      params.push({ name: catchAll[1], catchAll: true, optional: false });
      continue;
    }
    // [id] — dynamic segment
    const dynamic = segment.match(/^\[(\w+)\]$/);
    if (dynamic) {
      params.push({ name: dynamic[1], catchAll: false, optional: false });
    }
  }

  return params;
}

function detectMethods(fileContent: string): string[] {
  const methods: string[] = [];

  for (const method of HTTP_METHODS) {
    // export async function GET | export function GET
    const funcPattern = new RegExp(
      `export\\s+(async\\s+)?function\\s+${method}\\b`
    );
    // export const GET = | export const GET:
    const constPattern = new RegExp(
      `export\\s+const\\s+${method}\\s*[=:]`
    );
    // export { GET } or export { GET, POST }
    const reExportPattern = new RegExp(
      `export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`
    );

    if (funcPattern.test(fileContent) || constPattern.test(fileContent) || reExportPattern.test(fileContent)) {
      methods.push(method);
    }
  }

  return methods;
}

function detectValidation(fileContent: string): boolean {
  // Check for Zod usage patterns
  const zodPatterns = [
    /z\.\w+\(\)/,                    // z.object(), z.string(), etc.
    /\.parse\(/,                     // schema.parse(
    /\.safeParse\(/,                 // schema.safeParse(
    /import.*from\s+['"]zod['"]/,   // import from 'zod'
    /import.*from\s+['"]@\/.*schema/,// import from '@/...schema'
    /Schema\s*=\s*z\./,             // const XxxSchema = z.
  ];

  return zodPatterns.some((pattern) => pattern.test(fileContent));
}

function filePathToApiRoute(filePath: string, apiDir: string): string {
  const relative = path.relative(apiDir, path.dirname(filePath));
  const segments = relative === "" ? [] : relative.split(path.sep);
  // Convert directory params to Express-style: [id] -> :id, [...slug] -> *slug
  const routeSegments = segments.map((seg) => {
    if (/^\[\[\.\.\.(\w+)\]\]$/.test(seg)) return `:${seg.match(/^\[\[\.\.\.(\w+)\]\]$/)![1]}*`;
    if (/^\[\.\.\.(\w+)\]$/.test(seg)) return `:${seg.match(/^\[\.\.\.(\w+)\]$/)![1]}+`;
    if (/^\[(\w+)\]$/.test(seg)) return `:${seg.match(/^\[(\w+)\]$/)![1]}`;
    return seg;
  });
  return "/api/" + routeSegments.join("/");
}

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const apiDir = findApiDir(projectDir);
  if (!apiDir) {
    const result: ScanResult = {
      projectDir,
      apiDir: "",
      routes: [],
      totalRoutes: 0,
      totalEndpoints: 0,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.stderr.write("No app/api/ directory found. Is this a Next.js App Router project?\n");
    process.exit(0);
  }

  const routeFiles = findRouteFiles(apiDir);
  const routes: RouteInfo[] = [];

  for (const filePath of routeFiles) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      process.stderr.write(`Warning: could not read ${filePath}\n`);
      continue;
    }

    const methods = detectMethods(content);
    if (methods.length === 0) {
      process.stderr.write(`Warning: no HTTP methods found in ${filePath}\n`);
      continue;
    }

    const relativePath = path.relative(apiDir, path.dirname(filePath));
    const params = extractParamsFromPath(relativePath);
    const hasValidation = detectValidation(content);
    const routePath = filePathToApiRoute(filePath, apiDir);

    routes.push({
      path: routePath,
      filePath: path.relative(projectDir, filePath),
      methods,
      params,
      hasValidation,
    });
  }

  // Sort by path
  routes.sort((a, b) => a.path.localeCompare(b.path));

  const totalEndpoints = routes.reduce((sum, r) => sum + r.methods.length, 0);

  const result: ScanResult = {
    projectDir,
    apiDir: path.relative(projectDir, apiDir),
    routes,
    totalRoutes: routes.length,
    totalEndpoints,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human-readable summary to stderr
  process.stderr.write(`\n--- API Route Scan ---\n`);
  process.stderr.write(`Project: ${projectDir}\n`);
  process.stderr.write(`API dir: ${path.relative(projectDir, apiDir)}\n`);
  process.stderr.write(`Routes: ${routes.length} | Endpoints: ${totalEndpoints}\n\n`);

  for (const route of routes) {
    const methods = route.methods.join(", ");
    const params = route.params.length > 0
      ? ` [${route.params.map((p) => p.name + (p.catchAll ? "..." : "")).join(", ")}]`
      : "";
    const validation = route.hasValidation ? " (Zod)" : "";
    process.stderr.write(`  ${route.path} — ${methods}${params}${validation}\n`);
  }

  process.stderr.write(`\n`);
}

main();
