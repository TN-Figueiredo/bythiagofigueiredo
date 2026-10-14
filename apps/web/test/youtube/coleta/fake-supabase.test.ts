// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, comReachApply, type Row } from './fake-supabase'
import { COLLECTION_KINDS } from '@/lib/youtube/coleta/kinds'

const rpcArgs = { p_site_id: 's', p_scope_type: 'video', p_scope_id: 'v', p_kind: 'meta', p_outcome: 'ok' }

describe('fakeSupabase estrito', () => {
  it('rpc sem handler devolve PGRST202', async () => {
    const r = await fakeSupabase().client.rpc('nao_existe')
    expect(r.error).toMatchObject({ code: 'PGRST202' })
    expect(r.data).toBeNull()
  })
  it('o manipulador padrão de yt_own_daily_apply está instalado', () => {
    expect(typeof fakeSupabase().rpcHandlers.yt_own_daily_apply).toBe('function')
  })
  it('rpc de nome desconhecido continua devolvendo PGRST202, e errors[rpc:<nome>] vale mais que o manipulador', async () => {
    const db = fakeSupabase()
    expect((await db.client.rpc('yt_funcao_que_nao_existe', {})).error).toMatchObject({ code: 'PGRST202' })
    db.errors['rpc:yt_own_daily_apply'] = { code: 'PGRST202', message: 'x' }
    expect((await db.client.rpc('yt_own_daily_apply', {})).error).toMatchObject({ code: 'PGRST202' })
  })
  it('yt_own_attempt_record: not null, CHECKs e truncamento de 500', async () => {
    const db = fakeSupabase()
    expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_site_id: null })).error).toMatchObject({ code: '23502' })
    for (const k of ['p_scope_type', 'p_kind', 'p_outcome']) {
      expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, [k]: 'x' })).error).toMatchObject({ code: '23514' })
    }
    await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_error: 'a'.repeat(600) })
    expect((db.tables.yt_own_collection_attempts![0]!.error as string).length).toBe(500)
  })
  it('yt_own_attempt_record aceita todo valor de COLLECTION_KINDS e recusa kind fora do catálogo com 23514', async () => {
    for (const k of COLLECTION_KINDS) {
      const db = fakeSupabase()
      const r = await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_kind: k })
      expect(r.error, k).toBeNull()
      expect(db.tables.yt_own_collection_attempts![0]!.kind).toBe(k)
    }
    const db = fakeSupabase()
    expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_kind: 'Ruim!' })).error).toMatchObject({ code: '23514' })
    expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_kind: 'retencao_7d ' })).error).toMatchObject({ code: '23514' })
  })
  it('embaralharEmpates: empates saem em ordem diferente a cada leitura; com desempate total a ordem é sempre a mesma; desligado é estável', async () => {
    const linhas = Array.from({ length: 50 }, (_, i) => ({ k: 1, id: `id-${String(i).padStart(2, '0')}` }))
    const ids = async (db: ReturnType<typeof fakeSupabase>, desempate: boolean) => {
      let q = db.client.from('t').select('k, id').order('k')
      if (desempate) q = q.order('id')
      return ((await q).data as Array<{ id: string }>).map(r => r.id)
    }
    const estavel = fakeSupabase({ t: linhas })
    expect(await ids(estavel, false)).toEqual(linhas.map(r => r.id)) // padrão: ordem de inserção
    const db = fakeSupabase({ t: linhas })
    db.embaralharEmpates = true
    const a = await ids(db, false)
    const b = await ids(db, false)
    expect(a).not.toEqual(b)
    expect([...a].sort()).toEqual(linhas.map(r => r.id)) // só embaralha: nada some nem repete
    expect(await ids(db, true)).toEqual(linhas.map(r => r.id)) // desempate total vence o embaralhamento
    expect(await ids(db, true)).toEqual(linhas.map(r => r.id))
  })
  it('range é fechado e 0-based; o corte de 1000 vale com ou sem limit/range; count é o total, independente do range', async () => {
    const db = fakeSupabase({ t: Array.from({ length: 2500 }, (_, i) => ({ n: i })) })
    const r = await db.client.from('t').select('n', { count: 'exact' }).order('n').range(2, 4)
    expect((r.data as Array<{ n: number }>).map(x => x.n)).toEqual([2, 3, 4])
    expect(r.count).toBe(2500)
    expect(((await db.client.from('t').select('n')).data as unknown[]).length).toBe(1000)
    expect(((await db.client.from('t').select('n').limit(5000)).data as unknown[]).length).toBe(1000)
    expect(((await db.client.from('t').select('n').order('n').range(2000, 2999)).data as unknown[]).length).toBe(500)
  })
  it('leituras conta só os selects da tabela; erroNaLeitura falha o select pedido e só ele; semContagem devolve count nulo', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }], u: [{ a: 1 }] })
    db.erroNaLeitura = (tabela, n) => (tabela === 't' && n === 2 ? { code: 'XX000', message: 'falhou' } : undefined)
    expect((await db.client.from('t').select('a')).error).toBeNull()
    expect((await db.client.from('u').select('a')).error).toBeNull()
    expect((await db.client.from('t').select('a')).error).toMatchObject({ code: 'XX000' })
    expect((await db.client.from('t').select('a')).error).toBeNull()
    expect(db.leituras).toEqual({ t: 3, u: 1 })
    expect((await db.client.from('t').select('a', { count: 'exact' })).count).toBe(1)
    db.semContagem.t = true
    expect((await db.client.from('t').select('a', { count: 'exact' })).count).toBeNull()
  })
  it('order: asc põe nulos por último, desc por primeiro, nullsFirst respeitado', async () => {
    const db = fakeSupabase({ t: [{ a: 2 }, { a: null }, { a: 1 }] })
    const ord = async (o: { ascending?: boolean; nullsFirst?: boolean }) =>
      ((await db.client.from('t').select('a').order('a', o)).data as Array<{ a: number | null }>).map(r => r.a)
    expect(await ord({ ascending: true })).toEqual([1, 2, null])
    expect(await ord({ ascending: false })).toEqual([null, 2, 1])
    expect(await ord({ ascending: true, nullsFirst: true })).toEqual([null, 1, 2])
    expect(await ord({ ascending: false, nullsFirst: false })).toEqual([2, 1, null])
  })
  it('single/maybeSingle: PGRST116', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: 2 }] })
    expect((await db.client.from('t').select('*').single()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').eq('a', 9).single()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').maybeSingle()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').eq('a', 9).maybeSingle())).toMatchObject({ data: null, error: null })
    expect((await db.client.from('t').select('*').eq('a', 1).single()).data).toEqual({ a: 1 })
  })
  it('not só com is/eq; or lança', () => {
    const q = fakeSupabase().client.from('t').select('*')
    expect(() => q.not('a', 'in', '(1)')).toThrow()
    expect(() => q.or('a.eq.1')).toThrow('or() não é suportado pelo banco em memória')
  })
  it('not is/eq', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: null }, { a: 2 }] })
    expect((await db.client.from('t').select('*').not('a', 'is', null)).data).toHaveLength(2)
    expect((await db.client.from('t').select('*').not('a', 'eq', 1)).data).toEqual([{ a: 2 }])
  })
  it('escrita devolve data null sem select; com select devolve linhas', async () => {
    const db = fakeSupabase({ t: [{ id: 1, a: 1 }] })
    expect((await db.client.from('t').insert({ id: 2, a: 2 })).data).toBeNull()
    expect((await db.client.from('t').update({ a: 5 }).eq('id', 1)).data).toBeNull()
    expect((await db.client.from('t').update({ a: 6 }).eq('id', 1).select('a')).data).toEqual([{ a: 6 }])
    expect((await db.client.from('t').delete().eq('id', 2).select()).data).toHaveLength(1)
  })
  it('upsert em lote heterogêneo anula a chave ausente (como o PostgREST)', async () => {
    const db = fakeSupabase({ t: [{ k: 1, a: 0, b: 2 }] }, { t: [['k']] })
    await db.client.from('t').upsert([{ k: 1, a: 9 }, { k: 2, a: 1, b: 5 }], { onConflict: 'k' })
    expect(db.tables.t).toEqual([{ k: 1, a: 9, b: null }, { k: 2, a: 1, b: 5 }])
    await db.client.from('t').upsert({ k: 2, a: 3 }, { onConflict: 'k' })
    expect(db.tables.t![1]).toEqual({ k: 2, a: 3, b: 5 })
  })
  it('chaves únicas: 23505 no insert duplicado e 42P10 no onConflict sem chave', async () => {
    const db = fakeSupabase()
    const t = db.client.from('yt_reporting_reports')
    expect((await t.insert({ report_id: 'r' })).error).toBeNull()
    expect((await db.client.from('yt_reporting_reports').insert({ report_id: 'r' })).error).toMatchObject({ code: '23505' })
    expect((await db.client.from('yt_reporting_reports').upsert({ report_id: 'r' }, { onConflict: 'report_id' })).error).toBeNull()
    expect((await db.client.from('yt_reporting_reports').upsert({ report_id: 'r' }, { onConflict: 'outra' })).error).toMatchObject({ code: '42P10' })
  })
  it('neq exclui nulos', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: null }, { b: 1 }, { a: 2 }] })
    expect((await db.client.from('t').select('*').neq('a', 1)).data).toEqual([{ a: 2 }])
  })
  it('projeção, clones e memoização', async () => {
    const db = fakeSupabase({ t: [{ a: 1, b: 2, c: 3 }] })
    const q = db.client.from('t').select('a, b')
    const r1 = await q
    expect(r1.data).toEqual([{ a: 1, b: 2 }])
    ;(r1.data as Array<{ a: number }>)[0]!.a = 99
    expect(db.tables.t![0]!.a).toBe(1)
    const w = db.client.from('t').insert({ a: 7 })
    await w; await w
    expect(db.tables.t).toHaveLength(2)
  })

  it('comReachApply: insere, recusa relatório mais velho, aceita o mais novo e o mesmo relatório', async () => {
    const db = comReachApply(fakeSupabase())
    const V = 'views_2025-03-31_a_2026-08-26'
    const alcance = (extra: Record<string, unknown> = {}) => ({
      youtube_video_id: 'yt2', day_pt: '2026-09-25', site_id: 's', video_id: null, channel_id: 'c',
      thumbnail_impressions: 3, thumbnail_ctr: 0.33333333333333331,
      source_report_id: 'rel-a', report_create_time: '2026-10-01T10:00:00.000Z', metric_version: V, ...extra,
    })
    const ler = () => db.tables.yt_own_video_reach_daily![0]!
    expect((await db.client.rpc('yt_own_reach_apply', { p_rows: [alcance()] })).data).toBe(1)
    expect(ler()).toMatchObject({ thumbnail_impressions: 3, source_report_id: 'rel-a', source: 'reporting_api' })

    const velho = await db.client.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 99, source_report_id: 'rel-velho', report_create_time: '2026-09-30T10:00:00.000Z' })] })
    expect(velho.data).toBe(0)
    expect(ler()).toMatchObject({ thumbnail_impressions: 3, source_report_id: 'rel-a' })

    const novo = await db.client.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: 'rel-novo', report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(novo.data).toBe(1)
    expect(ler()).toMatchObject({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: 'rel-novo' })

    const mesmo = await db.client.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 6, source_report_id: 'rel-novo', report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(mesmo.data).toBe(1)
    expect(ler()).toMatchObject({ thumbnail_impressions: 6 })
    expect(db.tables.yt_own_video_reach_daily).toHaveLength(1)
  })
  describe('comReachApply: como o Postgres', () => {
    const V = 'views_desde_2026-08-27'
    const linha = (extra: Record<string, unknown> = {}) => ({
      youtube_video_id: 'yt1', day_pt: '2026-09-25', site_id: 's', video_id: null, channel_id: 'c',
      thumbnail_impressions: 3, thumbnail_ctr: 0.5,
      source_report_id: 'rel-a', report_create_time: '2026-10-01T10:00:00.000Z', metric_version: V, ...extra,
    })

    it('mesma chave duas vezes no mesmo lote: 21000 e nada é gravado', async () => {
      const db = comReachApply(fakeSupabase())
      const r = await db.client.rpc('yt_own_reach_apply', { p_rows: [linha(), linha({ youtube_video_id: 'yt2' }), linha({ thumbnail_impressions: 9 })] })
      expect(r.error).toEqual({ code: '21000', message: 'ON CONFLICT DO UPDATE command cannot affect row a second time' })
      expect(r.data).toBeNull()
      expect(db.tables.yt_own_video_reach_daily ?? []).toHaveLength(0)
    })

    it('chave ausente numa linha do lote conta como nula, não mantém o valor antigo', async () => {
      const db = comReachApply(fakeSupabase())
      await db.client.rpc('yt_own_reach_apply', { p_rows: [linha()] })
      const { thumbnail_ctr: _ctr, ...semCtr } = linha({ thumbnail_impressions: 7 })
      const r = await db.client.rpc('yt_own_reach_apply', { p_rows: [semCtr] })
      expect(r.data).toBe(1)
      expect(db.tables.yt_own_video_reach_daily![0]).toMatchObject({ thumbnail_impressions: 7, thumbnail_ctr: null })
      const { thumbnail_impressions: _imp, ...semImp } = linha()
      await db.client.rpc('yt_own_reach_apply', { p_rows: [semImp] })
      expect(db.tables.yt_own_video_reach_daily![0]).toMatchObject({ thumbnail_impressions: null, thumbnail_ctr: 0.5 })
    })

    it('linha sem youtube_video_id ou sem day_pt: 23502', async () => {
      const db = comReachApply(fakeSupabase())
      const { youtube_video_id: _v, ...semVideo } = linha()
      const { day_pt: _d, ...semDia } = linha()
      expect((await db.client.rpc('yt_own_reach_apply', { p_rows: [semVideo] })).error).toMatchObject({ code: '23502' })
      expect((await db.client.rpc('yt_own_reach_apply', { p_rows: [semDia] })).error).toMatchObject({ code: '23502' })
      expect((await db.client.rpc('yt_own_reach_apply', { p_rows: [linha({ day_pt: null })] })).error).toMatchObject({ code: '23502' })
      expect(db.tables.yt_own_video_reach_daily ?? []).toHaveLength(0)
    })

    it('video_id nulo que chega não apaga o já gravado; um não nulo substitui', async () => {
      const db = comReachApply(fakeSupabase())
      await db.client.rpc('yt_own_reach_apply', { p_rows: [linha({ video_id: 'v-1' })] })
      await db.client.rpc('yt_own_reach_apply', { p_rows: [linha({ video_id: null })] })
      expect(db.tables.yt_own_video_reach_daily![0]).toMatchObject({ video_id: 'v-1' })
      await db.client.rpc('yt_own_reach_apply', { p_rows: [linha({ video_id: 'v-2' })] })
      expect(db.tables.yt_own_video_reach_daily![0]).toMatchObject({ video_id: 'v-2' })
    })
  })

  describe('yt_own_daily_apply (manipulador padrão): a regra da função', () => {
    const ids = { site_id: 's', channel_id: 'c', video_id: 'u' }
    const dia = (day: string, extra: Row = {}): Row => ({ day_pt: day, metric_version: 'views_desde_2026-08-27', views: 0, engaged_views: 0, ...extra })
    const chamar = (db: ReturnType<typeof fakeSupabase>, rows: Row[], sets: string[] = ['base', 'estendidas'], dias = rows.map(r => r.day_pt)) =>
      db.client.rpc('yt_own_daily_apply', { p_video: 'v', p_ids: ids, p_rows: rows, p_days_returned: dias, p_sets: sets })

    it('só o dia com atividade vira linha; todos ficam cobertos; devolve as cinco contagens', async () => {
      const db = fakeSupabase()
      const r = await chamar(db, [dia('2026-10-01'), dia('2026-10-02', { views: 2 }), dia('2026-10-03')])
      expect(r.data).toEqual({ dias: 3, atualizadas: 0, inseridas: 1, apagadas: 0, intervalos: 2 })
      expect(db.tables.yt_own_video_daily!.map(l => l.day_pt)).toEqual(['2026-10-02'])
      expect(db.tables.yt_own_video_coverage!.map(c => [c.metric_set, c.covered_from, c.covered_to])).toEqual([
        ['base', '2026-10-01', '2026-10-03'], ['estendidas', '2026-10-01', '2026-10-03'],
      ])
    })
    it('recusa, sem gravar nada: dias divergentes, linha sem metric_version, dia sem views na base, sem engaged_views nas estendidas', async () => {
      const db = fakeSupabase()
      const semViews = { day_pt: '2026-10-01', metric_version: 'x', engaged_views: 1 }
      const casos: Array<[string, Row[], string[], unknown[]?]> = [
        ['divergente', [dia('2026-10-01')], ['base'], ['2026-10-02']],
        ['repetido', [dia('2026-10-01'), dia('2026-10-01')], ['base'], ['2026-10-01', '2026-10-01']],
        ['sem versão', [dia('2026-10-01', { metric_version: '' })], ['base']],
        ['sem views', [semViews], ['base']],
        ['views nulo', [dia('2026-10-01', { views: null })], ['base']],
        ['sem engaged_views', [{ day_pt: '2026-10-01', metric_version: 'x', views: 1 }], ['base', 'estendidas']],
        ['p_sets inválido', [dia('2026-10-01')], ['outro']],
      ]
      for (const [nome, rows, sets, dias] of casos) {
        const r = await chamar(db, rows, sets, dias ?? rows.map(x => x.day_pt))
        expect(r.error, nome).toMatchObject({ code: '22023' })
      }
      expect(db.tables.yt_own_video_daily ?? []).toEqual([])
      expect(db.tables.yt_own_video_coverage ?? []).toEqual([])
    })
    it('sem views só passa no conjunto estendidas; a chave ausente não apaga o valor gravado; nulo explícito grava nulo', async () => {
      const db = fakeSupabase({ yt_own_video_daily: [{ youtube_video_id: 'v', day_pt: '2026-10-01', views: 5, likes: 3, avg_view_percentage: 40 }] })
      await chamar(db, [{ day_pt: '2026-10-01', metric_version: 'x', engaged_views: 2, avg_view_percentage: null }], ['estendidas'])
      expect(db.tables.yt_own_video_daily![0]).toMatchObject({ views: 5, likes: 3, engaged_views: 2, avg_view_percentage: null })
    })
    it('dia revisado para zero apaga a linha com views 0; linha com views nulo nunca é apagada', async () => {
      const db = fakeSupabase({ yt_own_video_daily: [
        { youtube_video_id: 'v', day_pt: '2026-10-01', views: 3 },
        { youtube_video_id: 'v', day_pt: '2026-10-02', views: null },
      ] })
      const r = await chamar(db, [dia('2026-10-01'), dia('2026-10-02', { views: 0 })], ['base'])
      // O dia 2 chega com views 0 e passa a ser 0 medido (a chave presente grava); o dia 1 também: os dois saem.
      expect(r.data).toMatchObject({ atualizadas: 2, apagadas: 2 })
      const db2 = fakeSupabase({ yt_own_video_daily: [{ youtube_video_id: 'v', day_pt: '2026-10-02', views: null, likes: null }] })
      await db2.client.rpc('yt_own_daily_apply', {
        p_video: 'v', p_ids: ids, p_rows: [{ day_pt: '2026-10-02', metric_version: 'x', views: 0 }], p_days_returned: ['2026-10-02'], p_sets: ['base'],
      })
      expect(db2.tables.yt_own_video_daily).toEqual([])
    })
    it('a cobertura funde vizinhos e parte no buraco', async () => {
      const db = fakeSupabase()
      await chamar(db, [dia('2026-10-01'), dia('2026-10-02')], ['base'])
      await chamar(db, [dia('2026-10-05')], ['base'])
      expect(db.tables.yt_own_video_coverage!.map(c => [c.covered_from, c.covered_to])).toEqual([['2026-10-01', '2026-10-02'], ['2026-10-05', '2026-10-05']])
      const r = await chamar(db, [dia('2026-10-03'), dia('2026-10-04')], ['base'])
      expect(r.data).toMatchObject({ intervalos: 1 })
      expect(db.tables.yt_own_video_coverage!.map(c => [c.covered_from, c.covered_to])).toEqual([['2026-10-01', '2026-10-05']])
    })
  })
})
