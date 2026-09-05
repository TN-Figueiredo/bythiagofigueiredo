// @vitest-environment node
/**
 * DB-gated integration test for the Research API create/import path (WP-F).
 *
 * Proves the fix for the regression introduced by migration
 * 20260604000003_research_cms_redesign.sql: the CMS UI moved to
 * UNIQUE(site_id, theme_id, title) and the 'fresca' | 'analise' | 'aplicada' |
 * 'arquivada' status set, and made theme_id NOT NULL with no DB default — but
 * the REST/MCP service layer (createResearchItem / importResearchItems) kept
 * sending onConflict: 'site_id,topic_id,title' (a dropped constraint —
 * Postgres error 42P10 on every call), status: 'new' (violates the new
 * CHECK), and omitted theme_id entirely.
 *
 * The pre-existing unit test (test/api/pipeline/research-import-api.test.ts)
 * mocks the whole Supabase client with a chain whose .single() always
 * resolves {data:null,error:null} — no query ever reaches Postgres, so this
 * class of bug (ON CONFLICT target, CHECK constraint, NOT NULL) is invisible
 * to it. Only a real-Postgres integration test catches it, which is why this
 * suite runs against local Supabase instead of mocking.
 *
 * Run:
 *   npm run db:start
 *   HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/pipeline/research-create.integration.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../../helpers/db-seed'
import { createResearchItem, importResearchItems } from '@/lib/pipeline/services/research'
import { THEME_IDS } from '@/lib/pipeline/research-schemas'
import type { ServiceContext } from '@/lib/pipeline/services/types'

describe.skipIf(skipIfNoLocalDb())('createResearchItem / importResearchItems contra Postgres real (WP-F)', () => {
  let ctx: ServiceContext

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  beforeAll(async () => {
    const { siteId } = await seedSite(db)

    // research_items(theme_id, site_id) has a composite FK to research_themes.
    // Migration 20260604000003 only seeded the catalogue for sites that
    // already existed when it ran (CROSS JOIN sites) — a site created here,
    // after the fact, has no research_themes rows yet. Seed the same 6
    // canonical themes the migration uses so the FK resolves.
    const { error: themesError } = await db.from('research_themes').insert(
      THEME_IDS.map((id, i) => ({
        id,
        site_id: siteId,
        label: id,
        short: id,
        sort_order: i,
      })),
    )
    if (themesError) throw themesError

    ctx = {
      supabase: db,
      siteId,
      permissions: ['write'],
      source: 'api_key',
    }
  })

  it('insere com status valido e faz upsert no titulo repetido', async () => {
    const input = {
      title: `Curso Teste ${Date.now()}`,
      topic_slug: 'curso-teste',
      content_md: '# conteudo',
      theme_id: 'dev',
    }

    const first = await createResearchItem(ctx, input)
    expect(first.status).toBe(201)
    expect(first.data.status).toBe('fresca')
    expect(first.data.upserted).toBe(false)

    const second = await createResearchItem(ctx, input)
    expect(second.status).toBe(200)
    expect(second.data.id).toBe(first.data.id)
    expect(second.data.upserted).toBe(true)
  })

  it('usa canal como theme_id default quando omitido', async () => {
    const res = await createResearchItem(ctx, {
      title: `Sem tema ${Date.now()}`,
      topic_slug: 'curso-teste',
      content_md: 'x',
    })

    expect(res.status).toBe(201)
    expect(res.data.status).toBe('fresca')
  })

  it('importa lote sem violar CHECK nem NOT NULL', async () => {
    const res = await importResearchItems(ctx, {
      items: [
        {
          title: `Lote ${Date.now()}`,
          topic_slug: 'curso-teste',
          content_md: 'conteudo',
          theme_id: 'ia',
        },
      ],
    })

    expect(res.data.failure_count).toBe(0)
    expect(res.data.success_count).toBe(1)
    expect(res.data.results[0]?.ok).toBe(true)
  })
})
