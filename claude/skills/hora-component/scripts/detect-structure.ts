#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/detect-structure.ts [project-dir]
// Detects the component structure of a React/Next.js project.
// Outputs JSON to stdout, human-readable summary to stderr.

import * as fs from "node:fs";
import * as path from "node:path";

interface StructureResult {
  projectDir: string;
  componentDir: string | null;
  convention: "pascal-dirs" | "flat-files" | "mixed" | "unknown";
  hasTests: boolean;
  testPattern: string | null;
  hasShadcn: boolean;
  shadcnDir: string | null;
  hasTailwind: boolean;
  tailwindConfig: string | null;
  hasStorybook: boolean;
  framework: "next-app" | "next-pages" | "vite" | "cra" | "unknown";
  componentCount: number;
}

function detectFramework(projectDir: string): StructureResult["framework"] {
  // Check for Next.js App Router
  if (
    fs.existsSync(path.join(projectDir, "app")) ||
    fs.existsSync(path.join(projectDir, "src", "app"))
  ) {
    // Verify it's Next.js (not just any app dir)
    const pkgPath = path.join(projectDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps["next"]) {
          // Check for app dir vs pages dir
          if (
            fs.existsSync(path.join(projectDir, "app")) ||
            fs.existsSync(path.join(projectDir, "src", "app"))
          ) {
            return "next-app";
          }
          return "next-pages";
        }
      } catch {
        // ignore
      }
    }
  }

  // Check for pages dir (Next.js Pages Router)
  if (
    fs.existsSync(path.join(projectDir, "pages")) ||
    fs.existsSync(path.join(projectDir, "src", "pages"))
  ) {
    return "next-pages";
  }

  // Check for Vite
  if (
    fs.existsSync(path.join(projectDir, "vite.config.ts")) ||
    fs.existsSync(path.join(projectDir, "vite.config.js"))
  ) {
    return "vite";
  }

  // Check for CRA
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["react-scripts"]) return "cra";
    } catch {
      // ignore
    }
  }

  return "unknown";
}

function findComponentDir(projectDir: string): string | null {
  const candidates = [
    path.join(projectDir, "src", "components"),
    path.join(projectDir, "components"),
    path.join(projectDir, "app", "components"),
    path.join(projectDir, "src", "app", "components"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

function detectConvention(componentDir: string): {
  convention: StructureResult["convention"];
  componentCount: number;
} {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(componentDir, { withFileTypes: true });
  } catch {
    return { convention: "unknown", componentCount: 0 };
  }

  let pascalDirs = 0;
  let flatFiles = 0;
  let componentCount = 0;

  for (const entry of entries) {
    // Skip ui/ directory (shadcn)
    if (entry.name === "ui") continue;

    if (entry.isDirectory() && /^[A-Z]/.test(entry.name)) {
      pascalDirs++;
      componentCount++;
    } else if (entry.isFile() && /^[A-Z].*\.(tsx|jsx)$/.test(entry.name)) {
      flatFiles++;
      componentCount++;
    }
  }

  if (pascalDirs > 0 && flatFiles === 0) return { convention: "pascal-dirs", componentCount };
  if (flatFiles > 0 && pascalDirs === 0) return { convention: "flat-files", componentCount };
  if (pascalDirs > 0 && flatFiles > 0) return { convention: "mixed", componentCount };
  return { convention: "unknown", componentCount };
}

function hasTestFiles(componentDir: string): { hasTests: boolean; testPattern: string | null } {
  function walk(dir: string): string | null {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = walk(path.join(dir, entry.name));
        if (result) return result;
      } else if (entry.isFile()) {
        if (/\.test\.(tsx|ts|jsx|js)$/.test(entry.name)) return ".test.tsx";
        if (/\.spec\.(tsx|ts|jsx|js)$/.test(entry.name)) return ".spec.tsx";
        if (entry.name === "__tests__") return "__tests__/";
      }
    }
    return null;
  }

  const pattern = walk(componentDir);
  return { hasTests: pattern !== null, testPattern: pattern };
}

function detectShadcn(projectDir: string, componentDir: string | null): {
  hasShadcn: boolean;
  shadcnDir: string | null;
} {
  // Check for components.json (shadcn config)
  const hasConfig = fs.existsSync(path.join(projectDir, "components.json"));

  // Check for ui/ directory in component dir
  if (componentDir) {
    const uiDir = path.join(componentDir, "ui");
    if (fs.existsSync(uiDir) && fs.statSync(uiDir).isDirectory()) {
      return { hasShadcn: true, shadcnDir: path.relative(projectDir, uiDir) };
    }
  }

  // Check common locations
  const candidates = [
    path.join(projectDir, "src", "components", "ui"),
    path.join(projectDir, "components", "ui"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return { hasShadcn: true, shadcnDir: path.relative(projectDir, candidate) };
    }
  }

  return { hasShadcn: hasConfig, shadcnDir: null };
}

function detectTailwind(projectDir: string): {
  hasTailwind: boolean;
  tailwindConfig: string | null;
} {
  const candidates = [
    "tailwind.config.ts",
    "tailwind.config.js",
    "tailwind.config.mjs",
    "tailwind.config.cjs",
  ];

  for (const candidate of candidates) {
    const filePath = path.join(projectDir, candidate);
    if (fs.existsSync(filePath)) {
      return { hasTailwind: true, tailwindConfig: candidate };
    }
  }

  // Check postcss.config for tailwindcss plugin
  const postcssConfigs = ["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs"];
  for (const config of postcssConfigs) {
    const filePath = path.join(projectDir, config);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("tailwindcss")) {
          return { hasTailwind: true, tailwindConfig: config + " (postcss)" };
        }
      } catch {
        // ignore
      }
    }
  }

  // Check package.json for tailwindcss dependency
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["tailwindcss"]) {
        // Tailwind v4 might not have a config file
        return { hasTailwind: true, tailwindConfig: "package.json (v4 css-based)" };
      }
    } catch {
      // ignore
    }
  }

  return { hasTailwind: false, tailwindConfig: null };
}

function detectStorybook(projectDir: string): boolean {
  return (
    fs.existsSync(path.join(projectDir, ".storybook")) ||
    fs.existsSync(path.join(projectDir, "storybook"))
  );
}

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const componentDir = findComponentDir(projectDir);
  const framework = detectFramework(projectDir);

  let convention: StructureResult["convention"] = "unknown";
  let componentCount = 0;
  let testInfo = { hasTests: false, testPattern: null as string | null };

  if (componentDir) {
    const convResult = detectConvention(componentDir);
    convention = convResult.convention;
    componentCount = convResult.componentCount;
    testInfo = hasTestFiles(componentDir);
  }

  const shadcn = detectShadcn(projectDir, componentDir);
  const tailwind = detectTailwind(projectDir);
  const hasStorybook = detectStorybook(projectDir);

  const result: StructureResult = {
    projectDir,
    componentDir: componentDir ? path.relative(projectDir, componentDir) : null,
    convention,
    hasTests: testInfo.hasTests,
    testPattern: testInfo.testPattern,
    hasShadcn: shadcn.hasShadcn,
    shadcnDir: shadcn.shadcnDir,
    hasTailwind: tailwind.hasTailwind,
    tailwindConfig: tailwind.tailwindConfig,
    hasStorybook,
    framework,
    componentCount,
  };

  // JSON output to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human-readable to stderr
  process.stderr.write(`\n--- Component Structure ---\n`);
  process.stderr.write(`Project: ${projectDir}\n`);
  process.stderr.write(`Framework: ${framework}\n`);
  process.stderr.write(`Component dir: ${result.componentDir || "not found"}\n`);
  process.stderr.write(`Convention: ${convention}\n`);
  process.stderr.write(`Components: ${componentCount}\n`);
  process.stderr.write(`Tests: ${testInfo.hasTests ? `yes (${testInfo.testPattern})` : "no"}\n`);
  process.stderr.write(`shadcn/ui: ${shadcn.hasShadcn ? `yes (${shadcn.shadcnDir || "config only"})` : "no"}\n`);
  process.stderr.write(`Tailwind: ${tailwind.hasTailwind ? `yes (${tailwind.tailwindConfig})` : "no"}\n`);
  process.stderr.write(`Storybook: ${hasStorybook ? "yes" : "no"}\n`);
  process.stderr.write(`\n`);
}

main();
