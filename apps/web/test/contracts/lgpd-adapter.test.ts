/**
 * Compile-time contract tests — each adapter must structurally satisfy the
 * interface it implements, even if someone accidentally drops a method or
 * widens a parameter. vitest's `expectTypeOf` produces no runtime work; the
 * assertions fail at `tsc --noEmit` / vitest's type-check step if the shapes
 * diverge.
 *
 * If these start failing after a package bump, the package broke the
 * interface — bump the adapter to match, don't widen the types here.
 */
import { describe, it, expectTypeOf } from 'vitest';
import type {
  ILgpdDomainAdapter,
  ILgpdAuditLogRepository,
  ILgpdEmailService,
  IAccountStatusCache,
} from '@tn-figueiredo/lgpd/interfaces';

import { BythiagoLgpdDomainAdapter } from '../../src/lib/lgpd/domain-adapter';
// Fix 7 (Sprint 5a): SupabaseLgpdRequestRepository was dead code — nothing
// called its methods since the use-case glue writes to `lgpd_requests`
// directly. The container now satisfies the `ILgpdRequestRepository` slot
// in LgpdConfig via a null-object (every method throws). No concrete class
// remains to contract-test here.
import { AuditLogLgpdRepository } from '../../src/lib/lgpd/audit-repo';
import { BrevoLgpdEmailService } from '../../src/lib/lgpd/email-service';
import { DirectQueryAccountStatusCache } from '../../src/lib/lgpd/account-status-cache';
import {
  SupabaseInactiveUserFinder,
  type IInactiveUserFinder,
} from '../../src/lib/lgpd/inactive-user-finder';

describe('LGPD adapter contracts', () => {
  it('BythiagoLgpdDomainAdapter satisfies ILgpdDomainAdapter', () => {
    expectTypeOf<BythiagoLgpdDomainAdapter>().toMatchTypeOf<ILgpdDomainAdapter>();
  });

  it('AuditLogLgpdRepository satisfies ILgpdAuditLogRepository', () => {
    expectTypeOf<AuditLogLgpdRepository>().toMatchTypeOf<ILgpdAuditLogRepository>();
  });

  it('BrevoLgpdEmailService satisfies ILgpdEmailService', () => {
    expectTypeOf<BrevoLgpdEmailService>().toMatchTypeOf<ILgpdEmailService>();
  });

  it('DirectQueryAccountStatusCache satisfies IAccountStatusCache', () => {
    expectTypeOf<DirectQueryAccountStatusCache>().toMatchTypeOf<IAccountStatusCache>();
  });

  it('SupabaseInactiveUserFinder satisfies (local) IInactiveUserFinder', () => {
    expectTypeOf<SupabaseInactiveUserFinder>().toMatchTypeOf<IInactiveUserFinder>();
  });
});
