/**
 * A lista pequena de canais próprios do atalho "Meu canal" (spec 15.2). Pura e só com dados simples: chega ao componente cliente por prop.
 * Duas origens para a mesma lista (D15): o motor, nas telas que leem o site (`ownMenuOf`), e a leitura leve da página do canal, cujo conjunto
 * LANÇA em `ownChannels` (`ownMenuFromRows`, alimentada por `loadOwnMenuRows`). Um teste de paridade as mantém iguais.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import { link } from '@/lib/youtube/observatorio/links'
import { ownChannelHref } from './own-channels'

/** `href` null = canal sem vídeos: não tem página (16.8), aparece apagado no menu. */
export interface OwnMenuItem { id: string; name: string; nota: string; href: string | null }
/** `principal` = o primeiro com vídeos na ordem do motor (D16): o "meu canal" de "Comparar" e o rótulo do botão. */
export interface OwnMenu { itens: OwnMenuItem[]; principal: OwnMenuItem | null; listaHref: string }

interface Linha { id: string; name: string; subs: number | null; videos: number }

function itemDe(l: Linha, fmt: Pick<Fmt, 'subs'>): OwnMenuItem {
  const insc = l.subs == null ? 'inscritos ocultos' : `${fmt.subs(l.subs)} ${l.subs === 1 ? 'inscrito' : 'inscritos'}`
  return l.videos > 0
    ? { id: l.id, name: l.name, nota: `${l.videos} ${l.videos === 1 ? 'vídeo' : 'vídeos'}, ${insc}`, href: ownChannelHref(l.id) }
    : { id: l.id, name: l.name, nota: `sem vídeos, ${insc}: ainda sem página`, href: null }
}

function menuDe(linhas: readonly Linha[], fmt: Pick<Fmt, 'subs'>): OwnMenu {
  const itens = linhas.map(l => itemDe(l, fmt))
  return { itens, principal: itens.find(i => i.href != null) ?? null, listaHref: link.canais() }
}

/** Telas que leem o conjunto do site. Lança em um conjunto de UM canal (`ownChannels`): a página do canal usa `ownMenuFromRows`. */
export function ownMenuOf(obs: Observatory): OwnMenu {
  const contagem = new Map<string, number>()
  for (const v of obs.videos) contagem.set(v.ch, (contagem.get(v.ch) ?? 0) + 1)
  return menuDe(obs.ownChannels().map(c => ({ id: c.id, name: c.name, subs: c.subs, videos: contagem.get(c.id) ?? 0 })), obs.fmt)
}

/** Na ordem do motor (R73): inscritos, maior primeiro; depois nome (pt-BR); depois id. Sem contagem vai para o fim, como no motor. */
export function ownMenuFromRows(rows: ReadonlyArray<{ id: string; name: string; subs: number | null; videos: number }>, fmt: Pick<Fmt, 'subs'>): OwnMenu {
  const ordenadas = [...rows].sort((a, b) => (b.subs ?? -1) - (a.subs ?? -1) || a.name.localeCompare(b.name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return menuDe(ordenadas, fmt)
}
