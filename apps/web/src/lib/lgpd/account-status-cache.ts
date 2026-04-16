import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAccountStatusCache } from '@tn-figueiredo/lgpd/interfaces';

/**
 * Null-object implementation of IAccountStatusCache.
 *
 * Sprint 5a ships without Upstash Redis — we skip the in-process cache entirely
 * and resolve account status by querying Supabase Auth on every call
 * (`auth.admin.getUserById`). `set` and `invalidate` are intentional no-ops.
 *
 * The only status we model is "active" vs "banned" (banned_until IS NOT NULL
 * covers the phase-1 deletion + admin-disabled cases). Downstream use-cases
 * only need a string, so "active" | "banned" is a safe domain vocabulary.
 * Returns `null` when the user row doesn't exist (post-phase-3 hard delete).
 */
export class DirectQueryAccountStatusCache implements IAccountStatusCache {
  constructor(private readonly admin: SupabaseClient) {}

  async get(userId: string): Promise<string | null> {
    const { data } = await this.admin.auth.admin.getUserById(userId);
    if (!data?.user) return null;
    return data.user.banned_until ? 'banned' : 'active';
  }

  async set(_userId: string, _status: string, _ttlMs: number): Promise<void> {
    /* no-op — direct query, no cache */
  }

  async invalidate(_userId: string): Promise<void> {
    /* no-op — direct query, no cache */
  }
}
