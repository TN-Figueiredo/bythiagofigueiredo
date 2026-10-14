// Manipulador em memória de `public.yt_own_daily_apply` (MG14, apêndice A do plano E6/E8): mesma regra de atividade, de
// recusa e de fusão da cobertura. A PROVA da regra é a Tarefa 1a, contra o banco; este fake só impede que um teste de
// unidade passe com uma chamada que o banco recusaria. Importa de `fake-supabase` SÓ TIPOS (sem ciclo de módulo).
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { FakeDb, FakeErr, Row } from './fake-supabase'

type Resposta = { data: unknown; error: FakeErr | null }

/** As 12 colunas que a função grava no diário (chave ausente na linha = a métrica não veio). */
const COLUNAS = [
  'views', 'engaged_views', 'watch_time_minutes', 'avg_view_duration_seconds', 'avg_view_percentage',
  'likes', 'comments', 'shares', 'subscribers_gained', 'subscribers_lost', 'card_impressions', 'card_click_rate',
] as const
/** As nove contagens que definem "atividade" (negativo conta). */
const CONTAGENS = [
  'views', 'engaged_views', 'watch_time_minutes', 'likes', 'comments', 'shares',
  'subscribers_gained', 'subscribers_lost', 'card_impressions',
] as const

const recusa = (message: string): Resposta => ({ data: null, error: { code: '22023', message: `yt_own_daily_apply: ${message}` } })
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const ehNumero = (v: unknown): boolean => typeof v === 'number'

export function comDailyApply(db: FakeDb): FakeDb {
  db.rpcHandlers.yt_own_daily_apply = (a): Resposta => {
    const video = a.p_video
    const ids = (a.p_ids ?? {}) as Row
    const sets = a.p_sets
    const rows = (a.p_rows ?? []) as Row[]
    if (typeof video !== 'string' || video === '') return recusa('p_video vazio')
    if (typeof ids.site_id !== 'string' || typeof ids.channel_id !== 'string') return recusa('p_ids sem site_id ou channel_id')
    if (!Array.isArray(sets) || sets.length === 0 || !sets.every(s => s === 'base' || s === 'estendidas')) {
      return recusa('p_sets tem de ser um subconjunto não vazio de {base, estendidas}')
    }
    if (!Array.isArray(rows)) return recusa('p_rows não é lista')

    const dias = [...new Set(((a.p_days_returned ?? []) as unknown[]).filter((d): d is string => typeof d === 'string'))].sort()
    if (dias.length === 0 && rows.length === 0) return { data: { dias: 0, atualizadas: 0, inseridas: 0, apagadas: 0, intervalos: 0 }, error: null }
    // p_rows e p_days_returned: o mesmo conjunto de dias, sem dia repetido.
    const diasDasLinhas = rows.map(r => r.day_pt)
    if (rows.length !== dias.length
        || diasDasLinhas.some(d => typeof d !== 'string' || !dias.includes(d))
        || new Set(diasDasLinhas).size !== rows.length) {
      return recusa('p_rows e p_days_returned não são o mesmo conjunto de dias')
    }
    if (rows.some(r => typeof r.metric_version !== 'string' || r.metric_version === '')) return recusa('linha sem metric_version')
    if (sets.includes('base') && rows.some(r => !ehNumero(r.views))) return recusa('dia sem views numa resposta do conjunto base')
    if (sets.includes('estendidas') && rows.some(r => !ehNumero(r.engaged_views))) {
      return recusa('dia sem engaged_views numa resposta do conjunto estendidas')
    }

    const agora = new Date().toISOString()
    const diario = (db.tables.yt_own_video_daily ??= [])
    const videoUuid = typeof ids.video_id === 'string' && ids.video_id !== '' ? ids.video_id : null
    let atualizadas = 0
    let inseridas = 0

    // (1a) a linha que já existe recebe só o que veio (chave presente e nula grava nulo)
    for (const r of rows) {
      const atual = diario.find(l => l.youtube_video_id === video && l.day_pt === r.day_pt)
      if (!atual) continue
      for (const col of COLUNAS) if (col in r) atual[col] = r[col] ?? null
      atual.video_id = videoUuid ?? atual.video_id ?? null
      atual.source = 'analytics_api'
      atual.collected_at = agora
      atual.metric_version = r.metric_version
      atualizadas++
    }
    // (1b) dia novo: só entra se tem atividade
    for (const r of rows) {
      if (diario.some(l => l.youtube_video_id === video && l.day_pt === r.day_pt)) continue
      if (!CONTAGENS.some(col => num(r[col]) !== 0)) continue
      diario.push({
        youtube_video_id: video, day_pt: r.day_pt, site_id: ids.site_id, video_id: videoUuid, channel_id: ids.channel_id,
        ...Object.fromEntries(COLUNAS.map(col => [col, r[col] ?? null])),
        source: 'analytics_api', collected_at: agora, metric_version: r.metric_version,
      })
      inseridas++
    }
    // (2) dia devolvido sem atividade: a linha sai. `views` NULO não é zero: só sai com views = 0 medido.
    const antes = diario.length
    db.tables.yt_own_video_daily = diario.filter(l => !(
      l.youtube_video_id === video && dias.includes(l.day_pt as string)
      && l.views === 0 && CONTAGENS.every(col => num(l[col]) === 0)
    ))
    const apagadas = antes - db.tables.yt_own_video_daily.length

    // (3) cobertura: a união do que já havia com os dias devolvidos; vizinhos se fundem, buraco parte o intervalo
    db.tables.yt_own_video_coverage ??= []
    let intervalos = 0
    for (const conjunto of sets as string[]) {
      const cobertura = db.tables.yt_own_video_coverage
      const faixas: Array<[string, string]> = cobertura
        .filter(c => c.youtube_video_id === video && c.metric_set === conjunto)
        .map(c => [c.covered_from as string, c.covered_to as string] as [string, string])
      for (const d of dias) faixas.push([d, d])
      faixas.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0))
      const fundidas: Array<[string, string]> = []
      for (const [de, ate] of faixas) {
        const ultima = fundidas[fundidas.length - 1]
        if (ultima && de <= addDays(ultima[1], 1)) {
          if (ate > ultima[1]) ultima[1] = ate
        } else fundidas.push([de, ate])
      }
      const inicios = new Set(fundidas.map(([de]) => de))
      db.tables.yt_own_video_coverage = cobertura.filter(c => !(
        c.youtube_video_id === video && c.metric_set === conjunto && !inicios.has(c.covered_from as string)
      ))
      const tabela = db.tables.yt_own_video_coverage
      for (const [de, ate] of fundidas) {
        const i = tabela.findIndex(c => c.youtube_video_id === video && c.metric_set === conjunto && c.covered_from === de)
        const nova = {
          youtube_video_id: video, metric_set: conjunto, covered_from: de, covered_to: ate,
          site_id: ids.site_id, video_id: videoUuid, channel_id: ids.channel_id, source: 'analytics_api', collected_at: agora,
        }
        if (i === -1) tabela.push(nova)
        else tabela[i] = { ...tabela[i]!, ...nova, video_id: videoUuid ?? tabela[i]!.video_id ?? null }
        intervalos++
      }
    }
    return { data: { dias: dias.length, atualizadas, inseridas, apagadas, intervalos }, error: null }
  }
  return db
}
