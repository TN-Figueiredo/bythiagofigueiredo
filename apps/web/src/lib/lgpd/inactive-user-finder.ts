import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Local interface — not exported by @tn-figueiredo/lgpd@0.1.0, but the design
 * spec §Architecture calls for a 6th adapter that walks auth.users and
 * surfaces stale accounts for the cleanup sweep. Keeping the shape here means
 * the package can adopt it verbatim in a future minor bump.
 */
export interface InactiveUser {
  id: string;
  email: string | null;
  last_sign_in_at: string | null;
}

export interface IInactiveUserFinder {
  /**
   * Returns users whose `last_sign_in_at` is older than `now() - inactiveDays`.
   * Users who never signed in (`last_sign_in_at` is null) are NOT returned —
   * we treat them as "fresh" rather than immediately eligible for cleanup.
   */
  findInactiveSince(
    inactiveDays: number,
    opts?: { page?: number; perPage?: number },
  ): Promise<InactiveUser[]>;
}

/**
 * Supabase Auth has no SQL-level query — we go through `auth.admin.listUsers`
 * (paginated REST call) and filter client-side by `last_sign_in_at`. Callers
 * should page through when the user base grows past a page.
 */
export class SupabaseInactiveUserFinder implements IInactiveUserFinder {
  constructor(private readonly admin: SupabaseClient) {}

  async findInactiveSince(
    inactiveDays: number,
    opts?: { page?: number; perPage?: number },
  ): Promise<InactiveUser[]> {
    const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
    const listArgs = opts?.page !== undefined || opts?.perPage !== undefined
      ? { page: opts.page, perPage: opts.perPage }
      : undefined;

    const { data, error } = listArgs
      ? await this.admin.auth.admin.listUsers(listArgs)
      : await this.admin.auth.admin.listUsers();

    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }

    const users = data?.users ?? [];
    return users
      .filter((u) => {
        if (!u.last_sign_in_at) return false;
        const t = Date.parse(u.last_sign_in_at);
        return Number.isFinite(t) && t < cutoff;
      })
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));
  }
}
