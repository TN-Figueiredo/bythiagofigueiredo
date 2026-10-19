import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
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
