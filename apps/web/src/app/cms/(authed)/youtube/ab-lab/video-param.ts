// `?video=<ytId>` da página do A/B Lab (links do sino e do e-mail). O id vira filtro de tela, nunca de consulta:
// fora do formato do YouTube (11 caracteres) é descartado antes de qualquer leitura.
const FORMATO_YT_ID = /^[A-Za-z0-9_-]{11}$/

export function videoDaUrl(bruto: string | string[] | undefined): string | null {
  if (typeof bruto !== 'string') return null
  return FORMATO_YT_ID.test(bruto) ? bruto : null
}
