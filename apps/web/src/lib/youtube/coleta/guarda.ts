// E20 (A5, MG13): nenhuma rotina apaga bruto por prazo. Esta conferência roda em TODA execução da fase 'depois' do cron
// (em `coleta/index.ts`, fora do passo de relatórios), tenha o passo rodado inteiro, saído cedo, ficado sem tempo ou
// lançado. Contagem ausente não é zero: `null` = não conferido, e sempre com uma nota em `falhas`.
//
// Tempo: a conferência tem PRAZO PRÓPRIO (`GUARDA_PRAZO_MS`), fora dos tetos dos passos. São três consultas curtas; o prazo
// cabe nos 30 s de reserva que o relógio de 270 s deixa para o veredito, e o estouro vira nota, nunca exceção.
import type { SupabaseClient } from '@supabase/supabase-js'
import { conferirBanco, pushUnico } from './schema'

export interface GuardaResumo {
  /** Brutos no banco no FIM da execução (depois dos downloads do dia). É a base da comparação da execução seguinte. null = não conferido (e há nota em falhas). */
  blobs_guardados: number | null
  /**
   * Brutos no banco na ABERTURA da fase, antes do passo de relatórios. É este número (e não o do fim) que se compara com a
   * base: uma perda menor que a entrada do dia ficaria escondida pelos downloads. `blobs_guardados - blobs_guardados_ao_abrir`
   * é a entrada do dia. null = a contagem de abertura não veio (e há nota em falhas), caso em que a comparação usa o do fim.
   */
  blobs_guardados_ao_abrir: number | null
  /** O `blobs_guardados` da última execução que tem número. null = sem base (a primeira execução depois do envio) ou não conferido. */
  blobs_guardados_antes: number | null
  /** Relatórios com `downloaded_at`, sem bruto e sem perda reconhecida. Maior que 0 é falha enquanto durar. */
  baixados_sem_bruto: number | null
  /** Brutos cujo relatório não está marcado como baixado (resíduo de execução sobreposta). Visível; não é falha. */
  brutos_sem_baixado: number | null
  /** Relatórios com `blob_lost_at`: perda que o dono reconheceu. Visível para sempre; não é falha. */
  perdas_reconhecidas: number | null
  /** `expirado_sem_baixar` com `expired_at` nulo: sem registro de vencimento (anteriores à MG13, ou vencidos por idade). */
  expirados_sem_registro: number | null
}

/** Prazo da conferência inteira (três consultas). Dentro dos 30 s de reserva do relógio global (`clock.ts`). */
export const GUARDA_PRAZO_MS = 8_000
/** Prazo da contagem de abertura (uma consulta `head`). Sai do tempo dos passos, por isso é curto. */
export const GUARDA_ABERTURA_PRAZO_MS = 3_000

const ABERTURA_NAO_CONTADA = 'relatórios: brutos não contados antes do passo de relatórios; a queda de hoje foi comparada só depois dos downloads'
const NAO_CONFERIDA = 'relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'
const SEM_REGISTRO_NAO_CONTADO = 'relatórios: expirados sem registro de vencimento não contados (o banco não devolveu a contagem)'
/** Quantas execuções anteriores olhar à procura de uma que tenha o número. */
const EXECUCOES_PARA_A_BASE = 10

const inteiro = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null

const vazio = (): GuardaResumo => ({
  blobs_guardados: null, blobs_guardados_ao_abrir: null, blobs_guardados_antes: null, baixados_sem_bruto: null, brutos_sem_baixado: null, perdas_reconhecidas: null, expirados_sem_registro: null,
})

/**
 * As consultas, sobre estruturas LOCAIS (`out`, `notas`): se o prazo estourar, o resultado é descartado inteiro e uma
 * resposta tardia não mexe em nada que o chamador já devolveu. Pode lançar (o chamador, em `index.ts`, trata e avisa o Sentry).
 */
async function consultar(supabase: SupabaseClient, brutosAoAbrir: number | null): Promise<{ out: GuardaResumo; notas: string[] }> {
  const out = vazio()
  out.blobs_guardados_ao_abrir = brutosAoAbrir
  const notas: string[] = []

  const semRegistro = await supabase.from('yt_reporting_reports').select('report_id', { count: 'exact' }).eq('status', 'expirado_sem_baixar').is('expired_at', null).limit(1)
  if (conferirBanco(semRegistro, 'yt_reporting_reports', notas, 'ler') === 'ok') {
    if (typeof semRegistro.count === 'number') out.expirados_sem_registro = semRegistro.count
    else pushUnico(notas, SEM_REGISTRO_NAO_CONTADO)
  }

  // Anti-junção exata, nos dois sentidos (MG13). Função ausente = MG13 não aplicada: PGRST202, que conferirBanco lê como
  // schema_ausente. Vermelho, nunca "0 órfãos".
  const g = await supabase.rpc('yt_reporting_guarda_conferir')
  if (conferirBanco(g, 'yt_reporting_guarda_conferir', notas, 'ler') !== 'ok') return { out, notas }
  const linha: unknown = Array.isArray(g.data) ? g.data[0] : g.data
  const campo = (k: string): number | null => (typeof linha === 'object' && linha !== null ? inteiro((linha as Record<string, unknown>)[k]) : null)
  const brutos = campo('brutos')
  const baixados = campo('baixados')
  const semBruto = campo('baixados_sem_bruto')
  const semBaixado = campo('brutos_sem_baixado')
  const perdas = campo('perdas_reconhecidas')
  if (brutos === null || baixados === null || semBruto === null || semBaixado === null || perdas === null) {
    pushUnico(notas, NAO_CONFERIDA)
    return { out, notas }
  }
  out.blobs_guardados = brutos
  out.baixados_sem_bruto = semBruto
  out.brutos_sem_baixado = semBaixado
  out.perdas_reconhecidas = perdas
  // Falha enquanto durar, com fim definido: o dono devolve o relatório à fila ou grava blob_lost_at (runbook, seção 13).
  if (semBruto > 0) {
    pushUnico(notas, `relatórios: ${semBruto} relatório(s) baixado(s) estão sem o bruto guardado (${baixados} baixados, ${brutos} brutos): liste e resolva pela seção 13 do runbook da coleta (devolver à fila ou reconhecer a perda)`)
  }

  // Queda contra a última execução QUE TEM NÚMERO (não "ontem": o cron pode não ter rodado, ou não ter conferido). É o único
  // sinal que pega a perda por cascata, em que relatório e bruto somem juntos e a anti-junção fica verde. A base é o total
  // do FIM da execução anterior; o que se compara com ela é a contagem da ABERTURA desta (antes dos downloads), senão uma
  // perda menor que a entrada do dia passaria calada. Sem a abertura (nota já dada), cai para o total do fim. Perda
  // DURANTE a execução (fim abaixo da abertura) também é acusada: nada neste código apaga bruto.
  // Dura até uma execução gravar o número novo (a linha desta execução ainda não foi gravada: a rota grava depois).
  // Quando a MG6 (E10) reabrir a limpeza para o lote confirmado no NAS, esta comparação tem de descontar o que ela apagou.
  const ant = await supabase.from('yt_own_collection_runs').select('ran_at, resumo').order('ran_at', { ascending: false }).limit(EXECUCOES_PARA_A_BASE)
  if (conferirBanco(ant, 'yt_own_collection_runs', notas, 'ler') !== 'ok') return { out, notas }
  for (const r of (ant.data ?? []) as Array<{ resumo: unknown }>) {
    const guarda = typeof r.resumo === 'object' && r.resumo !== null ? (r.resumo as { guarda?: unknown }).guarda : undefined
    const n = typeof guarda === 'object' && guarda !== null ? inteiro((guarda as { blobs_guardados?: unknown }).blobs_guardados) : null
    if (n !== null) {
      out.blobs_guardados_antes = n
      break
    }
  }
  const comparado = brutosAoAbrir === null ? brutos : Math.min(brutosAoAbrir, brutos)
  let queda: [number, number] | null = null
  if (out.blobs_guardados_antes !== null && comparado < out.blobs_guardados_antes) queda = [out.blobs_guardados_antes, comparado]
  else if (brutosAoAbrir !== null && brutos < brutosAoAbrir) queda = [brutosAoAbrir, brutos]
  if (queda !== null) {
    pushUnico(notas, `relatórios: os brutos guardados caíram de ${queda[0]} para ${queda[1]} desde a última execução conferida: canal próprio removido ou perda (confira qual)`)
  }
  return { out, notas }
}

export async function conferirGuarda(ctx: { supabase: SupabaseClient; falhas: string[]; prazoMs?: number; brutosAoAbrir?: number | null }): Promise<GuardaResumo> {
  const prazoMs = ctx.prazoMs ?? GUARDA_PRAZO_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  const estouro = new Promise<'estouro'>(resolve => {
    timer = setTimeout(() => resolve('estouro'), prazoMs)
  })
  try {
    const r = await Promise.race([consultar(ctx.supabase, ctx.brutosAoAbrir ?? null), estouro])
    if (r === 'estouro') {
      pushUnico(ctx.falhas, `relatórios: guarda do bruto não conferida (passou do prazo de ${prazoMs} ms)`)
      return vazio()
    }
    for (const n of r.notas) pushUnico(ctx.falhas, n)
    return r.out
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Conta os brutos ANTES do passo de relatórios (o passo só acrescenta). Uma consulta `head`, com prazo próprio curto.
 * Devolve `null` (nunca 0) se a contagem não veio, sempre com nota em `falhas`. Pode lançar: o chamador trata e avisa o Sentry.
 */
export async function contarBrutosAoAbrir(ctx: { supabase: SupabaseClient; falhas: string[]; prazoMs?: number }): Promise<number | null> {
  const prazoMs = ctx.prazoMs ?? GUARDA_ABERTURA_PRAZO_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  const estouro = new Promise<'estouro'>(resolve => {
    timer = setTimeout(() => resolve('estouro'), prazoMs)
  })
  // Notas LOCAIS: se o prazo estourar, uma resposta tardia não escreve em `ctx.falhas`.
  const consulta = async (): Promise<{ n: number | null; notas: string[] }> => {
    const notas: string[] = []
    const r = await ctx.supabase.from('yt_reporting_report_blobs').select('report_id', { count: 'exact', head: true })
    if (conferirBanco(r, 'yt_reporting_report_blobs', notas, 'ler') === 'ok' && typeof r.count === 'number') return { n: r.count, notas }
    pushUnico(notas, ABERTURA_NAO_CONTADA)
    return { n: null, notas }
  }
  try {
    const r = await Promise.race([consulta(), estouro])
    if (r === 'estouro') {
      pushUnico(ctx.falhas, `${ABERTURA_NAO_CONTADA} (passou do prazo de ${prazoMs} ms)`)
      return null
    }
    for (const nota of r.notas) pushUnico(ctx.falhas, nota)
    return r.n
  } finally {
    clearTimeout(timer)
  }
}
