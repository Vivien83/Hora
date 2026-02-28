#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/scan-api-docs.ts [project-dir] [--format md|json]
// Scans API routes, extracts Zod schemas and JSDoc comments, generates documentation.
// Outputs structured JSON to stdout (always), human-readable progress to stderr.
// When --format md is given, also writes .hora/api-docs.md.

import * as fs from "node:fs";
import * as path from "node:path";

// --- Types ---

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type Framework = "nextjs-app" | "nextjs-pages" | "express" | "hono" | "unknown";
type OutputFormat = "md" | "json";

interface ZodField {
  name: string;
  type: string;
  optional: boolean;
}

interface ZodSchemaInfo {
  name: string;
  fields: ZodField[];
  raw: string;
}

interface RouteDoc {
  path: string;
  methods: HttpMethod[];
  file: string;
  description: string | null;
  auth: boolean;
  authMethod: string | null;
  requestSchema: ZodSchemaInfo | null;
  responseSchema: ZodSchemaInfo | null;
  queryParams: string[];
  statusCodes: number[];
  examples: { request?: string; response?: string } | null;
}

interface DocResult {
  generatedAt: string;
  projectDir: string;
  framework: Framework;
  routes: RouteDoc[];
  totalRoutes: number;
  totalEndpoints: number;
  routesWithAuth: number;
  routesWithZod: number;
  routesWithDescription: number;
}

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// --- Framework detection (same as scan-api.ts) ---

function detectFramework(projectDir: string): Framework {
  const appApiCandidates = [
    path.join(projectDir, "app", "api"),
    path.join(projectDir, "src", "app", "api"),
  ];
  const pagesApiCandidates = [
    path.join(projectDir, "pages", "api"),
    path.join(projectDir, "src", "pages", "api"),
  ];

  for (const d of appApiCandidates) {
    if (fs.existsSync(d)) return "nextjs-app";
  }
  for (const d of pagesApiCandidates) {
    if (fs.existsSync(d)) return "nextjs-pages";
  }

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
    } catch { /* ignore */ }
  }

  return "unknown";
}

// --- File walking ---

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

// --- Extractors ---

function extractJsDoc(content: string, handlerName?: string): string | null {
  // Find /** ... */ block immediately before the handler or export
  const jsdocPattern = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|default)|export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE))/g;
  let match: RegExpExecArray | null;

  while ((match = jsdocPattern.exec(content)) !== null) {
    const raw = match[1];
    // Strip leading * and whitespace from each line
    const lines = raw
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter((line) => !line.startsWith("@") && line.length > 0);
    if (lines.length > 0) return lines.join(" ");
  }

  // Single-line // comment before export
  const singleLinePattern = /\/\/\s*(.+)\n\s*export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)/g;
  const single = singleLinePattern.exec(content);
  if (single) return single[1].trim();

  return null;
}

function detectAuth(content: string): { auth: boolean; authMethod: string | null } {
  const authPatterns: [RegExp, string][] = [
    [/\bauth\(\)/g, "auth()"],
    [/\brequireAuth\b/g, "requireAuth"],
    [/\bwithAuth\b/g, "withAuth"],
    [/\bgetServerSession\b/g, "getServerSession"],
    [/\bverifyToken\b/g, "verifyToken"],
    [/\bAuthorization\b.*header/gi, "Authorization header"],
    [/Bearer\s+token/gi, "Bearer token"],
    [/middleware.*auth/gi, "auth middleware"],
  ];

  for (const [pattern, method] of authPatterns) {
    if (pattern.test(content)) {
      return { auth: true, authMethod: method };
    }
  }

  return { auth: false, authMethod: null };
}

function extractZodSchema(content: string, prefer: "request" | "response" | "any"): ZodSchemaInfo | null {
  // Find all z.object({...}) declarations
  const schemaPattern = /(?:const\s+(\w+)\s*=\s*)?z\.object\(\s*\{([^}]+)\}\s*\)/g;
  let match: RegExpExecArray | null;
  const schemas: ZodSchemaInfo[] = [];

  while ((match = schemaPattern.exec(content)) !== null) {
    const name = match[1] ?? "AnonymousSchema";
    const body = match[2];
    const fields = extractZodFields(body);
    schemas.push({ name, fields, raw: match[0] });
  }

  if (schemas.length === 0) return null;

  // Heuristic: pick the most relevant schema
  if (prefer === "request") {
    const req = schemas.find((s) => /[Bb]ody|[Rr]equest|[Ii]nput|[Pp]ayload/.test(s.name));
    if (req) return req;
  }
  if (prefer === "response") {
    const res = schemas.find((s) => /[Rr]esponse|[Oo]utput|[Rr]eturn/.test(s.name));
    if (res) return res;
  }

  return schemas[0] ?? null;
}

function extractZodFields(body: string): ZodField[] {
  const fieldPattern = /(\w+)\s*:\s*z\.(\w+)\(([^)]*)\)(\s*\.optional\(\))?/g;
  const fields: ZodField[] = [];
  let match: RegExpExecArray | null;

  while ((match = fieldPattern.exec(body)) !== null) {
    fields.push({
      name: match[1],
      type: match[2],
      optional: match[4] !== undefined && match[4].length > 0,
    });
  }

  return fields;
}

function extractQueryParams(content: string): string[] {
  const params: string[] = [];

  // Next.js: searchParams.get('param')
  const searchParamsPattern = /searchParams\.get\(['"](\w+)['"]\)/g;
  let match: RegExpExecArray | null;
  while ((match = searchParamsPattern.exec(content)) !== null) {
    params.push(match[1]);
  }

  // Express/Hono: req.query.param or req.query['param']
  const reqQueryPattern = /req\.query\.(\w+)|req\.query\[['"](\w+)['"]\]/g;
  while ((match = reqQueryPattern.exec(content)) !== null) {
    params.push(match[1] ?? match[2]);
  }

  return [...new Set(params)];
}

function extractStatusCodes(content: string): number[] {
  const codes = new Set<number>();

  // NextResponse.json(..., { status: 201 })
  const nextPattern = /status:\s*(\d{3})/g;
  let match: RegExpExecArray | null;
  while ((match = nextPattern.exec(content)) !== null) {
    codes.add(parseInt(match[1], 10));
  }

  // res.status(200).json(...)
  const expressPattern = /\.status\((\d{3})\)/g;
  while ((match = expressPattern.exec(content)) !== null) {
    codes.add(parseInt(match[1], 10));
  }

  // Default: 200
  if (codes.size === 0) codes.add(200);

  return [...codes].sort((a, b) => a - b);
}

function detectMethods(content: string): HttpMethod[] {
  const methods: HttpMethod[] = [];
  for (const method of HTTP_METHODS) {
    const funcPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    const constPattern = new RegExp(`export\\s+const\\s+${method}\\s*[=:]`);
    if (funcPattern.test(content) || constPattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}

function nextjsAppFilePath(filePath: string, apiDir: string): string {
  const rel = path.relative(apiDir, path.dirname(filePath));
  const segments = rel === "" ? [] : rel.split(path.sep);
  const converted = segments.map((seg) => {
    if (/^\[\[\.\.\.(\w+)\]\]$/.test(seg)) return `{...}`;
    if (/^\[\.\.\.(\w+)\]$/.test(seg)) return `{+}`;
    if (/^\[(\w+)\]$/.test(seg)) return `:${seg.match(/^\[(\w+)\]$/)![1]}`;
    return seg;
  });
  return "/api/" + converted.join("/");
}

// --- Scanners ---

function scanFile(filePath: string, projectDir: string, routePath: string): RouteDoc | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    process.stderr.write(`Warning: cannot read ${filePath}\n`);
    return null;
  }

  const methods = detectMethods(content);
  if (methods.length === 0 && !/export\s+default/.test(content)) return null;

  const description = extractJsDoc(content);
  const { auth, authMethod } = detectAuth(content);
  const queryParams = extractQueryParams(content);
  const statusCodes = extractStatusCodes(content);

  // For routes with POST/PUT/PATCH, extract request schema
  const hasMutating = methods.some((m) => ["POST", "PUT", "PATCH"].includes(m));
  const requestSchema = hasMutating ? extractZodSchema(content, "request") : null;
  const responseSchema = extractZodSchema(content, "response");

  return {
    path: routePath,
    methods: methods.length > 0 ? methods : ["GET", "POST"],
    file: path.relative(projectDir, filePath),
    description,
    auth,
    authMethod,
    requestSchema,
    responseSchema,
    queryParams,
    statusCodes,
    examples: null,
  };
}

function scanProject(projectDir: string): DocResult {
  const framework = detectFramework(projectDir);
  const routes: RouteDoc[] = [];

  process.stderr.write(`Scanning ${projectDir} (framework: ${framework})...\n`);

  if (framework === "nextjs-app") {
    const candidates = [
      path.join(projectDir, "app", "api"),
      path.join(projectDir, "src", "app", "api"),
    ];
    for (const apiDir of candidates) {
      if (!fs.existsSync(apiDir)) continue;
      const files = walkDir(apiDir, (name) => /^route\.(ts|js|tsx|jsx)$/.test(name));
      for (const file of files) {
        const routePath = nextjsAppFilePath(file, apiDir);
        process.stderr.write(`  Processing ${routePath}...\n`);
        const doc = scanFile(file, projectDir, routePath);
        if (doc) routes.push(doc);
      }
    }
  } else if (framework === "nextjs-pages") {
    const candidates = [
      path.join(projectDir, "pages", "api"),
      path.join(projectDir, "src", "pages", "api"),
    ];
    for (const apiDir of candidates) {
      if (!fs.existsSync(apiDir)) continue;
      const files = walkDir(apiDir, (name) => /\.(ts|js|tsx|jsx)$/.test(name));
      for (const file of files) {
        const rel = path.relative(apiDir, file).replace(/\.(ts|js|tsx|jsx)$/, "");
        const routePath = "/api/" + rel.split(path.sep).filter((s) => s !== "index").join("/");
        process.stderr.write(`  Processing ${routePath}...\n`);
        const doc = scanFile(file, projectDir, routePath);
        if (doc) routes.push(doc);
      }
    }
  } else {
    // Express/Hono: scan src/ and routes/ directories
    const srcDirs = ["src", "routes", "api", "server"].map((d) => path.join(projectDir, d));
    for (const srcDir of srcDirs) {
      if (!fs.existsSync(srcDir)) continue;
      const files = walkDir(srcDir, (name) => /\.(ts|js)$/.test(name));
      for (const file of files) {
        let content: string;
        try {
          content = fs.readFileSync(file, "utf-8");
        } catch { continue; }

        // Only process files that contain route definitions
        if (!/(?:app|router|server)\.(get|post|put|patch|delete)\s*\(/.test(content)) continue;

        const routePattern = /(?:app|router|server)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
        let match: RegExpExecArray | null;
        const pathsSeen = new Set<string>();

        while ((match = routePattern.exec(content)) !== null) {
          const routePath = match[2];
          if (pathsSeen.has(routePath)) continue;
          pathsSeen.add(routePath);

          process.stderr.write(`  Processing ${routePath}...\n`);
          const doc = scanFile(file, projectDir, routePath);
          if (doc) routes.push(doc);
        }
      }
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    generatedAt: new Date().toISOString(),
    projectDir,
    framework,
    routes,
    totalRoutes: routes.length,
    totalEndpoints: routes.reduce((s, r) => s + r.methods.length, 0),
    routesWithAuth: routes.filter((r) => r.auth).length,
    routesWithZod: routes.filter((r) => r.requestSchema !== null || r.responseSchema !== null).length,
    routesWithDescription: routes.filter((r) => r.description !== null).length,
  };
}

// --- Markdown generation ---

function zodSchemaToTypeString(schema: ZodSchemaInfo | null): string {
  if (!schema) return "unknown";
  if (schema.fields.length === 0) return "object";
  const fields = schema.fields
    .map((f) => `${f.name}${f.optional ? "?" : ""}: ${f.type}`)
    .join(", ");
  return `{ ${fields} }`;
}

function generateMarkdown(result: DocResult): string {
  const lines: string[] = [];

  lines.push("# API Documentation");
  lines.push(`> Auto-generated by hora-doc · ${new Date(result.generatedAt).toLocaleDateString("en-CA")}`);
  lines.push(`> Framework: ${result.framework} · ${result.totalRoutes} routes · ${result.totalEndpoints} endpoints`);
  lines.push("");

  if (result.routesWithAuth > 0) {
    lines.push(`> **Auth:** ${result.routesWithAuth} route(s) require authentication.`);
    lines.push("");
  }

  lines.push("## Endpoints");
  lines.push("");

  for (const route of result.routes) {
    for (const method of route.methods) {
      lines.push(`### ${method} ${route.path}`);
      lines.push("");

      if (route.description) {
        lines.push(route.description);
        lines.push("");
      }

      if (route.auth) {
        lines.push(`**Auth:** Required${route.authMethod ? ` (${route.authMethod})` : ""}`);
      }

      if (route.queryParams.length > 0) {
        lines.push(`**Query params:** \`${route.queryParams.join("\`, \`")}\``);
      }

      if (["POST", "PUT", "PATCH"].includes(method) && route.requestSchema) {
        lines.push(`**Body:** \`${zodSchemaToTypeString(route.requestSchema)}\``);
      }

      if (route.responseSchema) {
        lines.push(`**Response:** \`${zodSchemaToTypeString(route.responseSchema)}\``);
      } else if (method === "DELETE") {
        lines.push(`**Response:** \`{ message: string }\``);
      }

      if (route.statusCodes.length > 0) {
        lines.push(`**Status codes:** ${route.statusCodes.join(", ")}`);
      }

      lines.push(`**File:** \`${route.file}\``);
      lines.push("");
    }
  }

  if (result.routes.length === 0) {
    lines.push("_No routes detected. Make sure the project is a Next.js, Express or Hono project._");
  }

  return lines.join("\n");
}

// --- JSON/OpenAPI-like generation ---

function generateJson(result: DocResult): string {
  const paths: Record<string, unknown> = {};

  for (const route of result.routes) {
    paths[route.path] = {};
    const pathObj = paths[route.path] as Record<string, unknown>;

    for (const method of route.methods) {
      const operation: Record<string, unknown> = {};
      if (route.description) operation["description"] = route.description;
      if (route.auth) operation["security"] = [{ bearerAuth: [] }];
      if (route.queryParams.length > 0) {
        operation["parameters"] = route.queryParams.map((p) => ({
          name: p,
          in: "query",
          schema: { type: "string" },
        }));
      }
      if (["POST", "PUT", "PATCH"].includes(method) && route.requestSchema) {
        operation["requestBody"] = {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: Object.fromEntries(
                  route.requestSchema.fields.map((f) => [f.name, { type: f.type }])
                ),
              },
            },
          },
        };
      }
      operation["responses"] = Object.fromEntries(
        route.statusCodes.map((code) => [
          String(code),
          { description: code < 300 ? "Success" : code < 400 ? "Redirect" : "Error" },
        ])
      );
      pathObj[method.toLowerCase()] = operation;
    }
  }

  const openapi = {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description: `Auto-generated by hora-doc · ${result.generatedAt}`,
    },
    paths,
  };

  return JSON.stringify(openapi, null, 2);
}

// --- Main ---

function parseArgs(): { projectDir: string; format: OutputFormat; output: string } {
  const args = process.argv.slice(2);
  let projectDir = ".";
  let format: OutputFormat = "md";
  let output = path.join(".hora", "api-docs.md");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      format = (args[++i] === "json" ? "json" : "md") as OutputFormat;
      if (format === "json" && output === path.join(".hora", "api-docs.md")) {
        output = path.join(".hora", "openapi.json");
      }
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    } else if (!args[i].startsWith("--")) {
      projectDir = args[i];
    }
  }

  return { projectDir: path.resolve(projectDir), format, output };
}

function main(): void {
  const { projectDir, format, output } = parseArgs();

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const result = scanProject(projectDir);

  // Always write structured JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Generate formatted output
  const formatted = format === "json" ? generateJson(result) : generateMarkdown(result);

  if (output === "-") {
    process.stderr.write(formatted + "\n");
  } else {
    const absOutput = path.isAbsolute(output) ? output : path.join(projectDir, output);
    const dir = path.dirname(absOutput);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absOutput, formatted, "utf-8");
      process.stderr.write(`\nDoc written to: ${path.relative(projectDir, absOutput)}\n`);
    } catch (err) {
      process.stderr.write(`Warning: could not write output file: ${(err as Error).message}\n`);
    }
  }

  // Summary
  process.stderr.write(`\n--- hora-doc summary ---\n`);
  process.stderr.write(`Framework      : ${result.framework}\n`);
  process.stderr.write(`Routes         : ${result.totalRoutes}\n`);
  process.stderr.write(`Endpoints      : ${result.totalEndpoints}\n`);
  process.stderr.write(`With auth      : ${result.routesWithAuth}\n`);
  process.stderr.write(`With Zod       : ${result.routesWithZod}\n`);
  process.stderr.write(`With JSDoc     : ${result.routesWithDescription}\n`);

  const undocumented = result.routes.filter((r) => !r.description && !r.requestSchema && !r.responseSchema);
  if (undocumented.length > 0) {
    process.stderr.write(`\nRoutes without docs (add JSDoc or Zod schemas):\n`);
    for (const r of undocumented) {
      process.stderr.write(`  ${r.path}\n`);
    }
  }

  process.stderr.write("\n");
}

main();
