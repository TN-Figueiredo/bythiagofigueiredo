import { describe, it, expect, vi } from 'vitest';
import { SupabaseLgpdRequestRepository } from './request-repo';

type Resolved<T> = { data: T; error: null } | { data: null; error: { message: string } };

function builder() {
  const b = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn().mockReturnThis(),
    // Terminal helpers for counting
    head: vi.fn(),
  };
  return b;
}

function makeSupabase() {
  const b = builder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = { from: vi.fn().mockReturnValue(b) };
  return { client, b };
}

const dbRow = {
  id: 'req-1',
  user_id: 'u1',
  request_type: 'account_deletion',
  status: 'pending',
  confirmation_token_hash: 'hash-abc',
  confirmation_expires_at: '2026-04-17T00:00:00Z',
  deletion_phase: null,
  processed_at: null,
  completed_at: null,
  expires_at: null,
  download_url: null,
  file_path: null,
  file_size_bytes: null,
  admin_notes: null,
  created_at: '2026-04-16T00:00:00Z',
  updated_at: '2026-04-16T00:00:00Z',
};

describe('SupabaseLgpdRequestRepository', () => {
  it('create() inserts and returns a mapped LgpdRequest', async () => {
    const { client, b } = makeSupabase();
    b.single.mockResolvedValue({ data: dbRow, error: null } as Resolved<typeof dbRow>);
    const repo = new SupabaseLgpdRequestRepository(client);

    const result = await repo.create({
      userId: 'u1',
      requestType: 'account_deletion',
      confirmationToken: 'hash-abc',
      confirmationExpiresAt: new Date('2026-04-17T00:00:00Z'),
    });

    expect(client.from).toHaveBeenCalledWith('lgpd_requests');
    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        request_type: 'account_deletion',
        status: 'pending',
        confirmation_token_hash: 'hash-abc',
      }),
    );
    expect(result).toMatchObject({
      id: 'req-1',
      userId: 'u1',
      requestType: 'account_deletion',
      status: 'pending',
    });
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('create() throws on insert error', async () => {
    const { client, b } = makeSupabase();
    b.single.mockResolvedValue({ data: null, error: { message: 'duplicate' } });
    const repo = new SupabaseLgpdRequestRepository(client);
    await expect(
      repo.create({ userId: 'u1', requestType: 'data_export' }),
    ).rejects.toThrow(/duplicate/);
  });

  it('findById() returns mapped row or null', async () => {
    const { client, b } = makeSupabase();
    b.maybeSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    const repo = new SupabaseLgpdRequestRepository(client);
    const got = await repo.findById('req-1');
    expect(client.from).toHaveBeenCalledWith('lgpd_requests');
    expect(b.eq).toHaveBeenCalledWith('id', 'req-1');
    expect(got?.id).toBe('req-1');

    b.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const miss = await repo.findById('req-404');
    expect(miss).toBeNull();
  });

  it('findByUserId() returns array, preserving order', async () => {
    const { client, b } = makeSupabase();
    b.order.mockResolvedValueOnce({ data: [dbRow, { ...dbRow, id: 'req-2' }], error: null });
    const repo = new SupabaseLgpdRequestRepository(client);
    const got = await repo.findByUserId('u1');
    expect(b.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(b.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(got.map((r) => r.id)).toEqual(['req-1', 'req-2']);
  });

  it('findPendingByUserId() filters by type + status', async () => {
    const { client, b } = makeSupabase();
    b.maybeSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    const repo = new SupabaseLgpdRequestRepository(client);
    await repo.findPendingByUserId('u1', 'account_deletion');
    expect(b.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(b.eq).toHaveBeenCalledWith('request_type', 'account_deletion');
    expect(b.in).toHaveBeenCalledWith('status', ['pending', 'processing']);
  });

  it('findByConfirmationToken() looks up by hash column', async () => {
    const { client, b } = makeSupabase();
    b.maybeSingle.mockResolvedValueOnce({ data: dbRow, error: null });
    const repo = new SupabaseLgpdRequestRepository(client);
    const found = await repo.findByConfirmationToken('hash-abc');
    expect(b.eq).toHaveBeenCalledWith('confirmation_token_hash', 'hash-abc');
    expect(found?.id).toBe('req-1');
  });

  it('update() sets mapped snake_case columns', async () => {
    const { client, b } = makeSupabase();
    b.single.mockResolvedValue({
      data: { ...dbRow, status: 'processing', deletion_phase: 1 },
      error: null,
    });
    const repo = new SupabaseLgpdRequestRepository(client);
    const updated = await repo.update('req-1', {
      status: 'processing',
      deletionPhase: 1,
      processedAt: new Date('2026-04-16T00:00:00Z'),
      downloadUrl: 'https://signed/x',
    });
    expect(b.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        deletion_phase: 1,
        processed_at: '2026-04-16T00:00:00.000Z',
        download_url: 'https://signed/x',
      }),
    );
    expect(updated.status).toBe('processing');
  });

  it('countByStatus() returns the exact count', async () => {
    const { client } = makeSupabase();
    const eq = vi.fn().mockResolvedValue({ count: 3, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    client.from = vi.fn().mockReturnValue({ select });
    const repo = new SupabaseLgpdRequestRepository(client);
    expect(await repo.countByStatus('pending')).toBe(3);
    expect(select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('findExpiredExports() filters by type + expires_at cutoff', async () => {
    const { client, b } = makeSupabase();
    b.lt.mockResolvedValueOnce({ data: [dbRow], error: null });
    const repo = new SupabaseLgpdRequestRepository(client);
    const now = new Date('2026-04-16T00:00:00Z');
    await repo.findExpiredExports(now);
    expect(b.eq).toHaveBeenCalledWith('request_type', 'data_export');
    expect(b.lt).toHaveBeenCalledWith('expires_at', now.toISOString());
  });

  it('avgProcessingTime() returns null when RPC responds with null', async () => {
    const { client } = makeSupabase();
    // Simpler path: underlying implementation uses a select + manual compute
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn().mockReturnValue({ order: orderMock });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    client.from = vi.fn().mockReturnValue({ select });
    const repo = new SupabaseLgpdRequestRepository(client);
    expect(await repo.avgProcessingTime('data_export')).toBeNull();
  });
});
