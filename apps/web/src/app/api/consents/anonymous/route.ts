import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

// UUID v4 (RFC 4122) — 3rd group starts with "4", 4th group with "8", "9",
// "a", or "b" (i.e. the 12-bit "version" and 2-bit "variant" fields). We
// reject any other format so malicious clients cannot forge deterministic
// anonymous IDs to harvest someone else's consents later via merge.
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_ANY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  anonymous_id: z.string().regex(UUID_V4, 'invalid_uuid_v4'),
  categories: z.object({
    functional: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
  version: z.number().int().min(1).optional(),
  siteId: z.string().regex(UUID_ANY, 'invalid_site_id').optional().nullable(),
});

type Category = 'cookie_functional' | 'cookie_analytics' | 'cookie_marketing';

const CATEGORIES: Array<{ key: 'functional' | 'analytics' | 'marketing'; db: Category }> = [
  { key: 'functional', db: 'cookie_functional' },
  { key: 'analytics', db: 'cookie_analytics' },
  { key: 'marketing', db: 'cookie_marketing' },
];

async function resolveConsentTextId(
  admin: ReturnType<typeof getSupabaseServiceClient>,
  category: Category,
): Promise<string> {
  // Prefer the most recent version of the pt-BR text; fall back to the
  // canonical v1 id string the seed migration uses.
  try {
    const { data } = await admin
      .from('consent_texts')
      .select('id')
      .eq('category', category)
      .eq('locale', 'pt-BR')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { id?: string } | null;
    if (row?.id) return row.id;
  } catch {
    /* fall through to hardcoded default */
  }
  return `${category}_v1_pt-BR`;
}

/**
 * POST /api/consents/anonymous
 *
 * Pre-auth consent tracking. The cookie banner generates a random UUID v4
 * client-side and POSTs here with a batch of the three cookie categories
 * on every Accept/Reject/Save action. We upsert one `consents` row per
 * category — updating the existing active row when the user re-opens the
 * banner + changes toggles so audit is kept tight without stacking stale
 * withdrawn rows.
 */
export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;
  const siteId = parsed.siteId ?? null;

  try {
    const admin = getSupabaseServiceClient();
    let recorded = 0;

    for (const { key, db } of CATEGORIES) {
      // Functional is contract-locked → always true regardless of payload.
      const granted = key === 'functional' ? true : parsed.categories[key];
      const consentTextId = await resolveConsentTextId(admin, db);

      // Look up any existing active row for this (anonymous_id, category,
      // site_id) tuple — Postgres has no IS NOT DISTINCT FROM in supabase-js
      // query builder, so we split the site_id=null branch.
      let existingQ = admin
        .from('consents')
        .select('id')
        .eq('anonymous_id', parsed.anonymous_id)
        .eq('category', db)
        .is('withdrawn_at', null)
        .limit(1);
      existingQ = siteId == null ? existingQ.is('site_id', null) : existingQ.eq('site_id', siteId);
      const { data: existing, error: selErr } = (await existingQ.maybeSingle()) as {
        data: { id: string } | null;
        error: { message: string } | null;
      };
      if (selErr) {
        throw new Error(`select_existing_failed: ${selErr.message}`);
      }

      if (existing) {
        const { error: updErr } = await admin
          .from('consents')
          .update({
            granted,
            consent_text_id: consentTextId,
            granted_at: new Date().toISOString(),
            ip,
            user_agent: userAgent,
          })
          .eq('id', existing.id);
        if (updErr) throw new Error(`update_failed: ${updErr.message}`);
      } else {
        const row: Record<string, unknown> = {
          anonymous_id: parsed.anonymous_id,
          category: db,
          consent_text_id: consentTextId,
          granted,
          ip,
          user_agent: userAgent,
        };
        if (siteId) row.site_id = siteId;
        const { error: insErr } = await admin.from('consents').insert(row);
        if (insErr) throw new Error(`insert_failed: ${insErr.message}`);
      }
      recorded += 1;
    }

    return NextResponse.json({ recorded }, { status: 200 });
  } catch (e) {
    getLogger().error('[lgpd_consent_anonymous_failed]', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: 'consent_record_failed' },
      { status: 500 },
    );
  }
}
