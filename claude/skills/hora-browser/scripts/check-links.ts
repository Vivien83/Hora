#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/check-links.ts <url> [--depth 2] [--timeout 5000]

import * as path from "path";

interface LinkResult {
  url: string;
  status: number | null;
  statusText: string;
  type: "internal" | "external";
  redirectChain: string[];
  error: string | null;
}

interface CrawlReport {
  baseUrl: string;
  crawledAt: string;
  depth: number;
  timeout: number;
  totalLinks: number;
  valid: number;
  redirected: number;
  broken: number;
  timedOut: number;
  errored: number;
  links: LinkResult[];
}

function parseArgs(args: string[]) {
  let url = "";
  let depth = 1;
  let timeout = 5000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--depth" && i + 1 < args.length) {
      depth = parseInt(args[i + 1], 10);
      if (isNaN(depth) || depth < 0 || depth > 5) {
        console.error("Depth must be between 0 and 5");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--timeout" && i + 1 < args.length) {
      timeout = parseInt(args[i + 1], 10);
      if (isNaN(timeout) || timeout < 1000) {
        console.error("Timeout must be at least 1000ms");
        process.exit(1);
      }
      i++;
    } else if (!url) {
      url = args[i];
    }
  }

  return { url, depth, timeout };
}

function validateUrl(input: string): URL {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
    return url;
  } catch {
    if (!input.includes("://")) {
      return validateUrl(`https://${input}`);
    }
    throw new Error(`Invalid URL: ${input}`);
  }
}

function isInternalLink(link: string, baseUrl: URL): boolean {
  try {
    const parsed = new URL(link, baseUrl.href);
    return parsed.hostname === baseUrl.hostname;
  } catch {
    return false;
  }
}

function normalizeUrl(link: string, baseUrl: URL): string | null {
  try {
    const parsed = new URL(link, baseUrl.href);
    // Skip non-http(s), mailto, tel, javascript, etc.
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    // Remove hash
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

async function checkLink(
  url: string,
  timeout: number
): Promise<LinkResult> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  const maxRedirects = 10;

  for (let i = 0; i < maxRedirects; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;

      // Follow redirects manually to track the chain
      if (status >= 300 && status < 400) {
        const location = response.headers.get("location");
        if (location) {
          redirectChain.push(currentUrl);
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }

      // Some servers reject HEAD, retry with GET
      if (status === 405) {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), timeout);

        const getResponse = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller2.signal,
        });

        clearTimeout(timeoutId2);

        return {
          url,
          status: getResponse.status,
          statusText: getResponse.statusText,
          type: "external", // will be overridden by caller
          redirectChain,
          error: null,
        };
      }

      return {
        url,
        status,
        statusText: response.statusText,
        type: "external",
        redirectChain,
        error: null,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          url,
          status: null,
          statusText: "timeout",
          type: "external",
          redirectChain,
          error: `Timeout after ${timeout}ms`,
        };
      }
      return {
        url,
        status: null,
        statusText: "error",
        type: "external",
        redirectChain,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    url,
    status: null,
    statusText: "too-many-redirects",
    type: "external",
    redirectChain,
    error: `Too many redirects (>${maxRedirects})`,
  };
}

async function extractLinks(
  pageUrl: string,
  timeout: number
): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(pageUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return [];

    const html = await response.text();

    // Extract href values from anchor tags
    const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push(match[1]);
    }

    return links;
  } catch {
    return [];
  }
}

async function crawl(
  startUrl: URL,
  maxDepth: number,
  timeout: number
): Promise<LinkResult[]> {
  const visited = new Set<string>();
  const results: LinkResult[] = [];
  const queue: Array<{ url: string; depth: number }> = [
    { url: startUrl.href, depth: 0 },
  ];

  while (queue.length > 0) {
    const batch = queue.splice(0, 10); // Process 10 at a time

    const batchPromises = batch.map(async ({ url: pageUrl, depth }) => {
      if (visited.has(pageUrl)) return;
      visited.add(pageUrl);

      // Extract links from this page
      const rawLinks = await extractLinks(pageUrl, timeout);
      const baseUrl = new URL(pageUrl);

      const normalizedLinks = rawLinks
        .map((link) => normalizeUrl(link, baseUrl))
        .filter((link): link is string => link !== null)
        .filter((link) => !visited.has(link));

      // Deduplicate within batch
      const uniqueLinks = [...new Set(normalizedLinks)];

      // Check each link
      const checkPromises = uniqueLinks.map(async (link) => {
        if (visited.has(link)) return;
        visited.add(link);

        const result = await checkLink(link, timeout);
        result.type = isInternalLink(link, startUrl)
          ? "internal"
          : "external";
        results.push(result);

        // Queue internal links for deeper crawling
        if (
          result.type === "internal" &&
          depth < maxDepth &&
          result.status !== null &&
          result.status >= 200 &&
          result.status < 400
        ) {
          queue.push({ url: link, depth: depth + 1 });
        }
      });

      await Promise.all(checkPromises);
    });

    await Promise.all(batchPromises);
  }

  return results;
}

async function main() {
  // Check Node version for native fetch
  const nodeVersion = parseInt(process.version.slice(1), 10);
  if (nodeVersion < 18) {
    console.error(
      `Node.js ${process.version} detected. This script requires Node 18+ for native fetch.\n` +
        `Current version: ${process.version}\n` +
        `Upgrade with: nvm install 20`
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: npx tsx check-links.ts <url> [--depth 2] [--timeout 5000]"
    );
    console.error("Example: npx tsx check-links.ts https://example.com");
    process.exit(1);
  }

  const { url, depth, timeout } = parseArgs(args);

  if (!url) {
    console.error("URL is required.");
    process.exit(1);
  }

  const baseUrl = validateUrl(url);

  console.error(`Crawling ${baseUrl.href} (depth: ${depth}, timeout: ${timeout}ms)...`);

  const links = await crawl(baseUrl, depth, timeout);

  const valid = links.filter(
    (l) => l.status !== null && l.status >= 200 && l.status < 300
  ).length;
  const redirected = links.filter(
    (l) => l.status !== null && l.status >= 300 && l.status < 400
  ).length;
  const broken = links.filter(
    (l) => l.status !== null && l.status >= 400
  ).length;
  const timedOut = links.filter(
    (l) => l.error !== null && l.error.includes("Timeout")
  ).length;
  const errored = links.filter(
    (l) => l.error !== null && !l.error.includes("Timeout")
  ).length;

  const report: CrawlReport = {
    baseUrl: baseUrl.href,
    crawledAt: new Date().toISOString(),
    depth,
    timeout,
    totalLinks: links.length,
    valid,
    redirected,
    broken,
    timedOut,
    errored,
    links: links.sort((a, b) => {
      // Broken first, then redirected, then valid
      const priority = (l: LinkResult) => {
        if (l.status === null) return 0;
        if (l.status >= 400) return 1;
        if (l.status >= 300) return 2;
        return 3;
      };
      return priority(a) - priority(b);
    }),
  };

  // Output JSON to stdout
  console.log(JSON.stringify(report, null, 2));

  // Summary to stderr
  console.error(`\nResults:`);
  console.error(`  Total:      ${links.length}`);
  console.error(`  Valid:      ${valid}`);
  console.error(`  Redirected: ${redirected}`);
  console.error(`  Broken:     ${broken}`);
  console.error(`  Timed out:  ${timedOut}`);
  console.error(`  Errored:    ${errored}`);

  if (broken > 0) {
    console.error(`\nBroken links:`);
    links
      .filter((l) => l.status !== null && l.status >= 400)
      .forEach((l) => {
        console.error(`  ${l.status} ${l.url}`);
      });
  }
}

main().catch((err) => {
  console.error(
    "Unexpected error:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
