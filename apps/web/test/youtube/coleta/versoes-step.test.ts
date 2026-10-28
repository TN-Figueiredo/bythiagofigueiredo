// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { addDays, ontemPt } from '@/lib/youtube/coleta/day-pt'
import { MAX_DIAS_POR_EXECUCAO, passoVersoes, TETO_VERSOES_MS, type VersoesResumo } from '@/lib/youtube/coleta/versoes-step'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const SITE = 'site-1'
const OUTRO_SITE = 'site-2'
const ONTEM = ontemPt(new Date())
/** `n` dias antes de ontem. */
const dia = (n: number): string => addDays(ONTEM, -n)
const cap = (d: string, h = '12:00:00'): string => `${addDays(d, 1)}T${h}.000Z`
const H0 = '0000000000000000'
const H1 = 'ffffffffffffffff'
const SEGREDO = 'SEGREDO'

function canal(id: string, site = SITE, name = `Canal ${id}`): ColetaChannel {
  return { id, channel_id: `UC${id}`, site_id: site, name, sync_enabled: true, collection_status: 'ok', video_count: null }
}

interface Mundo { db: FakeDb; ctx: StepCtx & { ontem: string } }
function mundo(canais: ColetaChannel[] = [canal('c1')], deadlineMs = 60_000): Mundo {
  const db = fakeSupabase()
  db.tables.youtube_channels = canais.map(c => ({ id: c.id, site_id: c.site_id, name: c.name }))
  const ctx = { supabase: db.client, channels: canais, deadline: Date.now() + deadlineMs, falhas: [], tentativas: [], ontem: ONTEM } as StepCtx & { ontem: string }
  return { db, ctx }
}
const rodar = (m: Mundo): Promise<VersoesResumo> => passoVersoes(m.ctx)

/** Vídeos cadastrados do canal (publicados há 90 dias), com uuid previsível. */
function videos(db: FakeDb, ch: string, n: number, site = SITE, prefixo = ch): string[] {
  const ids: string[] = []
  for (let i = 1; i <= n; i++) {
    const yt = `${prefixo}-v${i}`
    ids.push(yt)
    ;(db.tables.youtube_videos ??= []).push({ id: `u-${yt}`, youtube_video_id: yt, channel_id: ch, site_id: site, published_at: '2026-01-01T00:00:00.000Z' })
  }
  return ids
}
interface OpcDia { priv?: Row['privacy_status']; titulo?: string | null; descHash?: string | null; descTexto?: string | null; dhash?: string | null; sha?: string | null; blob?: string | null }
function linha(db: FakeDb, ch: string, yt: string, d: string, o: OpcDia = {}, site = SITE): void {
  ;(db.tables.yt_own_video_meta_daily ??= []).push({
    youtube_video_id: yt, day_pt: d, site_id: site, channel_id: ch, video_id: `u-${yt}`,
    title_at_capture: o.titulo === undefined ? `${SEGREDO} titulo A` : o.titulo,
    description_sha256: o.descHash === undefined ? 'dh-A' : o.descHash,
    description_text: o.descTexto === undefined ? 'Texto A' : o.descTexto,
    thumbnail_dhash: o.dhash === undefined ? H0 : o.dhash,
    thumbnail_sha256_at_capture: o.sha === undefined ? 'sha-A' : o.sha,
    thumbnail_blob_url: o.blob === undefined ? 'https://blob.test/a.jpg' : o.blob,
    privacy_status: o.priv === undefined ? 'public' : o.priv,
    captured_at: cap(d),
  })
}
const PADRAO = { titulo: `${SEGREDO} titulo A`, desc: 'dh-A', dhash: H0, sha: 'sha-A' }
/** Estado + as três correntes do vídeo, vistas pela última vez em `ate` (formato igual ao que o banco devolve). */
function estadoComCorrentes(db: FakeDb, ch: string, yts: string[], ate: string, site = SITE, desde = ate): void {
  ;(db.tables.yt_own_versions_state ??= []).push({ channel_id: ch, site_id: site, tracking_since: desde, derived_through: ate })
  for (const yt of yts) {
    for (const [campo, hash] of [['title', hashValue(PADRAO.titulo)], ['desc', PADRAO.desc], ['thumb', PADRAO.dhash]] as const) {
      ;(db.tables.yt_own_video_versions ??= []).push({
        id: `cur-${ch}-${yt}-${campo}`, youtube_video_id: yt, site_id: site, video_id: `u-${yt}`, channel_id: ch, field: campo,
        value_text: campo === 'title' ? PADRAO.titulo : campo === 'desc' ? 'Texto A' : null, value_hash: hash,
        thumb_dhash: campo === 'thumb' ? H0 : null, thumb_anchor_dhash: campo === 'thumb' ? H0 : null, thumb_sha256: campo === 'thumb' ? PADRAO.sha : null,
        thumb_blob_url: campo === 'thumb' ? 'https://blob.test/a.jpg' : null, thumb_similar: false,
        first_day_pt: desde, last_day_pt: ate, first_seen_at: cap(desde), last_seen_at: cap(ate),
        window_start: null, window_end: null, window_precision: 'first', origin: 'linha_de_base', ab_event: null, ab_test_id: null, ab_variant_id: null,
        pre_registro: false, is_current: true,
      })
    }
  }
}
const versoes = (db: FakeDb, filtro: Partial<Record<string, unknown>> = {}): Row[] =>
  (db.tables.yt_own_video_versions ?? []).filter(v => Object.entries(filtro).every(([k, x]) => v[k] === x))
const aplicacoes = (db: FakeDb) => db.rpcCalls.filter(c => c.name === 'yt_own_versions_apply_day')
const estadoDe = (db: FakeDb, ch: string): string | undefined => (db.tables.yt_own_versions_state ?? []).find(e => e.channel_id === ch)?.derived_through as string | undefined
const tudoTexto = (m: Mundo, r: VersoesResumo): string => JSON.stringify([m.ctx.falhas, r])
const semMais = (): Promise<never> => new Promise<never>(() => undefined)

describe('passoVersoes', () => {
  it('constantes do contrato', () => {
    expect(TETO_VERSOES_MS).toBe(10_000)
    expect(MAX_DIAS_POR_EXECUCAO).toBe(30)
  })

  it('1. item 188: semente de produção (35 vídeos, primeiro dia sem captura, 5 dias): 105 linhas de base, zero trocas, estado em ontem, dias em ordem', async () => {
    const m = mundo()
    const ids = videos(m.db, 'c1', 35)
    for (let n = 4; n >= 0; n--) for (const yt of ids) linha(m.db, 'c1', yt, dia(n), n === 4 ? { priv: null } : {})
    const r = await rodar(m)
    expect(r.abertas).toEqual({ linha_de_base: 105, ab_lab: 0, fora_do_sistema: 0, nao_se_sabe: 0 })
    expect(r.dias_derivados).toBe(5)
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
    expect(versoes(m.db)).toHaveLength(105)
    const dias = aplicacoes(m.db).map(c => c.args.p_day as string)
    expect(dias).toEqual([...dias].sort())
    expect(new Set(dias).size).toBe(5)
    expect(m.ctx.falhas).toEqual([])
    expect(r.atraso_dias).toEqual({ c1: 0 })
    expect(versoes(m.db, { field: 'thumb' }).every(v => v.first_day_pt === dia(4))).toBe(true)
    expect(versoes(m.db, { field: 'title' }).every(v => v.first_day_pt === dia(3))).toBe(true)
  })

  it('2. item 187: dois dias acumulados dão o mesmo estado que duas execuções diárias (dia 1 só confirma, dia 2 troca)', async () => {
    const monta = (): Mundo => {
      const m = mundo()
      const [a, b] = videos(m.db, 'c1', 2) as [string, string]
      estadoComCorrentes(m.db, 'c1', [a, b], dia(2))
      for (const yt of [a, b]) linha(m.db, 'c1', yt, dia(1))
      linha(m.db, 'c1', a, dia(0), { titulo: `${SEGREDO} titulo B` })
      linha(m.db, 'c1', b, dia(0), { dhash: H1, sha: 'sha-B', blob: 'https://blob.test/b.jpg' })
      return m
    }
    const projeta = (db: FakeDb) => versoes(db).map(v => ({
      yt: v.youtube_video_id, f: v.field, h: v.value_hash, c: v.is_current, a: v.first_day_pt, u: v.last_day_pt,
      ws: v.window_start, we: v.window_end, wp: v.window_precision, an: v.thumb_anchor_dhash, sh: v.thumb_sha256, o: v.origin,
    })).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))
    const acumulado = monta()
    await rodar(acumulado)
    // duas diárias: primeiro só o dia 1 existe (ontem = dia(1)), depois o dia 2
    const diarias = monta()
    const linhasDoDia2 = (diarias.db.tables.yt_own_video_meta_daily ?? []).filter(l => l.day_pt === dia(0))
    diarias.db.tables.yt_own_video_meta_daily = (diarias.db.tables.yt_own_video_meta_daily ?? []).filter(l => l.day_pt !== dia(0))
    await passoVersoes({ ...diarias.ctx, ontem: dia(1) })
    diarias.db.tables.yt_own_video_meta_daily!.push(...linhasDoDia2)
    await rodar(diarias)
    expect(projeta(diarias.db)).toEqual(projeta(acumulado.db))
    const trocas = versoes(acumulado.db, { origin: 'fora_do_sistema' })
    expect(trocas).toHaveLength(2)
    // a janela da troca do dia 2 nasce da captura do dia 1 (as correntes avançaram em memória)
    for (const t of trocas) { expect(t.window_start).toBe(cap(dia(1))); expect(t.window_precision).toBe('1d') }
  })

  it('3. reexecução no mesmo dia: nenhuma chamada de apply_day, dias_derivados 0, atraso 0', async () => {
    const m = mundo()
    const ids = videos(m.db, 'c1', 2)
    for (const yt of ids) { linha(m.db, 'c1', yt, dia(1)); linha(m.db, 'c1', yt, dia(0)) }
    await rodar(m)
    const antes = aplicacoes(m.db).length
    const r = await rodar(m)
    expect(aplicacoes(m.db).length).toBe(antes)
    expect(r.dias_derivados).toBe(0)
    expect(r.atraso_dias).toEqual({ c1: 0 })
  })

  it('4. item 189a: apaga as linhas do último dia: nota vermelha de dia sem linha, derived_through parado, o outro canal segue', async () => {
    const m = mundo([canal('c1'), canal('c2')])
    const [a] = videos(m.db, 'c1', 1) as [string]
    const [b] = videos(m.db, 'c2', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [a], dia(1))
    estadoComCorrentes(m.db, 'c2', [b], dia(1))
    linha(m.db, 'c2', b, dia(0)) // c1 não tem linha em ontem
    const r = await rodar(m)
    expect(m.ctx.falhas).toContain(`versões: Canal c1 sem nenhuma linha diária em ${dia(0)}`)
    expect(estadoDe(m.db, 'c1')).toBe(dia(1))
    expect(estadoDe(m.db, 'c2')).toBe(ONTEM)
    expect(r.atraso_dias).toEqual({ c1: 1, c2: 0 })
  })

  it('5. item 189b: buraco no meio com dia posterior presente: nota vermelha, o dia é pulado, a troca seguinte sai lacuna', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [a], dia(3))
    linha(m.db, 'c1', a, dia(1), { titulo: `${SEGREDO} titulo B` })
    linha(m.db, 'c1', a, dia(0), { titulo: `${SEGREDO} titulo B` })
    const r = await rodar(m)
    expect(m.ctx.falhas).toContain(`versões: Canal c1 sem nenhuma linha diária em ${dia(2)}`)
    expect(r.dias_sem_linha).toBe(1)
    const troca = versoes(m.db, { field: 'title', is_current: true })[0]!
    expect(troca.window_precision).toBe('lacuna')
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
  })

  it('6. item 189c: derived_through dois dias atrás e sem tempo antes de derivar qualquer dia: nota de atraso', async () => {
    const m = mundo([canal('c1')], 1_000)
    const [a] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [a], dia(2))
    linha(m.db, 'c1', a, dia(1)); linha(m.db, 'c1', a, dia(0))
    const r = await rodar(m)
    expect(r.sem_tempo).toBe(true)
    expect(aplicacoes(m.db)).toHaveLength(0)
    expect(m.ctx.falhas).toContain(`versões: Canal c1 conferido até ${dia(2)}, 2 dias de atraso`)
    expect(r.recuperando).toEqual({})
  })

  it('7. canal sem vídeos e sem linha: sem_videos, nenhuma nota; contagem nula: "não foi possível avaliar"', async () => {
    const m = mundo()
    const r = await rodar(m)
    expect(r.sem_videos).toEqual(['c1'])
    expect(m.ctx.falhas).toEqual([])
    const n = mundo()
    n.db.semContagem.youtube_videos = true
    const r2 = await rodar(n)
    expect(n.ctx.falhas).toContain('critérios: não foi possível avaliar se Canal c1 tem vídeos')
    expect(r2.sem_videos).toEqual([])
    // vídeos cadastrados e nenhuma linha em tabela nenhuma: vermelho
    const o = mundo(); videos(o.db, 'c1', 2)
    await rodar(o)
    expect(o.ctx.falhas).toContain('versões: Canal c1 tem vídeos e nenhuma linha diária')
  })

  it('8. schema ausente no estado: uma nota, nenhuma função chamada, nenhum outro canal lido', async () => {
    const m = mundo([canal('c1'), canal('c2')])
    m.db.errors.yt_own_versions_state = { code: '42P01', message: 'relation does not exist' }
    await rodar(m)
    expect(m.ctx.falhas).toEqual(['schema_ausente: yt_own_versions_state'])
    expect(m.db.rpcCalls).toHaveLength(0)
    expect(m.db.leituras.yt_own_video_meta_daily).toBeUndefined()
  })

  it('9. erro de apply_day no segundo de três dias: o primeiro fica, o terceiro não é tentado, nota de catálogo, sem o texto do banco', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    for (const n of [2, 1, 0]) linha(m.db, 'c1', a, dia(n))
    const original = m.db.rpcHandlers.yt_own_versions_apply_day!
    let n = 0
    m.db.rpcHandlers.yt_own_versions_apply_day = (args) => (++n === 2 ? { data: null, error: { code: 'XX000', message: `falha com ${SEGREDO} titulo` } } : original(args))
    const r = await rodar(m)
    expect(aplicacoes(m.db)).toHaveLength(2)
    expect(estadoDe(m.db, 'c1')).toBe(dia(2))
    expect(m.ctx.falhas).toContain(`versões: Canal c1 não gravou o dia ${dia(1)} (erro_desconhecido)`)
    expect(tudoTexto(m, r)).not.toContain(SEGREDO)
  })

  it('10. item 184: leitura do A/B Lab com erro, e com exatamente 1.000 linhas: troca gravada com nao_se_sabe e nota vermelha', async () => {
    for (const modo of ['erro', 'mil'] as const) {
      const m = mundo()
      const [a] = videos(m.db, 'c1', 1) as [string]
      estadoComCorrentes(m.db, 'c1', [a], dia(1))
      linha(m.db, 'c1', a, dia(0), { titulo: `${SEGREDO} titulo B` })
      if (modo === 'erro') m.db.errors.ab_tests = { code: 'XX000', message: 'boom' }
      else m.db.tables.ab_tests = Array.from({ length: 1000 }, (_, i) => ({ id: `t${i}`, youtube_video_id: `u-${a}`, test_type: 'title', paused_at: null, completed_at: null, completed_reason: null, winner_variant_id: null, winner_applied_at: null, original_title: null }))
      const r = await rodar(m)
      expect(versoes(m.db, { field: 'title', is_current: true })[0]!.origin, modo).toBe('nao_se_sabe')
      expect(m.ctx.falhas, modo).toContain('versões: A/B Lab não pôde ser lido; origem de 1 troca(s) ficou sem resposta')
      expect(r.abertas.nao_se_sabe).toBe(1)
    }
  })

  it('11. sem troca no dia: o A/B Lab não é lido (zero consulta a ab_tests)', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [a], dia(1))
    linha(m.db, 'c1', a, dia(0))
    const r = await rodar(m)
    expect(r.confirmadas).toBe(3)
    expect(m.db.leituras.ab_tests).toBeUndefined()
    expect(m.db.leituras.ab_test_cycles).toBeUndefined()
  })

  it('12. descrição: texto na linha do dia; texto só numa linha anterior de mesmo hash; texto em lugar nenhum', async () => {
    const texto = async (monta: (m: Mundo, a: string) => void): Promise<{ v: Row | undefined; r: VersoesResumo; m: Mundo }> => {
      const m = mundo()
      const [a] = videos(m.db, 'c1', 1) as [string]
      monta(m, a)
      const r = await rodar(m)
      return { v: versoes(m.db, { field: 'desc' })[0], r, m }
    }
    const a = await texto((m, y) => linha(m.db, 'c1', y, dia(0), { descTexto: 'Texto da descrição' }))
    expect(a.v!.value_text).toBe('Texto da descrição')
    const b = await texto((m, y) => { linha(m.db, 'c1', y, dia(1), { priv: null, descTexto: 'Texto antigo' }); linha(m.db, 'c1', y, dia(0), { descTexto: null }) })
    expect(b.v!.value_text).toBe('Texto antigo')
    expect(b.r.desc_sem_texto).toBe(0)
    const c = await texto((m, y) => linha(m.db, 'c1', y, dia(0), { descTexto: null }))
    expect(c.v!.value_text).toBeNull()
    expect(c.r.desc_sem_texto).toBe(1)
    expect(c.m.ctx.falhas).toContain('versões: 1 versão(ões) de descrição sem o texto guardado')
  })

  it('13. mutação de canal e de site: linhas e correntes de outro canal ou site não entram no plano do canal', async () => {
    const m = mundo([canal('c1')])
    const proprios = videos(m.db, 'c1', 3)
    const doOutroCanal = videos(m.db, 'c9', 3)
    const doOutroSite = videos(m.db, 'c1', 3, OUTRO_SITE, 'x')
    for (const yt of proprios) linha(m.db, 'c1', yt, dia(0))
    for (const yt of doOutroCanal) linha(m.db, 'c9', yt, dia(0))
    for (const yt of doOutroSite) linha(m.db, 'c1', yt, dia(0), {}, OUTRO_SITE)
    estadoComCorrentes(m.db, 'c9', doOutroCanal, dia(1)) // corrente de outro canal: não pode virar "confirmação" deste
    const antes = versoes(m.db).length
    const r = await rodar(m)
    expect(r.abertas.linha_de_base).toBe(9)
    expect(versoes(m.db, { channel_id: 'c1' }).map(v => v.youtube_video_id).every(y => proprios.includes(y as string))).toBe(true)
    expect(versoes(m.db)).toHaveLength(antes + 9)
    expect(aplicacoes(m.db).every(c => c.args.p_channel_id === 'c1' && c.args.p_site_id === SITE)).toBe(true)
  })

  it('14. prova: sem_explicacao, publicos 0 com vídeos, função ausente e origem_cms dão nota', async () => {
    const monta = (): { m: Mundo; a: string } => {
      const m = mundo(); const [a] = videos(m.db, 'c1', 1) as [string]
      linha(m.db, 'c1', a, dia(0))
      return { m, a }
    }
    const base = { publicos: 1, sem_titulo: 0, sem_thumb: 0, sem_explicacao: 0, canais_com_linha_sem_estado: 0, derivado_ate: ONTEM, origem_cms: 0 }
    const v1 = monta(); v1.m.db.provaVersoes = { ...base, sem_explicacao: 1 }; await rodar(v1.m)
    expect(v1.m.ctx.falhas).toContain('versões: 1 vídeo(s) público(s) sem título ou thumbnail conferidos em 2 dias e sem tentativa que explique')
    const v2 = monta(); v2.m.db.provaVersoes = { ...base, publicos: 0 }; await rodar(v2.m)
    expect(v2.m.ctx.falhas).toContain(`versões: a prova não achou vídeo público em ${SITE}`)
    const v3 = monta(); v3.m.db.errors['rpc:yt_own_versions_prova'] = { code: 'PGRST202', message: 'sem função' }; await rodar(v3.m)
    expect(v3.m.ctx.falhas).toContain('critérios: não foi possível avaliar a prova das versões')
    const v4 = monta(); v4.m.db.provaVersoes = { ...base, origem_cms: 1 }; await rodar(v4.m)
    expect(v4.m.ctx.falhas).toContain('versões: há versão com origem reservada (cms)')
    const v5 = monta(); v5.m.db.provaVersoes = base; await rodar(v5.m)
    expect(v5.m.ctx.falhas).toEqual([])
  })

  it('15. ja_derivado devolvido pela função: conta, relê as correntes e segue sem nota', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    linha(m.db, 'c1', a, dia(1)); linha(m.db, 'c1', a, dia(0))
    const original = m.db.rpcHandlers.yt_own_versions_apply_day!
    let n = 0
    m.db.rpcHandlers.yt_own_versions_apply_day = (args) => (++n === 1 ? { data: { resultado: 'ja_derivado' }, error: null } : original(args))
    const r = await rodar(m)
    expect(r.ja_derivado).toBe(1)
    expect(r.dias_derivados).toBe(1)
    expect(m.ctx.falhas).toEqual([])
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
  })

  it('16. prazo menor que 1,5 s antes do segundo dia: para, sem_tempo verdadeiro, o primeiro dia gravado', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    for (const n of [2, 1, 0]) linha(m.db, 'c1', a, dia(n))
    const original = m.db.rpcHandlers.yt_own_versions_apply_day!
    m.db.rpcHandlers.yt_own_versions_apply_day = (args) => { m.ctx.deadline = Date.now() + 1_000; return original(args) }
    const r = await rodar(m)
    expect(r.sem_tempo).toBe(true)
    expect(r.dias_derivados).toBe(1)
    expect(aplicacoes(m.db)).toHaveLength(1)
    expect(estadoDe(m.db, 'c1')).toBe(dia(2))
  })

  it('17. nenhuma nota nem campo do resumo contém título de vídeo', async () => {
    const m = mundo()
    const [a, b] = videos(m.db, 'c1', 2) as [string, string]
    estadoComCorrentes(m.db, 'c1', [a, b], dia(2))
    for (const n of [1, 0]) { linha(m.db, 'c1', a, dia(n), { titulo: `${SEGREDO} B${n}` }); linha(m.db, 'c1', b, dia(n), { titulo: `${SEGREDO} C${n}` }) }
    m.db.errors.ab_tests = { code: 'XX000', message: `erro com ${SEGREDO}` }
    const r = await rodar(m)
    expect(r.abertas.nao_se_sabe).toBeGreaterThan(0)
    expect(m.ctx.falhas.length).toBeGreaterThan(0)
    expect(tudoTexto(m, r)).not.toContain(SEGREDO)
  })

  it('18. leitura das linhas acima do teto: nota, nenhuma derivação parcial', async () => {
    const m = mundo()
    const [a] = videos(m.db, 'c1', 1) as [string]
    m.db.tables.yt_own_video_meta_daily = Array.from({ length: 20_001 }, (_, i) => ({
      youtube_video_id: a, day_pt: dia(0), site_id: SITE, channel_id: 'c1', video_id: `u-${a}`, title_at_capture: 'x', description_sha256: 'h',
      thumbnail_dhash: H0, thumbnail_sha256_at_capture: 's', thumbnail_blob_url: null, privacy_status: 'public', captured_at: cap(dia(0)), n: i,
    }))
    m.db.tables.yt_own_video_meta_daily.unshift({ youtube_video_id: a, day_pt: dia(1), site_id: SITE, channel_id: 'c1', video_id: `u-${a}` })
    await rodar(m)
    expect(m.ctx.falhas).toContain('versões: Canal c1 tem linhas demais para uma execução')
    expect(aplicacoes(m.db)).toHaveLength(0)
    expect(versoes(m.db)).toHaveLength(0)
  })

  it('19. idas ao banco da primeira execução (35 vídeos, 2 canais, 13 dias): no máximo 43; uma leitura de texto por canal; uma do menor day_pt por canal sem estado', async () => {
    const m = mundo([canal('c1'), canal('c2')])
    for (const ch of ['c1', 'c2']) {
      const ids = videos(m.db, ch, 35)
      for (let n = 12; n >= 0; n--) for (const yt of ids) {
        if (n === 12) linha(m.db, ch, yt, dia(n), { priv: null, descTexto: 'Descrição guardada' })
        else linha(m.db, ch, yt, dia(n), { descTexto: 'Descrição guardada' })
      }
    }
    const leituras: Array<[string, string]> = []
    m.db.erroNaLeitura = (t, _n, colunas) => { leituras.push([t, colunas]); return undefined }
    const original = { from: m.db.client.from.bind(m.db.client), rpc: m.db.client.rpc.bind(m.db.client) }
    let idas = 0
    m.db.client.from = ((t: string) => { idas++; return original.from(t) }) as typeof m.db.client.from
    m.db.client.rpc = ((n: string, a?: Record<string, unknown>) => { idas++; return original.rpc(n, a) }) as typeof m.db.client.rpc
    const r = await rodar(m)
    expect(r.dias_derivados).toBe(26)
    expect(idas).toBeLessThanOrEqual(45) // A5 E18 P2 (Tarefa 5): eram 43; a leitura da cobertura soma 1 por canal
    expect(leituras.filter(([t, c]) => t === 'yt_own_video_meta_daily' && c.includes('description_text'))).toHaveLength(2)
    expect(leituras.filter(([t, c]) => t === 'yt_own_video_meta_daily' && c === 'day_pt')).toHaveLength(2)
    expect(versoes(m.db, { field: 'desc' })).toHaveLength(70)
    expect(versoes(m.db, { field: 'desc' }).every(v => v.value_text === 'Descrição guardada')).toBe(true)
    // execução seguinte, com estado: nenhuma leitura do menor day_pt
    leituras.length = 0
    await rodar(m)
    expect(leituras.filter(([t, c]) => t === 'yt_own_video_meta_daily' && c === 'day_pt')).toHaveLength(0)
  })

  describe('origem pela leitura do próprio passo', () => {
    const teste = (extra: Row = {}): Row => ({ id: 't1', youtube_video_id: 'u-c1-v1', test_type: 'title', paused_at: null, completed_at: null, completed_reason: null, winner_variant_id: null, winner_applied_at: null, original_title: `${SEGREDO} original`, ...extra })
    /** Canal com estado em dia(2), um vídeo; `dias` linhas (1 = dia(1)); troca de `campo` no primeiro dia. */
    function cenario(campo: 'title' | 'thumb' | 'ambos', dias: number[] = [1, 0]): { m: Mundo; a: string } {
      const m = mundo()
      const [a] = videos(m.db, 'c1', 1) as [string]
      estadoComCorrentes(m.db, 'c1', [a], dia(dias[0]! + 1))
      for (const n of dias) {
        const o: OpcDia = {}
        if (campo !== 'thumb') o.titulo = `${SEGREDO} titulo B`
        if (campo !== 'title') { o.dhash = H1; o.sha = 'sha-B'; o.blob = 'https://blob.test/b.jpg' }
        linha(m.db, 'c1', a, dia(n), o)
      }
      return { m, a }
    }
    const atual = (m: Mundo, field: string): Row => versoes(m.db, { field, is_current: true })[0]!

    it('20. vencedor pela leitura do passo; segundo teste manual_winner de combo com winner_applied_at nulo', async () => {
      const t = cenario('title')
      t.m.db.tables.ab_tests = [teste({ winner_applied_at: `${dia(1)}T20:00:00.000Z`, winner_variant_id: 'var-1' })]
      await rodar(t.m)
      expect(atual(t.m, 'title')).toMatchObject({ origin: 'ab_lab', ab_event: 'vencedor', ab_test_id: 't1', ab_variant_id: 'var-1' })
      const c = cenario('thumb')
      c.m.db.tables.ab_tests = [teste({ test_type: 'combo', completed_reason: 'manual_winner', winner_applied_at: null, completed_at: `${dia(1)}T20:00:00.000Z`, winner_variant_id: 'var-w' })]
      await rodar(c.m)
      expect(atual(c.m, 'thumb')).toMatchObject({ origin: 'ab_lab', ab_event: 'vencedor', ab_variant_id: 'var-w' })
    })

    it('21. restauro pela leitura do passo: pausa de combo na janela, título e thumbnail', async () => {
      const m = cenario('ambos')
      m.m.db.tables.ab_tests = [teste({ test_type: 'combo', paused_at: `${dia(1)}T20:00:00.000Z`, original_title: `${SEGREDO} titulo B` })]
      await rodar(m.m)
      expect(atual(m.m, 'title')).toMatchObject({ origin: 'ab_lab', ab_event: 'restauro' })
      expect(atual(m.m, 'thumb')).toMatchObject({ origin: 'ab_lab', ab_event: 'restauro' })
    })

    it('22. dia atrasado cujo ciclo já fechou: sai rotacao, não fora_do_sistema', async () => {
      const m = cenario('title', [2, 1, 0])
      m.m.db.tables.ab_tests = [teste()]
      m.m.db.tables.ab_test_cycles = [{ id: 'c-1', test_id: 't1', variant_id: 'var-3', started_at: `${dia(2)}T20:00:00.000Z`, ended_at: `${dia(1)}T05:00:00.000Z`, applied_metadata: { title_set: `${SEGREDO} titulo B` } }]
      await rodar(m.m)
      expect(atual(m.m, 'title')).toMatchObject({ origin: 'ab_lab', ab_event: 'rotacao', ab_variant_id: 'var-3' })
    })

    it('23. trocas em vídeos diferentes em dois dias da mesma execução: o segundo sai rotacao, e ab_tests é lido uma vez', async () => {
      const m = mundo()
      const [a, b] = videos(m.db, 'c1', 2) as [string, string]
      estadoComCorrentes(m.db, 'c1', [a, b], dia(2))
      linha(m.db, 'c1', a, dia(1), { titulo: `${SEGREDO} titulo B` }); linha(m.db, 'c1', b, dia(1))
      linha(m.db, 'c1', a, dia(0), { titulo: `${SEGREDO} titulo B` }); linha(m.db, 'c1', b, dia(0), { titulo: `${SEGREDO} titulo C` })
      m.db.tables.ab_tests = [teste({ id: 't9', youtube_video_id: `u-${b}` })]
      m.db.tables.ab_test_cycles = [{ id: 'c-9', test_id: 't9', variant_id: 'var-9', started_at: `${dia(0)}T22:00:00.000Z`, ended_at: null, applied_metadata: { title_set: `${SEGREDO} titulo C` } }]
      await rodar(m)
      const deB = versoes(m.db, { youtube_video_id: b, field: 'title', is_current: true })[0]!
      const deA = versoes(m.db, { youtube_video_id: a, field: 'title', is_current: true })[0]!
      expect(deB).toMatchObject({ origin: 'ab_lab', ab_event: 'rotacao' })
      expect(deA.origin).toBe('fora_do_sistema')
      expect(m.db.leituras.ab_tests).toBe(1)
    })

    it('31. origem incerta (inconclusive com ciclo de thumbnail na janela): nao_se_sabe com o teste, sem nota; auto_resolve sem vencedor aplicado: rotacao', async () => {
      const m = cenario('thumb')
      m.m.db.tables.ab_tests = [teste({ test_type: 'thumbnail', completed_reason: 'inconclusive', completed_at: `${dia(1)}T20:00:00.000Z` })]
      m.m.db.tables.ab_test_cycles = [{ id: 'c-1', test_id: 't1', variant_id: 'var-1', started_at: `${dia(1)}T18:00:00.000Z`, ended_at: null, applied_metadata: { thumbnail_set: true } }]
      const r = await rodar(m.m)
      expect(atual(m.m, 'thumb')).toMatchObject({ origin: 'nao_se_sabe', ab_event: null, ab_test_id: 't1' })
      expect(r.origem_ab_incerta).toBe(1)
      expect(m.m.ctx.falhas).toEqual([])
      const n = cenario('thumb')
      n.m.db.tables.ab_tests = [teste({ test_type: 'thumbnail', completed_reason: 'auto_resolve', winner_applied_at: null, completed_at: `${dia(1)}T20:00:00.000Z` })]
      n.m.db.tables.ab_test_cycles = [{ id: 'c-1', test_id: 't1', variant_id: 'var-1', started_at: `${dia(1)}T18:00:00.000Z`, ended_at: null, applied_metadata: { thumbnail_set: true } }]
      await rodar(n.m)
      expect(atual(n.m, 'thumb')).toMatchObject({ origin: 'ab_lab', ab_event: 'rotacao', ab_variant_id: 'var-1' })
    })

    it('32. limite inferior da leitura de ciclos: o de vídeo sem linha no intervalo não prende o mínimo', async () => {
      const m = mundo()
      const [a, y] = videos(m.db, 'c1', 2) as [string, string]
      estadoComCorrentes(m.db, 'c1', [a], dia(2))
      estadoComCorrentes(m.db, 'c1', [y], dia(200), SITE, dia(200)) // segunda chamada duplica o estado; só as correntes de y importam
      m.db.tables.yt_own_versions_state = [{ channel_id: 'c1', site_id: SITE, tracking_since: dia(200), derived_through: dia(2) }]
      linha(m.db, 'c1', a, dia(1), { titulo: `${SEGREDO} titulo B` }) // y não tem linha
      m.db.tables.ab_tests = [teste({ youtube_video_id: `u-${a}` })]
      const gte: unknown[][] = []
      const from = m.db.client.from.bind(m.db.client)
      m.db.client.from = ((t: string) => {
        const q = from(t)
        if (t === 'ab_test_cycles') { const g = q.gte.bind(q); q.gte = ((c: string, v: unknown) => { gte.push([c, v]); return g(c, v) }) as typeof q.gte }
        return q
      }) as typeof m.db.client.from
      await rodar(m)
      expect(gte).toEqual([['started_at', cap(dia(2))]])
    })

    // ── Emenda 15/10 (trava do A/B Lab): ab_test_restores e restore_status, casos 45b a 50 ─────────────────────────────
    const T20 = (n: number): string => `${dia(n)}T20:00:00.000Z`
    const combo = (extra: Row = {}): Row => teste({ test_type: 'combo', restore_status: {}, ...extra })
    const restauro = (extra: Row = {}): Row => ({ test_id: 't1', seq: 1, campo: 'thumbnail', destino: 'original', estado: 'ok', escreveu: true, em: T20(1), motivo: `${SEGREDO} motivo`, erro: `${SEGREDO} erro`, ...extra })
    const NOTA_LAB = 'versões: A/B Lab não pôde ser lido; origem de 1 troca(s) ficou sem resposta'

    it('46. histórico lido uma vez por canal, só com as 8 colunas, in(test_id) e janela alargada em 120 s; ab_tests ganha restore_status; sem teste ou sem troca, zero leitura; sem erro/motivo no resumo', async () => {
      const c = cenario('thumb')
      c.m.db.tables.ab_tests = [combo({ restore_status: { thumbnail: { estado: 'ok', destino: 'original', em: T20(1), erro: `${SEGREDO} erro`, motivo: `${SEGREDO} motivo` } }, paused_at: T20(1) })]
      c.m.db.tables.ab_test_restores = [restauro()]
      const leituras: Array<[string, string]> = []
      c.m.db.erroNaLeitura = (t, _n, colunas) => { leituras.push([t, colunas]); return undefined }
      const gte: Record<string, unknown> = {}
      const from = c.m.db.client.from.bind(c.m.db.client)
      c.m.db.client.from = ((t: string) => {
        const q = from(t)
        if (t === 'ab_test_cycles' || t === 'ab_test_restores') { const g = q.gte.bind(q); q.gte = ((col: string, v: unknown) => { gte[t] = v; return g(col, v) }) as typeof q.gte }
        return q
      }) as typeof c.m.db.client.from
      const r = await rodar(c.m)
      expect(atual(c.m, 'thumb')).toMatchObject({ origin: 'ab_lab', ab_event: 'restauro', ab_test_id: 't1' })
      expect(c.m.db.leituras.ab_test_restores).toBe(1)
      expect(leituras.filter(([t]) => t === 'ab_test_restores').map(([, col]) => col)).toEqual(['test_id, seq, campo, destino, estado, escreveu, em, iniciativa'])
      expect(leituras.find(([t]) => t === 'ab_tests')![1]).toContain('restore_status')
      expect(Date.parse(gte.ab_test_restores as string)).toBe(Date.parse(gte.ab_test_cycles as string) - 120_000)
      expect(tudoTexto(c.m, r)).not.toContain(SEGREDO)
      expect(JSON.stringify(r)).not.toMatch(/"(erro|motivo)"/)
      // vídeo sem teste: zero leitura do histórico
      const s = cenario('thumb')
      s.m.db.tables.ab_tests = [combo({ youtube_video_id: 'u-outro' })]
      await rodar(s.m)
      expect(s.m.db.leituras.ab_test_restores).toBeUndefined()
      // sem troca no dia: zero leitura
      const n = mundo()
      const [a] = videos(n.db, 'c1', 1) as [string]
      estadoComCorrentes(n.db, 'c1', [a], dia(1)); linha(n.db, 'c1', a, dia(0))
      n.db.tables.ab_tests = [combo()]
      await rodar(n)
      expect(n.db.leituras.ab_test_restores).toBeUndefined()
    })

    it('47. histórico com erro 42P01 e com exatamente 1.000 linhas: troca nao_se_sabe e a nota vermelha do caso 10', async () => {
      for (const modo of ['erro', 'mil'] as const) {
        const c = cenario('thumb')
        c.m.db.tables.ab_tests = [combo({ paused_at: T20(1) })]
        if (modo === 'erro') c.m.db.errors.ab_test_restores = { code: '42P01', message: 'relation does not exist' }
        else c.m.db.tables.ab_test_restores = Array.from({ length: 1000 }, (_, i) => restauro({ seq: i + 1 }))
        const r = await rodar(c.m)
        expect(atual(c.m, 'thumb').origin, modo).toBe('nao_se_sabe')
        expect(c.m.ctx.falhas, modo).toContain(NOTA_LAB)
        expect(r.abertas.nao_se_sabe, modo).toBe(1)
      }
    })

    it('48. histórico que não responde até o prazo: sem_tempo, como os ciclos, sem nota do Lab', async () => {
      const c = cenario('thumb')
      c.m.db.tables.ab_tests = [combo({ paused_at: T20(1) })]
      c.m.ctx.deadline = Date.now() + 1_800
      const from = c.m.db.client.from.bind(c.m.db.client)
      let pediu = false
      c.m.ctx.supabase = { from: (t: string) => (t === 'ab_test_restores' ? (pediu = true, { select: () => ({ in: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: () => semMais() }) }) }) }) }) }) : from(t)), rpc: c.m.db.client.rpc } as unknown as SupabaseClient
      const r = await rodar(c.m)
      expect(pediu).toBe(true)
      expect(r.sem_tempo).toBe(true)
      expect(c.m.ctx.falhas).not.toContain(NOTA_LAB)
    })

    it('45b. restore_status ilegível (em "now" ou estado desconhecido): Lab do canal ilegível, nao_se_sabe e a nota vermelha do caso 10', async () => {
      for (const rs of [{ thumbnail: { estado: 'em_andamento', em: 'now' } }, { thumbnail: { estado: 'em_andamento', em: '2026-10-12 08:02' } }, { thumbnail: { estado: 'xyz', em: T20(1) } }]) {
        const c = cenario('thumb')
        c.m.db.tables.ab_tests = [combo({ restore_status: rs })]
        await rodar(c.m)
        expect(atual(c.m, 'thumb').origin, JSON.stringify(rs)).toBe('nao_se_sabe')
        expect(c.m.ctx.falhas, JSON.stringify(rs)).toContain(NOTA_LAB)
      }
    })

    it('49. parada sem registro: uma nota por execução e origem_ab_sem_registro; escreveu nulo e em_andamento contam em origem_ab_incerta, sem nota', async () => {
      const c = cenario('ambos')
      c.m.db.tables.ab_tests = [combo({ paused_at: T20(1), original_title: `${SEGREDO} original` })]
      const r = await rodar(c.m)
      expect(r.origem_ab_sem_registro).toBe(2)
      expect(r.origem_ab_incerta).toBe(0)
      expect(c.m.ctx.falhas.filter(f => f.includes('sem registro de restauração'))).toEqual(['versões: 2 troca(s) com parada do A/B Lab sem registro de restauração'])
      expect(atual(c.m, 'thumb').origin).toBe('nao_se_sabe')
      expect(tudoTexto(c.m, r)).not.toContain(SEGREDO)
      const i = cenario('thumb')
      i.m.db.tables.ab_tests = [combo()]
      i.m.db.tables.ab_test_restores = [restauro({ escreveu: null, estado: 'falhou' })]
      const ri = await rodar(i.m)
      expect(ri.origem_ab_incerta).toBe(1)
      expect(ri.origem_ab_sem_registro).toBe(0)
      expect(i.m.ctx.falhas).toEqual([])
      const e = cenario('thumb')
      e.m.db.tables.ab_tests = [combo({ restore_status: { thumbnail: { estado: 'em_andamento', em: T20(1) } } })]
      const re = await rodar(e.m)
      expect(re.origem_ab_incerta).toBe(1)
      expect(e.m.ctx.falhas).toEqual([])
    })

    it('50. troca em dois dias da mesma execução: o Lab custa 3 idas no total (testes, ciclos, histórico), não por dia; caso 19 segue sem leitura do histórico', async () => {
      const m = mundo()
      const [a] = videos(m.db, 'c1', 1) as [string]
      estadoComCorrentes(m.db, 'c1', [a], dia(2))
      linha(m.db, 'c1', a, dia(1), { titulo: `${SEGREDO} titulo B` })
      linha(m.db, 'c1', a, dia(0), { titulo: `${SEGREDO} titulo C` })
      m.db.tables.ab_tests = [combo()]
      await rodar(m)
      expect([m.db.leituras.ab_tests, m.db.leituras.ab_test_cycles, m.db.leituras.ab_test_restores]).toEqual([1, 1, 1])
    })
  })

  describe('atraso, recuperação e prova', () => {
    /** Vídeo único, estado em `atrasoDesde` dias antes de ontem, uma linha por dia até ontem. */
    function atrasado(canalId: string, atrasoDias: number, m: Mundo = mundo(), comEstado = true): { m: Mundo; a: string } {
      const [a] = videos(m.db, canalId, 1) as [string]
      if (comEstado) estadoComCorrentes(m.db, canalId, [a], dia(atrasoDias))
      for (let n = comEstado ? atrasoDias - 1 : atrasoDias - 1; n >= 0; n--) linha(m.db, canalId, a, dia(n))
      return { m, a }
    }
    const cortaTempoNaChamada = (m: Mundo, quando: number): void => {
      const original = m.db.rpcHandlers.yt_own_versions_apply_day!
      let n = 0
      m.db.rpcHandlers.yt_own_versions_apply_day = (args) => { if (++n === quando) m.ctx.deadline = Date.now() + 1_000; return original(args) }
    }

    it('24. apply_day que não responde até o prazo: sem_tempo, o dia em dia_sem_resposta, sem nota de banco; depois ja_derivado segue; leitura muda: canal parado', async () => {
      const m = mundo([canal('c1')], 1_800)
      const [a] = videos(m.db, 'c1', 1) as [string]
      linha(m.db, 'c1', a, dia(0))
      m.db.rpcHandlers.yt_own_versions_apply_day = () => semMais()
      const r = await rodar(m)
      expect(r.sem_tempo).toBe(true)
      expect(r.dia_sem_resposta).toEqual([dia(0)])
      expect(r.dias_derivados).toBe(0)
      expect(m.ctx.falhas.some(f => f.includes('não gravou'))).toBe(false)
      // execução seguinte: a função devolve ja_derivado para esse dia
      const n = mundo([canal('c1')])
      videos(n.db, 'c1', 1); linha(n.db, 'c1', 'c1-v1', dia(0))
      n.db.rpcHandlers.yt_own_versions_apply_day = () => ({ data: { resultado: 'ja_derivado' }, error: null })
      const r2 = await rodar(n)
      expect(r2.ja_derivado).toBe(1)
      expect(n.ctx.falhas.some(f => f.includes('não gravou'))).toBe(false)
      // leitura que não responde
      const o = mundo([canal('c1')], 800)
      videos(o.db, 'c1', 1); linha(o.db, 'c1', 'c1-v1', dia(0))
      const from = o.db.client.from.bind(o.db.client)
      o.ctx.supabase = { from: (t: string) => (t === 'yt_own_video_meta_daily' ? { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => semMais() }) }) }) }) } : from(t)), rpc: o.db.client.rpc } as unknown as SupabaseClient
      const r3 = await rodar(o)
      expect(r3.sem_tempo).toBe(true)
      expect(o.ctx.falhas.some(f => f.includes('erro de banco'))).toBe(false)
    })

    it('25. recuperação: 2 dias derivados e sem tempo = recuperando; 1 dia = vermelho; parou por erro = vermelho; 40 dias fecham em duas execuções; 30 e 31 dias', async () => {
      // (a) fronteira 2 dias: sem tempo depois do segundo dia
      const a = atrasado('c1', 5)
      a.m.db.provaVersoes = { publicos: 1, sem_titulo: 0, sem_thumb: 0, sem_explicacao: 2, canais_com_linha_sem_estado: 0, derivado_ate: null, origem_cms: 0 }
      cortaTempoNaChamada(a.m, 2)
      const ra = await rodar(a.m)
      expect(ra.dias_derivados).toBe(2)
      expect(ra.recuperando).toEqual({ c1: 3 })
      expect(a.m.ctx.falhas).toEqual([])
      // (b) fronteira 1 dia
      const b = atrasado('c1', 5)
      cortaTempoNaChamada(b.m, 1)
      const rb = await rodar(b.m)
      expect(rb.dias_derivados).toBe(1)
      expect(rb.recuperando).toEqual({})
      expect(b.m.ctx.falhas).toContain(`versões: Canal c1 conferido até ${dia(4)}, 4 dias de atraso`)
      // (c) parou por erro
      const c = atrasado('c1', 5)
      const original = c.m.db.rpcHandlers.yt_own_versions_apply_day!
      let n = 0
      c.m.db.rpcHandlers.yt_own_versions_apply_day = (args) => (++n === 3 ? { data: null, error: { code: 'XX000', message: 'x' } } : original(args))
      const rc = await rodar(c.m)
      expect(rc.recuperando).toEqual({})
      expect(c.m.ctx.falhas.some(f => f.includes('dias de atraso'))).toBe(true)
      // (d) 40 dias sem estado, tempo de sobra: deriva 30, para no teto, recuperando 10, sem nota; a seguinte fecha
      const d = atrasado('c1', 40, mundo(), false)
      const rd = await rodar(d.m)
      expect(rd.dias_derivados).toBe(30)
      expect(rd.sem_tempo).toBe(false)
      expect(rd.recuperando).toEqual({ c1: 10 })
      expect(d.m.ctx.falhas).toEqual([])
      const rd2 = await rodar(d.m)
      expect(rd2.atraso_dias).toEqual({ c1: 0 })
      expect(rd2.recuperando).toEqual({})
      // (e) fronteira 30 e 31 dias acumulados
      const e30 = atrasado('c1', 30, mundo(), false)
      const r30 = await rodar(e30.m)
      expect(r30.atraso_dias).toEqual({ c1: 0 })
      expect(r30.recuperando).toEqual({})
      const e31 = atrasado('c1', 31, mundo(), false)
      const r31 = await rodar(e31.m)
      expect(r31.atraso_dias).toEqual({ c1: 1 })
      expect(r31.recuperando).toEqual({})
      expect(e31.m.ctx.falhas).toEqual([])
    })

    it('26. recusa por message: touch_recusado entra na nota; texto do Postgres com título vira erro_desconhecido e não aparece', async () => {
      for (const [message, esperado] of [['touch_recusado', 'touch_recusado'], [`duplicate key value violates … "${SEGREDO} titulo"`, 'erro_desconhecido']] as const) {
        const m = mundo()
        const [a] = videos(m.db, 'c1', 1) as [string]
        linha(m.db, 'c1', a, dia(0))
        m.db.errors['rpc:yt_own_versions_apply_day'] = { code: 'P0001', message }
        const r = await rodar(m)
        expect(m.ctx.falhas).toContain(`versões: Canal c1 não gravou o dia ${dia(0)} (${esperado})`)
        expect(tudoTexto(m, r)).not.toContain(SEGREDO)
      }
    })

    it('27. canais_com_linha_sem_estado, sem_videos por data de publicação e privacidade conhecida lida uma vez por canal', async () => {
      const base = { publicos: 1, sem_titulo: 0, sem_thumb: 0, sem_explicacao: 0, canais_com_linha_sem_estado: 1, derivado_ate: null, origem_cms: 0 }
      const x = atrasado('c1', 1, mundo(), false); x.m.db.provaVersoes = base
      await rodar(x.m)
      expect(x.m.ctx.falhas).toContain('versões: 1 canal(is) com linha diária e sem estado de derivação')
      // com sem_tempo e sem canal em recuperando: dá nota
      const y = atrasado('c1', 3); y.m.db.provaVersoes = base; cortaTempoNaChamada(y.m, 1)
      const ry = await rodar(y.m)
      expect(ry.sem_tempo).toBe(true)
      expect(y.m.ctx.falhas).toContain('versões: 1 canal(is) com linha diária e sem estado de derivação')
      // com outro canal do site em recuperando: não dá
      const z = mundo([canal('c1'), canal('c2')]); atrasado('c1', 5, z); z.m
      videos(z.db, 'c2', 0)
      z.db.provaVersoes = base; cortaTempoNaChamada(z, 2)
      const rz = await rodar(z)
      expect(rz.recuperando.c1).toBeDefined()
      expect(z.ctx.falhas.some(f => f.includes('sem estado de derivação'))).toBe(false)
      // vídeo com published_at nulo ou posterior ao fim de ontem, sem linha: sem_videos, nenhuma nota
      const w = mundo()
      ;(w.db.tables.youtube_videos ??= []).push(
        { id: 'u-a', youtube_video_id: 'a', channel_id: 'c1', site_id: SITE, published_at: null },
        { id: 'u-b', youtube_video_id: 'b', channel_id: 'c1', site_id: SITE, published_at: `${addDays(ONTEM, 3)}T00:00:00.000Z` },
      )
      const rw = await rodar(w)
      expect(rw.sem_videos).toEqual(['c1'])
      expect(w.ctx.falhas).toEqual([])
      // linha sem privacidade e com dHash de vídeo cuja linha anterior era private: thumbnail pulada; leitura da privacidade uma vez por canal
      const p = mundo()
      const ids = videos(p.db, 'c1', 2)
      estadoComCorrentes(p.db, 'c1', ids, dia(3))
      for (const yt of ids) { linha(p.db, 'c1', yt, dia(4), { priv: 'private' }); linha(p.db, 'c1', yt, dia(2), { priv: null, dhash: H1 }); linha(p.db, 'c1', yt, dia(1), { priv: null, dhash: H1 }) }
      let leiturasPriv = 0
      p.db.erroNaLeitura = (_t, _n, c) => { if (c === 'youtube_video_id, day_pt, privacy_status') leiturasPriv++; return undefined }
      const rp = await rodar(p)
      expect(leiturasPriv).toBe(1)
      expect(rp.pulados.privado).toBe(4)
      expect(versoes(p.db, { field: 'thumb', is_current: true }).every(v => v.thumb_dhash === H0)).toBe(true)
    })

    it('28. o passo que lança (fato duplicado): a mensagem não contém título de vídeo', async () => {
      const m = mundo()
      const [a] = videos(m.db, 'c1', 1) as [string]
      linha(m.db, 'c1', a, dia(0)); linha(m.db, 'c1', a, dia(0))
      const erro = await rodar(m).then(() => null, (e: unknown) => (e instanceof Error ? e.message : String(e)))
      expect(erro).not.toBeNull()
      expect(erro).not.toContain(SEGREDO)
    })

    it('29. canal sem estado e sem tempo: nota de atraso; recuperando sem nota; atraso desconhecido vermelho, e só resumo se outro canal recupera', async () => {
      // (a) o tempo acaba depois da leitura do menor day_pt e antes do primeiro dia
      const a = atrasado('c1', 5, mundo([canal('c1')], 1_000), false)
      const ra = await rodar(a.m)
      expect(ra.sem_tempo).toBe(true)
      expect(a.m.ctx.falhas).toContain(`versões: Canal c1 conferido até ${dia(5)}, 5 dias de atraso`)
      // (b) 2 dias derivados e sem_tempo: recuperando
      const b = atrasado('c1', 5, mundo(), false); cortaTempoNaChamada(b.m, 2)
      const rb = await rodar(b.m)
      expect(rb.recuperando.c1).toBeDefined()
      expect(b.m.ctx.falhas).toEqual([])
      // (c) a leitura do estado de c2 não volta até o prazo; c1 em dia
      const c = mundo([canal('c1'), canal('c2')])
      const [v1] = videos(c.db, 'c1', 1) as [string]
      estadoComCorrentes(c.db, 'c1', [v1], ONTEM)
      const from = c.db.client.from.bind(c.db.client)
      c.ctx.deadline = Date.now() + 600
      let leituraEstado = 0
      c.ctx.supabase = { from: (t: string) => (t === 'yt_own_versions_state' && ++leituraEstado === 2 ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => semMais() }) }) }) } : from(t)), rpc: c.db.client.rpc } as unknown as SupabaseClient
      const rc = await rodar(c)
      expect(rc.atraso_desconhecido).toEqual(['c2'])
      expect(c.ctx.falhas).toContain('versões: 1 canal(is) sem tempo para saber o atraso')
      // (d) o mesmo com c1 em recuperando
      const d = mundo([canal('c1'), canal('c2')])
      atrasado('c1', 5, d)
      cortaTempoNaChamada(d, 2)
      const from2 = d.db.client.from.bind(d.db.client)
      let le = 0
      d.ctx.supabase = { from: (t: string) => (t === 'yt_own_versions_state' && ++le === 2 ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => semMais() }) }) }) } : from2(t)), rpc: d.db.client.rpc } as unknown as SupabaseClient
      const rd = await rodar(d)
      expect(rd.recuperando.c1).toBeDefined()
      expect(rd.atraso_desconhecido).toEqual(['c2'])
      expect(d.ctx.falhas.some(f => f.includes('sem tempo para saber o atraso'))).toBe(false)
    })

    it('30. prova sem resposta até o prazo: "sem_tempo" no resumo do site; nota fora da recuperação, nenhuma dentro', async () => {
      const m = mundo([canal('c1')], 800)
      const [a] = videos(m.db, 'c1', 1) as [string]
      estadoComCorrentes(m.db, 'c1', [a], ONTEM)
      m.db.rpcHandlers.yt_own_versions_prova = () => semMais()
      const r = await rodar(m)
      expect(r.prova[SITE]).toBe('sem_tempo')
      expect(r.sem_tempo).toBe(true)
      expect(m.ctx.falhas).toContain('critérios: não foi possível avaliar a prova das versões')
      // dentro de uma recuperação
      const n = atrasado('c1', 5)
      cortaTempoNaChamada(n.m, 2)
      const original = n.m.db.rpcHandlers.yt_own_versions_prova!
      n.m.db.rpcHandlers.yt_own_versions_prova = (a2) => (n.m.ctx.deadline - Date.now() < 1_100 ? semMais() : original(a2))
      const rn = await rodar(n.m)
      expect(rn.recuperando.c1).toBeDefined()
      expect(rn.prova[SITE]).toBe('sem_tempo')
      expect(n.m.ctx.falhas).toEqual([])
    })
  })

  // Emenda 15/10 (dono): o número de canais próprios é N (canais com linha diária), nunca uma constante do produto.
  describe.each([1, 2, 3])('N canais próprios = %i', (N) => {
    const ids = Array.from({ length: N }, (_, i) => `c${i + 1}`)
    it('188 por N: linhas de base = vídeos × campos, zero trocas, derived_through = ontem em cada canal', async () => {
      const VIDEOS = 4
      const m = mundo(ids.map(i => canal(i)))
      for (const ch of ids) {
        const yts = videos(m.db, ch, VIDEOS)
        for (let n = 2; n >= 0; n--) for (const yt of yts) linha(m.db, ch, yt, dia(n), n === 2 ? { priv: null } : {})
      }
      const r = await rodar(m)
      expect(r.abertas).toEqual({ linha_de_base: N * VIDEOS * 3, ab_lab: 0, fora_do_sistema: 0, nao_se_sabe: 0 })
      expect(versoes(m.db)).toHaveLength(N * VIDEOS * 3)
      for (const ch of ids) expect(estadoDe(m.db, ch)).toBe(ONTEM)
      expect(m.ctx.falhas).toEqual([])
    })
    it('27 por N: canais_com_linha_sem_estado = N dá a nota com N; zero não dá nota', async () => {
      const base = { publicos: 1, sem_titulo: 0, sem_thumb: 0, sem_explicacao: 0, canais_com_linha_sem_estado: N, derivado_ate: null, origem_cms: 0 }
      const m = mundo(ids.map(i => canal(i)))
      m.db.provaVersoes = base
      await rodar(m)
      expect(m.ctx.falhas).toContain(`versões: ${N} canal(is) com linha diária e sem estado de derivação`)
      const z = mundo(ids.map(i => canal(i)))
      z.db.provaVersoes = { ...base, canais_com_linha_sem_estado: 0 }
      await rodar(z)
      expect(z.ctx.falhas.some(f => f.includes('sem estado de derivação'))).toBe(false)
    })
  })
})

// ── A5 E18 parte 2, Tarefa 5: a cobertura de metadados entra na derivação (item 202) ─────────────────────────────────────────
function cobre(db: FakeDb, ch: string, yt: string, de: string, ate: string, site = SITE, conjuntos: Array<'meta_texto' | 'meta_thumb'> = ['meta_texto', 'meta_thumb']): void {
  for (const metric_set of conjuntos) {
    ;(db.tables.yt_own_video_coverage ??= []).push({ site_id: site, channel_id: ch, youtube_video_id: yt, metric_set, covered_from: de, covered_to: ate, source: 'data_api' })
  }
}
const correntesDe = (db: FakeDb, yt: string): Row[] => versoes(db, { youtube_video_id: yt, is_current: true })
const leiturasDe = (m: Mundo): Array<[string, string]> => {
  const out: Array<[string, string]> = []
  m.db.erroNaLeitura = (t, _n, colunas) => { out.push([t, colunas]); return undefined }
  return out
}

describe('passoVersoes: cobertura de metadados (E18 P2, Tarefa 5)', () => {
  /** Estado derivado até dia(3), a última linha real em dia(3) (fora do intervalo), dias dia(2) e dia(1) cobertos e sem linha. */
  function cena(comLinhaOntem = true): { m: Mundo; v: string } {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3))
    linha(m.db, 'c1', v, dia(3))
    if (comLinhaOntem) linha(m.db, 'c1', v, dia(0))
    cobre(m.db, 'c1', v, dia(2), comLinhaOntem ? dia(1) : dia(0))
    return { m, v }
  }

  it('1. dia normal: uma leitura de cobertura por canal e nenhuma leitura de última linha', async () => {
    const m = mundo([canal('c1'), canal('c2')])
    for (const ch of ['c1', 'c2']) {
      const ids = videos(m.db, ch, 3)
      for (let n = 2; n >= 0; n--) for (const yt of ids) linha(m.db, ch, yt, dia(n))
      for (const yt of ids) cobre(m.db, ch, yt, dia(2), dia(0))
    }
    const leituras = leiturasDe(m)
    const r = await rodar(m)
    expect(r.cobertura_meta).toBe('lida')
    expect(r.cobertos_sem_linha).toBe(0)
    expect(leituras.filter(([t]) => t === 'yt_own_video_coverage')).toHaveLength(2)
    expect(leituras.filter(([t, c]) => t === 'yt_own_video_meta_daily' && c.includes('thumbnail_blob_url'))).toHaveLength(2) // só a leitura do intervalo
    expect(m.ctx.falhas).toEqual([])
  })

  it('2. tabela de cobertura ausente: deriva pelas linhas, cobertura_meta schema_ausente, nenhuma nota (dado ausente)', async () => {
    const { m } = cena()
    m.db.errors.yt_own_video_coverage = { code: '42P01', message: 'relation "yt_own_video_coverage" does not exist' }
    const r = await rodar(m)
    expect(r.cobertura_meta).toBe('schema_ausente')
    expect(r.dias_derivados).toBeGreaterThan(0)
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
    expect(m.ctx.falhas.filter(f => f.includes('yt_own_video_coverage'))).toEqual([]) // sem a tabela nada pode ter sido apagado: nenhuma nota dela
    expect(m.ctx.falhas).toEqual([`versões: Canal c1 sem nenhuma linha diária em ${dia(2)}`, `versões: Canal c1 sem nenhuma linha diária em ${dia(1)}`]) // os buracos de hoje, como antes
  })

  it('3. erro ao ler a cobertura: deriva pelas linhas e dá nota vermelha de erro de banco', async () => {
    const { m } = cena()
    m.db.errors.yt_own_video_coverage = { code: '57014', message: `statement timeout ${SEGREDO}` }
    const r = await rodar(m)
    expect(r.cobertura_meta).toBe('erro')
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
    expect(m.ctx.falhas).toEqual(['erro de banco ao ler yt_own_video_coverage', `versões: Canal c1 sem nenhuma linha diária em ${dia(2)}`, `versões: Canal c1 sem nenhuma linha diária em ${dia(1)}`])
    expect(tudoTexto(m, r)).not.toContain(SEGREDO)
  })

  it('4. cobertura sem resposta até o prazo: o canal para com sem_tempo, sem nota de erro de banco', async () => {
    const { m } = cena()
    const from = m.db.client.from.bind(m.db.client)
    const nunca = (): unknown => new Proxy({}, { get: (_t, k) => (k === 'then' ? () => undefined : () => nunca()) })
    m.ctx.supabase = { from: (t: string) => (t === 'yt_own_video_coverage' ? nunca() : from(t)), rpc: m.db.client.rpc } as unknown as SupabaseClient
    m.ctx.deadline = Date.now() + 1_700
    const r = await rodar(m)
    expect(r.sem_tempo).toBe(true)
    expect(aplicacoes(m.db)).toHaveLength(0)
    expect(m.ctx.falhas.some(f => f.includes('erro de banco'))).toBe(false)
  })

  it('5. dia coberto e sem linha: a versão corrente é confirmada (last_day_pt = o dia), last_seen_at não muda, cobertos_sem_linha conta', async () => {
    const { m, v } = cena(false) // dia(2), dia(1) e dia(0) cobertos, nenhuma linha real depois de dia(3)
    const r = await rodar(m)
    expect(r.dias_derivados).toBe(3)
    expect(r.cobertos_sem_linha).toBe(3)
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
    const cur = correntesDe(m.db, v)
    expect(cur).toHaveLength(3)
    expect(cur.every(x => x.last_day_pt === ONTEM)).toBe(true)
    expect(cur.every(x => x.last_seen_at === cap(dia(3)))).toBe(true) // o instante da última linha real
    expect(versoes(m.db)).toHaveLength(3) // nenhuma versão nova
    expect(m.ctx.falhas).toEqual([])
  })

  it('6. dia sem linha e sem cobertura: nada é confirmado para o vídeo (o caso de hoje)', async () => {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3))
    linha(m.db, 'c1', v, dia(3))
    linha(m.db, 'c1', v, dia(0))
    const r = await rodar(m)
    expect(r.dias_sem_linha).toBe(2)
    expect(r.cobertos_sem_linha).toBe(0)
    expect(aplicacoes(m.db).map(c => c.args.p_day)).toEqual([ONTEM])
  })

  it('7. fato repetido que abriria versão: canal parado, nota vermelha, apply_day não é chamada', async () => {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3)) // correntes com o título A
    linha(m.db, 'c1', v, dia(3), { titulo: `${SEGREDO} titulo B` }) // a última linha guardada tem outro título: a cópia abriria versão
    cobre(m.db, 'c1', v, dia(2), dia(0))
    const r = await rodar(m)
    expect(m.ctx.falhas).toContain(`versões: Canal c1 abriria versão em dia sem linha (${dia(2)})`)
    expect(aplicacoes(m.db)).toHaveLength(0)
    expect(estadoDe(m.db, 'c1')).toBe(dia(3))
    expect(tudoTexto(m, r)).not.toContain(SEGREDO)
  })

  it('8. leitura da última linha passa do teto: nota "linhas demais" e os vídeos ficam sem fato', async () => {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3))
    m.db.tables.yt_own_video_meta_daily = Array.from({ length: 20_001 }, (_, i) => ({
      youtube_video_id: v, day_pt: dia(10), site_id: SITE, channel_id: 'c1', video_id: `u-${v}`, title_at_capture: 'x', description_sha256: 'h',
      thumbnail_dhash: H0, thumbnail_sha256_at_capture: 's', thumbnail_blob_url: null, privacy_status: 'public', captured_at: cap(dia(10)), n: i,
    }))
    cobre(m.db, 'c1', v, dia(2), dia(1))
    linha(m.db, 'c1', v, dia(0))
    await rodar(m)
    expect(m.ctx.falhas).toContain('versões: Canal c1 tem linhas demais para uma execução')
    expect(aplicacoes(m.db).map(c => c.args.p_day)).toEqual([ONTEM]) // dia(2) e dia(1): sem fato, nada confirmado
  })

  it('9. mutação de canal e de site: cobertura de outro canal ou de outro site, do mesmo vídeo, não vira fato', async () => {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3))
    linha(m.db, 'c1', v, dia(3))
    linha(m.db, 'c1', v, dia(0))
    cobre(m.db, 'c9', v, dia(2), dia(1)) // outro canal, mesmo site
    cobre(m.db, 'c1', v, dia(2), dia(1), OUTRO_SITE) // mesmo canal, outro site
    const r = await rodar(m)
    expect(r.cobertos_sem_linha).toBe(0)
    expect(r.dias_sem_linha).toBe(2)
    expect(aplicacoes(m.db).map(c => c.args.p_day)).toEqual([ONTEM])
  })

  it('10. cobertura só de texto: a cópia vem sem dHash e não confirma a thumbnail como vista', async () => {
    const m = mundo()
    const [v] = videos(m.db, 'c1', 1) as [string]
    estadoComCorrentes(m.db, 'c1', [v], dia(3))
    linha(m.db, 'c1', v, dia(3))
    cobre(m.db, 'c1', v, dia(2), dia(0), SITE, ['meta_texto'])
    const r = await rodar(m)
    expect(r.cobertos_sem_linha).toBe(3)
    expect(estadoDe(m.db, 'c1')).toBe(ONTEM)
    expect(versoes(m.db)).toHaveLength(3)
    expect(m.ctx.falhas).toEqual([])
  })
})
