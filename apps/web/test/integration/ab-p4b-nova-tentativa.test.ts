import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, insertAuthUser } from '../helpers/db-seed'
import { YouTubeFalso, imagemComDhash, H } from '../helpers/youtube-falso'

// P4b T3: novaTentativa contra o bythiago_int. Reais: ab_settle_claim, o CHECK do restore_status, o gatilho do
// histórico, o CAS por restore_seq e a consulta da cadeia do "sim". Dublês: o YouTube (fetch), o token, o canal, o aviso.
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdminsDetailed: vi.fn(async () => ({ total: 1, sent: 1, suppressed: 0, errors: [] })),
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn(async () => ({ accessToken: 'tok' })) }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: vi.fn(async () => 'UCint'),
}))

import { novaTentativa } from '@/lib/youtube/ab-settle'
import type { PortasSaida } from '@/lib/youtube/ab-settle'
import { faseDriftEInterrompidos } from '@/lib/youtube/ab-watchdog-drift'
import { faseNovaTentativa } from '@/lib/youtube/ab-watchdog-nova-tentativa'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { claimAlert } from '@/lib/ops/alert-state'
import { dispensarCampos, tentarAgora } from '@/lib/youtube/ab-restore-acoes'

const HORA = 3_600_000
const iso = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString()
const ERRO = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
const campo = (extra: Record<string, unknown> = {}) => ({ estado: 'falhou', destino: 'original', em: iso(-HORA), forcado: false, escreveu: false, erro: ERRO, attempts: 1, ...extra })

type Semente = { testId: string; varA: string; varB: string; siteId: string }

describe.skipIf(skipIfNoLocalDb())('P4b T3: novaTentativa no banco real', () => {
  const db = clienteServico()
  let yt: YouTubeFalso
  let portas: Partial<PortasSaida>

  async function semear(status: string, restoreStatus: unknown | ((t: Semente) => unknown), seq = 1): Promise<Semente> {
    const t = await semearTesteAb({ status: 'active', cicloAberto: null, testType: 'title' })
    await db.from('ab_test_variants').update({ title_text: 'Título A' }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ title_text: 'Título B' }).eq('id', t.varB)
    const r = await db.from('ab_tests').update({ original_title: 'Título A', status, restore_seq: seq, restore_status: typeof restoreStatus === 'function' ? restoreStatus(t) : restoreStatus }).eq('id', t.testId)
    if (r.error) throw new Error(`semear: ${r.error.message}`)
    return t
  }
  const teste = async (t: Semente) => (await db.from('ab_tests').select('status, restore_seq, restore_status, paused_at, completed_at').eq('id', t.testId).single()).data!
  const linhas = async (t: Semente) => (await db.from('ab_test_restores').select('seq, campo, estado, attempts').eq('test_id', t.testId).order('seq')).data ?? []
  const vigia = (t: Semente) => ({ siteId: t.siteId, origem: 'vigia' as const })

  beforeEach(async () => {
    vi.clearAllMocks()
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.A), titulo: 'Título B', blobs: {} })
    portas = { supabase: db, fetch: yt.fetch, agora: () => new Date(), token: async () => 'tok', autoImportWinner: async () => {} }
  })

  it('completed, title falhou attempts 1, YouTube recusa → falhou/2, linha nova no histórico, completed_at e paused_at intactos, nenhum ciclo', async () => {
    const t = await semear('completed', { title: campo() })
    const antes = await teste(t)
    yt.recusar('videos.update', 403, 'forbidden')
    expect((await novaTentativa(t.testId, vigia(t), portas)).resultado).toBe('feito')
    const depois = await teste(t)
    expect(depois.restore_status).toMatchObject({ title: { estado: 'falhou', attempts: 2 } })
    expect(depois.restore_seq).toBe(antes.restore_seq + 1)
    expect(depois.completed_at).toBe(antes.completed_at)
    expect(depois.paused_at).toBe(antes.paused_at)
    expect(await linhas(t)).toEqual([
      { seq: 1, campo: 'title', estado: 'falhou', attempts: 1 },
      { seq: 2, campo: 'title', estado: 'falhou', attempts: 2 },
    ])
    expect((await db.from('ab_test_cycles').select('id').eq('test_id', t.testId)).data).toHaveLength(0)
  })

  it('archived com falhou → tentado (status continua archived)', async () => {
    const t = await semear('archived', { title: campo() })
    expect((await novaTentativa(t.testId, vigia(t), portas)).resultado).toBe('feito')
    expect(await teste(t)).toMatchObject({ status: 'archived', restore_status: { title: { estado: 'ok' } } })
    expect(yt.escritas()).toEqual(['videos.update'])
  })

  it('PODE-1 no banco: em_andamento de 3 min → o histórico ganha a linha falhou/escreveu null com o em antigo', async () => {
    const em = iso(-3 * 60_000)
    const t = await semear('completed', { title: campo({ estado: 'em_andamento', escreveu: null, erro: null, em, attempts: 0 }), thumbnail: campo({ em: iso(-2 * HORA), destino: 'original' }) })
    // o teste é de título: o thumbnail não entra na tentativa; o objetivo é só a conversão antes da reivindicação
    await db.from('ab_tests').update({ test_type: 'combo' }).eq('id', t.testId)
    await novaTentativa(t.testId, { siteId: t.siteId, origem: 'vigia' }, portas)
    const h = (await db.from('ab_test_restores').select('seq, campo, estado, escreveu, erro, em').eq('test_id', t.testId).eq('campo', 'title').order('seq')).data!
    expect(h[0]).toMatchObject({ estado: 'falhou', escreveu: null, erro: 'interrompido' })
    expect(Date.parse(h[0]!.em)).toBe(Date.parse(em))
  })

  it('vigia reivindica, a tentativa trava, a conversão e a tentativa seguinte contam: attempts 1→2 e na terceira desistiu/tres_falhas (F1/Y-1)', async () => {
    const t = await semear('completed', { title: campo() })
    const trava = { on: false }
    const quebrado = new Proxy(db, {
      get(alvo, chave) {
        if (chave === 'from') return (tabela: string) => { if (trava.on && tabela === 'ab_tests') throw new Error('trava'); return alvo.from(tabela) }
        if (chave === 'rpc') return async (...a: Parameters<SupabaseClient['rpc']>) => { const r = await alvo.rpc(...a); if (a[0] === 'ab_settle_claim') trava.on = true; return r }
        const v: unknown = Reflect.get(alvo, chave)
        return typeof v === 'function' ? v.bind(alvo) : v
      },
    })
    await expect(novaTentativa(t.testId, vigia(t), { ...portas, supabase: quebrado })).rejects.toThrow('trava')
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'em_andamento', attempts: 1 } })
    const envelhecer = async () => {
      const rs = (await teste(t)).restore_status as Record<string, Record<string, unknown>>
      await db.from('ab_tests').update({ restore_status: { title: { ...rs.title, em: iso(-20 * 60_000) } } }).eq('id', t.testId)
    }
    const converter = () => faseDriftEInterrompidos(db, { agora: () => Date.now(), inicio: Date.now() }, yt.fetch)
    await envelhecer(); await converter()
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'falhou', attempts: 2, erro: 'interrompido' } })
    trava.on = false // segunda rodada travando: 2 → em_andamento(2) → convertido desistiu com 3
    await expect(novaTentativa(t.testId, vigia(t), { ...portas, supabase: quebrado })).rejects.toThrow('trava')
    await envelhecer(); await converter()
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 } })
  })

  it('cadeia do sim lida do banco: duas linhas forcado true (50 h e 1 h) → não força', async () => {
    const t = await semear('completed', (x) => ({ title: campo({ forcado: true, destino: x.varB, em: iso(-50 * HORA) }) }))
    await db.from('ab_tests').update({ restore_seq: 2, restore_status: { title: campo({ forcado: true, destino: t.varB, em: iso(-HORA) }) } }).eq('id', t.testId)
    expect((await linhas(t)).filter((l) => l.campo === 'title')).toHaveLength(2)
    yt.titulo = 'Editado no Studio'
    await novaTentativa(t.testId, vigia(t), portas)
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'pulado_drift' } })
    expect(yt.escritas()).toEqual([])
  })

  it('retryRestore e vigia simultâneos → uma reivindicação vence, a outra em_andamento; uma escrita no YouTube (P4b-I5)', async () => {
    const t = await semear('completed', { title: campo() })
    const [a, b] = await Promise.all([
      novaTentativa(t.testId, { siteId: t.siteId, origem: 'humano' }, portas),
      novaTentativa(t.testId, vigia(t), portas),
    ])
    const r = [a.resultado, b.resultado]
    expect(r).toContain('feito')
    expect(['em_andamento', 'ja_encerrado']).toContain(r.find((x) => x !== 'feito'))
    expect(yt.escritas()).toHaveLength(1)
  })
})

describe.skipIf(skipIfNoLocalDb())('P4b T4: a fase nova do vigia no banco real', () => {
  const db = clienteServico()
  const fanOut = vi.mocked(fanOutToSiteAdminsDetailed)
  let yt: YouTubeFalso

  async function semear(testType: 'title' | 'combo', status: string, restoreStatus: unknown | ((t: Semente) => unknown), seq = 1): Promise<Semente> {
    const t = await semearTesteAb({ status: 'active', cicloAberto: null, testType })
    await db.from('ab_test_variants').update({ title_text: 'Título A' }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ title_text: 'Título B' }).eq('id', t.varB)
    const r = await db.from('ab_tests').update({ original_title: 'Título A', status, restore_seq: seq, restore_status: typeof restoreStatus === 'function' ? restoreStatus(t) : restoreStatus }).eq('id', t.testId)
    if (r.error) throw new Error(`semear: ${r.error.message}`)
    return t
  }
  const teste = async (t: Semente) => (await db.from('ab_tests').select('status, restore_seq, restore_status').eq('id', t.testId).single()).data!
  const relogio = () => ({ agora: () => Date.now(), inicio: Date.now() })
  const chaves = () => fanOut.mock.calls.map((c) => (c[0] as { dedupKey: string }).dedupKey)
  const mensagens = () => fanOut.mock.calls.map((c) => (c[0] as { message: string }).message)

  beforeEach(async () => {
    vi.clearAllMocks()
    fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    // a fase lê o banco inteiro: sobras de outros testes (campo falhou) saem do caminho
    await db.from('ab_tests').update({ restore_status: {} }).or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.A), titulo: 'Título B', blobs: {} })
  })

  it('P4b-I1 inteiro: falhou/1 → vigia: falhou/2 com 1 escrita → vigia: desistiu/tres_falhas/3 e o aviso da chave de desistiu', async () => {
    const t = await semear('title', 'completed', { title: campo() })
    yt.recusar('videos.update', 403, 'forbidden')
    const a = await faseNovaTentativa(db, relogio(), yt.fetch)
    expect(a).toMatchObject({ tentadas: 1, falharam: 1 })
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'falhou', attempts: 2 } })
    expect(yt.escritas()).toHaveLength(1)
    const b = await faseNovaTentativa(db, relogio(), yt.fetch)
    expect(b).toMatchObject({ tentadas: 1, desistiram: 1 })
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 } })
    expect(chaves().some((k) => k.startsWith(`ab-restore-desistiu:${t.testId}:title:`))).toBe(true)
    expect(mensagens().some((m) => m.includes('falhou 3 vezes e parou'))).toBe(true)
  })

  it('aviso diário: a chave ab-restore:<id> reivindicada vale 20 h (19 h 59 min ainda gasta, 20 h 01 min livre)', async () => {
    const t = await semear('title', 'completed', { title: campo() })
    const chave = `ab-restore:${t.testId}`
    expect(await claimAlert(db, chave, '20 hours')).toBe(true)
    const volta = async (ms: number) => { await db.from('ops_alert_state').update({ last_at: new Date(Date.now() - ms).toISOString() }).eq('key', chave) }
    await volta(20 * HORA - 60_000)
    expect(await claimAlert(db, chave, '20 hours')).toBe(false)
    await volta(20 * HORA + 60_000)
    expect(await claimAlert(db, chave, '20 hours')).toBe(true)
  })

  it('P4b-I10: T1 completed (falhou, forcado) e T2 active no mesmo vídeo → nenhuma escrita, T1 igual', async () => {
    const t1 = await semear('title', 'completed', { title: campo({ forcado: true }) })
    const t1Linha = (await db.from('ab_tests').select('site_id, youtube_video_id').eq('id', t1.testId).single()).data!
    const ins = await db.from('ab_tests').insert({ site_id: t1Linha.site_id, youtube_video_id: t1Linha.youtube_video_id, name: 'T2', status: 'active', test_type: 'title', original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg', config: { max_duration_days: 14, rotation_pattern: 'abba' } })
    expect(ins.error).toBeNull()
    const antes = await teste(t1)
    const r = await faseNovaTentativa(db, relogio(), yt.fetch)
    expect(r.ignorados.outro_teste).toBeGreaterThanOrEqual(1)
    expect(r.tentadas).toBe(0)
    expect(yt.escritas()).toEqual([])
    expect(await teste(t1)).toEqual(antes)
  })

  it('N1: destinos divergentes → o campo vira desistiu/destino_invalido e o fanOut recebe a chave e a frase nova', async () => {
    const t = await semear('combo', 'completed', (x) => ({ title: campo({ destino: 'original' }), thumbnail: campo({ destino: x.varB }) }))
    const r = await faseNovaTentativa(db, relogio(), yt.fetch)
    expect(r.falhas).toBe(1)
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'destino_invalido' }, thumbnail: { estado: 'desistiu', motivo: 'destino_invalido' } })
    expect(chaves().some((k) => k.startsWith(`ab-restore-desistiu:${t.testId}:title:`))).toBe(true)
    expect(await claimAlert(db, `ab-restore-desistiu:${t.testId}:thumbnail`, '3650 days')).toBe(false) // um envio só, as duas chaves gastas
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(mensagens().some((m) => m.includes('O Lab não soube para qual versão devolver'))).toBe(true)
    expect(yt.escritas()).toEqual([])
    expect((await faseNovaTentativa(db, relogio(), yt.fetch)).tentadas).toBe(0) // não se repete para sempre
  })

  it('N2: o interrompido com attempts 2 converte em desistiu/tres_falhas e o aviso sai uma vez, com a frase de tres_falhas', async () => {
    const t = await semear('title', 'completed', { title: campo({ estado: 'em_andamento', escreveu: null, erro: null, em: iso(-20 * 60_000), attempts: 2 }) })
    const r = await faseDriftEInterrompidos(db, relogio(), yt.fetch)
    expect(r.interrompidos).toBeGreaterThanOrEqual(1)
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 } })
    const minhas = chaves().filter((k) => k.startsWith(`ab-restore-desistiu:${t.testId}:title:`))
    expect(minhas).toHaveLength(1)
    expect(mensagens().some((m) => m.includes('falhou 3 vezes e parou'))).toBe(true)
  })

  it('o .or() do PostgREST real acha falhou em title e em thumbnail e não acha active', async () => {
    const a = await semear('title', 'completed', { title: campo() })
    const b = await semear('combo', 'archived', { thumbnail: campo() })
    const c = await semear('title', 'active', { title: campo() })
    const tentar = vi.fn(async () => ({ resultado: 'em_andamento' as const, campos: null }))
    await faseNovaTentativa(db, relogio(), yt.fetch, 4, { tentar })
    const ids = (tentar.mock.calls as unknown as Array<[string]>).map((x) => x[0])
    expect(ids).toContain(a.testId)
    expect(ids).toContain(b.testId)
    expect(ids).not.toContain(c.testId)
  })
})

describe.skipIf(skipIfNoLocalDb())('P4b T5: retryRestore e dismissRestore no banco real', () => {
  const db = clienteServico()
  const fanOut = vi.mocked(fanOutToSiteAdminsDetailed)
  let yt: YouTubeFalso
  let portas: Partial<PortasSaida>

  async function semear(testType: 'title' | 'combo', status: string, restoreStatus: unknown | ((t: Semente) => unknown), seq = 1): Promise<Semente> {
    const t = await semearTesteAb({ status: 'active', cicloAberto: null, testType })
    await db.from('ab_test_variants').update({ title_text: 'Título A' }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ title_text: 'Título B' }).eq('id', t.varB)
    const r = await db.from('ab_tests').update({ original_title: 'Título A', status, restore_seq: seq, restore_status: typeof restoreStatus === 'function' ? restoreStatus(t) : restoreStatus }).eq('id', t.testId)
    if (r.error) throw new Error(`semear: ${r.error.message}`)
    return t
  }
  const teste = async (t: Semente) => (await db.from('ab_tests').select('status, restore_seq, restore_status, winner_applied_at').eq('id', t.testId).single()).data!
  const relogio = () => ({ agora: () => Date.now(), inicio: Date.now() })
  const desistiuDe = (t: Semente) => fanOut.mock.calls.map((c) => c[0] as { dedupKey: string }).filter((a) => a.dedupKey.startsWith(`ab-restore-desistiu:${t.testId}:title`))

  beforeEach(async () => {
    vi.clearAllMocks()
    fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    await db.from('ab_tests').update({ restore_status: {} }).or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.A), titulo: 'Título B', blobs: {} })
    portas = { supabase: db, fetch: yt.fetch, agora: () => new Date(), token: async () => 'tok', autoImportWinner: async () => {} }
  })

  it('dismiss: o CHECK aceita {} e o gatilho não grava linha nova em ab_test_restores', async () => {
    const t = await semear('title', 'completed', { title: campo() })
    const antes = (await db.from('ab_test_restores').select('seq').eq('test_id', t.testId)).data!.length
    const ator = await insertAuthUser(`p4b-dispensa-${t.testId}@test.local`)
    const r = await dispensarCampos(db, t.testId, t.siteId, ['title'], 1, { userId: ator, orgId: null })
    expect(r.resultado).toBe('feito')
    expect(await teste(t)).toMatchObject({ restore_status: {}, restore_seq: 2 })
    expect((await db.from('ab_test_restores').select('seq').eq('test_id', t.testId)).data!.length).toBe(antes)
    const aud = (await db.from('audit_log').select('action, resource_id, after_data, actor_user_id').eq('resource_id', t.testId).eq('action', 'ab_restore_dismissed')).data!
    expect(aud).toHaveLength(1)
    expect(aud[0]!.after_data).toMatchObject({ campos: ['title'], restore_seq: 1, restore_seq_novo: 2 })
    expect(aud[0]!.actor_user_id).toBe(ator) // Y-A3
  })

  it('dismiss com seq velho: mudou e nada muda', async () => {
    const t = await semear('title', 'completed', { title: campo() }, 3)
    expect((await dispensarCampos(db, t.testId, t.siteId, ['title'], 1, { userId: '00000000-0000-0000-0000-000000000001', orgId: null })).resultado).toBe('mudou')
    expect(await teste(t)).toMatchObject({ restore_seq: 3, restore_status: { title: { estado: 'falhou' } } })
  })

  it('retry de desistiu/tres_falhas com destino variante: reivindica com attempts 0, o YouTube aceita, ok e winner_applied_at gravado (P4b-I6)', async () => {
    const t = await semear('title', 'completed', (x) => ({ title: campo({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3, destino: x.varB }) }), 4)
    yt.titulo = 'Título A'
    const r = await tentarAgora(db, t.testId, t.siteId, 4, portas)
    expect(r.resultado).toBe('feito')
    const depois = await teste(t)
    expect(depois.restore_status).toMatchObject({ title: { estado: 'ok', attempts: 0 } })
    expect(depois.winner_applied_at).not.toBeNull()
    expect(yt.escritas()).toEqual(['videos.update'])
  })

  it('retry com seq velho: mudou, nenhuma escrita', async () => {
    const t = await semear('title', 'completed', { title: campo() }, 4)
    expect((await tentarAgora(db, t.testId, t.siteId, 2, portas)).resultado).toBe('mudou')
    expect(yt.escritas()).toEqual([])
  })

  it('F7/Y-5: desistiu → retry → falhou → vigia 2x → desistiu: dois envios de "parou" no total', async () => {
    const t = await semear('title', 'completed', { title: campo({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }) }, 4)
    // 1º "parou": quem leva o campo a desistiu avisa (aqui, o aviso da corrente que acabou de parar)
    const { avisarNovaTentativa } = await import('@/lib/youtube/ab-restore-avisos')
    const lerRs = async () => (await teste(t)).restore_status as never
    expect(await avisarNovaTentativa(db, { id: t.testId, site_id: t.siteId, name: 'T' }, await lerRs(), null)).toBe('enviado')
    // Tentar agora: falha (attempts 1)
    yt.recusar('videos.update', 403, 'forbidden')
    expect((await tentarAgora(db, t.testId, t.siteId, 4, portas)).resultado).toBe('feito')
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'falhou', attempts: 1 } })
    // vigia 2x: falhou/2, depois desistiu/tres_falhas/3
    await faseNovaTentativa(db, relogio(), yt.fetch)
    await faseNovaTentativa(db, relogio(), yt.fetch)
    expect((await teste(t)).restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 } })
    expect(desistiuDe(t)).toHaveLength(2)
    expect(new Set(desistiuDe(t).map((a) => a.dedupKey)).size).toBe(2) // chaves do fan-out distintas: o índice único não engole o segundo
  })
})
