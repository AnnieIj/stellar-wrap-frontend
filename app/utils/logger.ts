/**
 * Centralized Leveled Logger for Stellar Wrap.
 *
 * Provides log levels: debug (0), info (1), warn (2), error (3), silent (4).
 * Default level:
 * - Production (NODE_ENV === 'production'): 'warn' (suppresses debug and info chitchat)
 * - Development / Test: 'debug'
 * Can be overridden via NEXT_PUBLIC_LOG_LEVEL or LOG_LEVEL env vars.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getActiveLogLevel(): LogLevel {
  const envLevel = (
    process.env.NEXT_PUBLIC_LOG_LEVEL ?? process.env.LOG_LEVEL
  )?.toLowerCase() as LogLevel | undefined;

  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel;
  }

  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  const activeLevel = getActiveLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLevel];
}

/**
 * Sanitizes Stellar public key address for non-debug logs (e.g. GDRZ...ZVQ).
 */
export function maskAddress(address?: string): string {
  if (!address || typeof address !== "string") return "";
  if (address.length < 12) return "[redacted]";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Sanitizes email address for non-debug logs (e.g. u***@domain.com).
 */
export function maskEmail(email?: string): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "[redacted]";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export interface LoggerInterface {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (namespace: string) => LoggerInterface;
}

class Logger implements LoggerInterface {
  private namespace?: string;

  constructor(namespace?: string) {
    this.namespace = namespace;
  }

  private formatArgs(args: unknown[]): unknown[] {
    if (this.namespace) {
      return [`[${this.namespace}]`, ...args];
    }
    return args;
  }

  debug(...args: unknown[]): void {
    if (shouldLog("debug")) {
      // eslint-disable-next-line no-console
      console.debug(...this.formatArgs(args));
    }
  }

  info(...args: unknown[]): void {
    if (shouldLog("info")) {
      // eslint-disable-next-line no-console
      console.log(...this.formatArgs(args));
    }
  }

  warn(...args: unknown[]): void {
    if (shouldLog("warn")) {
      // eslint-disable-next-line no-console
      console.warn(...this.formatArgs(args));
    }
  }

  error(...args: unknown[]): void {
    if (shouldLog("error")) {
      // eslint-disable-next-line no-console
      console.error(...this.formatArgs(args));
    }
  }

  child(namespace: string): LoggerInterface {
    const combinedNamespace = this.namespace ? `${this.namespace}:${namespace}` : namespace;
    return new Logger(combinedNamespace);
  }
}

export const logger = new Logger();
export const createLogger = (namespace: string) => new Logger(namespace);
