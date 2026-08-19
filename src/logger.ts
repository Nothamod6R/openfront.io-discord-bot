/**
 * Minimal leveled logger. Logs nothing sensitive (never tokens/secrets).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function createLogger(level: LogLevel = 'info'): Logger {
  const threshold = LEVEL_ORDER[level] ?? LEVEL_ORDER.info;
  const write = (lvl: LogLevel, msg: string) => {
    if (LEVEL_ORDER[lvl] >= threshold) {
      console.log(`[${new Date().toISOString()}] [${lvl.toUpperCase()}] ${msg}`);
    }
  };
  return {
    debug: (msg) => write('debug', msg),
    info: (msg) => write('info', msg),
    warn: (msg) => write('warn', msg),
    error: (msg) => write('error', msg),
  };
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};