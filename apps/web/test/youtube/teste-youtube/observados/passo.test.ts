// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), sentry: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: mocks.sentry, captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { rodarObservados } from '@/lib/youtube/teste-youtube/observados/passo'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { criarBanco, type Linha } from '../registro/banco-falso'
import { DH_A, DH_B, H, PUB } from './fabrica'

const SITE = '00000000-0000-4000-8000-000000000001'
const T0 = PUB.getTime() + 30 * 24 * H
const ENV_ON = { OBS_TROCAS_CONCORRENTE: 'on' } as NodeJS.ProcessEnv
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const iso = (ms: number): string => new Date(ms).toISOString()
const FIM = T0 + 83_000

function contexto(sb: unknown, t0 = T0, passoMs = 0): ContextoTarefa {
  let agora = t0
  return { t0, agora: () => { const v = agora; agora += passoMs; return v }, apiKey: '', sb: sb as never, linhas: null }
}

/** Mundo: n alvos de concorrente; os que têm `troca` trazem leituras A,A,B,B,B,B,B,B,B (miniatura) a cada 6 h depois da carência. */
function mundo(n: number, o: { troca?: number[]; publicado?: Record<number, string | null>; rodadas?: number } = {}) {
  const t: Record<string, Linha[]> = { yt_watch_alvos: [], yt_watch_readings: [], yt_watch_thumbs: [], competitor_channels: [{ id: 'ch1', site_id: SITE, removal_requested_at: null }], competitor_videos: [], ab_native_observados: [], ab_native_obs_cursor: [] }
  let rid = 0
  for (let i = 1; i <= n; i++) {
    const rodadas = o.rodadas ?? 40
    t.yt_watch_alvos!.push({ id: i, site_id: SITE, youtube_video_id: yt(i), tipo: 'concorrente', rodadas, ultima_rodada_em: iso(T0 - 2 * H), saiu_em: null, saiu_por: null })
    t.competitor_videos!.push({ video_id: yt(i), competitor_channel_id: 'ch1', published_at: o.publicado && i in o.publicado ? o.publicado[i] : iso(PUB.getTime()) })
    const troca = o.troca?.includes(i)
    t.yt_watch_thumbs!.push({ id: i * 10, site_id: SITE, youtube_video_id: yt(i), variante: 'maxresdefault', http: 200, dhash: DH_A, largura: 1280, altura: 720 })
    t.yt_watch_thumbs!.push({ id: i * 10 + 1, site_id: SITE, youtube_video_id: yt(i), variante: 'maxresdefault', http: 200, dhash: DH_B, largura: 1280, altura: 720 })
    for (let k = 0; k < 9; k++) {
      const b = troca && k >= 2
      t.yt_watch_readings!.push({ id: ++rid, site_id: SITE, youtube_video_id: yt(i), rodada_id: `rod-${i}-${k}`, lida_em: iso(PUB.getTime() + (30 + k * 6) * H), http: 200, erro: null, jogador_bloqueado: false, idioma: 'pt', titulo_oficial: 'T', titulo_oficial_fonte: 'videoDetails', miniatura_id: i * 10 + (b ? 1 : 0) })
    }
  }
  return t
}

beforeEach(() => { mocks.schema.mockReset().mockResolvedValue(null); mocks.sentry.mockReset() })

describe('flag OBS_TROCAS_CONCORRENTE', () => {
  it('variável apagada = off: nenhuma leitura, nenhuma escrita (default)', async () => {
    const antes = process.env.OBS_TROCAS_CONCORRENTE
    delete process.env.OBS_TROCAS_CONCORRENTE
    try {
      const b = criarBanco(mundo(3, { troca: [1] }))
      const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM })
      expect(r).toEqual({ ativo: false, detalhe: {}, motivo: null })
      expect(b.pedidos).toHaveLength(0)
      expect(b.rpcChamadas).toHaveLength(0)
      expect(mocks.schema).not.toHaveBeenCalled()
    } finally { if (antes !== undefined) process.env.OBS_TROCAS_CONCORRENTE = antes }
  })
  it('valor desconhecido ("ON", "true", "1") também é off', async () => {
    for (const v of ['ON', 'true', '1', '']) {
      const b = criarBanco(mundo(2))
      expect((await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: { OBS_TROCAS_CONCORRENTE: v } as NodeJS.ProcessEnv })).ativo).toBe(false)
      expect(b.pedidos).toHaveLength(0)
    }
  })
})

describe('passo (flag on)', () => {
  it('grava a troca por campo, o cursor de todo avaliado (com ou sem troca) e conta nos contadores', async () => {
    const t = mundo(3, { troca: [1] })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.motivo).toBeNull()
    expect(r.detalhe).toMatchObject({ obs_avaliados: 3, obs_trocas: 1, obs_falhou: 0, obs_sem_tempo: 0, obs_sem_publicacao: 0 })
    expect(t.ab_native_observados).toHaveLength(1)
    expect(t.ab_native_observados![0]).toMatchObject({ youtube_video_id: yt(1), campo: 'miniatura', tipo_troca: 'sequencial', n_versoes: 2, ficou_estado: 'em_andamento' }) // sonda parada há > 9 h: nunca estável
    expect(t.ab_native_obs_cursor).toHaveLength(3)
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ avaliado_ate_rodada: 40, avaliado_motivo: 'ok', validas_titulo: 9, validas_miniatura: 9 }) // rodadas válidas por campo (Phil C2)
  })
  it('2º disparo sem rodada nova: zero leituras de yt_watch_readings, com 3 alvos sem troca e nenhuma linha', async () => {
    const t = mundo(3)
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados).toHaveLength(0)
    expect(t.ab_native_obs_cursor).toHaveLength(3)
    const antes = b.pedidos.length
    const r = await rodarObservados(contexto(b.sb, T0 + 20 * 60_000), { fimDuroMs: FIM + 20 * 60_000, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 0, obs_devidos: 0 })
    expect(b.pedidos.slice(antes).filter(p => p.tabela === 'yt_watch_readings')).toHaveLength(0)
  })
  it('60 alvos sem linha: em 2 disparos todos avaliados (teto de 50), nenhum starvation', async () => {
    const t = mundo(60)
    const b = criarBanco(t)
    const r1 = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r1.detalhe).toMatchObject({ obs_avaliados: 50, obs_devidos: 60 })
    const r2 = await rodarObservados(contexto(b.sb, T0 + 20 * 60_000), { fimDuroMs: FIM + 20 * 60_000, env: ENV_ON })
    expect(r2.detalhe).toMatchObject({ obs_avaliados: 10 })
    expect(new Set(t.ab_native_obs_cursor!.map(c => c.youtube_video_id)).size).toBe(60)
  })
  it('published_at nulo: nenhuma troca, cursor sem_publicacao, obs_sem_publicacao conta; sem canal do site, ignorado', async () => {
    const t = mundo(3, { troca: [1, 2], publicado: { 1: null } })
    t.competitor_videos = t.competitor_videos!.filter(v => v.video_id !== yt(3))
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_sem_publicacao: 1, obs_avaliados: 1, obs_ignorados: 1 })
    expect(t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(1))).toMatchObject({ avaliado_motivo: 'sem_publicacao' })
    expect(t.ab_native_observados!.map(o => o.youtube_video_id)).toEqual([yt(2)])
  })
  it('mesmo vídeo em dois canais do site: uma avaliação, e a publicação MÍNIMA decide a carência', async () => {
    const t = mundo(1, { troca: [1] }) // leituras de 30 h a 78 h depois do PUB; a troca aparece desde a 3ª (42 h)
    t.competitor_channels!.push({ id: 'ch2', site_id: SITE, removal_requested_at: null })
    // o canal que publicou DEPOIS vem primeiro na lista: com carência de 24 h a partir de PUB + 40 h só sobram B,B,B (nenhuma troca)
    t.competitor_videos = [{ video_id: yt(1), competitor_channel_id: 'ch2', published_at: iso(PUB.getTime() + 40 * H) }, ...t.competitor_videos!]
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 1, obs_trocas: 1 })
    expect(t.ab_native_obs_cursor).toHaveLength(1)
  })
  it('contagem do banco diferente das linhas lidas (max_rows = 1000 cortando em silêncio): o alvo falha, SEM cursor', async () => {
    const t = mundo(1, { troca: [1] })
    const b = criarBanco(t)
    const original = b.sb as unknown as { from: (n: string) => Record<string, unknown> }
    const from = original.from.bind(original)
    original.from = (n: string) => {
      const q = from(n)
      if (n !== 'yt_watch_readings') return q
      const range = q.range as (a: number, b: number) => PromiseLike<{ data: unknown[]; error: unknown; count: number | null }>
      q.range = (a: number, z: number) => ({ then: (ok: (r: unknown) => unknown, er: (e: unknown) => unknown) => Promise.resolve(range(a, z)).then(r => ({ ...r, count: 1500 })).then(ok, er) })
      return q
    }
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_falhou: 1, obs_avaliados: 0 })
    expect(t.ab_native_obs_cursor).toHaveLength(0)
    expect(t.ab_native_observados).toHaveLength(0)
  })
  it('alvo sem nenhuma leitura válida (sonda bloqueada): cursor ok com validas 0, e o detalhe conta obs_sem_leitura_valida', async () => {
    const t = mundo(2)
    for (const l of t.yt_watch_readings!) if (l.youtube_video_id === yt(1)) { l.erro = 'bloqueado'; l.http = 429 }
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 2, obs_sem_leitura_valida: 1 })
    expect(t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(1))).toMatchObject({ avaliado_motivo: 'ok', validas_titulo: 0, validas_miniatura: 0 })
    expect(t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(2))).toMatchObject({ validas_titulo: 9 })
  })
  it('lê só os cursores dos alvos (em lotes de 100), nunca o cursor inteiro (Yannis M6)', async () => {
    const t = mundo(120)
    t.ab_native_obs_cursor!.push({ site_id: SITE, youtube_video_id: 'zzzzzzzzzzz', avaliado_ate_rodada: 1, avaliado_em: iso(T0), avaliado_motivo: 'ok', validas_titulo: 0, validas_miniatura: 0 })
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    const lidos = b.pedidos.filter(p => p.tabela === 'ab_native_obs_cursor' && p.op === 'select')
    expect(lidos).toHaveLength(2) // 120 alvos = 2 lotes
    for (const p of lidos) expect(p.filtros.some(f => f.startsWith('in:youtube_video_id'))).toBe(true)
    expect(lidos.flatMap(p => p.filtros).join('|')).not.toContain('zzzzzzzzzzz')
  })
  it('canal com remoção pedida é ignorado (sem cursor, sem leitura do bruto)', async () => {
    const t = mundo(2, { troca: [1, 2] })
    t.competitor_channels![0]!.removal_requested_at = iso(T0 - H)
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 0, obs_ignorados: 2 })
    expect(t.ab_native_obs_cursor).toHaveLength(0)
    expect(b.pedidos.filter(p => p.tabela === 'yt_watch_readings')).toHaveLength(0)
  })
  it('alvo recriado pela poda (rodadas zerado, cursor maior) volta à seleção', async () => {
    const t = mundo(1, { rodadas: 3 })
    t.ab_native_obs_cursor!.push({ site_id: SITE, youtube_video_id: yt(1), avaliado_ate_rodada: 120, avaliado_em: iso(T0 + 60 * 60_000), avaliado_motivo: 'ok' })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 1 })
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ avaliado_ate_rodada: 3 })
  })
  it('o cursor guarda o valor de rodadas lido ANTES das leituras (Phil N8)', async () => {
    const t = mundo(1, { troca: [1] })
    const b = criarBanco(t, { falhar: p => { if (p.tabela === 'yt_watch_readings' && p.op === 'select') t.yt_watch_alvos![0]!.rodadas = 99; return null } })
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ avaliado_ate_rodada: 40 })
  })
  it('falha de gravação de UM alvo: obs_falhou no detalhe e Sentry, SEM cursor, os demais seguem; o registro continua ok (motivo só para o passo inteiro)', async () => {
    const t = mundo(2, { troca: [1, 2] })
    let falhou = false
    const b = criarBanco(t, { falhar: p => { if (p.tabela === 'ab_native_observados' && p.op === 'upsert' && !falhou) { falhou = true; return { code: '23514' } } return null } })
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.motivo).toBeNull()
    expect(r.detalhe).toMatchObject({ obs_falhou: 1, obs_avaliados: 1 })
    expect(t.ab_native_obs_cursor!.map(c => c.youtube_video_id)).toEqual([yt(2)])
    expect(mocks.sentry).toHaveBeenCalled()
  })
  it('lista de alvos falha: não lança; falhou, parcial', async () => {
    const b = criarBanco(mundo(2), { falhar: p => (p.tabela === 'yt_watch_alvos' ? { code: 'XX000' } : null) })
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r).toMatchObject({ ativo: true, motivo: 'observados_falhou' })
  })
  it('schema ausente (migration não aplicada) com a flag on: motivo observados_schema_ausente, nenhuma escrita', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    const b = criarBanco(mundo(2))
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.motivo).toBe('observados_schema_ausente')
    expect(b.pedidos).toHaveLength(0)
  })
  it('sobra < 10 s antes de BANCO_ATE_MS: nada roda e obs_sem_tempo/obs_sem_sobra aparecem', async () => {
    const b = criarBanco(mundo(2))
    const r = await rodarObservados(contexto(b.sb, T0 + 75_000), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_sem_tempo: 1, obs_sem_sobra: 1, obs_avaliados: 0 })
    expect(b.pedidos).toHaveLength(0)
  })
  it('o relógio estoura no meio: os alvos restantes viram obs_sem_tempo, sem cursor, sem exceção', async () => {
    const t = mundo(5)
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb, T0, 4_000), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe.obs_avaliados! + r.detalhe.obs_sem_tempo!).toBeGreaterThan(0)
    expect(r.detalhe.obs_avaliados).toBeLessThan(5)
    expect(t.ab_native_obs_cursor!.length).toBe(r.detalhe.obs_avaliados)
  })
  it('varredura: em_andamento cujo alvo saiu fecha como sem_desfecho com saiu_por; sem alvo (podado) = alvo_podado', async () => {
    const t = mundo(1)
    t.yt_watch_alvos![0]!.saiu_em = iso(T0 - H); t.yt_watch_alvos![0]!.saiu_por = 'janela'
    const linha = (id: number, ytId: string): Linha => ({ id, site_id: SITE, youtube_video_id: ytId, campo: 'titulo', ficou_estado: 'em_andamento', motivo: null })
    t.ab_native_observados!.push(linha(1, yt(1)), linha(2, 'zzzzzzzzzzz'))
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_fechados: 2 })
    expect(t.ab_native_observados!.map(o => [o.ficou_estado, o.motivo])).toEqual([['sem_desfecho', 'janela'], ['sem_desfecho', 'alvo_podado']])
  })
  it('varredura: lê as linhas mais antigas primeiro (ultima_atualizacao_em), então com lote 2 a linha do alvo que saiu fecha no 1º disparo (Yannis M2)', async () => {
    const t = mundo(3)
    t.yt_watch_alvos![2]!.saiu_em = iso(T0 - H); t.yt_watch_alvos![2]!.saiu_por = 'janela'
    const linha = (id: number, ytId: string, ate: string): Linha => ({ id, site_id: SITE, youtube_video_id: ytId, campo: 'titulo', ficou_estado: 'em_andamento', motivo: null, ultima_atualizacao_em: ate })
    // alvos vivos 1 e 2 (regravados há pouco) têm id MENOR; o alvo 3 (saiu) tem o id maior e a data mais velha
    t.ab_native_observados!.push(linha(1, yt(1), iso(T0 - 60_000)), linha(2, yt(2), iso(T0 - 30_000)), linha(3, yt(3), iso(T0 - 20 * H)))
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, varreduraLote: 2 })
    expect(t.ab_native_observados!.find(o => o.id === 3)).toMatchObject({ ficou_estado: 'sem_desfecho', motivo: 'janela' })
  })
  it('varredura: a consulta recebe abortSignal (tempo limite de banco; o comentário engoliu a chamada no conserto 1)', async () => {
    const t = mundo(1)
    t.ab_native_observados!.push({ id: 1, site_id: SITE, youtube_video_id: yt(1), campo: 'titulo', ficou_estado: 'em_andamento', motivo: null })
    const b = criarBanco(t)
    const alvo: string[] = []
    const from = b.sb.from.bind(b.sb) as (tabela: string) => Record<string, unknown>
    const sb = { ...b.sb, from: (tabela: string) => {
      const q = from(tabela)
      if (tabela === 'ab_native_observados' && typeof q.select === 'function') {
        const sel = (q.select as (...a: unknown[]) => Record<string, unknown>).bind(q)
        q.select = (...a: unknown[]) => {
          const r = sel(...a)
          if (typeof a[0] === 'string' && a[0] === 'id,site_id,youtube_video_id') {
            const ab = (r.abortSignal as (s: AbortSignal) => unknown).bind(r)
            r.abortSignal = (s: AbortSignal) => { alvo.push('abort'); return ab(s) }
          }
          return r
        }
      }
      return q
    } }
    await rodarObservados(contexto(sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(alvo).toEqual(['abort'])
  })
  it('varredura com CAS: uma linha que outra avaliação tornou estavel entre a leitura e o update NÃO é sobrescrita', async () => {
    const t = mundo(1)
    t.yt_watch_alvos![0]!.saiu_em = iso(T0 - H); t.yt_watch_alvos![0]!.saiu_por = 'janela'
    t.ab_native_observados!.push({ id: 1, site_id: SITE, youtube_video_id: yt(1), campo: 'titulo', ficou_estado: 'em_andamento', motivo: null, ultima_atualizacao_em: iso(T0 - H) })
    const b = criarBanco(t, { falhar: p => { if (p.tabela === 'ab_native_observados' && p.op === 'update') t.ab_native_observados![0]!.ficou_estado = 'estavel'; return null } })
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados![0]).toMatchObject({ ficou_estado: 'estavel', motivo: null })
  })
  it('a poda roda no fim com o tempo que sobra', async () => {
    const b = criarBanco(mundo(1), { rpcs: { obs_native_poda: () => ({ data: 7, error: null }) } })
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe.obs_podadas).toBe(7)
    expect(b.rpcChamadas[0]!.args).toMatchObject({ p_lote: 500 })
  })
})
