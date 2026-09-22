/**
 * MCP error mapper.
 *
 * Translates PipelineServiceError codes into MCP tool result format
 * with severity classification, retry guidance, and recovery actions.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ErrorSeverity = 'fatal' | 'recoverable' | 'transient'

export interface McpToolResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  _meta?: {
    severity?: ErrorSeverity
    retryable?: boolean
    retryAfterSeconds?: number
    recovery_action?: string
    code?: string
    [key: string]: unknown
  }
}

export interface PipelineServiceError {
  code: string
  message: string
  status?: number
  details?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/*  Error classification                                               */
/* ------------------------------------------------------------------ */

interface ErrorClassification {
  severity: ErrorSeverity
  retryable: boolean
  recovery_action: string
}

const ERROR_MAP: Record<string, ErrorClassification> = {
  // Recoverable -- caller can fix and retry
  VERSION_CONFLICT: {
    severity: 'recoverable',
    retryable: true,
    recovery_action: 'Re-fetch the resource to get the latest version, then retry the operation with the updated X-Expected-Version.',
  },
  VALIDATION_ERROR: {
    severity: 'recoverable',
    retryable: false,
    recovery_action: 'Fix the input parameters according to the error message and retry.',
  },
  FORBIDDEN: {
    severity: 'recoverable',
    retryable: false,
    recovery_action: 'The API key lacks the required permission level. Use a key with write or admin permissions.',
  },
  TASK_NOT_RUNNING: {
    severity: 'recoverable',
    retryable: false,
    recovery_action: 'The task is no longer held by this session (closed, stale or owned by another key). Do not resend; claim another task.',
  },
  PARTIAL_FAILURE: {
    severity: 'recoverable',
    retryable: false,
    // The MCP `manage_ab_test` tool has no `fail` action (only `claim_task`) — telling an MCP
    // caller to "send an explicit fail" here gives an instruction it cannot carry out, and the
    // task would then sit `running` until the watchdog releases it 30-60 min later. The explicit
    // close is REST-only: POST .../intelligence/task/{id}/fail with retry.
    recovery_action: 'Some writes failed and the task is still running — nothing was closed. This MCP tool cannot close it explicitly (no `fail` action): call REST POST .../intelligence/task/{id}/fail with retry, or wait for the watchdog (30-60 min). Do not resend the submit_intelligence payload.',
  },

  // Transient -- retry after delay
  RATE_LIMITED: {
    severity: 'transient',
    retryable: true,
    recovery_action: 'Wait for the indicated retry period before sending the next request.',
  },
  SERVICE_UNAVAILABLE: {
    severity: 'transient',
    retryable: true,
    recovery_action: 'The service is temporarily unavailable. Retry after a short delay.',
  },
  TIMEOUT: {
    severity: 'transient',
    retryable: true,
    recovery_action: 'The operation timed out. Retry with the same parameters.',
  },

  // Fatal -- no automatic recovery
  NOT_FOUND: {
    severity: 'fatal',
    retryable: false,
    recovery_action: 'The requested resource does not exist. Verify the ID and try a different one.',
  },
  UNAUTHORIZED: {
    severity: 'fatal',
    retryable: false,
    recovery_action: 'Authentication failed. Verify the API key is correct and not revoked.',
  },
  INTERNAL_ERROR: {
    severity: 'fatal',
    retryable: false,
    recovery_action: 'An unexpected server error occurred. Report this issue if it persists.',
  },
}

const DEFAULT_CLASSIFICATION: ErrorClassification = {
  severity: 'fatal',
  retryable: false,
  recovery_action: 'An unknown error occurred. Check the error message for details.',
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Maps a PipelineServiceError to MCP tool result format.
 */
export function toMcpError(error: PipelineServiceError): McpToolResult {
  const classification = ERROR_MAP[error.code] ?? DEFAULT_CLASSIFICATION

  const errorPayload = {
    code: error.code,
    message: error.message,
    severity: classification.severity,
    retryable: classification.retryable,
    recovery_action: classification.recovery_action,
    ...(error.details ? { details: error.details } : {}),
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
    isError: true,
    _meta: {
      severity: classification.severity,
      retryable: classification.retryable,
      recovery_action: classification.recovery_action,
      code: error.code,
    },
  }
}

/**
 * Wraps a successful result into MCP tool result format.
 */
export function toMcpSuccess(data: unknown, meta?: Record<string, unknown>): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError: false,
    ...(meta ? { _meta: meta } : {}),
  }
}

/**
 * Creates a PipelineServiceError from a raw catch block.
 * Useful for wrapping unknown errors in tool handlers.
 */
export function toPipelineServiceError(err: unknown): PipelineServiceError {
  if (isPipelineServiceError(err)) return err

  const message = err instanceof Error ? err.message : String(err)
  return { code: 'INTERNAL_ERROR', message }
}

/**
 * Type guard for PipelineServiceError shape.
 */
export function isPipelineServiceError(err: unknown): err is PipelineServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as PipelineServiceError).code === 'string' &&
    typeof (err as PipelineServiceError).message === 'string'
  )
}
