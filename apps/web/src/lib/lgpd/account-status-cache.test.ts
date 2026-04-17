import { describe, it, expect, vi } from 'vitest';
import { DirectQueryAccountStatusCache } from './account-status-cache';

function makeAdmin(banned_until: string | null) {
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { banned_until } }, error: null }),
      },
    },
  };
}

describe('DirectQueryAccountStatusCache', () => {
  it('get() returns "active" when banned_until is null', async () => {
    const admin = makeAdmin(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new DirectQueryAccountStatusCache(admin as any);
    expect(await cache.get('u1')).toBe('active');
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith('u1');
  });

  it('get() returns "banned" when banned_until is set', async () => {
    const admin = makeAdmin('infinity');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new DirectQueryAccountStatusCache(admin as any);
    expect(await cache.get('u1')).toBe('banned');
  });

  it('get() returns null when user does not exist', async () => {
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new DirectQueryAccountStatusCache(admin as any);
    expect(await cache.get('missing')).toBeNull();
  });

  it('set() is a no-op (cache-less shim)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new DirectQueryAccountStatusCache({} as any);
    await expect(cache.set('u1', 'active', 60_000)).resolves.toBeUndefined();
  });

  it('invalidate() is a no-op (cache-less shim)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new DirectQueryAccountStatusCache({} as any);
    await expect(cache.invalidate('u1')).resolves.toBeUndefined();
  });
});
