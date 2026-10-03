export type OwnPreset = '1' | '2' | '5' | 'mix' | 'zero'
// Cópia de PRESETS de mockup.js (docs/superpowers/mockups/2026-10-03-observatorio-seus-canais). Sem import.meta e sem caminho de arquivo: o Playwright compila em CommonJS.
export const OWN_PRESETS: Record<OwnPreset, { ids: string[]; none: string[] }> = {
  '1':    { ids: ['tnfigueiredo'], none: [] },
  '2':    { ids: ['tnfigueiredo', 'tnfigueiredo-en'], none: [] },
  '5':    { ids: ['tnfigueiredo', 'tnfigueiredo-en', 'thiago-na-estrada', 'slow-roads', 'mochila-leve'], none: [] },
  'mix':  { ids: ['tnfigueiredo', 'tnfigueiredo-en', 'thiago-na-estrada', 'thiago-testa-ia', 'mochila-leve'], none: ['mochila-leve'] },
  'zero': { ids: ['thiago-testa-ia', 'mochila-leve'], none: ['mochila-leve'] },
}
/** Ids dos canais que segundo-canal.js acrescenta ao oráculo. */
export const OWN_EXTRA_IDS = ['tnfigueiredo-en', 'thiago-na-estrada', 'slow-roads', 'thiago-testa-ia', 'mochila-leve'] as const
export interface PresetOracle { channels: Array<{ id: string; own?: boolean; niche: string | null }>; videos: Array<{ ch: string; niche?: string | null }> }
/** Como mockup.js: tira (in place) os canais próprios fora do preset e os vídeos deles; canais em `none` ficam com niche null (e os vídeos deles também). Devolve o mesmo objeto. */
export function applyOwnPreset<T extends PresetOracle>(o: T, preset: OwnPreset): T {
  const P = OWN_PRESETS[preset]
  const removed = new Set<string>()
  for (let i = o.channels.length - 1; i >= 0; i--) {
    const c = o.channels[i]!
    if (c.own && !P.ids.includes(c.id)) { removed.add(c.id); o.channels.splice(i, 1) }
  }
  for (let j = o.videos.length - 1; j >= 0; j--) if (removed.has(o.videos[j]!.ch)) o.videos.splice(j, 1)
  for (const c of o.channels) if (P.none.includes(c.id)) c.niche = null
  for (const v of o.videos) if (P.none.includes(v.ch)) v.niche = null
  return o
}
