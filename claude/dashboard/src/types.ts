export interface SessionEntry {
  filename: string;
  name: string;
  date: string;
  sentiment: number;
  sid: string;
  messageCount: number;
  project?: string;
}

export interface SentimentEntry {
  sid: string;
  score: number;
  ts: string;
  trigger: string;
}

export interface BackupState {
  lastBackup: string | null;
  strategy: string;
  commitCount: number;
}

export interface ThreadEntry {
  ts: string;
  sid: string;
  u: string;
  a: string;
  project?: string;
  sessionName?: string;
  sentiment?: number;
}

export interface FailureEntry {
  filename: string;
  title: string;
  type: string;
  session: string;
  date: string;
}

export interface SecurityEvent {
  timestamp: string;
  session_id: string;
  event_type: "alert" | "block" | "confirm";
  tool: string;
  category: string;
  target: string;
  reason: string;
  action_taken: string;
}

export interface SecuritySummary {
  alerts: number;
  blocks: number;
  confirms: number;
  recent: SecurityEvent[];
}

export interface SnapshotEntry {
  path: string;
  tool: string;
  session: string;
  size: number;
  ts: string;
}

export interface ProjectContext {
  checkpoint: string;
  knowledge: string;
  snapshots: SnapshotEntry[];
  backupState: BackupState | null;
  projectId: string;
}

export interface ToolUsageDay {
  date: string;
  tools: Record<string, number>;
  total: number;
}

export interface ProfileData {
  identity: string;
  projects: string;
  preferences: string;
  vocabulary: string;
}

export interface MemoryTierStats {
  items: number;
  sizeKb: number;
  oldestDays?: number;
}

export interface MemoryHealth {
  t1: MemoryTierStats;
  t2: MemoryTierStats;
  t3: MemoryTierStats;
  lastGc: string | null;
  alerts: string[];
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export interface FactMetadata {
  context?: string;
  evidence?: string;
  alternatives?: string[];
  category?: string;
  source_session?: string;
}

export interface GraphNode {
  id: string;
  type: "project" | "tool" | "error_pattern" | "preference" | "concept" | "person" | "file" | "library" | "pattern" | "decision";
  name: string;
  properties: Record<string, string | number | boolean>;
  created_at: string;
  last_seen: string;
  connections: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
  valid_at: string;
  invalid_at: string | null;
  expired_at: string | null;
  confidence: number;
  metadata?: FactMetadata;
}

export interface GraphData {
  entities: GraphNode[];
  facts: GraphEdge[];
  episodes: number;
  stats: {
    totalEntities: number;
    totalFacts: number;
    activeFacts: number;
    embeddedRatio: number;
    topHub: string | null;
    lastEnrichment: string | null;
    contradictions: number;
  };
}

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sessionId: string;
}

// ─── Memory Chat ────────────────────────────────────────────────────────────

export interface ChatMessageEntity {
  id: string;
  name: string;
  type: string;
  connections: number;
}

export interface ChatMessageFact {
  relation: string;
  description: string;
  confidence: number;
  source: string;
  target: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "hora";
  content: string;
  timestamp: string;
  entities?: ChatMessageEntity[];
  facts?: ChatMessageFact[];
  stats?: { totalSearched: number; returned: number; durationMs: number; inputTokens?: number; outputTokens?: number; costUsd?: number; totalCostUsd?: number; tokensUsed?: number };
}

export interface DashboardData {
  generatedAt: string;
  profile: ProfileData;
  sessions: SessionEntry[];
  sentimentHistory: SentimentEntry[];
  backupState: BackupState | null;
  snapshotCount: number;
  toolUsage: Record<string, number>;
  thread: ThreadEntry[];
  failures: FailureEntry[];
  security: SecuritySummary;
  projectContext: ProjectContext | null;
  toolTimeline: ToolUsageDay[];
  memoryHealth: MemoryHealth | null;
  graphData: GraphData | null;
  transcripts: TranscriptMessage[];
}
