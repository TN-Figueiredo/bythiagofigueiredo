import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('getSupabaseServiceClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    vi.resetModules();
  });

  it('returns a singleton client', async () => {
    const mod = await import('../../lib/supabase/service');
    const a = mod.getSupabaseServiceClient();
    const b = mod.getSupabaseServiceClient();
    expect(a).toBe(b);
  });

  it('throws when env is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mod = await import('../../lib/supabase/service');
    expect(() => mod.getSupabaseServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
