/**
 * Modelo da página do canal próprio (spec 16): junta o cabeçalho, os vídeos e o estado da URL. Puro: recebe o dado privado JÁ LIDO
 * (`DadosDoCanal`) e as posições já calculadas no servidor; não lê banco, não pede a prova de edição e não importa os leitores (uma
 * varredura de teste barra). O que sai daqui é o QUE VAI PARA O NAVEGADOR: no estado `negado` ou `erro` nenhum número, série ou frase do
 * dado privado está na view (os modelos de baixo devolvem null com o motivo), e o token de edição não tem como chegar até aqui.
 */
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import { normalDaFaixaNoPeriodo, normalDoPeriodo, normalSemLeitura, type NormalDoPeriodo, type PeriodoAssistido } from '@/lib/youtube/observatorio/proprio/assistido-periodo'
import { FAIXAS } from '@/lib/youtube/observatorio/proprio/assistido'
import { totalDoPeriodo, type DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { DiarioCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { parseCanalState, type CanalState } from '../_canal/params'
import { buildAssistidoPeriodos, type AssistidoPeriodosView } from './assistido-periodo-model'
import type { DadosDoCanal, DiarioLongo } from './dados'
import type { PeriodoEntrada } from './origem-model'
import type { NegativaPrivada } from '../_chrome/ausencia/estado'
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
  o: { hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null; concorrenteAcima: ConcorrenteAcima | null; muitosProprios: boolean; negativa?: NegativaPrivada },
): ProprioView | null {
  const header = buildProprioHeader(obs, canalId, dados, { hoje: o.hoje, dm: o.dm, posicao: o.posicao, muitosProprios: o.muitosProprios, negativa: o.negativa })
  const videos = buildProprioVideos(obs, canalId, dados, { hoje: o.hoje, dm: o.dm, negativa: o.negativa })
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

/* ------------------------------------------------------------------------------------------------------------------------------------------
 * E5b T17: as entradas puras das duas leituras que a página do canal faz DEPOIS do primeiro HTML (cada uma num `Suspense`): os três períodos do
 * "% assistido" da aba Retenção (17a) e a origem das views da aba Origem (17b). A página só lê e chama estas funções.
 * ------------------------------------------------------------------------------------------------------------------------------------------ */

const dmySimples = (d: DiaYt): string => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)

/**
 * Os três cartões de "% assistido por período" do CANAL (aba Retenção). `ytIds`: os longos acompanhados (a regra da A4); `videos`: os mesmos, com a
 * duração, para as três faixas de cada período. `longo` é o que `lerDiarioLongo` leu; nulo = o canal ainda não tem diário. O `comBuraco` de cada período
 * vem de `totalDoPeriodo` e é nulo com a cobertura desconhecida. Nada daqui lança.
 */
export function buildAssistidoDoCanal(a: { ytIds: readonly string[]; videos: ReadonlyArray<{ ytId: string; dur: number | null }>; diario: DiarioCanal; longo: Privado<DiarioLongo> | null; negativa?: NegativaPrivada }): AssistidoPeriodosView {
  const base = { tela: 'canal' as const, videoPct: null, dm: (d: DiaYt) => d.slice(8, 10) + '/' + d.slice(5, 7), dmy: dmySimples }
  const porPeriodo = <T,>(f: (p: PeriodoAssistido) => T): Record<PeriodoAssistido, T> => ({ inteiro: f('inteiro'), '90': f('90'), '28': f('28') })
  const faixasSemLeitura = (motivo: 'sem-acesso' | 'leitura-falhou' | 'sem-diario') => porPeriodo(p => FAIXAS.map(f => ({ faixa: f.id, normal: normalSemLeitura(p, motivo) })))
  if (a.longo === null || a.longo.acesso !== 'ok') {
    const motivo = a.longo === null ? 'sem-diario' : a.longo.acesso === 'negado' ? 'sem-acesso' : 'leitura-falhou'
    const acesso = a.longo === null ? 'ok' : a.longo.acesso === 'negado' ? 'negado' : 'erro'
    return buildAssistidoPeriodos({ ...base, acesso, negativa: a.negativa, normais: porPeriodo(p => normalSemLeitura(p, motivo)), faixas: faixasSemLeitura(motivo), buracos: porPeriodo(() => null), diarioDesde: null, ultimoDia: null })
  }
  const { d90, inteiro, motivoInteiro } = a.longo.dado
  const ate = d90.ate
  const linhasDe = (d: DiarioDoPeriodo) => d.linhas.map(l => ({ ytId: l.ytId, dia: l.dia, views: l.views, pctAssistido: l.pctAssistido, duracaoMediaSeg: null }))
  const l90 = linhasDe(d90), lInteiro = inteiro ? linhasDe(inteiro) : null
  const buraco = (d: DiarioDoPeriodo, de: DiaYt | null): { comBuraco: number; naConta: number } | null => {
    if (!d.cobertura.conhecida) return null
    const t = totalDoPeriodo(d, { de, ate })
    return { comBuraco: t.comBuraco, naConta: t.videosNaConta }
  }
  const bu: Record<PeriodoAssistido, { comBuraco: number; naConta: number } | null> = { '28': buraco(d90, addDays(ate, -27)), '90': buraco(d90, d90.de), inteiro: inteiro ? buraco(inteiro, null) : null }
  const linhas = (p: PeriodoAssistido) => (p === 'inteiro' ? lInteiro : l90)
  // o diário inteiro não foi lido: teto é permanente ("não medido"), erro é passageiro
  const semInteiro: NormalDoPeriodo = motivoInteiro === 'teto' ? { ...normalSemLeitura('inteiro', 'sem-diario'), motivo: 'acima-do-teto' } : normalSemLeitura('inteiro', 'leitura-falhou')
  const normais = porPeriodo(p => { const l = linhas(p); return l ? normalDoPeriodo(l, a.ytIds, p, ate, bu[p]?.comBuraco ?? null) : semInteiro })
  const faixas = porPeriodo(p => { const l = linhas(p); return l ? normalDaFaixaNoPeriodo(l, a.videos, p, ate, bu[p]?.comBuraco ?? null) : FAIXAS.map(f => ({ faixa: f.id, normal: semInteiro })) })
  // o diário começa depois da publicação mais antiga (C-10): o primeiro cartão se chama "Desde dd/mm/aaaa", nunca "Canal inteiro"
  const primeiro = inteiro?.cobertura.primeiroDiaLido ?? null
  let maisAntiga: DiaYt | null = null
  for (const p of (inteiro ?? d90).cobertura.publicacoes.values()) if (p != null && (maisAntiga == null || p < maisAntiga)) maisAntiga = p
  const diarioDesde = primeiro != null && maisAntiga != null && primeiro > maisAntiga ? primeiro : null
  return buildAssistidoPeriodos({ ...base, acesso: 'ok', normais, faixas, buracos: bu, diarioDesde, ultimoDia: a.diario.ultimoDia })
}

/** A janela das dimensões e do diário curto da origem do CANAL: 90 dias até `ate`; "Desde {ano}" amplia a janela até a publicação mais antiga, sem passar do começo da coleta. */
export function janelaDaOrigemDoCanal(a: { ate: DiaYt; maisAntiga: DiaYt | null; ligadoEm: DiaYt }): { de: DiaYt; diarioDesde: DiaYt } {
  const noventa = addDays(a.ate, -89)
  const piso = a.ligadoEm < noventa ? a.ligadoEm : noventa
  const desde = a.maisAntiga != null && a.maisAntiga <= a.ate ? (a.maisAntiga > piso ? a.maisAntiga : piso) : noventa
  return { de: desde > noventa ? noventa : desde, diarioDesde: noventa }
}

/** A publicação mais antiga entre os vídeos do canal que o Observatório traz (nula se nenhum tem data). */
export function publicacaoMaisAntiga(obs: { videos: ReadonlyArray<{ ch: string; pub: number | null | undefined }> }, canalId: string, dia: (ms: number) => DiaYt): DiaYt | null {
  let m: DiaYt | null = null
  for (const v of obs.videos) {
    if (v.ch !== canalId || v.pub == null || !Number.isFinite(v.pub)) continue
    const d = dia(v.pub)
    if (m == null || d < m) m = d
  }
  return m
}

const contagemDe = (t: ReturnType<typeof totalDoPeriodo>): PeriodoEntrada['videosDoTotal'] => ({ naConta: t.videosNaConta, fora: t.videosFora, parados: t.videosParados, paradosDesde: t.paradosDesde, comBuraco: t.comBuraco })

/**
 * Os períodos da origem do canal: 7, 28 e 90 dias e "Desde {ano}" (o ano da publicação mais antiga; sem vídeo com data, o período longo não é oferecido).
 * Cada total é `totalDoPeriodo` do SEU período, sobre o diário dos mesmos vídeos da divisão; nunca o contador público do canal.
 */
export function periodosDaOrigemDoCanal(a: { ate: DiaYt; maisAntiga: DiaYt | null; diario: DiarioDoPeriodo | null; diarioInteiro: DiarioDoPeriodo | null }): PeriodoEntrada[] {
  const curtos = ([['7', '7 dias', 6], ['28', '28 dias', 27], ['90', '90 dias', 89]] as const).map(([id, rotulo, dias]): PeriodoEntrada => {
    const de = addDays(a.ate, -dias)
    const t = a.diario ? totalDoPeriodo(a.diario, { de, ate: a.ate }) : null
    return { id, rotulo, de, ate: a.ate, totalDoPeriodo: t?.total ?? null, videosDoTotal: t ? contagemDe(t) : null }
  })
  if (a.maisAntiga == null || a.maisAntiga > a.ate) return curtos
  const tt = a.diarioInteiro ? totalDoPeriodo(a.diarioInteiro, { de: null, ate: a.ate }) : null
  return [...curtos, { id: 'tudo', rotulo: `Desde ${a.maisAntiga.slice(0, 4)}`, de: a.maisAntiga, ate: a.ate, totalDoPeriodo: tt?.total ?? null, videosDoTotal: tt ? contagemDe(tt) : null }]
}
