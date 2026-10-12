/**
 * Own channels on the Observatório screens (port of canais.html LANG / langTag / OWN_TXT). Pure: used by Canais and
 * by Insights. A site may have zero, one or many own channels; the sentences agree with how many there are.
 */
import { link } from '@/lib/youtube/observatorio/links'

export interface LangChip { code: string; title: string }

const LANG = new Map<string, LangChip>([
  ['pt', { code: 'PT', title: 'Canal em português' }],
  ['en', { code: 'EN', title: 'Canal em inglês' }],
])

/**
 * Language mark beside the name of an own channel: only when the site has more than one own channel.
 * pt → { 'PT', 'Canal em português' }; en → { 'EN', 'Canal em inglês' }; any other value → null.
 */
export function langChip(lang: string, many: boolean): LangChip | null {
  if (!many) return null
  const l = LANG.get(lang)
  return l ? { ...l } : null
}

export interface OwnTexts { slot: string; count: string; sync: string }
/** One own channel (or none) reads in the singular; more than one, in the plural. */
export function ownTexts(many: boolean): OwnTexts {
  return many
    ? { slot: 'os seus canais não ocupam vaga', count: 'os seus canais não contam', sync: 'Seus canais não entram nesta rodada; eles sincronizam pelo Painel.' }
    : { slot: 'o seu canal não ocupa vaga', count: 'o seu canal não conta', sync: 'Seu canal não entra nesta rodada; ele sincroniza pelo Painel.' }
}

/** "A", "A e B", "A, B e C". */
export function listPt(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

/**
 * Para onde "Abrir meu canal" leva: a PÁGINA do canal (A4, D9; na A3 era o painel lateral de Canais, porque o canal próprio ainda não tinha página).
 * Todo link para "o meu canal" passa por aqui. Canal sem vídeos não tem página: quem monta o link já o deixa de fora.
 */
export function ownChannelHref(id: string): string {
  return link.canal(id)
}
