export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  [key: string]: any;
}

export function log(entry: LogEntry) {
  const output = {
    time: new Date().toISOString(),
    ...entry,
  };
  console.log(JSON.stringify(output));
}

export const logInfo = (message: string, meta: any = {}) =>
  log({ level: 'info', message, ...meta });
export const logError = (message: string, meta: any = {}) =>
  log({ level: 'error', message, ...meta });
