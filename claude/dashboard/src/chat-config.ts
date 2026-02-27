/**
 * HORA Memory Chat — LLM configuration
 * Supports Anthropic API (Claude) and OpenRouter.
 * Config stored in ~/.claude/hora-chat-config.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".claude", "hora-chat-config.json");

export interface ChatConfig {
  provider: "anthropic" | "openrouter";
  apiKey: string;
  model: string;
}

const DEFAULTS: Record<string, { model: string }> = {
  anthropic: { model: "claude-haiku-4-5-20251001" },
  openrouter: { model: "anthropic/claude-3.5-haiku" },
};

export function loadConfig(): ChatConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    if (!raw.provider || !raw.apiKey) return null;
    return {
      provider: raw.provider,
      apiKey: raw.apiKey,
      model: raw.model ?? DEFAULTS[raw.provider]?.model ?? "claude-haiku-4-5-20251001",
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: ChatConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function getDefaultModel(provider: string): string {
  return DEFAULTS[provider]?.model ?? "claude-haiku-4-5-20251001";
}
