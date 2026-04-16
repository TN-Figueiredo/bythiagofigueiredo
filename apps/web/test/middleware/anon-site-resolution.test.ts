import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('middleware site resolution uses anon key', () => {
  it('does NOT instantiate service-role client in edge hot path', async () => {
    vi.resetModules();
    const serviceSpy = vi.fn();
    vi.doMock('@/lib/supabase/server', () => ({ getSupabaseServiceClient: serviceSpy }));
    const { middleware } = await import('@/middleware');
    const req = new NextRequest('https://a.test/cms/blog');
    await middleware(req);
    expect(serviceSpy).not.toHaveBeenCalled();
  });
});
