/**
 * @tn-figueiredo/contracts
 *
 * Zero-dependency seam layer for the @tn-figueiredo/* ecosystem.
 * Defines shared interface contracts consumed across packages without
 * coupling them to any concrete implementation.
 */

// ── ISiteAuthGuard ──────────────────────────────────────────────────────────

/**
 * Auth guard for site-scoped operations.
 *
 * Implementations resolve permissions via the request context (JWT, RLS, etc.).
 * `requireSiteAdmin` MUST throw when the caller is not authorized — it is
 * designed to be called at the top of server actions as a guard.
 */
export interface ISiteAuthGuard {
  /**
   * Assert that the current user is allowed to administrate `siteId`.
   * Resolves (`void`) on success, throws on forbidden or unauthenticated.
   */
  requireSiteAdmin(siteId: string): Promise<void>

  /**
   * Returns `true` if the current user may edit content for `siteId`.
   */
  canEditSite(siteId: string): Promise<boolean>

  /**
   * Returns `true` if the current user may publish content for `siteId`.
   */
  canPublishSite(siteId: string): Promise<boolean>
}

// ── ILogger ─────────────────────────────────────────────────────────────────

/**
 * Minimal structured logger interface.
 *
 * Each method accepts a human-readable `msg` and an optional `data` bag for
 * structured fields. Mirrors the shape used in existing cron adapters so that
 * implementations can wrap `logCron` or any other backend transparently.
 */
export interface ILogger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
}

// ── ToastFn ─────────────────────────────────────────────────────────────────

/**
 * Toast notification contract.
 *
 * Abstracts over sonner / react-hot-toast / any future toast library so that
 * UI-agnostic service layers can surface feedback without a hard dependency on
 * a specific notification library.
 */
export interface ToastFn {
  success(message: string): void
  error(message: string): void
}

// ── Strings ──────────────────────────────────────────────────────────────────

/**
 * Recursive i18n strings map.
 *
 * A `Strings` value is either a plain string or a nested record of strings.
 * This type is intentionally broad to accommodate any component's string shape
 * without imposing a schema at the contract layer.
 *
 * @example
 * ```ts
 * const en: Strings = {
 *   actions: { save: 'Save', cancel: 'Cancel' },
 *   title: 'My App',
 * }
 * ```
 */
export type Strings = { [key: string]: string | Strings }

// ── mergeStrings ─────────────────────────────────────────────────────────────

/**
 * Deep-merge `overrides` onto `defaults`, returning a new `Strings` object.
 *
 * - Keys present in both are resolved from `overrides`.
 * - Keys present only in `defaults` are carried through unchanged.
 * - Keys present only in `overrides` are added to the result.
 * - Nested `Strings` objects are merged recursively.
 * - Neither `defaults` nor `overrides` is mutated.
 *
 * @example
 * ```ts
 * const en = { actions: { save: 'Save', cancel: 'Cancel' } }
 * const ptBR = mergeStrings(en, { actions: { save: 'Salvar' } })
 * // → { actions: { save: 'Salvar', cancel: 'Cancel' } }
 * ```
 */
export function mergeStrings(defaults: Strings, overrides: Strings): Strings {
  const result: Strings = { ...defaults }

  for (const key of Object.keys(overrides)) {
    const overrideVal: string | Strings | undefined = overrides[key]
    const defaultVal: string | Strings | undefined = result[key]

    // Guard: noUncheckedIndexedAccess can yield undefined for Object.keys iteration
    // which should never happen, but we narrow the type to satisfy strict TS.
    if (overrideVal === undefined) continue

    if (
      typeof overrideVal === 'object' &&
      defaultVal !== undefined &&
      typeof defaultVal === 'object'
    ) {
      // Both sides are nested Strings — recurse
      result[key] = mergeStrings(
        defaultVal as Strings,
        overrideVal as Strings,
      )
    } else {
      result[key] = overrideVal
    }
  }

  return result
}
