/**
 * HORA — Relation Ontology for Knowledge Graph
 *
 * Typed ontology of ~34 relations organized in 6 categories.
 * Replaces generic "involves"/"uses" templates with precise, contextual relations.
 */

// ─── Relation Types by Category ──────────────────────────────────────────────

export type StructuralRelation =
  | "has_component"
  | "depends_on"
  | "extends"
  | "implements"
  | "configures"
  | "replaces"
  | "hosts";

export type TechnologicalRelation =
  | "uses"
  | "integrates"
  | "built_with"
  | "migrated_from";

export type LearningRelation =
  | "decided_for"
  | "decided_against"
  | "learned_that"
  | "caused_by"
  | "solved_by"
  | "blocked_by"
  | "workaround_for";

export type ExperienceRelation =
  | "works_well_for"
  | "fails_for"
  | "performs_better_than"
  | "anti_pattern_in";

export type ActorRelation =
  | "works_on"
  | "prefers"
  | "frustrated_with"
  | "satisfied_with"
  | "created"
  | "maintains";

export type ConceptualRelation =
  | "related_to"
  | "inspired_by"
  | "contradicts"
  | "specializes"
  | "exemplifies";

export type AllRelations =
  | StructuralRelation
  | TechnologicalRelation
  | LearningRelation
  | ExperienceRelation
  | ActorRelation
  | ConceptualRelation;

// ─── Category Map ────────────────────────────────────────────────────────────

export type RelationCategory =
  | "structural"
  | "technological"
  | "learning"
  | "experience"
  | "actor"
  | "conceptual";

const CATEGORY_MAP: Record<AllRelations, RelationCategory> = {
  // Structural
  has_component: "structural",
  depends_on: "structural",
  extends: "structural",
  implements: "structural",
  configures: "structural",
  replaces: "structural",
  hosts: "structural",
  // Technological
  uses: "technological",
  integrates: "technological",
  built_with: "technological",
  migrated_from: "technological",
  // Learning
  decided_for: "learning",
  decided_against: "learning",
  learned_that: "learning",
  caused_by: "learning",
  solved_by: "learning",
  blocked_by: "learning",
  workaround_for: "learning",
  // Experience
  works_well_for: "experience",
  fails_for: "experience",
  performs_better_than: "experience",
  anti_pattern_in: "experience",
  // Actor
  works_on: "actor",
  prefers: "actor",
  frustrated_with: "actor",
  satisfied_with: "actor",
  created: "actor",
  maintains: "actor",
  // Conceptual
  related_to: "conceptual",
  inspired_by: "conceptual",
  contradicts: "conceptual",
  specializes: "conceptual",
  exemplifies: "conceptual",
};

// Set of all valid relation names for fast lookup
const VALID_RELATIONS = new Set<string>(Object.keys(CATEGORY_MAP));

// ─── Legacy Mapping ──────────────────────────────────────────────────────────

const LEGACY_MAP: Record<string, AllRelations> = {
  involves: "related_to",
  ecosystem: "has_component",
  serves: "works_well_for",
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Normalize a relation string to a valid ontology relation.
 * Maps legacy names ("involves" -> "related_to", "ecosystem" -> "has_component").
 * Returns "related_to" for unknown values.
 */
export function normalizeRelation(raw: string): AllRelations {
  const trimmed = raw.trim().toLowerCase();

  // Direct match
  if (VALID_RELATIONS.has(trimmed)) {
    return trimmed as AllRelations;
  }

  // Legacy mapping
  if (trimmed in LEGACY_MAP) {
    return LEGACY_MAP[trimmed];
  }

  // Fallback
  return "related_to";
}

/**
 * Get the category of a relation.
 */
export function getRelationCategory(relation: string): RelationCategory {
  const normalized = normalizeRelation(relation);
  return CATEGORY_MAP[normalized];
}

/**
 * French labels for dashboard display.
 */
export const RELATION_LABELS: Record<AllRelations, string> = {
  // Structural
  has_component: "contient",
  depends_on: "depend de",
  extends: "etend",
  implements: "implemente",
  configures: "configure",
  replaces: "remplace",
  hosts: "heberge",
  // Technological
  uses: "utilise",
  integrates: "integre",
  built_with: "construit avec",
  migrated_from: "migre depuis",
  // Learning
  decided_for: "choisi pour",
  decided_against: "rejete",
  learned_that: "appris que",
  caused_by: "cause par",
  solved_by: "resolu par",
  blocked_by: "bloque par",
  workaround_for: "contournement pour",
  // Experience
  works_well_for: "fonctionne bien pour",
  fails_for: "echoue pour",
  performs_better_than: "plus performant que",
  anti_pattern_in: "anti-pattern dans",
  // Actor
  works_on: "travaille sur",
  prefers: "prefere",
  frustrated_with: "frustre par",
  satisfied_with: "satisfait de",
  created: "a cree",
  maintains: "maintient",
  // Conceptual
  related_to: "lie a",
  inspired_by: "inspire par",
  contradicts: "contredit",
  specializes: "specialise",
  exemplifies: "illustre",
};

/**
 * Ontology description for LLM extraction prompts.
 * Returns formatted text listing all relations with descriptions.
 */
export function getOntologyForPrompt(): string {
  return `RELATIONS DISPONIBLES (utilise UNIQUEMENT ces relations) :

STRUCTUREL :
- has_component : A contient B comme sous-systeme
- depends_on : A ne fonctionne pas sans B
- extends : A ajoute des fonctionnalites a B
- implements : A implemente le concept/interface B
- configures : A configure/parametrise B
- replaces : A remplace B (migration, upgrade)
- hosts : A heberge/deploie B

TECHNOLOGIQUE :
- uses : A utilise l'outil/lib B pour une tache specifique
- integrates : A integre B comme composant majeur
- built_with : A est construit avec la technologie B (stack core)
- migrated_from : A a ete migre depuis B

APPRENTISSAGE :
- decided_for : choix de A pour la raison B
- decided_against : rejet de A pour la raison B
- learned_that : lecon apprise — A implique B
- caused_by : probleme A cause par B
- solved_by : probleme A resolu par B
- blocked_by : A bloque par B (technique ou organisationnel)
- workaround_for : A est un contournement pour le probleme B

EXPERIENCE :
- works_well_for : A fonctionne bien pour le cas d'usage B
- fails_for : A echoue pour le cas d'usage B
- performs_better_than : A est plus performant que B
- anti_pattern_in : A est un anti-pattern dans le contexte B

ACTEUR :
- works_on : personne A travaille sur projet B
- prefers : personne A prefere outil/approche B
- frustrated_with : personne A frustree par B
- satisfied_with : personne A satisfaite de B
- created : personne A a cree B
- maintains : personne A maintient B

CONCEPTUEL (fallback si rien d'autre ne convient) :
- related_to : lien generique entre A et B
- inspired_by : A inspire par B
- contradicts : A contredit B
- specializes : A est une specialisation de B
- exemplifies : A illustre le concept B`;
}
