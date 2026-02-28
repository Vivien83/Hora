#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/test-endpoint.ts <url> [--method POST] [--body '{"key":"value"}'] [--header 'Authorization: Bearer xxx'] [--timeout 5000]
// Tests a single API endpoint and reports results.
// Outputs JSON to stdout, human-readable to stderr.

import * as path from "node:path";

interface TestResult {
  url: string;
  method: string;
  status: number | null;
  statusText: string;
  timing: number;
  headers: Record<string, string>;
  contentType: string | null;
  bodyShape: string | null;
  bodyPreview: string | null;
  bodySize: number;
  passed: boolean;
  error: string | null;
}

function parseArgs(args: string[]): {
  url: string;
  method: string;
  body: string | undefined;
  headers: Record<string, string>;
  timeout: number;
} {
  const result = {
    url: "",
    method: "GET",
    body: undefined as string | undefined,
    headers: {} as Record<string, string>,
    timeout: 5000,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--method" && i + 1 < args.length) {
      result.method = args[++i].toUpperCase();
    } else if (arg === "--body" && i + 1 < args.length) {
      result.body = args[++i];
    } else if (arg === "--header" && i + 1 < args.length) {
      const headerStr = args[++i];
      const colonIndex = headerStr.indexOf(":");
      if (colonIndex > 0) {
        const key = headerStr.slice(0, colonIndex).trim();
        const value = headerStr.slice(colonIndex + 1).trim();
        result.headers[key] = value;
      }
    } else if (arg === "--timeout" && i + 1 < args.length) {
      result.timeout = parseInt(args[++i], 10) || 5000;
    } else if (!arg.startsWith("--") && !result.url) {
      result.url = arg;
    }

    i++;
  }

  return result;
}

function describeShape(value: unknown, depth = 0): string {
  if (depth > 3) return "...";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${describeShape(value[0], depth + 1)}] (${value.length} items)`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return "{}";
    if (keys.length > 8) return `{ ${keys.slice(0, 5).join(", ")}, ... } (${keys.length} keys)`;
    const entries = keys.map((k) => `${k}: ${describeShape((value as Record<string, unknown>)[k], depth + 1)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return typeof value;
}

async function main(): Promise<void> {
  const scriptArgs = process.argv.slice(2);

  if (scriptArgs.length === 0) {
    process.stderr.write("Usage: npx tsx test-endpoint.ts <url> [--method POST] [--body '{...}'] [--header 'K: V'] [--timeout 5000]\n");
    process.exit(1);
  }

  const { url, method, body, headers, timeout } = parseArgs(scriptArgs);

  if (!url) {
    process.stderr.write("Error: URL is required\n");
    process.exit(1);
  }

  const result: TestResult = {
    url,
    method,
    status: null,
    statusText: "",
    timing: 0,
    headers: {},
    contentType: null,
    bodyShape: null,
    bodyPreview: null,
    bodySize: 0,
    passed: false,
    error: null,
  };

  // Set Content-Type for body requests if not set
  if (body && !headers["Content-Type"] && !headers["content-type"]) {
    try {
      JSON.parse(body);
      headers["Content-Type"] = "application/json";
    } catch {
      // Not JSON, leave Content-Type unset
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = performance.now();

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && method !== "GET" && method !== "HEAD") {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const endTime = performance.now();
    result.timing = Math.round(endTime - startTime);

    result.status = response.status;
    result.statusText = response.statusText;
    result.contentType = response.headers.get("content-type");

    // Collect response headers
    response.headers.forEach((value, key) => {
      result.headers[key] = value;
    });

    // Read body
    const responseText = await response.text();
    result.bodySize = responseText.length;

    // Try to parse as JSON
    try {
      const jsonBody = JSON.parse(responseText);
      result.bodyShape = describeShape(jsonBody);
      result.bodyPreview = responseText.length > 500
        ? responseText.slice(0, 500) + "..."
        : responseText;
    } catch {
      result.bodyShape = `text (${responseText.length} chars)`;
      result.bodyPreview = responseText.length > 200
        ? responseText.slice(0, 200) + "..."
        : responseText;
    }

    // Determine pass/fail
    result.passed = response.status >= 200 && response.status < 500;

  } catch (err: unknown) {
    const endTime = performance.now();
    result.timing = Math.round(endTime - startTime);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        result.error = `Timeout after ${timeout}ms`;
      } else {
        result.error = err.message;
      }
    } else {
      result.error = String(err);
    }
    result.passed = false;
  } finally {
    clearTimeout(timeoutId);
  }

  // JSON output to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human-readable to stderr
  const statusIcon = result.passed ? "PASS" : "FAIL";
  process.stderr.write(`\n[${statusIcon}] ${method} ${url}\n`);
  if (result.status !== null) {
    process.stderr.write(`  Status: ${result.status} ${result.statusText}\n`);
  }
  process.stderr.write(`  Timing: ${result.timing}ms\n`);
  if (result.contentType) {
    process.stderr.write(`  Content-Type: ${result.contentType}\n`);
  }
  if (result.bodyShape) {
    process.stderr.write(`  Body: ${result.bodyShape}\n`);
  }
  if (result.error) {
    process.stderr.write(`  Error: ${result.error}\n`);
  }
  process.stderr.write(`\n`);

  process.exit(result.passed ? 0 : 1);
}

main();
