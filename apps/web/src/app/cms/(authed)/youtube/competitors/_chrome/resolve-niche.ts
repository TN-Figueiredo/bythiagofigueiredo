/**
 * Global niche of the Observatório (CHROME.md "Nicho"): a valid ?niche= wins and is persisted; an invalid one is
 * ignored (the persisted niche is used) and the client removes it from the URL with router.replace.
 */
import { getUserNiche, setUserNiche } from '../niche-actions'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'

export type ObsSearchParams = Record<string, string | string[] | undefined>

export async function resolveNiche(searchParams: ObsSearchParams | undefined): Promise<{ niche: NicheScope; dropParam: boolean }> {
  const raw = searchParams?.niche
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value == null) return { niche: await getUserNiche(), dropParam: false }
  const parsed = parseNiche(value)
  if (!parsed) return { niche: await getUserNiche(), dropParam: true }
  await setUserNiche(parsed)
  return { niche: parsed, dropParam: false }
}
