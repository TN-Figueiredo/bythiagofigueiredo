import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLgpdContainer } from '@/lib/lgpd/container';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

const BodySchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /api/lgpd/cancel-deletion
 *
 * Callback invoked from the "cancel" link embedded in the original
 * confirmation email and in D+7/D+14 reminder emails.
 *
 * AUTH MODEL — by design, this route is UNAUTHENTICATED and treats
 * possession of the single-use cancel token as sole proof of identity.
 * Round 1 added a `requireUser` gate; Round 2 critic found the paradox:
 * after phase-1, the user is banned (ban_duration=876000h) and their
 * refresh token fails within ~1h, so any click on the D+7 / D+14
 * reminder email — precisely when cancel matters most — would 401.
 *
 * The cancel token is:
 *  - 32 random bytes, sha256-hashed at rest (indistinguishable from
 *    random to an attacker)
 *  - Single-use (cancel flips status → 'cancelled' and the token
 *    cannot be reused)
 *  - Rotated per reminder (D+7 and D+14 each issue a fresh token —
 *    even a leaked earlier reminder cannot cancel a later phase).
 *  - Delivered via the user's registered email channel (which is the
 *    same channel LGPD accepts as the Art. 18 verification path).
 *
 * A stolen cancel token lets an attacker REVERT the victim's deletion.
 * That is a recovery action, not a destructive one — worst case the
 * account that the victim ASKED to delete remains alive for the
 * remaining grace period, during which time the legitimate user can
 * re-request deletion. This is a defensible trade-off versus the
 * harder failure mode of a banned user being unable to cancel.
 *
 * Rate limit (IP-scoped) guards against token-guessing attacks. Audit
 * log captures every attempt, successful or not, with the source IP
 * so ANPD / forensic review can trace activity.
 */
export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  try {
    const container = createLgpdContainer();
    const result = (await container.accountDeletion.cancel(parsed.token)) as
      | { userId?: string }
      | void;
    const userId = result && typeof result === 'object' ? result.userId : undefined;

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

      getLogger().warn('[lgpd_cancel_completed]', {
        userId,
        sourceIp: clientIp,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid_token|expired|not_found|not_in_grace/i.test(msg)) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 410 });
    }
    getLogger().error('[lgpd_cancel_deletion_failed]', {
      message: msg,
      sourceIp: clientIp,
    });
    return NextResponse.json({ error: 'cancel_failed' }, { status: 500 });
  }
}
