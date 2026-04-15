// Minimal logger shim. In production it writes to stderr via console.
// In tests, `setLogger(() => {})` can silence the noise.
// Sprint 4 replaces this with a Sentry-backed implementation via setLogger.

export interface Logger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

let active: Logger = {
  warn: (msg, meta) => console.warn(msg, meta ?? ''),
  error: (msg, meta) => console.error(msg, meta ?? ''),
};

export function getLogger(): Logger {
  return active;
}

export function setLogger(next: Logger): void {
  active = next;
}

export function resetLogger(): void {
  active = {
    warn: (msg, meta) => console.warn(msg, meta ?? ''),
    error: (msg, meta) => console.error(msg, meta ?? ''),
  };
}
