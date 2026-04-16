import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('createLgpdContainer', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    process.env.BREVO_API_KEY = 'brevo';
  });

  it('wires all 7 adapters and exposes a single LgpdConfig', async () => {
    const { createLgpdContainer } = await import('./container');
    const c = createLgpdContainer();

    // Returns an object with a config + adapters for the API routes to use
    expect(c.config).toBeDefined();
    expect(c.config.domainAdapter).toBeDefined();
    expect(c.config.lgpdRequestRepo).toBeDefined();
    expect(c.config.lgpdAuditLogRepo).toBeDefined();
    expect(c.config.emailService).toBeDefined();
    expect(c.config.accountStatusCache).toBeDefined();
    expect(c.config.rateLimiter).toBeDefined();
    expect(c.config.logger).toBeDefined();
    expect(c.inactiveUserFinder).toBeDefined();

    // Delay / expiry constants per spec §Architecture v2
    expect(c.config.phase2DelayDays).toBe(0);
    expect(c.config.phase3DelayDays).toBe(15);
    expect(c.config.exportExpiryDays).toBe(7);
    expect(c.config.inactiveWarningDays).toBe(365);
  });

  it('logger maps ILogger methods onto the structured logCron', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { createLgpdContainer } = await import('./container');
      const c = createLgpdContainer();
      c.config.logger.info('hello', { foo: 'bar' });
      c.config.logger.error('boom', { err: 'oops' });

      expect(spy).toHaveBeenCalled();
      expect(spyErr).toHaveBeenCalled();
      const infoLine = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(infoLine) as Record<string, unknown>;
      expect(parsed.status).toBe('ok');
      expect(parsed.message).toBe('hello');
    } finally {
      spy.mockRestore();
      spyErr.mockRestore();
    }
  });

  it('memoises the container on repeat calls (singleton)', async () => {
    const { createLgpdContainer } = await import('./container');
    const a = createLgpdContainer();
    const b = createLgpdContainer();
    expect(a).toBe(b);
  });
});
