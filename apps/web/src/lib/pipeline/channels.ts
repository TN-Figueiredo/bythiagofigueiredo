export interface Channel {
  lang: 'pt' | 'en'
  name: string
  flag: string
  label: string
}

// Site-level channel display config (seeded from site settings). NOT per-video.
export const CHANNELS: readonly Channel[] = [
  { lang: 'pt', name: 'tnFigueiredo', flag: '🇧🇷', label: 'PT-BR' },
  { lang: 'en', name: 'Thiago Figueiredo', flag: '🇺🇸', label: 'EN' },
] as const

export function channelByLang(lang: 'pt' | 'en') {
  return CHANNELS.find((c) => c.lang === lang)
}
