#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/scan-api.ts [project-dir]
// Scans a project for API routes (Next.js App Router, Pages Router, Express, Hono).
// Outputs JSON to stdout, human-readable summary to stderr.

import * as fs from "node:fs";
import * as path from "node:path";

type Framework = "nextjs-app" | "nextjs-pages" | "express" | "hono" | "unknown";

interface RouteInfo {
  path: string;
  methods: string[];
  file: string;
  hasZodSchema: boolean;
  schemaName: string | null;
  framework: Framework;
}

interface ScanResult {
  framework: Framework;
  projectDir: string;
  routes: RouteInfo[];
  totalRoutes: number;
  totalEndpoints: number;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

// --- Framework detection ---

function detectFramework(projectDir: string): Framework {
  const appApiDir = [
    path.join(projectDir, "app", "api"),
    path.join(projectDir, "src", "app", "api"),
  ];
  const pagesApiDir = [
    path.join(projectDir, "pages", "api"),
    path.join(projectDir, "src", "pages", "api"),
  ];

  for (const d of appApiDir) {
    if (fs.existsSync(d)) return "nextjs-app";
  }
  for (const d of pagesApiDir) {
    if (fs.existsSync(d)) return "nextjs-pages";
  }

  // Check package.json for express/hono
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["hono"]) return "hono";
      if (deps["express"]) return "express";
    } catch {
      // ignore
    }
  }

  return "unknown";
}

// --- File walkers ---

function walkDir(dir: string, fileTest: (name: string) => boolean): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.isFile() && fileTest(entry.name)) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

// --- Next.js App Router ---

function scanNextjsApp(projectDir: string): RouteInfo[] {
  const candidates = [
    path.join(projectDir, "app", "api"),
    path.join(projectDir, "src", "app", "api"),
  ];

  let apiDir: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { apiDir = c; break; }
  }
  if (!apiDir) return [];

  const files = walkDir(apiDir, (name) => /^route\.(ts|js|tsx|jsx)$/.test(name));
  const routes: RouteInfo[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      process.stderr.write(`Warning: cannot read ${file}\n`);
      continue;
    }

    const methods = detectExportedMethods(content);
    if (methods.length === 0) continue;

    const routePath = nextjsAppFilePath(file, apiDir);
    const { hasZodSchema, schemaName } = detectZod(content);

    routes.push({
      path: routePath,
      methods,
      file: path.relative(projectDir, file),
      hasZodSchema,
      schemaName,
      framework: "nextjs-app",
    });
  }

  return routes;
}

function nextjsAppFilePath(filePath: string, apiDir: string): string {
  const rel = path.relative(apiDir, path.dirname(filePath));
  const segments = rel === "" ? [] : rel.split(path.sep);
  const converted = segments.map((seg) => {
    if (/^\[\[\.\.\.(\w+)\]\]$/.test(seg)) return `*`;
    if (/^\[\.\.\.(\w+)\]$/.test(seg)) return `+`;
    if (/^\[(\w+)\]$/.test(seg)) return `:${seg.match(/^\[(\w+)\]$/)![1]}`;
    return seg;
  });
  return "/api/" + converted.join("/");
}

// --- Next.js Pages Router ---

function scanNextjsPages(projectDir: string): RouteInfo[] {
  const candidates = [
    path.join(projectDir, "pages", "api"),
    path.join(projectDir, "src", "pages", "api"),
  ];

  let apiDir: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { apiDir = c; break; }
  }
  if (!apiDir) return [];

  const files = walkDir(apiDir, (name) => /\.(ts|js|tsx|jsx)$/.test(name));
  const routes: RouteInfo[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      process.stderr.write(`Warning: cannot read ${file}\n`);
      continue;
    }

    // Pages Router uses default export handlers; detect method filters via req.method
    const methods = detectPagesRouterMethods(content);
    const routePath = pagesFilePath(file, apiDir);
    const { hasZodSchema, schemaName } = detectZod(content);

    routes.push({
      path: routePath,
      methods,
      file: path.relative(projectDir, file),
      hasZodSchema,
      schemaName,
      framework: "nextjs-pages",
    });
  }

  return routes;
}

function pagesFilePath(filePath: string, apiDir: string): string {
  const rel = path.relative(apiDir, filePath);
  // Remove extension
  const noExt = rel.replace(/\.(ts|js|tsx|jsx)$/, "");
  const segments = noExt.split(path.sep);
  const converted = segments.map((seg) => {
    if (/^\[\.\.\.(\w+)\]$/.test(seg)) return `*`;
    if (/^\[(\w+)\]$/.test(seg)) return `:${seg.match(/^\[(\w+)\]$/)![1]}`;
    // Remove index
    if (seg === "index") return "";
    return seg;
  }).filter(Boolean);
  return "/api/" + converted.join("/");
}

function detectPagesRouterMethods(content: string): string[] {
  const methods: string[] = [];
  for (const method of HTTP_METHODS) {
    const pattern = new RegExp(`req\\.method\\s*(?:===|!==)\\s*['"]${method}['"]`);
    if (pattern.test(content)) {
      methods.push(method);
    }
  }
  // If no method filtering, assume it handles all (default to GET + POST)
  if (methods.length === 0 && /export\s+(default\s+)?function/.test(content)) {
    return ["GET", "POST"];
  }
  return methods;
}

// --- Express / Hono ---

function scanExpressHono(projectDir: string, framework: Framework): RouteInfo[] {
  const exts = /\.(ts|js|tsx|jsx)$/;
  const skipDirs = new Set(["node_modules", ".next", ".git", "dist", "build", ".hora"]);

  const files = walkDir(projectDir, (name) => exts.test(name));
  const routes: RouteInfo[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const fileRoutes = extractExpressRoutes(content, file, projectDir, framework);
    routes.push(...fileRoutes);
  }

  return routes;
}

function extractExpressRoutes(
  content: string,
  file: string,
  projectDir: string,
  framework: Framework
): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const { hasZodSchema, schemaName } = detectZod(content);

  // Match: app.get('/path', ...) | router.post('/path', ...) | app.route('/path').get(...)
  const routePattern = /(?:app|router|server)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(content)) !== null) {
    const httpMethod = match[1].toUpperCase();
    const routePath = match[2];
    routes.push({
      path: routePath,
      methods: [httpMethod === "ALL" ? "GET" : httpMethod],
      file: path.relative(projectDir, file),
      hasZodSchema,
      schemaName,
      framework,
    });
  }

  return routes;
}

// --- Common helpers ---

function detectExportedMethods(content: string): string[] {
  const methods: string[] = [];
  for (const method of HTTP_METHODS) {
    const funcPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    const constPattern = new RegExp(`export\\s+const\\s+${method}\\s*[=:]`);
    const reExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`);
    if (funcPattern.test(content) || constPattern.test(content) || reExportPattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}

function detectZod(content: string): { hasZodSchema: boolean; schemaName: string | null } {
  const zodImport = /import\s+.*from\s+['"]zod['"]/;
  const schemaDecl = /const\s+(\w*[Ss]chema\w*)\s*=\s*z\./;

  if (!zodImport.test(content)) {
    return { hasZodSchema: false, schemaName: null };
  }

  const match = content.match(schemaDecl);
  return {
    hasZodSchema: true,
    schemaName: match ? match[1] : null,
  };
}

// --- Main ---

function main(): void {
  const projectDir = path.resolve(process.argv[2] ?? ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`Scanning ${projectDir}...\n`);

  const framework = detectFramework(projectDir);
  process.stderr.write(`Framework detected: ${framework}\n`);

  let routes: RouteInfo[] = [];

  switch (framework) {
    case "nextjs-app":
      routes = scanNextjsApp(projectDir);
      break;
    case "nextjs-pages":
      routes = scanNextjsPages(projectDir);
      break;
    case "express":
    case "hono":
      routes = scanExpressHono(projectDir, framework);
      break;
    default:
      // Try all
      routes = [
        ...scanNextjsApp(projectDir),
        ...scanNextjsPages(projectDir),
        ...scanExpressHono(projectDir, "unknown"),
      ];
      break;
  }

  // Deduplicate by path+method
  const seen = new Set<string>();
  routes = routes.filter((r) => {
    const key = `${r.path}:${r.methods.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  routes.sort((a, b) => a.path.localeCompare(b.path));

  const totalEndpoints = routes.reduce((sum, r) => sum + r.methods.length, 0);

  const result: ScanResult = {
    framework,
    projectDir,
    routes,
    totalRoutes: routes.length,
    totalEndpoints,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human-readable summary
  process.stderr.write(`\n--- hora-mock scan ---\n`);
  process.stderr.write(`Framework : ${framework}\n`);
  process.stderr.write(`Routes    : ${routes.length} | Endpoints: ${totalEndpoints}\n\n`);

  for (const route of routes) {
    const methods = route.methods.join(", ");
    const zod = route.hasZodSchema ? ` [Zod: ${route.schemaName ?? "detected"}]` : "";
    process.stderr.write(`  ${route.path.padEnd(40)} ${methods}${zod}\n`);
  }

  if (routes.length === 0) {
    process.stderr.write("  (no routes found — try specifying a different directory)\n");
  }

  process.stderr.write("\n");
}

main();
