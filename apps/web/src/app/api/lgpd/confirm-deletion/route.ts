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

// Supabase auth.admin `ban_duration` accepts a Go-style duration string.
// 876000h ≈ 100 years — the canonical "indefinite ban" value documented
// in the supabase/auth-js source (see spec Section 1 v2 note).
const INDEFINITE_BAN_DURATION = '876000h';

/**
 * POST /api/lgpd/confirm-deletion
 *
 * Callback invoked from the tokenized confirmation email (via the
 * /lgpd/confirm/[token] page). Validates the token through the container,
 * which runs `lgpd_phase1_cleanup` atomically, then effectively revokes
 * the user's sessions by banning the account for ~100 years.
 *
 * Fix 13 (Sprint 5a): adds auth gate + token-ownership check. Anyone who
 * intercepted the raw token previously could confirm another user's
 * deletion — now only the owner (matched by auth.uid()) can.
 */
export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Auth gate — caller must be signed in.
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
    const { userId, scheduledPurgeAt } =
      await container.accountDeletion.confirm(parsed.token);

    // Token ownership check: only the account owner may confirm the
    // deletion of their own account. Defense in depth against leaked
    // / phished tokens.
    if (userId !== authed.id) {
      getLogger().warn('[lgpd_confirm_token_ownership_mismatch]', {
        authedId: authed.id,
        resolvedId: userId,
      });
      return NextResponse.json(
        { error: 'token_ownership_mismatch' },
        { status: 403 },
      );
    }

    // Post-phase-1: kill all refresh tokens + future sign-ins via ban.
    // Best-effort — phase 1 already succeeded, so even if the ban fails
    // we still return 200 and let the cron sweep's phase 3 retry close
    // any loose ends.
    const supabase = getSupabaseServiceClient();
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: INDEFINITE_BAN_DURATION,
      });
      if (error) {
        getLogger().warn('[lgpd_confirm_ban_failed]', {
          message: error.message,
          userId,
        });
      }
    } catch (banErr) {
      getLogger().warn('[lgpd_confirm_ban_threw]', {
        message: banErr instanceof Error ? banErr.message : String(banErr),
        userId,
      });
    }

    // Fix 15 (Sprint 5a): actively revoke all outstanding sessions so
    // the user's current browser tab (and any other signed-in device)
    // can't keep making API calls with the still-valid access token
    // until it naturally expires. Ban prevents NEW sign-ins; signOut
    // kills EXISTING sessions. Try `admin.signOut(userId, 'global')`
    // first (spec signature — some supabase-js forks ship this), and
    // fall back to deleting rows from `auth.sessions` directly when
    // the call throws or is missing.
    const adminAuth = supabase.auth.admin as unknown as {
      signOut?: (userId: string, scope?: 'global' | 'local') => Promise<{ error: unknown }>;
    };
    let sessionsRevoked = false;
    if (typeof adminAuth.signOut === 'function') {
      try {
        const out = await adminAuth.signOut(userId, 'global');
        if (!out || !(out as { error?: unknown }).error) {
          sessionsRevoked = true;
        } else {
          getLogger().warn('[lgpd_confirm_signout_failed]', {
            message: String(
              (out as { error?: { message?: string } }).error?.message ?? 'unknown',
            ),
            userId,
          });
        }
      } catch (soErr) {
        getLogger().warn('[lgpd_confirm_signout_threw]', {
          message: soErr instanceof Error ? soErr.message : String(soErr),
          userId,
        });
      }
    }
    if (!sessionsRevoked) {
      // Fallback: drop the rows manually — service-role can access
      // `auth.sessions`. Wrapped in try/catch because the schema / column
      // names may drift on future supabase versions.
      try {
        await (supabase as unknown as {
          from: (t: string) => {
            delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
          };
        })
          .from('auth.sessions')
          .delete()
          .eq('user_id', userId);
      } catch (sessDelErr) {
        getLogger().warn('[lgpd_confirm_session_delete_failed]', {
          message:
            sessDelErr instanceof Error ? sessDelErr.message : String(sessDelErr),
          userId,
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        scheduledPurgeAt: scheduledPurgeAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Token issues (invalid / expired / already consumed) return HTTP 410.
    if (/invalid_token|expired|not_found|already_consumed/i.test(msg)) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 410 });
    }
    getLogger().error('[lgpd_confirm_deletion_failed]', { message: msg });
    return NextResponse.json({ error: 'confirm_failed' }, { status: 500 });
  }
}
