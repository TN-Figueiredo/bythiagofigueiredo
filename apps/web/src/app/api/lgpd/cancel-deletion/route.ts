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
 * Callback invoked from the "cancel" link embedded in D+7/D+14 reminder
 * emails. The container's `cancel()` internally calls the
 * `cancel_account_deletion_in_grace(p_token_hash)` RPC (which atomically
 * flips the request row to `cancelled`). We then unban the auth user so
 * they can sign in again.
 *
 * IMPORTANT UX caveat (spec Flow 2): anonymized / reassigned content does
 * NOT revert — cancellation restores sign-in only.
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
    // Track B may evolve cancel() to return { userId } — tolerate both
    // shapes so Phase 2 integration doesn't require a route edit.
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
