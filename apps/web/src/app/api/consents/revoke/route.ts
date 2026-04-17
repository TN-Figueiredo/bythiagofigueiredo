import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

const UUID_ANY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  category: z.enum([
    'cookie_functional',
    'cookie_analytics',
    'cookie_marketing',
    'newsletter',
    'privacy_policy',
    'terms_of_service',
  ]),
  siteId: z.string().regex(UUID_ANY, 'invalid_site_id').optional().nullable(),
});

/**
 * POST /api/consents/revoke
 *
 * LGPD Art. 18 (IX) right-to-withdraw. Authenticated endpoint — marks any
 * active consent row for the caller matching (category, site_id) as
 * withdrawn. Functional cookies cannot truly be revoked while the account
 * exists (LGPD Art. 9 contract-execution basis), but we still allow the
 * audit row to be flipped so the user's self-service history is honest.
 *
 * Returns:
 *   200 { revoked: true }       — at least one active consent was withdrawn
 *   400 { error: 'invalid_body' }
 *   401 { error: 'unauthenticated' }
 *   404 { error: 'not_found' }  — no active consent matched
 *   500 { error: 'revoke_failed' }
 */
export async function POST(req: Request): Promise<Response> {
  const cookieStore = await cookies();
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  let user: { id: string; email: string };
  try {
    user = await requireUser(supabase);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const siteId = parsed.siteId ?? null;

  try {
    const admin = getSupabaseServiceClient();

    // Flip `withdrawn_at` on any currently-active consent for this user +
    // category + site_id. supabase-js has no `IS NOT DISTINCT FROM` so we
    // branch on siteId==null.
    let updateQ = admin
      .from('consents')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('category', parsed.category)
      .is('withdrawn_at', null);
    updateQ = siteId == null ? updateQ.is('site_id', null) : updateQ.eq('site_id', siteId);

    const { data, error } = (await updateQ.select('id')) as {
      data: Array<{ id: string }> | null;
      error: { message: string } | null;
    };
    if (error) {
      throw new Error(`update_failed: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ revoked: true }, { status: 200 });
  } catch (e) {
    getLogger().error('[lgpd_consent_revoke_failed]', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: 'revoke_failed' },
      { status: 500 },
    );
  }
}
