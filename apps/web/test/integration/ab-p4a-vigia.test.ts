import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
import { YouTubeFalso, imagemComDhash, H } from '../helpers/youtube-falso'

// P4a T11 r1 (item 5): o vigia contra o bythiago_int. Reais: o `.or()` do PostgREST, o CHECK do restore_status, o
// gatilho do histórico, o CAS por restore_seq, os filtros `.is`/`.in`, o jsonb de ida e volta e a pausa por drift
// (ab_settle_claim). Dublês: o YouTube (fetch), o token, o canal, o aviso.
const { fanOut, createNotification, getOwners } = vi.hoisted(() => ({ fanOut: vi.fn(), createNotification: vi.fn(), getOwners: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification }))
vi.mock('@/lib/notifications/get-site-owners', async (orig) => ({ ...(await orig<typeof import('@/lib/notifications/get-site-owners')>()), getSiteOwners: getOwners }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn(async () => ({ accessToken: 'tok' })) }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: vi.fn(async () => 'UCint'),
}))

import { faseDriftEInterrompidos } from '@/lib/youtube/ab-watchdog-drift'

const BLOB = (v: string) => `https://t11.public.blob.vercel-storage.com/${v}.png`
const MIN = 60_000
const HORA = 3_600_000
const DIA = 86_400_000
const iso = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString()
const andamento = (minAtras: number, extra: Record<string, unknown> = {}) => ({
  estado: 'em_andamento', destino: 'original', em: iso(-minAtras * MIN), forcado: false, escreveu: null, erro: null, attempts: 0, ...extra,
})
const falhouAntigo = () => ({ estado: 'falhou', destino: 'original', em: iso(-DIA), forcado: false, escreveu: true, erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }, attempts: 1 })

type Semente = { testId: string; varA: string; varB: string; siteId: string }

describe.skipIf(skipIfNoLocalDb())('P4a T11 r1: o vigia no banco real', () => {
  const db = clienteServico()
  let yt: YouTubeFalso

  async function semear(opcoes: { status?: string; testType?: 'thumbnail' | 'title' | 'combo'; seq?: number; restoreStatus?: unknown; marcador?: boolean; cicloHaMs?: number } = {}): Promise<Semente> {
    const t = await semearTesteAb({ status: opcoes.status ?? 'paused', cicloAberto: 0, testType: opcoes.testType ?? 'thumbnail' })
    await db.from('ab_test_variants').update({ blob_url: BLOB('A'), thumbnail_dhash: H.A, title_text: 'Título A' }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ blob_url: BLOB('B'), thumbnail_dhash: H.B, title_text: 'Título B' }).eq('id', t.varB)
    await db.from('ab_test_cycles').update({ started_at: iso(-(opcoes.cicloHaMs ?? 4 * HORA)) }).eq('test_id', t.testId)
    const patch: Record<string, unknown> = { original_title: 'Título A', original_thumbnail_url: BLOB('A') }
    if (opcoes.seq !== undefined) patch.restore_seq = opcoes.seq
    if (opcoes.restoreStatus !== undefined) patch.restore_status = opcoes.restoreStatus
    if (opcoes.marcador) patch.last_applied_variant_id = t.varB
    const r = await db.from('ab_tests').update(patch).eq('id', t.testId)
    if (r.error) throw new Error(`semear: ${r.error.message}`)
    return t
  }
  const teste = async (t: Semente) => (await db.from('ab_tests').select('status, status_note, restore_seq, restore_status, drift_acknowledged_at').eq('id', t.testId).single()).data!
  const restores = async (t: Semente) => (await db.from('ab_test_restores').select('seq, campo, estado, erro, attempts, escreveu, em').eq('test_id', t.testId).order('seq').order('campo')).data ?? []
  const fase = () => faseDriftEInterrompidos(db, { agora: () => Date.now(), inicio: Date.now() }, yt.fetch)

  beforeEach(async () => {
    vi.clearAllMocks()
    fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    createNotification.mockResolvedValue({ success: true })
    getOwners.mockResolvedValue([{ userId: '00000000-0000-0000-0000-000000000001', email: 'dono@x.com' }])
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.A), titulo: 'Título A', blobs: { [BLOB('A')]: await imagemComDhash(H.A), [BLOB('B')]: await imagemComDhash(H.B) } })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('.or() do PostgREST: só título, só thumbnail e os dois são achados; ok e nulo, não; o CHECK aceita erro "interrompido" e escreveu null', async () => {
    const soTitulo = await semear({ restoreStatus: { title: andamento(16) } })
    const soThumb = await semear({ restoreStatus: { thumbnail: andamento(16) } })
    const ambos = await semear({ restoreStatus: { title: andamento(16), thumbnail: andamento(20) } })
    const nenhum = await semear({ restoreStatus: { thumbnail: { ...falhouAntigo(), estado: 'ok', erro: null } } })
    const nulo = await semear()
    const antes = await Promise.all([nenhum, nulo].map(teste))
    const r = await fase()
    expect(r.interrompidos).toBeGreaterThanOrEqual(3)
    expect((await teste(soTitulo)).restore_status).toMatchObject({ title: { estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null } })
    expect((await teste(soThumb)).restore_status).toMatchObject({ thumbnail: { estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null } })
    expect((await teste(ambos)).restore_status).toMatchObject({ title: { erro: 'interrompido' }, thumbnail: { erro: 'interrompido' } })
    expect([soTitulo, soThumb, ambos].map((t) => t.testId)).toHaveLength(3)
    expect(await Promise.all([soTitulo, soThumb, ambos].map(async (t) => (await teste(t)).restore_seq))).toEqual([1, 1, 1])
    expect(await Promise.all([nenhum, nulo].map(teste))).toEqual(antes) // intocados, byte a byte
  })

  it('gatilho: uma linha em ab_test_restores por campo convertido, seq novo, nenhuma para o campo não convertido; segunda execução não duplica; jsonb do outro campo volta igual', async () => {
    const antigo = falhouAntigo()
    const t = await semear({ testType: 'combo', seq: 1, restoreStatus: { title: antigo, thumbnail: andamento(20) } })
    const linhasAntes = (await restores(t)).length
    const titleAntes = (await teste(t)).restore_status as { title: unknown }
    await fase()
    const depois = await restores(t)
    const novas = depois.filter((l) => l.seq === 2)
    expect(novas).toHaveLength(1)
    expect(novas[0]).toMatchObject({ campo: 'thumbnail', estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null })
    expect(depois.filter((l) => l.seq === 2 && l.campo === 'title')).toHaveLength(0)
    expect(depois.length).toBe(linhasAntes + 1)
    expect((await teste(t)).restore_status).toMatchObject({ title: titleAntes.title })
    expect((await teste(t)).restore_seq).toBe(2)
    await fase()
    expect((await restores(t)).length).toBe(linhasAntes + 1)
    expect((await teste(t)).restore_seq).toBe(2)
  })

  it('CAS: update ... .eq("restore_seq", velho).select("id") com o seq já andado devolve [] e não muda nada', async () => {
    const t = await semear({ seq: 5, restoreStatus: { thumbnail: andamento(20) } })
    await db.from('ab_tests').update({ restore_seq: 6 }).eq('id', t.testId)
    const antes = JSON.stringify((await teste(t)).restore_status)
    const r = await db.from('ab_tests').update({ restore_seq: 6, restore_status: { thumbnail: { ...andamento(20), estado: 'falhou', erro: 'interrompido', attempts: 1 } } }).eq('id', t.testId).eq('restore_seq', 5).select('id')
    expect(r.error).toBeNull()
    expect(r.data).toEqual([])
    expect(JSON.stringify((await teste(t)).restore_status)).toBe(antes)
    const ok = await db.from('ab_tests').update({ restore_seq: 7 }).eq('id', t.testId).eq('restore_seq', 6).select('id')
    expect(ok.data).toHaveLength(1)
  })

  it('filtros .is/.in e pausa por drift: só o ativo de thumbnail com marcador nulo é visto; o drift pausa pelo ab_settle_claim real', async () => {
    yt = new YouTubeFalso({ thumb: await imagemComDhash(H.C), titulo: 'Título A', blobs: { [BLOB('A')]: await imagemComDhash(H.A), [BLOB('B')]: await imagemComDhash(H.B) } })
    const alvo = await semear({ status: 'active' })
    const comMarcador = await semear({ status: 'active', marcador: true })
    const titulo = await semear({ status: 'active', testType: 'title' })
    const cicloNovo = await semear({ status: 'active', cicloHaMs: 2 * HORA })
    const r = await fase()
    expect(r.pausados).toBeGreaterThanOrEqual(1)
    expect(await teste(alvo)).toMatchObject({ status: 'paused', status_note: 'Thumbnail alterado externamente', restore_seq: 1, drift_acknowledged_at: null })
    expect((await teste(alvo)).restore_status).toMatchObject({ thumbnail: { estado: 'pulado_drift', destino: 'original', escreveu: false } })
    const ciclo = (await db.from('ab_test_cycles').select('end_reason, ended_at').eq('test_id', alvo.testId)).data!
    expect(ciclo[0]).toMatchObject({ end_reason: 'drift' })
    expect(ciclo[0]!.ended_at).not.toBeNull()
    expect((await restores(alvo)).filter((l) => l.campo === 'thumbnail')).toHaveLength(1)
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'youtube.drift_detected' }))
    for (const t of [comMarcador, titulo, cicloNovo]) expect(await teste(t)).toMatchObject({ status: 'active', restore_seq: 0 })
    expect(yt.escritas()).toEqual([]) // imagem de fora: o vigia não escreve, só pausa
  })
})
