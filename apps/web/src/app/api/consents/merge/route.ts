import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '@/lib/lgpd/container';
import { getLogger } from '../../../../../lib/logger';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  anonymousId: z.string().regex(UUID_V4, 'invalid_uuid_v4'),
});

/**
 * POST /api/consents/merge
 *
 * Invoked once right after a user signs in to fold any anonymous consent
 * rows (captured pre-auth from the cookie banner) into their authenticated
 * identity. Backed by `merge_anonymous_consents(p_anonymous_id)` RPC
 * (spec Section 4) — the container takes care of the RPC plus the
 * `FOR UPDATE` race guard.
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

  try {
    const container = createLgpdContainer();
    const { mergedCount } = await container.consent.merge(
      parsed.anonymousId,
      user.id,
    );
    return NextResponse.json({ mergedCount }, { status: 200 });
  } catch (e) {
    getLogger().error('[lgpd_consent_merge_failed]', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: 'merge_failed' },
      { status: 500 },
    );
  }
}
