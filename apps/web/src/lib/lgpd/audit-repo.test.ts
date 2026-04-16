import { describe, it, expect, vi } from 'vitest';
import { AuditLogLgpdRepository } from './audit-repo';

function makeSupabase() {
  const builder = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    limit: vi.fn().mockReturnThis(),
  };
  const from = vi.fn().mockReturnValue(builder);
  const rpc = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = { from, rpc };
  return { client, builder, from, rpc };
}

describe('AuditLogLgpdRepository', () => {
  it('create() inserts into audit_log and returns the created row', async () => {
    const { client, builder } = makeSupabase();
    const createdAt = '2026-04-16T10:00:00Z';
    builder.single.mockResolvedValue({
      data: {
        id: 'audit-1',
        resource_id: 'req-1',
        actor_user_id: 'u1',
        action: 'lifecycle_deletion_requested',
        after_data: { step: 'email_sent' },
        created_at: createdAt,
      },
      error: null,
    });

    const repo = new AuditLogLgpdRepository(client);
    const entry = await repo.create({
      lgpdRequestId: 'req-1',
      userId: 'u1',
      action: 'lifecycle_deletion_requested',
      performedBy: 'u1',
      details: { step: 'email_sent' },
    });

    expect(client.from).toHaveBeenCalledWith('audit_log');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'lgpd_request',
        resource_id: 'req-1',
        actor_user_id: 'u1',
        action: 'lifecycle_deletion_requested',
        after_data: { step: 'email_sent' },
      }),
    );
    expect(entry).toMatchObject({
      id: 'audit-1',
      lgpdRequestId: 'req-1',
      userId: 'u1',
      action: 'lifecycle_deletion_requested',
      performedBy: 'u1',
    });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('create() throws when insert fails', async () => {
    const { client, builder } = makeSupabase();
    builder.single.mockResolvedValue({
      data: null,
      error: { message: 'rls_denied' },
    });
    const repo = new AuditLogLgpdRepository(client);
    await expect(
      repo.create({ userId: 'u1', action: 'lifecycle_deletion_requested' }),
    ).rejects.toThrow(/rls_denied/);
  });

  it('findByRequestId() queries audit_log ordered by created_at asc', async () => {
    const { client, builder } = makeSupabase();
    const rows = [
      {
        id: 'a1',
        resource_id: 'req-1',
        actor_user_id: 'u1',
        action: 'lifecycle_deletion_requested',
        after_data: { k: 1 },
        created_at: '2026-04-16T10:00:00Z',
      },
      {
        id: 'a2',
        resource_id: 'req-1',
        actor_user_id: null,
        action: 'lifecycle_phase1_complete',
        after_data: null,
        created_at: '2026-04-16T11:00:00Z',
      },
    ];
    builder.order.mockResolvedValue({ data: rows, error: null });

    const repo = new AuditLogLgpdRepository(client);
    const result = await repo.findByRequestId('req-1');

    expect(client.from).toHaveBeenCalledWith('audit_log');
    expect(builder.eq).toHaveBeenCalledWith('resource_id', 'req-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'a1', lgpdRequestId: 'req-1' });
    expect(result[1]).toMatchObject({ id: 'a2' });
    // a2 has null actor_user_id → userId / performedBy are omitted
    expect(result[1]?.userId).toBeUndefined();
    expect(result[1]?.performedBy).toBeUndefined();
  });

  it('countByAction() returns exact count', async () => {
    const { client } = makeSupabase();
    const head = vi.fn().mockResolvedValue({ count: 7, error: null });
    const eq = vi.fn().mockReturnValue({ then: (resolve: (v: unknown) => void) => resolve({ count: 7, error: null }) });
    const select = vi.fn().mockReturnValue({ eq: (col: string, val: string) => {
      eq(col, val);
      return head();
    } });
    client.from = vi.fn().mockReturnValue({ select });

    const repo = new AuditLogLgpdRepository(client);
    const n = await repo.countByAction('lifecycle_deletion_requested');
    expect(n).toBe(7);
    expect(client.from).toHaveBeenCalledWith('audit_log');
    expect(select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('action', 'lifecycle_deletion_requested');
  });

  it('countByAction() returns 0 when count is null', async () => {
    const { client } = makeSupabase();
    const select = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ count: null, error: null }),
    });
    client.from = vi.fn().mockReturnValue({ select });

    const repo = new AuditLogLgpdRepository(client);
    expect(await repo.countByAction('nope')).toBe(0);
  });
});
