import type { SupabaseClient } from '@supabase/supabase-js';
import type { ILgpdDomainAdapter } from '@tn-figueiredo/lgpd/interfaces';
import { redactThirdPartyPii } from './redact-third-party-pii';

export interface DeletionSafetyResult {
  can_delete: boolean;
  blockers: string[];
  details?: Record<string, unknown>;
}

/**
 * Domain adapter — ties the Sprint 5a use-cases into the Sprint 4.75 schema.
 *
 * Method semantics follow the design spec §Data flows v2:
 *
 *  - `collectUserData(userId)` — assembles a full JSON bundle for LGPD Art. 18
 *    V portability. 3rd-party PII inside free-text (e.g. contact messages) is
 *    redacted via `redactThirdPartyPii`. Shape is stable across versions; we
 *    tag it with `version: "1"`.
 *
 *  - `phase1Cleanup(userId)` — pre-captures the email from auth.users (so the
 *    RPC can anonymize newsletter rows after the user row is gone) then
 *    invokes the `lgpd_phase1_cleanup` RPC atomically inside a single
 *    transaction with `SET LOCAL app.skip_cascade_audit = '1'` (the RPC owns
 *    that). App-layer ban + blob cleanup happen in the API route, not here.
 *
 *  - `phase2Cleanup(userId)` — no-op (hybrid-C design: phase 2 is folded into
 *    phase 1 to avoid the 30-day data half-life).
 *
 *  - `phase3Cleanup(userId)` — calls `lgpd_phase3_prenullify_fks` to null out
 *    FK rows that ON DELETE SET NULL on auth.users, then `auth.admin.deleteUser`.
 *    404 from deleteUser is treated as idempotent success (cleanup sweep re-runs
 *    after a failed phase 3 attempt).
 *
 *  - `checkDeletionSafety(userId)` — thin wrapper over the SECURITY DEFINER
 *    RPC. Not in ILgpdDomainAdapter@0.1.0 but called directly by the delete API
 *    route; kept as an extra method on the concrete class.
 */
export class BythiagoLgpdDomainAdapter implements ILgpdDomainAdapter {
  constructor(private readonly supabase: SupabaseClient) {}

  // ------------------------------------------------------------------
  // Phase 1 — atomic SQL cleanup
  // ------------------------------------------------------------------
  async phase1Cleanup(userId: string): Promise<void> {
    // Pre-capture PII we'll need to anonymize rows by before the auth.users
    // row is gone. The RPC (migration …000006) reads
    // `p_pre_capture -> 'newsletter_emails'` as a JSON array of email strings
    // and anonymizes both newsletter_subscriptions and contact_submissions
    // rows matching ANY of them. We gather:
    //   1. the auth-level email of the user being deleted
    //   2. every distinct email in `newsletter_subscriptions` linked to the user
    //   3. every distinct email in `contact_submissions` linked to the user
    // so the atomic RPC has the full anonymization set before the auth row
    // is wiped. Fix 9 (Sprint 5a): earlier revision passed { email: <str> }
    // which the RPC ignores — leaving newsletter + contact PII undeleted.
    const { data: userRes, error: userErr } = await this.supabase.auth.admin.getUserById(userId);
    if (userErr) {
      throw new Error(`phase1Cleanup: getUserById failed: ${userErr.message}`);
    }
    const userEmail = userRes?.user?.email ?? null;

    const [subsRes, contactsRes] = await Promise.all([
      this.supabase
        .from('newsletter_subscriptions')
        .select('email')
        .eq('user_id', userId)
        .limit(1000),
      this.supabase
        .from('contact_submissions')
        .select('email')
        .eq('user_id', userId)
        .limit(1000),
    ]);
    // Query errors on the lookup tables are non-fatal — the RPC still
    // anonymizes the auth email set below; we log by throwing only on
    // the hard RPC call. But surface real failures (not "no rows") to
    // avoid silently skipping rows.
    if (subsRes.error) {
      throw new Error(`phase1Cleanup: newsletter_subscriptions lookup failed: ${subsRes.error.message}`);
    }
    if (contactsRes.error) {
      throw new Error(`phase1Cleanup: contact_submissions lookup failed: ${contactsRes.error.message}`);
    }

    const subEmails = ((subsRes.data ?? []) as Array<{ email: string | null }>)
      .map((r) => r.email)
      .filter((e): e is string => !!e);
    const contactEmails = ((contactsRes.data ?? []) as Array<{ email: string | null }>)
      .map((r) => r.email)
      .filter((e): e is string => !!e);

    const emails = Array.from(
      new Set<string>(
        [userEmail, ...subEmails, ...contactEmails].filter((e): e is string => !!e),
      ),
    );

    const preCapture: Record<string, unknown> = {
      newsletter_emails: emails,
    };

    const { error } = await this.supabase.rpc('lgpd_phase1_cleanup', {
      p_user_id: userId,
      p_pre_capture: preCapture,
    });
    if (error) {
      throw new Error(`lgpd_phase1_cleanup RPC failed: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------
  // Phase 2 — no-op (see class doc).
  // ------------------------------------------------------------------
  async phase2Cleanup(_userId: string): Promise<void> {
    /* hybrid-C: phase 2 is folded into phase 1 */
  }

  // ------------------------------------------------------------------
  // Phase 3 — hard delete from auth.users
  // ------------------------------------------------------------------
  async phase3Cleanup(userId: string): Promise<void> {
    const { error: rpcErr } = await this.supabase.rpc('lgpd_phase3_prenullify_fks', {
      p_user_id: userId,
    });
    if (rpcErr) {
      throw new Error(`lgpd_phase3_prenullify_fks RPC failed: ${rpcErr.message}`);
    }

    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) {
      const status = (error as { status?: number }).status;
      const msg = error.message ?? '';
      // 404 / "User not found" → treat as idempotent success (already deleted).
      if (status === 404 || /not\s*found/i.test(msg)) {
        return;
      }
      throw new Error(`auth.admin.deleteUser failed: ${msg}`);
    }
  }

  // ------------------------------------------------------------------
  // Deletion safety (extra method, not on ILgpdDomainAdapter@0.1.0)
  // ------------------------------------------------------------------
  async checkDeletionSafety(userId: string): Promise<DeletionSafetyResult> {
    const { data, error } = await this.supabase.rpc('check_deletion_safety', {
      p_user_id: userId,
    });
    if (error) {
      throw new Error(`check_deletion_safety RPC failed: ${error.message}`);
    }
    return data as DeletionSafetyResult;
  }

  // ------------------------------------------------------------------
  // Data export
  // ------------------------------------------------------------------
  async collectUserData(userId: string): Promise<Record<string, unknown>> {
    // Fetch each slice in parallel. Empty-on-error is NOT used here — if any
    // single query fails, the collection fails, because portability is
    // all-or-nothing. The API route wraps this in try/catch and marks the
    // request failed + emails the user on failure.
    const [
      userRes,
      blogPosts,
      campaigns,
      authors,
      newsletterSubs,
      contactSubs,
      orgMembers,
      siteMembers,
      invitations,
      auditEntries,
      lgpdRequests,
      consents,
    ] = await Promise.all([
      this.supabase.auth.admin.getUserById(userId),
      this.queryRows('blog_posts', 'owner_user_id', userId),
      this.queryRows('campaigns', 'owner_user_id', userId),
      this.queryRows('authors', 'user_id', userId),
      this.queryRows('newsletter_subscriptions', 'user_id', userId),
      this.queryRows('contact_submissions', 'user_id', userId),
      this.queryRows('organization_members', 'user_id', userId),
      this.queryRows('site_memberships', 'user_id', userId),
      this.queryRows('invitations', 'invited_by_user_id', userId),
      this.queryRows('audit_log', 'actor_user_id', userId),
      this.queryRows('lgpd_requests', 'user_id', userId),
      this.queryRows('consents', 'user_id', userId),
    ]);

    if (userRes.error) {
      throw new Error(`collectUserData: getUserById failed: ${userRes.error.message}`);
    }
    const user = userRes.data?.user ?? null;

    return {
      version: '1',
      exported_at: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
          }
        : null,
      organization_memberships: orgMembers,
      site_memberships: siteMembers,
      owned_content: {
        blog_posts: blogPosts,
        campaigns,
      },
      authored_as: authors[0] ?? null,
      newsletter_subscriptions: newsletterSubs,
      contact_submissions_sent: contactSubs.map((row) => {
        const r = (row ?? {}) as Record<string, unknown>;
        const message = typeof r.message === 'string' ? r.message : null;
        const red = redactThirdPartyPii(message);
        return {
          ...r,
          message_redacted: red.text,
          redaction_applied: red.redacted,
        };
      }),
      invitations_received: invitations,
      audit_log_as_actor: auditEntries,
      lgpd_requests: lgpdRequests,
      consents,
    };
  }

  private async queryRows(
    table: string,
    column: string,
    userId: string,
  ): Promise<unknown[]> {
    const { data, error } = await this.supabase.from(table).select('*').eq(column, userId);
    if (error) {
      throw new Error(`collectUserData: query ${table} failed: ${error.message}`);
    }
    return data ?? [];
  }
}
