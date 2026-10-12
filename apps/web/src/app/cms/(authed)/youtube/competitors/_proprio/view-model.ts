/**
 * Modelo da página do canal próprio (spec 16): junta o cabeçalho, os vídeos e o estado da URL. Puro: recebe o dado privado JÁ LIDO
 * (`DadosDoCanal`) e as posições já calculadas no servidor; não lê banco, não pede a prova de edição e não importa os leitores (uma
 * varredura de teste barra). O que sai daqui é o QUE VAI PARA O NAVEGADOR: no estado `negado` ou `erro` nenhum número, série ou frase do
 * dado privado está na view (os modelos de baixo devolvem null com o motivo), e o token de edição não tem como chegar até aqui.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { parseCanalState, type CanalState } from '../_canal/params'
import type { DadosDoCanal } from './dados'
import { buildProprioHeader, type PosicaoNoNicho, type ProprioHeaderView } from './header-model'
import type { ConcorrenteAcima } from './posicao-do-site'
import { buildRetencao, type RetencaoView } from './retencao-model'
import { buildProprioVideos, type ProprioVideosView } from './videos-model'

export interface ProprioView {
  header: ProprioHeaderView
  videos: ProprioVideosView
  /** A aba Retenção = "% assistido" (A4 13.3). */
  retencao: RetencaoView
  state: CanalState
  /** "Comparar com…": a comparação com o concorrente logo acima em inscritos; null = sem concorrente (o botão não existe). */
  compararHref: string | null
  /** O `title` do botão: diz QUAL concorrente. */
  compararTitulo: string | null
  /** A frase de cada aba que ainda não tem conteúdo (spec 16.4). */
  abas: { trocas: string; leitura: string }
  /** A segunda linha de cada uma: o que a pessoa pode fazer ou o que vem depois. */
  abasNota: { trocas: string; leitura: string }
}

/** Spec 16.4 (D12 b: sem "lote" nem "L3" em tela). */
export const ABAS_PROPRIO = {
  trocas: 'Trocas dos seus vídeos ainda não são lidas nesta tela.',
  leitura: 'A leitura da forja para o seu canal ainda não existe.',
} as const

export const ABAS_PROPRIO_NOTA = {
  trocas: 'Os testes de título e thumbnail do seu canal ficam no A/B Lab.',
  leitura: 'Hoje a forja lê views públicas, títulos, thumbnails e trocas de concorrentes.',
} as const

export function buildProprioView(
  obs: Observatory, canalId: string, sp: Record<string, string | undefined>, dados: DadosDoCanal,
  o: { hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null; concorrenteAcima: ConcorrenteAcima | null; muitosProprios: boolean },
): ProprioView | null {
  const header = buildProprioHeader(obs, canalId, dados, { hoje: o.hoje, dm: o.dm, posicao: o.posicao, muitosProprios: o.muitosProprios })
  const videos = buildProprioVideos(obs, canalId, dados, { hoje: o.hoje, dm: o.dm })
  if (!header || !videos) return null
  const c = o.concorrenteAcima
  return {
    header, videos, retencao: buildRetencao(obs, canalId, dados, { dm: o.dm }), state: parseCanalState(sp, { own: true }),
    compararHref: c ? link.comparar(canalId, c.id) : null,
    compararTitulo: c
      ? (c.acima
        ? `Abre a comparação com ${c.name}, o concorrente logo acima de você em inscritos`
        : `Abre a comparação com ${c.name}, o concorrente com mais inscritos (nenhum está acima de você)`)
      : null,
    abas: { ...ABAS_PROPRIO }, abasNota: { ...ABAS_PROPRIO_NOTA },
  }
}
