import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { horaPlugin } from "./src/vite-hora-plugin";

// Project dir = parent of claude/dashboard (the HORA project root)
const projectDir = resolve(__dirname, "..", "..");

export default defineConfig({
  plugins: [react(), horaPlugin(projectDir)],
  server: { port: 3847 },
});
