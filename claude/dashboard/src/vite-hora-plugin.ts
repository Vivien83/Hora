/**
 * Vite plugin for HORA real-time dashboard.
 * Watches MEMORY and project .hora directories, pushes updates via HMR.
 */

import type { Plugin, ViteDevServer } from "vite";
import { watch } from "chokidar";
import { homedir } from "os";
import { join } from "path";
import { collectAll } from "../lib/collectors";

const MEMORY_DIR = join(homedir(), ".claude", "MEMORY");
const DEBOUNCE_MS = 500;

export function horaPlugin(projectDir: string): Plugin {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let server: ViteDevServer | null = null;

  function pushUpdate() {
    if (!server) return;
    try {
      const data = collectAll(projectDir);
      server.hot.send("hora:update", data);
    } catch (e) {
      console.error("[hora] collect error:", e);
    }
  }

  function debouncedPush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(pushUpdate, DEBOUNCE_MS);
  }

  return {
    name: "vite-hora-plugin",

    configureServer(srv) {
      server = srv;

      // Serve /api/hora-data for initial fetch
      srv.middlewares.use("/api/hora-data", (_req, res) => {
        try {
          const data = collectAll(projectDir);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // Watch MEMORY dir and project .hora dir
      const horaDir = join(projectDir, ".hora");
      const watcher = watch([MEMORY_DIR, horaDir], {
        ignoreInitial: true,
        ignored: [/\.DS_Store$/, /node_modules/],
        depth: 5,
      });

      watcher.on("all", debouncedPush);

      // Cleanup on server close
      srv.httpServer?.on("close", () => {
        watcher.close();
        if (timer) clearTimeout(timer);
      });
    },
  };
}
