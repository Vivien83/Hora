export interface SessionEntry {
  filename: string;
  name: string;
  date: string;
  sentiment: number;
  sid: string;
  messageCount: number;
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

export interface DashboardData {
  generatedAt: string;
  profile: {
    identity: string;
    projects: string;
    preferences: string;
  };
  sessions: SessionEntry[];
  sentimentHistory: SentimentEntry[];
  backupState: BackupState | null;
  snapshotCount: number;
  toolUsage: Record<string, number>;
}
