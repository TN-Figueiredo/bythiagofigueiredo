import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '@/lib/lgpd/container';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

const BodySchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /api/lgpd/cancel-deletion
 *
 * Callback invoked from the "cancel" link embedded in D+7/D+14 reminder
 * emails. The container's `cancel()` internally calls the
 * `cancel_account_deletion_in_grace(p_token_hash)` RPC (which atomically
 * flips the request row to `cancelled`). We then unban the auth user so
 * they can sign in again.
 *
 * IMPORTANT UX caveat (spec Flow 2): anonymized / reassigned content does
 * NOT revert — cancellation restores sign-in only.
 *
 * Fix 13 (Sprint 5a): adds auth gate + token-ownership check. Required to
 * stop a third party with a leaked cancel token from un-banning a victim
 * account they shouldn't own.
 */
export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Auth gate — caller must be signed in. Note: phase-1 banned the user's
  // sign-in, but cancellation happens DURING the 15-day grace window when
  // the ban hasn't yet "stuck" on the client (old session still has valid
  // access token). The server MUST re-verify via requireUser which reads
  // fresh session state. A banned user's refresh will fail → 401 here.
  const cookieStore = await cookies();
  const serverClient = createServerClient({
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

  let authed: { id: string; email: string };
  try {
    authed = await requireUser(serverClient);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }

  try {
    const container = createLgpdContainer();
    // Track B may evolve cancel() to return { userId } — tolerate both
    // shapes so Phase 2 integration doesn't require a route edit.
    const result = (await container.accountDeletion.cancel(parsed.token)) as
      | { userId?: string }
      | void;
    const userId = result && typeof result === 'object' ? result.userId : undefined;

    // Token ownership check: when the RPC resolved a concrete user_id,
    // the caller's auth.uid() must match. If we can't resolve (legacy
    // void shape), fall through and log — the ban remains in place.
    if (userId && userId !== authed.id) {
      getLogger().warn('[lgpd_cancel_token_ownership_mismatch]', {
        authedId: authed.id,
        resolvedId: userId,
      });
      return NextResponse.json(
        { error: 'token_ownership_mismatch' },
        { status: 403 },
      );
    }

    if (userId) {
      try {
        const supabase = getSupabaseServiceClient();
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });
        if (error) {
          getLogger().warn('[lgpd_cancel_unban_failed]', {
            message: error.message,
            userId,
          });
        }
      } catch (unbanErr) {
        getLogger().warn('[lgpd_cancel_unban_threw]', {
          message:
            unbanErr instanceof Error ? unbanErr.message : String(unbanErr),
          userId,
        });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid_token|expired|not_found|not_in_grace/i.test(msg)) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 410 });
    }
    getLogger().error('[lgpd_cancel_deletion_failed]', { message: msg });
    return NextResponse.json({ error: 'cancel_failed' }, { status: 500 });
  }
}
