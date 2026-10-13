import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'
import { logCron } from '../../../../lib/logger'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { loadBatchRows, type BatchResult, type BatchRow } from '@/lib/youtube/competitor-sync-batch'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { avisarDono, type ContagemAviso } from './aviso'
import { CATALOGO, notaDoInterruptorDaAgenda, tarefasDesligadas } from './catalogo'
import { despachar, type EstadoFinalTarefa, type OpsAgenda } from './despachante'
import { adiar, esgotar, fechar, lerEstado, soltarArrendamento, tomar, tomarArrendamento } from './estado'
import { fecharDisparo, relatarAgenda } from './fecho'
import { codigoDoMotivo, fraseDoMotivo, resumoTecnico } from './motivos'
import { chaveDoPeriodo } from './periodo'
import { BANCO_MS, LIMITE_FUNCAO_MS, comPrazo } from './relogio'
import type { ContextoTarefa, Lido, ResultadoTarefa, Tarefa } from './tipos'
import { anularIdentidade } from './tarefas/anular-identidade'

/**
 * A rota do cron entrega o disparo a este arquivo quando a agenda está ligada (`executarAgenda`), e chama `rodarAntesDoLoteAntigo` quando o
 * lote antigo roda no lugar da agenda. O disparo da agenda NÃO usa a trava de sessão do lote antigo: o arrendamento (`estado.ts`) é a trava.
 * Texto de exceção, do YouTube ou do banco nunca sai daqui (S-I4): só código de catálogo, números e o nome da tarefa.
 */

const JOB = 'sync-youtube-competitors'
/** O aviso ao dono sai DEPOIS de `cron_health` e só se sobrar este tempo antes de LIMITE_FUNCAO_MS − 3 s. */
const AVISO_MIN_MS = 3_000
const AVISO_MAX_MS = 8_000
const FOLGA_FIM_MS = 3_000
const FRASE_MIGRATION = 'migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar'

/** As tarefas que rodam ANTES do lote antigo quando a agenda não roda (`OBS_AGENDA=off` ou a MG10 ausente). Só `anular_identidade` (E14): a obrigação de LGPD. */
export const antesDoLoteAntigo: readonly Tarefa[] = [anularIdentidade]

export type CaminhoSemAgenda = 'interruptor' | 'guarda_mg10'
export interface AntesDoLote { tarefas: EstadoFinalTarefa[]; problemas: string[]; notas: string[] }

export interface DepsAgenda {
  catalogo?: readonly Tarefa[]
  carregarLinhas?: typeof loadBatchRows
  agora?: () => number
  gravarSaude?: { sucesso: typeof recordCronSuccess; falha: typeof recordCronFailure }
}

// Cola um valor de configuração curto numa nota sem controles nem excesso.
const curto = (v: string, max = 60): string => {
  const t = v.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const ESTADOS_DO_RESULTADO: ReadonlySet<string> = new Set(['ok', 'parcial', 'erro'])
const inteiroNaoNegativo = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null)
function soNumeros(d: Readonly<Record<string, number>> | undefined): Record<string, number> | undefined {
  if (typeof d !== 'object' || d === null) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

// ───────────────────────── a lista que roda antes do lote antigo ─────────────────────────

/** Roda a tarefa com prazo e devolve sempre um resultado de forma válida; exceção, prazo e forma errada viram `erro` com código. */
async function executarTarefa(t: Tarefa, ctx: ContextoTarefa, agora: () => number): Promise<ResultadoTarefa & { feitas: number }> {
  const erro = (motivo: string): ResultadoTarefa => ({ estado: 'erro', feitas: 0, deixadas: null, motivo })
  const restante = ctx.t0 + t.fimAteMs - agora()
  let bruto: ResultadoTarefa
  if (!(restante > 0)) {
    bruto = erro('passou_do_tempo')
  } else {
    try {
      const corrida = await comPrazo((async () => t.rodar(ctx))(), restante)
      bruto = 'estourou' in corrida ? erro('passou_do_tempo') : corrida.valor
    } catch (err) {
      relatarAgenda(t.nome, { codigo: 'excecao', tecnico: resumoTecnico(err) })
      bruto = erro('excecao')
    }
  }
  const forma = typeof bruto === 'object' && bruto !== null && typeof bruto.estado === 'string' && ESTADOS_DO_RESULTADO.has(bruto.estado)
  if (!forma) {
    relatarAgenda(t.nome, { codigo: 'motivo_desconhecido' })
    return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'motivo_desconhecido' }
  }
  let motivo: string | undefined
  if (bruto.motivo !== undefined) {
    motivo = codigoDoMotivo(t, bruto.motivo)
    if (motivo === 'motivo_desconhecido' && bruto.motivo !== 'motivo_desconhecido') relatarAgenda(t.nome, { codigo: 'motivo_desconhecido' })
  } else if (bruto.estado === 'erro') {
    motivo = 'motivo_desconhecido'
    relatarAgenda(t.nome, { codigo: 'motivo_desconhecido' })
  }
  const detalhe = soNumeros(bruto.detalhe)
  return {
    estado: bruto.estado, feitas: inteiroNaoNegativo(bruto.feitas) ?? 0,
    deixadas: bruto.deixadas === null ? null : inteiroNaoNegativo(bruto.deixadas),
    ...(motivo !== undefined ? { motivo } : {}),
    ...(detalhe !== undefined ? { detalhe } : {}),
  }
}

const P_SEM_RESPOSTA = 'o banco não respondeu'
async function seguro<T>(f: () => Promise<Lido<T>>): Promise<Lido<T>> {
  try { return await f() } catch { return { porque: P_SEM_RESPOSTA } }
}

async function rodarUmaAntes(
  o: { supabase: SupabaseClient; apiKey: string; t0: number; caminho: CaminhoSemAgenda },
  t: Tarefa, agora: () => number, saida: AntesDoLote,
): Promise<void> {
  const sb = o.supabase
  const marcar = (e: Omit<EstadoFinalTarefa, 'tarefa'>): void => { saida.tarefas.push({ tarefa: t.nome, ...e }) }
  const semNumeros = { ms: 0, feitas: null, deixadas: null }
  const ocupada = (): void => { marcar({ estado: 'ocupada', ...semNumeros }); saida.notas.push(`${t.rotulo}: outro disparo está com ela`) }
  const chave = chaveDoPeriodo(t.periodo, agora())
  let fechavel = false

  if (o.caminho === 'interruptor') {
    // As tabelas da agenda existem; só o interruptor está desligado. O estado é lido ANTES da tomada (uma ida).
    const lido = await lerEstado(sb, [{ task: t.nome, period_key: chave }])
    if ('porque' in lido) {
      saida.notas.push(`${t.rotulo}: estado da agenda não lido (${lido.porque})`)
    } else {
      const linha = lido.valor.tarefas[0]
      const status = linha?.status ?? null
      if (status === 'ok') { marcar({ estado: 'nao_devida', ...semNumeros }); return }
      if (status === 'esgotada' || (linha?.attempts ?? 0) >= t.tetoTentativas) {
        const r = await seguro(() => esgotar(sb, { task: t.nome, period_key: chave, teto: t.tetoTentativas }))
        // Só é "outra execução com a última tentativa em curso" quando a linha está `rodando` E `esgotar` devolve false.
        // Em qualquer outro status (esgotada, erro, parcial, adiada) o problema sai seja qual for a volta de `esgotar`.
        if (status === 'rodando' && !('porque' in r) && r.valor === false) { ocupada(); return }
        marcar({ estado: 'esgotada', ...semNumeros })
        saida.problemas.push(`${t.rotulo}: esgotou as ${t.tetoTentativas} tentativas do período`)
        return
      }
      const tomada = await seguro(() => tomar(sb, { task: t.nome, period_key: chave, teto: t.tetoTentativas, reabrir: false }))
      if ('porque' in tomada) saida.notas.push(`${t.rotulo}: tomada não confirmada (${tomada.porque})`)
      else if (!tomada.valor) { ocupada(); return }
      else fechavel = true
    }
  }
  // 'guarda_mg10': as tabelas da agenda podem não existir. Sem tomada e sem fecho; a tarefa roda em todo disparo.

  const inicio = agora()
  const ctx: ContextoTarefa = { t0: o.t0, agora, apiKey: o.apiKey, sb, linhas: null }
  const r = await executarTarefa(t, ctx, agora)
  const ms = Math.max(0, Math.round(agora() - inicio))
  if (fechavel) {
    const f = await seguro(() => fechar(sb, {
      task: t.nome, period_key: chave, estado: r.estado, feitas: r.feitas, deixadas: r.deixadas, ms,
      ...(r.motivo !== undefined ? { motivo: r.motivo } : {}), ...(r.detalhe !== undefined ? { detalhe: r.detalhe } : {}),
    }))
    if ('porque' in f) saida.notas.push(`${t.rotulo}: não foi possível gravar o fecho (${f.porque})`)
    else if (!f.valor) saida.notas.push(`${t.rotulo}: o banco não aceitou o fecho`)
  }
  marcar({
    estado: r.estado, ms, feitas: r.feitas, deixadas: r.deixadas,
    ...(r.motivo !== undefined ? { motivo: r.motivo } : {}), ...(r.detalhe !== undefined ? { detalhe: r.detalhe } : {}),
  })
  if (r.estado === 'erro') saida.problemas.push(fraseDoMotivo(t, r.motivo, r.detalhe))
}

/**
 * Roda, antes do lote antigo, as tarefas `nuncaDesliga` da lista (hoje só `anular_identidade`). Quem chama é a rota, nos dois caminhos sem agenda
 * (`interruptor`: `OBS_AGENDA=off`; `guarda_mg10`: a migration da agenda ausente). Nunca lança. Lista vazia: devolve na hora, sem ida ao
 * banco nem ao Sentry. `OBS_AGENDA_TASKS_OFF` não vale para estas tarefas.
 */
export async function rodarAntesDoLoteAntigo(o: {
  supabase: SupabaseClient; apiKey: string; runId: string; t0: number; caminho: CaminhoSemAgenda
  lista?: readonly Tarefa[]; agora?: () => number
}): Promise<AntesDoLote> {
  const lista = o.lista ?? antesDoLoteAntigo
  const saida: AntesDoLote = { tarefas: [], problemas: [], notas: [] }
  if (lista.length === 0) return saida
  const agora = o.agora ?? Date.now
  for (const t of [...lista].sort((a, b) => a.ordem - b.ordem)) {
    if (t.nuncaDesliga !== true) { saida.notas.push(`${t.nome}: fora da lista por não ser nuncaDesliga`); continue }
    try {
      await rodarUmaAntes(o, t, agora, saida)
    } catch (err) {
      // a rede de segurança: o corpo acima já embrulha o que sabe falhar
      relatarAgenda(t.nome, { codigo: 'excecao', tecnico: resumoTecnico(err) })
      saida.problemas.push(fraseDoMotivo(t, 'excecao'))
    }
  }
  return saida
}

// ───────────────────────── o disparo da agenda ─────────────────────────

/** O resumo do lote que vai à resposta: o mesmo de antes, sem as duas listas de sites. */
function resumoDoLote(r: BatchResult): Omit<BatchResult, 'siteIds' | 'healthSiteIds'> {
  const { siteIds: _siteIds, healthSiteIds: _healthSiteIds, ...resto } = r
  return resto
}

/**
 * O disparo da agenda. Devolve `{ resposta }` (a rota a entrega) ou `{ resposta: null, semAgenda }` quando a guarda da MG10 falhou: a
 * agenda não rodou nada e a rota segue para o lote antigo, que coleta e deixa o cron vermelho com a frase em `semAgenda`.
 */
export async function executarAgenda(o: {
  supabase: SupabaseClient; apiKey: string; runId: string; t0: number; deps?: DepsAgenda
}): Promise<{ resposta: Response; semAgenda?: undefined } | { resposta: null; semAgenda: string }> {
  const { supabase: sb, apiKey, runId, t0 } = o
  const agora = o.deps?.agora ?? Date.now
  const catalogo = o.deps?.catalogo ?? CATALOGO
  const carregarLinhas = o.deps?.carregarLinhas ?? loadBatchRows
  const saude = o.deps?.gravarSaude ?? { sucesso: recordCronSuccess, falha: recordCronFailure }
  const holder = crypto.randomUUID()
  const notas: string[] = []

  const arrendamento = await seguro(() => tomarArrendamento(sb, holder))
  if ('valor' in arrendamento && arrendamento.valor === false) {
    logCron({ job: JOB, run_id: runId, status: 'locked' })
    return { resposta: Response.json({ status: 'locked' }) }
  }
  // O arrendamento que FALHA (não o que está ocupado) tem dois destinos. Causa dura (`schema_ausente`, `erro_do_banco`: função faltando, sem
  // EXECUTE, erro de SQL): a agenda não consegue trabalhar, então depois da guarda a rota cai no lote antigo (a coleta roda e o cron fica
  // vermelho com a frase). Causa incerta (prazo, exceção, forma inválida): não dá para saber se outro disparo tem o arrendamento; a agenda
  // segue (cada tarefa se garante pela tomada, que é atômica), o lote antigo NÃO roda em paralelo e o problema entra no vermelho do disparo.
  let falhaDura: string | null = null
  const problemasAntes: string[] = []
  if ('porque' in arrendamento) {
    notas.push(`arrendamento não tomado (${arrendamento.porque})`)
    // Com a migration ausente isto é esperado (a guarda abaixo acusa, em vermelho, a cada disparo): sem alarme repetido ao Sentry.
    if (arrendamento.causa !== 'schema_ausente') {
      Sentry.captureMessage('agenda: arrendamento não tomado', { level: 'warning', tags: { component: 'sync-youtube', mode: 'agenda' }, extra: { causa: arrendamento.causa ?? null } })
    }
    if (arrendamento.causa === 'schema_ausente' || arrendamento.causa === 'erro_do_banco') {
      falhaDura = `não foi possível tomar o arrendamento da agenda (${arrendamento.porque}); o lote antigo rodou no lugar`
    } else {
      problemasAntes.push(`não foi possível confirmar o arrendamento da agenda (${arrendamento.porque})`)
    }
  }

  try {
    // 4. A guarda da MG10: sem as duas tabelas a agenda não roda nada.
    let guarda: Awaited<ReturnType<typeof schemaTablesReady>>
    try {
      guarda = await schemaTablesReady(sb, [['MG10', [['competitor_agenda_runs', 'task, runs, unfinished_n, detail'], ['competitor_agenda_lease', 'name']]]], { signal: AbortSignal.timeout(BANCO_MS) })
    } catch (err) {
      guarda = { tipo: 'nao_conferido', texto: '', codigo: resumoTecnico(err).sqlstate }
    }
    if (guarda) {
      // Frase fixa mais o código: o `texto` (que leva a mensagem do banco) não vai para `cron_health` nem para a resposta.
      if (guarda.tipo === 'nao_conferido') relatarAgenda('agenda', { codigo: 'schema_nao_conferido', tecnico: { classe: 'SchemaGuard', sqlstate: guarda.codigo } })
      return {
        resposta: null,
        semAgenda: guarda.tipo === 'ausente'
          ? FRASE_MIGRATION
          : `não foi possível conferir o schema da agenda (${guarda.codigo ? 'código ' + guarda.codigo : 'sem código'}); o lote antigo rodou no lugar`,
      }
    }

    // 4b. As tabelas existem, mas o arrendamento falhou de forma dura (migration aplicada pela metade): sem agenda, a coleta vai pelo lote antigo.
    if (falhaDura !== null) {
      // Com `erro_do_banco` o Sentry já foi avisado acima; `schema_ausente` com as tabelas presentes é migration pela metade, e a guarda não acusa.
      const causaDura = 'porque' in arrendamento ? arrendamento.causa : undefined
      if (causaDura === 'schema_ausente') {
        Sentry.captureMessage('agenda: arrendamento não tomado', { level: 'warning', tags: { component: 'sync-youtube', mode: 'agenda' }, extra: { causa: causaDura } })
      }
      return { resposta: null, semAgenda: falhaDura }
    }

    // 5. Os canais, com prazo próprio: a consulta pendurada não segura a leitura horária nem a série do dia.
    let linhas: BatchRow[] | null = null
    try {
      const lidas = await comPrazo(carregarLinhas(sb), BANCO_MS)
      if ('estourou' in lidas) problemasAntes.push(`não foi possível ler os canais: o banco não respondeu em ${Math.round(BANCO_MS / 1000)} s`)
      else linhas = lidas.valor
    } catch (err) {
      relatarAgenda('agenda', { codigo: 'canais_nao_lidos', tecnico: resumoTecnico(err) })
      problemasAntes.push('não foi possível ler os canais')
    }

    // 6. O estado e o despacho.
    const estado = await lerEstado(sb, catalogo.map(t => ({ task: t.nome, period_key: chaveDoPeriodo(t.periodo, t0) })))
    const { desligadas, desconhecidas, ignoradas } = tarefasDesligadas(process.env, catalogo)
    for (const nome of desconhecidas) notas.push(`OBS_AGENDA_TASKS_OFF: "${curto(nome)}" não é uma tarefa da agenda`)
    for (const nome of ignoradas) notas.push(`OBS_AGENDA_TASKS_OFF: "${curto(nome)}" não pode ser desligada e segue ligada`)
    const notaInterruptor = notaDoInterruptorDaAgenda()
    if (notaInterruptor) notas.push(notaInterruptor)
    const ops: OpsAgenda = {
      tomar: t => tomar(sb, t), fechar: t => fechar(sb, t), adiar: t => adiar(sb, t), esgotar: t => esgotar(sb, t),
      relatar: relatarAgenda,
    }
    const resumo = await despachar({ catalogo, desligadas, t0, agora, estado, contexto: { t0, agora, apiKey, sb, linhas }, ops })
    notas.push(...resumo.notas)

    // 7 e 8. A prova por site, a mensagem e o registro no `cron_health`.
    const f = await fecharDisparo({
      sb, t0, agora, resumo, catalogo, desligadas, linhas, problemasAntes,
      agendaDesde: 'valor' in estado ? estado.valor.desde : null,
    })
    if (f.vermelho) await saude.falha(JOB, f.mensagem ?? 'o disparo da agenda falhou')
    else await saude.sucesso(JOB, 'info')

    // 9. O cache do que o lote escreveu (um canal com erro também gravou parte do dado).
    if (f.lote && f.lote.synced > 0) revalidatePath('/cms/youtube/competitors', 'layout')
    for (const siteId of f.lote?.siteIds ?? []) invalidateObservatory(siteId)

    // 10. Depois de `cron_health` gravado: o aviso ao dono. Falha ou falta de tempo nunca mudam a resposta.
    let avisosEnviados: ContagemAviso | null = null
    const restante = LIMITE_FUNCAO_MS - FOLGA_FIM_MS - (agora() - t0)
    if (f.avisos.length > 0 && restante >= AVISO_MIN_MS) {
      try { avisosEnviados = await avisarDono(sb, f.avisos, { agoraMs: agora(), prazoMs: Math.min(AVISO_MAX_MS, restante) }) } catch { /* o aviso nunca muda a resposta */ }
    }

    // 11. A resposta.
    const semanal = resumo.tarefas.find(t => t.tarefa === 'serie_semanal')?.extra
    const corpo = {
      mode: 'competitors', agenda: true,
      tarefas: resumo.tarefas.map(({ extra: _extra, ...resto }) => resto),
      ...(f.lote ? resumoDoLote(f.lote) : {}),
      ...(typeof semanal === 'object' && semanal !== null ? { weekly: semanal } : {}),
      prova: f.prova, prova_horaria: f.provaHoraria, acao_do_dono: f.acaoDoDono, notas, avisos_enviados: avisosEnviados,
    }
    logCron({ job: JOB, run_id: runId, status: 'ok', duration_ms: Math.max(0, agora() - t0), ...corpo })
    return { resposta: Response.json({ status: 'ok', ...corpo }) }
  } catch (err) {
    relatarAgenda('agenda', { codigo: 'excecao', tecnico: resumoTecnico(err) })
    try { logCron({ job: JOB, run_id: runId, status: 'error', duration_ms: Math.max(0, agora() - t0), err_code: 'unhandled' }) } catch { /* segue */ }
    try { await saude.falha(JOB, 'o disparo da agenda falhou com erro inesperado (ver Sentry)') } catch { /* segue */ }
    return { resposta: Response.json({ error: 'cron_failed' }, { status: 500 }) }
  } finally {
    try { await soltarArrendamento(sb, holder) } catch { /* o arrendamento vence sozinho */ }
  }
}
