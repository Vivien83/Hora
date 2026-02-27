/**
 * HORA — Context Budget Optimizer
 * Adapte dynamiquement la taille des sections injectées selon le % de contexte utilisé.
 * Priorités (du plus critique au moins critique) :
 *   1. ISC en cours
 *   2. Steering rules
 *   3. Project knowledge
 *   4. Thread history
 *   5. Graph context
 *   6. Sentiment / effort hints
 */

import * as fs from "fs";

export interface BudgetAllocation {
  maxSectionChars: number;
  maxWorkChars: number;
  maxThreadChars: number;
  skipGraph: boolean;
  skipThread: boolean;
  level: "full" | "reduced" | "minimal" | "emergency";
}

/**
 * Lit le context % depuis le fichier session-scoped.
 * Retourne null si indisponible.
 */
export function readContextPercent(contextPctFile: string): number | null {
  try {
    const raw = fs.readFileSync(contextPctFile, "utf-8").trim();
    const val = parseInt(raw, 10);
    if (isNaN(val) || val <= 0 || val > 100) return null;
    return val;
  } catch {
    return null;
  }
}

/**
 * Calcule le budget d'injection optimal selon le % de contexte utilisé.
 *
 * < 60%  → full     : toutes les sections à taille max
 * 60-80% → reduced  : sections réduites de 30%
 * 80-90% → minimal  : thread = dernière entrée, graph skippé
 * > 90%  → emergency: seulement ISC + steering, tout le reste skippé
 */
export function allocateBudget(contextPercent: number | null): BudgetAllocation {
  // Si on ne connaît pas le %, utiliser le budget standard
  if (contextPercent === null || contextPercent < 60) {
    return {
      maxSectionChars: 400,
      maxWorkChars: 300,
      maxThreadChars: 5000,
      skipGraph: false,
      skipThread: false,
      level: "full",
    };
  }

  if (contextPercent < 80) {
    return {
      maxSectionChars: 280,
      maxWorkChars: 200,
      maxThreadChars: 2500,
      skipGraph: false,
      skipThread: false,
      level: "reduced",
    };
  }

  if (contextPercent < 90) {
    return {
      maxSectionChars: 150,
      maxWorkChars: 100,
      maxThreadChars: 500,
      skipGraph: true,
      skipThread: false,
      level: "minimal",
    };
  }

  // Emergency: > 90%
  return {
    maxSectionChars: 80,
    maxWorkChars: 0,
    maxThreadChars: 0,
    skipGraph: true,
    skipThread: true,
    level: "emergency",
  };
}

/**
 * Tronque un texte à maxChars en respectant les limites de mots.
 */
export function truncateTobudget(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  if (maxChars <= 0) return "";
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}
