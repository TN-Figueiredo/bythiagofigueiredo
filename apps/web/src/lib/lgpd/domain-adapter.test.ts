import { describe, it, expect, vi } from 'vitest';
import { BythiagoLgpdDomainAdapter } from './domain-adapter';

type Table =
  | 'auth.users'
  | 'blog_posts'
  | 'campaigns'
  | 'authors'
  | 'newsletter_subscriptions'
  | 'contact_submissions'
  | 'organization_members'
  | 'site_memberships'
  | 'invitations'
  | 'audit_log'
  | 'lgpd_requests'
  | 'consents';

interface TableRows {
  [k: string]: unknown[] | undefined;
}

/**
 * Minimal Supabase mock that returns configured rows per table for .select()
 * queries, and supports .rpc() and auth.admin.* method stubbing. Only the
 * handful of chain methods our adapter uses are implemented.
 */
function makeSupabase(rows: TableRows = {}) {
  const rpc = vi.fn();
  const getUserById = vi.fn();
  const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: null, error: null });

  const from = vi.fn((table: string) => {
    const data = rows[table as Table] ?? [];
    // chainable builder — returns itself for chain methods, and is a
    // thenable that resolves to `{ data, error: null }` to mimic
    // supabase-js query resolution.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (..._args: any[]) => chain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq: (..._args: any[]) => chain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      in: (..._args: any[]) => chain,
      order: async () => ({ data, error: null }),
      limit: async () => ({ data, error: null }),
      maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
      single: async () => ({ data: data[0] ?? null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: (..._args: any[]) => chain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete: (..._args: any[]) => chain,
      then: (onRes: (v: { data: unknown[]; error: null }) => void) => {
        onRes({ data, error: null });
      },
    };
    return chain;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = {
    from,
    rpc,
    auth: { admin: { getUserById, deleteUser, updateUserById } },
  };
  return { supabase, rpc, getUserById, deleteUser, updateUserById, from };
}

describe('BythiagoLgpdDomainAdapter', () => {
  describe('collectUserData', () => {
    it('returns a keyed bundle with user + content + consents', async () => {
      const { supabase, getUserById } = makeSupabase({
        blog_posts: [{ id: 'p1', owner_user_id: 'u1', title: 'post' }],
        campaigns: [{ id: 'c1', owner_user_id: 'u1', name: 'campaign' }],
        authors: [{ user_id: 'u1', bio_md: 'hi', avatar_url: null }],
        newsletter_subscriptions: [
          { id: 's1', email: 'a@x.com', site_id: 'site-1', status: 'confirmed' },
        ],
        contact_submissions: [
          { id: 'cs1', email: 'a@x.com', message: 'Oi — me chame em b@y.com' },
        ],
        organization_members: [{ org_id: 'org-1', user_id: 'u1', role: 'org_admin' }],
        site_memberships: [{ site_id: 'site-1', user_id: 'u1', role: 'editor' }],
        invitations: [{ id: 'inv-1', email_normalized: 'a@x.com' }],
        audit_log: [
          { id: 'a1', actor_user_id: 'u1', action: 'content.publish', after_data: {} },
        ],
        lgpd_requests: [{ id: 'r1', user_id: 'u1', request_type: 'data_export' }],
        consents: [
          { id: 'cons-1', user_id: 'u1', category: 'functional', granted: true },
        ],
      });
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'a@x.com', created_at: '2026-01-01T00:00:00Z' } },
        error: null,
      });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      const bundle = await adapter.collectUserData('u1');

      expect(bundle.version).toBe('1');
      expect(bundle.exported_at).toBeTypeOf('string');
      // Top-level keys per spec §Data export schema v1
      expect(bundle.user).toMatchObject({ id: 'u1', email: 'a@x.com' });
      expect(bundle.organization_memberships).toHaveLength(1);
      expect(bundle.site_memberships).toHaveLength(1);
      expect(bundle.owned_content).toMatchObject({
        blog_posts: expect.any(Array),
        campaigns: expect.any(Array),
      });
      expect(bundle.authored_as).toBeDefined();
      expect(bundle.newsletter_subscriptions).toHaveLength(1);
      expect(bundle.contact_submissions_sent).toHaveLength(1);
      expect(bundle.audit_log_as_actor).toHaveLength(1);
      expect(bundle.lgpd_requests).toHaveLength(1);
      expect(bundle.consents).toHaveLength(1);
    });

    it('redacts 3rd-party emails/phones in contact submissions', async () => {
      const { supabase, getUserById } = makeSupabase({
        contact_submissions: [
          { id: 'cs1', email: 'self@x.com', message: 'Fale com terceiro@x.com ou +55 11 99999 1234' },
        ],
      });
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'self@x.com' } },
        error: null,
      });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      const bundle = await adapter.collectUserData('u1');
      const submissions = bundle.contact_submissions_sent as Array<{
        message_redacted: string | null;
        redaction_applied: boolean;
      }>;
      expect(submissions[0]?.message_redacted).toContain('[REDACTED_EMAIL]');
      expect(submissions[0]?.message_redacted).toContain('[REDACTED_PHONE]');
      expect(submissions[0]?.redaction_applied).toBe(true);
    });

    it('returns empty arrays when user has no content', async () => {
      const { supabase, getUserById } = makeSupabase({});
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'a@x.com' } },
        error: null,
      });
      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      const bundle = await adapter.collectUserData('u1');
      expect(bundle.owned_content).toEqual({ blog_posts: [], campaigns: [] });
      expect(bundle.consents).toEqual([]);
    });
  });

  describe('phase1Cleanup', () => {
    // Fix 9 (Sprint 5a): pre-capture passes `newsletter_emails: string[]`
    // (the key the RPC reads) — not the legacy `email: string`.
    it('pre-captures newsletter + contact emails + dispatches the RPC', async () => {
      const { supabase, rpc, getUserById } = makeSupabase({
        newsletter_subscriptions: [{ email: 'a@x.com' }, { email: 'second@x.com' }],
        contact_submissions: [{ email: 'a@x.com' }, { email: 'third@x.com' }],
      });
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'a@x.com' } },
        error: null,
      });
      rpc.mockResolvedValue({ data: null, error: null });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await adapter.phase1Cleanup('u1');

      const args = rpc.mock.calls[0];
      expect(args?.[0]).toBe('lgpd_phase1_cleanup');
      const payload = args?.[1] as {
        p_user_id: string;
        p_pre_capture: { newsletter_emails: string[] };
      };
      expect(payload.p_user_id).toBe('u1');
      expect(payload.p_pre_capture.newsletter_emails).toEqual(
        expect.arrayContaining(['a@x.com', 'second@x.com', 'third@x.com']),
      );
      // Dedup: auth email appears once, not multiple.
      const count = payload.p_pre_capture.newsletter_emails.filter(
        (e) => e === 'a@x.com',
      ).length;
      expect(count).toBe(1);
    });

    it('falls back to just the auth email when lookup tables are empty', async () => {
      const { supabase, rpc, getUserById } = makeSupabase();
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'solo@x.com' } },
        error: null,
      });
      rpc.mockResolvedValue({ data: null, error: null });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await adapter.phase1Cleanup('u1');

      const payload = rpc.mock.calls[0]?.[1] as {
        p_pre_capture: { newsletter_emails: string[] };
      };
      expect(payload.p_pre_capture.newsletter_emails).toEqual(['solo@x.com']);
    });

    it('throws when the RPC fails', async () => {
      const { supabase, rpc, getUserById } = makeSupabase();
      getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'a@x.com' } },
        error: null,
      });
      rpc.mockResolvedValue({ data: null, error: { message: 'constraint violation' } });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await expect(adapter.phase1Cleanup('u1')).rejects.toThrow(/constraint violation/);
    });
  });

  describe('phase2Cleanup', () => {
    it('is a no-op (hybrid C — phase 2 folded into phase 1)', async () => {
      const { supabase, rpc } = makeSupabase();
      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await expect(adapter.phase2Cleanup('u1')).resolves.toBeUndefined();
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('phase3Cleanup', () => {
    it('pre-nullifies FKs then deletes the auth.users row', async () => {
      const { supabase, rpc, deleteUser } = makeSupabase();
      rpc.mockResolvedValue({ data: null, error: null });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await adapter.phase3Cleanup('u1');

      // pre-nullify FKs via dedicated RPC
      expect(rpc).toHaveBeenCalledWith('lgpd_phase3_prenullify_fks', { p_user_id: 'u1' });
      expect(deleteUser).toHaveBeenCalledWith('u1');
    });

    it('throws when admin.deleteUser errors (non-idempotent)', async () => {
      const { supabase, rpc, deleteUser } = makeSupabase();
      rpc.mockResolvedValue({ data: null, error: null });
      deleteUser.mockResolvedValue({
        data: null,
        error: { message: 'cascade blocked', code: '23503' },
      });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await expect(adapter.phase3Cleanup('u1')).rejects.toThrow(/cascade blocked/);
    });

    it('treats "user not found" as idempotent success', async () => {
      const { supabase, rpc, deleteUser } = makeSupabase();
      rpc.mockResolvedValue({ data: null, error: null });
      deleteUser.mockResolvedValue({
        data: null,
        error: { message: 'User not found', status: 404 },
      });

      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await expect(adapter.phase3Cleanup('u1')).resolves.toBeUndefined();
    });
  });

  describe('checkDeletionSafety', () => {
    it('returns the RPC payload shape unchanged', async () => {
      const { supabase, rpc } = makeSupabase();
      const payload = { can_delete: false, blockers: ['master_ring_sole_admin'], details: {} };
      rpc.mockResolvedValue({ data: payload, error: null });
      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      const result = await adapter.checkDeletionSafety('u1');
      expect(rpc).toHaveBeenCalledWith('check_deletion_safety', { p_user_id: 'u1' });
      expect(result).toEqual(payload);
    });

    it('throws on RPC error', async () => {
      const { supabase, rpc } = makeSupabase();
      rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
      const adapter = new BythiagoLgpdDomainAdapter(supabase);
      await expect(adapter.checkDeletionSafety('u1')).rejects.toThrow(/permission denied/);
    });
  });
});
