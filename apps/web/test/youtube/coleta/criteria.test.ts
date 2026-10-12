// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criteriosRelatorios, criterioJobsEmErro, criterioOrcamento, criterioMetadados } from '@/lib/youtube/coleta/criteria'
import { REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'
import { fakeSupabase, type FakeDb, type FakeErr, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const diaUtc = (dias: number) => ha(dias).slice(0, 10)

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const ctxDe = (db: FakeDb) => ({ supabase: db.client, falhas: [] as string[], channels: [canal] })
const rel = (id: string, status: string, criadoHa: number, tipo = 'channel_reach_basic_a1'): Row => ({
  report_id: id, channel_id: 'ch-1', report_type_id: tipo, status, create_time: ha(criadoHa), is_backfill: false,
})
const jobAtivo = (criadoHa: number, tipo = 'channel_reach_basic_a1'): Row => ({
  channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: 'j', job_create_time: ha(criadoHa),
})
const tentativa = (scopeType: string, scopeId: string, kind: string, outcome: string, dias: number): Row => ({
  scope_type: scopeType, scope_id: scopeId, kind, outcome, attempt_day: diaUtc(dias), channel_id: 'ch-1', site_id: 'site-1', attempts: 1,
})

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('criteriosRelatorios', () => {
  it('tudo baixado: nenhuma falha, perdidos e atrasados zerados', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'baixado', 1), rel('b', 'baixado', 2)] })
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 0, acao_do_dono: [] })
    expect(ctx.falhas).toEqual([])
  })

  it('expirado_sem_baixar criado há 2 dias é falha por relatório; expirado cedo e criado há 15 dias sai de falhas e aparece em perdidos', async () => {
    const recente = fakeSupabase({ yt_reporting_reports: [rel('a', 'expirado_sem_baixar', 2)] })
    const c1 = ctxDe(recente)
    expect(await criteriosRelatorios(c1)).toEqual({ perdidos: 0, atrasados: 0, acao_do_dono: [] })
    expect(c1.falhas).toEqual(['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar'])

    // Corrente criado há 15 dias vence só daqui a 45: expirou cedo (404/410 na origem). Fica fora da nota por relatório
    // (criado há mais de 14 dias) e da agregada (só quem JÁ passou do prazo da origem), e conta em perdidos.
    const antigo = fakeSupabase({ yt_reporting_reports: [rel('a', 'expirado_sem_baixar', 15)] })
    const c2 = ctxDe(antigo)
    expect(await criteriosRelatorios(c2)).toEqual({ perdidos: 1, atrasados: 0, acao_do_dono: [] })
    expect(c2.falhas).toEqual([])
  })

  it('relatório em erro é falha em qualquer tipo habilitado: o de alcance com o texto de sempre, o que só guarda bruto com o motivo', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        rel('a', 'erro', 1),
        { ...rel('b', 'erro', 1, 'channel_basic_a3'), error: 'grande_demais' },
        rel('c', 'erro', 1, 'channel_traffic_source_a3'),
      ],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([
      'relatórios: Canal Um tem relatório de alcance channel_reach_basic_a1 em erro',
      'relatórios: Canal Um tem relatório channel_basic_a3 em erro (grande_demais)',
      'relatórios: Canal Um tem relatório channel_traffic_source_a3 em erro (sem texto)',
    ])
  })

  it('erro de tipo fora da lista habilitada não é falha', async () => {
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1, 'channel_annotations_a1')] }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('relatório recente em erro que o normalizador já anotou nesta execução: o critério não repete a falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1)] })
    const ctx = ctxDe(db)
    ctx.falhas.push('alcance: relatório a de Canal Um não pôde ser normalizado (gzip_invalido)')
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['alcance: relatório a de Canal Um não pôde ser normalizado (gzip_invalido)'])
  })

  it('alcance em erro há 15 dias: perdido, não falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 15)] })
    const ctx = ctxDe(db)
    expect((await criteriosRelatorios(ctx)).perdidos).toBe(1)
    expect(ctx.falhas).toEqual([])
  })

  it('4 relatórios de alcance vazios seguidos, em canal que publicou há 10 dias, é falha; 3 vazios e um baixado, não', async () => {
    const publicou = { id: 'v1', channel_id: 'ch-1', published_at: ha(10) }
    const quatro = fakeSupabase({
      yt_reporting_reports: [rel('a', 'vazio', 1), rel('b', 'vazio', 2), rel('c', 'vazio', 3), rel('d', 'vazio', 4), rel('e', 'baixado', 5)],
      youtube_videos: [publicou],
    })
    const c1 = ctxDe(quatro)
    const r1 = await criteriosRelatorios(c1)
    expect(c1.falhas).toEqual(['relatórios: Canal Um recebeu 4 relatórios channel_reach_basic_a1 vazios seguidos'])
    expect(r1.vazios_sem_publicacao ?? []).toEqual([])

    const tres = fakeSupabase({
      yt_reporting_reports: [rel('a', 'vazio', 1), rel('b', 'vazio', 2), rel('c', 'baixado', 3), rel('d', 'vazio', 4)],
      youtube_videos: [publicou],
    })
    const c2 = ctxDe(tres)
    await criteriosRelatorios(c2)
    expect(c2.falhas).toEqual([])
  })

  it('4 vazios seguidos em canal SEM vídeo (ou sem publicar há mais de 90 dias): não é falha, o canal sai em vazios_sem_publicacao', async () => {
    const vazios = [
      ...['a', 'b', 'c', 'd'].map((id, i) => rel(id, 'vazio', i + 1)),
      ...['e', 'f', 'g', 'h'].map((id, i) => rel(id, 'vazio', i + 1, 'channel_reach_combined_a1')),
    ]
    for (const videos of [[], [{ id: 'v1', channel_id: 'ch-1', published_at: ha(120) }]] as Row[][]) {
      const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: vazios, youtube_videos: videos }))
      const r = await criteriosRelatorios(ctx)
      expect(ctx.falhas).toEqual([])
      // Dois tipos de alcance vazios no mesmo canal: o nome aparece uma vez só.
      expect(r.vazios_sem_publicacao).toEqual(['Canal Um'])
    }
  })

  it('4 vazios seguidos e a leitura das publicações falha: "não foi possível avaliar", nunca verde nem vazios_sem_publicacao', async () => {
    const db = fakeSupabase({ yt_reporting_reports: ['a', 'b', 'c', 'd'].map((id, i) => rel(id, 'vazio', i + 1)) })
    db.errors.youtube_videos = { code: '57014', message: 'timeout' }
    const ctx = ctxDe(db)
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar vídeos recentes do canal Canal Um (youtube_videos)')
    expect(ctx.falhas.some(f => f.includes('vazios seguidos'))).toBe(false)
    expect(r.vazios_sem_publicacao ?? []).toEqual([])
  })

  it('relatório listado há mais de 14 dias é falha e conta em atrasados', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'listado', 15), rel('b', 'listado', 3)] })
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 1, acao_do_dono: [] })
    expect(ctx.falhas).toEqual(['relatórios: 1 relatório(s) listado(s) há mais de 14 dias sem baixar'])
  })

  it('job de alcance ativo há 7 dias, sem relatório novo, em canal com vídeo recente: falha', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobAtivo(7)],
      yt_reporting_reports: [rel('velho', 'baixado', 9)],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1', published_at: ha(30) }],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um está sem relatório novo de channel_reach_basic_a1 há mais de 6 dias'])
  })

  it('o mesmo job não é falha se: tem relatório de 2 dias, ou o canal não publica há 90 dias, ou o job tem 5 dias, ou o tipo não é de alcance e já listou relatório novo', async () => {
    const video = { id: 'v1', channel_id: 'ch-1', published_at: ha(30) }
    const casos: Array<Record<string, Row[]>> = [
      { yt_reporting_jobs: [jobAtivo(7)], yt_reporting_reports: [rel('novo', 'listado', 2)], youtube_videos: [video] },
      { yt_reporting_jobs: [jobAtivo(7)], youtube_videos: [{ ...video, published_at: ha(120) }] },
      { yt_reporting_jobs: [jobAtivo(5)], youtube_videos: [video] },
      { yt_reporting_jobs: [{ ...jobAtivo(7, 'channel_basic_a3'), last_create_time: ha(1) }], youtube_videos: [video] },
    ]
    for (const seed of casos) {
      const ctx = ctxDe(fakeSupabase(seed))
      await criteriosRelatorios(ctx)
      expect(ctx.falhas).toEqual([])
    }
  })

  it('tipo tirado de REPORT_TYPES_ENABLED: o listado antigo e o expirado dele não deixam o cron vermelho (ninguém vai baixá-los)', async () => {
    const FORA = 'channel_annotations_a1'
    const db = fakeSupabase({
      yt_reporting_reports: [rel('a', 'listado', 15, FORA), rel('b', 'listado', 40, FORA), rel('c', 'expirado_sem_baixar', 2, FORA)],
    })
    const ctx = ctxDe(db)
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.atrasados).toBe(0)
  })

  it('tabela ausente: schema_ausente, sem lançar', async () => {
    const db = fakeSupabase()
    db.errors.yt_reporting_reports = { code: '42P01', message: 'x' }
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 0, acao_do_dono: [] })
    expect(ctx.falhas).toContain('schema_ausente: yt_reporting_reports')
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar relatórios com problema (yt_reporting_reports)')
  })
})

describe('criteriosRelatorios: venceu sem baixar, aviso que persiste e termina', () => {
  const NOTA = (corpo: string) => `relatórios: ${corpo}`
  const vencido = (id: string, criadoHa: number, tipo: string, historico: boolean, status = 'expirado_sem_baixar'): Row =>
    ({ ...rel(id, status, criadoHa, tipo), is_backfill: historico })

  it('histórico (30 dias) que venceu há 10 dias: a nota aparece em CADA execução durante 14 dias e some no 15º, com o relógio andando', async () => {
    // criado há 40 dias; vence aos 30; venceu há 10. A nota dura até 14 dias depois do vencimento (criado há 44 dias).
    const db = fakeSupabase({ yt_reporting_reports: [vencido('a', 40, 'channel_basic_a3', true)] })
    const textos: string[][] = []
    for (let dia = 0; dia <= 5; dia++) {
      vi.setSystemTime(new Date(AGORA.getTime() + dia * DIA_MS))
      const ctx = ctxDe(db)
      const r = await criteriosRelatorios(ctx)
      textos.push(ctx.falhas)
      expect(r.perdidos).toBe(1) // o contador de perdidos segue igual: a nota agregada não o substitui
    }
    const nota = NOTA('1 relatório(s) venceram sem baixar nos últimos 14 dias (channel_basic_a3: 1)')
    expect(textos.slice(0, 4)).toEqual([[nota], [nota], [nota], [nota]]) // dias 0 a 3: venceu há 10 a 13 dias
    expect(textos[4]).toEqual([nota])            // dia 4: venceu há exatamente 14 dias: o último dia da janela (inclusivo)
    expect(textos[5]).toEqual([])                // dia 5: venceu há 15 dias: o aviso acabou, não é alarme eterno
  })

  it('a fronteira é exata: venceu há 14 dias menos 1 hora avisa; há 14 dias mais 1 hora não avisa (histórico e corrente)', async () => {
    const dentro = fakeSupabase({ yt_reporting_reports: [
      vencido('h', 30 + 14 - 1 / 24, 'channel_basic_a3', true),
      vencido('c', 60 + 14 - 1 / 24, 'channel_traffic_source_a3', false),
    ] })
    const c1 = ctxDe(dentro)
    await criteriosRelatorios(c1)
    expect(c1.falhas).toEqual([NOTA('2 relatório(s) venceram sem baixar nos últimos 14 dias (channel_basic_a3: 1; channel_traffic_source_a3: 1)')])

    const fora = fakeSupabase({ yt_reporting_reports: [
      vencido('h', 30 + 14 + 1 / 24, 'channel_basic_a3', true),
      vencido('c', 60 + 14 + 1 / 24, 'channel_traffic_source_a3', false),
    ] })
    const c2 = ctxDe(fora)
    const r = await criteriosRelatorios(c2)
    expect(c2.falhas).toEqual([])
    expect(r.perdidos).toBe(2)
  })

  it('o prazo certo é o da classe do relatório: corrente criado há 40 dias ainda nem venceu (60), então não há o que avisar', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [vencido('c', 40, 'channel_traffic_source_a3', false)] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([]) // expirado cedo (404/410) com mais de 14 dias de criado: só conta em perdidos
  })

  it('conta por tipo, em ordem estável, e soma o total', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [
      vencido('a', 40, 'channel_traffic_source_a3', true), vencido('b', 41, 'channel_basic_a3', true), vencido('c', 42, 'channel_basic_a3', true),
    ] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([NOTA('3 relatório(s) venceram sem baixar nos últimos 14 dias (channel_basic_a3: 2; channel_traffic_source_a3: 1)')])
  })

  it('nada venceu, ou só tipo fora da lista, ou só baixado/erro: sem nota (ausência de perda é o estado saudável, dito aqui)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [
      vencido('a', 40, 'channel_annotations_a1', true),                // tipo desligado: ninguém baixaria
      vencido('b', 40, 'channel_basic_a3', true, 'baixado'),
      vencido('c', 40, 'channel_basic_a3', true, 'listado'),
    ] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas.filter(f => f.includes('venceram sem baixar'))).toEqual([])
  })

  it('criado há menos de 14 dias não entra na nota agregada (já há a nota por relatório): sem duplicar', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [vencido('a', 3, 'channel_basic_a3', true)] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um tem relatório channel_basic_a3 expirado sem baixar'])
  })

  it('leitura que falha: não avalia, nunca verde', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [vencido('a', 40, 'channel_basic_a3', true)] })
    db.erroNaLeitura = (tabela, _n, colunas) => (tabela === 'yt_reporting_reports' && colunas.includes('is_backfill') ? { code: '57014', message: 'timeout' } : undefined)
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar relatórios que venceram sem baixar (yt_reporting_reports)')
  })

  it('leitura cortada em 1000: não afirma verde', async () => {
    const mil = Array.from({ length: 1000 }, (_, i) => vencido(`r-${i}`, 40, 'channel_basic_a3', true))
    const db = fakeSupabase({ yt_reporting_reports: mil })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar relatórios que venceram sem baixar (yt_reporting_reports): leitura cortada em 1000')
  })
})

describe('criterioJobsEmErro', () => {
  const jobErro: Row = { channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'erro' }
  const escopo = 'ch-1:channel_reach_basic_a1'

  it('job em erro com 3 dias seguidos de tentativa sem ok: falha', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobErro],
      yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)),
    })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um está com o job channel_reach_basic_a1 em erro há 3 dias'])
  })

  it('só 2 dias, ou um ok no meio: ainda não é falha', async () => {
    const dois = fakeSupabase({ yt_reporting_jobs: [jobErro], yt_own_collection_attempts: [0, 1].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)) })
    const c1 = ctxDe(dois)
    await criterioJobsEmErro(c1)
    expect(c1.falhas).toEqual([])

    const comOk = fakeSupabase({
      yt_reporting_jobs: [jobErro],
      yt_own_collection_attempts: [
        tentativa('job', escopo, 'relatorio', 'erro_http', 0),
        tentativa('job', escopo, 'sondagem', 'ok', 1),
        tentativa('job', escopo, 'relatorio', 'erro_http', 1),
        tentativa('job', escopo, 'sondagem', 'erro_http', 2),
      ],
    })
    const c2 = ctxDe(comOk)
    await criterioJobsEmErro(c2)
    expect(c2.falhas).toEqual([])
  })

  it('job ativo não é olhado', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ ...jobErro, status: 'ativo' }], yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)) })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toEqual([])
  })
})

describe('criterioOrcamento', () => {
  it('o mesmo escopo e kind sem alcançar nas 3 últimas tentativas: falha, uma nota por kind com a contagem', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [
        ...[0, 1, 2].map(d => tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', d)),
        ...[0, 1, 2].map(d => tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', d)),
        ...[0, 1, 2].map(d => tentativa('canal', 'ch-1', 'relatorio', 'nao_alcancado_orcamento', d)),
      ],
    })
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta', 'thumbnail', 'sondagem', 'relatorio'])
    expect(ctx.falhas.sort()).toEqual([
      'orçamento: 1 escopo(s) de relatorio sem alcançar nas 3 últimas tentativas',
      'orçamento: 2 escopo(s) de meta sem alcançar nas 3 últimas tentativas',
    ])
  })

  it('só 2 seguidas, ou um ok no meio, ou nada hoje: não é falha', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [
        ...[0, 1].map(d => tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', d)),
        tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', 0),
        tentativa('video', 'yt-2', 'meta', 'ok', 1),
        tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', 2),
        ...[1, 2, 3].map(d => tentativa('video', 'yt-3', 'meta', 'nao_alcancado_orcamento', d)),
      ],
    })
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta'])
    expect(ctx.falhas).toEqual([])
  })
})

const ERRO: FakeErr = { code: '57014', message: 'timeout' }
const naoAvaliou = (falhas: string[], criterio: string) =>
  falhas.some(f => f === `critérios: não foi possível avaliar ${criterio}`)

describe('leitura que falha nunca deixa o critério verde', () => {
  it('relatórios: leitura dos recentes falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1)] })
    db.errors.yt_reporting_reports = ERRO
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(naoAvaliou(ctx.falhas, 'relatórios com problema (yt_reporting_reports)')).toBe(true)
    expect(naoAvaliou(ctx.falhas, 'relatórios listados há mais de 14 dias (yt_reporting_reports)')).toBe(true)
    expect(naoAvaliou(ctx.falhas, 'relatórios perdidos (yt_reporting_reports)')).toBe(true)
  })

  it('relatórios: leitura dos jobs falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [] })
    db.errors.yt_reporting_jobs = ERRO
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(naoAvaliou(ctx.falhas, 'jobs de alcance sem relatório novo (yt_reporting_jobs)')).toBe(true)
  })

  it('relatórios: leitura de youtube_videos falha com job candidato', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobAtivo(7)] })
    db.errors.youtube_videos = ERRO
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(naoAvaliou(ctx.falhas, 'vídeos recentes do canal Canal Um (youtube_videos)')).toBe(true)
  })

  it('jobs em erro: leitura dos jobs ou das tentativas falha', async () => {
    const a = fakeSupabase()
    a.errors.yt_reporting_jobs = ERRO
    const c1 = ctxDe(a)
    await criterioJobsEmErro(c1)
    expect(naoAvaliou(c1.falhas, 'jobs em erro (yt_reporting_jobs)')).toBe(true)

    const b = fakeSupabase({ yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'erro' }] })
    b.errors.yt_own_collection_attempts = ERRO
    const c2 = ctxDe(b)
    await criterioJobsEmErro(c2)
    expect(naoAvaliou(c2.falhas, 'jobs em erro (yt_own_collection_attempts)')).toBe(true)
  })

  it('orçamento: leitura das tentativas falha', async () => {
    const db = fakeSupabase()
    db.errors.yt_own_collection_attempts = ERRO
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta'])
    expect(naoAvaliou(ctx.falhas, 'orçamento de meta (yt_own_collection_attempts)')).toBe(true)
  })

  it('orçamento: segunda leitura (o que veio depois do 3º) falha', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', d)),
    })
    // Falha só na leitura de linhas que NÃO são orçamento: o fake não tem erro por filtro, então fingimos pelo cliente.
    const real = db.client.from.bind(db.client)
    let chamadas = 0
    db.client.from = ((t: string) => {
      const q = real(t)
      if (t !== 'yt_own_collection_attempts') return q
      chamadas++
      if (chamadas === 1) return q
      return { select: () => ({ eq: () => ({ gt: () => ({ neq: () => ({ in: () => ({ limit: () => Promise.resolve({ data: null, error: ERRO, count: null }) }) }) }) }) }) }
    }) as typeof db.client.from
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta'])
    expect(naoAvaliou(ctx.falhas, 'orçamento de meta (yt_own_collection_attempts)')).toBe(true)
  })
})

describe('estados do dono, perdidos e prazos', () => {
  it('sem_acesso, api_nao_ativada e tipo_indisponivel vão para acao_do_dono e nunca para falhas', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [
        { channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'sem_acesso' },
        { channel_id: 'ch-1', report_type_id: 'channel_reach_combined_a1', status: 'api_nao_ativada' },
        { channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'tipo_indisponivel' },
        { channel_id: 'ch-1', report_type_id: 'channel_annotations_a1', status: 'desativado' },
      ],
    })
    const ctx = ctxDe(db)
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([
      'Canal Um: channel_reach_basic_a1 em sem_acesso',
      'Canal Um: channel_reach_combined_a1 em api_nao_ativada',
      'Canal Um: channel_basic_a3 em tipo_indisponivel',
    ])
  })

  it('perdidos conta erro velho de qualquer tipo habilitado e qualquer expirado; erro velho de tipo fora da lista não conta', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        rel('a', 'erro', 20), rel('b', 'expirado_sem_baixar', 20, 'channel_basic_a3'), rel('c', 'erro', 20, 'channel_basic_a3'),
        rel('d', 'erro', 20, 'channel_annotations_a1'),
      ],
    })
    const ctx = ctxDe(db)
    expect((await criteriosRelatorios(ctx)).perdidos).toBe(3)
    expect(ctx.falhas).toEqual([])
  })

  it('não exige job ativo: relatório em erro sem nenhum job ainda é falha', async () => {
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1)] }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toHaveLength(1)
  })

  it('job ativo há 7 dias sem relatório: o relatório do canal em OUTRO tipo não o salva', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobAtivo(7)],
      yt_reporting_reports: [rel('x', 'baixado', 1, 'channel_reach_combined_a1')],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1', published_at: ha(30) }],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um está sem relatório novo de channel_reach_basic_a1 há mais de 6 dias'])
  })

  it('leitura truncada em 1000 relatórios é falha de avaliação, não verde', async () => {
    const muitos = Array.from({ length: 1000 }, (_, i) => rel(`r${i}`, 'baixado', 1))
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: muitos }))
    await criteriosRelatorios(ctx)
    expect(naoAvaliou(ctx.falhas, 'relatórios com problema (yt_reporting_reports): leitura cortada em 1000')).toBe(true)
  })
})

describe('jobs em erro: só erro_http conta', () => {
  const escopo = 'ch-1:channel_reach_basic_a1'
  const jobErro: Row = { channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'erro' }
  it('3 dias de sem_conexao não é falha deste critério', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobErro], yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('job', escopo, 'sondagem', 'sem_conexao', d)) })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toEqual([])
  })
  it('só considera os 3 dias MAIS RECENTES, mesmo com lacuna no calendário', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobErro], yt_own_collection_attempts: [0, 3, 5, 9].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)) })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toHaveLength(1)
  })
})

describe('orçamento do kind thumbnail (prazo que acaba no meio da captura)', () => {
  it('thumbnail sem alcançar nas 3 últimas tentativas do vídeo: falha; com um ok ou erro_http no meio, não', async () => {
    const tres = ctxDe(fakeSupabase({
      yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('video', 'yt-1', 'thumbnail', 'nao_alcancado_orcamento', d)),
    }))
    await criterioOrcamento(tres, ['meta', 'thumbnail', 'sondagem', 'relatorio'])
    expect(tres.falhas).toEqual(['orçamento: 1 escopo(s) de thumbnail sem alcançar nas 3 últimas tentativas'])

    for (const meio of ['ok', 'erro_http']) {
      const ctx = ctxDe(fakeSupabase({
        yt_own_collection_attempts: [
          tentativa('video', 'yt-1', 'thumbnail', 'nao_alcancado_orcamento', 0),
          tentativa('video', 'yt-1', 'thumbnail', meio, 1),
          tentativa('video', 'yt-1', 'thumbnail', 'nao_alcancado_orcamento', 2),
          tentativa('video', 'yt-1', 'thumbnail', 'nao_alcancado_orcamento', 3),
        ],
      }))
      await criterioOrcamento(ctx, ['thumbnail'])
      expect(ctx.falhas).toEqual([])
    }
  })
})

describe('orçamento: leituras limitadas', () => {
  it('60 escopos sem alcançar: no máximo 2 leituras por kind (1 de faltas + 1 de verificação)', async () => {
    const linhas: Row[] = []
    for (let i = 0; i < 60; i++) for (const d of [0, 1, 2]) linhas.push(tentativa('video', `yt-${i}`, 'meta', 'nao_alcancado_orcamento', d))
    const db = fakeSupabase({ yt_own_collection_attempts: linhas })
    const ctx = ctxDe(db)
    const real = db.client.from.bind(db.client)
    let selects = 0
    db.client.from = ((t: string) => { selects++; return real(t) }) as typeof db.client.from
    await criterioOrcamento(ctx, ['meta'])
    expect(ctx.falhas).toEqual(['orçamento: 60 escopo(s) de meta sem alcançar nas 3 últimas tentativas'])
    expect(selects).toBeLessThanOrEqual(2)
  })

  it('um ok depois do 3º registro fecha o caso (miss, miss, miss com ok no meio não é falha)', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [
        tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', 0),
        tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', 1),
        tentativa('video', 'yt-1', 'meta', 'ok', 2),
        tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', 3),
      ],
    })
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta'])
    expect(ctx.falhas).toEqual([])
  })
})

describe('criterioMetadados', () => {
  const dia = '2026-10-06' // ontem no Pacífico em AGORA (12:05 UTC de 07/10)
  const videos: Row[] = [
    { id: 'v1', youtube_video_id: 'yt-1', channel_id: 'ch-1', published_at: ha(30) },
    { id: 'v2', youtube_video_id: 'yt-2', channel_id: 'ch-1', published_at: ha(30) },
  ]
  const linhaMeta = (yt: string): Row => ({ youtube_video_id: yt, channel_id: 'ch-1', day_pt: dia })

  it('dias_sem_meta maior que 0 é falha (uma vez); 0 não; chave ausente vai para desconhecido', async () => {
    const ctx = ctxDe(fakeSupabase({ youtube_videos: [], yt_own_video_meta_daily: [] }))
    const r = await criterioMetadados(ctx, { day_pt: dia, dias_sem_meta: { 'ch-1': 2 } })
    await criterioMetadados(ctx, { day_pt: dia, dias_sem_meta: { 'ch-1': 2 } })
    expect(ctx.falhas).toEqual([`metadados: Canal Um ficou 2 dia(s) sem linha antes de ${dia}`])
    expect(r.desconhecido).toEqual([])

    const c2 = ctxDe(fakeSupabase())
    expect(await criterioMetadados(c2, { day_pt: dia, dias_sem_meta: { 'ch-1': 0 } })).toEqual({ desconhecido: [] })
    expect(c2.falhas).toEqual([])

    const c3 = ctxDe(fakeSupabase())
    const r3 = await criterioMetadados(c3, { day_pt: dia, dias_sem_meta: {} })
    expect(r3.desconhecido).toEqual(['Canal Um'])
    expect(c3.falhas).toEqual([])
  })

  it('menos linhas que vídeos é falha; excluídos: publicados depois do dia e os não alcançados no orçamento', async () => {
    const db = fakeSupabase({
      youtube_videos: [...videos, { id: 'v3', youtube_video_id: 'yt-3', channel_id: 'ch-1', published_at: ha(0) }],
      yt_own_video_meta_daily: [linhaMeta('yt-1')],
    })
    const c1 = ctxDe(db)
    await criterioMetadados(c1, { day_pt: dia, dias_sem_meta: { 'ch-1': 0 } })
    expect(c1.falhas).toEqual([`metadados: Canal Um tem 1 de 2 vídeos com linha em ${dia}`])

    const db2 = fakeSupabase({
      youtube_videos: videos,
      yt_own_video_meta_daily: [linhaMeta('yt-1')],
      yt_own_collection_attempts: [tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', 0)],
    })
    const c2 = ctxDe(db2)
    await criterioMetadados(c2, { day_pt: dia, dias_sem_meta: { 'ch-1': 0 } })
    expect(c2.falhas).toEqual([])
  })

  it('canal sem vídeos fica fora; leitura que falha vira falha de avaliação', async () => {
    const c1 = ctxDe(fakeSupabase())
    await criterioMetadados(c1, { day_pt: dia, dias_sem_meta: { 'ch-1': 0 } })
    expect(c1.falhas).toEqual([])

    for (const tabela of ['youtube_videos', 'yt_own_video_meta_daily', 'yt_own_collection_attempts']) {
      const db = fakeSupabase({ youtube_videos: videos })
      db.errors[tabela] = ERRO
      const ctx = ctxDe(db)
      await criterioMetadados(ctx, { day_pt: dia, dias_sem_meta: { 'ch-1': 0 } })
      expect(ctx.falhas.some(f => f.startsWith('critérios: não foi possível avaliar vídeos com linha de metadados'))).toBe(true)
    }
  })
})

describe('fix round 1', () => {
  const video = { id: 'v1', channel_id: 'ch-1', published_at: ha(30) }
  const msgSemNovo = 'relatórios: Canal Um está sem relatório novo de channel_reach_basic_a1 há mais de 6 dias'

  it('job ativo com job_create_time nulo usa created_at como idade', async () => {
    const velho = fakeSupabase({ yt_reporting_jobs: [{ ...jobAtivo(0), job_create_time: null, created_at: ha(7) }], youtube_videos: [video] })
    const c1 = ctxDe(velho)
    await criteriosRelatorios(c1)
    expect(c1.falhas).toEqual([msgSemNovo])

    const novo = fakeSupabase({ yt_reporting_jobs: [{ ...jobAtivo(0), job_create_time: null, created_at: ha(2) }], youtube_videos: [video] })
    const c2 = ctxDe(novo)
    await criteriosRelatorios(c2)
    expect(c2.falhas).toEqual([])
  })

  /** Dois jobs de alcance ativos há 7 dias, sem relatório novo, canal que publicou, e a tentativa de HOJE com o resultado dado. */
  const semRelatorioNovoHa7Dias = ({ outcomeHoje = 'sem_conexao' }: { outcomeHoje?: string } = {}) => ({
    yt_reporting_jobs: [jobAtivo(7), jobAtivo(7, 'channel_reach_combined_a1')],
    youtube_videos: [video],
    yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', outcomeHoje, 0)],
  })

  it('canal sem conexão hoje vai para acao_do_dono e não para falhas; leitura que falha vira não avaliou', async () => {
    const seed = semRelatorioNovoHa7Dias()
    const ctx = ctxDe(fakeSupabase(seed))
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual(['Canal Um: sem conexão com o YouTube'])

    // sem_conexao de ontem não vale: hoje o canal voltou, então o alarme volta
    const ontem = ctxDe(fakeSupabase({ ...seed, yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 1)] }))
    await criteriosRelatorios(ontem)
    expect(ontem.falhas).toContain(msgSemNovo)

    const db = fakeSupabase(seed)
    db.errors.yt_own_collection_attempts = ERRO
    const c3 = ctxDe(db)
    await criteriosRelatorios(c3)
    expect(naoAvaliou(c3.falhas, 'jobs de alcance sem relatório novo (yt_own_collection_attempts)')).toBe(true)
    expect(c3.falhas).not.toContain(msgSemNovo)
  })

  it('L1b: canal com tentativa sem_autorizacao hoje não vira falha nem "sem conexão" (a nota reautorizar vem de rodarColeta)', async () => {
    const ctx = ctxDe(fakeSupabase(semRelatorioNovoHa7Dias({ outcomeHoje: 'sem_autorizacao' })))
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono ?? []).toEqual([])
  })

  it('listado há mais de 14 dias continua falha mesmo com o canal sem conexão', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [rel('a', 'listado', 15)],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 0)],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: 1 relatório(s) listado(s) há mais de 14 dias sem baixar'])
  })

  describe('job ativo com download falhando', () => {
    const escopo = 'ch-1:channel_reach_basic_a1'
    const ativo: Row = { channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'ativo' }
    const comErro = (d: number, error: string): Row => ({ ...tentativa('job', escopo, 'relatorio', 'erro_http', d), error })

    it('3 dias de erro_http é falha, com o último texto de erro', async () => {
      const db = fakeSupabase({ yt_reporting_jobs: [ativo], yt_own_collection_attempts: [comErro(0, 'listagem_truncada'), comErro(1, 'HTTP 500'), comErro(2, 'HTTP 500')] })
      const ctx = ctxDe(db)
      await criterioJobsEmErro(ctx)
      expect(ctx.falhas).toEqual(['jobs: Canal Um não consegue baixar o relatório channel_reach_basic_a1 há 3 dias (último erro: listagem_truncada)'])
    })
    it('2 dias, ou ok no dia mais recente: verde', async () => {
      const dois = ctxDe(fakeSupabase({ yt_reporting_jobs: [ativo], yt_own_collection_attempts: [comErro(0, 'x'), comErro(1, 'x')] }))
      await criterioJobsEmErro(dois)
      expect(dois.falhas).toEqual([])
      const ok = ctxDe(fakeSupabase({
        yt_reporting_jobs: [ativo],
        yt_own_collection_attempts: [tentativa('job', escopo, 'relatorio', 'ok', 0), comErro(1, 'x'), comErro(2, 'x'), comErro(3, 'x')],
      }))
      await criterioJobsEmErro(ok)
      expect(ok.falhas).toEqual([])
    })
  })

  it('relatório de alcance em erro e expirado de outro tipo continuam vistos com leituras separadas por tipo/status', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'expirado_sem_baixar', 2, 'channel_basic_a3')] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um tem relatório channel_basic_a3 expirado sem baixar'])
  })

  it('4 tipos de 8 canais não estouram o corte: só o alcance entra na leitura grande', async () => {
    const muitos: Row[] = []
    for (let i = 0; i < 1200; i++) muitos.push(rel(`n${i}`, 'baixado', 1, 'channel_basic_a3'))
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: muitos }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('tipo habilitado com a linha em desativado: o job não foi criado e isso é falha, com os tipos em ordem', async () => {
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [
        { channel_id: 'ch-1', report_type_id: 'channel_traffic_source_a3', status: 'desativado' },
        { channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' },
        { channel_id: 'ch-1', report_type_id: 'channel_annotations_a1', status: 'desativado' }, // fora da lista: é o estado certo
      ],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um tem 2 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3, channel_traffic_source_a3'])
  })

  it('tipo habilitado em desativado num canal que perdeu a autorização: ação do dono, não falha', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' }] })
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [{ ...canal, collection_status: 'reautorizar' as const }] }
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual(['Canal Um tem 1 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3 (o canal precisa ser reconectado)'])
  })

  it('tipo habilitado em desativado num canal com a sincronização desligada: nada (o canal não pede job)', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' }] })
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [{ ...canal, sync_enabled: false }] }
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([])
  })

  it('job ativo de tipo que só guarda bruto, há mais de 6 dias, cuja marca de relatório ficou velha: falha; com marca recente, não', async () => {
    const job = (tipo: string, marca: string | null): Row => ({
      channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `j-${tipo}`, job_create_time: ha(10), created_at: ha(10), last_create_time: marca,
    })
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [job('channel_basic_a3', ha(8)), job('channel_traffic_source_a3', ha(7)), { ...job('channel_annotations_a1', null) }],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([
      'relatórios: Canal Um está sem relatório novo de channel_basic_a3 há mais de 6 dias',
      'relatórios: Canal Um está sem relatório novo de channel_traffic_source_a3 há mais de 6 dias',
    ])

    const bom = ctxDe(fakeSupabase({ yt_reporting_jobs: [job('channel_basic_a3', ha(1))] }))
    await criteriosRelatorios(bom)
    expect(bom.falhas).toEqual([])
  })

  it('job ativo de tipo que só guarda bruto criado há menos de 6 dias e ainda sem relatório: cedo demais, não é falha', async () => {
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'ativo', job_id: 'j', job_create_time: ha(3), created_at: ha(3), last_create_time: null }],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('a leitura dos jobs falha: nenhum dos critérios de job avalia como "nada de errado"', async () => {
    const db = fakeSupabase({})
    db.errors.yt_reporting_jobs = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar tipos habilitados sem job (yt_reporting_jobs)')
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar jobs de alcance sem relatório novo (yt_reporting_jobs)')
  })
})

describe('E12 onda 2, D1: job de tipo que só guarda bruto sem relatório novo e a conexão do canal', () => {
  const MSG = 'relatórios: Canal Um está sem relatório novo de channel_basic_a3 há mais de 6 dias'
  const CONEXAO = 'Canal Um: sem conexão com o YouTube'
  const jobBruto = (idadeDias: number, marca: string | null = ha(idadeDias)): Row => ({
    channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'ativo', job_id: 'j', job_create_time: ha(idadeDias), created_at: ha(idadeDias), last_create_time: marca,
  })
  const rodar = async (tabelas: Record<string, Row[]>, canalAjustado: Partial<typeof canal> = {}) => {
    const ctx = { supabase: fakeSupabase(tabelas).client, falhas: [] as string[], channels: [{ ...canal, ...canalAjustado }] }
    const r = await criteriosRelatorios(ctx)
    return { ctx, r }
  }

  it('canal com sync desligado: silêncio total (igual ao critério de alcance)', async () => {
    const { ctx, r } = await rodar({ yt_reporting_jobs: [jobBruto(10)] }, { sync_enabled: false })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([])
  })

  it('canal em reautorizar: nada em falhas e nada em acao_do_dono (o alarme "reautorizar" é o de rodarColeta)', async () => {
    const { ctx, r } = await rodar({ yt_reporting_jobs: [jobBruto(10)] }, { collection_status: 'reautorizar' })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([])
  })

  it('canal sem conexão HOJE (nunca conectado): vai para acao_do_dono e não para falhas', async () => {
    const { ctx, r } = await rodar({
      yt_reporting_jobs: [jobBruto(10)],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 0)],
    })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([CONEXAO])
  })

  it('tentativa sem_autorizacao hoje: nem falha nem "sem conexão" (a nota reautorizar vem de rodarColeta)', async () => {
    const { ctx, r } = await rodar({
      yt_reporting_jobs: [jobBruto(10)],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_autorizacao', 0)],
    })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([])
  })

  it('sem_conexao de ontem não vale: o canal voltou e o alarme volta', async () => {
    const { ctx, r } = await rodar({
      yt_reporting_jobs: [jobBruto(10)],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 1)],
    })
    expect(ctx.falhas).toEqual([MSG])
    expect(r.acao_do_dono).toEqual([])
  })

  it('canal sem conexão com job de alcance E de tipo bruto parados: a nota de conexão sai uma vez só', async () => {
    const { r } = await rodar({
      yt_reporting_jobs: [jobBruto(10), jobAtivo(10)],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1', published_at: ha(30) }],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 0)],
    })
    expect(r.acao_do_dono).toEqual([CONEXAO])
  })

  it('a leitura das tentativas falha: não avaliou (nunca verde) e sem falha de parada inventada', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobBruto(10)] })
    db.errors.yt_own_collection_attempts = ERRO
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [canal] }
    await criteriosRelatorios(ctx)
    expect(naoAvaliou(ctx.falhas, 'jobs de tipos brutos sem relatório novo (yt_own_collection_attempts)')).toBe(true)
    expect(ctx.falhas).not.toContain(MSG)
  })

  it('DECISÃO: canal sem publicação há mais de 90 dias, job sem relatório há 7 dias, ainda alarma (o YouTube gera relatório todo dia, inclusive para canal parado)', async () => {
    const { ctx } = await rodar({
      yt_reporting_jobs: [jobBruto(7)],
      youtube_videos: [{ id: 'velho', channel_id: 'ch-1', published_at: ha(120) }],
    })
    expect(ctx.falhas).toEqual([MSG])
    // e o mesmo canal sem nenhum vídeo registrado
    const { ctx: semVideo } = await rodar({ yt_reporting_jobs: [jobBruto(7)] })
    expect(semVideo.falhas).toEqual([MSG])
  })
})

describe('E12 onda 2, D4: tipo habilitado sem NENHUMA linha de job', () => {
  const TIPOS: string[] = [...REPORT_TYPES_ENABLED]
  const linha = (tipo: string, status = 'ativo'): Row => ({ channel_id: 'ch-1', report_type_id: tipo, status, job_id: `j-${tipo}`, job_create_time: ha(1), created_at: ha(1), last_create_time: ha(0) })
  const sondagemOk = (dias = 0): Row => tentativa('canal', 'ch-1', 'sondagem', 'ok', dias)
  const rodar = async (tabelas: Record<string, Row[]>, canalAjustado: Partial<typeof canal> = {}, erros: Record<string, FakeErr> = {}) => {
    const db = fakeSupabase(tabelas)
    Object.assign(db.errors, erros)
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [{ ...canal, ...canalAjustado }] }
    const r = await criteriosRelatorios(ctx)
    return { ctx, r }
  }

  it('canal com coleta ligada, o passo de jobs já rodou (sondagem ok) e um tipo habilitado não tem linha: falha visível', async () => {
    const { ctx } = await rodar({
      yt_reporting_jobs: TIPOS.filter(t => t !== 'channel_basic_a3').map(t => linha(t)),
      yt_own_collection_attempts: [sondagemOk(1)],
    })
    expect(ctx.falhas).toEqual(['jobs: Canal Um tem 1 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3'])
  })

  it('nenhuma linha de job nenhuma, depois de uma sondagem ok: todos os tipos habilitados aparecem', async () => {
    const { ctx } = await rodar({ yt_own_collection_attempts: [sondagemOk(2)] })
    expect(ctx.falhas).toEqual([`jobs: Canal Um tem ${TIPOS.length} tipo(s) de relatório habilitado(s) sem job: ${[...TIPOS].sort().join(', ')}`])
  })

  it('o passo de jobs nunca rodou para o canal (nenhuma sondagem ok): ainda é cedo, silêncio', async () => {
    const { ctx } = await rodar({
      yt_reporting_jobs: [linha('channel_reach_basic_a1')],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'sondagem', 'sem_conexao', 0), tentativa('canal', 'ch-1', 'sondagem', 'erro_http', 1)],
    })
    expect(ctx.falhas).toEqual([])
  })

  it('linha desativado e linha ausente do mesmo canal viram UMA nota com os dois tipos', async () => {
    const { ctx } = await rodar({
      yt_reporting_jobs: TIPOS
        .filter(t => t !== 'channel_basic_a3') // este é o ausente
        .map(t => linha(t, t === 'channel_reach_combined_a1' ? 'desativado' : 'ativo')),
      yt_own_collection_attempts: [sondagemOk(1)],
    })
    expect(ctx.falhas).toEqual(['jobs: Canal Um tem 2 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3, channel_reach_combined_a1'])
  })

  it('canal em reautorizar: nota do dono ("precisa ser reconectado"), não falha; canal com sync desligado: nada', async () => {
    const tabelas = { yt_own_collection_attempts: [sondagemOk(3)] }
    const a = await rodar(tabelas, { collection_status: 'reautorizar' })
    expect(a.ctx.falhas).toEqual([])
    expect(a.r.acao_do_dono).toEqual([`Canal Um tem ${TIPOS.length} tipo(s) de relatório habilitado(s) sem job: ${[...TIPOS].sort().join(', ')} (o canal precisa ser reconectado)`])
    const b = await rodar(tabelas, { sync_enabled: false })
    expect(b.ctx.falhas).toEqual([])
    expect(b.r.acao_do_dono).toEqual([])
  })

  it('todos os tipos habilitados com linha: nada (a ausência só é falha quando falta de fato)', async () => {
    const { ctx } = await rodar({ yt_reporting_jobs: TIPOS.map(t => linha(t)), yt_own_collection_attempts: [sondagemOk(0)] })
    expect(ctx.falhas).toEqual([])
  })

  it('a leitura das sondagens falha: não avaliou (nunca verde)', async () => {
    const { ctx } = await rodar({ yt_reporting_jobs: [linha('channel_reach_basic_a1')] }, {}, { yt_own_collection_attempts: ERRO })
    expect(naoAvaliou(ctx.falhas, 'tipos habilitados sem job (yt_own_collection_attempts)')).toBe(true)
  })
})

describe('E12 onda 4, E1: "nunca gerou relatório" é aviso do dono; "gerou e parou" é falha', () => {
  const NUNCA = (tipo: string, desde: string) =>
    `Canal Um: ${tipo} nunca gerou relatório desde ${desde}; confira se o YouTube gera esse tipo para este canal`
  const PAROU = (tipo: string) => `relatórios: Canal Um está sem relatório novo de ${tipo} há mais de 6 dias`
  const job = (tipo: string, idadeDias: number, marca: string | null): Row => ({
    channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `j-${tipo}`, job_create_time: ha(idadeDias), created_at: ha(idadeDias), last_create_time: marca,
  })
  const rodar = async (tabelas: Record<string, Row[]>, canalAjustado: Partial<typeof canal> = {}) => {
    const ctx = { supabase: fakeSupabase(tabelas).client, falhas: [] as string[], channels: [{ ...canal, ...canalAjustado }] }
    const r = await criteriosRelatorios(ctx)
    return { ctx, r }
  }

  it('job novo ativo há 10 dias que NUNCA gerou relatório: acao_do_dono com tipo, canal e data; não deixa o cron vermelho', async () => {
    const { ctx, r } = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 10, null)] })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([NUNCA('channel_basic_a3', ha(10).slice(0, 10))])
  })

  it('o aviso NÃO some em silêncio: aparece de novo a cada execução enquanto o relatório não chega (dias seguidos)', async () => {
    const tabelas = { yt_reporting_jobs: [job('channel_basic_a3', 10, null)] }
    const a = await rodar(tabelas)
    expect(a.r.acao_do_dono).toHaveLength(1)
    vi.setSystemTime(new Date(AGORA.getTime() + DIA_MS))
    const b = await rodar(tabelas)
    expect(b.r.acao_do_dono).toEqual([NUNCA('channel_basic_a3', ha(10).slice(0, 10))]) // a data é a da criação do job, não a de hoje
    expect(b.ctx.falhas).toEqual([])
  })

  it('job que JÁ gerou relatório e parou há mais de 6 dias: falha (vermelho), como antes, e nada em acao_do_dono', async () => {
    const { ctx, r } = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 20, ha(8))] })
    expect(ctx.falhas).toEqual([PAROU('channel_basic_a3')])
    expect(r.acao_do_dono).toEqual([])
  })

  it('os dois casos juntos, no mesmo canal, saem cada um no seu lugar', async () => {
    const { ctx, r } = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 10, null), job('channel_traffic_source_a3', 10, ha(7))] })
    expect(ctx.falhas).toEqual([PAROU('channel_traffic_source_a3')])
    expect(r.acao_do_dono).toEqual([NUNCA('channel_basic_a3', ha(10).slice(0, 10))])
  })

  it('fronteira da idade: criado há 6 dias e 1 hora com marca nula avisa; há 5 dias e 23 horas, silêncio', async () => {
    const hora = 3_600_000
    const com = (msAtras: number): Row => ({ ...job('channel_basic_a3', 0, null), job_create_time: new Date(AGORA.getTime() - msAtras).toISOString() })
    const velho = await rodar({ yt_reporting_jobs: [com(6 * DIA_MS + hora)] })
    expect(velho.r.acao_do_dono).toHaveLength(1)
    expect(velho.ctx.falhas).toEqual([])
    const novo = await rodar({ yt_reporting_jobs: [com(6 * DIA_MS - hora)] })
    expect(novo.r.acao_do_dono).toEqual([])
    expect(novo.ctx.falhas).toEqual([])
  })

  it('fronteira da marca: último relatório há 5 dias e 23 horas, silêncio; há 6 dias e 1 hora, falha (e não aviso)', async () => {
    const hora = 3_600_000
    const marca = (msAtras: number) => new Date(AGORA.getTime() - msAtras).toISOString()
    const ok = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 30, marca(6 * DIA_MS - hora))] })
    expect(ok.ctx.falhas).toEqual([])
    expect(ok.r.acao_do_dono).toEqual([])
    const parou = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 30, marca(6 * DIA_MS + hora))] })
    expect(parou.ctx.falhas).toEqual([PAROU('channel_basic_a3')])
    expect(parou.r.acao_do_dono).toEqual([])
  })

  it('canal sem conexão hoje: só a nota de conexão (o "nunca gerou" é consequência, não vai junto)', async () => {
    const { ctx, r } = await rodar({
      yt_reporting_jobs: [job('channel_basic_a3', 10, null)],
      yt_own_collection_attempts: [tentativa('canal', 'ch-1', 'relatorio', 'sem_conexao', 0)],
    })
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual(['Canal Um: sem conexão com o YouTube'])
  })

  it('canal desligado ou em reautorizar: silêncio, como antes', async () => {
    const a = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 10, null)] }, { sync_enabled: false })
    expect(a.r.acao_do_dono).toEqual([])
    const b = await rodar({ yt_reporting_jobs: [job('channel_basic_a3', 10, null)] }, { collection_status: 'reautorizar' })
    expect(b.r.acao_do_dono).toEqual([])
    expect(b.ctx.falhas).toEqual([])
  })

  it('tipos de alcance não mudam: job de alcance há 10 dias, marca nula, sem relatório e canal que publicou, continua falha', async () => {
    const { ctx, r } = await rodar({
      yt_reporting_jobs: [{ ...jobAtivo(10), last_create_time: null }],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1', published_at: ha(30) }],
    })
    expect(ctx.falhas).toEqual([PAROU('channel_reach_basic_a1')])
    expect(r.acao_do_dono).toEqual([])
  })
})
