type LogLevel = 'error' | 'warn' | 'info'

export function pipelineLog(
  level: LogLevel,
  module: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...extra,
  })

  if (level === 'error') {
    console.error(entry)
  } else if (level === 'warn') {
    console.warn(entry)
  } else {
    console.info(entry)
  }
}
