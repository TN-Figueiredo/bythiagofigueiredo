// A5 · E5a, Tarefa 10a: a leitura "Estourou e parou" (M10), do dado da E4 para o que a tela escreve. Módulo puro: sem relógio (a data vem por
// parâmetro) e sem consulta. A tela lê estado, motivo e as constantes de regra; não refaz mediana nem condição (as três condições vêm prontas
// de `ValorPico.condicoes`). Toda frase nova, que o mockup 14 não traz, foi revista pelo Logan.
import { RULES } from '@/lib/youtube/observatorio/rules'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { FALTAS_DE_MARCA, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'
import type { ValorPico } from '@/lib/youtube/observatorio/medidas/pico'
import { aindaNaoExiste, INICIO_DAS_MARCAS, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'

/** As constantes de regra que a tela escreve (o motor é o dono delas; os componentes de `_historico/` não importam o motor). */
export const REGRAS_DA_LEITURA = {
  minDias: MEASURE_RULES.tail.minAgeDays, stillDias: MEASURE_RULES.tail.stillDays, stillMax: MEASURE_RULES.peak.stillMax,
  minVideos: RULES.medianMinN, outlierMin: RULES.outlierMin,
} as const
export { somaDias as somaDiasBR }

/** Nome da leitura na tela (dúvida 1 do mockup 14, padrão adotado: a opção A). */
export const NOME_DA_LEITURA = 'Estourou e parou'

/** Uma casa por sinal, na ordem: muitas views cedo, quase nada depois, pouca reação. v bate, n não bate, m não medido, p ainda não existe. */
export type Casa = 'v' | 'n' | 'm' | 'p'
export type Casas = `${Casa}${Casa}${Casa}`

export type MotivoDaLeitura = 'ao_vivo_ou_estreia' | 'sem_v30' | 'poucas_views' | 'poucos_videos' | 'menos_de_90_dias' | 'sem_reacao_publica' | 'serie_incompleta' | 'base_zero' | 'contagem_recuou' | 'sem_calculo'

export type PassaAExistir =
  | { tipo: 'nunca'; texto: string }
  | { tipo: 'data'; data: string; faltam: number }
  | { tipo: 'condicao'; texto: string }
  | { tipo: 'sem_promessa' }

export type Falta = { tipo: 'barra'; feitos: number; total: number; unidade: 'views' | 'dias'; legenda: string } | { tipo: 'bolas'; feitos: number; total: number; legenda: string }

export interface CartaoViewsCedo { vale: boolean; valor: number; normal: number; limite: number; razao: number; igual: boolean }
export interface CartaoQuaseNada {
  vale: boolean; valeCauda: boolean; valeRende: boolean
  cauda: number; normalCauda: number; limiteCauda: number; razaoCauda: number; igualCauda: boolean
  rende: number; ganho: number; limiteRende: number; igualRende: boolean
}
export interface CartaoReacao { vale: boolean; taxa: number; normal: number; limite: number; razao: number; igual: boolean; reacoes: number; views: number }

export interface DadosDoVideo {
  /** Dias inteiros no ar, a mesma conta da E4. */
  idadeDias: number
  canal: string
}

export type Leitura =
  | { tipo: 'ainda_nao_existe'; existeEm: string; hojeSP: string; casas: 'ppp' }
  | { tipo: 'nao_carregou' }
  | { tipo: 'nao_medido'; motivo: MotivoDaLeitura; casas: Casas; curta: string; titulo: string; explica: string | null; falta: Falta | null; passaAExistir: PassaAExistir; aoVivo: boolean }
  | { tipo: 'nao_e_o_caso' | 'estourou_e_parou'; casas: Casas; cartoes: { viewsCedo: CartaoViewsCedo; quaseNada: CartaoQuaseNada; reacao: CartaoReacao }; frase: string }

// ───── formatos ─────

/** 108.000 */
export const milhar = (x: number): string => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const dec = (x: number, casas: number): string => x.toFixed(casas).replace('.', ',')
/** 1,6% ; 0,05% ; 17% */
export function pct(x: number): string {
  const p = x * 100
  return (dec(p, p !== 0 && p < 0.1 ? 2 : 1)).replace(/,0$/, '') + '%'
}
/** 3,4× ; "menos de 0,1×" */
export const vezes = (x: number): string => (x < 0.05 ? 'menos de 0,1×' : dec(x, 1) + '×')
export const dataBR = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

const igualA = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))

// ───── a ordem dos motivos de 30 dias (pedidos P1 e P2 da E4 ainda não aceitos: a tela olha a marca de 30 dias antes de prometer uma data) ─────

type ClasseDe30 = 'definitivo' | 'baixo' | 'data' | 'falhou' | 'sem_promessa'
const FALTAS_QUE_NAO_MUDAM: readonly string[] = FALTAS_DE_MARCA

function classeDe30(m: Medida<ValorM1> | null | undefined): ClasseDe30 {
  if (!m) return 'sem_promessa'
  if (m.estado === 'medido') return m.valor.views < MEASURE_RULES.peak.minV30 ? 'baixo' : 'data'
  if (FALTAS_QUE_NAO_MUDAM.includes(m.motivo)) return 'definitivo'
  if (m.motivo === 'fecha_em' || m.motivo === 'aguardando_calculo') return 'data'
  if (m.motivo === 'leitura_falhou' || m.motivo === 'calculo_falhou') return 'falhou'
  return 'sem_promessa'
}

// ───── as frases (as do NOTAS 14, letra por letra; as novas levam a marca) ─────

const MIN_V30 = milhar(MEASURE_RULES.peak.minV30)
const DIAS_MIN = MEASURE_RULES.tail.minAgeDays
const CURTA: Record<MotivoDaLeitura, string> = {
  ao_vivo_ou_estreia: 'ao vivo e estreia ficam de fora',
  sem_v30: 'este vídeo não tem a medida dos 30 primeiros dias',
  poucas_views: `o vídeo teve menos de ${MIN_V30} views nos 30 primeiros dias`,
  poucos_videos: `o canal tem menos de ${RULES.medianMinN} vídeos longos para comparar`,
  menos_de_90_dias: `o vídeo ainda não tem ${DIAS_MIN} dias`,
  sem_reacao_publica: 'sem reação pública para comparar',
  serie_incompleta: 'faltam leituras diárias das últimas 4 semanas',
  base_zero: 'sem views no começo do período',
  contagem_recuou: 'o total de views diminuiu no período',
  sem_calculo: 'ainda não calculada',
}
const TITULO: Record<MotivoDaLeitura, string> = {
  ao_vivo_ou_estreia: 'Ao vivo e estreia ficam de fora.',
  sem_v30: 'Este vídeo não tem a medida dos 30 primeiros dias.',
  poucas_views: 'Poucas views para comparar.',
  poucos_videos: 'O canal ainda tem poucos vídeos para servir de normal.',
  menos_de_90_dias: `O vídeo ainda não tem ${DIAS_MIN} dias.`,
  sem_reacao_publica: 'Sem reação pública para comparar.',
  serie_incompleta: 'Faltam leituras diárias das últimas 4 semanas deste vídeo.',
  base_zero: 'O vídeo não tinha views no começo do período comparado.',
  contagem_recuou: 'O total de views do vídeo diminuiu durante o período lido; assim a conta não fecha.',
  sem_calculo: 'Esta leitura não foi calculada para este vídeo.',
}

/** Motivo sem data nem condição conhecida; a tela diz isso em vez de calar. */
const SEM_PREVISAO: PassaAExistir = { tipo: 'condicao', texto: 'sem previsão' }
const NUNCA = (texto = 'nunca para este vídeo'): PassaAExistir => ({ tipo: 'nunca', texto })

function naoMedido(motivo: MotivoDaLeitura, resto: { casas?: Casas; explica?: string | null; falta?: Falta | null; passaAExistir: PassaAExistir }): Leitura {
  return {
    tipo: 'nao_medido', motivo, casas: resto.casas ?? 'mmm', curta: CURTA[motivo], titulo: TITULO[motivo],
    explica: resto.explica ?? null, falta: resto.falta ?? null, passaAExistir: resto.passaAExistir, aoVivo: motivo === 'ao_vivo_ou_estreia',
  }
}

/** Marcas de 30 dias que o motor não tem porque a leitura começou depois: as únicas para as quais a frase "publicados antes de 03/10/2026" é verdade. */
const MARCA_COMECOU_DEPOIS: readonly string[] = ['leitura_comecou_depois', 'descoberto_tarde']

function semV30(m1aos30: Medida<ValorM1> | null | undefined, passa: PassaAExistir): Leitura {
  const explica = m1aos30 && m1aos30.estado === 'nao_medido' && MARCA_COMECOU_DEPOIS.includes(m1aos30.motivo)
    ? `Os vídeos publicados antes de ${dataBR(INICIO_DAS_MARCAS)} não a têm: começamos a guardá-la nessa data.`
    : null
  return naoMedido('sem_v30', { explica, passaAExistir: passa })
}

function medidoParaTela(v: ValorPico): Leitura {
  const n = v.numeros
  const c = v.condicoes
  const limiteViews = RULES.outlierMin * n.medianaV30
  const limiteCauda = MEASURE_RULES.peak.tailShare * n.medianaCauda
  const limiteRende = MEASURE_RULES.peak.stillMax
  const limiteReacao = MEASURE_RULES.peak.reactionShare * n.medianaReacao
  const valeCauda = n.cauda <= limiteCauda
  const valeRende = n.aindaRende <= limiteRende
  const viewsCedo: CartaoViewsCedo = { vale: c.muitasViewsCedo, valor: n.v30, normal: n.medianaV30, limite: limiteViews, razao: n.v30 / n.medianaV30, igual: igualA(n.v30, limiteViews) }
  const quaseNada: CartaoQuaseNada = {
    vale: c.quaseNadaDepois, valeCauda, valeRende,
    cauda: n.cauda, normalCauda: n.medianaCauda, limiteCauda, razaoCauda: n.cauda / n.medianaCauda, igualCauda: igualA(n.cauda, limiteCauda),
    rende: n.aindaRende, ganho: Math.round(n.aindaRende * n.v30), limiteRende, igualRende: igualA(n.aindaRende, limiteRende),
  }
  const reacao: CartaoReacao = {
    vale: c.poucaReacao, taxa: n.reacao, normal: n.medianaReacao, limite: limiteReacao, razao: n.reacao / n.medianaReacao, igual: igualA(n.reacao, limiteReacao),
    reacoes: Math.round(n.reacao * n.v30), views: n.v30,
  }
  const casas = ((c.muitasViewsCedo ? 'v' : 'n') + (c.quaseNadaDepois ? 'v' : 'n') + (c.poucaReacao ? 'v' : 'n')) as Casas
  const cartoes = { viewsCedo, quaseNada, reacao }
  if (v.leitura === 'pico_sem_cauda') {
    return { tipo: 'estourou_e_parou', casas, cartoes, frase: 'Os 3 sinais batem: muitas views cedo, quase nada depois e pouca reação do público.' }
  }
  const motivos: string[] = []
  if (!c.muitasViewsCedo) motivos.push('as views dos 30 primeiros dias não chegaram a 2× o normal')
  if (!valeCauda) motivos.push(`a parte das views depois do dia 30 (${pct(n.cauda)}) ficou acima do limite de ${pct(limiteCauda)}`)
  else if (!valeRende) motivos.push(`o vídeo ainda rende ${pct(n.aindaRende)} nos últimos 28 dias, acima do limite de ${pct(limiteRende)}`)
  if (!c.poucaReacao) motivos.push(`a reação do público (${pct(n.reacao)} das views) ficou acima do limite de ${pct(limiteReacao)}`)
  const batem = [c.muitasViewsCedo, c.quaseNadaDepois, c.poucaReacao].filter(Boolean).length
  // O mockup 14 desenha só "2 de 3"; as frases de 1 e de 0 sinais foram revistas pelo Logan.
  const abre = batem === 2 ? 'Só 2 dos 3 sinais batem, então não é o caso:' : batem === 1 ? 'Só 1 dos 3 sinais bate, então não é o caso:' : 'Nenhum dos 3 sinais bate, então não é o caso:'
  return { tipo: 'nao_e_o_caso', casas, cartoes, frase: `${abre} ${motivos.join('; ')}.` }
}

/**
 * A leitura de um vídeo. `m10` nulo = a medida não veio (não carregou), nunca "não é o caso". `m1aos30` é `porVideo.get(id).m1[30]`: enquanto a E4 não
 * devolver os motivos na ordem do NOTAS 14 (pedido P1), é ele que decide qual motivo de 30 dias a tela mostra. Sem o `parcial` do pedido P2, "sem
 * reação pública" é três casas em hachura (nunca ✓ ✓ ✕).
 */
export function leituraDoVideo(m10: Medida<ValorPico> | null | undefined, m1aos30: Medida<ValorM1> | null | undefined, hojeSP: string, video: DadosDoVideo): Leitura {
  const antes = aindaNaoExiste('estourou', hojeSP)
  if (antes) return { tipo: 'ainda_nao_existe', existeEm: antes.existeEm, hojeSP, casas: 'ppp' }
  if (!m10) return { tipo: 'nao_carregou' }
  if (m10.estado === 'medido') return medidoParaTela(m10.valor)
  switch (m10.motivo) {
    case 'ao_vivo_ou_estreia':
      return naoMedido('ao_vivo_ou_estreia', { explica: 'O pico desses vídeos vem da data marcada, então a leitura não se aplica a eles.', passaAExistir: NUNCA() })
    case 'poucas_views':
      return poucasViews(m1aos30)
    case 'sem_v30':
    case 'idade_menor_que_90': {
      const classe = classeDe30(m1aos30)
      if (classe === 'falhou') return { tipo: 'nao_carregou' }
      if (m10.motivo === 'sem_v30') return semV30(m1aos30, classe === 'definitivo' ? NUNCA() : { tipo: 'sem_promessa' })
      if (classe === 'definitivo') return semV30(m1aos30, NUNCA())
      if (classe === 'baixo') return poucasViews(m1aos30)
      if (classe === 'data') return menosDe90(video)
      return semV30(m1aos30, { tipo: 'sem_promessa' })
    }
    case 'poucos_videos': {
      const tem = m10.n ?? 0
      const total = m10.minimo ?? RULES.medianMinN
      return naoMedido('poucos_videos', {
        explica: `${video.canal} tem ${tem} ${tem === 1 ? 'vídeo longo' : 'vídeos longos'} com ${DIAS_MIN} dias e a medida dos 30 dias; a leitura compara com o canal e pede ${total}.`,
        falta: { tipo: 'bolas', feitos: tem, total, legenda: `${tem} de ${total}, faltam ${Math.max(0, total - tem)}` },
        passaAExistir: { tipo: 'condicao', texto: `quando o canal tiver ${total} vídeos longos com ${DIAS_MIN} dias e a medida dos 30 dias` },
      })
    }
    case 'sem_reacao_publica':
      // sem o `parcial` (pedido P2): três casas em hachura; os cartões 1 e 2 não são desenhados
      return naoMedido('sem_reacao_publica', {
        explica: 'Curtidas ocultas e comentários desligados: nenhum número de reação, nem zero.',
        passaAExistir: { tipo: 'condicao', texto: 'se o canal mostrar as curtidas ou ligar os comentários' },
      })
    case 'serie_diaria_incompleta':
      return naoMedido('serie_incompleta', { passaAExistir: SEM_PREVISAO })
    case 'base_zero':
      return naoMedido('base_zero', { passaAExistir: SEM_PREVISAO })
    case 'contagem_recuou':
      return naoMedido('contagem_recuou', { passaAExistir: SEM_PREVISAO })
    case 'leitura_falhou':
    case 'calculo_falhou':
    case 'serie_nao_pedida':
      return { tipo: 'nao_carregou' }
    default:
      return naoMedido('sem_calculo', { passaAExistir: { tipo: 'sem_promessa' } })
  }

  function poucasViews(m1: Medida<ValorM1> | null | undefined): Leitura {
    const v30 = m1 && m1.estado === 'medido' ? m1.valor.views : null
    const minimo = MEASURE_RULES.peak.minV30
    return naoMedido('poucas_views', {
      explica: v30 === null ? null : `Nos 30 primeiros dias o vídeo teve ${milhar(v30)} views; a leitura pede ${milhar(minimo)}.`,
      falta: v30 === null ? null : { tipo: 'barra', feitos: v30, total: minimo, unidade: 'views', legenda: `${milhar(v30)} de ${milhar(minimo)}` },
      passaAExistir: NUNCA('nunca para este vídeo (a medida dos 30 primeiros dias não muda)'),
    })
  }
  function menosDe90(v: DadosDoVideo): Leitura {
    const faltam = Math.max(0, DIAS_MIN - v.idadeDias)
    return naoMedido('menos_de_90_dias', {
      explica: `O vídeo tem ${v.idadeDias} dias; a leitura pede ${DIAS_MIN}.`,
      falta: { tipo: 'barra', feitos: Math.min(v.idadeDias, DIAS_MIN), total: DIAS_MIN, unidade: 'dias', legenda: `${v.idadeDias} de ${DIAS_MIN} dias, faltam ${faltam}` },
      passaAExistir: { tipo: 'data', data: somaDias(hojeSP, faltam), faltam },
    })
  }
}
