// @vitest-environment node
// apps/web/test/integration/coleta-l1a-migration.test.ts — tabelas e funções do lote L1a, no banco local.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const DIA = 864e5
const SEM_NORMALIZADOR = ['channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3']

describe.skipIf(skipIfNoLocalDb())('coleta L1a: schema (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  // Desde o L1b channel_id é chave estrangeira: o canal precisa existir.
  let canal = ''
  const sufixo = randomUUID().slice(0, 8)
  const relatorio = (id: string, extra: Record<string, unknown> = {}) => ({
    site_id: siteId, report_id: `${id}-${sufixo}`, job_id: `job-${sufixo}`, channel_id: canal,
    report_type_id: 'channel_reach_basic_a1',
    start_time: new Date(Date.now() - 2 * DIA).toISOString(), end_time: new Date(Date.now() - DIA).toISOString(),
    create_time: new Date().toISOString(), download_url: 'https://example.test/r', ...extra,
  })

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    const ch = await sb.from('youtube_channels').insert({
      site_id: siteId, channel_id: `UCl1a${sufixo}`, locale: 'pt', handle: `@l1a${sufixo}`, name: 'Canal L1a', uploads_playlist_id: `UUl1a${sufixo}`,
    }).select('id').single()
    if (ch.error || !ch.data) throw new Error(ch.error?.message ?? 'canal não criado')
    canal = ch.data.id as string
  })
  afterAll(async () => {
    // A série sai antes do canal (on delete restrict); o bruto vai por cascata do relatório.
    for (const t of ['yt_reporting_reports', 'yt_reporting_jobs', 'yt_own_video_meta_daily', 'yt_own_collection_attempts']) {
      await sb.from(t).delete().eq('site_id', siteId)
    }
    await sb.from('sites').delete().eq('id', siteId)
  })

  it('yt_own_attempt_record soma attempts na segunda chamada do dia e sobrescreve o resultado', async () => {
    const args = { p_site_id: siteId, p_scope_type: 'video', p_scope_id: `yt-${sufixo}`, p_kind: 'meta', p_outcome: 'erro_http', p_http_status: 503, p_error: 'x', p_channel_id: canal }
    const a = await sb.rpc('yt_own_attempt_record', args)
    expect(a.error).toBeNull()
    expect(a.data).toBe(1)
    const b = await sb.rpc('yt_own_attempt_record', { ...args, p_outcome: 'ok', p_http_status: null, p_error: null })
    expect(b.data).toBe(2)
    const lido = await sb.from('yt_own_collection_attempts').select('outcome, attempts, http_status, attempt_day').eq('scope_id', `yt-${sufixo}`)
    expect(lido.data).toHaveLength(1)
    expect(lido.data![0]).toMatchObject({ outcome: 'ok', attempts: 2, http_status: null, attempt_day: new Date().toISOString().slice(0, 10) })
  })

  it('resultado fora da lista é recusado pelo check (23514)', async () => {
    const r = await sb.rpc('yt_own_attempt_record', { p_site_id: siteId, p_scope_type: 'video', p_scope_id: `bad-${sufixo}`, p_kind: 'meta', p_outcome: 'talvez' })
    expect(r.error?.code).toBe('23514')
  })

  it('csv_gz: ida e volta de um gzip que contém os bytes 0x00 e 0xff', async () => {
    const csv = Buffer.concat([Buffer.from('a,b\n'), Buffer.from([0x00, 0xff, 0x00, 0xff]), Buffer.from('\n')])
    const gz = gzipSync(csv)
    const linha = relatorio('blob')
    expect((await sb.from('yt_reporting_reports').insert(linha)).error).toBeNull()
    const gravado = await sb.from('yt_reporting_report_blobs').insert({ report_id: linha.report_id, site_id: siteId, csv_gz: `\\x${gz.toString('hex')}` })
    expect(gravado.error).toBeNull()
    const lido = await sb.from('yt_reporting_report_blobs').select('csv_gz').eq('report_id', linha.report_id).single()
    const texto = lido.data!.csv_gz as string
    expect(texto.startsWith('\\x')).toBe(true)
    expect(gunzipSync(Buffer.from(texto.slice(2), 'hex')).equals(csv)).toBe(true)
  })

  it('listar de novo com ignoreDuplicates não altera um relatório já baixado', async () => {
    const linha = relatorio('dup', { status: 'baixado', row_count: 7 })
    expect((await sb.from('yt_reporting_reports').insert(linha)).error).toBeNull()
    const de_novo = await sb.from('yt_reporting_reports').upsert({ ...linha, status: 'listado', row_count: null, download_url: 'https://example.test/outra' }, { onConflict: 'report_id', ignoreDuplicates: true })
    expect(de_novo.error).toBeNull()
    const lido = await sb.from('yt_reporting_reports').select('status, row_count, download_url').eq('report_id', linha.report_id).single()
    expect(lido.data).toEqual({ status: 'baixado', row_count: 7, download_url: 'https://example.test/r' })
  })

  it('linha de metadados aceita is_short, privacy_status e os campos de A/B nulos, e a chave é (youtube_video_id, day_pt)', async () => {
    const base = { site_id: siteId, youtube_video_id: `yt-${sufixo}`, day_pt: '2026-10-06', channel_id: canal, captured_at: new Date().toISOString(), title_at_capture: 'T' }
    expect((await sb.from('yt_own_video_meta_daily').insert(base)).error).toBeNull()
    const repetida = await sb.from('yt_own_video_meta_daily').insert(base)
    expect(repetida.error?.code).toBe('23505')
    const lido = await sb.from('yt_own_video_meta_daily').select('is_short, privacy_status, ab_test_id, video_id').eq('youtube_video_id', `yt-${sufixo}`).single()
    expect(lido.data).toEqual({ is_short: null, privacy_status: null, ab_test_id: null, video_id: null })
  })

  it('anon não lê o bruto, nem as outras tabelas', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    for (const tabela of ['yt_reporting_report_blobs', 'yt_reporting_reports', 'yt_reporting_jobs', 'yt_own_video_meta_daily', 'yt_own_collection_attempts']) {
      const r = await anon.from(tabela).select('*').limit(1)
      expect(r.error !== null || (r.data ?? []).length === 0, tabela).toBe(true)
    }
    const f = await anon.rpc('yt_own_attempt_record', { p_site_id: siteId, p_scope_type: 'video', p_scope_id: 'anon', p_kind: 'meta', p_outcome: 'ok' })
    expect(f.error).not.toBeNull()
  })

  it('MG13 (E20): a limpeza não apaga nada, nem o normalizado há 91 dias nem o sem normalizador baixado há 181', async () => {
    const velho = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
    const a = relatorio('guarda-a', { report_type_id: 'channel_basic_a3', status: 'baixado', downloaded_at: velho(181) })
    const c = relatorio('guarda-c', { status: 'baixado', downloaded_at: velho(120), normalized_at: velho(91) })
    expect((await sb.from('yt_reporting_reports').insert([a, c])).error).toBeNull()
    const blob = (id: string) => ({ report_id: id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })
    expect((await sb.from('yt_reporting_report_blobs').insert([a, c].map(r => blob(r.report_id)))).error).toBeNull()
    const contar = async () => (await sb.from('yt_reporting_report_blobs').select('report_id', { count: 'exact', head: true }).eq('site_id', siteId)).count
    const antes = await contar()
    for (const lista of [SEM_NORMALIZADOR, [], ['channel_reach_basic_a1', 'channel_basic_a3']]) {
      const purge = await sb.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: lista })
      expect(purge.error).toBeNull()
      expect(purge.data).toBe(0)
    }
    expect(await contar()).toBe(antes)
    const restam = await sb.from('yt_reporting_report_blobs').select('report_id').in('report_id', [a.report_id, c.report_id])
    expect(restam.data!.map(r => r.report_id).sort()).toEqual([a.report_id, c.report_id].sort())
  })

  it('MG13: as quatro colunas de estado existem, com o padrão certo', async () => {
    const r = relatorio('guarda-col')
    expect((await sb.from('yt_reporting_reports').insert(r)).error).toBeNull()
    const lido = await sb.from('yt_reporting_reports').select('expired_at, download_attempts, last_error_at, blob_lost_at').eq('report_id', r.report_id).single()
    expect(lido.error).toBeNull()
    expect(lido.data).toEqual({ expired_at: null, download_attempts: 0, last_error_at: null, blob_lost_at: null })
  })

  // (emenda do portão: D-I1, D-I2) A conferência é anti-junção: um bruto sobrando não esconde um bruto faltando.
  // O banco local é compartilhado: as afirmações são sobre a DIFERENÇA em relação à leitura de antes, não sobre o total.
  it('MG13: yt_reporting_guarda_conferir acusa o baixado sem bruto E o bruto sem baixado, e desconta a perda reconhecida', async () => {
    const ler = async () => {
      const r = await sb.rpc('yt_reporting_guarda_conferir')
      expect(r.error).toBeNull()
      const l = (r.data as Array<Record<string, unknown>>)[0]!
      return { brutos: Number(l.brutos), baixados: Number(l.baixados), sem_bruto: Number(l.baixados_sem_bruto), sem_baixado: Number(l.brutos_sem_baixado), perdas: Number(l.perdas_reconhecidas) }
    }
    const antes = await ler()
    const semBruto = relatorio('guarda-sem-bruto', { status: 'baixado', downloaded_at: new Date().toISOString() })
    const semBaixado = relatorio('guarda-sem-baixado', { status: 'listado' })   // `listado`, sem downloaded_at, mas com bruto: o resíduo da execução sobreposta
    expect((await sb.from('yt_reporting_reports').insert([semBruto, semBaixado])).error).toBeNull()
    expect((await sb.from('yt_reporting_report_blobs').insert({ report_id: semBaixado.report_id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })).error).toBeNull()
    const meio = await ler()
    expect(meio.brutos - antes.brutos).toBe(1)
    expect(meio.baixados - antes.baixados).toBe(1)
    expect(meio.sem_bruto - antes.sem_bruto).toBe(1)        // a subtração "baixados menos brutos" daria 0 aqui
    expect(meio.sem_baixado - antes.sem_baixado).toBe(1)
    expect((await sb.from('yt_reporting_reports').update({ blob_lost_at: new Date().toISOString() }).eq('report_id', semBruto.report_id)).error).toBeNull()
    const fim = await ler()
    expect(fim.sem_bruto - antes.sem_bruto).toBe(0)         // perda reconhecida pelo dono sai do alarme
    expect(fim.perdas - antes.perdas).toBe(1)               // e continua contada
  })

  it('MG13: anon não executa a conferência da guarda', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    expect((await anon.rpc('yt_reporting_guarda_conferir')).error).not.toBeNull()
  })

  it('MG13: anon não executa a limpeza', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    expect((await anon.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: [] })).error).not.toBeNull()
  })
})
