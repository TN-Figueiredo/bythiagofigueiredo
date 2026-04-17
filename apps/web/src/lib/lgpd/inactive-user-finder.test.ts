import { describe, it, expect, vi } from 'vitest';
import { SupabaseInactiveUserFinder } from './inactive-user-finder';

function makeAdmin(rows: Array<{ id: string; email: string; last_sign_in_at: string | null }>) {
  const listUsers = vi.fn().mockResolvedValue({
    data: { users: rows, aud: 'authenticated', nextPage: null, lastPage: 1, total: rows.length },
    error: null,
  });
  return {
    auth: { admin: { listUsers } },
    _listUsers: listUsers,
  };
}

describe('SupabaseInactiveUserFinder', () => {
  it('returns users whose last_sign_in_at is older than cutoff', async () => {
    const now = new Date('2026-04-16T00:00:00Z');
    vi.useFakeTimers().setSystemTime(now);

    const admin = makeAdmin([
      { id: 'u1', email: 'a@x.com', last_sign_in_at: '2024-01-01T00:00:00Z' }, // inactive
      { id: 'u2', email: 'b@x.com', last_sign_in_at: '2026-04-10T00:00:00Z' }, // active
      { id: 'u3', email: 'c@x.com', last_sign_in_at: null }, // never signed in
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finder = new SupabaseInactiveUserFinder(admin as any);
    const result = await finder.findInactiveSince(365);
    expect(result.map((u) => u.id)).toEqual(['u1']);
    vi.useRealTimers();
  });

  it('returns empty array when everyone is active', async () => {
    const now = new Date('2026-04-16T00:00:00Z');
    vi.useFakeTimers().setSystemTime(now);

    const admin = makeAdmin([
      { id: 'u1', email: 'a@x.com', last_sign_in_at: '2026-04-15T00:00:00Z' },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finder = new SupabaseInactiveUserFinder(admin as any);
    const result = await finder.findInactiveSince(30);
    expect(result).toEqual([]);
    vi.useRealTimers();
  });

  it('throws when Supabase returns an error', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom', name: 'Error', status: 500 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: any = { auth: { admin: { listUsers } } };
    const finder = new SupabaseInactiveUserFinder(admin);
    await expect(finder.findInactiveSince(30)).rejects.toThrow(/boom/);
  });

  it('passes page options through to Supabase', async () => {
    const admin = makeAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finder = new SupabaseInactiveUserFinder(admin as any);
    await finder.findInactiveSince(30, { page: 2, perPage: 100 });
    expect(admin._listUsers).toHaveBeenCalledWith({ page: 2, perPage: 100 });
  });
});
