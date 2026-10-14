/**
 * A5 · E10: a medida do tamanho do banco (a tarefa `tamanho_do_banco` da agenda chama isto). Uma ida à guarda do schema, uma ao
 * `obs_db_size_record` (que grava a linha do dia de São Paulo; a última medida do dia vale). Nunca lança: a falha vira CÓDIGO de
 * catálogo (`MOTIVOS_TAMANHO` e os comuns da agenda) e só o código vai ao Sentry. Nenhuma mensagem do banco entra no resultado:
 * ele vai para `competitor_agenda_runs.reason` e para o e-mail do vigia.
 */
import * as Sentry from '@sentry/nextjs'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa, ResultadoTarefa } from '@/lib/youtube/agenda/tipos'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { diaDeLeitura } from './sinal-do-banco'

const MB = 1_048_576
const CODIGO_RE = /^[a-z0-9_:]{1,60}$/

/** Frase fixa por código, sem ponto final e sem número (os códigos de schema e `excecao` são os comuns da agenda). */
export const MOTIVOS_TAMANHO: Record<string, string> = {
  medida_falhou: 'não foi possível medir o tamanho do banco',
  resposta_invalida: 'a medida do tamanho do banco veio fora da forma esperada',
  inesperado: 'a medida do tamanho do banco falhou de um jeito inesperado',
}

function relatar(motivo: string, codigo: string): void {
  const limpo = CODIGO_RE.test(codigo) ? codigo : 'codigo_invalido'
  Sentry.captureMessage('tamanho_do_banco: ' + motivo + ': ' + limpo, {
    level: 'error',
    tags: { component: 'sync-youtube', mode: 'tamanho_do_banco', motivo, codigo: limpo },
  })
}

const erro = (motivo: string): ResultadoTarefa => ({ estado: 'erro', feitas: 0, deixadas: null, motivo })
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const numeroNaoNegativo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

export async function rodarTamanhoDoBanco(c: Pick<ContextoTarefa, 'sb' | 'agora'>): Promise<ResultadoTarefa> {
  try {
    let guarda: Awaited<ReturnType<typeof schemaTablesReady>>
    try {
      guarda = await schemaTablesReady(
        c.sb,
        [['MG6', [['obs_db_size_daily', 'day, db_bytes, competitor_bytes, own_bytes, measured_at']]]],
        { signal: AbortSignal.timeout(BANCO_MS) },
      )
    } catch (err) {
      // a guarda que lança é uma guarda que não conseguiu conferir: a medida não roda
      relatar('schema_nao_conferido', codigoDe(err))
      return erro('schema_nao_conferido')
    }
    if (guarda) return erro(guarda.tipo === 'ausente' ? 'schema_ausente' : 'schema_nao_conferido')

    const agoraMs = c.agora()
    const res: { data?: unknown; error?: unknown } | null | undefined = await c.sb
      .rpc('obs_db_size_record', { p_now: new Date(agoraMs).toISOString() })
      .abortSignal(AbortSignal.timeout(BANCO_MS))
    if (typeof res !== 'object' || res === null) { relatar('resposta_invalida', 'sem_resposta'); return erro('resposta_invalida') }
    if (res.error) { relatar('medida_falhou', codigoDe(res.error)); return erro('medida_falhou') }

    // a função devolve o objeto da linha gravada; o `day` é o dia civil de São Paulo do instante pedido
    const d = res.data
    if (!ehObjeto(d) || d.day !== diaDeLeitura(agoraMs, 0)) { relatar('resposta_invalida', 'forma'); return erro('resposta_invalida') }
    const { db_bytes: db, competitor_bytes: concorrentes, own_bytes: proprio } = d
    if (typeof db !== 'number' || !Number.isFinite(db) || db <= 0 || !numeroNaoNegativo(concorrentes) || !numeroNaoNegativo(proprio)) {
      relatar('resposta_invalida', 'forma')
      return erro('resposta_invalida')
    }
    return { estado: 'ok', feitas: 1, deixadas: 0, detalhe: { db_mb: Math.round(db / MB), competitor_mb: Math.round(concorrentes / MB), own_mb: Math.round(proprio / MB) } }
  } catch (err) {
    relatar('inesperado', codigoDe(err))
    return erro('inesperado')
  }
}
