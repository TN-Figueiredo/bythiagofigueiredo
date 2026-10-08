// @vitest-environment node
/**
 * Cadastro de canais próprios em /cms/youtube: as server actions. O cliente do banco é um falso em memória que
 * registra toda operação, para afirmar também o que NÃO foi feito (nenhum insert, nenhum delete, nenhum filtro por idioma).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))

vi.mock('server-only', () => ({}))

type Row = Record<string, unknown>
type PgErr = { code: string; message: string }
interface Op { table: string; op: 'select' | 'insert' | 'update' | 'delete' | 'rpc'; payload?: Row; filters: Array<[string, unknown]>; cols?: string }
interface Setup {
  auth?: { ok: true; user: { id: string } } | { ok: false; reason: string }
  channels?: Row[]
  /** 'missing' = a tabela ainda não existe neste banco (42P01); 'broken' = outro erro de leitura. */
  niches?: Row[] | 'missing' | 'broken'
  /** youtube_channels ainda sem a coluna slug (a migration 0006 não chegou). */
  noSlugColumn?: boolean
  errors?: Record<string, PgErr>
  rpc?: Record<string, (args: Row) => { data: unknown; error: PgErr | null }>
  lookup?: Row | null | Error
}

const SITE = 's1'
const VIAGEM = { site_id: SITE, slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }
const IA = { site_id: SITE, slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8', sort_order: 20 }
const JOGOS = { site_id: SITE, slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 30 }
const CH_PT = { id: '11111111-1111-4111-8111-111111111111', site_id: SITE, channel_id: 'UCpt', locale: 'pt', handle: '@tnfigueiredo', name: 'tnFigueiredo', slug: 'tnfigueiredo', niche: 'viagem' }
const CH_OTHER_SITE = { id: '22222222-2222-4222-8222-222222222222', site_id: 'other', channel_id: 'UCother', locale: 'pt', handle: '@outro', name: 'De outro site', slug: 'outro', niche: null }

const LOOKUP = {
  channelId: 'UCnew', handle: '@Viagem.BR', name: 'Thiago na Estrada', description: null, uploadsPlaylistId: 'UUnew',
  subscriberCount: 126, videoCount: 41, thumbnailUrl: 'https://yt3.example.com/a.jpg', bannerUrl: null, customUrl: '@viagem.br',
}
const addInput = (extra: Row = {}) => ({ ...LOOKUP, locale: 'pt', niche: null, slug: 'viagem-br', ...extra })

function setup(opts: Setup = {}) {
  vi.resetModules()
  const order: string[] = []
  const ops: Op[] = []
  const tables: Record<string, Row[]> = {
    youtube_channels: [...(opts.channels ?? [])],
    youtube_niches: Array.isArray(opts.niches) ? [...opts.niches] : [VIAGEM, IA],
  }
  let nextId = 0
  const run = (o: Op): { data: unknown; error: PgErr | null } => {
    ops.push(o)
    const forced = opts.errors?.[`${o.table}:${o.op}`]
    if (forced) return { data: null, error: forced }
    if (o.table === 'youtube_niches' && opts.niches === 'missing') return { data: null, error: { code: '42P01', message: 'relation "public.youtube_niches" does not exist' } }
    if (o.table === 'youtube_niches' && opts.niches === 'broken') return { data: null, error: { code: '57014', message: 'timeout' } }
    const touchesSlug = (o.cols ?? '').includes('slug') || o.filters.some(([c]) => c === 'slug') || (o.payload != null && 'slug' in o.payload)
    if (o.table === 'youtube_channels' && opts.noSlugColumn && touchesSlug) return { data: null, error: { code: '42703', message: 'column youtube_channels.slug does not exist' } }
    const rows = tables[o.table] ?? []
    const match = (r: Row) => o.filters.every(([c, v]) => r[c] === v)
    if (o.op === 'select') return { data: rows.filter(match), error: null }
    if (o.op === 'insert') {
      nextId += 1
      const row: Row = { id: `new-${nextId}`, ...o.payload }
      // o trigger do banco deriva o slug quando o insert não o informa
      if (o.table === 'youtube_channels' && !opts.noSlugColumn && row.slug == null) row.slug = 'slug-do-banco'
      rows.push(row)
      tables[o.table] = rows
      return { data: [row], error: null }
    }
    if (o.op === 'update') {
      const hit = rows.filter(match)
      for (const r of hit) Object.assign(r, o.payload)
      return { data: hit, error: null }
    }
    throw new Error(`operação inesperada: ${o.op} em ${o.table}`)
  }
  const builder = (table: string) => {
    const o: Op = { table, op: 'select', filters: [] }
    let done: { data: unknown; error: PgErr | null } | null = null
    const exec = () => (done ??= run(o))
    const one = () => { const r = exec(); const row = Array.isArray(r.data) ? r.data[0] ?? null : null; return Promise.resolve(r.error ? r : { data: row, error: row ? null : { code: 'PGRST116', message: 'no rows' } }) }
    const b = {
      select: (cols?: string) => { o.cols = cols; return b },
      insert: (payload: Row) => { o.op = 'insert'; o.payload = payload; return b },
      update: (payload: Row) => { o.op = 'update'; o.payload = payload; return b },
      delete: () => { o.op = 'delete'; return b },
      eq: (c: string, v: unknown) => { o.filters.push([c, v]); return b },
      order: () => b,
      limit: () => b,
      single: one,
      maybeSingle: () => { const r = exec(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : null, error: r.error }) },
      then: (ok: (r: { data: unknown; error: PgErr | null }) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve().then(exec).then(ok, bad),
    }
    return b
  }
  const rpc = vi.fn(async (name: string, args: Row) => {
    ops.push({ table: name, op: 'rpc', payload: args, filters: [] })
    const fn = opts.rpc?.[name]
    return fn ? fn(args) : { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } }
  })
  const clientMock = vi.fn(() => { order.push('client'); return { from: (t: string) => builder(t), rpc } })
  const revalidateTag = vi.fn(), revalidatePath = vi.fn()
  vi.doMock('next/cache', () => ({ revalidateTag, revalidatePath }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async (a: Row) => { order.push('guard:' + String(a.mode)); return opts.auth ?? { ok: true, user: { id: 'u1' } } } }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: clientMock }))
  const lookupChannelByHandle = vi.fn(async () => { if (opts.lookup instanceof Error) throw opts.lookup; return opts.lookup === undefined ? LOOKUP : opts.lookup })
  vi.doMock('@/lib/youtube/api-client', () => ({ lookupChannelByHandle }))
  // a remoção não decifra token nenhum: se o cofre for carregado, o teste vê
  let vault = false
  vi.doMock('@tn-figueiredo/social/vault', () => { vault = true; return { getMasterKey: () => Buffer.from('k'), decrypt: (e: string) => e } })
  const load = () => import('@/app/cms/(authed)/youtube/_actions/channels')
  const writes = () => ops.filter(o => o.op === 'insert' || o.op === 'update' || o.op === 'delete')
  return { vaultLoaded: () => vault, load, ops, order, tables, clientMock, rpc, revalidateTag, revalidatePath, lookupChannelByHandle, writes }
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('addYouTubeChannel', () => {
  it('um segundo canal no MESMO idioma entra, devolve o id real, e nada consulta por idioma', async () => {
    const t = setup({ channels: [CH_PT] })
    const { addYouTubeChannel } = await t.load()
    const res = await addYouTubeChannel(addInput({ locale: 'pt' }) as never)
    expect(res).toEqual({ ok: true, id: 'new-1', slug: 'viagem-br' })
    expect(t.ops.some(o => o.filters.some(([c]) => c === 'locale'))).toBe(false)
    const ins = t.writes()
    expect(ins).toHaveLength(1)
    expect(ins[0]!.payload).toMatchObject({ site_id: SITE, channel_id: 'UCnew', locale: 'pt', slug: 'viagem-br', niche: null, handle: '@Viagem.BR', name: 'Thiago na Estrada' })
    expect(t.revalidateTag).toHaveBeenCalledWith('youtube', { expire: 0 })
  })

  it('não há limite: terceiro, quarto e quinto canais passam', async () => {
    const t = setup({ channels: [CH_PT, { ...CH_PT, id: 'c2', channel_id: 'UCen', slug: 'thiago-figueiredo', locale: 'en' }] })
    const { addYouTubeChannel } = await t.load()
    for (const k of [3, 4, 5]) {
      const res = await addYouTubeChannel(addInput({ channelId: `UC${k}`, slug: `canal-${k}` }) as never)
      expect(res.ok).toBe(true)
    }
    expect(t.tables.youtube_channels).toHaveLength(5)
  })

  it('slug repetido no site: o texto exato, embaixo do slug, e nenhum insert', async () => {
    const t = setup({ channels: [{ ...CH_PT, slug: 'viagem-br', name: 'Thiago na Estrada' }] })
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput() as never)).toEqual({ ok: false, error: 'Slug “viagem-br” is already used by “Thiago na Estrada”.', field: 'slug' })
    expect(t.writes()).toEqual([])
  })

  it('o mesmo slug em OUTRO site não atrapalha', async () => {
    const t = setup({ channels: [{ ...CH_OTHER_SITE, slug: 'viagem-br' }] })
    const { addYouTubeChannel } = await t.load()
    expect((await addYouTubeChannel(addInput() as never)).ok).toBe(true)
  })

  it.each(['Não Vale', 'a', '-x', 'x-', 'a--b', 'x'.repeat(33)])('slug mal formado (%s): recusado antes do guard e do banco', async (slug) => {
    const t = setup()
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput({ slug }) as never)).toEqual({ ok: false, error: 'Use lowercase letters, numbers and hyphens (2 to 32 characters).', field: 'slug' })
    expect(t.order).toEqual([])
  })

  it('idioma fora da lista central: recusado antes do guard', async () => {
    const t = setup()
    const { addYouTubeChannel } = await t.load()
    expect((await addYouTubeChannel(addInput({ locale: 'es' }) as never)).ok).toBe(false)
    expect(t.order).toEqual([])
  })

  it('nicho que não existe NO SITE: o texto exato e nenhum insert', async () => {
    const t = setup()
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput({ niche: 'jogos' }) as never)).toEqual({ ok: false, error: 'Niche not found. Reload the page and try again.', field: 'niche' })
    expect(t.writes()).toEqual([])
  })

  it('nicho criado pelo dono passa; sem nicho (null) passa', async () => {
    const t = setup({ niches: [VIAGEM, IA, JOGOS] })
    const { addYouTubeChannel } = await t.load()
    expect((await addYouTubeChannel(addInput({ niche: 'jogos' }) as never)).ok).toBe(true)
    expect((await addYouTubeChannel(addInput({ niche: null, channelId: 'UCb', slug: 'b-2' }) as never)).ok).toBe(true)
    expect(t.writes().map(o => o.payload!.niche)).toEqual(['jogos', null])
  })

  it('o dado não existe — tabela de nichos ausente: os de fábrica valem, um nicho criado é recusado', async () => {
    const t = setup({ niches: 'missing' })
    const { addYouTubeChannel } = await t.load()
    expect((await addYouTubeChannel(addInput({ niche: 'viagem' }) as never)).ok).toBe(true)
    expect(await addYouTubeChannel(addInput({ niche: 'jogos', channelId: 'UCb', slug: 'b-2' }) as never)).toMatchObject({ ok: false, field: 'niche' })
  })

  it('a leitura de nichos falha por outro motivo: recusa, nunca "qualquer nicho serve"', async () => {
    const t = setup({ niches: 'broken' })
    const { addYouTubeChannel } = await t.load()
    expect((await addYouTubeChannel(addInput({ niche: 'viagem' }) as never)).ok).toBe(false)
    expect(t.writes()).toEqual([])
  })

  it('canal já cadastrado: o texto exato com o slug, e nenhum insert', async () => {
    const t = setup({ channels: [{ ...CH_PT, channel_id: 'UCnew' }] })
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput({ slug: 'outro-slug' }) as never)).toEqual({ ok: false, error: 'This channel is already registered as “tnfigueiredo”.', field: 'handle' })
    expect(t.writes()).toEqual([])
  })

  it('sem slug informado: o insert não leva a coluna e a resposta traz o slug que o BANCO gravou', async () => {
    const t = setup()
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput({ slug: null }) as never)).toEqual({ ok: true, id: 'new-1', slug: 'slug-do-banco' })
    expect('slug' in t.writes()[0]!.payload!).toBe(false)
  })

  it('o dado não existe — coluna slug ausente: o cadastro passa sem slug e não quebra', async () => {
    const t = setup({ noSlugColumn: true, channels: [{ ...CH_PT, slug: undefined }] })
    const { addYouTubeChannel } = await t.load()
    expect(await addYouTubeChannel(addInput() as never)).toEqual({ ok: true, id: 'new-1', slug: null })
    expect('slug' in t.writes()[0]!.payload!).toBe(false)
  })

  it('corrida no insert: a unicidade do banco vira o mesmo texto (slug e canal)', async () => {
    const slugRace = setup({ errors: { 'youtube_channels:insert': { code: '23505', message: 'duplicate key value violates unique constraint "youtube_channels_site_slug_key"' } } })
    expect(await (await slugRace.load()).addYouTubeChannel(addInput() as never)).toMatchObject({ ok: false, field: 'slug', error: expect.stringContaining('Slug “viagem-br” is already used') })
    const chRace = setup({ errors: { 'youtube_channels:insert': { code: '23505', message: 'duplicate key value violates unique constraint "youtube_channels_site_id_channel_id_key"' } } })
    expect(await (await chRace.load()).addYouTubeChannel(addInput() as never)).toMatchObject({ ok: false, field: 'handle', error: expect.stringContaining('This channel is already registered') })
  })
})

describe('código em produção ANTES da migration 0006 (a UNIQUE(site_id, locale) antiga ainda no banco)', () => {
  const LOCALE_KEY = { code: '23505', message: 'duplicate key value violates unique constraint "youtube_channels_site_id_locale_key"' }
  const PENDING = 'A second channel in the same language cannot be saved yet: a database update is pending.'
  it('cadastro de um segundo canal no mesmo idioma: diz que falta a atualização do banco, NÃO "already registered"', async () => {
    const t = setup({ errors: { 'youtube_channels:insert': LOCALE_KEY } })
    const res = await (await t.load()).addYouTubeChannel(addInput() as never)
    expect(res).toEqual({ ok: false, error: PENDING })
  })
  it('troca de idioma para um já usado: a mesma frase, não a mensagem crua do Postgres', async () => {
    const t = setup({ channels: [CH_PT], errors: { 'youtube_channels:update': LOCALE_KEY } })
    expect(await (await t.load()).updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'en', niche: null })).toEqual({ ok: false, error: PENDING })
  })
})

describe('updateYouTubeChannelIdentity', () => {
  it('grava idioma e nicho do canal do site; o slug nunca entra no update, mesmo que venha na entrada', async () => {
    const t = setup({ channels: [CH_PT], niches: [VIAGEM, IA, JOGOS] })
    const { updateYouTubeChannelIdentity } = await t.load()
    const res = await updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'en', niche: 'jogos', slug: 'novo-slug' } as never)
    expect(res).toEqual({ ok: true })
    const up = t.writes()
    expect(up).toHaveLength(1)
    expect(Object.keys(up[0]!.payload!).sort()).toEqual(['locale', 'niche', 'updated_at'])
    expect(up[0]!.filters).toEqual(expect.arrayContaining([['id', CH_PT.id], ['site_id', SITE]]))
    expect(t.tables.youtube_channels[0]).toMatchObject({ locale: 'en', niche: 'jogos', slug: 'tnfigueiredo' })
  })
  it('tirar o nicho (null) passa', async () => {
    const t = setup({ channels: [CH_PT] })
    expect(await (await t.load()).updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'pt', niche: null })).toEqual({ ok: true })
  })
  it('canal de outro site: Channel not found', async () => {
    const t = setup({ channels: [CH_OTHER_SITE] })
    expect(await (await t.load()).updateYouTubeChannelIdentity({ channel_id: CH_OTHER_SITE.id, locale: 'en', niche: null })).toEqual({ ok: false, error: 'Channel not found' })
    expect(t.tables.youtube_channels[0]).toMatchObject({ locale: 'pt' })
  })
  it('nicho inexistente no site: o texto exato e nenhum update', async () => {
    const t = setup({ channels: [CH_PT] })
    expect(await (await t.load()).updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'pt', niche: 'jogos' })).toEqual({ ok: false, error: 'Niche not found. Reload the page and try again.' })
    expect(t.writes()).toEqual([])
  })
  it('id que não é uuid, ou idioma fora da lista: recusado antes do guard', async () => {
    const t = setup({ channels: [CH_PT] })
    const { updateYouTubeChannelIdentity } = await t.load()
    expect((await updateYouTubeChannelIdentity({ channel_id: 'x', locale: 'pt', niche: null })).ok).toBe(false)
    expect((await updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'es', niche: null } as never)).ok).toBe(false)
    expect(t.order).toEqual([])
  })
})

describe('createYouTubeNiche', () => {
  it('Jogos / ameixa: slug saído do nome, as cores da paleta, sort_order = maior + 10', async () => {
    const t = setup()
    const res = await (await t.load()).createYouTubeNiche({ label: ' Jogos ', color: 'ameixa' })
    expect(res).toEqual({ ok: true, slug: 'jogos' })
    expect(t.writes()[0]!.payload).toEqual({ site_id: SITE, slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 30, created_by: 'u1' })
    expect(t.revalidatePath).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('nome com acento e espaço vira slug sem acento com hífen', async () => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label: 'Culinária Fácil', color: 'lima' })).toEqual({ ok: true, slug: 'culinaria-facil' })
  })
  it.each(['Viagem', 'viagem', ' VIAGEM '])('nome repetido (%s): o texto exato com o nome que já existe, sem insert', async (label) => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label, color: 'rosa' })).toEqual({ ok: false, error: 'A niche named “Viagem” already exists.' })
    expect(t.writes()).toEqual([])
  })
  it('nome diferente que dá o mesmo slug de um nicho que existe: recusado com o nome dele', async () => {
    const t = setup({ niches: [VIAGEM, IA, JOGOS] })
    expect(await (await t.load()).createYouTubeNiche({ label: 'Jogos &', color: 'rosa' })).toEqual({ ok: false, error: 'A niche named “Jogos” already exists.' })
  })
  it.each(['Todos', 'all', '  ', '!!!', 'x', 'Um nome comprido demais para nicho'])('nome que vira slug reservado, vazio ou fora do tamanho (%s): recusado antes do guard', async (label) => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label, color: 'rosa' })).toEqual({ ok: false, error: 'Choose another name for this niche.' })
    expect(t.order).toEqual([])
  })
  it('o rótulo é gravado aparado e com os espaços internos colapsados', async () => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label: '  Culinária    Fácil ', color: 'lima' })).toEqual({ ok: true, slug: 'culinaria-facil' })
    expect(t.writes()[0]!.payload!.label).toBe('Culinária Fácil')
  })
  it('a unicidade olha o rótulo já aparado e colapsado, sem diferença de caixa', async () => {
    const t = setup({ niches: [VIAGEM, IA, { ...JOGOS, slug: 'jogos-de-pc', label: 'Jogos de PC' }] })
    expect(await (await t.load()).createYouTubeNiche({ label: '  jogos   DE pc ', color: 'rosa' })).toEqual({ ok: false, error: 'A niche named “Jogos de PC” already exists.' })
    expect(t.writes()).toEqual([])
  })
  it.each(['Jogos\nPC', 'Jogos\tPC', 'C++', 'Jogos (PC)', 'a.b', 'x|y', 'a\\b', 'Jogos?', '[ia]', 'a^b', 'R$', 'a*b', '{x}', 'a/b', '“Jogos”'])('rótulo com quebra de linha ou caractere fora de letras, números, espaço, hífen e & (%j): recusado antes do guard', async (label) => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label, color: 'rosa' })).toEqual({ ok: false, error: 'Choose another name for this niche.' })
    expect(t.order).toEqual([])
  })
  it('letras com acento, números, hífen e & são aceitos', async () => {
    const t = setup()
    expect(await (await t.load()).createYouTubeNiche({ label: 'Finanças & Ações-2', color: 'ardosia' })).toEqual({ ok: true, slug: 'financas-acoes-2' })
  })
  it('sort_order continua a ordem de criação: o segundo nicho criado vem depois do primeiro', async () => {
    const t = setup({ niches: [VIAGEM, IA, { ...JOGOS, sort_order: 100 }] })
    await (await t.load()).createYouTubeNiche({ label: 'Pessoal', color: 'rosa' })
    expect(t.writes()[0]!.payload!.sort_order).toBe(110)
  })
  it.each(['violeta', '#D29AE8', ''])('cor fora da paleta de quatro (%s): recusada antes do guard', async (color) => {
    const t = setup()
    expect((await (await t.load()).createYouTubeNiche({ label: 'Jogos', color })).ok).toBe(false)
    expect(t.order).toEqual([])
  })
  it('o dado não existe — tabela ausente: diz que não dá ainda, sem insert', async () => {
    const t = setup({ niches: 'missing' })
    expect(await (await t.load()).createYouTubeNiche({ label: 'Jogos', color: 'ameixa' })).toEqual({ ok: false, error: 'Niches cannot be created yet: a database update is pending.' })
    expect(t.writes()).toEqual([])
  })
  it('corrida: a unicidade do banco vira o texto de nome repetido', async () => {
    const t = setup({ errors: { 'youtube_niches:insert': { code: '23505', message: 'duplicate key' } } })
    expect(await (await t.load()).createYouTubeNiche({ label: 'Jogos', color: 'ameixa' })).toEqual({ ok: false, error: 'A niche named “Jogos” already exists.' })
  })
})

const IMPACT = {
  status: 'ok', name: 'Thiago na Estrada', slug: 'viagem-br', videos: 212, comments: 48, sync_logs: 864, ab_tests: 3, ab_drafts: 1,
  analyses: 9, tasks: 2, notes: 14, notifications: 5, connections: 1, pipeline_links: 6, blockers: [],
}
const BLOCKER = { id: 't1', name: 'Thumbnail: mapa vs rosto', status: 'active', started_at: '2026-10-18T15:00:00Z', paused_at: null, video_title: 'Quanto custa viajar pela Geórgia?' }

describe('getYouTubeChannelRemovalImpact', () => {
  it('devolve as contagens e os testes que bloqueiam, pedindo ao banco pelo site do contexto', async () => {
    const t = setup({ rpc: { youtube_channel_removal_impact: () => ({ data: { ...IMPACT, blockers: [BLOCKER] }, error: null }) } })
    const res = await (await t.load()).getYouTubeChannelRemovalImpact({ channelId: CH_PT.id })
    expect(res).toEqual({ ok: true, impact: {
      name: 'Thiago na Estrada', slug: 'viagem-br', videos: 212, comments: 48, syncLogs: 864, abTests: 3, abDrafts: 1, analyses: 9, tasks: 2, notes: 14, notifications: 5, connections: 1, pipelineLinks: 6, serieColetada: 0,
      blockers: [{ id: 't1', name: 'Thumbnail: mapa vs rosto', status: 'active', since: '2026-10-18T15:00:00Z', videoTitle: 'Quanto custa viajar pela Geórgia?' }],
    } })
    expect(t.rpc).toHaveBeenCalledWith('youtube_channel_removal_impact', { p_site_id: SITE, p_channel_id: CH_PT.id })
    expect(t.order).toEqual(['guard:edit', 'client'])
  })
  it('o dado não existe — canal sem nada: tudo zero', async () => {
    const zero = { ...IMPACT, videos: 0, comments: 0, sync_logs: 0, ab_tests: 0, ab_drafts: 0, analyses: 0, tasks: 0, notes: 0, notifications: 0, connections: 0, pipeline_links: 0 }
    const t = setup({ rpc: { youtube_channel_removal_impact: () => ({ data: zero, error: null }) } })
    const res = await (await t.load()).getYouTubeChannelRemovalImpact({ channelId: CH_PT.id })
    expect(res).toMatchObject({ ok: true, impact: { videos: 0, comments: 0, syncLogs: 0, abTests: 0, abDrafts: 0, analyses: 0, tasks: 0, notes: 0, notifications: 0, connections: 0, pipelineLinks: 0, blockers: [] } })
  })
  it('canal de outro site (o banco responde not_found): Channel not found', async () => {
    const t = setup({ rpc: { youtube_channel_removal_impact: () => ({ data: { status: 'not_found' }, error: null }) } })
    expect(await (await t.load()).getYouTubeChannelRemovalImpact({ channelId: CH_OTHER_SITE.id })).toEqual({ ok: false, error: 'Channel not found' })
  })
  it('o dado não existe — função ausente no banco: mensagem honesta, sem lançar', async () => {
    const t = setup()
    expect(await (await t.load()).getYouTubeChannelRemovalImpact({ channelId: CH_PT.id })).toEqual({ ok: false, error: 'Channel removal is not available yet: a database update is pending. Nothing was deleted.' })
  })
  it('resposta que o código não entende nunca vira impacto', async () => {
    const t = setup({ rpc: { youtube_channel_removal_impact: () => ({ data: { status: 'ok', videos: 'muitos' }, error: null }) } })
    expect((await (await t.load()).getYouTubeChannelRemovalImpact({ channelId: CH_PT.id })).ok).toBe(false)
  })
})

describe('removeYouTubeChannel', () => {
  const input = { channelId: CH_PT.id, confirmSlug: 'viagem-br' }
  it('remove por UMA chamada ao banco (a transação), com o site do contexto e o slug digitado; nenhum delete solto', async () => {
    const t = setup({ rpc: { youtube_channel_remove: () => ({ data: { ...IMPACT, status: 'removed' }, error: null }) } })
    expect(await (await t.load()).removeYouTubeChannel(input)).toEqual({ ok: true })
    expect(t.rpc).toHaveBeenCalledTimes(1)
    expect(t.rpc).toHaveBeenCalledWith('youtube_channel_remove', { p_site_id: SITE, p_channel_id: CH_PT.id, p_confirm_slug: 'viagem-br' })
    expect(t.ops.filter(o => o.op !== 'rpc')).toEqual([])
    expect(t.revalidateTag).toHaveBeenCalledWith('youtube', { expire: 0 })
    expect(t.revalidateTag).toHaveBeenCalledWith('layout-counts', { expire: 0 })
  })
  it('nenhuma chamada externa na remoção (nada é revogado no Google) e nenhum token na resposta, mesmo que o banco mandasse um', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const t = setup({ rpc: { youtube_channel_remove: () => ({ data: { ...IMPACT, status: 'removed', revoke_tokens: ['enc-refresh'] }, error: null }) } })
    const res = await (await t.load()).removeYouTubeChannel(input)
    expect(res).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(t.vaultLoaded()).toBe(false)
    expect(t.revalidatePath).toHaveBeenCalledWith('/cms/social', 'layout')
  })
  it('teste A/B rodando: recusa com os testes a parar, zero deletes e nada revalidado', async () => {
    const t = setup({ rpc: { youtube_channel_remove: () => ({ data: { ...IMPACT, status: 'blocked', blockers: [BLOCKER] }, error: null }) } })
    const res = await (await t.load()).removeYouTubeChannel(input)
    expect(res).toEqual({ ok: false, error: '“Thiago na Estrada” cannot be removed yet', blockers: [{ id: 't1', name: 'Thumbnail: mapa vs rosto', status: 'active', since: '2026-10-18T15:00:00Z', videoTitle: 'Quanto custa viajar pela Geórgia?' }] })
    expect(t.ops.filter(o => o.op === 'delete')).toEqual([])
    expect(t.revalidateTag).not.toHaveBeenCalled()
  })
  it('falha no meio (o banco desfez tudo): devolve o erro, nada revalidado', async () => {
    const t = setup({ rpc: { youtube_channel_remove: () => ({ data: null, error: { code: 'P0001', message: 'falha forçada no meio' } }) } })
    expect(await (await t.load()).removeYouTubeChannel(input)).toEqual({ ok: false, error: 'falha forçada no meio' })
    expect(t.revalidateTag).not.toHaveBeenCalled()
  })
  it('slug digitado que não é o do canal, canal de outro site, e resposta que o código não entende: nunca sucesso', async () => {
    const mk = (data: unknown) => setup({ rpc: { youtube_channel_remove: () => ({ data, error: null }) } })
    expect(await (await mk({ status: 'slug_mismatch' }).load()).removeYouTubeChannel(input)).toEqual({ ok: false, error: 'Slug confirmation does not match' })
    expect(await (await mk({ status: 'not_found' }).load()).removeYouTubeChannel(input)).toEqual({ ok: false, error: 'Channel not found' })
    expect((await (await mk({ status: 'removido?' }).load()).removeYouTubeChannel(input)).ok).toBe(false)
    expect((await (await mk({ ...IMPACT, status: 'ok' }).load()).removeYouTubeChannel(input)).ok).toBe(false)
  })
  it('L1b: série coletada recusa a remoção com o texto do runbook e não revalida nada', async () => {
    const t = setup({ rpc: { youtube_channel_remove: () => ({ data: { ...IMPACT, status: 'serie_coletada', serie_coletada: 71 }, error: null }) } })
    expect(await (await t.load()).removeYouTubeChannel(input)).toEqual({
      ok: false,
      error: 'Este canal tem série coletada. Apagar a série é um passo manual, descrito no runbook.',
    })
    expect(t.revalidateTag).not.toHaveBeenCalled()
  })
  it('o dado não existe — função de remoção ausente: mensagem honesta, nenhum delete solto no lugar', async () => {
    const t = setup()
    expect(await (await t.load()).removeYouTubeChannel(input)).toEqual({ ok: false, error: 'Channel removal is not available yet: a database update is pending. Nothing was deleted.' })
    expect(t.ops.filter(o => o.op !== 'rpc')).toEqual([])
  })
  it('id que não é uuid ou slug vazio: recusado antes do guard', async () => {
    const t = setup()
    const { removeYouTubeChannel } = await t.load()
    expect((await removeYouTubeChannel({ channelId: 'x', confirmSlug: 'a-b' })).ok).toBe(false)
    expect((await removeYouTubeChannel({ channelId: CH_PT.id, confirmSlug: '' })).ok).toBe(false)
    expect(t.order).toEqual([])
  })
})

describe('lookupYouTubeChannel', () => {
  it('acha o canal e devolve o slug livre que o BANCO sugere para o handle', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ rpc: { youtube_channel_slug_pick: (a) => ({ data: a.p_handle === '@Viagem.BR' && a.p_site_id === SITE ? 'viagem-br' : 'errado', error: null }) } })
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@Viagem.BR' })).toEqual({ ok: true, channel: LOOKUP, slug: 'viagem-br' })
    expect(t.order).toEqual(['guard:edit', 'client'])
  })
  it('canal já cadastrado é dito já no lookup, com o slug', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ channels: [{ ...CH_PT, channel_id: 'UCnew' }] })
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: 'youtube.com/@tnfigueiredo' })).toEqual({ ok: false, error: 'This channel is already registered as “tnfigueiredo”.' })
  })
  it('o MESMO canal cadastrado em outro site não impede', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ channels: [{ ...CH_OTHER_SITE, channel_id: 'UCnew' }], rpc: { youtube_channel_slug_pick: () => ({ data: 'viagem-br', error: null }) } })
    expect((await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@Viagem.BR' })).ok).toBe(true)
  })
  it('o dado não existe — o lookup não acha canal', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ lookup: null })
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@nada' })).toEqual({ ok: false, error: 'Channel not found. Check the handle and try again.' })
  })
  it('o dado não existe — função de slug ou coluna ausentes no banco: o canal vem, sem sugestão de slug', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ noSlugColumn: true })
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@Viagem.BR' })).toEqual({ ok: true, channel: LOOKUP, slug: null })
  })
  it('sem YOUTUBE_API_KEY (variável apagada): diz que a chave não está configurada', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    delete process.env.YOUTUBE_API_KEY
    const t = setup()
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@x' })).toEqual({ ok: false, error: 'YouTube API key not configured' })
    expect(t.lookupChannelByHandle).not.toHaveBeenCalled()
  })
  it('cota estourada', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ lookup: new Error('quotaExceeded') })
    expect(await (await t.load()).lookupYouTubeChannel({ handleOrUrl: '@x' })).toEqual({ ok: false, error: 'YouTube API limit reached. Try again later.' })
  })
})

describe('guard: sem permissão de edição, toda action lança ANTES de criar o service client', () => {
  const calls: Array<[string, (m: Awaited<ReturnType<ReturnType<typeof setup>['load']>>) => Promise<unknown>]> = [
    ['lookupYouTubeChannel', m => m.lookupYouTubeChannel({ handleOrUrl: '@x' })],
    ['addYouTubeChannel', m => m.addYouTubeChannel(addInput() as never)],
    ['updateYouTubeChannelIdentity', m => m.updateYouTubeChannelIdentity({ channel_id: CH_PT.id, locale: 'pt', niche: null })],
    ['createYouTubeNiche', m => m.createYouTubeNiche({ label: 'Jogos', color: 'ameixa' })],
    ['getYouTubeChannelRemovalImpact', m => m.getYouTubeChannelRemovalImpact({ channelId: CH_PT.id })],
    ['removeYouTubeChannel', m => m.removeYouTubeChannel({ channelId: CH_PT.id, confirmSlug: 'viagem-br' })],
  ]
  it.each(calls)('%s', async (_name, call) => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const t = setup({ auth: { ok: false, reason: 'forbidden' } })
    await expect(call(await t.load())).rejects.toThrow('forbidden')
    expect(t.clientMock).not.toHaveBeenCalled()
    expect(t.lookupChannelByHandle).not.toHaveBeenCalled()
  })
})

describe('arquivo "use server"', () => {
  it('só exporta funções async', async () => {
    const t = setup()
    const mod = await t.load()
    for (const [name, v] of Object.entries(mod)) {
      expect(typeof v, name).toBe('function')
      expect((v as { constructor: { name: string } }).constructor.name, name).toBe('AsyncFunction')
    }
  })
})
