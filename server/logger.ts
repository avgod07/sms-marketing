import fs from 'fs';

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
  const line = JSON.stringify(output);
  console.log(line);
  try {
    const logFile = 'logs/app.log';
    const maxSize = 5 * 1024 * 1024; // 5MB
    try {
      const { size } = fs.statSync(logFile);
      if (size > maxSize) {
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch {}
    fs.appendFileSync(logFile, line + '\n');
  } catch {}
}

export const logInfo = (message: string, meta: any = {}) =>
  log({ level: 'info', message, ...meta });
export const logError = (message: string, meta: any = {}) =>
  log({ level: 'error', message, ...meta });
