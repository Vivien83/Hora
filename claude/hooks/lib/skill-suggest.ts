/**
 * HORA — Skill Auto-Suggest
 * Analyse l'historique d'outils et le message utilisateur pour suggérer le skill adapté.
 * Déterministe, pas de LLM.
 */

import * as fs from "fs";
import * as path from "path";

export interface SkillSuggestion {
  skill: string;
  reason: string;
  confidence: number; // 0-1
}

interface SkillPattern {
  tools?: string[];
  minToolCount?: number;
  keywords: string[];
  minKeywordHits?: number;
  hint: string;
}

const SKILL_PATTERNS: Record<string, SkillPattern> = {
  "hora-refactor": {
    tools: ["Edit", "Grep", "Read"],
    minToolCount: 8,
    keywords: ["refactor", "rename", "extract", "move", "decouple", "simplif", "clean", "dette", "smell"],
    hint: "/hora-refactor pour refactoring systématique avec filet de sécurité.",
  },
  "hora-security": {
    tools: ["Bash"],
    minToolCount: 3,
    keywords: ["auth", "token", "password", "credential", "secret", "xss", "injection", "csrf", "owasp", "vulnerab"],
    hint: "/hora-security pour audit sécurité OWASP complet.",
  },
  "hora-forge": {
    tools: ["Edit", "Write"],
    minToolCount: 5,
    keywords: ["test", "tdd", "spec", "vitest", "playwright", "coverage", "assert", "expect"],
    hint: "/hora-forge pour implémentation TDD avec tests obligatoires.",
  },
  "hora-perf": {
    keywords: ["slow", "lent", "performance", "lighthouse", "bundle", "lazy", "optimize", "optimise", "vitesse", "speed", "core web vital", "lcp", "inp", "cls"],
    hint: "/hora-perf pour audit performance et Core Web Vitals.",
  },
  "hora-parallel-code": {
    tools: ["Task"],
    minToolCount: 3,
    keywords: ["plusieurs fichiers", "multi-fichier", "codebase", "parallèle", "parallel", "tous les fichiers", "chaque fichier"],
    hint: "/hora-parallel-code si plusieurs fichiers/sous-systèmes.",
  },
  "hora-parallel-research": {
    keywords: ["compare", "benchmark", "évalue", "quelles sont", "what are the best", "alternatives", "vs", "versus", "meilleur"],
    hint: "/hora-parallel-research pour recherche multi-angles.",
  },
  "hora-design": {
    keywords: ["design", "ui", "ux", "landing", "composant", "layout", "maquette", "style", "theme", "dark mode", "branding", "shadcn"],
    hint: "/hora-design pour design intentionnel anti-AI.",
  },
  "hora-vision": {
    keywords: ["screenshot", "capture", "audit visuel", "review design", "anti-pattern", "interface", "visuel"],
    hint: "/hora-vision pour audit visuel d'interface.",
  },
};

/** Lit les N dernières entrées du tool-usage.jsonl (7 derniers jours max) */
function readRecentToolUsage(memoryDir: string, maxAgeDays = 7): Array<{ ts: string; session: string; tool: string }> {
  const logPath = path.join(memoryDir, ".tool-usage.jsonl");
  try {
    const raw = fs.readFileSync(logPath, "utf-8").trim();
    if (!raw) return [];
    const cutoff = Date.now() - maxAgeDays * 86400_000;
    const entries: Array<{ ts: string; session: string; tool: string }> = [];
    for (const line of raw.split("\n")) {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.ts).getTime() >= cutoff) {
          entries.push(entry);
        }
      } catch { /* skip malformed */ }
    }
    return entries;
  } catch {
    return [];
  }
}

/** Compte les occurrences de chaque outil dans l'historique */
function countTools(entries: Array<{ tool: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.tool] = (counts[e.tool] || 0) + 1;
  }
  return counts;
}

/**
 * Suggère un skill basé sur l'historique récent et le message courant.
 * Retourne null si aucune suggestion pertinente.
 */
export function suggestSkill(
  memoryDir: string,
  userMessage: string,
  currentSession?: string,
): SkillSuggestion | null {
  const msg = userMessage.toLowerCase();

  // Ne pas suggérer si l'utilisateur invoque déjà un skill
  if (msg.includes("/hora-")) return null;

  const recentEntries = readRecentToolUsage(memoryDir);
  const toolCounts = countTools(recentEntries);

  // Filtrer les entrées de la session courante pour le contexte immédiat
  const sessionEntries = currentSession
    ? recentEntries.filter((e) => e.session === currentSession.slice(0, 8))
    : [];
  const sessionToolCounts = countTools(sessionEntries);

  let bestSuggestion: SkillSuggestion | null = null;
  let bestScore = 0;

  for (const [skillName, pattern] of Object.entries(SKILL_PATTERNS)) {
    let score = 0;

    // Score basé sur les mots-clés dans le message
    const keywordHits = pattern.keywords.filter((kw) => msg.includes(kw)).length;
    const minKeywordHits = pattern.minKeywordHits ?? 1;
    if (keywordHits >= minKeywordHits) {
      score += keywordHits * 0.3;
    }

    // Score basé sur l'historique d'outils de la session courante
    if (pattern.tools && pattern.minToolCount) {
      const relevantToolCount = pattern.tools.reduce(
        (sum, t) => sum + (sessionToolCounts[t] || 0),
        0,
      );
      if (relevantToolCount >= pattern.minToolCount) {
        score += 0.3;
      }
    }

    // Bonus si pattern d'outils récurrents sur 7 jours
    if (pattern.tools) {
      const weeklyRelevant = pattern.tools.reduce(
        (sum, t) => sum + (toolCounts[t] || 0),
        0,
      );
      if (weeklyRelevant > 20) {
        score += 0.1;
      }
    }

    if (score > bestScore && score >= 0.3) {
      bestScore = score;
      bestSuggestion = {
        skill: skillName,
        reason: pattern.hint,
        confidence: Math.min(score, 1),
      };
    }
  }

  return bestSuggestion;
}
