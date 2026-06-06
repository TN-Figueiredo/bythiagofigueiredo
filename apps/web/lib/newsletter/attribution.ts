/**
 * UTM + referrer attribution capture for newsletter signups.
 *
 * UTM values arrive from a user-controllable URL, so they are treated as
 * untrusted: trimmed, stripped of control chars, length-capped, and dropped
 * when empty. They are only ever stored as text (no allowlist needed).
 *
 * Referrer is captured server-side from the request `referer` header (more
 * reliable than a form field that JS could omit/forge).
 */

const UTM_MAX = 200
const REFERRER_MAX = 500

// The five canonical UTM parameter names.
export const UTM_PARAM_NAMES = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

export type UtmParamName = (typeof UTM_PARAM_NAMES)[number]

export interface NewsletterAttribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
}

/**
 * Drop ASCII/Unicode control characters (C0 range 0x00-0x1F, DEL 0x7F, and the
 * C1 range 0x80-0x9F). Built via char codes to avoid embedding raw control
 * bytes in source.
 */
function stripControlChars(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    if (!isControl) out += ch
  }
  return out
}

/**
 * Sanitize an untrusted attribution value:
 * - coerce to string (FormData values can be File; ignore non-strings)
 * - drop control chars (newlines, etc.)
 * - trim
 * - cap length
 * - return null when empty.
 */
function sanitize(value: FormDataEntryValue | null, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = stripControlChars(value).trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLen)
}

/**
 * Read the five UTM params from FormData and the referrer from request headers.
 *
 * @param formData submitted form data (carries UTM hidden inputs)
 * @param requestHeaders the `headers()` Headers (carries `referer`)
 */
export function readNewsletterAttribution(
  formData: FormData,
  requestHeaders: Headers,
): NewsletterAttribution {
  return {
    utm_source: sanitize(formData.get('utm_source'), UTM_MAX),
    utm_medium: sanitize(formData.get('utm_medium'), UTM_MAX),
    utm_campaign: sanitize(formData.get('utm_campaign'), UTM_MAX),
    utm_content: sanitize(formData.get('utm_content'), UTM_MAX),
    utm_term: sanitize(formData.get('utm_term'), UTM_MAX),
    referrer: sanitize(requestHeaders.get('referer'), REFERRER_MAX),
  }
}

/**
 * Plain-object UTM attribution as passed from client components that submit
 * programmatically (not via native FormData). Each field is optional and may be
 * null when the param was absent from the landing URL.
 */
export interface UtmAttributionInput {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
}

/**
 * Sanitize a plain-object UTM attribution payload (from a client component) and
 * pair it with the referrer captured server-side from the `referer` header.
 *
 * Mirrors {@link readNewsletterAttribution} but sources the five UTM values from
 * an untrusted plain object instead of FormData. Same guarantees: trim, drop
 * control chars, length-cap, null-if-empty.
 *
 * @param input the optional UTM payload forwarded by the client (may be undefined)
 * @param requestHeaders the `headers()` Headers (carries `referer`)
 */
export function sanitizeAttributionInput(
  input: UtmAttributionInput | undefined,
  requestHeaders: Headers,
): NewsletterAttribution {
  return {
    utm_source: sanitize(input?.utm_source ?? null, UTM_MAX),
    utm_medium: sanitize(input?.utm_medium ?? null, UTM_MAX),
    utm_campaign: sanitize(input?.utm_campaign ?? null, UTM_MAX),
    utm_content: sanitize(input?.utm_content ?? null, UTM_MAX),
    utm_term: sanitize(input?.utm_term ?? null, UTM_MAX),
    referrer: sanitize(requestHeaders.get('referer'), REFERRER_MAX),
  }
}
