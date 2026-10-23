// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), sentry: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: mocks.sentry, captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { rodarObservados } from '@/lib/youtube/teste-youtube/observados/passo'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { criarBanco, type Linha } from '../registro/banco-falso'
import { cursorSemPublicacao, gravacao, type LeituraObs, type ThumbObs } from '@/lib/youtube/teste-youtube/observados/inferir'
import { inferirComGuarda } from '@/lib/youtube/teste-youtube/observados/guarda'
import { lerCursor } from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { DH_A, DH_B, DH_C, H, PUB } from './fabrica'

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

/** Modo "recente": n rodadas de 6 h terminando 2 h antes de T0 (a regra v2 exige frescor de 9 h). `titulos` devolve as leituras da rodada k; "idioma::texto" fixa o idioma. */
interface Recente { n: number; titulos?: (i: number, k: number) => string[]; mini?: (i: number, k: number) => 'A' | 'B' | 'C' }
const tRodada = (n: number, k: number): number => T0 - 2 * H - (n - 1 - k) * 6 * H
/** Mundo: n alvos de concorrente. Legado (sem `recente`): 9 leituras antigas, só para os testes que não dependem da regra. */
function mundo(n: number, o: { troca?: number[]; publicado?: Record<number, string | null>; rodadas?: number; recente?: Recente } = {}) {
  const t: Record<string, Linha[]> = { yt_watch_alvos: [], yt_watch_readings: [], yt_watch_thumbs: [], competitor_channels: [{ id: 'ch1', site_id: SITE, removal_requested_at: null }], competitor_videos: [], ab_native_observados: [], ab_native_obs_cursor: [] }
  let rid = 0
  for (let i = 1; i <= n; i++) {
    const rodadas = o.rodadas ?? 40
    t.yt_watch_alvos!.push({ id: i, site_id: SITE, youtube_video_id: yt(i), tipo: 'concorrente', rodadas, ultima_rodada_em: iso(T0 - 2 * H), saiu_em: null, saiu_por: null })
    t.competitor_videos!.push({ video_id: yt(i), competitor_channel_id: 'ch1', published_at: o.publicado && i in o.publicado ? o.publicado[i] : iso(PUB.getTime()) })
    const troca = o.troca?.includes(i)
    t.yt_watch_thumbs!.push({ id: i * 10, site_id: SITE, youtube_video_id: yt(i), variante: 'maxresdefault', http: 200, dhash: DH_A, largura: 1280, altura: 720 })
    t.yt_watch_thumbs!.push({ id: i * 10 + 1, site_id: SITE, youtube_video_id: yt(i), variante: 'maxresdefault', http: 200, dhash: DH_B, largura: 1280, altura: 720 })
    t.yt_watch_thumbs!.push({ id: i * 10 + 2, site_id: SITE, youtube_video_id: yt(i), variante: 'maxresdefault', http: 200, dhash: DH_C, largura: 1280, altura: 720 })
    if (o.recente) {
      const r = o.recente
      for (let k = 0; k < r.n; k++) {
        const mini = r.mini?.(i, k) ?? (troca && k >= r.n - 8 ? 'B' : 'A')
        ;(r.titulos?.(i, k) ?? ['T']).forEach((tx, j) => {
          const [idioma, texto] = tx.includes('::') ? tx.split('::') as [string, string] : ['pt', tx]
          t.yt_watch_readings!.push({ id: ++rid, site_id: SITE, youtube_video_id: yt(i), rodada_id: `rod-${i}-${k}`, lida_em: iso(tRodada(r.n, k) + j * 300_000), http: 200, erro: null, jogador_bloqueado: true, idioma, titulo_exibido: texto, miniatura_id: i * 10 + { A: 0, B: 1, C: 2 }[mini] })
        })
      }
      continue
    }
    for (let k = 0; k < 9; k++) {
      const b = troca && k >= 2
      t.yt_watch_readings!.push({ id: ++rid, site_id: SITE, youtube_video_id: yt(i), rodada_id: `rod-${i}-${k}`, lida_em: iso(PUB.getTime() + (30 + k * 6) * H), http: 200, erro: null, jogador_bloqueado: false, idioma: 'pt', titulo_exibido: 'T', miniatura_id: i * 10 + (b ? 1 : 0) })
    }
  }
  return t
}
/** Leitura extra de um título em outro vídeo (para a guarda achar o placeholder). */
function extra(t: Record<string, Linha[]>, i: number, texto: string, quando: number, qtd = 1): void {
  const ls = t.yt_watch_readings!
  let id = Math.max(...ls.map(l => l.id as number))
  for (let q = 0; q < qtd; q++) ls.push({ id: ++id, site_id: SITE, youtube_video_id: yt(i), rodada_id: `x-${i}-${id}`, lida_em: iso(quando + q * 1000), http: 200, erro: null, jogador_bloqueado: true, idioma: 'pt', titulo_exibido: texto, miniatura_id: null })
}
/** Teste A/B de título: toda rodada mistura A e B. */
const TESTE = (a: string, b: string) => (): string[] => [a, b, a]
/** O que o upsert deve ter gravado: `gravacao` sobre as mesmas leituras (D-P7). */
async function esperado(t: Record<string, Linha[]>, i: number, o: { saiuPor?: string | null; rodadas?: number; conferir?: (vs: readonly { chave: string }[]) => Promise<ReadonlySet<string>> } = {}) {
  const leituras: LeituraObs[] = t.yt_watch_readings!.filter(l => l.youtube_video_id === yt(i)).map(l => ({
    id: l.id as number, rodadaId: l.rodada_id as string, lidaEm: l.lida_em as string, http: l.http as number, erro: l.erro as string | null, jogadorBloqueado: l.jogador_bloqueado === true,
    idioma: l.idioma as string | null, tituloExibido: l.titulo_exibido as string | null, miniaturaId: l.miniatura_id as number | null,
  }))
  const thumbsPorId = new Map<number, ThumbObs>(t.yt_watch_thumbs!.map(x => [x.id as number, { id: x.id as number, variante: x.variante as string, http: 200, dhash: x.dhash as string, largura: 1280, altura: 720 }]))
  const g = await inferirComGuarda({ leituras, thumbsPorId, publicadoEm: PUB, agoraMs: T0 }, o.conferir ?? (async () => new Set()))
  const { linhas, cursor } = gravacao({ r: g.r, estourou: g.estourou }, { agoraIso: iso(T0), rodadas: o.rodadas ?? 40, saiuPor: o.saiuPor ?? null })
  return { linhas: linhas.map(l => ({ site_id: SITE, youtube_video_id: yt(i), ...l })), cursor: { site_id: SITE, youtube_video_id: yt(i), ...cursor }, g }
}
const semFixos = (rows: Linha[]): Linha[] => rows.map(({ id: _i, updated_at: _u, ...r }) => r)
const COLUNAS_CURSOR = ['site_id', 'youtube_video_id', 'avaliado_ate_rodada', 'avaliado_em', 'avaliado_motivo', 'validas_titulo', 'validas_miniatura'].sort()

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
    const t = mundo(3, { troca: [1], recente: { n: 24 } })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.motivo).toBeNull()
    expect(r.detalhe).toMatchObject({ obs_avaliados: 3, obs_trocas: 1, obs_falhou: 0, obs_sem_tempo: 0, obs_sem_publicacao: 0, obs_sem_leitura_valida: 0 })
    expect(t.ab_native_observados).toHaveLength(1)
    expect(t.ab_native_observados![0]).toMatchObject({ youtube_video_id: yt(1), campo: 'miniatura', tipo_troca: 'sequencial', n_versoes: 2, ficou_estado: 'estavel', veredito: 'troca_observada' })
    expect(t.ab_native_obs_cursor).toHaveLength(3)
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ avaliado_ate_rodada: 40, avaliado_motivo: 'ok', validas_titulo: 8, validas_miniatura: 8 }) // rodadas de W por campo
    const e = await esperado(t, 1)
    expect(semFixos(t.ab_native_observados!)).toEqual(e.linhas)
    expect(semFixos(t.ab_native_obs_cursor!).find(c => c.youtube_video_id === yt(1))).toEqual(e.cursor)
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
    const t = mundo(3, { troca: [1, 2], publicado: { 1: null }, recente: { n: 24 } })
    t.competitor_videos = t.competitor_videos!.filter(v => v.video_id !== yt(3))
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_sem_publicacao: 1, obs_avaliados: 1, obs_ignorados: 1 })
    const c1 = t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(1))!
    expect(c1).toMatchObject({ avaliado_motivo: 'sem_publicacao', validas_titulo: 0, validas_miniatura: 0 })
    expect(semFixos([c1])[0]).toEqual({ site_id: SITE, youtube_video_id: yt(1), ...cursorSemPublicacao({ agoraIso: iso(T0), rodadas: 40 }) })
    expect(lerCursor(c1)?.motivo).toBe('sem_publicacao')
    expect(t.ab_native_observados!.map(o => o.youtube_video_id)).toEqual([yt(2)])
  })
  it('mesmo vídeo em dois canais do site: uma avaliação, e a publicação MÍNIMA decide a carência', async () => {
    const n = 24
    const t = mundo(1, { troca: [1], recente: { n } })
    t.competitor_channels!.push({ id: 'ch2', site_id: SITE, removal_requested_at: null })
    // o canal que publicou DEPOIS vem primeiro: se valesse ele, a carência (pub + 24 h) deixaria W⁻ sem rodadas e a troca não sairia
    t.competitor_videos = [{ video_id: yt(1), competitor_channel_id: 'ch2', published_at: iso(tRodada(n, n - 12)) }, ...t.competitor_videos!]
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
    const t = mundo(2, { recente: { n: 24 } })
    for (const l of t.yt_watch_readings!) if (l.youtube_video_id === yt(1)) { l.erro = 'bloqueado'; l.http = 429; l.miniatura_id = null }
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 2, obs_sem_leitura_valida: 1 })
    expect(t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(1))).toMatchObject({ avaliado_motivo: 'ok', validas_titulo: 0, validas_miniatura: 0 })
    expect(t.ab_native_obs_cursor!.find(c => c.youtube_video_id === yt(2))).toMatchObject({ validas_titulo: 8, validas_miniatura: 8 })
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
    const t = mundo(2, { troca: [1, 2], recente: { n: 24 } })
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
  it('varredura cheia (lote inteiro de linhas vivas, nenhuma fechada) conta obs_varredura_cheia; com fechamento ou lote folgado, não (Phil M-2)', async () => {
    const t = mundo(3)
    const linha = (id: number, ytId: string): Linha => ({ id, site_id: SITE, youtube_video_id: ytId, campo: 'titulo', ficou_estado: 'em_andamento', motivo: null, ultima_atualizacao_em: iso(T0 - id * 1000) })
    t.ab_native_observados!.push(linha(1, yt(1)), linha(2, yt(2)))
    const cheia = await rodarObservados(contexto(criarBanco(t).sb), { fimDuroMs: FIM, env: ENV_ON, varreduraLote: 2 })
    expect(cheia.detalhe).toMatchObject({ obs_fechados: 0, obs_varredura_cheia: 1 })
    const folgada = await rodarObservados(contexto(criarBanco(t).sb), { fimDuroMs: FIM, env: ENV_ON, varreduraLote: 500 })
    expect(folgada.detalhe).toMatchObject({ obs_varredura_cheia: 0 })
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
  it('relógio que avança: a linha leva o mesmo instante do avaliado_em do cursor (agora único)', async () => {
    const t = mundo(1, { recente: { n: 16, titulos: TESTE('Titulo A', 'Titulo B') } })
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb, T0, 1000), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados).toHaveLength(1)
    expect(t.ab_native_observados![0]!.ultima_atualizacao_em).toBe(t.ab_native_obs_cursor![0]!.avaliado_em)
    expect(Date.parse(t.ab_native_obs_cursor![0]!.avaliado_em as string)).toBeGreaterThanOrEqual(T0) // o relógio andou 1 s por chamada; as consultas depois do topo não o mexem
  })
  it('teste de título: 1 linha possivel_teste_youtube, cursor com validas_titulo > 0; o upsert é o gravacao() mais site/vídeo', async () => {
    const t = mundo(1, { recente: { n: 16, titulos: TESTE('Titulo A', 'Titulo B') } })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_trocas: 1, obs_avaliados: 1, obs_titulo_suspenso: 0 })
    expect(t.ab_native_observados).toHaveLength(1)
    expect(t.ab_native_observados![0]).toMatchObject({ campo: 'titulo', veredito: 'possivel_teste_youtube', ficou_estado: 'em_andamento' })
    expect(t.ab_native_obs_cursor![0]!.validas_titulo).toBeGreaterThan(0)
    const e = await esperado(t, 1)
    expect(semFixos(t.ab_native_observados!)).toEqual(e.linhas)
    expect(semFixos(t.ab_native_obs_cursor!)).toEqual([e.cursor])
  })
  it('as chaves do upsert do cursor são exatamente as colunas de ab_native_obs_cursor (migration 20261021000006)', async () => {
    const t = mundo(2, { publicado: { 2: null }, recente: { n: 16, titulos: TESTE('Titulo A', 'Titulo B') } })
    await rodarObservados(contexto(criarBanco(t).sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_obs_cursor).toHaveLength(2)
    for (const c of semFixos(t.ab_native_obs_cursor!)) expect(Object.keys(c).sort()).toEqual(COLUNAS_CURSOR)
    expect(lerCursor({ ...t.ab_native_obs_cursor![0]! })?.motivo).toBe('ok')
    expect(lerCursor({ ...semFixos(t.ab_native_obs_cursor!)[0]!, avaliado_motivo: undefined, motivo: 'ok' })).toBeNull()
  })
  it('alvo que saiu (saiu_por nulo) com teste em W: grava sem_desfecho + motivo saiu, nunca em_andamento (D-P3, Yannis R2)', async () => {
    const t = mundo(1, { recente: { n: 16, titulos: TESTE('Titulo A', 'Titulo B') } })
    t.yt_watch_alvos![0]!.saiu_em = iso(T0 - H)
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados).toHaveLength(1)
    expect(t.ab_native_observados![0]).toMatchObject({ veredito: 'possivel_teste_youtube', ficou_estado: 'sem_desfecho', motivo: 'saiu' })
    expect(t.ab_native_obs_cursor).toHaveLength(1)
    const e = await esperado(t, 1, { saiuPor: 'saiu' })
    expect(semFixos(t.ab_native_observados!)).toEqual(e.linhas)
  })
  it('alvo que saiu por janela com teste em W e sem linha anterior: 1 upsert sem_desfecho/janela e o cursor; nunca em_andamento', async () => {
    const t = mundo(1, { recente: { n: 16, titulos: TESTE('Titulo A', 'Titulo B') } })
    t.yt_watch_alvos![0]!.saiu_em = iso(T0 - H); t.yt_watch_alvos![0]!.saiu_por = 'janela'
    const b = criarBanco(t, { falhar: p => { if (p.tabela === 'ab_native_observados' && p.op === 'upsert') expect(p.op).toBe('upsert'); return null } })
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(b.pedidos.filter(p => p.tabela === 'ab_native_observados' && p.op === 'upsert')).toHaveLength(1)
    expect(t.ab_native_observados![0]).toMatchObject({ ficou_estado: 'sem_desfecho', motivo: 'janela' })
    expect(t.ab_native_obs_cursor).toHaveLength(1)
  })
  it('sem_troca_vista depois de uma troca já gravada: a linha anterior fica intocada e o cursor anda', async () => {
    const t = mundo(1, { recente: { n: 24 } })
    const antiga: Linha = { id: 7, site_id: SITE, youtube_video_id: yt(1), campo: 'miniatura', veredito: 'troca_observada', ficou_estado: 'estavel', motivo: null, versao_regra: 2, ultima_atualizacao_em: iso(T0 - 48 * H) }
    t.ab_native_observados!.push({ ...antiga })
    t.ab_native_obs_cursor!.push({ site_id: SITE, youtube_video_id: yt(1), avaliado_ate_rodada: 30, avaliado_em: iso(T0 - 48 * H), avaliado_motivo: 'ok', validas_titulo: 8, validas_miniatura: 8 })
    const b = criarBanco(t)
    await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados).toEqual([antiga])
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ avaliado_ate_rodada: 40, avaliado_em: iso(T0) })
  })
  it('Hamming 8 na miniatura (indeterminada pela regra antiga): 0 linhas, cursor gravado, obs_falhou 0', async () => {
    const t = mundo(1, { recente: { n: 24, mini: (_i, k) => (k < 16 ? 'A' : 'C') } })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(t.ab_native_observados).toHaveLength(0)
    expect(t.ab_native_obs_cursor).toHaveLength(1)
    expect(r.detalhe).toMatchObject({ obs_falhou: 0, obs_avaliados: 1 })
  })
})

describe('guarda de título repetido no passo (§6.2)', () => {
  const R = 'Titulo R'
  const P = 'Titulo P'
  /** Alvo 1: R sempre; P junto de R só nas rodadas 6 e 7 (teste que acaba fora de W). */
  const mundoP = (n: number, nAlvos = 6) => {
    const t = mundo(nAlvos, { recente: { n, titulos: (i, k) => (i !== 1 ? ['T'] : k === 6 || k === 7 ? [P, R, P] : [R]) } })
    return t
  }
  const outros = (t: Record<string, Linha[]>, n: number, ids: number[], texto = P, qtd = 1): void => { for (const i of ids) extra(t, i, texto, tRodada(n, 6), qtd) }
  const comP = (t: Record<string, Linha[]>): boolean => JSON.stringify(t.ab_native_observados).includes(P)

  it('controle: sem o placeholder em outros vídeos, a linha do teste (com P) é gravada', async () => {
    const t = mundoP(24)
    await rodarObservados(contexto(criarBanco(t).sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(comP(t)).toBe(true)
  })
  for (const [nome, n, estado] of [['D+1 (sumindo)', 24, 'sumindo'], ['D+3 (terminou)', 40, 'terminou']] as const) {
    it(`P em 5 vídeos, só nas rodadas 6 e 7: ${nome} não grava P em trocas nem em ficou, e obs_titulo_suspenso conta (foco 5)`, async () => {
      const t = mundoP(n)
      outros(t, n, [2, 3, 4, 5, 6])
      const b = criarBanco(t)
      const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
      expect(r.detalhe).toMatchObject({ obs_avaliados: 1, obs_falhou: 0 })
      expect(r.detalhe.obs_titulo_suspenso).toBeGreaterThan(0)
      expect(comP(t), estado).toBe(false)
      expect(t.ab_native_obs_cursor).toHaveLength(1)
    })
  }
  it('Lolzin: 2 vídeos do mesmo canal com o mesmo título, cada um alternando com o próprio: as linhas saem, sem suspensão', async () => {
    const t = mundo(2, { recente: { n: 16, titulos: i => (i === 1 ? ['Proprio 1', 'Lolzin', 'Proprio 1'] : ['Proprio 2', 'Lolzin', 'Proprio 2']) } })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe).toMatchObject({ obs_titulo_suspenso: 0, obs_trocas: 2, obs_avaliados: 2 })
    expect(JSON.stringify(t.ab_native_observados)).toContain('Lolzin')
  })
  it('1.000+ leituras do placeholder num único outro vídeo (bateu o teto): suspende', async () => {
    const t = mundoP(24, 2)
    outros(t, 24, [2], P, 1100)
    const r = await rodarObservados(contexto(criarBanco(t).sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(r.detalhe.obs_titulo_suspenso).toBeGreaterThan(0)
    expect(comP(t)).toBe(false)
  })
  it('achados do mesmo bruto em 2 lotes de 100 ids somam para a regra de >= 2 vídeos', async () => {
    const t = mundoP(24, 120)
    outros(t, 24, [2, 115])
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(r.detalhe.obs_titulo_suspenso).toBeGreaterThan(0)
    expect(comP(t)).toBe(false)
    const guarda = b.pedidos.filter(p => p.tabela === 'yt_watch_readings' && p.filtros.some(f => f.startsWith('eq:titulo_exibido')))
    expect(guarda.length).toBeGreaterThanOrEqual(2)
    for (const g of guarda) expect(g.filtros).toContain(`eq:site_id,${SITE}`)
  })
  it('erro na consulta da guarda: 0 upserts em ab_native_observados, 0 cursores, obs_falhou 1 (nunca "nenhum achado")', async () => {
    const t = mundoP(24, 3)
    outros(t, 24, [2, 3])
    const b = criarBanco(t, { falhar: p => (p.tabela === 'yt_watch_readings' && p.filtros.some(f => f.startsWith('eq:titulo_exibido')) ? { code: 'XX000' } : null) })
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(r.detalhe).toMatchObject({ obs_falhou: 1, obs_avaliados: 0 })
    expect(b.pedidos.filter(p => p.tabela === 'ab_native_observados' && p.op === 'upsert')).toHaveLength(0)
    expect(t.ab_native_observados).toHaveLength(0)
    expect(t.ab_native_obs_cursor).toHaveLength(0)
  })
  it('consulta da guarda sem error mas com data nula: o mesmo (falha, sem linha, sem cursor)', async () => {
    const t = mundoP(24, 3)
    outros(t, 24, [2, 3])
    const b = criarBanco(t)
    const sb = b.sb as unknown as { from: (n: string) => Record<string, unknown> }
    const from = sb.from.bind(sb)
    sb.from = (n: string) => {
      const q = from(n)
      if (n !== 'yt_watch_readings') return q
      let guarda = false
      const eq = q.eq as (c: string, v: unknown) => unknown
      const limit = q.limit as (x: number) => unknown
      q.eq = (c: string, v: unknown) => { if (c === 'titulo_exibido') guarda = true; return eq(c, v) }
      q.limit = (x: number) => (guarda ? { abortSignal: () => Promise.resolve({ data: null, error: null }) } : limit(x))
      return q
    }
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(r.detalhe).toMatchObject({ obs_falhou: 1, obs_avaliados: 0 })
    expect(t.ab_native_observados).toHaveLength(0)
    expect(t.ab_native_obs_cursor).toHaveLength(0)
  })
  it('estouro da guarda: sem linha de título, cursor com validas_titulo 0 (a miniatura segue, §6.2), e o upsert é o gravacao() do mesmo resultado', async () => {
    // idiomas em cadência decrescente: cada suspensão devolve a maioria ao próximo idioma, com versões novas (4 idiomas > teto de 3)
    const idiomas: Array<[string, string]> = [['l1', 'aabab'], ['l2', 'abab'], ['l3', 'aba'], ['l4', 'ab']]
    const todos = idiomas.flatMap(([l]) => ['a', 'b'].map(x => `${l}::${l} ${x}`))
    const t = mundo(3, { recente: { n: 16, titulos: i => (i === 1 ? idiomas.flatMap(([l, it]) => [...it].map(x => `${l}::${l} ${x}`)) : todos) } })
    const b = criarBanco(t)
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON, maxAlvos: 1 })
    expect(r.detalhe).toMatchObject({ obs_avaliados: 1, obs_falhou: 0 })
    expect(r.detalhe.obs_titulo_suspenso).toBeGreaterThan(0)
    expect(t.ab_native_observados!.filter(o => o.campo === 'titulo')).toHaveLength(0)
    expect(t.ab_native_obs_cursor![0]).toMatchObject({ validas_titulo: 0 })
    const e = await esperado(t, 1, { conferir: async vs => new Set(vs.map(v => v.chave)) })
    expect(e.g.estourou).toBe(true)
    expect(semFixos(t.ab_native_observados!)).toEqual(e.linhas)
    expect(semFixos(t.ab_native_obs_cursor!)).toEqual([e.cursor])
  })
})

describe('passo (flag on), fim', () => {
  it('a poda roda no fim com o tempo que sobra', async () => {
    const b = criarBanco(mundo(1), { rpcs: { obs_native_poda: () => ({ data: 7, error: null }) } })
    const r = await rodarObservados(contexto(b.sb), { fimDuroMs: FIM, env: ENV_ON })
    expect(r.detalhe.obs_podadas).toBe(7)
    expect(b.rpcChamadas[0]!.args).toMatchObject({ p_lote: 500 })
  })
})
