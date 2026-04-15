import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseCampaignRepository } from '../../src/supabase/campaign-repository'

/**
 * Builder for a fake Supabase client that is sufficient to exercise the
 * repository without hitting the DB. The `terminalResults` queue lets a test
 * enqueue the result that the next terminal call (maybeSingle / single / the
 * end-of-chain eq for update+delete / the end-of-chain order for list) will
 * resolve to.
 */
function makeFakeClient() {
  const terminalResults: Array<{ data?: unknown; error?: unknown }> = []
  const insertArgs: Array<{ table: string; row: unknown }> = []
  const updateArgs: Array<{ table: string; patch: unknown }> = []
  const eqArgs: Array<[string, unknown]> = []
  const rangeArgs: Array<[number, number]> = []
  let currentTable = ''

  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    const thenable = (methodName: string) => {
      return () => {
        const next = terminalResults.shift() ?? { data: null, error: null }
        return Promise.resolve(next)
      }
    }
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn((col: string, val: unknown) => {
      eqArgs.push([col, val])
      return chain
    })
    chain.ilike = vi.fn(() => chain)
    chain.order = vi.fn(() => {
      const next = terminalResults.shift() ?? { data: [], error: null }
      return Promise.resolve(next)
    })
    chain.range = vi.fn((from: number, to: number) => {
      rangeArgs.push([from, to])
      return chain
    })
    chain.maybeSingle = vi.fn(thenable('maybeSingle'))
    chain.single = vi.fn(thenable('single'))
    chain.insert = vi.fn((row: unknown) => {
      insertArgs.push({ table: currentTable, row })
      return chain
    })
    chain.update = vi.fn((patch: unknown) => {
      updateArgs.push({ table: currentTable, patch })
      return chain
    })
    chain.delete = vi.fn(() => chain)
    // Make `update(...).eq(...)` and `delete(...).eq(...)` awaitable
    // when there are no further eq calls. We attach `then` lazily via
    // the chain's eq — but simpler: expose a terminal promise via eq
    // when followed by await.
    return chain
  }
  const chain = makeChain()
  const client = {
    from: vi.fn((table: string) => {
      currentTable = table
      return chain
    }),
  }
  return { client, chain, terminalResults, insertArgs, updateArgs, eqArgs, rangeArgs }
}

function sampleRow() {
  return {
    id: 'c1',
    site_id: 's1',
    interest: 'lead_magnet',
    status: 'published',
    pdf_storage_path: null,
    brevo_list_id: null,
    brevo_template_id: null,
    form_fields: [],
    scheduled_for: null,
    published_at: '2026-04-01',
    created_at: '2026-04-01',
    updated_at: '2026-04-01',
    created_by: null,
    updated_by: null,
    campaign_translations: [
      {
        id: 'ct1',
        campaign_id: 'c1',
        locale: 'pt-BR',
        slug: 'lanc',
        meta_title: 'T',
        meta_description: null,
        og_image_url: null,
        main_hook_md: 'hook',
        supporting_argument_md: null,
        introductory_block_md: null,
        body_content_md: null,
        form_intro_md: null,
        form_button_label: 'Enviar',
        form_button_loading_label: 'Enviando...',
        context_tag: 'ctx',
        success_headline: 'ok',
        success_headline_duplicate: 'ok dup',
        success_subheadline: 'sub',
        success_subheadline_duplicate: 'sub dup',
        check_mail_text: 'check',
        download_button_label: 'dl',
        extras: null,
        created_at: '2026-04-01',
        updated_at: '2026-04-01',
      },
    ],
  }
}

/**
 * Write-path chain: update()/delete() terminate on the last eq() call. Our
 * fake chain's eq returns the chain — but since repo code does
 * `const { error } = await <chain>`, we make the chain thenable by attaching
 * `then` that resolves to the next queued terminal result.
 */
function makeWriteAwareClient() {
  const base = makeFakeClient()
  const { chain, terminalResults } = base
  // chain becomes thenable: awaiting `chain` (e.g. `await supabase.from().update().eq()`)
  // pops the next terminal. `maybeSingle()` / `single()` / `order()` return real
  // promises so their awaits are unaffected by this.
  ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    const next = terminalResults.shift() ?? { error: null }
    resolve(next)
  }
  return base
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SupabaseCampaignRepository', () => {
  it('list applies site+locale+status filters and pagination', async () => {
    const { client, terminalResults, eqArgs, rangeArgs } = makeFakeClient()
    terminalResults.push({
      data: [
        {
          id: 'c1',
          status: 'published',
          published_at: '2026-04-01',
          interest: 'lead_magnet',
          campaign_translations: [
            { locale: 'pt-BR', slug: 'lanc', meta_title: 'T', context_tag: 'ctx' },
          ],
        },
      ],
      error: null,
    })
    const repo = new SupabaseCampaignRepository(client as never)
    const items = await repo.list({
      siteId: 's1',
      locale: 'pt-BR',
      status: 'published',
      page: 2,
      perPage: 5,
    })
    expect(items).toHaveLength(1)
    expect(items[0]!.id).toBe('c1')
    expect(items[0]!.translation.slug).toBe('lanc')
    expect(eqArgs).toContainEqual(['site_id', 's1'])
    expect(eqArgs).toContainEqual(['status', 'published'])
    expect(rangeArgs[0]).toEqual([5, 9])
  })

  it('getById returns null when no row', async () => {
    const { client, terminalResults } = makeFakeClient()
    terminalResults.push({ data: null, error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    const result = await repo.getById('missing', 's1')
    expect(result).toBeNull()
  })

  it('getById maps nested campaign_translations and scopes by site_id', async () => {
    const { client, terminalResults, eqArgs } = makeFakeClient()
    terminalResults.push({ data: sampleRow(), error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    const c = await repo.getById('c1', 's1')
    expect(c).not.toBeNull()
    expect(c!.id).toBe('c1')
    expect(c!.translations).toHaveLength(1)
    expect(c!.translations[0]!.main_hook_md).toBe('hook')
    expect(eqArgs).toContainEqual(['id', 'c1'])
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('getBySlug filters by site_id + locale + slug', async () => {
    const { client, terminalResults, eqArgs } = makeFakeClient()
    terminalResults.push({ data: sampleRow(), error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    const c = await repo.getBySlug({ siteId: 's1', locale: 'pt-BR', slug: 'lanc' })
    expect(c).not.toBeNull()
    expect(eqArgs).toContainEqual(['site_id', 's1'])
    expect(eqArgs).toContainEqual(['campaign_translations.locale', 'pt-BR'])
    expect(eqArgs).toContainEqual(['campaign_translations.slug', 'lanc'])
  })

  it('create inserts into campaigns + campaign_translations then reloads', async () => {
    const { client, terminalResults, insertArgs } = makeWriteAwareClient()
    terminalResults.push({ data: { id: 'c1' }, error: null }) // single() after campaigns insert
    terminalResults.push({ error: null }) // await of campaign_translations insert chain
    terminalResults.push({ data: sampleRow(), error: null }) // getById reload
    const repo = new SupabaseCampaignRepository(client as never)
    const c = await repo.create({
      site_id: 's1',
      interest: 'lead_magnet',
      initial_translation: {
        locale: 'pt-BR',
        slug: 'lanc',
        main_hook_md: 'hook',
        context_tag: 'ctx',
        success_headline: 'ok',
        success_headline_duplicate: 'ok dup',
        success_subheadline: 'sub',
        success_subheadline_duplicate: 'sub dup',
        check_mail_text: 'check',
        download_button_label: 'dl',
      },
    })
    expect(c.id).toBe('c1')
    const tables = insertArgs.map((a) => a.table)
    expect(tables).toContain('campaigns')
    expect(tables).toContain('campaign_translations')
  })

  it('update applies parent patch and translation patch, scoped by site_id', async () => {
    const { client, chain, terminalResults, updateArgs, eqArgs } = makeWriteAwareClient()
    // parent update await → {error:null}; translation update await → {error:null}; then getById maybeSingle
    terminalResults.push({ error: null })
    terminalResults.push({ error: null })
    terminalResults.push({ data: sampleRow(), error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    await repo.update('c1', 's1', {
      status: 'published',
      translation: { locale: 'pt-BR', main_hook_md: 'new hook' },
    })
    expect(updateArgs[0]!.patch).toMatchObject({ status: 'published' })
    expect(updateArgs[1]!.patch).toMatchObject({ main_hook_md: 'new hook' })
    // Parent campaigns update narrows by both id and site_id.
    expect(eqArgs).toContainEqual(['id', 'c1'])
    expect(eqArgs).toContainEqual(['site_id', 's1'])
    void chain // keep ref
  })

  it('publish sets status=published and published_at, scoped by site_id', async () => {
    const { client, terminalResults, updateArgs, eqArgs } = makeWriteAwareClient()
    terminalResults.push({ error: null }) // update await
    terminalResults.push({ data: sampleRow(), error: null }) // getById
    const repo = new SupabaseCampaignRepository(client as never)
    const c = await repo.publish('c1', 's1')
    expect(c.status).toBe('published')
    expect(updateArgs[0]!.patch).toMatchObject({ status: 'published' })
    expect((updateArgs[0]!.patch as Record<string, unknown>).published_at).toBeTruthy()
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('unpublish resets status to draft and clears published_at', async () => {
    const { client, terminalResults, updateArgs, eqArgs } = makeWriteAwareClient()
    terminalResults.push({ error: null })
    terminalResults.push({
      data: { ...sampleRow(), status: 'draft', published_at: null },
      error: null,
    })
    const repo = new SupabaseCampaignRepository(client as never)
    const c = await repo.unpublish('c1', 's1')
    expect(c.status).toBe('draft')
    expect(updateArgs[0]!.patch).toMatchObject({ status: 'draft', published_at: null })
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('archive scopes by site_id', async () => {
    const { client, terminalResults, eqArgs } = makeWriteAwareClient()
    terminalResults.push({ error: null })
    terminalResults.push({ data: sampleRow(), error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    await repo.archive('c1', 's1')
    expect(eqArgs).toContainEqual(['id', 'c1'])
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('schedule scopes by site_id', async () => {
    const { client, terminalResults, updateArgs, eqArgs } = makeWriteAwareClient()
    terminalResults.push({ error: null })
    terminalResults.push({ data: sampleRow(), error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    const when = new Date('2026-05-01T00:00:00Z')
    await repo.schedule('c1', 's1', when)
    expect(updateArgs[0]!.patch).toMatchObject({
      status: 'scheduled',
      scheduled_for: when.toISOString(),
    })
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('delete issues delete + eq(id) + eq(site_id)', async () => {
    const { client, terminalResults, eqArgs } = makeWriteAwareClient()
    terminalResults.push({ error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    await repo.delete('c1', 's1')
    expect(eqArgs).toContainEqual(['id', 'c1'])
    expect(eqArgs).toContainEqual(['site_id', 's1'])
  })

  it('delete does not throw when the row has translations (cascade relies on DB FK)', async () => {
    // Mirrors the DB schema: campaign_translations.campaign_id has
    // `on delete cascade`, so deleting the parent row is a single statement.
    // This test simulates a successful cascade: the single DELETE resolves
    // without an error even though translations exist on the row.
    const { client, terminalResults } = makeWriteAwareClient()
    terminalResults.push({ error: null })
    const repo = new SupabaseCampaignRepository(client as never)
    await expect(repo.delete('c1', 's1')).resolves.not.toThrow()
  })

  it('update surfaces RPC/DB errors from unknown-patch-key rejections', async () => {
    const { client, terminalResults } = makeWriteAwareClient()
    // First parent update fails with the RPC's raise-exception message.
    terminalResults.push({ error: { message: 'update_campaign_atomic: unknown patch keys: bogus' } })
    const repo = new SupabaseCampaignRepository(client as never)
    await expect(
      repo.update('c1', 's1', {
        // use a real supported key — the fake client doesn't care which keys
        // are in the payload, it just returns the queued error.
        status: 'draft',
      }),
    ).rejects.toThrow(/unknown patch keys/)
  })
})
