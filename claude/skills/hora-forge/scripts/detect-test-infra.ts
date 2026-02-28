#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/detect-test-infra.ts [project-dir]

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface TestInfraReport {
  projectDir: string;
  testFramework: {
    name: string | null;
    configFile: string | null;
    detected: boolean;
  };
  testRunner: {
    playwright: { detected: boolean; configFile: string | null };
    cypress: { detected: boolean; configFile: string | null };
  };
  coverage: {
    tool: string | null;
    detected: boolean;
  };
  linter: {
    name: string | null;
    configFile: string | null;
    detected: boolean;
  };
  typescript: {
    detected: boolean;
    strict: boolean | null;
    configFile: string | null;
  };
  testFiles: {
    count: number;
    patterns: string[];
    directories: string[];
  };
  scripts: Record<string, string>;
  recommendations: string[];
}

// --- Helpers ---

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function countTestFiles(dir: string): {
  count: number;
  patterns: Set<string>;
  directories: Set<string>;
} {
  const result = { count: 0, patterns: new Set<string>(), directories: new Set<string>() };
  const skipDirs = new Set(["node_modules", ".next", "dist", ".git", ".hora"]);

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (skipDirs.has(entry.name)) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "__tests__" ||
          entry.name === "tests" ||
          entry.name === "test" ||
          entry.name === "__mocks__"
        ) {
          result.directories.add(path.relative(dir, fullPath));
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name;
        if (
          name.endsWith(".test.ts") ||
          name.endsWith(".test.tsx") ||
          name.endsWith(".test.js") ||
          name.endsWith(".test.jsx") ||
          name.endsWith(".spec.ts") ||
          name.endsWith(".spec.tsx") ||
          name.endsWith(".spec.js") ||
          name.endsWith(".spec.jsx")
        ) {
          result.count++;
          const ext = name.match(/\.(test|spec)\.\w+$/);
          if (ext) result.patterns.add(`*.${ext[0].slice(1)}`);
        }
      }
    }
  }

  walk(dir);
  return result;
}

function detectTestFramework(
  projectDir: string,
  pkg: Record<string, unknown> | null
): TestInfraReport["testFramework"] {
  // Vitest
  const vitestConfigs = [
    "vitest.config.ts",
    "vitest.config.js",
    "vitest.config.mts",
    "vitest.config.mjs",
  ];
  for (const config of vitestConfigs) {
    const p = path.join(projectDir, config);
    if (fileExists(p)) {
      return { name: "vitest", configFile: config, detected: true };
    }
  }

  // Check vite.config for vitest plugin
  const viteConfigs = ["vite.config.ts", "vite.config.js", "vite.config.mts"];
  for (const config of viteConfigs) {
    const p = path.join(projectDir, config);
    const content = readText(p);
    if (content && content.includes("vitest")) {
      return { name: "vitest", configFile: config, detected: true };
    }
  }

  // Jest
  const jestConfigs = [
    "jest.config.ts",
    "jest.config.js",
    "jest.config.mjs",
    "jest.config.cjs",
    "jest.config.json",
  ];
  for (const config of jestConfigs) {
    const p = path.join(projectDir, config);
    if (fileExists(p)) {
      return { name: "jest", configFile: config, detected: true };
    }
  }

  // Jest in package.json
  if (pkg && (pkg as Record<string, unknown>).jest) {
    return { name: "jest", configFile: "package.json (jest key)", detected: true };
  }

  // Check devDependencies
  const devDeps = (pkg?.devDependencies || {}) as Record<string, string>;
  const deps = (pkg?.dependencies || {}) as Record<string, string>;
  if (devDeps.vitest || deps.vitest) {
    return { name: "vitest", configFile: null, detected: true };
  }
  if (devDeps.jest || deps.jest) {
    return { name: "jest", configFile: null, detected: true };
  }

  return { name: null, configFile: null, detected: false };
}

function detectE2eRunner(
  projectDir: string
): TestInfraReport["testRunner"] {
  const result: TestInfraReport["testRunner"] = {
    playwright: { detected: false, configFile: null },
    cypress: { detected: false, configFile: null },
  };

  const pwConfigs = [
    "playwright.config.ts",
    "playwright.config.js",
    "playwright.config.mts",
  ];
  for (const config of pwConfigs) {
    if (fileExists(path.join(projectDir, config))) {
      result.playwright = { detected: true, configFile: config };
      break;
    }
  }

  const cyConfigs = [
    "cypress.config.ts",
    "cypress.config.js",
    "cypress.config.mjs",
    "cypress.json",
  ];
  for (const config of cyConfigs) {
    if (fileExists(path.join(projectDir, config))) {
      result.cypress = { detected: true, configFile: config };
      break;
    }
  }

  return result;
}

function detectCoverage(
  projectDir: string,
  testFramework: string | null,
  pkg: Record<string, unknown> | null
): TestInfraReport["coverage"] {
  // Check vitest config for coverage
  if (testFramework === "vitest") {
    const configs = ["vitest.config.ts", "vitest.config.js"];
    for (const config of configs) {
      const content = readText(path.join(projectDir, config));
      if (content) {
        if (content.includes("v8")) return { tool: "v8", detected: true };
        if (content.includes("istanbul"))
          return { tool: "istanbul", detected: true };
        if (content.includes("c8")) return { tool: "c8", detected: true };
        if (content.includes("coverage"))
          return { tool: "v8 (default)", detected: true };
      }
    }
  }

  // Check jest config for coverage
  if (testFramework === "jest") {
    const jestConfig =
      readText(path.join(projectDir, "jest.config.ts")) ||
      readText(path.join(projectDir, "jest.config.js"));
    if (jestConfig && jestConfig.includes("coverage")) {
      return { tool: "istanbul (jest default)", detected: true };
    }
  }

  // Check package.json scripts
  const scripts = ((pkg?.scripts || {}) as Record<string, string>);
  for (const [, cmd] of Object.entries(scripts)) {
    if (cmd.includes("--coverage") || cmd.includes("c8") || cmd.includes("nyc")) {
      return { tool: "detected in scripts", detected: true };
    }
  }

  // Check devDependencies
  const devDeps = (pkg?.devDependencies || {}) as Record<string, string>;
  if (devDeps.c8) return { tool: "c8", detected: true };
  if (devDeps.nyc) return { tool: "istanbul/nyc", detected: true };
  if (devDeps["@vitest/coverage-v8"])
    return { tool: "v8 (@vitest/coverage-v8)", detected: true };
  if (devDeps["@vitest/coverage-istanbul"])
    return { tool: "istanbul (@vitest/coverage-istanbul)", detected: true };

  return { tool: null, detected: false };
}

function detectLinter(
  projectDir: string,
  pkg: Record<string, unknown> | null
): TestInfraReport["linter"] {
  // ESLint flat config
  const eslintFlat = [
    "eslint.config.ts",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
  ];
  for (const config of eslintFlat) {
    if (fileExists(path.join(projectDir, config))) {
      return { name: "eslint", configFile: config, detected: true };
    }
  }

  // ESLint legacy
  const eslintLegacy = [
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    ".eslintrc",
  ];
  for (const config of eslintLegacy) {
    if (fileExists(path.join(projectDir, config))) {
      return { name: "eslint", configFile: config, detected: true };
    }
  }

  // ESLint in package.json
  if (pkg && (pkg as Record<string, unknown>).eslintConfig) {
    return {
      name: "eslint",
      configFile: "package.json (eslintConfig key)",
      detected: true,
    };
  }

  // Biome
  if (fileExists(path.join(projectDir, "biome.json")) || fileExists(path.join(projectDir, "biome.jsonc"))) {
    const configFile = fileExists(path.join(projectDir, "biome.json"))
      ? "biome.json"
      : "biome.jsonc";
    return { name: "biome", configFile, detected: true };
  }

  return { name: null, configFile: null, detected: false };
}

function detectTypeScript(
  projectDir: string
): TestInfraReport["typescript"] {
  const tsconfigPath = path.join(projectDir, "tsconfig.json");
  if (!fileExists(tsconfigPath)) {
    return { detected: false, strict: null, configFile: null };
  }

  const tsconfig = readJson(tsconfigPath);
  let strict: boolean | null = null;

  if (tsconfig) {
    const compilerOptions = tsconfig.compilerOptions as
      | Record<string, unknown>
      | undefined;
    if (compilerOptions) {
      strict = compilerOptions.strict === true;
    }
  }

  return { detected: true, strict, configFile: "tsconfig.json" };
}

function detectScripts(
  pkg: Record<string, unknown> | null
): Record<string, string> {
  if (!pkg || !pkg.scripts) return {};

  const allScripts = pkg.scripts as Record<string, string>;
  const testRelated: Record<string, string> = {};

  const keywords = [
    "test",
    "spec",
    "e2e",
    "lint",
    "check",
    "typecheck",
    "type-check",
    "coverage",
    "ci",
    "validate",
  ];

  for (const [name, cmd] of Object.entries(allScripts)) {
    if (keywords.some((kw) => name.toLowerCase().includes(kw))) {
      testRelated[name] = cmd;
    }
  }

  return testRelated;
}

function generateRecommendations(report: TestInfraReport): string[] {
  const recs: string[] = [];

  if (!report.testFramework.detected) {
    recs.push(
      "No test framework detected. Consider adding Vitest for fast TypeScript testing."
    );
  }

  if (
    !report.testRunner.playwright.detected &&
    !report.testRunner.cypress.detected
  ) {
    recs.push(
      "No E2E test runner detected. Consider adding Playwright for end-to-end testing."
    );
  }

  if (!report.coverage.detected) {
    recs.push(
      "No coverage tool detected. Enable coverage reporting in your test framework."
    );
  }

  if (!report.linter.detected) {
    recs.push(
      "No linter detected. Consider adding ESLint or Biome for code quality."
    );
  }

  if (report.typescript.detected && report.typescript.strict === false) {
    recs.push(
      'TypeScript strict mode is not enabled. Set "strict": true in tsconfig.json.'
    );
  }

  if (!report.typescript.detected) {
    recs.push("No tsconfig.json found. Consider using TypeScript for type safety.");
  }

  if (report.testFiles.count === 0) {
    recs.push("No test files found. Start by adding tests for critical business logic.");
  }

  const scripts = Object.keys(report.scripts);
  if (!scripts.some((s) => s.includes("test"))) {
    recs.push(
      'No "test" script in package.json. Add one for easy test execution.'
    );
  }

  if (!scripts.some((s) => s.includes("lint"))) {
    recs.push(
      'No "lint" script in package.json. Add one for easy linting.'
    );
  }

  return recs;
}

// --- Main ---

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`Detecting test infrastructure: ${projectDir}\n`);

  const pkgPath = path.join(projectDir, "package.json");
  const pkg = readJson(pkgPath);

  if (!pkg) {
    process.stderr.write(`Warning: no package.json found at ${pkgPath}\n`);
  }

  const testFramework = detectTestFramework(projectDir, pkg);
  const testRunner = detectE2eRunner(projectDir);
  const coverage = detectCoverage(projectDir, testFramework.name, pkg);
  const linter = detectLinter(projectDir, pkg);
  const typescript = detectTypeScript(projectDir);
  const scripts = detectScripts(pkg);

  const testFileInfo = countTestFiles(projectDir);

  const report: TestInfraReport = {
    projectDir,
    testFramework,
    testRunner,
    coverage,
    linter,
    typescript,
    testFiles: {
      count: testFileInfo.count,
      patterns: [...testFileInfo.patterns],
      directories: [...testFileInfo.directories],
    },
    scripts,
    recommendations: [],
  };

  report.recommendations = generateRecommendations(report);

  // JSON to stdout
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  // Human summary to stderr
  process.stderr.write(`\n--- Test Infrastructure Report ---\n`);
  process.stderr.write(
    `Test framework: ${testFramework.detected ? `${testFramework.name} (${testFramework.configFile})` : "not detected"}\n`
  );
  process.stderr.write(
    `Playwright: ${testRunner.playwright.detected ? `yes (${testRunner.playwright.configFile})` : "no"}\n`
  );
  process.stderr.write(
    `Cypress: ${testRunner.cypress.detected ? `yes (${testRunner.cypress.configFile})` : "no"}\n`
  );
  process.stderr.write(
    `Coverage: ${coverage.detected ? coverage.tool : "not detected"}\n`
  );
  process.stderr.write(
    `Linter: ${linter.detected ? `${linter.name} (${linter.configFile})` : "not detected"}\n`
  );
  process.stderr.write(
    `TypeScript: ${typescript.detected ? `yes, strict=${typescript.strict}` : "no"}\n`
  );
  process.stderr.write(`Test files: ${testFileInfo.count}\n`);
  if (testFileInfo.patterns.size > 0) {
    process.stderr.write(
      `Test patterns: ${[...testFileInfo.patterns].join(", ")}\n`
    );
  }
  if (testFileInfo.directories.size > 0) {
    process.stderr.write(
      `Test directories: ${[...testFileInfo.directories].join(", ")}\n`
    );
  }
  if (Object.keys(scripts).length > 0) {
    process.stderr.write(`Test-related scripts:\n`);
    for (const [name, cmd] of Object.entries(scripts)) {
      process.stderr.write(`  ${name}: ${cmd}\n`);
    }
  }

  if (report.recommendations.length > 0) {
    process.stderr.write(`\nRecommendations:\n`);
    for (const rec of report.recommendations) {
      process.stderr.write(`  - ${rec}\n`);
    }
  }
}

main();
