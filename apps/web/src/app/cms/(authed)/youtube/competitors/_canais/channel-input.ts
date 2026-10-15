/** Pure parsing of the "Canal do YouTube" field (shared by the Canais dialog and the add action). */
/** Handle characters: the YouTube accepts letters of any alphabet (with accents), digits, "_", "." and "-". */
const HANDLE = String.raw`[\p{L}\p{M}\p{N}_.-]{3,100}`
const URL_PREFIX = String.raw`(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/`
const AT_HANDLE_RE = new RegExp(`^@(${HANDLE})(?:[/?#].*)?$`, 'u')
const URL_HANDLE_RE = new RegExp(`^${URL_PREFIX}@(${HANDLE})(?:[/?#].*)?$`, 'u')
const URL_RE = new RegExp(`^${URL_PREFIX}`)
const BARE_HANDLE_RE = new RegExp(`^(${HANDLE})$`, 'u')
const CHANNEL_RE = new RegExp(`^${URL_PREFIX}channel\\/(UC[\\w-]{22})(?:[/?#].*)?$`)

/**
 * "@handle", "handle" (without @), youtube.com/@handle (with or without https://, %XX-encoded or not),
 * youtube.com/channel/UC…, or a bare UC… id (the old search modal sends those).
 */
export function parseChannelInput(raw: string): { kind: 'id'; id: string } | { kind: 'handle'; handle: string } | null {
  let v = raw.trim()
  if (/^UC[\w-]{22}$/.test(v)) return { kind: 'id', id: v }
  const ch = CHANNEL_RE.exec(v)
  if (ch) return { kind: 'id', id: ch[1]! }
  // A URL copied from the browser bar carries the accents as %XX; macOS may paste "á" decomposed (a + combining accent).
  try { v = decodeURIComponent(v) } catch { return null }
  v = v.normalize('NFC')
  const re = URL_RE.test(v) ? URL_HANDLE_RE : v.startsWith('@') ? AT_HANDLE_RE : BARE_HANDLE_RE
  const h = re.exec(v)
  return h ? { kind: 'handle', handle: '@' + h[1]! } : null
}
