/**
 * Own channels on the Observatório screens (port of canais.html LANG / langTag / OWN_TXT). Pure: used by Canais and
 * by Insights. A site may have zero, one or many own channels; the sentences agree with how many there are.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
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

/** Na linha do canal próprio sem vídeos (lista de Canais): o motivo de a linha não abrir nada (spec 16.8: "sem vídeos"; o menu "Meu canal" diz o mesmo). */
export const SEM_PAGINA_LINHA = 'sem vídeos: ainda sem página'
/** A frase da moldura de `canal/<id>` do canal próprio sem vídeos (D10). */
export const SEM_VIDEOS_FRASE = 'Este canal ainda não tem vídeos. A página aparece com o primeiro vídeo sincronizado.'

/**
 * O critério ÚNICO de "o canal tem vídeos" (e, para canal próprio, "tem página", spec 16.8): vídeo guardado conta, com ou sem data. O vídeo sem
 * data fica fora de `obs.videos` e vive em `canal.undated`; a rota, o redirecionamento de `?channel=`, a lista de Canais, o menu "Meu canal"
 * e a comparação perguntam aqui, nunca contam por conta própria.
 */
export function canalTemVideos(obs: Pick<Observatory, 'channel' | 'videos'>, id: string): boolean {
  const c = obs.channel(id)
  if (!c) return false
  return c.undated.length > 0 || obs.videos.some(v => v.ch === id)
}
