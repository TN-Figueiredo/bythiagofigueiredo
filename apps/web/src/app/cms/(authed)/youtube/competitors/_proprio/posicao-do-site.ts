/**
 * A posição do canal próprio entre os canais do site e o concorrente "logo acima" dele (spec 16.2 e 16.3). Puro: recebe o conjunto do
 * site (`obs` de `openObservatoryPage`) e as views por dia já lidas (`extras`); não lê banco nem pede a prova de edição.
 *
 * Os números são os MESMOS da comparação (`numerosDoCanal`, nunca recalculados aqui): a posição de um canal é a mesma na lista de
 * Canais, na comparação e na página. O conjunto é o do nicho do canal (os próprios incluídos) ou, sem nicho, todos os canais do site
 * (emenda 45): o mesmo critério de `buildCanaisView`.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel } from '@/lib/youtube/observatorio/types'
import { posicoes, type Conjunto } from '@/lib/youtube/observatorio/posicao'
import { numerosDoCanal, type NumeroId } from '../_comparar/numeros-model'
import type { ExtrasProprio } from './extras'
import type { PosicaoNoNicho } from './header-model'

/** `acima` false = ninguém tem mais inscritos que o canal (ou ele os oculta): é o concorrente com mais inscritos, e o título do botão não diz "logo acima". */
export interface ConcorrenteAcima { id: string; name: string; acima: boolean }
export interface PosicaoDoSite { posicao: PosicaoNoNicho | null; concorrenteAcima: ConcorrenteAcima | null }

const NADA: PosicaoDoSite = { posicao: null, concorrenteAcima: null }
const POSICIONADOS = ['inscritos', 'medianaViews', 'longos90', 'vpdPorMil'] as const satisfies readonly NumeroId[]

export function posicaoDoSite(obs: Observatory, canalId: string, extras?: ExtrasProprio): PosicaoDoSite {
  const ch: ObsChannel | undefined = obs.channel(canalId)
  if (!ch || !ch.own) return NADA
  const conjunto: Conjunto = ch.niche ? { tipo: 'nicho', niche: ch.niche, label: obs.nicheLabel(ch.niche) } : { tipo: 'geral' }
  const doConjunto = obs.channels.filter(c => (ch.niche ? c.niche === ch.niche : true))
  // avisos de número inválido não vão ao Sentry daqui: a comparação e a lista já os mandam (um por requisição); aqui o número inválido só fica sem posição
  const numeros = new Map(doConjunto.map(c => [c.id, numerosDoCanal(obs, c.id, undefined, extras)]))
  const pos = (id: (typeof POSICIONADOS)[number]) =>
    posicoes(doConjunto.map(c => { const n = numeros.get(c.id)![id]; return { id: c.id, x: n.x, chave: n.texto ?? undefined } })).get(ch.id) ?? null
  return {
    posicao: { conjunto, inscritos: pos('inscritos'), medianaViews: pos('medianaViews'), longos90: pos('longos90'), vpdPorMil: pos('vpdPorMil') },
    concorrenteAcima: acimaDe(ch, doConjunto),
  }
}

/** O de menos inscritos entre os que têm MAIS que o canal (empate de inscritos: pelo nome, depois pelo id). Ninguém acima: o de mais inscritos. Sem concorrente: null. */
function acimaDe(ch: ObsChannel, conjunto: readonly ObsChannel[]): ConcorrenteAcima | null {
  const conc = conjunto.filter((c): c is ObsChannel & { subs: number } => !c.own && c.subs != null)
  const ordem = (a: ObsChannel, b: ObsChannel) => a.name.localeCompare(b.name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const acima = ch.subs == null ? [] : conc.filter(c => c.subs > ch.subs!).sort((a, b) => a.subs - b.subs || ordem(a, b))
  if (acima[0]) return { id: acima[0].id, name: acima[0].name, acima: true }
  const maior = [...conc].sort((a, b) => b.subs - a.subs || ordem(a, b))[0]
  return maior ? { id: maior.id, name: maior.name, acima: false } : null
}

/** Uma opção do formulário "Comparar com…": `acima` só no primeiro, e só quando ele É o logo acima em inscritos. */
export interface OpcaoConcorrente { id: string; name: string; acima: boolean }

/**
 * Os concorrentes que o formulário "Comparar com…" oferece: os do MESMO conjunto da posição (o critério do botão do cabeçalho). O concorrente logo
 * acima em inscritos vem primeiro (é o que o botão do cabeçalho abre); os outros, por inscritos (maior primeiro; sem contagem por último), nome e id.
 */
export function concorrentesDoSite(obs: Observatory, canalId: string): OpcaoConcorrente[] {
  const ch: ObsChannel | undefined = obs.channel(canalId)
  if (!ch || !ch.own) return []
  const doConjunto = obs.channels.filter(c => (ch.niche ? c.niche === ch.niche : true))
  const primeiro = acimaDe(ch, doConjunto)
  const nome = (a: ObsChannel, b: ObsChannel) => a.name.localeCompare(b.name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const resto = doConjunto.filter(c => !c.own && c.id !== primeiro?.id)
    .sort((a, b) => (a.subs == null ? 1 : 0) - (b.subs == null ? 1 : 0) || (b.subs ?? 0) - (a.subs ?? 0) || nome(a, b))
  return [
    ...(primeiro ? [{ id: primeiro.id, name: primeiro.name, acima: primeiro.acima }] : []),
    ...resto.map(c => ({ id: c.id, name: c.name, acima: false })),
  ]
}
