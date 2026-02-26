/**
 * HORA — Algorithm Tracker
 * Detection deterministe de phase (EXPLORE/PLAN/AUDIT/CODE/COMMIT)
 * et validation des transitions pour enforcer l'algorithme HORA.
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

export type AlgoPhase = "EXPLORE" | "PLAN" | "AUDIT" | "CODE" | "COMMIT" | "UNKNOWN";

export interface AlgoState {
  sessionId: string;
  currentPhase: AlgoPhase;
  phasesCompleted: AlgoPhase[];
  lastTransition: string; // ISO timestamp
  complexity: "trivial" | "moyen" | "complexe" | "critique";
}

const STATE_DIR = path.join(homedir(), ".claude", "MEMORY", "STATE");

// Phase detection patterns (deterministic, keyword-based)
const PHASE_PATTERNS: Array<{ phase: AlgoPhase; patterns: RegExp[] }> = [
  {
    phase: "EXPLORE",
    patterns: [
      /\bj'ai lu\b/i,
      /\bvoici ce que\b/i,
      /\banalyse\b/i,
      /\bfichiers concernes\b/i,
      /\bexplore\b/i,
      /\bj'ai parcouru\b/i,
      /\bstructure du\b/i,
      /\bje lis\b/i,
      /\bje comprends\b/i,
      /\bvoici l'etat\b/i,
    ],
  },
  {
    phase: "PLAN",
    patterns: [
      /\bplan\b/i,
      /\bisc\b/i,
      /\betapes\b/i,
      /\bchangements prevus\b/i,
      /\bstrategie\b/i,
      /\bapproche proposee\b/i,
      /\bvoici le plan\b/i,
    ],
  },
  {
    phase: "AUDIT",
    patterns: [
      /\baudit\b/i,
      /\bghost failure/i,
      /\bhypothese/i,
      /\bverifie/i,
      /\brisque/i,
      /\bpoint de contact\b/i,
      /\brace condition/i,
    ],
  },
  {
    phase: "CODE",
    patterns: [
      /\bimplemente/i,
      /\bmodifie/i,
      /\bvoici (?:le|la|les) modif/i,
      /\bj'ai (?:ajoute|cree|ecrit|modifie)/i,
      /\bcode\b.*\b(?:ajoute|modifie|ecrit)/i,
    ],
  },
  {
    phase: "COMMIT",
    patterns: [
      /\bisc verifies?\b/i,
      /\btermine\b/i,
      /\bcommit\b/i,
      /\btout est en ordre\b/i,
      /\brecapitulatif\b/i,
      /\bprochaines etapes\b/i,
    ],
  },
];

// Valid transitions: phase → allowed next phases
const VALID_TRANSITIONS: Record<AlgoPhase, AlgoPhase[]> = {
  UNKNOWN: ["EXPLORE", "CODE"], // CODE only for trivial
  EXPLORE: ["PLAN", "AUDIT", "CODE"], // CODE only if trivial (no PLAN/AUDIT needed)
  PLAN: ["AUDIT", "CODE"], // CODE after PLAN is allowed for simple plans
  AUDIT: ["CODE", "PLAN"], // Back to PLAN if audit reveals issues
  CODE: ["COMMIT", "AUDIT", "EXPLORE"], // Back to AUDIT/EXPLORE if issues found
  COMMIT: ["EXPLORE", "UNKNOWN"], // New cycle
};

/**
 * Detect the current phase from an assistant message.
 * Returns the most likely phase based on keyword density.
 */
export function detectPhase(assistantMessage: string): AlgoPhase {
  if (!assistantMessage || assistantMessage.length < 20) return "UNKNOWN";

  // Check for tool_use patterns (Edit/Write = CODE phase)
  if (/\btool_use\b.*\b(?:Edit|Write|MultiEdit)\b/i.test(assistantMessage)) {
    return "CODE";
  }

  let bestPhase: AlgoPhase = "UNKNOWN";
  let bestScore = 0;

  for (const { phase, patterns } of PHASE_PATTERNS) {
    let score = 0;
    for (const p of patterns) {
      if (p.test(assistantMessage)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  return bestScore >= 1 ? bestPhase : "UNKNOWN";
}

/**
 * Validate a phase transition.
 * Returns whether the transition is valid and a warning if not.
 */
export function validateTransition(
  state: AlgoState,
  nextPhase: AlgoPhase
): { valid: boolean; warning?: string } {
  if (nextPhase === "UNKNOWN") return { valid: true };

  // Trivial complexity: any transition is valid
  if (state.complexity === "trivial") return { valid: true };

  const allowed = VALID_TRANSITIONS[state.currentPhase] || [];
  if (allowed.includes(nextPhase)) return { valid: true };

  // Specific warnings
  if (nextPhase === "CODE" && !state.phasesCompleted.includes("EXPLORE")) {
    return {
      valid: false,
      warning: "EXPLORE saute — lis les fichiers concernes avant de coder",
    };
  }
  if (
    nextPhase === "CODE" &&
    !state.phasesCompleted.includes("AUDIT") &&
    state.complexity !== "trivial"
  ) {
    return {
      valid: false,
      warning: "AUDIT saute — verifie les hypotheses et ghost failures avant de coder",
    };
  }

  return { valid: true };
}

/**
 * Detect complexity from the user message (deterministic keywords).
 */
export function detectComplexity(
  message: string
): "trivial" | "moyen" | "complexe" | "critique" {
  const msg = message.toLowerCase();

  // Critique
  const critiqueWords = [
    "auth", "payment", "paiement", "database", "migration",
    "deploy", "production", "securite", "security", "credentials",
    "mot de passe", "password", "stripe", "oauth",
  ];
  if (critiqueWords.some((w) => msg.includes(w))) return "critique";

  // Complexe
  const complexeWords = [
    "refactor", "migration", "architecture", "redesign",
    "restructure", "plusieurs fichiers", "multi-fichiers", "codebase",
    "nouvelle archi", "new architecture",
  ];
  if (complexeWords.some((w) => msg.includes(w))) return "complexe";

  // Trivial
  const trivialWords = [
    "typo", "rename", "fix typo", "coquille", "faute de frappe",
    "majuscule", "minuscule", "espace",
  ];
  if (trivialWords.some((w) => msg.includes(w))) return "trivial";

  // Default: moyen
  return "moyen";
}

/**
 * Load algorithm state from disk (session-scoped).
 */
export function loadAlgoState(sessionId: string): AlgoState | null {
  const filePath = path.join(STATE_DIR, `algo-state-${sessionId.slice(0, 8)}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as AlgoState;
  } catch {
    return null;
  }
}

/**
 * Save algorithm state to disk.
 */
export function saveAlgoState(sessionId: string, state: AlgoState): void {
  const filePath = path.join(STATE_DIR, `algo-state-${sessionId.slice(0, 8)}.json`);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {}
}
