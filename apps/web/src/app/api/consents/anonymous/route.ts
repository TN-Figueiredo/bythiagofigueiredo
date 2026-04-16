import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLgpdContainer } from '@/lib/lgpd/container';
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
  anonymousId: z.string().regex(UUID_V4, 'invalid_uuid_v4'),
  category: z.enum(['functional', 'analytics', 'marketing']),
  granted: z.boolean(),
  siteId: z.string().regex(UUID_ANY, 'invalid_site_id'),
});

/**
 * POST /api/consents/anonymous
 *
 * Pre-auth consent tracking. The cookie banner generates a random UUID v4
 * client-side and POSTs here on every toggle. The container inserts via
 * service-role (RLS on `consents` only allows authenticated INSERTs).
 */
export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const container = createLgpdContainer();
    await container.consent.recordAnonymous(
      parsed.anonymousId,
      parsed.category,
      parsed.granted,
      parsed.siteId,
    );
    return NextResponse.json({ ok: true }, { status: 201 });
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
