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
}
