// Observatório A5 (E1 e E2): a guarda de schema e (Tarefa 12) a prova embutida da coleta.
import type { SupabaseClient } from '@supabase/supabase-js'

const E1: Array<[string, string]> = [
  ['competitor_videos', 'miss_streak, miss_first_at, missing_since, last_seen_at, views_hidden, discovered_at'],
  ['competitor_channels', 'miss_streak, last_seen_at, custom_url'],
  ['competitor_field_versions', 'id'],
  ['competitor_raw', 'id'],
]
const E2: Array<[string, string]> = [
  ['competitor_videos', 'series_tier, series_tier_since, daily_until'],
  ['competitor_channels', 'weekly_pass_date'], // (emenda do portão: D-I3)
  ['competitor_video_tier_spans', 'video_id'],
  ['competitor_video_early', 'video_id'],
]
const NOT_CHECKED = (table: string, why: string): string => 'não foi possível conferir o schema (' + table + '): ' + why + '. Nada foi gravado.'
/**
 * O código da E1 e da E2 grava colunas e tabelas novas. Sem a migration, parte dessas gravações falharia sem ninguém
 * ver; por isso o cron pergunta antes e para em vermelho. null = pronto.
 *
 * A pergunta que pesa é "o que acontece quando a PRÓPRIA guarda não consegue ler?": consulta que lança, resultado nulo,
 * sem a lista de linhas, ou erro sem ser de coluna/tabela ausente. Nada disso é "pronto": o texto diz que não deu para conferir.
 */
export async function schemaReady(sb: SupabaseClient, need: 'e1' | 'e1e2'): Promise<string | null> {
  for (const [name, list] of [['MG1', E1], ...(need === 'e1e2' ? [['MG2', E2]] : [])] as Array<[string, Array<[string, string]>]>) {
    for (const [table, cols] of list) {
      let res: { data?: unknown; error?: { message?: string; code?: string } | null } | null | undefined
      try {
        res = await sb.from(table).select(cols).limit(1)
      } catch (e) {
        return NOT_CHECKED(table, e instanceof Error ? e.message : 'a consulta falhou')
      }
      if (typeof res !== 'object' || res === null) return NOT_CHECKED(table, 'o banco não respondeu')
      const { data, error } = res
      if (error) {
        // (emenda do portão: S-M4) só "coluna ou tabela que não existe" é migration ausente: 42703 e 42P01 (Postgres),
        // PGRST204 e PGRST205 (o PostgREST não acha a coluna ou a tabela). Rede ou banco fora têm outra frase.
        const code = error.code ?? ''
        if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) return 'migration ' + name + ' não aplicada (' + table + '): ' + (error.message ?? code) + '. Nada foi gravado.'
        return NOT_CHECKED(table, error.message ?? 'erro do banco')
      }
      // um select que deu certo devolve a lista (vazia ou não): qualquer outra forma é leitura que não dá para confiar
      if (!Array.isArray(data)) return NOT_CHECKED(table, 'resposta fora da forma esperada')
    }
  }
  return null
}

// ───────── Tarefa 12: a prova embutida (o que o cron lê do banco a cada disparo) ─────────

export interface CaptureHealth { videos_vistos_sem_raw: number; canais_vistos_sem_raw: number; canais_vistos_dia_pacifico: number; cota_dia_pacifico: number; videos_ausentes: number; canais_ausentes: number; canais_em_erro_12h: number; canais_em_erro_3d: number
  /** MG2b: todos os canais do site (ausentes inclusive). Obrigatória: é a guarda da migration corretiva. */
  canais_total: number }
export interface SeriesHealth { hoje: string; hora_sp: number; fora_da_prova: number; sem_faixa: number; diaria_sem_ponto_hoje: number; diaria_buracos_3d: number; semanal_atrasados: number; semanal_atrasados_9d: number; semanal_devidos_hoje: number; sem_miniatura_9d: number; diaria_total: number; semanal_total: number
  /** MG2b: vídeos de canal em erro há mais de 3 dias (já contados em fora_da_prova). Obrigatória: é a guarda da migration corretiva. */
  fora_canal_em_erro_3d: number }
export interface HealthVerdict { ok: boolean; problems: string[]; notes: string[] }

/**
 * As regras de tempo da prova vivem aqui, num lugar só. Horas de São Paulo (`hora_sp` vem do SQL, que usa America/Sao_Paulo).
 * O "8º dia" e o "9º dia" não têm constante: o SQL só os conta quando a faixa tem 8 ou 9 dias, então no dia do deploy
 * e nos 7 seguintes eles valem 0 por construção (nenhuma data de deploy mora no código).
 */
/** "Vídeo da faixa diária sem ponto hoje" só é cobrado a partir desta hora (e com a faixa inteira tentada). */
export const DAILY_DUE_FROM_HOUR_SP = 18
/** "Devidos hoje" e "8º dia sem ponto" da faixa semanal só são cobrados a partir desta hora (e com a faixa inteira tentada). */
export const WEEKLY_DUE_FROM_HOUR_SP = 19

const CAPTURE_KEYS = ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h', 'canais_em_erro_3d', 'canais_total'] as const
const SERIES_KEYS = ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'semanal_atrasados_9d', 'semanal_devidos_hoje', 'sem_miniatura_9d', 'diaria_total', 'semanal_total', 'fora_canal_em_erro_3d'] as const
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Read<T> = { value: T } | { why: string }
const shown = (x: unknown): string => (typeof x === 'string' ? '"' + x + '"' : Array.isArray(x) ? 'uma lista' : x === null ? 'nulo' : String(x))

/** O objeto da prova, ou o motivo (em português) de não ser um. Lista, texto e nulo nunca viram objeto. */
function asObject(x: unknown): Read<Record<string, unknown>> {
  if (x === null || x === undefined) return { why: 'a resposta veio vazia' }
  if (Array.isArray(x)) return { why: 'a resposta é uma lista, não um objeto' }
  if (typeof x !== 'object') return { why: 'a resposta não é um objeto (veio ' + shown(x) + ')' }
  return { value: Object.fromEntries(Object.entries(x)) }
}

// (emenda do portão: S-I3) sem cast duplo: o objeto é montado chave a chave, com cada valor conferido.
/** As contagens de `keys`, todas conferidas. Uma chave faltando, ou um valor que não é inteiro ≥ 0, é o motivo da falha; chave extra é ignorada. */
function counts<K extends string>(d: Record<string, unknown>, keys: readonly K[]): Read<Record<K, number>> {
  const out: Partial<Record<K, number>> = {}
  for (const k of keys) {
    if (!(k in d) || d[k] === undefined) return { why: 'falta o campo ' + k }
    const v = d[k]
    if (!isCount(v)) return { why: 'o campo ' + k + ' não é um número inteiro maior ou igual a zero (veio ' + shown(v) + ')' }
    out[k] = v
  }
  return { value: out as Record<K, number> } // todas as chaves foram preenchidas no laço acima
}

/**
 * (MG2b) A migration corretiva das provas só troca o corpo de duas funções: não há coluna nem tabela para o `schemaReady` conferir.
 * A guarda é a chave nova: sem ela a função ainda é a de antes e o cron fica vermelho, com o motivo escrito, em vez de verde.
 */
const MG2B_WHY = 'migration corretiva das provas não aplicada (falta o campo '
const hasKey = (d: Record<string, unknown>, k: string): boolean => k in d && d[k] !== undefined

function readCapture(data: unknown): Read<CaptureHealth> {
  const o = asObject(data)
  if ('why' in o) return o
  if (!hasKey(o.value, 'canais_total')) return { why: MG2B_WHY + 'canais_total)' }
  return counts(o.value, CAPTURE_KEYS)
}
function readSeries(data: unknown): Read<SeriesHealth> {
  const o = asObject(data)
  if ('why' in o) return o
  const d = o.value
  if (typeof d.hoje !== 'string' || !DATE_RE.test(d.hoje)) return { why: 'o campo hoje não é uma data AAAA-MM-DD (veio ' + shown(d.hoje) + ')' }
  if (!hasKey(d, 'fora_canal_em_erro_3d')) return { why: MG2B_WHY + 'fora_canal_em_erro_3d)' }
  const c = counts(d, SERIES_KEYS)
  if ('why' in c) return c
  if (c.value.hora_sp > 23) return { why: 'o campo hora_sp está fora de 0 a 23 (veio ' + c.value.hora_sp + ')' }
  return { value: { hoje: d.hoje, ...c.value } }
}

/** null = a prova não veio inteira. Uma contagem nunca é adivinhada como 0. */
export function parseCaptureHealth(data: unknown): CaptureHealth | null {
  const r = readCapture(data)
  return 'why' in r ? null : r.value
}
export function parseSeriesHealth(data: unknown): SeriesHealth | null {
  const r = readSeries(data)
  return 'why' in r ? null : r.value
}

const n = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many)

/**
 * `slotDone` = nenhum canal ficou devido nesta faixa (só então "sem ponto hoje" pode ser cobrado).
 * `thumbs: false` = a miniatura dos semanais não é coletada (pergunta 1): `sem_miniatura_9d` não é cobrado.
 */
export interface VerdictOpts {
  slotDone: boolean; e2: boolean; thumbs?: boolean
  /** false = a fase semanal do disparo está desligada: os semanais (devidos hoje, 8º e 9º dia) não são cobrados, e uma nota diz isso. Omitido = ligada, cobra. */
  weekly?: boolean
}
/** Totais de série zerados com canal lido no dia deixam de ser "esperado" (dia da ativação) e viram vermelho a partir desta hora de São Paulo, com a faixa terminada. */
export const CLASSIFIED_BY_HOUR_SP = 19

/**
 * O veredito é lido do ESTADO do banco a cada disparo: uma perda fica vermelha até ser consertada (ou, no caso do
 * buraco de um dia, por 3 dias), e não some no disparo seguinte só porque nele não havia nada a fazer.
 * Prova que não veio (nulo) é FALHA, nunca verde.
 */
export function healthVerdict(c: CaptureHealth | null, s: SeriesHealth | null, o: VerdictOpts): HealthVerdict {
  const problems: string[] = [], notes: string[] = []
  if (!c) problems.push('não foi possível ler a prova da captura')
  else {
    if (c.videos_vistos_sem_raw) problems.push(n(c.videos_vistos_sem_raw, 'vídeo lido', 'vídeos lidos') + ' sem resposta guardada')
    if (c.canais_vistos_sem_raw) problems.push(n(c.canais_vistos_sem_raw, 'canal lido', 'canais lidos') + ' sem resposta guardada')
    if (c.canais_vistos_dia_pacifico > 0 && c.cota_dia_pacifico === 0) problems.push('cota do dia não registrada (' + n(c.canais_vistos_dia_pacifico, 'canal lido', 'canais lidos') + ')')
    // (emenda do portão: D-I1, CTRL-d) o vermelho tem fim: do 3º dia em diante é nota, e a rota põe o nome do canal em acao_do_dono
    const errNew = Math.max(0, c.canais_em_erro_12h - c.canais_em_erro_3d)
    if (errNew) problems.push(n(errNew, 'canal', 'canais') + ' em erro há mais de 12 h')
    // (portão final, dados I-2) a decisão 53 vale para UM canal que saiu do YouTube. Metade ou mais dos canais em erro há mais de
    // 3 dias é pane (chave revogada, cota, banco): vermelho, nunca nota. `canais_total` conta todos os canais do site.
    const allDown = c.canais_total > 0 && c.canais_em_erro_3d * 2 >= c.canais_total
    if (allDown) problems.push(c.canais_em_erro_3d + ' de ' + n(c.canais_total, 'canal', 'canais') + ' em erro há mais de 3 dias')
    if (c.canais_em_erro_3d && !allDown) notes.push(n(c.canais_em_erro_3d, 'canal', 'canais') + ' em erro há mais de 3 dias (ver acao_do_dono)')
    if (c.videos_ausentes || c.canais_ausentes) notes.push(n(c.videos_ausentes, 'vídeo', 'vídeos') + ' e ' + n(c.canais_ausentes, 'canal', 'canais') + ' não vêm mais do YouTube')
  }
  if (o.e2) {
    if (o.weekly === false) notes.push('fase semanal desligada')
    if (!s) problems.push('não foi possível ler a prova da série')
    else {
      if (s.sem_faixa) problems.push(n(s.sem_faixa, 'vídeo', 'vídeos') + ' sem faixa de série')
      if (s.diaria_buracos_3d) problems.push(n(s.diaria_buracos_3d, 'buraco', 'buracos') + ' na série diária nos últimos 3 dias')
      // (emenda do portão: D-I3, D-m1) a faixa semanal. O 9º dia é perda e é vermelho a qualquer hora. O 8º dia e os devidos
      // de hoje só são falha depois das 19:00 de São Paulo com a faixa inteira tentada: antes disso a fase semanal ainda vai ler.
      // `weekly: false` (fase desligada): ninguém lê os semanais, então cobrá-los deixaria o cron vermelho todo dia às 19:00; a nota diz por que não cobra.
      if (o.weekly !== false) {
        const weeklyLate = s.hora_sp >= WEEKLY_DUE_FROM_HOUR_SP && o.slotDone
        if (s.semanal_atrasados_9d) problems.push(n(s.semanal_atrasados_9d, 'vídeo', 'vídeos') + ' da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)')
        const eighth = Math.max(0, s.semanal_atrasados - s.semanal_atrasados_9d)
        if (eighth) (weeklyLate ? problems : notes).push(n(eighth, 'vídeo', 'vídeos') + ' da faixa semanal no 8º dia sem ponto')
        if (s.semanal_devidos_hoje && weeklyLate) problems.push(n(s.semanal_devidos_hoje, 'vídeo', 'vídeos') + ' da faixa semanal devidos hoje e ainda sem ponto')
      }
      // (emenda do portão: D-I4) a imagem que a origem sobrescreve: toda leitura confere a miniatura, então 9 dias sem cópia é falha
      if (s.sem_miniatura_9d && o.thumbs !== false) problems.push(n(s.sem_miniatura_9d, 'vídeo', 'vídeos') + ' sem cópia da miniatura depois de 9 dias')
      // só depois das 18:00 de São Paulo e com todos os canais da faixa tentados: antes disso faltar ponto é o esperado
      if (s.diaria_sem_ponto_hoje && s.hora_sp >= DAILY_DUE_FROM_HOUR_SP && o.slotDone) problems.push(n(s.diaria_sem_ponto_hoje, 'vídeo', 'vídeos') + ' da faixa diária sem ponto hoje')
      // Os totais com faixa (diaria_total e semanal_total) em zero, com canal lido hoje, é a classificação sem ter feito nada.
      // No dia da ativação, antes da faixa das 18:00 gravar as faixas, é esperado (nota). Daí em diante, com a faixa terminada, é a coleta
      // que não está classificando: vermelho, nunca verde mudo.
      if (c && c.canais_vistos_dia_pacifico > 0 && s.diaria_total === 0 && s.semanal_total === 0) {
        if (s.hora_sp >= CLASSIFIED_BY_HOUR_SP && o.slotDone) problems.push('nenhum vídeo com faixa de série: a coleta não está classificando')
        else notes.push('nenhum vídeo com faixa ainda (esperado só no dia da ativação, antes das 18:00)')
      }
      if (s.fora_da_prova) notes.push(s.fora_da_prova + ' fora da prova de série (sem contagem, estreia agendada, ausente ou de canal em erro há mais de 3 dias)')
      if (s.fora_canal_em_erro_3d) notes.push(n(s.fora_canal_em_erro_3d, 'vídeo', 'vídeos') + ' de canal em erro há mais de 3 dias fora da prova')
    }
  }
  return { ok: problems.length === 0, problems, notes }
}

type RpcAnswer = { data?: unknown; error?: { message?: string } | null } | null | undefined

/** Chama a função de prova e a confere; qualquer jeito de "não li" (lança, erro, vazio, forma errada) devolve o motivo, nunca um número. */
async function readProof<T>(call: () => PromiseLike<RpcAnswer>, parse: (data: unknown) => Read<T>): Promise<Read<T>> {
  let res: RpcAnswer
  try {
    res = await call()
  } catch (e) {
    return { why: 'a chamada ao banco falhou (' + (e instanceof Error ? e.message : 'sem detalhe') + ')' }
  }
  if (typeof res !== 'object' || res === null) return { why: 'o banco não respondeu' }
  if (res.error) return { why: 'o banco respondeu com erro (' + (res.error.message ?? 'sem detalhe') + ')' }
  return parse(res.data)
}

export async function readSiteHealth(sb: SupabaseClient, siteId: string, nowIso: string, o: VerdictOpts): Promise<HealthVerdict> {
  const args = { p_site_id: siteId, p_now: nowIso }
  const cap = await readProof(() => sb.rpc('competitor_capture_health', args), readCapture)
  const ser = o.e2 ? await readProof(() => sb.rpc('competitor_series_health', args), readSeries) : null
  const v = healthVerdict('why' in cap ? null : cap.value, !ser || 'why' in ser ? null : ser.value, o)
  // o motivo da leitura que falhou vai numa nota (o problema continua com a frase fixa), para o dono saber o que consertar
  if ('why' in cap) v.notes.push('prova da captura: ' + cap.why)
  if (ser && 'why' in ser) v.notes.push('prova da série: ' + ser.why)
  return v
}
