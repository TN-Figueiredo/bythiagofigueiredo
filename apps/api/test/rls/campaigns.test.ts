import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, PG_URL, adminJwt } from '../helpers/local-supabase'
import { makeCampaign } from '../helpers/campaign-fixtures'
import { ensureSharedSites } from '../helpers/ring-fixtures'
import jwt from 'jsonwebtoken'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

// Ensure the SITE_A / SITE_B test sites exist to satisfy campaigns.site_id FK.
beforeAll(() => ensureSharedSites(admin))

// Track inserted campaign IDs for cleanup so this suite leaves no shared state.
const createdCampaignIds: string[] = []

describe.skipIf(skipIfNoLocalDb())('campaigns table schema', () => {
  afterAll(async () => {
    if (createdCampaignIds.length > 0) {
      await admin.from('campaigns').delete().in('id', createdCampaignIds)
    }
  })

  it('insert minimal row', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'creator' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('draft')
    expect(data?.form_fields).toEqual([])
    if (data?.id) createdCampaignIds.push(data.id)
  })

  it('reuses post_status enum from Sprint 1a', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'fitness', status: 'scheduled', scheduled_for: new Date().toISOString() })
      .select('id')
      .single()
    expect(error).toBeNull()
    if (data?.id) createdCampaignIds.push(data.id)
  })

  it('rejects invalid status value', async () => {
    const { error } = await admin
      .from('campaigns')
      .insert({ interest: 'style', status: 'bogus' as never })
    expect(error).not.toBeNull()
  })

  it('rejects unknown interest value', async () => {
    const { error } = await admin.from('campaigns').insert({ interest: 'notavalidinterest' })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/check|constraint|vocab/i)
  })
})

describe.skipIf(skipIfNoLocalDb())('campaign_translations FK cascade', () => {
  it('deleting a campaign cascades to its translations', async () => {
    const { data: c, error: cErr } = await admin
      .from('campaigns').insert({ interest: 'creator' }).select('id').single()
    expect(cErr).toBeNull()

    const baseTx = {
      campaign_id: c!.id, locale: 'pt-BR', slug: `cascade-${Date.now()}`,
      main_hook_md: '# hi',
      context_tag: 'OK', success_headline: 'a', success_headline_duplicate: 'b',
      success_subheadline: 'c', success_subheadline_duplicate: 'd',
      check_mail_text: 'e', download_button_label: 'f',
    }
    const { data: t, error: tErr } = await admin
      .from('campaign_translations').insert(baseTx).select('id').single()
    expect(tErr).toBeNull()
    const translationId = t!.id

    // Delete the parent campaign.
    const { error: delErr } = await admin.from('campaigns').delete().eq('id', c!.id)
    expect(delErr).toBeNull()

    // The translation must be gone.
    const { data: after, error: afterErr } = await admin
      .from('campaign_translations').select('id').eq('id', translationId)
    expect(afterErr).toBeNull()
    expect(after).toEqual([])
  })
})

describe.skipIf(skipIfNoLocalDb())('campaign_translations slug uniqueness per (site, locale)', () => {
  const SITE_A = '11111111-1111-1111-1111-111111111111'
  const ids: string[] = []

  afterAll(async () => {
    if (ids.length) await admin.from('campaigns').delete().in('id', ids)
  })

  const makeCampaignWithSite = (siteId: string | null) =>
    makeCampaign(admin, ids, { site_id: siteId })

  function tx(campaignId: string, locale: string, slug: string) {
    return {
      campaign_id: campaignId, locale, slug,
      main_hook_md: 'x',
      context_tag: 'x', success_headline: 'x', success_headline_duplicate: 'x',
      success_subheadline: 'x', success_subheadline_duplicate: 'x',
      check_mail_text: 'x', download_button_label: 'x',
    }
  }

  it('rejects duplicate (locale, slug) within the same site', async () => {
    const c1 = await makeCampaignWithSite(SITE_A)
    const c2 = await makeCampaignWithSite(SITE_A)
    const slug = `dup-${Date.now()}`
    const ins1 = await admin.from('campaign_translations').insert(tx(c1, 'pt-BR', slug))
    expect(ins1.error).toBeNull()
    const ins2 = await admin.from('campaign_translations').insert(tx(c2, 'pt-BR', slug))
    expect(ins2.error).not.toBeNull()
    expect(ins2.error!.message).toMatch(/duplicate slug|23505/i)
  })

  it('allows same (locale, slug) across different sites', async () => {
    const SITE_B = '22222222-2222-2222-2222-222222222222'
    const cA = await makeCampaignWithSite(SITE_A)
    const cB = await makeCampaignWithSite(SITE_B)
    const slug = `cross-${Date.now()}`
    const iA = await admin.from('campaign_translations').insert(tx(cA, 'pt-BR', slug))
    const iB = await admin.from('campaign_translations').insert(tx(cB, 'pt-BR', slug))
    expect(iA.error).toBeNull()
    expect(iB.error).toBeNull()
  })

  it('allows same slug across different locales on same site', async () => {
    const c = await makeCampaignWithSite(SITE_A)
    const slug = `multi-locale-${Date.now()}`
    const iPt = await admin.from('campaign_translations').insert(tx(c, 'pt-BR', slug))
    const iEn = await admin.from('campaign_translations').insert(tx(c, 'en', slug))
    expect(iPt.error).toBeNull()
    expect(iEn.error).toBeNull()
  })

  it('allows same (locale, slug) when both sites are null (global content)', async () => {
    const cX = await makeCampaignWithSite(null)
    const cY = await makeCampaignWithSite(null)
    const slug = `null-${Date.now()}`
    const iX = await admin.from('campaign_translations').insert(tx(cX, 'pt-BR', slug))
    const iY = await admin.from('campaign_translations').insert(tx(cY, 'pt-BR', slug))
    // IS NOT DISTINCT FROM treats both NULLs as equal → this should be REJECTED.
    // Blog pattern does the same. Adjust assertion if product disagrees.
    expect(iX.error).toBeNull()
    expect(iY.error).not.toBeNull()
  })
})

describe.skipIf(skipIfNoLocalDb())('campaigns RLS', () => {
  const SITE_A = '11111111-1111-1111-1111-111111111111'
  const SITE_B = '22222222-2222-2222-2222-222222222222'

  const createdIds: string[] = []
  let pubNullId: string
  let pubSiteAId: string
  let pubSiteBId: string
  let draftId: string

  beforeAll(async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const ins = async (payload: Record<string, unknown>) => {
      const { data, error } = await admin.from('campaigns').insert(payload).select('id').single()
      if (error || !data) throw error ?? new Error('insert failed')
      createdIds.push(data.id)
      return data.id
    }
    pubNullId = await ins({ interest: 'creator', status: 'published', published_at: past })
    pubSiteAId = await ins({ interest: 'creator', status: 'published', published_at: past, site_id: SITE_A })
    pubSiteBId = await ins({ interest: 'creator', status: 'published', published_at: past, site_id: SITE_B })
    draftId = await ins({ interest: 'creator', status: 'draft' })
  })

  afterAll(async () => {
    if (createdIds.length) await admin.from('campaigns').delete().in('id', createdIds)
  })

  it('anon reads only published campaigns in the past', async () => {
    const { data, error } = await anon.from('campaigns').select('id,status')
    expect(error).toBeNull()
    expect(data!.every((r) => r.status === 'published')).toBe(true)
    const ids = data!.map((r) => r.id)
    expect(ids).toContain(pubNullId)
    expect(ids).not.toContain(draftId)
  })

  it('anon cannot insert', async () => {
    const { error } = await anon.from('campaigns').insert({ interest: 'creator' })
    expect(error).not.toBeNull()
  })

  it('service role sees everything', async () => {
    const { data, error } = await admin.from('campaigns').select('id,status')
    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(draftId)
    expect(ids).toContain(pubNullId)
  })

  describe('site_id scoping via app.site_id GUC', () => {
    let pg: Client

    beforeAll(async () => {
      pg = new Client({ connectionString: PG_URL })
      await pg.connect()
    })

    afterAll(async () => {
      await pg.end()
    })

    it('anon with GUC=SITE_A sees only null-site + siteA published campaigns', async () => {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        await pg.query(`select set_config('app.site_id', $1, true)`, [SITE_A])
        const r = await pg.query<{ id: string }>('select id from public.campaigns')
        const ids = r.rows.map((x) => x.id)
        expect(ids).toContain(pubNullId)
        expect(ids).toContain(pubSiteAId)
        expect(ids).not.toContain(pubSiteBId)
        expect(ids).not.toContain(draftId)
      } finally {
        await pg.query('rollback')
      }
    })

    it('anon without GUC sees all published regardless of site', async () => {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        const r = await pg.query<{ id: string }>('select id from public.campaigns')
        const ids = r.rows.map((x) => x.id)
        expect(ids).toContain(pubNullId)
        expect(ids).toContain(pubSiteAId)
        expect(ids).toContain(pubSiteBId)
        expect(ids).not.toContain(draftId)
      } finally {
        await pg.query('rollback')
      }
    })
  })
})

describe.skipIf(skipIfNoLocalDb())('campaigns RLS: role differentiation', () => {
  const campaignIds: string[] = []
  let draftId: string

  beforeAll(async () => {
    const { data } = await admin
      .from('campaigns')
      .insert({ interest: 'creator', status: 'draft' })
      .select('id')
      .single()
    draftId = data!.id
    campaignIds.push(draftId)
  })

  afterAll(async () => {
    if (campaignIds.length) await admin.from('campaigns').delete().in('id', campaignIds)
  })

  function clientForRole(role: 'editor' | 'admin' | 'super_admin' | 'author' | 'user') {
    if (role === 'user') {
      const token = jwt.sign(
        {
          role: 'authenticated',
          sub: '00000000-0000-0000-0000-000000000099',
          app_metadata: { role: 'user' },
        },
        getLocalJwtSecret(),
        { expiresIn: '1h' }
      )
      return createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
    }
    return createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${adminJwt({ role })}` } },
    })
  }

  it.each([
    ['super_admin', true],
    ['admin', true],
    ['editor', true],
  ] as const)('%s sees draft campaigns (is_staff)', async (role, canSee) => {
    const client = clientForRole(role)
    const { data } = await client.from('campaigns').select('id').eq('id', draftId)
    expect((data ?? []).length === 1).toBe(canSee)
  })

  it.each([
    ['author', false],
    ['user', false],
  ] as const)('%s cannot see draft campaigns (non-staff)', async (role, canSee) => {
    const client = clientForRole(role)
    const { data } = await client.from('campaigns').select('id').eq('id', draftId)
    expect((data ?? []).length === 1).toBe(canSee)
  })
})

describe.skipIf(!process.env.HAS_LOCAL_DB)('dev seed', () => {
  it('seeds at least one published campaign with pt-BR + en translations', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .select('id, status, campaign_translations(locale, slug)')
      .eq('status', 'published');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    const seeded = data!.find(c =>
      (c.campaign_translations as Array<{ locale: string }>).some(t => t.locale === 'pt-BR')
      && (c.campaign_translations as Array<{ locale: string }>).some(t => t.locale === 'en'));
    expect(seeded).toBeTruthy();
  });

  it('seeds three submissions with mixed brevo_sync_status', async () => {
    const { data } = await admin
      .from('campaign_submissions')
      .select('brevo_sync_status');
    const statuses = new Set((data ?? []).map(r => r.brevo_sync_status));
    expect(statuses.has('synced')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
    expect(statuses.has('pending')).toBe(true);
  });
})

describe.skipIf(skipIfNoLocalDb())('campaigns site_id FK', () => {
  it('rejects campaign with non-existent site_id', async () => {
    const { error } = await admin.from('campaigns').insert({
      interest: 'creator',
      site_id: '99999999-9999-9999-9999-999999999999',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/foreign key|violates/i)
  })
})
