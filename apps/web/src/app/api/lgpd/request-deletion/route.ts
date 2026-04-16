import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
// Track B will publish this module; Phase-2 integration reconciles any
// shape drift. Tests mock this import with vi.mock('@/lib/lgpd/container').
import { createLgpdContainer } from '@/lib/lgpd/container';
import {
  verifyRecentlyVerified,
  LGPD_VERIFY_COOKIE_NAME,
} from '@/lib/lgpd/verify-cookie';
import { getLogger } from '../../../../../lib/logger';

/**
 * POST /api/lgpd/request-deletion
 *
 * Authenticated endpoint: starts the 3-phase deletion flow. The container
 * creates an `lgpd_requests` row with a sha256-hashed confirmation token,
 * sends the "confirmation" email with the raw token, and returns the token
 * expiry to the UI.
 *
 * Never returns the raw token — the email is the single source of truth.
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

  const container = createLgpdContainer();

  // Deletion safety gate (Fix 12): block the sole master_admin or any other
  // row the `check_deletion_safety` RPC flags as non-removable. Returns 409
  // with the blocker array so the UI can explain the reason.
  try {
    const safety = await container.domainAdapter.checkDeletionSafety(user.id);
    if (!safety.can_delete) {
      return NextResponse.json(
        {
          error: 'deletion_blocked',
          blockers: safety.blockers,
          ...(safety.details ? { details: safety.details } : {}),
        },
        { status: 409 },
      );
    }
  } catch (e) {
    getLogger().error('[lgpd_request_deletion_safety_failed]', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: 'safety_check_failed' },
      { status: 500 },
    );
  }

  try {
    const { requestId, expiresAt } = await container.accountDeletion.request(
      user.id,
    );
    return NextResponse.json(
      { requestId, expiresAt: expiresAt.toISOString() },
      { status: 202 },
    );
  } catch (e) {
    getLogger().error('[lgpd_request_deletion_failed]', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: 'request_failed' },
      { status: 500 },
    );
  }
}
