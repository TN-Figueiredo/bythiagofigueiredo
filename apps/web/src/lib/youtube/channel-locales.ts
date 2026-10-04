/**
 * Os idiomas que um canal próprio do YouTube pode ter. É o ÚNICO lugar que enumera essa lista para o cadastro
 * (formulário, cartão, validação das actions): um idioma novo entra aqui — e no CHECK de youtube_channels.locale.
 * Bandeira é país, não idioma: a tela mostra o chip de texto.
 */
export const CHANNEL_LOCALES = [
  { id: 'pt', chip: 'PT-BR', name: 'Português (Brasil)' },
  { id: 'en', chip: 'EN', name: 'English' },
] as const

export type ChannelLocale = (typeof CHANNEL_LOCALES)[number]['id']

export function isChannelLocale(raw: unknown): raw is ChannelLocale {
  return typeof raw === 'string' && CHANNEL_LOCALES.some(l => l.id === raw)
}

/** O chip e o nome de um idioma; um valor fora da lista (dado antigo) aparece como veio, em maiúsculas. Nunca lança. */
export function channelLocaleDef(id: string): { id: string; chip: string; name: string } {
  return CHANNEL_LOCALES.find(l => l.id === id) ?? { id, chip: id.toUpperCase(), name: id }
}
