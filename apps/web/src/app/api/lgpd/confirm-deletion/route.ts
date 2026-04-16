import { NextResponse } from 'next/server';
import { z } from 'zod';
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
    const { userId, scheduledPurgeAt } =
      await container.accountDeletion.confirm(parsed.token);

    // Post-phase-1: kill all refresh tokens + future sign-ins via ban.
    // Best-effort — phase 1 already succeeded, so even if the ban fails
    // we still return 200 and let the cron sweep's phase 3 retry close
    // any loose ends.
    try {
      const supabase = getSupabaseServiceClient();
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
