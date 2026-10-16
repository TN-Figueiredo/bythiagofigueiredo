// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))
import { parseChannelInput } from '@/app/cms/(authed)/youtube/competitors/_canais/channel-input'

const UC = 'UC' + 'a'.repeat(22)
describe('parseChannelInput', () => {
  it('accepts @handle, handle URL, channel URL and a bare id', () => {
    expect(parseChannelInput('@LukeDamant')).toEqual({ kind: 'handle', handle: '@LukeDamant' })
    expect(parseChannelInput('https://www.youtube.com/@LukeDamant/videos')).toEqual({ kind: 'handle', handle: '@LukeDamant' })
    expect(parseChannelInput(`https://youtube.com/channel/${UC}`)).toEqual({ kind: 'id', id: UC })
    expect(parseChannelInput(UC)).toEqual({ kind: 'id', id: UC })
  })
  it('handle com acento (letras Unicode, como o YouTube aceita): com @, sem @, URL decodificada e URL com %XX', () => {
    const h = { kind: 'handle', handle: '@CaféComMapa' }
    expect(parseChannelInput('@CaféComMapa')).toEqual(h)
    expect(parseChannelInput('CaféComMapa')).toEqual(h)
    expect(parseChannelInput('https://www.youtube.com/@CaféComMapa')).toEqual(h)
    expect(parseChannelInput('https://www.youtube.com/@Caf%C3%A9ComMapa/videos')).toEqual(h)
    // macOS pode colar o "é" decomposto (e + acento combinante): normaliza para NFC
    expect(parseChannelInput('@Cafe\u0301ComMapa')).toEqual(h)
  })
  it('sem @ e sem esquema: assume que é o handle ou a URL do canal', () => {
    expect(parseChannelInput('LukeDamant')).toEqual({ kind: 'handle', handle: '@LukeDamant' })
    expect(parseChannelInput('youtube.com/@LukeDamant')).toEqual({ kind: 'handle', handle: '@LukeDamant' })
    expect(parseChannelInput('www.youtube.com/@LukeDamant')).toEqual({ kind: 'handle', handle: '@LukeDamant' })
  })
  it('refuses anything else', () => {
    for (const x of ['xx', '@ab', 'ab', 'https://evil.com/@x123', 'evil.com/@x123', 'https://www.youtube.com/@Caf%ZZComMapa', 'Luke Damant', 'https://www.youtube.com/watch?v=abc', '']) expect(parseChannelInput(x)).toBeNull()
  })
})

vi.mock('server-only', () => ({}))
type NicheRow = { slug: string; label: string; color_dark: string; color_light: string; sort_order: number }
const BUILTIN_ROWS: NicheRow[] = [{ slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }, { slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8', sort_order: 20 }]
const JOGOS: NicheRow = { slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 100 }
/** `niches`: the site's youtube_niches rows; 'missing' = the table is not in this database yet (42P01). Default: the two built-in. */
interface Db {
  own: Array<{ id: string; channel_id: string }> | null; existing: unknown; inserted: unknown[]; deleted?: unknown[] | null; niches?: NicheRow[] | 'missing' | 'broken'
  /** (A5 E9) linhas de competitor_removed_items (kind canal) que o banco "já tem"; 'broken' = a leitura falha. Omitido = nenhuma. */
  removed?: Array<{ id: number; decided_at: string }> | 'broken'
  /** (A5 E9) o que a ação gravou em competitor_removed_items (update) e em audit_log (insert); `falha` faz a gravação da volta falhar. */
  volta?: { updates: unknown[]; audits: unknown[]; falha?: 'update' | 'audit' }
}
/** What the action handed to after(): nothing here runs until a test runs it. */
let queued: Array<() => unknown> = []
const revalidateTag = vi.fn()
let syncMock = vi.fn(async (..._a: unknown[]) => ({}))
function setup(db: Db, slots = { used: 14, limit: 75, free: 61 }, auth: { ok: boolean; reason?: string; user?: { id: string } } = { ok: true, user: { id: 'u1' } }) {
  vi.resetModules()
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => auth }))
  queued = []; syncMock = vi.fn(async (..._a: unknown[]) => ({}))
  revalidateTag.mockClear()
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag }))
  vi.doMock('next/server', () => ({ after: (fn: () => unknown) => { queued.push(fn) } }))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: syncMock }))
  // a guarda de schema (MG1 + MG2) das ações que sincronizam tem teste próprio (competitor-actions-schema-guard.test.ts): aqui o schema está pronto
  vi.doMock('@/lib/youtube/competitor-sync-guard', () => ({ syncSchemaBlock: async () => null }))
  vi.doMock('@/lib/youtube/competitor-slots', () => ({ getChannelSlots: async () => slots, UNLOCK_STEP: 25 }))
  const chain = (data: unknown) => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data }) }) }) }) })
  vi.doMock('@/lib/supabase/service', () => ({
    getSupabaseServiceClient: () => ({
      from: (t: string) => t === 'competitor_removed_items' ? {
        select: () => { const q = { eq: () => q, limit: async () => (db.removed === 'broken' ? { data: null, error: { message: 'boom' } } : { data: db.removed ?? [], error: null }) }; return q },
        update: (row: unknown) => { db.volta?.updates.push(row); const q = { eq: () => q, then: (ok: (r: unknown) => unknown) => Promise.resolve({ error: db.volta?.falha === 'update' ? { message: 'boom' } : null }).then(ok) }; return q },
      } : t === 'audit_log' ? {
        insert: async (row: unknown) => { db.volta?.audits.push(row); return { error: db.volta?.falha === 'audit' ? { message: 'boom' } : null } },
      } : t === 'youtube_channels' ? { select: () => ({ eq: async () => ({ data: db.own }) }) } : t === 'youtube_niches' ? { select: () => {
        const res = db.niches === 'missing' ? { data: null, error: { code: '42P01', message: 'relation does not exist' } } : db.niches === 'broken' ? { data: null, error: { code: '57014', message: 'timeout' } } : { data: db.niches ?? BUILTIN_ROWS, error: null }
        const q = { eq: () => q, order: () => q, then: (ok: (r: typeof res) => unknown) => Promise.resolve(res).then(ok) }
        return q
      } } : {
        ...chain(db.existing),
        delete: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: db.deleted ?? null, error: null }) }) }) }),
        insert: (row: unknown) => { db.inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: 'n1', channel_id: 'x', site_id: 's1' }, error: null }) }) } },
      },
    }),
  }))
}
const actions = async () => await import('@/app/cms/(authed)/youtube/competitors/actions')
const load = async () => (await actions()).addCompetitorChannel

describe('addCompetitorChannel', () => {
  const env = process.env.YOUTUBE_API_KEY
  beforeEach(() => { process.env.YOUTUBE_API_KEY = 'k' })
  afterEach(() => { vi.unstubAllGlobals(); if (env === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = env })

  it('a duplicate is rejected with its name and niche', async () => {
    setup({ own: null, existing: { id: 'c1', niche: 'ia', channel_name: 'Matt Wolfe' }, inserted: [] })
    expect(await (await load())(UC)).toEqual({ ok: false, error: 'Matt Wolfe já está no observatório (IA).' })
  })
  it('the own channel is rejected (singular with one own channel)', async () => {
    setup({ own: [{ id: 'o1', channel_id: UC }], existing: null, inserted: [] })
    expect((await (await load())(UC)).error).toBe('Esse é o seu canal: ele já aparece na tabela e não ocupa vaga.')
  })
  it('the own channel is rejected (plural with two own channels)', async () => {
    setup({ own: [{ id: 'o1', channel_id: 'UC' + 'b'.repeat(22) }, { id: 'o2', channel_id: UC }], existing: null, inserted: [] })
    expect((await (await load())(UC)).error).toBe('Esse é um dos seus canais: ele já aparece na tabela e não ocupa vaga.')
  })
  it('zero own channels, or only other ones: the normal flow goes on', async () => {
    setup({ own: [], existing: null, inserted: [] }, { used: 14, limit: 14, free: 0 })
    expect((await (await load())(UC)).error).toBe('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
    setup({ own: [{ id: 'o1', channel_id: 'UC' + 'b'.repeat(22) }], existing: null, inserted: [] }, { used: 14, limit: 14, free: 0 })
    expect((await (await load())(UC)).error).toBe('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
  })
  it('full: the sentence of canais.html', async () => {
    setup({ own: null, existing: null, inserted: [] }, { used: 14, limit: 14, free: 0 })
    expect((await (await load())(UC)).error).toBe('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
  })
  it('a @handle is resolved through the API and inserted with niche and video limit', async () => {
    const db: Db = { own: null, existing: null, inserted: [] }
    setup(db)
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: UC, snippet: { title: 'Luke Damant' } }] })))
    vi.stubGlobal('fetch', fetchMock)
    const res = await (await load())('@LukeDamant', 'viagem', 120)
    expect(res.ok).toBe(true)
    expect(res.title).toBe('Luke Damant')
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('forHandle=%40LukeDamant')
    expect(db.inserted).toEqual([{ site_id: 's1', channel_id: UC, channel_name: 'Luke Damant', niche: 'viagem', video_limit: 120 }])
  })
  it('answers before the first sync: the sync is handed to after(), and a sync that throws does not reject', async () => {
    setup({ own: null, existing: null, inserted: [] })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ id: UC, snippet: { title: 'Luke Damant' } }] }))))
    syncMock.mockRejectedValueOnce(new Error('YouTube API 500'))
    const res = await (await load())('@LukeDamant', 'viagem', 50)
    expect(res.ok).toBe(true)
    expect(syncMock).not.toHaveBeenCalled()
    expect(queued).toHaveLength(1)
    await expect(Promise.resolve(queued[0]!())).resolves.toBeUndefined()
    expect(syncMock).toHaveBeenCalledWith({ id: 'n1', channel_id: 'x', site_id: 's1' }, 'k')
  })
  it('a primeira sincronização, que roda depois da resposta, invalida o cache do Observatório ao terminar', async () => {
    setup({ own: null, existing: null, inserted: [] })
    expect((await (await load())(UC)).ok).toBe(true)
    expect(revalidateTag).not.toHaveBeenCalled() // nothing was written to the cached tables yet
    await queued[0]!()
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('a primeira sincronização falhou (dado parcial): invalida mesmo assim', async () => {
    setup({ own: null, existing: null, inserted: [] })
    const add = await load()
    syncMock.mockRejectedValueOnce(new Error('YouTube API 500'))
    await add(UC)
    await queued[0]!()
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('a @handle not found on YouTube says so; without the API key (default) it does not pretend', async () => {
    setup({ own: null, existing: null, inserted: [] })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }))))
    expect((await (await load())('@nobody123')).error).toBe('Canal não encontrado no YouTube: confira o @nobody123.')
    delete process.env.YOUTUBE_API_KEY
    setup({ own: null, existing: null, inserted: [] })
    expect((await (await load())('@nobody123')).error).toBe('A chave da API do YouTube não está configurada.')
  })
  it('bad input and an out-of-range video limit are refused before any read', async () => {
    setup({ own: null, existing: null, inserted: [] })
    const add = await load()
    expect((await add('xx')).error).toBe('Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).')
    expect((await add(UC, 'ia', 500)).error).toBe('Escolha entre 10 e 200 vídeos.')
  })
  it('a niche the owner created (in the site table) is accepted and inserted with its slug', async () => {
    const db: Db = { own: null, existing: null, inserted: [], niches: [...BUILTIN_ROWS, JOGOS] }
    setup(db)
    expect((await (await load())(UC, 'jogos', 50)).ok).toBe(true)
    expect(db.inserted).toEqual([{ site_id: 's1', channel_id: UC, channel_name: UC, niche: 'jogos', video_limit: 50 }])
  })
  it('a well-formed niche that the site does not have is refused, nothing inserted; a malformed one too', async () => {
    const db: Db = { own: null, existing: null, inserted: [] }
    setup(db)
    const add = await load()
    expect(await add(UC, 'jogos', 50)).toEqual({ ok: false, error: 'Nicho inválido.' })
    expect(await add(UC, 'Não Vale', 50)).toEqual({ ok: false, error: 'Nicho inválido.' })
    expect(db.inserted).toEqual([])
  })
  it('table youtube_niches not in this database yet: the built-in niches still work, a created one is refused', async () => {
    const db: Db = { own: null, existing: null, inserted: [], niches: 'missing' }
    setup(db)
    const add = await load()
    expect((await add(UC, 'ia', 50)).ok).toBe(true)
    expect(await add(UC, 'jogos', 50)).toEqual({ ok: false, error: 'Nicho inválido.' })
    expect(db.inserted).toEqual([{ site_id: 's1', channel_id: UC, channel_name: UC, niche: 'ia', video_limit: 50 }])
  })
  it('the niches read fails: the niche cannot be checked — said as such (never "Nicho inválido."), nothing inserted', async () => {
    const db: Db = { own: null, existing: null, inserted: [], niches: 'broken' }
    setup(db)
    expect(await (await load())(UC, 'ia', 50)).toEqual({ ok: false, error: 'Não deu para conferir o nicho agora. Tente de novo em alguns minutos.' })
    expect(db.inserted).toEqual([])
  })
  it('a duplicate in a created niche says its label', async () => {
    setup({ own: null, existing: { id: 'c1', niche: 'jogos', channel_name: 'Canal J' }, inserted: [], niches: [...BUILTIN_ROWS, JOGOS] })
    expect((await (await load())(UC)).error).toBe('Canal J já está no observatório (Jogos).')
  })
  it('addChannelFromCanais passes the created niche through', async () => {
    const db: Db = { own: null, existing: null, inserted: [], niches: [...BUILTIN_ROWS, JOGOS] }
    setup(db)
    expect((await (await actions()).addChannelFromCanais({ channel: UC, niche: 'jogos', videoLimit: 50 })).ok).toBe(true)
    expect(db.inserted).toHaveLength(1)
  })
  it('a duplicate is reported even when there is no free slot', async () => {
    setup({ own: null, existing: { id: 'c1', niche: 'viagem', channel_name: 'Luke Damant' }, inserted: [] }, { used: 14, limit: 14, free: 0 })
    expect((await (await load())(UC)).error).toBe('Luke Damant já está no observatório (Viagem).')
  })
  it('without edit access nothing is read or written', async () => {
    const db: Db = { own: null, existing: null, inserted: [] }
    setup(db, undefined, { ok: false, reason: 'forbidden' })
    expect(await (await load())(UC)).toEqual({ ok: false, error: 'forbidden' })
    expect(db.inserted).toEqual([])
  })
})

describe('removeCompetitorChannel', () => {
  it('sem permissão: não remove nem invalida', async () => {
    setup({ own: null, existing: null, inserted: [], deleted: [{ id: 'c1' }] }, undefined, { ok: false, reason: 'forbidden' })
    expect(await (await actions()).removeCompetitorChannel('c1')).toEqual({ ok: false })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('A5 E9 T7: addCompetitorChannel e o canal que o dono apagou', () => {
  const env = process.env.YOUTUBE_API_KEY
  beforeEach(() => { process.env.YOUTUBE_API_KEY = 'k' })
  afterEach(() => { vi.unstubAllGlobals(); if (env === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = env })
  const APAGADO = [{ id: 9, decided_at: '2026-10-10T15:00:00Z' }]

  it('canal apagado readicionado registra a volta, audita e avisa com a data', async () => {
    const db: Db = { own: null, existing: null, inserted: [], removed: APAGADO, volta: { updates: [], audits: [] } }
    setup(db)
    const res = await (await load())(UC)
    expect(res.ok).toBe(true)
    expect(res.aviso).toBe('Você apagou este canal em 10/10; ele entra de novo como novo, sem o histórico.')
    expect(db.inserted).toHaveLength(1)
    expect(db.volta!.updates).toEqual([expect.objectContaining({ return_decision: 'voltar' })])
    expect(db.volta!.audits).toEqual([expect.objectContaining({ action: 'competitor_return_follow', site_id: 's1', actor_user_id: 'u1', after_data: { kind: 'canal', youtube_id: UC } })])
  })
  it('a conferência falha: não adiciona', async () => {
    const db: Db = { own: null, existing: null, inserted: [], removed: 'broken', volta: { updates: [], audits: [] } }
    setup(db)
    expect(await (await load())(UC)).toEqual({ ok: false, error: 'Não foi possível conferir se este canal já foi apagado. Tente de novo.' })
    expect(db.inserted).toHaveLength(0)
  })
  it('canal nunca apagado: nada muda (sem aviso, sem gravação da volta)', async () => {
    const db: Db = { own: null, existing: null, inserted: [], volta: { updates: [], audits: [] } }
    setup(db)
    const res = await (await load())(UC)
    expect(res.ok).toBe(true)
    expect(res.aviso).toBeUndefined()
    expect(db.volta!.updates).toHaveLength(0)
    expect(db.volta!.audits).toHaveLength(0)
  })
  it('sem vaga: não registra a volta nem audita', async () => {
    const db: Db = { own: null, existing: null, inserted: [], removed: APAGADO, volta: { updates: [], audits: [] } }
    setup(db, { used: 14, limit: 14, free: 0 })
    expect((await (await load())(UC)).ok).toBe(false)
    expect(db.volta!.updates).toHaveLength(0)
    expect(db.volta!.audits).toHaveLength(0)
  })
  it('o registro da volta falha depois do insert: o canal fica e o aviso diz', async () => {
    for (const falha of ['update', 'audit'] as const) {
      const db: Db = { own: null, existing: null, inserted: [], removed: APAGADO, volta: { updates: [], audits: [], falha } }
      setup(db)
      const res = await (await load())(UC)
      expect(res.ok, falha).toBe(true)
      expect(db.inserted, falha).toHaveLength(1)
      expect(res.aviso, falha).toMatch(/não foi possível registrar a volta na fila/)
    }
  })
})
