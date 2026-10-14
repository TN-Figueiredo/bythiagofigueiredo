/**
 * A5 · E10: o leitor do sinal de tamanho do banco. UMA ida ao banco (as 29 linhas mais recentes de `obs_db_size_daily`, SEM filtro
 * de data: se a última medida tem 40 dias, ela vem, e o estado é `sem_leitura_hoje` com a data dela, nunca `nunca_medido`),
 * um guarda de forma linha a linha, e a função pura `sinalDoBanco`. Nunca lança. Nenhuma mensagem do banco sai daqui: só o CÓDIGO
 * da causa (`CausaDaFalha`), porque a mensagem pode levar nome de tabela, de coluna ou texto de terceiros para a tela, a nota e o e-mail.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import type { CausaDaFalha } from '@/lib/youtube/agenda/tipos'
import { sinalDoBanco, type LinhaBruta, type SinalDoBanco } from './sinal-do-banco'

/** O mesmo número de `PROOF_MIN_MS` (agenda/fecho.ts): o teto da leitura do sinal. Não importado de lá para não puxar o fecho inteiro; um teste confere a igualdade. */
export const TETO_LEITURA_MS = 3_000
/** 28 dias de tendência mais o dia de leitura. */
export const LINHAS_LIDAS = 29
export const COLUNAS_DO_SINAL = 'day, db_bytes, competitor_bytes, own_bytes, measured_at'

export type SinalLido = { valor: SinalDoBanco } | { porque: CausaDaFalha }

/** Código curto da exceção ou do erro do banco -> a causa fechada. A tabela ausente é a única que diz "migration não aplicada". */
export function causaDoErro(err: unknown): CausaDaFalha {
  const c = codigoDe(err)
  if (c === 'banco:tempo_esgotado') return 'prazo'
  if (['banco:42p01', 'banco:42703', 'banco:pgrst204', 'banco:pgrst205'].includes(c)) return 'schema_ausente'
  if (c.startsWith('banco:')) return 'erro_do_banco'
  return 'excecao'
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** bigint do PostgREST vem como número; se vier como texto de dígitos, também serve. O resto é nulo (a linha vira ilegível). */
function numeroOuNulo(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && /^\d{1,18}$/.test(v)) return Number(v)
  return null
}

/** O guarda de forma de UMA linha: tudo o que não for do tipo esperado vira nulo, e `sinalDoBanco` conta a linha como ilegível. */
export function linhaBruta(x: unknown): LinhaBruta {
  if (!ehObjeto(x)) return { day: null, db_bytes: null, competitor_bytes: null, own_bytes: null, measured_at: null }
  return {
    day: typeof x.day === 'string' ? x.day : null,
    db_bytes: numeroOuNulo(x.db_bytes),
    competitor_bytes: numeroOuNulo(x.competitor_bytes),
    own_bytes: numeroOuNulo(x.own_bytes),
    measured_at: typeof x.measured_at === 'string' ? x.measured_at : null,
  }
}

export async function lerSinalDoBanco(sb: SupabaseClient, agoraMs: number): Promise<SinalLido> {
  try {
    const res: { data?: unknown; error?: unknown } | null | undefined = await sb
      .from('obs_db_size_daily')
      .select(COLUNAS_DO_SINAL)
      .order('day', { ascending: false })
      .limit(LINHAS_LIDAS)
      .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS))
    if (typeof res !== 'object' || res === null) return { porque: 'forma_invalida' }
    if (res.error) return { porque: causaDoErro(res.error) }
    if (!Array.isArray(res.data)) return { porque: 'forma_invalida' }
    return { valor: sinalDoBanco(res.data.map(linhaBruta), agoraMs) }
  } catch (err) {
    return { porque: causaDoErro(err) }
  }
}
