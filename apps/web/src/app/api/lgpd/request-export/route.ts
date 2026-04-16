import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '@/lib/lgpd/container';
import {
  verifyRecentlyVerified,
  LGPD_VERIFY_COOKIE_NAME,
} from '@/lib/lgpd/verify-cookie';
import { getLogger } from '../../../../../lib/logger';

/**
 * POST /api/lgpd/request-export
 *
 * Synchronous data export (spec Flow 3): collects user data, uploads to
 * `lgpd-exports/{user_id}/{request_id}.json`, and emails a signed URL.
 * All heavy lifting happens in `container.dataExport.request(userId)` —
 * the route is just an auth gate + response translator.
 *
 * The signed URL is never returned to the HTTP caller; it's only
 * delivered via email so we don't leak it in session storage / history.
 *
 * Error mapping:
 *  - rate_limited          → 429 (LGPD allows 1/30d; container enforces)
 *  - pending_deletion      → 409 (export blocked while deletion is in-flight)
 *  - anything else         → 500
 */
export async function POST(req: Request): Promise<Response> {
  void req;
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

  // Fix 14 (Sprint 5a): enforce fresh password re-auth via signed cookie.
  const verifyCookie = cookieStore.get(LGPD_VERIFY_COOKIE_NAME)?.value;
  if (!verifyRecentlyVerified(verifyCookie, user.id)) {
    return NextResponse.json(
      { error: 'password_reauth_required' },
      { status: 403 },
    );
  }

  try {
    const container = createLgpdContainer();
    const { requestId, expiresAt } = await container.dataExport.request(
      user.id,
    );
    return NextResponse.json(
      { requestId, expiresAt: expiresAt.toISOString() },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rate_limited|rate_limit/i.test(msg)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    if (/pending_deletion|deletion_in_progress/i.test(msg)) {
      return NextResponse.json(
        { error: 'pending_deletion' },
        { status: 409 },
      );
    }
    getLogger().error('[lgpd_request_export_failed]', { message: msg });
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
