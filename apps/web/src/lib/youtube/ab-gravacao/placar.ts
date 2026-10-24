// Placar do A/B Lab a partir de `ab_test_dias` (S8-F3). Funções puras, sem I/O.
// Regra única: nulo quer dizer não medido. Nunca entra em soma nem vira 0.
import { z } from 'zod'
import { addDays, dayPt } from '../coleta/day-pt'
import type { EstadoAlcance, EstadoViews, MotivoSemVariante } from './tipos'

const ESTADOS_ALCANCE = ['medido', 'zero_medido', 'ausente_no_relatorio', 'aguardando', 'nao_medido'] as const
const ESTADOS_VIEWS = ['medido', 'zero_medido', 'nao_medido'] as const
const MOTIVOS = ['menos_de_90', 'meta_ausente', 'meta_nula', 'dia_de_outro_teste', 'teste_apagado'] as const

export interface LinhaDiaPlacar {
  test_id: string
  day_pt: string
  site_id: string
  variant_id: string | null
  motivo_sem_variante: MotivoSemVariante | null
  alcance_estado: EstadoAlcance
  impressoes: number | null
  ctr: number | null // em [0, 1]
  views: number | null
  views_estado: EstadoViews
  retratado_em: string
  final: boolean
}

// `numeric` pode chegar como texto. Só null, número e string numérica passam;
// o resto segue cru para o z.number() recusar (ausência nunca vira dado).
const numeroOuNulo = (v: unknown): unknown =>
  v === null
    ? null
    : typeof v === 'number'
      ? v
      : typeof v === 'string' && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v.trim())
        ? Number(v)
        : v

const contagem = z.preprocess(numeroOuNulo, z.number().finite().int().nonnegative().nullable())
const taxa = z.preprocess(numeroOuNulo, z.number().finite().min(0).max(1).nullable())

export const LinhaDiaPlacarSchema: z.ZodType<LinhaDiaPlacar, z.ZodTypeDef, unknown> = z
  .object({
    test_id: z.string(),
    day_pt: z.string(),
    site_id: z.string(),
    variant_id: z.string().nullable(),
    motivo_sem_variante: z.enum(MOTIVOS).nullable(),
    alcance_estado: z.enum(ESTADOS_ALCANCE),
    impressoes: contagem,
    ctr: taxa,
    views: contagem,
    views_estado: z.enum(ESTADOS_VIEWS),
    retratado_em: z.string(),
    final: z.boolean(),
  })
  .strict()

export const COLUNAS_DO_PLACAR =
  'test_id, day_pt, site_id, variant_id, motivo_sem_variante, alcance_estado, impressoes, ctr, views, views_estado, retratado_em, final'

export function diaComAlcanceValido(d: Pick<LinhaDiaPlacar, 'alcance_estado' | 'impressoes' | 'ctr'>): boolean {
  return d.alcance_estado === 'medido' && d.impressoes !== null && d.impressoes > 0 && d.ctr !== null
}

export function diaValido(d: Pick<LinhaDiaPlacar, 'alcance_estado' | 'impressoes' | 'ctr' | 'variant_id'>): boolean {
  return d.variant_id !== null && diaComAlcanceValido(d)
}

/** Dia civil de `d` em America/Los_Angeles. */
/** `regra_duracao` não está nos tipos gerados (K4); ausente vale 'v1'. Valor inválido lança (falha alta, nunca regra errada em silêncio).
 *  Na lista o `throw` seria inalcançável: CHECK + NOT NULL da migration 20261018000004. */
export function regraDoTeste(row: unknown): 'v1' | 'v2' {
  const bruta = (row as { regra_duracao?: unknown }).regra_duracao
  if (bruta === undefined || bruta === null) return 'v1'
  const p = z.enum(['v1', 'v2']).safeParse(bruta)
  if (!p.success) throw new Error('ab_lab_leitura: ab_tests: regra_duracao inválida')
  return p.data
}

export function diaPt(d: Date): string {
  return dayPt(d)
}

/**
 * O par para taxa e estatística é (`impressoes_com_ctr`, `cliques`); `impressoes` é só exibição.
 * `cliques` é `null` quando o clique é desconhecido (impressões sem CTR), nunca 0 (D-F3-3).
 * `impressoes_com_ctr` é `null` se e somente se `impressoes === null` (sem dia de volume); 0 é 0 sabido ou volume sem CTR.
 */
export interface PlacarVariante {
  variant_id: string
  dias: number
  dias_validos: number
  dias_zero: number
  dias_ausentes: number
  dias_aguardando: number
  dias_nao_medidos: number
  dias_fora_do_ctr: number
  impressoes: number | null
  impressoes_com_ctr: number | null
  cliques: number | null
  ctr: number | null
  views: number | null
}

export interface Placar {
  regra: 'v1' | 'v2'
  estatistica: 'nao_calculada' | 'calculada'
  variantes: PlacarVariante[]
  dias_total: number
  dias_descartados: number
  dias_variante_desconhecida: number
  atualizado_em: string | null
  desatualizado: boolean
  atrasado: boolean
  todos_finais: boolean
  iniciado: boolean
  proximo_fechamento: string | null
}

export interface DiaDaFaixa {
  day_pt: string
  variante: string | null
  estado: EstadoAlcance | 'fora_do_placar'
  impressoes: number | null
  ctr: number | null
  motivo: MotivoSemVariante | 'variante_desconhecida' | null
}

const H = 3_600_000
const DIA_MS = 24 * H

function variantePlacar(variant_id: string, dias: readonly LinhaDiaPlacar[]): PlacarVariante {
  let impressoes: number | null = null
  let comCtr = 0
  let cliques = 0
  let cliqueDesconhecido = false
  let views: number | null = null
  const v: PlacarVariante = {
    variant_id, dias: dias.length, dias_validos: 0, dias_zero: 0, dias_ausentes: 0,
    dias_aguardando: 0, dias_nao_medidos: 0, dias_fora_do_ctr: 0,
    impressoes: null, impressoes_com_ctr: null, cliques: null, ctr: null, views: null,
  }
  for (const d of dias) {
    switch (d.alcance_estado) {
      case 'medido':
        if (d.impressoes === null) break
        impressoes = (impressoes ?? 0) + d.impressoes
        if (d.impressoes === 0) v.dias_zero++
        else if (d.ctr === null) { v.dias_fora_do_ctr++; cliqueDesconhecido = true }
        if (diaValido(d)) {
          v.dias_validos++
          comCtr += d.impressoes
          cliques += Math.round(d.impressoes * (d.ctr as number))
        }
        break
      case 'zero_medido':
        impressoes = impressoes ?? 0
        v.dias_zero++
        break
      case 'ausente_no_relatorio':
        impressoes = impressoes ?? 0
        v.dias_zero++
        v.dias_ausentes++
        break
      case 'aguardando': v.dias_aguardando++; break
      case 'nao_medido': v.dias_nao_medidos++; break
    }
    if (d.views_estado === 'medido' && d.views !== null) views = (views ?? 0) + d.views
    else if (d.views_estado === 'zero_medido') views = views ?? 0
  }
  v.impressoes = impressoes
  v.views = views
  if (impressoes !== null) {
    v.impressoes_com_ctr = comCtr
    if (comCtr > 0) {
      v.cliques = cliques
      v.ctr = cliques / comCtr
    } else {
      v.cliques = cliqueDesconhecido ? null : 0
    }
  }
  return v
}

/** Instante da rodada de 14:15 UTC mais recente menor ou igual a `agora`. */
function ultimaRodada(agora: Date): Date {
  const r = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 14, 15)
  return new Date(r > agora.getTime() ? r - DIA_MS : r)
}

export function placarDoTeste(i: {
  dias: readonly LinhaDiaPlacar[]
  variantes: readonly { variant_id: string }[]
  regra: 'v1' | 'v2'
  agora: Date
  inicio: string | null
  fim: string | null
  /** `ab_tests.paused_at`: limite do teste pausado (mesma regra da atribuição). */
  pausado_em?: string | null
  status: string
}): Placar {
  const { dias, agora } = i
  const porVariante = new Map<string, LinhaDiaPlacar[]>(i.variantes.map(v => [v.variant_id, []]))
  let descartados = 0
  let desconhecidos = 0
  for (const d of dias) {
    if (d.variant_id === null) descartados++
    else {
      const lista = porVariante.get(d.variant_id)
      if (lista) lista.push(d)
      else desconhecidos++
    }
  }

  const diasTotal = dias.length
  const todosFinais = diasTotal > 0 && dias.every(d => d.final)
  let maxRetratado: number | null = null
  let maxDay: string | null = null
  let minAguardando: string | null = null
  for (const d of dias) {
    const t = Date.parse(d.retratado_em)
    if (maxRetratado === null || t > maxRetratado) maxRetratado = t
    if (maxDay === null || d.day_pt > maxDay) maxDay = d.day_pt
    if (d.alcance_estado === 'aguardando' && (minAguardando === null || d.day_pt < minAguardando)) minAguardando = d.day_pt
  }
  const atualizadoEm = maxRetratado === null ? null : dias.find(d => Date.parse(d.retratado_em) === maxRetratado)!.retratado_em
  const desatualizado =
    maxRetratado !== null && !todosFinais && dias.some(d => !d.final) && agora.getTime() - maxRetratado > 26 * H

  const iniciado = i.inicio !== null
  const emCurso = i.status === 'active' || i.status === 'paused'
  const fimMs = i.fim === null ? null : Date.parse(i.fim)
  const encerradoRecente = !emCurso && fimMs !== null && agora.getTime() - fimMs < 10 * DIA_MS
  let atrasado = false
  if (iniciado && !todosFinais && (emCurso || encerradoRecente)) {
    if (diasTotal === 0) {
      atrasado = agora.getTime() - Date.parse(i.inicio as string) > 48 * H
    } else if (maxDay !== null) {
      const porRodada = addDays(diaPt(ultimaRodada(agora)), -2)
      // Mesma parada da atribuição: pausado para em paused_at (sem ele, em completed_at); ativo ignora paused_at.
      const parou = i.status === 'paused' ? (i.pausado_em ?? i.fim) : i.fim
      const limite = diaPt(parou !== null ? new Date(parou) : agora)
      const esperado = porRodada < limite ? porRodada : limite
      atrasado = maxDay < esperado
    }
  }

  return {
    regra: i.regra,
    estatistica: 'nao_calculada',
    variantes: i.variantes.map(v => variantePlacar(v.variant_id, porVariante.get(v.variant_id) ?? [])),
    dias_total: diasTotal,
    dias_descartados: descartados,
    dias_variante_desconhecida: desconhecidos,
    atualizado_em: atualizadoEm,
    desatualizado,
    atrasado,
    todos_finais: todosFinais,
    iniciado,
    proximo_fechamento: minAguardando === null ? null : addDays(minAguardando, 11),
  }
}

/** Lista por dia para a tela (fora do `Placar`, para não inchar o Cowork). Ordenada por `day_pt`. */
export function faixaDeDias(i: {
  dias: readonly LinhaDiaPlacar[]
  variantes: readonly { variant_id: string }[]
  agora: Date
}): DiaDaFaixa[] {
  const conhecidas = new Set(i.variantes.map(v => v.variant_id))
  const itens = i.dias.map((d): DiaDaFaixa => {
    if (d.variant_id === null) {
      return { day_pt: d.day_pt, variante: null, estado: 'fora_do_placar', impressoes: d.impressoes, ctr: d.ctr, motivo: d.motivo_sem_variante }
    }
    if (!conhecidas.has(d.variant_id)) {
      return { day_pt: d.day_pt, variante: d.variant_id, estado: 'fora_do_placar', impressoes: d.impressoes, ctr: d.ctr, motivo: 'variante_desconhecida' }
    }
    return { day_pt: d.day_pt, variante: d.variant_id, estado: d.alcance_estado, impressoes: d.impressoes, ctr: d.ctr, motivo: null }
  })
  return itens.sort((a, b) =>
    a.day_pt < b.day_pt ? -1 : a.day_pt > b.day_pt ? 1 : (a.variante ?? '') < (b.variante ?? '') ? -1 : (a.variante ?? '') > (b.variante ?? '') ? 1 : 0,
  )
}

