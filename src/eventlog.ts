export interface LogEntry {
  type: "alarm" | "test" | "error";
  ts: string;
  device?: string;
  event?: string;
  location?: string;
  channel?: string;
  [key: string]: unknown;
}

const MAX_ENTRIES = 200;
const log: LogEntry[] = [];

export function logEvent(entry: LogEntry): void {
  log.unshift(entry);           // newest first
  if (log.length > MAX_ENTRIES) log.pop();
}

export function getRecentEvents(n = 50): LogEntry[] {
  return log.slice(0, n);
}
