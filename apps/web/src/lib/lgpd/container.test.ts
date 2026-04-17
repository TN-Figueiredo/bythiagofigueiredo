import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Shared supabase mock ---------------------------------------------------
//
// Every use-case test mocks the service-role client (`getSupabaseServiceClient`)
// + the email service + the domain adapter constructor. `makeAdmin()` returns
// a chainable spy matching the subset of the supabase-js API the container
// actually calls (from / insert / select / update / delete / eq / in / lt / gt
// / is / limit / maybeSingle / single / rpc / storage / auth.admin).

interface Scripted {
  /** Value returned by the terminal `await` of a chain (single/maybeSingle/no-op). */
  result?: unknown;
  /** Value returned by the terminal `await` for HEAD-count queries. */
  count?: number | null;
  /** Error for the current chain terminal. */
  error?: { message: string } | null;
}

function makeAdminMock(scripts: Record<string, Scripted[] | Scripted>) {
  // Each `from(table)` call returns a fresh chain that resolves to whatever
  // the test queued for that table. Tests assert on `.fromCalls` / `.inserts`
  // / `.updates` to verify side effects. Terminal methods (`.single`,
  // `.maybeSingle`, `.then` via `await`) resolve to `{ data, error, count }`.

  const state = {
    fromCalls: [] as Array<{ table: string }>,
    inserts: [] as Array<{ table: string; payload: unknown }>,
    updates: [] as Array<{ table: string; payload: unknown; filters: unknown[] }>,
    deletes: [] as Array<{ table: string; filters: unknown[] }>,
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
    storageUploads: [] as Array<{ bucket: string; path: string; body: unknown }>,
    storageRemovals: [] as Array<{ bucket: string; paths: string[] }>,
    storageSignedUrls: [] as Array<{ bucket: string; path: string; ttl: number }>,
    getUserCalls: [] as string[],
  };

  function queueShift(key: string): Scripted {
    const raw = scripts[key];
    if (Array.isArray(raw)) {
      const next = raw.shift();
      if (next === undefined) return { result: null, error: null };
      return next;
    }
    if (raw === undefined) return { result: null, error: null };
    return raw;
  }

  function makeQueryBuilder(table: string, op: 'select' | 'update' | 'delete' | 'insert') {
    const filters: unknown[] = [];
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    // Filter mutators — all return the chain.
    for (const m of [
      'eq',
      'neq',
      'in',
      'is',
      'not',
      'gt',
      'gte',
      'lt',
      'lte',
      'order',
      'limit',
      'or', // P1-1/P1-4: tokenLookup + cancel now .or(…) over hash fields.
    ]) {
      chain[m] = (...args: unknown[]) => {
        filters.push({ op: m, args });
        return chain;
      };
    }
    // Select on select/update/delete — continues chain, no terminal.
    chain.select = (..._args: unknown[]) => chain;
    // `.single()` / `.maybeSingle()` — terminal.
    chain.single = () => {
      const s = queueShift(`${op}:${table}:single`);
      return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
    };
    chain.maybeSingle = () => {
      const s = queueShift(`${op}:${table}:maybeSingle`);
      return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
    };
    // Plain `await` on the builder (for non-single reads / head-count).
    chain.then = (resolve: (v: unknown) => void) => {
      const s = queueShift(`${op}:${table}`);
      resolve({
        data: s.result ?? null,
        error: s.error ?? null,
        count: s.count ?? null,
      });
    };
    return { chain, filters };
  }

  const storage = {
    from: (bucket: string) => ({
      upload: (path: string, body: unknown) => {
        state.storageUploads.push({ bucket, path, body });
        const s = queueShift(`storage:upload:${bucket}`);
        return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
      },
      remove: (paths: string[]) => {
        state.storageRemovals.push({ bucket, paths });
        const s = queueShift(`storage:remove:${bucket}`);
        return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
      },
      createSignedUrl: (path: string, ttl: number) => {
        state.storageSignedUrls.push({ bucket, path, ttl });
        const s = queueShift(`storage:signed:${bucket}`);
        return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
      },
    }),
  };

  const admin = {
    from: (table: string) => {
      state.fromCalls.push({ table });
      return {
        insert: (payload: unknown) => {
          state.inserts.push({ table, payload });
          const { chain } = makeQueryBuilder(table, 'insert');
          return chain;
        },
        update: (payload: unknown) => {
          const { chain, filters } = makeQueryBuilder(table, 'update');
          state.updates.push({ table, payload, filters });
          return chain;
        },
        delete: () => {
          const { chain, filters } = makeQueryBuilder(table, 'delete');
          state.deletes.push({ table, filters });
          return chain;
        },
        select: (..._args: unknown[]) => {
          const { chain } = makeQueryBuilder(table, 'select');
          return chain;
        },
      };
    },
    rpc: (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      const s = queueShift(`rpc:${fn}`);
      return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
    },
    storage,
    auth: {
      admin: {
        getUserById: (id: string) => {
          state.getUserCalls.push(id);
          const s = queueShift(`auth:getUserById`);
          return Promise.resolve({ data: s.result ?? null, error: s.error ?? null });
        },
        updateUserById: () => Promise.resolve({ data: null, error: null }),
        deleteUser: () => Promise.resolve({ data: null, error: null }),
      },
    },
  };

  return { admin, state };
}

// Mock helpers shared across suites.
const sendFn = vi.fn<(...args: unknown[]) => Promise<void>>();

describe('createLgpdContainer', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    process.env.BREVO_API_KEY = 'brevo';
    process.env.NEXT_PUBLIC_APP_URL = 'https://site.test';
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('wires all 7 adapters and exposes a single LgpdConfig', async () => {
    const { createLgpdContainer } = await import('./container');
    const c = createLgpdContainer();

    expect(c.config).toBeDefined();
    expect(c.config.domainAdapter).toBeDefined();
    expect(c.config.lgpdRequestRepo).toBeDefined();
    expect(c.config.lgpdAuditLogRepo).toBeDefined();
    expect(c.config.emailService).toBeDefined();
    expect(c.config.accountStatusCache).toBeDefined();
    expect(c.config.rateLimiter).toBeDefined();
    expect(c.config.logger).toBeDefined();
    expect(c.inactiveUserFinder).toBeDefined();

    expect(c.config.phase2DelayDays).toBe(0);
    expect(c.config.phase3DelayDays).toBe(15);
    expect(c.config.exportExpiryDays).toBe(7);
    expect(c.config.inactiveWarningDays).toBe(365);
  });

  it('exposes use-case glue for accountDeletion, dataExport, consent, cleanupSweep, tokenLookup', async () => {
    const { createLgpdContainer } = await import('./container');
    const c = createLgpdContainer();
    expect(typeof c.accountDeletion.request).toBe('function');
    expect(typeof c.accountDeletion.confirm).toBe('function');
    expect(typeof c.accountDeletion.cancel).toBe('function');
    expect(typeof c.dataExport.request).toBe('function');
    expect(typeof c.dataExport.download).toBe('function');
    expect(typeof c.consent.recordAnonymous).toBe('function');
    expect(typeof c.consent.merge).toBe('function');
    expect(typeof c.cleanupSweep.advancePhase3).toBe('function');
    expect(typeof c.cleanupSweep.sendReminders).toBe('function');
    expect(typeof c.cleanupSweep.deleteExpiredBlobs).toBe('function');
    expect(typeof c.tokenLookup.resolve).toBe('function');
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

// --- Use-case glue: per-method unit tests -----------------------------------
//
// Each test reimports the container after swapping the supabase + email mock
// so we can script the interactions tightly. The domain adapter is wrapped
// in a thin stub so we can observe `phase1Cleanup`/`phase3Cleanup` calls
// without hitting the RPC layer.

async function loadWith(
  admin: ReturnType<typeof makeAdminMock>['admin'],
  extraEmailMock?: { send?: typeof sendFn },
) {
  vi.doMock('../../../lib/supabase/service', () => ({
    getSupabaseServiceClient: () => admin,
  }));
  const send = extraEmailMock?.send ?? sendFn;
  vi.doMock('../../../lib/email/service', () => ({
    getEmailService: () => ({ send }),
  }));
  const mod = await import('./container');
  mod.__resetLgpdContainerForTests();
  return mod.createLgpdContainer();
}

describe('accountDeletion.request', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    process.env.BREVO_API_KEY = 'brevo';
    process.env.NEXT_PUBLIC_APP_URL = 'https://site.test';
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('inserts a pending row, returns token + expiresAt, sends confirmation email', async () => {
    const { admin, state } = makeAdminMock({
      'auth:getUserById': { result: { user: { email: 'a@b.com' } } },
      'insert:lgpd_requests:single': { result: { id: 'req-1' } },
    });
    const c = await loadWith(admin);
    const res = await c.accountDeletion.request('u1');
    expect(res.requestId).toBe('req-1');
    expect(res.token).toHaveLength(64);
    expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const ins = state.inserts.find((i) => i.table === 'lgpd_requests');
    expect(ins).toBeDefined();
    const payload = ins!.payload as Record<string, unknown>;
    expect(payload.user_id).toBe('u1');
    expect(payload.type).toBe('account_deletion');
    expect(payload.status).toBe('pending');
    expect(typeof payload.confirmation_token_hash).toBe('string');
    expect(payload.confirmation_token_hash).not.toBe(res.token); // hashed
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('throws when getUserById fails', async () => {
    const { admin } = makeAdminMock({
      'auth:getUserById': { error: { message: 'offline' } },
    });
    const c = await loadWith(admin);
    await expect(c.accountDeletion.request('u1')).rejects.toThrow(/user lookup failed/i);
  });
});

describe('accountDeletion.confirm', () => {
  beforeEach(() => {
    vi.resetModules();
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('happy path: phase1Cleanup + transitions row to processing/phase=1', async () => {
    const futureIso = new Date(Date.now() + 3600_000).toISOString();
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'req-1',
          user_id: 'u1',
          metadata: { confirmation_expires_at: futureIso },
        },
      },
      // phase1Cleanup flows through domainAdapter — which calls getUserById + RPC.
      'auth:getUserById': { result: { user: { email: 'a@b.com' } } },
      'rpc:lgpd_phase1_cleanup': { result: null },
      // final update
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.accountDeletion.confirm('raw-token-xyz');
    expect(res.requestId).toBe('req-1');
    expect(res.userId).toBe('u1');
    expect(res.scheduledPurgeAt.getTime()).toBeGreaterThan(Date.now());

    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    expect(upd).toBeDefined();
    const p = upd!.payload as Record<string, unknown>;
    expect(p.status).toBe('processing');
    expect(p.phase).toBe(1);
    expect(p.phase_1_completed_at).toBeDefined();
  });

  it('throws invalid_token when lookup returns null', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': { result: null },
    });
    const c = await loadWith(admin);
    await expect(c.accountDeletion.confirm('bad')).rejects.toThrow(/invalid_token/);
  });

  it('throws expired when confirmation_expires_at is in the past', async () => {
    const pastIso = new Date(Date.now() - 3600_000).toISOString();
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'req-1',
          user_id: 'u1',
          metadata: { confirmation_expires_at: pastIso },
        },
      },
    });
    const c = await loadWith(admin);
    await expect(c.accountDeletion.confirm('stale')).rejects.toThrow(/expired/);
  });
});

describe('accountDeletion.cancel', () => {
  beforeEach(() => {
    vi.resetModules();
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('calls cancel RPC and returns userId + scheduledPurgeAt on success', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const { admin, state } = makeAdminMock({
      // P1-1: lookup by confirmation_token_hash OR metadata.cancel_token_hash
      // OR metadata.reminder_cancel_token_hash. The mock returns a row shaped
      // to include the confirmation_token_hash so the RPC receives the
      // original hash to do its FOR UPDATE cancel.
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'req-1',
          user_id: 'u1',
          confirmation_token_hash: 'stored-confirm-hash',
          metadata: {},
        },
      },
      'rpc:cancel_account_deletion_in_grace': {
        result: { cancelled: true, user_id: 'u1', scheduled_purge_at: future },
      },
      'auth:getUserById': { result: { user: { email: 'a@b.com' } } },
    });
    const c = await loadWith(admin);
    const res = await c.accountDeletion.cancel('raw-tok');
    expect(res.userId).toBe('u1');
    expect(res.scheduledPurgeAt.toISOString()).toBe(future);
    expect(state.rpcCalls[0]?.fn).toBe('cancel_account_deletion_in_grace');
  });

  it('throws not_in_grace when no row matches any token field (P1-1)', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': { result: null },
    });
    const c = await loadWith(admin);
    await expect(c.accountDeletion.cancel('tok')).rejects.toThrow(/not_in_grace/);
  });

  it('throws not_in_grace when the RPC signals cancelled:false', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'req-1',
          user_id: 'u1',
          confirmation_token_hash: 'stored-confirm-hash',
          metadata: {},
        },
      },
      'rpc:cancel_account_deletion_in_grace': { result: { cancelled: false } },
    });
    const c = await loadWith(admin);
    await expect(c.accountDeletion.cancel('tok')).rejects.toThrow(/not_in_grace/);
  });
});

describe('dataExport.request', () => {
  beforeEach(() => {
    vi.resetModules();
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('rate-limits when a completed export exists in the last 30d', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests': { count: 1 },
    });
    const c = await loadWith(admin);
    await expect(c.dataExport.request('u1')).rejects.toThrow(/rate_limited/);
  });

  it('happy path: inserts row, uploads blob, completes row, returns signedUrl', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': { count: 0 },
      // pending-deletion check
      'select:lgpd_requests:maybeSingle': { result: null },
      'insert:lgpd_requests:single': { result: { id: 'req-exp' } },
      // domainAdapter.collectUserData calls .auth.admin.getUserById + many `from(...).select().eq()` queries;
      // any unknown select returns { data: null, error: null }.
      'auth:getUserById': [
        { result: { user: { id: 'u1', email: 'a@b.com' } } }, // collectUserData
        { result: { user: { id: 'u1', email: 'a@b.com' } } }, // email send
      ],
      'storage:upload:lgpd-exports': { result: { path: 'u1/req-exp.json' } },
      'storage:signed:lgpd-exports': {
        result: { signedUrl: 'https://storage.local/signed?x=1' },
      },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.dataExport.request('u1');
    expect(res.requestId).toBe('req-exp');
    expect(res.signedUrl).toBe('https://storage.local/signed?x=1');
    expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(state.storageUploads[0]?.bucket).toBe('lgpd-exports');
    expect(state.storageUploads[0]?.path).toBe('u1/req-exp.json');
    expect(sendFn).toHaveBeenCalled(); // ExportReady email
  });

  it('throws pending_deletion when a deletion is already in flight', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests': { count: 0 },
      'select:lgpd_requests:maybeSingle': {
        result: { id: 'del-1', status: 'processing' },
      },
    });
    const c = await loadWith(admin);
    await expect(c.dataExport.request('u1')).rejects.toThrow(/pending_deletion/);
  });
});

describe('dataExport.download', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a fresh 10-min signed URL for a valid token', async () => {
    const now = new Date().toISOString();
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'req-exp',
          user_id: 'u1',
          type: 'data_export',
          status: 'completed',
          blob_path: 'u1/req-exp.json',
          blob_uploaded_at: now,
          blob_deleted_at: null,
        },
      },
      'storage:signed:lgpd-exports': {
        result: { signedUrl: 'https://s.local/fresh' },
      },
    });
    const c = await loadWith(admin);
    const res = await c.dataExport.download('tok');
    expect(res.signedUrl).toBe('https://s.local/fresh');
    expect(state.storageSignedUrls[0]?.ttl).toBe(600);
  });

  it('throws expired when blob_deleted_at is set', async () => {
    const now = new Date().toISOString();
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          blob_path: 'u1/req.json',
          blob_uploaded_at: now,
          blob_deleted_at: now,
        },
      },
    });
    const c = await loadWith(admin);
    await expect(c.dataExport.download('tok')).rejects.toThrow(/expired/);
  });
});

describe('consent.recordAnonymous', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('maps UI category onto DB cookie_* and inserts via admin client', async () => {
    const { admin, state } = makeAdminMock({
      // insert terminal — `.insert(...)` returns a chain that awaits to the `insert:consents` key.
      'insert:consents': { result: null },
    });
    const c = await loadWith(admin);
    await c.consent.recordAnonymous(
      'd9b2b3c4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'analytics',
      true,
      '00000000-0000-0000-0000-000000000001',
    );
    const ins = state.inserts.find((i) => i.table === 'consents');
    expect(ins).toBeDefined();
    const p = ins!.payload as Record<string, unknown>;
    expect(p.category).toBe('cookie_analytics');
    expect(p.consent_text_id).toBe('cookie_analytics_v2_pt-BR');
    expect(p.granted).toBe(true);
    expect(p.anonymous_id).toBe('d9b2b3c4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  });

  it('rejects non-v4 UUIDs to block consent-spoofing attempts', async () => {
    const { admin } = makeAdminMock({});
    const c = await loadWith(admin);
    await expect(
      c.consent.recordAnonymous('not-a-uuid', 'analytics', true),
    ).rejects.toThrow(/invalid_uuid_v4/);
  });
});

describe('consent.merge', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('moves anonymous rows to the authed user and returns mergedCount', async () => {
    const { admin, state } = makeAdminMock({
      'select:consents': {
        result: [
          {
            id: 'anon-1',
            category: 'cookie_analytics',
            site_id: null,
            consent_text_id: 'cookie_analytics_v2_pt-BR',
            granted: true,
            granted_at: '2026-04-16T10:00:00Z',
            ip: null,
            user_agent: null,
          },
        ],
      },
      // exists-check for existing user consent → count 0 (no conflict)
      'select:consents:': { count: 0 },
      'insert:consents': { result: null },
      'delete:consents': { result: null },
    });
    // The exists-check terminal goes through `then` — but it also routes to 'select:consents'.
    // We queue a second entry for the 'select:consents' key to handle the exists-check.
    const scripted = admin as unknown as {
      __queue?: unknown;
    };
    void scripted;

    const c = await loadWith(admin);
    const res = await c.consent.merge(
      'd9b2b3c4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'u1',
    );
    expect(res.mergedCount).toBe(1);
    const ins = state.inserts.find((i) => i.table === 'consents');
    expect(ins).toBeDefined();
    const p = ins!.payload as Record<string, unknown>;
    expect(p.user_id).toBe('u1');
    expect(p.category).toBe('cookie_analytics');
  });

  it('skips and deletes anonymous row when user already has a conflicting consent', async () => {
    const { admin, state } = makeAdminMock({
      'select:consents': [
        // first call: fetch anon rows
        {
          result: [
            {
              id: 'anon-1',
              category: 'cookie_analytics',
              site_id: null,
              consent_text_id: 'cookie_analytics_v2_pt-BR',
              granted: true,
              granted_at: '2026-04-16T10:00:00Z',
              ip: null,
              user_agent: null,
            },
          ],
        },
        // second call: exists-check — user already has one (count > 0)
        { count: 1 },
      ],
      'delete:consents': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.consent.merge(
      'd9b2b3c4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'u1',
    );
    expect(res.mergedCount).toBe(0);
    // No insert, just a delete of the anonymous row.
    expect(state.inserts.find((i) => i.table === 'consents')).toBeUndefined();
    expect(state.deletes.find((d) => d.table === 'consents')).toBeDefined();
  });
});

describe('cleanupSweep', () => {
  beforeEach(() => {
    vi.resetModules();
    sendFn.mockReset();
    sendFn.mockResolvedValue();
  });

  it('advancePhase3: advances each eligible row and calls phase3Cleanup', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': {
        result: [
          { id: 'r1', user_id: 'u1' },
          { id: 'r2', user_id: 'u2' },
        ],
      },
      'rpc:lgpd_phase3_prenullify_fks': { result: null },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.advancePhase3();
    expect(res.processed).toBe(2);
    const upds = state.updates.filter((u) => u.table === 'lgpd_requests');
    expect(upds.length).toBe(2);
    expect((upds[0]!.payload as Record<string, unknown>).status).toBe('completed');
  });

  it('advancePhase3: soft-completes immediately on a TERMINAL error (P1-3)', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': { result: [{ id: 'r1', user_id: 'u1' }] },
      // "foreign key" substring is recognised as terminal.
      'rpc:lgpd_phase3_prenullify_fks': {
        error: { message: 'foreign key violation on referring_table' },
      },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.advancePhase3();
    expect(res.processed).toBe(1);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    expect((upd!.payload as Record<string, unknown>).status).toBe('completed_soft');
    const meta = (upd!.payload as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >;
    expect(meta.soft_kind).toBe('terminal');
    expect(meta.phase3_attempts).toBe(1);
  });

  it('advancePhase3: TRANSIENT error bumps attempts + leaves status=processing (P1-3)', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': {
        result: [{ id: 'r1', user_id: 'u1', metadata: { phase3_attempts: 2 } }],
      },
      // 5xx-like message → transient classification.
      'rpc:lgpd_phase3_prenullify_fks': {
        error: { message: 'internal server error' },
      },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.advancePhase3();
    // Not yet soft-completed — attempts are below the cap of 5.
    expect(res.processed).toBe(0);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    const payload = upd!.payload as Record<string, unknown>;
    expect(payload.status).toBeUndefined();
    const meta = payload.metadata as Record<string, unknown>;
    expect(meta.phase3_attempts).toBe(3);
    expect(meta.phase3_last_error).toMatch(/internal server error/);
  });

  it('advancePhase3: TRANSIENT soft-completes after exhausting retries (P1-3)', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': {
        result: [{ id: 'r1', user_id: 'u1', metadata: { phase3_attempts: 4 } }],
      },
      'rpc:lgpd_phase3_prenullify_fks': {
        error: { message: 'service unavailable' },
      },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.advancePhase3();
    expect(res.processed).toBe(1);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    const payload = upd!.payload as Record<string, unknown>;
    expect(payload.status).toBe('completed_soft');
    const meta = payload.metadata as Record<string, unknown>;
    expect(meta.soft_kind).toBe('transient');
    expect(meta.phase3_attempts).toBe(5);
  });

  it('sendReminders: emails D+14 window rows and stamps reminder_d14_sent_at + rotating cancel hash (P1-1 / P1-2)', async () => {
    // D+14 bucket = scheduled_purge_at within 1d from now.
    const soonD14 = new Date(Date.now() + 12 * 3600_000).toISOString();
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': [
        // First query — D+7 bucket (no rows).
        { result: [] },
        // Second query — D+14 bucket (one row).
        {
          result: [
            {
              id: 'r1',
              user_id: 'u1',
              scheduled_purge_at: soonD14,
              confirmation_token_hash: 'hash',
              metadata: {},
            },
          ],
        },
      ],
      'auth:getUserById': { result: { user: { email: 'a@b.com' } } },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.sendReminders();
    expect(res.sent).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    expect(upd).toBeDefined();
    const p = upd!.payload as Record<string, unknown>;
    const meta = p.metadata as Record<string, unknown>;
    expect(meta.reminder_d14_sent_at).toBeDefined();
    // P1-1: rotating cancel token hash — a fresh sha256(hex) is stored on
    // every reminder send so a leaked older reminder cancel link loses
    // validity once a newer one is dispatched.
    expect(typeof meta.reminder_cancel_token_hash).toBe('string');
    expect((meta.reminder_cancel_token_hash as string).length).toBe(64);
  });

  it('sendReminders: emails D+7 window rows and stamps reminder_d7_sent_at (P1-2)', async () => {
    // D+7 bucket = scheduled_purge_at within 7d..8d from now.
    const soonD7 = new Date(Date.now() + 7.5 * 24 * 3600_000).toISOString();
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': [
        // First query — D+7 bucket (one row).
        {
          result: [
            {
              id: 'r7',
              user_id: 'u1',
              scheduled_purge_at: soonD7,
              confirmation_token_hash: 'hash',
              metadata: {},
            },
          ],
        },
        // Second query — D+14 bucket (no rows).
        { result: [] },
      ],
      'auth:getUserById': { result: { user: { email: 'a@b.com' } } },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.sendReminders();
    expect(res.sent).toBe(1);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    expect(upd).toBeDefined();
    const p = upd!.payload as Record<string, unknown>;
    const meta = p.metadata as Record<string, unknown>;
    expect(meta.reminder_d7_sent_at).toBeDefined();
  });

  it('sendReminders: skips rows that already have the bucket flag (P1-2)', async () => {
    const soonD14 = new Date(Date.now() + 12 * 3600_000).toISOString();
    const { admin } = makeAdminMock({
      'select:lgpd_requests': [
        // D+7 — no rows.
        { result: [] },
        // D+14 — already reminded.
        {
          result: [
            {
              id: 'r1',
              user_id: 'u1',
              scheduled_purge_at: soonD14,
              confirmation_token_hash: 'hash',
              metadata: { reminder_d14_sent_at: new Date().toISOString() },
            },
          ],
        },
      ],
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.sendReminders();
    expect(res.sent).toBe(0);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('deleteExpiredBlobs: removes blob + stamps blob_deleted_at', async () => {
    const { admin, state } = makeAdminMock({
      'select:lgpd_requests': {
        result: [{ id: 'r1', blob_path: 'u1/r1.json' }],
      },
      'storage:remove:lgpd-exports': { result: null },
      'update:lgpd_requests': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.deleteExpiredBlobs();
    expect(res.deleted).toBe(1);
    expect(state.storageRemovals[0]?.paths).toEqual(['u1/r1.json']);
    const upd = state.updates.find((u) => u.table === 'lgpd_requests');
    expect((upd!.payload as Record<string, unknown>).blob_deleted_at).toBeDefined();
  });

  it('deleteExpiredBlobs: logs warnings but does not throw on storage error', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests': {
        result: [{ id: 'r1', blob_path: 'u1/r1.json' }],
      },
      'storage:remove:lgpd-exports': { error: { message: 'boom' } },
    });
    const c = await loadWith(admin);
    const res = await c.cleanupSweep.deleteExpiredBlobs();
    expect(res.deleted).toBe(0);
  });
});

describe('tokenLookup.resolve', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when no row matches the token hash', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': { result: null },
    });
    const c = await loadWith(admin);
    const res = await c.tokenLookup.resolve('x');
    expect(res).toBeNull();
  });

  it('returns data_export + signedUrl for a completed export', async () => {
    const now = new Date().toISOString();
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'exp-1',
          user_id: 'u1',
          type: 'data_export',
          status: 'completed',
          scheduled_purge_at: null,
          blob_path: 'u1/exp-1.json',
          blob_uploaded_at: now,
          blob_deleted_at: null,
        },
      },
      'storage:signed:lgpd-exports': {
        result: { signedUrl: 'https://s.local/signed' },
      },
    });
    const c = await loadWith(admin);
    const res = await c.tokenLookup.resolve('tok');
    expect(res).toBeDefined();
    expect(res!.kind).toBe('data_export');
    if (res!.kind === 'data_export') {
      expect(res!.signedUrl).toBe('https://s.local/signed');
      expect(res!.userId).toBe('u1');
      expect(res!.requestId).toBe('exp-1');
    }
  });

  it('returns account_deletion_cancel for an in-grace deletion', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'del-1',
          user_id: 'u1',
          type: 'account_deletion',
          status: 'processing',
          scheduled_purge_at: new Date(Date.now() + 86400_000).toISOString(),
          blob_path: null,
          blob_uploaded_at: null,
          blob_deleted_at: null,
        },
      },
    });
    const c = await loadWith(admin);
    const res = await c.tokenLookup.resolve('tok');
    expect(res).toBeDefined();
    expect(res!.kind).toBe('account_deletion_cancel');
    if (res!.kind !== 'data_export') {
      expect(res!.userId).toBe('u1');
      expect(res!.type).toBe('account_deletion');
    }
  });

  it('returns account_deletion for a pending deletion (pre-confirm)', async () => {
    const { admin } = makeAdminMock({
      'select:lgpd_requests:maybeSingle': {
        result: {
          id: 'del-2',
          user_id: 'u1',
          type: 'account_deletion',
          status: 'pending',
          scheduled_purge_at: null,
          blob_path: null,
          blob_uploaded_at: null,
          blob_deleted_at: null,
        },
      },
    });
    const c = await loadWith(admin);
    const res = await c.tokenLookup.resolve('tok');
    expect(res!.kind).toBe('account_deletion');
  });
});
