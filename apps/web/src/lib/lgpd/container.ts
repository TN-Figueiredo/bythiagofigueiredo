import type { LgpdConfig } from '@tn-figueiredo/lgpd/interfaces';
import { InMemoryRateLimiter } from '@tn-figueiredo/audit';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';
import { getEmailService } from '../../../lib/email/service';
import { logCron } from '../../../lib/logger';

import { BythiagoLgpdDomainAdapter } from './domain-adapter';
import { SupabaseLgpdRequestRepository } from './request-repo';
import { AuditLogLgpdRepository } from './audit-repo';
import { BrevoLgpdEmailService } from './email-service';
import { DirectQueryAccountStatusCache } from './account-status-cache';
import { SupabaseInactiveUserFinder, type IInactiveUserFinder } from './inactive-user-finder';

export interface LgpdContainer {
  /** Full LgpdConfig, ready to pass into @tn-figueiredo/lgpd use-case factories. */
  config: LgpdConfig;
  /**
   * Inactive-user finder is broken out separately because it's not part of
   * LgpdConfig in @tn-figueiredo/lgpd@0.1.0 — the cron-sweep route consumes it
   * directly alongside the container's use-cases.
   */
  inactiveUserFinder: IInactiveUserFinder;
  /** Concrete domain adapter — exposed for `checkDeletionSafety()` callers. */
  domainAdapter: BythiagoLgpdDomainAdapter;
}

let memo: LgpdContainer | null = null;

/**
 * Builds the Sprint 5a LGPD config wiring. Singleton — callers should not
 * keep the return value across test boundaries; `vi.resetModules()` clears it.
 *
 * Shape follows the design spec §Architecture v2:
 *   phase2DelayDays: 0       (hybrid-C — phase 2 is a no-op)
 *   phase3DelayDays: 15      (LGPD Art. 18 ≤ 45d budget)
 *   exportExpiryDays: 7
 *   inactiveWarningDays: 365
 *
 * `rateLimiter` defaults to the in-memory implementation from
 * `@tn-figueiredo/audit`. In production (Vercel serverless), cold starts
 * reset the window — the cron sweep and email re-sends absorb the noise,
 * and the real rate-limiting of critical flows (password verify, export
 * requests) is DB-backed via Sprint 4.75 advisory locks + partial unique
 * indices. Swap for `UpstashRateLimiter` when Upstash is provisioned.
 *
 * `logger` adapts our structured `logCron(event)` signature onto the
 * `ILogger.info/warn/error(msg, data)` shape expected by the use-cases.
 */
export function createLgpdContainer(): LgpdContainer {
  if (memo) return memo;

  const admin = getSupabaseServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com';
  const domainAdapter = new BythiagoLgpdDomainAdapter(admin);
  const inactiveUserFinder = new SupabaseInactiveUserFinder(admin);

  const config: LgpdConfig = {
    domainAdapter,
    lgpdRequestRepo: new SupabaseLgpdRequestRepository(admin),
    lgpdAuditLogRepo: new AuditLogLgpdRepository(admin),
    emailService: new BrevoLgpdEmailService(getEmailService(), {
      sender: { email: 'privacidade@bythiagofigueiredo.com', name: 'bythiagofigueiredo' },
      branding: { brandName: 'bythiagofigueiredo', siteUrl: appUrl },
    }),
    accountStatusCache: new DirectQueryAccountStatusCache(admin),
    rateLimiter: new InMemoryRateLimiter(),
    logger: {
      info: (msg, data) =>
        logCron({ job: 'lgpd', status: 'ok', message: msg, ...(data ?? {}) }),
      warn: (msg, data) =>
        logCron({ job: 'lgpd', status: 'ok', level: 'warn', message: msg, ...(data ?? {}) }),
      error: (msg, data) =>
        logCron({ job: 'lgpd', status: 'error', message: msg, ...(data ?? {}) }),
    },
    phase2DelayDays: 0,
    phase3DelayDays: 15,
    exportExpiryDays: 7,
    inactiveWarningDays: 365,
  };

  memo = { config, inactiveUserFinder, domainAdapter };
  return memo;
}

/** Test helper — reset the singleton between suites. */
export function __resetLgpdContainerForTests(): void {
  memo = null;
}
