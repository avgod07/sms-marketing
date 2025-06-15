import fs from "fs";

export type LogLevel = "error" | "warn" | "info" | "debug";

const levelWeights: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const envLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
const logThreshold = levelWeights[envLevel] ?? levelWeights.info;

const logFile = process.env.LOG_FILE || "logs/app.log";
const serviceUrl = process.env.LOG_SERVICE_URL;

export interface LogEntry {
  level: LogLevel;
  message: string;
  [key: string]: any;
}

function writeToFile(line: string) {
  try {
    const maxSize = 5 * 1024 * 1024; // 5MB
    try {
      const { size } = fs.statSync(logFile);
      if (size > maxSize) {
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch {}
    fs.appendFileSync(logFile, line + "\n");
  } catch {}
}

export function log(entry: LogEntry) {
  if (levelWeights[entry.level] > logThreshold) return;

  const output = {
    time: new Date().toISOString(),
    ...entry,
  };
  const line = JSON.stringify(output);

  console.log(line);
  if (serviceUrl) {
    try {
      // fire and forget
      fetch(serviceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: line,
      }).catch(() => {});
    } catch {}
  } else {
    writeToFile(line);
  }
}

export const logInfo = (message: string, meta: any = {}) =>
  log({ level: "info", message, ...meta });
export const logError = (message: string, meta: any = {}) =>
  log({ level: "error", message, ...meta });
export const logWarn = (message: string, meta: any = {}) =>
  log({ level: "warn", message, ...meta });
export const logDebug = (message: string, meta: any = {}) =>
  log({ level: "debug", message, ...meta });
