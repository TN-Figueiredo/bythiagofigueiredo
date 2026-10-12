/**
 * A lista pequena de canais próprios do atalho "Meu canal" (spec 15.2). Pura e só com dados simples: chega ao componente cliente por prop.
 * Duas origens para a mesma lista (D15): o motor, nas telas que leem o site (`ownMenuOf`), e a leitura leve da página do canal, cujo conjunto
 * LANÇA em `ownChannels` (`ownMenuFromRows`, alimentada por `loadOwnMenuRows`). Um teste de paridade as mantém iguais.
 *
 * "O meu canal" (design D-C da 11c, que substitui a D16 do plano): com mais de um canal próprio, a escolha do dono vale (cookie
 * `obs-meu-canal`, `meu-canal-lembrado.ts`) e, sem escolha, vale o canal de publicação mais recente. `escolherPrincipal` é a ÚNICA fonte
 * dessa decisão: a lista de Canais, o atalho, a linha presa no pé, a comparação e a página do canal a chamam.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import { link } from '@/lib/youtube/observatorio/links'
import { DAY } from '@/lib/youtube/observatorio/time'
import { ownChannelHref } from './own-channels'
import { escolherPrincipal, JANELA_ATIVO_DIAS, type LinhaPrincipal } from './principal'

export { escolherPrincipal, JANELA_ATIVO_DIAS, type LinhaPrincipal } from './principal'

/** `href` null = canal sem vídeos: não tem página (16.8), aparece apagado no menu. */
export interface OwnMenuItem { id: string; name: string; nota: string; href: string | null }
/** `principal` = o "meu canal" (`escolherPrincipal`): o de "Comparar" e o do rótulo do botão. */
export interface OwnMenu { itens: OwnMenuItem[]; principal: OwnMenuItem | null; listaHref: string }

interface Linha extends LinhaPrincipal { name: string; subs: number | null }

/** "hoje", "há 3 dias", "há 2 semanas", "há 5 meses", "há 2 anos". Zero e futuro (estreia agendada) são "hoje": nunca "há 0 dias". */
export function haTempo(dias: number): string {
  const d = Math.floor(dias)
  if (d < 1) return 'hoje'
  if (d < 14) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
  if (d < 60) return `há ${Math.floor(d / 7)} semanas`
  if (d < 365) return `há ${Math.floor(d / 30)} meses`
  const a = Math.floor(d / 365)
  return `há ${a} ${a === 1 ? 'ano' : 'anos'}`
}

/** A nota de um item do menu (D-C.5): recência primeiro, que é com o que a pessoa escolhe o canal. */
export function notaDoCanal(l: Pick<Linha, 'videos' | 'ultimo' | 'subs'>, fmt: Pick<Fmt, 'subs'>, agora: number): string {
  const insc = l.subs == null ? 'inscritos ocultos' : `${fmt.subs(l.subs)} ${l.subs === 1 ? 'inscrito' : 'inscritos'}`
  if (l.videos <= 0) return `sem vídeos, ${insc}: ainda sem página`
  if (l.ultimo == null) return `vídeos sem data, ${insc}`
  const dias = (agora - l.ultimo) / DAY
  return `${dias > JANELA_ATIVO_DIAS ? 'parado: ' : ''}${dias < 1 ? 'último vídeo hoje' : `último vídeo ${haTempo(dias)}`}, ${insc}`
}

function itemDe(l: Linha, fmt: Pick<Fmt, 'subs'>, agora: number): OwnMenuItem {
  return { id: l.id, name: l.name, nota: notaDoCanal(l, fmt, agora), href: l.videos > 0 ? ownChannelHref(l.id) : null }
}

function menuDe(linhas: readonly Linha[], fmt: Pick<Fmt, 'subs'>, lembrado: string | null | undefined, agora: number): OwnMenu {
  const itens = linhas.map(l => itemDe(l, fmt, agora))
  const id = escolherPrincipal(linhas, lembrado, agora)
  return { itens, principal: itens.find(i => i.id === id) ?? null, listaHref: link.canais() }
}

/** Os canais próprios do motor, na ordem do motor, com o que a regra precisa. Lança em um conjunto de UM canal (`ownChannels`). */
export function linhasDoMotor(obs: Observatory): Linha[] {
  const contagem = new Map<string, number>(), ultimo = new Map<string, number>()
  for (const v of obs.videos) {
    contagem.set(v.ch, (contagem.get(v.ch) ?? 0) + 1)
    if (v.pub > (ultimo.get(v.ch) ?? -Infinity)) ultimo.set(v.ch, v.pub)
  }
  // vídeo sem data conta (canalTemVideos): `videos` é o que o canal guarda, e `ultimo` só olha os que têm data
  return obs.ownChannels().map(c => ({ id: c.id, name: c.name, subs: c.subs, videos: (contagem.get(c.id) ?? 0) + c.undated.length, ultimo: ultimo.get(c.id) ?? null }))
}

/** O id do "meu canal" para as telas que leem o site (a lista de Canais usa o mesmo que o atalho). */
export function principalDoMotor(obs: Observatory, lembrado: string | null | undefined): string | null {
  return escolherPrincipal(linhasDoMotor(obs), lembrado, obs.NOW)
}

/** Telas que leem o conjunto do site. Lança em um conjunto de UM canal (`ownChannels`): a página do canal usa `ownMenuFromRows`. */
export function ownMenuOf(obs: Observatory, lembrado: string | null | undefined = null): OwnMenu {
  return menuDe(linhasDoMotor(obs), obs.fmt, lembrado, obs.NOW)
}

/** Na ordem do motor (R73): inscritos, maior primeiro; depois nome (pt-BR); depois id. Sem contagem vai para o fim, como no motor. */
export function ownMenuFromRows(
  rows: ReadonlyArray<{ id: string; name: string; subs: number | null; videos: number; ultimo: number | null }>,
  fmt: Pick<Fmt, 'subs'>,
  { lembrado, agora }: { lembrado: string | null | undefined; agora: number },
): OwnMenu {
  const ordenadas = [...rows].sort((a, b) => (b.subs ?? -1) - (a.subs ?? -1) || a.name.localeCompare(b.name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return menuDe(ordenadas, fmt, lembrado, agora)
}
