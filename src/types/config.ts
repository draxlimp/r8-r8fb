export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';
export type ActivityTypeName = 'playing' | 'streaming' | 'listening' | 'watching' | 'competing' | 'custom' | 'none';

export interface CreditPerson { name: string; discord: string; role: string }
export interface AppConfig {
  token: string;
  prefix: string;
  owners: string[];
  credits: { enabled: boolean; title: string; people: CreditPerson[] };
  defaultPresence: {
    status: PresenceStatus;
    activityType: ActivityTypeName;
    activityText: string;
    streamUrl?: string;
    rotationEnabled?: boolean;
    rotationIntervalSeconds?: number;
    rotationActivities?: Array<{ activityType: ActivityTypeName; activityText: string; streamUrl?: string }>;
  };
  panel: { sessionTimeoutSeconds: number; deleteCommandMessage: boolean; defaultColor: string; maxSessionsPerUser: number };
  storage: { automaticBackup: boolean; backupBeforeWrite: boolean; maximumBackups: number };
  logging: { level: LogLevel; rotateAfterBytes: number; keepFiles: number };
  development: { enabled: boolean; simulateOnly: boolean };
}
