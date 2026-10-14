// A5 · E11: configuração, janela, forma da prova e guarda de schema do passo "dimensões" e dos normalizadores.
// A configuração entra por parâmetro nos passos e nos critérios (`ctx.e11`); as constantes abaixo são só o
// padrão do orquestrador. Nada aqui lê variável de ambiente.

import type { SupabaseClient } from '@supabase/supabase-js'
import { restante } from './clock'
import { ehSchemaAusente, type ErroBanco } from './schema'

/**
 * Datas de partida (dia do Pacífico, `AAAA-MM-DD`). Nascem com a PREVISÃO do envio e nunca vazias: com elas vazias,
 * toda execução de `rodarColeta` ganhava uma nota em `falhas`. A Tarefa 14 as confirma no commit do envio
 * (`DIMENSOES_LIGADO_EM` = dia do deploy; `DIMENSOES_DESDE` = dia do deploy − 10).
 */
export const DIMENSOES_LIGADO_EM = '2026-10-20'
export const DIMENSOES_DESDE = '2026-10-10'

export const JANELA_DIAS = 10
export const MAX_CONSULTAS_DIMENSOES = 400
export const FOLGA_PARA_COMECAR_MS = 3_000
export const CARENCIA_COBERTURA_DIAS = 3
export const CARENCIA_NORMALIZAR_DIAS = 5
export const PRAZO_DA_PROVA_MS = 5_000
export const TIPOS_E11 = { detalhe: 'channel_traffic_source_a3', alcance_dim: 'channel_reach_combined_a1' } as const
/** O primeiro dia do bruto guardado: só rótulo de leitura. */
export const LOTE_DESDE = '2026-09-08'

// ---------------------------------------------------------------------------------------------------------------
// Datas (strings `AAAA-MM-DD` comparam como texto)
// ---------------------------------------------------------------------------------------------------------------

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/

/** Dia que existe no calendário, no formato exato `AAAA-MM-DD`. */
function diaValido(s: unknown): s is string {
  if (typeof s !== 'string' || !FORMATO_DIA.test(s)) return false
  const d = new Date(`${s}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const maior = (a: string, b: string): string => (a >= b ? a : b)
const menor = (a: string, b: string): string => (a <= b ? a : b)

// ---------------------------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------------------------

export type ConfigE11 = { desde: string; ligadoEm: string }

export function configE11(
  entrada: Partial<ConfigE11> = { desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM },
): ({ ok: true } & ConfigE11) | { ok: false; motivo: string } {
  const { desde, ligadoEm } = entrada
  if (!desde || !ligadoEm) return { ok: false, motivo: 'configuração das dimensões vazia (desde e ligadoEm)' }
  if (!diaValido(desde)) return { ok: false, motivo: 'configuração das dimensões: desde não é uma data AAAA-MM-DD que existe' }
  if (!diaValido(ligadoEm)) return { ok: false, motivo: 'configuração das dimensões: ligadoEm não é uma data AAAA-MM-DD que existe' }
  if (desde > ligadoEm) return { ok: false, motivo: 'configuração das dimensões: desde é depois de ligadoEm' }
  return { ok: true, desde, ligadoEm }
}

// ---------------------------------------------------------------------------------------------------------------
// Janela de um conjunto (mesma fórmula de `yt_own_dim_cover_idle`)
// ---------------------------------------------------------------------------------------------------------------

/**
 * `de = maior(desde, menor(hoje − 10, ultimoCoberto ?? desde))`; `ate = menor(hoje, baseAte)`.
 * `null` se `baseAte` é nulo ou `ate < de`.
 */
export function janelaDoConjunto(p: {
  desde: string
  hoje: string
  ultimoCoberto: string | null
  baseAte: string | null
}): { de: string; ate: string } | null {
  if (p.baseAte === null) return null
  const de = maior(p.desde, menor(somarDias(p.hoje, -JANELA_DIAS), p.ultimoCoberto ?? p.desde))
  const ate = menor(p.hoje, p.baseAte)
  if (ate < de) return null
  return { de, ate }
}

// ---------------------------------------------------------------------------------------------------------------
// Forma da prova (`yt_own_dim_prova`)
// ---------------------------------------------------------------------------------------------------------------

export type ProvaE11 = {
  faltando_cobertura: number
  videos_com_base: number
  videos_base_antes_do_inicio: number
  videos_sem_base: number
  base_ate: string | null
  dias_dois_relatorios_detalhe: number
  dias_dois_relatorios_alcance: number
  pendentes_normalizar: number
}

const CAMPOS_NUMERICOS = [
  'faltando_cobertura',
  'videos_com_base',
  'videos_base_antes_do_inicio',
  'videos_sem_base',
  'dias_dois_relatorios_detalhe',
  'dias_dois_relatorios_alcance',
  'pendentes_normalizar',
] as const

/** Campo ausente, não numérico ou negativo = não ok com o nome do campo. Nunca vira 0. */
export function lerProva(x: unknown): { ok: true; prova: ProvaE11 } | { ok: false; campo: string } {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return { ok: false, campo: '(resposta)' }
  const o = x as Record<string, unknown>
  const n: Record<(typeof CAMPOS_NUMERICOS)[number], number> = {
    faltando_cobertura: 0, videos_com_base: 0, videos_base_antes_do_inicio: 0, videos_sem_base: 0,
    dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 0,
  }
  for (const campo of CAMPOS_NUMERICOS) {
    const v = o[campo]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return { ok: false, campo }
    n[campo] = v
  }
  const base = o.base_ate
  if (base !== null && !diaValido(base)) return { ok: false, campo: 'base_ate' }
  return { ok: true, prova: { ...n, base_ate: base } }
}

export type MotivoProva = 'schema_ausente' | 'sem_resposta' | 'erro_de_banco' | 'forma_inesperada'
export type ResultadoProva = { ok: true; prova: ProvaE11 } | { ok: false; motivo: MotivoProva; campo?: string }
type ParamsProva = { site: string; hoje: string; desde: string }

/** Corre `p` contra min(PRAZO_DA_PROVA_MS, o que resta ao passo). `null` quando o tempo vence. */
async function comPrazoDaProva<T>(p: PromiseLike<T>, deadline: number): Promise<T | null> {
  const ms = Math.min(PRAZO_DA_PROVA_MS, restante(deadline))
  if (ms <= 0) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([Promise.resolve(p), limite])
  } finally {
    clearTimeout(timer)
  }
}

export async function chamarProva(sb: SupabaseClient, p: ParamsProva, deadline: number): Promise<ResultadoProva> {
  if (restante(deadline) <= 0) return { ok: false, motivo: 'sem_resposta' }
  let res: { data: unknown; error: ErroBanco | null } | null
  try {
    res = await comPrazoDaProva(sb.rpc('yt_own_dim_prova', { p_site: p.site, p_hoje: p.hoje, p_desde: p.desde }), deadline)
  } catch {
    return { ok: false, motivo: 'erro_de_banco' }
  }
  if (res === null) return { ok: false, motivo: 'sem_resposta' }
  if (res.error) return { ok: false, motivo: ehSchemaAusente(res.error) ? 'schema_ausente' : 'erro_de_banco' }
  const lida = lerProva(res.data)
  if (!lida.ok) return { ok: false, motivo: 'forma_inesperada', campo: lida.campo }
  return lida
}

/**
 * Guarda de schema. A prova que devolve serve SÓ à guarda e ao `base_ate` do resumo do passo: os critérios
 * chamam a prova de novo, depois dos passos. Nota sem o texto do Postgres.
 */
export async function schemaE11(
  sb: SupabaseClient,
  p: ParamsProva,
  deadline: number,
): Promise<{ ok: true; prova: ProvaE11 } | { ok: false; nota: string }> {
  const r = await chamarProva(sb, p, deadline)
  if (r.ok) return r
  switch (r.motivo) {
    case 'schema_ausente': {
      // A MG7 depende da MG14: se a cobertura também não existe, o que falta é a MG14.
      let cobertura: { error: ErroBanco | null } | null = null
      try {
        cobertura = await comPrazoDaProva(sb.from('yt_own_video_coverage').select('youtube_video_id').limit(1), deadline)
      } catch {
        cobertura = null
      }
      if (cobertura && ehSchemaAusente(cobertura.error)) {
        return { ok: false, nota: 'schema_ausente: MG14 não aplicada (yt_own_video_coverage)' }
      }
      return { ok: false, nota: 'schema_ausente: MG7 não aplicada (yt_own_dim_prova)' }
    }
    case 'sem_resposta':
      return { ok: false, nota: 'dimensões: a prova de cobertura não respondeu a tempo' }
    case 'erro_de_banco':
      return { ok: false, nota: 'erro de banco ao ler yt_own_dim_prova' }
    case 'forma_inesperada':
      return {
        ok: false,
        nota: r.campo && r.campo !== '(resposta)'
          ? `dimensões: a prova de cobertura veio sem o campo ${r.campo}`
          : 'dimensões: a prova de cobertura veio em forma inesperada',
      }
  }
}
