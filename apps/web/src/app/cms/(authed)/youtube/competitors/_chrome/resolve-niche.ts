/**
 * Global niche of the Observatório (CHROME.md "Nicho"): a well-formed ?niche= wins and is persisted (only when it differs from the saved one); a malformed one is
 * ignored (the persisted niche is used) and the client removes it from the URL with router.replace.
 *
 * Only the FORM is decided here ('todos' or a niche slug). Whether the niche exists in the site is the engine's call
 * (obs.scopeOf, applied by whoever has the engine: chrome-server and the pages): setUserNiche refuses to save a niche the
 * site does not have, and such a niche shows Todos.
 */
import { getUserNiche, setUserNiche } from '../niche-actions'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'

export type ObsSearchParams = Record<string, string | string[] | undefined>

export async function resolveNiche(searchParams: ObsSearchParams | undefined): Promise<{ niche: NicheScope; dropParam: boolean; /** the niche came from ?niche= (not from the saved preference) */ fromParam: boolean }> {
  const raw = searchParams?.niche
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value == null) return { niche: await getUserNiche(), dropParam: false, fromParam: false }
  const parsed = parseNiche(value)
  const saved = await getUserNiche()
  if (!parsed) return { niche: saved, dropParam: true, fromParam: false }
  if (parsed !== saved) await setUserNiche(parsed)
  return { niche: parsed, dropParam: false, fromParam: true }
}
