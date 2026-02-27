import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { homedir } from "os";
import { horaPlugin } from "./src/vite-hora-plugin";

// Project dir from env (set by hora.sh) or fallback to home
const projectDir = process.env.HORA_PROJECT_DIR ?? homedir();

export default defineConfig({
  plugins: [react(), horaPlugin(projectDir)],
  server: { port: 3847 },
});
