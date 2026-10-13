import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  batchHealth, currentSlotStart, ownerActions, PROOF_TIMEOUT_MS, RECORD_RESERVE_MS, SLOT_COVER_LIMIT_MS,
  type BatchResult, type BatchRow,
} from '@/lib/youtube/competitor-sync-batch'
import { readSiteHealth, type HealthVerdict } from '@/lib/youtube/competitor-health'
import { lerNegadosDoDono, lerProvaHoraria, veredictoHorario, type ProvaHoraria } from '@/lib/youtube/horaria/prova'
import type { EstadoFinalTarefa, ResumoDisparo } from './despachante'
import { LIMITE_FUNCAO_MS, comPrazo } from './relogio'
import type { Lido, Tarefa } from './tipos'
import type { Aviso } from './aviso'

/**
 * O fecho do disparo (A5 E16, Tarefa 12): a mensagem de falha do cron, a leitura da prova com teto de tempo e a prova por site
 * (captura e série, leitura horária). Mora aqui, e não na rota, porque `route.ts` só pode exportar `GET`, `runtime` e `maxDuration`.
 * Não importa `catalogo` nem `executar` (ciclo de módulos): o catálogo chega por parâmetro.
 */

/** A prova tem teto de tempo próprio (PROOF_TIMEOUT_MS) e nunca menos que isto, mesmo quando o lote já gastou quase tudo. */
export const PROOF_MIN_MS = 3_000
/** `cron_health.last_error` é cortado em 500 caracteres mais adiante; a mensagem do cron fica abaixo disso. */
export const CRON_MESSAGE_MAX = 480

export const plural = (n: number, one: string, many: string): string => n + ' ' + (n === 1 ? one : many)

/**
 * A mensagem de falha do cron: cada frase VERMELHA inteira, na ordem (a da agenda, as das tarefas, a do lote, as da prova, as da leitura
 * horária, a da cota). Se não couber em CRON_MESSAGE_MAX, o corte é entre frases e fecha com "e mais N avisos": nunca meia frase, e nota
 * nenhuma entra na frente de vermelho. A frase da cota é vermelha e é a única que a prova não repete na resposta: ela NÃO é a primeira a
 * ser cortada. O espaço dela é reservado antes e quem perde as últimas frases é a prova.
 * Sem `semAgenda`, `tarefas` e `horaria`, o texto é byte a byte o de antes desta etapa.
 */
export function failureMessage(f: { semAgenda?: string | null; tarefas?: string[]; lote: string | null; prova: string[]; horaria?: string[]; cota: string | null }): string {
  const tokens: Array<{ sep: string; text: string }> = [
    ...(f.semAgenda ? [{ sep: ' | ', text: f.semAgenda }] : []),
    ...(f.tarefas ?? []).map(t => ({ sep: ' | ', text: t })),
    ...(f.lote ? [{ sep: ' | ', text: f.lote }] : []),
    ...f.prova.map((p, i) => ({ sep: i === 0 ? ' | ' : '; ', text: (i === 0 ? 'série e captura: ' : '') + p })),
    ...(f.horaria ?? []).map((p, i) => ({ sep: i === 0 ? ' | ' : '; ', text: (i === 0 ? 'leitura horária: ' : '') + p })),
  ]
  const quota = f.cota
  const more = (n: number): string => ' | e mais ' + plural(n, 'aviso', 'avisos')
  const qLen = quota ? (tokens.length ? ' | '.length : 0) + quota.length : 0
  let out = '', used = 0
  for (const [i, t] of tokens.entries()) {
    const candidate = out + (out ? t.sep : '') + t.text
    const left = tokens.length - i - 1
    // o que ainda precisa caber depois desta frase: a cota (sempre) e o "e mais N" (se sobrar frase de fora)
    if (candidate.length + qLen + (left ? more(left).length : 0) > CRON_MESSAGE_MAX) break
    out = candidate; used++
  }
  if (used === 0 && tokens.length) {
    // nem a primeira frase cabe com a cota: a primeira é cortada com reticências e a cota segue inteira
    const room = CRON_MESSAGE_MAX - qLen
    const head = tokens[0]!.text.length > room ? tokens[0]!.text.slice(0, Math.max(0, room - 1)) + '…' : tokens[0]!.text
    return quota ? head + ' | ' + quota : head
  }
  const tail = used < tokens.length ? more(tokens.length - used) : ''
  // ordem final: frases ditas, a cota, e por último o "e mais N avisos"
  return out + (quota ? (out ? ' | ' : '') + quota : '') + tail
}

/** Roda a leitura da prova com teto de tempo; passou do teto (ou lançou), a resposta é uma FALHA, nunca verde. */
export async function readProofWithin(read: () => Promise<HealthVerdict>, timeoutMs: number): Promise<HealthVerdict> {
  const unread: HealthVerdict = { ok: false, problems: ['não foi possível ler a prova da captura e da série'], notes: [] }
  const slow: HealthVerdict = { ok: false, problems: ['não foi possível ler a prova a tempo (passou de ' + Math.round(timeoutMs / 1000) + ' s)'], notes: [] }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([read(), new Promise<HealthVerdict>(resolve => { timer = setTimeout(() => resolve(slow), timeoutMs) })])
  } catch {
    return unread
  } finally {
    clearTimeout(timer)
  }
}

/** O relato ao Sentry de tudo o que a agenda e a leitura horária contam: só o nome da tarefa, o código, a classe do erro e o sqlstate (S-I4). */
export function relatarAgenda(tarefa: string, o: { codigo: string; tecnico?: { classe: string; sqlstate: string | null } }): void {
  Sentry.captureMessage('agenda: ' + tarefa + ': ' + o.codigo, { level: 'error', tags: { component: 'sync-youtube', mode: 'agenda', tarefa }, extra: o.tecnico })
}

/** A resposta do lote, se for mesmo uma: `extra` de uma tarefa é `unknown`, e a conferência é de forma, não de confiança. */
export function ehResultadoDoLote(x: unknown): x is BatchResult {
  if (typeof x !== 'object' || x === null) return false
  const r: Record<string, unknown> = Object.fromEntries(Object.entries(x))
  return typeof r.synced === 'number' && typeof r.errors === 'number' && Array.isArray(r.siteIds)
}

export interface ResumoDaProva { ok: boolean; problems: string[]; notes: string[] }
const juntar = (vs: ReadonlyArray<{ ok: boolean; problems: string[]; notes: string[] }>): ResumoDaProva =>
  ({ ok: vs.every(v => v.ok), problems: [...new Set(vs.flatMap(v => v.problems))], notes: [...new Set(vs.flatMap(v => v.notes))] })

/** Estados finais em que a leitura horária chegou a montar a lista (o contador `lista` do detalhe é verdade). Os outros, `lista` zerada é só "não chegou lá". */
const MOTIVOS_ANTES_DA_LISTA: ReadonlySet<string> = new Set([
  'schema_ausente', 'schema_nao_conferido', 'lista_falhou', 'lista_cortada', 'excecao', 'passou_do_tempo', 'motivo_desconhecido', 'motivo_invalido',
])

/** Os contadores da lista da leitura horária, se ela chegou a montar a lista neste disparo; senão nulo. */
function detalheDaLista(f: EstadoFinalTarefa | undefined): { lista: number; propriosLista: number; propriosSemStatus: number } | null {
  if (!f || f.estado === 'desligada' || f.estado === 'nao_devida' || f.estado === 'adiada' || f.estado === 'ocupada' || f.estado === 'esgotada') return null
  const d = f.detalhe
  if (!d || typeof d.lista !== 'number' || typeof d.proprios_lista !== 'number') return null
  if (f.estado === 'erro' && (f.motivo === undefined || MOTIVOS_ANTES_DA_LISTA.has(f.motivo))) return null
  return { lista: d.lista, propriosLista: d.proprios_lista, propriosSemStatus: typeof d.proprios_fora_sem_status === 'number' ? d.proprios_fora_sem_status : 0 }
}

/**
 * `listaDoDisparo` da prova horária de um site. O detalhe da leitura soma o dono e todos os sites (`lista`) e conta o dono à parte
 * (`proprios_lista`); a diferença é a lista dos concorrentes de todos os sites juntos, não a de UM site (que é o que `videos_na_lista` da
 * prova conta). Por isso só "zero" é entregue: zero concorrentes na lista vale para cada site. Acima de zero a grandeza por site não existe
 * aqui, e entregar o total faria o veredito comparar coisas diferentes: devolve nulo (sem opinião).
 */
export function listaDeConcorrentesVazia(f: EstadoFinalTarefa | undefined): 0 | null {
  const d = detalheDaLista(f)
  return d !== null && d.lista - d.propriosLista === 0 ? 0 : null
}

export interface EntradaFecho {
  sb: SupabaseClient
  t0: number
  agora: () => number
  resumo: ResumoDisparo
  catalogo: readonly Pick<Tarefa, 'nome' | 'rotulo' | 'tetoTentativas'>[]
  desligadas: ReadonlySet<string>
  /** Os canais lidos no começo do disparo; nulo = não foram lidos (os sites da prova são desconhecidos). */
  linhas: BatchRow[] | null
  /** Desde quando a agenda roda (`EstadoAgenda.desde`); nulo = sem agenda conhecida (a prova horária fica em carência). */
  agendaDesde: string | null
  /** As frases vermelhas que o chamador já tem (por exemplo, "não foi possível ler os canais"), na frente das do despachante. */
  problemasAntes: string[]
}
export interface Fechamento {
  prova: ResumoDaProva
  provaHoraria: ResumoDaProva
  avisos: Aviso[]
  lote: BatchResult | null
  acaoDoDono: string[]
  /** Todas as frases vermelhas das tarefas, na ordem em que entram na mensagem. */
  tarefasProblemas: string[]
  /** A frase vermelha do lote (`batchHealth`), se houver. */
  loteMensagem: string | null
  cota: string | null
  /** Verde só quando nada é vermelho. */
  vermelho: boolean
  mensagem: string | null
}

/**
 * A prova do disparo, lida do banco a CADA disparo e por site: a captura e a série (`readSiteHealth`) e a leitura horária
 * (`lerProvaHoraria` + `veredictoHorario`), mais os vídeos negados do dono (uma ida só, entregue a todos os sites). Devolve também a
 * mensagem de falha, que é a MESMA frase que vai ao `cron_health`. Nunca lança por causa de uma prova: prova que não veio é vermelho.
 */
export async function fecharDisparo(e: EntradaFecho): Promise<Fechamento> {
  const { sb, resumo } = e
  const nowMs = e.agora()
  const nowIso = new Date(nowMs).toISOString()
  const final = (nome: string): EstadoFinalTarefa | undefined => resumo.tarefas.find(t => t.tarefa === nome)
  const rotulo = (nome: string, padrao: string): string => e.catalogo.find(t => t.nome === nome)?.rotulo ?? padrao

  const faixa = final('sincronizar_canais')
  const lote = faixa && ehResultadoDoLote(faixa.extra) ? faixa.extra : null
  const saudeDoLote = lote ? batchHealth(lote) : { ok: true as boolean, message: undefined as string | undefined }
  const loteMensagem = saudeDoLote.ok ? null : (saudeDoLote.message ?? 'batch failed')
  // A faixa terminou: a linha dela está ok depois deste disparo (rodou e fechou ok, ou já estava ok e nada a reabriu) ou passaram
  // SLOT_COVER_LIMIT_MS do começo dela: uma faixa que nunca termina não pode deixar a diária sem cobrança para sempre.
  const slotDone = faixa?.estado === 'ok' || faixa?.estado === 'nao_devida' || nowMs - currentSlotStart(nowMs) > SLOT_COVER_LIMIT_MS
  const semanalDesligada = e.desligadas.has('serie_semanal')
  const horariaLigada = !e.desligadas.has('leitura_horaria')
  const proofMs = Math.max(PROOF_MIN_MS, Math.min(PROOF_TIMEOUT_MS, LIMITE_FUNCAO_MS - RECORD_RESERVE_MS - (nowMs - e.t0)))

  const horaria = final('leitura_horaria')
  const listaDoDisparo = listaDeConcorrentesVazia(horaria)
  const semStatusNoDisparo = detalheDaLista(horaria)?.propriosSemStatus ?? null

  const sites = e.linhas ? [...new Set(e.linhas.map(r => r.site_id))] : null
  let prova: ResumoDaProva
  let provaHoraria: ResumoDaProva = { ok: true, problems: [], notes: [] }
  const avisos: Aviso[] = []

  if (sites === null) {
    // a lista de sites não veio: não dá para saber o que ler, e "nada lido" nunca é verde
    prova = { ok: false, problems: ['não foi possível ler a lista de sites da prova'], notes: [] }
  } else if (sites.length === 0) {
    prova = { ok: true, problems: [], notes: ['nenhum canal de concorrente ativo'] }
  } else {
    // uma ida só para o dono, em paralelo com as provas dos sites e sob o mesmo teto
    const negadosLido: Promise<Lido<{ negados: number; semClasse: number }>> = horariaLigada
      ? comPrazo(lerNegadosDoDono(sb, nowIso), proofMs).then(
          r => ('estourou' in r ? { porque: 'a leitura dos vídeos negados passou do prazo' } : r.valor),
          () => ({ porque: 'a leitura dos vídeos negados falhou (ver Sentry)' }),
        )
      : Promise.resolve({ porque: 'leitura horária desligada' })
    const porSite = await Promise.all(sites.map(async siteId => {
      const [serie, provaLida] = await Promise.all([
        readProofWithin(() => readSiteHealth(sb, siteId, nowIso, { slotDone, e2: true, ...(semanalDesligada ? { weekly: false } : {}) }), proofMs),
        horariaLigada
          ? comPrazo(lerProvaHoraria(sb, siteId, nowIso), proofMs).then(
              (r): Lido<ProvaHoraria> => ('estourou' in r ? { porque: 'a prova da leitura horária passou do prazo' } : r.valor),
              (): Lido<ProvaHoraria> => ({ porque: 'a prova da leitura horária falhou (ver Sentry)' }),
            )
          : Promise.resolve<Lido<ProvaHoraria>>({ porque: 'leitura horária desligada' }),
      ])
      const negados = await negadosLido
      const veredito = veredictoHorario('valor' in provaLida ? provaLida.valor : null, {
        agoraMs: nowMs, ligada: horariaLigada, agendaDesde: e.agendaDesde, listaDoDisparo, semStatusNoDisparo,
        negadosDoDono: 'valor' in negados ? negados.valor.negados : null,
        negadosSemClasse: 'valor' in negados ? negados.valor.semClasse : 0,
      })
      return { siteId, serie, veredito }
    }))
    prova = juntar(porSite.map(s => s.serie))
    provaHoraria = juntar(porSite.map(s => s.veredito))
    for (const s of porSite) for (const a of s.veredito.avisos) avisos.push({ siteId: s.siteId, chave: a.chave, tarefa: rotulo('leitura_horaria', 'leitura horária'), frase: a.frase })
  }

  // uma tarefa esgotada neste disparo avisa o dono, uma vez por site e por dia
  for (const t of resumo.tarefas) {
    if (t.estado !== 'esgotada') continue
    const def = e.catalogo.find(c => c.nome === t.tarefa)
    if (!def || !sites) continue
    for (const siteId of sites) avisos.push({ siteId, chave: 'tarefa_esgotada', tarefa: def.rotulo, frase: def.rotulo + ' esgotou as ' + def.tetoTentativas + ' tentativas do período' })
  }

  const semanal = final('serie_semanal')
  const errosSemanal = semanal?.detalhe?.erros
  const tarefasProblemas = [
    ...e.problemasAntes,
    ...resumo.problemas,
    ...(typeof errosSemanal === 'number' && errosSemanal > 0 ? ['série semanal: ' + plural(errosSemanal, 'erro', 'erros') + ' na passada'] : []),
  ]
  const cota = lote?.quotaLost ? plural(lote.quotaLost, 'unidade', 'unidades') + ' de cota ' + (lote.quotaLost === 1 ? 'não registrada' : 'não registradas') : null
  const vermelho = tarefasProblemas.length > 0 || loteMensagem !== null || !prova.ok || !provaHoraria.ok || cota !== null
  return {
    prova, provaHoraria, avisos, lote, cota, vermelho, loteMensagem, tarefasProblemas,
    acaoDoDono: e.linhas ? ownerActions(e.linhas, nowMs) : [],
    mensagem: vermelho
      ? failureMessage({ tarefas: tarefasProblemas, lote: loteMensagem, prova: prova.ok ? [] : prova.problems, horaria: provaHoraria.ok ? [] : provaHoraria.problems, cota })
      : null,
  }
}
