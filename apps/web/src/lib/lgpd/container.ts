import { createHash, randomBytes } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LgpdConfig } from '@tn-figueiredo/lgpd/interfaces';
import { InMemoryRateLimiter } from '@tn-figueiredo/audit';
import { emailLayout, emailButton, formatDatePtBR } from '@tn-figueiredo/email';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';
import { getEmailService } from '../../../lib/email/service';
import { logCron } from '../../../lib/logger';

import { BythiagoLgpdDomainAdapter } from './domain-adapter';
import { AuditLogLgpdRepository } from './audit-repo';
import { BrevoLgpdEmailService } from './email-service';
import { DirectQueryAccountStatusCache } from './account-status-cache';
import { SupabaseInactiveUserFinder, type IInactiveUserFinder } from './inactive-user-finder';

// --- use-case shapes --------------------------------------------------------

export interface AccountDeletionUseCases {
  request(userId: string): Promise<{ requestId: string; token: string; expiresAt: Date }>;
  confirm(token: string): Promise<{ userId: string; scheduledPurgeAt: Date; requestId: string }>;
  cancel(token: string): Promise<{ userId: string; scheduledPurgeAt: Date }>;
}

export interface DataExportUseCases {
  request(userId: string): Promise<{ requestId: string; signedUrl: string; expiresAt: Date }>;
  download(token: string): Promise<{ signedUrl: string }>;
}

export interface ConsentUseCases {
  recordAnonymous(
    anonId: string,
    category: string,
    granted: boolean,
    siteId?: string | null,
  ): Promise<void>;
  merge(anonId: string, userId: string): Promise<{ mergedCount: number }>;
}

export interface CleanupSweepUseCases {
  advancePhase3(): Promise<{ processed: number }>;
  sendReminders(): Promise<{ sent: number }>;
  deleteExpiredBlobs(): Promise<{ deleted: number }>;
}

/**
 * Shape of a `tokenLookup.resolve` result. Combines the spec-mandated fields
 * (`requestId`, `type`, `status`, `userId`) with a `kind` discriminator that
 * the `/lgpd/confirm/[token]` page consumes; `data_export` results also
 * include an on-demand `signedUrl` so the page can 302 straight to storage
 * without a second round-trip.
 */
export type TokenLookupResult =
  | {
      requestId: string;
      type: 'account_deletion';
      status: string;
      userId: string;
      kind: 'account_deletion' | 'account_deletion_cancel';
    }
  | {
      requestId: string;
      type: 'data_export';
      status: string;
      userId: string;
      kind: 'data_export';
      signedUrl: string;
    };

export interface TokenLookupUseCases {
  resolve(token: string): Promise<TokenLookupResult | null>;
}

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

  // --- Sprint 5a "use-case glue" (Phase 2 integration) ---------------------
  accountDeletion: AccountDeletionUseCases;
  dataExport: DataExportUseCases;
  consent: ConsentUseCases;
  cleanupSweep: CleanupSweepUseCases;
  tokenLookup: TokenLookupUseCases;
}

let memo: LgpdContainer | null = null;

// --- shared helpers ---------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETION_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;     // 24h
const GRACE_PERIOD_DAYS = 15;                            // phase3DelayDays
const BLOB_TTL_DAYS = 7;                                 // exportExpiryDays
const DOWNLOAD_SIGNED_URL_TTL_SEC = 60 * 10;             // 10 minutes
const EXPORT_SIGNED_URL_TTL_SEC = BLOB_TTL_DAYS * 24 * 60 * 60; // 7 days
const REMINDER_WINDOW_DAYS = 2;                          // D+13 → D+15
const EXPORTS_BUCKET = 'lgpd-exports';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Map the UI-level cookie category (`functional`/`analytics`/`marketing`) onto
 * the `consents.category` + `consent_texts.id` values the schema uses. Falls
 * through unchanged for categories that already match (e.g. `newsletter`,
 * `privacy_policy`) — the caller can pass the canonical DB name directly.
 */
function resolveConsentCategory(category: string): {
  dbCategory: string;
  textId: string;
} {
  const short = category.toLowerCase();
  if (short === 'functional' || short === 'analytics' || short === 'marketing') {
    const dbCategory = `cookie_${short}`;
    return { dbCategory, textId: `${dbCategory}_v1_pt-BR` };
  }
  return { dbCategory: short, textId: `${short}_v1_pt-BR` };
}

// --- Email helpers for LGPD templates NOT in BrevoLgpdEmailService ----------

interface BrandOpts {
  brandName: string;
  siteUrl: string;
  primaryColor?: string;
  logoUrl?: string;
}

function brandingObj(brand: BrandOpts): {
  brandName: string;
  primaryColor?: string;
  logoUrl?: string;
} {
  const b: { brandName: string; primaryColor?: string; logoUrl?: string } = {
    brandName: brand.brandName,
  };
  if (brand.primaryColor) b.primaryColor = brand.primaryColor;
  if (brand.logoUrl) b.logoUrl = brand.logoUrl;
  return b;
}

async function sendDeletionReminderEmail(
  emailService: ReturnType<typeof getEmailService>,
  sender: { email: string; name: string },
  brand: BrandOpts,
  to: string,
  cancelUrl: string,
  graceEndsAt: Date,
): Promise<void> {
  const expires = formatDatePtBR(graceEndsAt);
  const body = `
    <p>Sua solicitação de exclusão de conta no ${brand.brandName} está no período de graça.</p>
    <p>A conta será removida de forma definitiva em <strong>${expires}</strong>.</p>
    <p>Ainda é possível cancelar a remoção clicando no botão abaixo.</p>
    ${emailButton({ url: cancelUrl, label: 'Cancelar exclusão', ...(brand.primaryColor ? { color: brand.primaryColor } : {}) })}
    <p style="font-size: 13px; color: #666;">
      Se você não fez essa solicitação, entre em contato com o suporte o quanto antes.
    </p>
  `;
  const html = emailLayout({ body, branding: brandingObj(brand) });
  await emailService.send({
    from: sender,
    to,
    subject: `Lembrete: sua conta será removida em ${expires}`,
    html,
  });
}

async function sendDeletionCancelledEmail(
  emailService: ReturnType<typeof getEmailService>,
  sender: { email: string; name: string },
  brand: BrandOpts,
  to: string,
): Promise<void> {
  const body = `
    <p>Confirmamos o cancelamento da solicitação de exclusão da sua conta no ${brand.brandName}.</p>
    <p>Você já pode acessar normalmente. Observe que conteúdos e dados anonimizados
       durante a fase 1 <strong>não são revertidos</strong> — a restauração é apenas do acesso.</p>
  `;
  const html = emailLayout({ body, branding: brandingObj(brand) });
  await emailService.send({
    from: sender,
    to,
    subject: 'Exclusão de conta cancelada',
    html,
  });
}

// --- Use-case factories -----------------------------------------------------

interface UseCaseDeps {
  admin: SupabaseClient;
  appUrl: string;
  domainAdapter: BythiagoLgpdDomainAdapter;
  emailService: ReturnType<typeof getEmailService>;
  lgpdEmail: BrevoLgpdEmailService;
  sender: { email: string; name: string };
  brand: BrandOpts;
  logger: LgpdConfig['logger'];
}

function makeAccountDeletion(deps: UseCaseDeps): AccountDeletionUseCases {
  const { admin, appUrl, domainAdapter, lgpdEmail, emailService, sender, brand, logger } = deps;

  return {
    async request(userId) {
      const token = generateRawToken();
      const hash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + DELETION_CONFIRM_TTL_MS);

      const { data: ures, error: uerr } = await admin.auth.admin.getUserById(userId);
      if (uerr || !ures?.user?.email) {
        throw new Error(`account_deletion.request: user lookup failed: ${uerr?.message ?? 'no_email'}`);
      }
      const email = ures.user.email;

      const { data: row, error: insErr } = await admin
        .from('lgpd_requests')
        .insert({
          user_id: userId,
          type: 'account_deletion',
          status: 'pending',
          confirmation_token_hash: hash,
          metadata: { confirmation_expires_at: expiresAt.toISOString() },
        })
        .select('id')
        .single();
      if (insErr || !row) {
        throw new Error(`account_deletion.request: insert failed: ${insErr?.message ?? 'unknown'}`);
      }
      const requestId = (row as { id: string }).id;

      const confirmUrl = `${appUrl}/lgpd/confirm/${token}`;
      try {
        await lgpdEmail.sendDeletionConfirmation(email, confirmUrl, expiresAt);
      } catch (e) {
        logger.warn('[lgpd_email_confirmation_failed]', {
          message: e instanceof Error ? e.message : String(e),
          requestId,
        });
      }
      void emailService;
      void sender;
      void brand;

      return { requestId, token, expiresAt };
    },

    async confirm(token) {
      const hash = sha256Hex(token);
      const { data: row, error: selErr } = await admin
        .from('lgpd_requests')
        .select('id, user_id, type, status, metadata')
        .eq('confirmation_token_hash', hash)
        .eq('type', 'account_deletion')
        .eq('status', 'pending')
        .maybeSingle();
      if (selErr) {
        throw new Error(`account_deletion.confirm: lookup failed: ${selErr.message}`);
      }
      if (!row) {
        throw new Error('invalid_token');
      }
      const typedRow = row as {
        id: string;
        user_id: string;
        metadata: Record<string, unknown> | null;
      };

      const metaExpires = typedRow.metadata?.['confirmation_expires_at'];
      if (typeof metaExpires === 'string') {
        if (Date.now() > Date.parse(metaExpires)) {
          throw new Error('expired');
        }
      }

      const now = new Date();
      const scheduledPurgeAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * DAY_MS);

      // Phase 1 cleanup (atomic SQL) — if this throws, the request stays
      // in 'pending' and the user can retry (or the cron sweep picks it up).
      await domainAdapter.phase1Cleanup(typedRow.user_id);

      const { error: updErr } = await admin
        .from('lgpd_requests')
        .update({
          status: 'processing',
          phase: 1,
          confirmed_at: now.toISOString(),
          phase_1_completed_at: now.toISOString(),
          scheduled_purge_at: scheduledPurgeAt.toISOString(),
        })
        .eq('id', typedRow.id);
      if (updErr) {
        throw new Error(`account_deletion.confirm: update failed: ${updErr.message}`);
      }

      return {
        userId: typedRow.user_id,
        scheduledPurgeAt,
        requestId: typedRow.id,
      };
    },

    async cancel(token) {
      const hash = sha256Hex(token);
      const { data, error } = await admin.rpc('cancel_account_deletion_in_grace', {
        p_token_hash: hash,
      });
      if (error) {
        throw new Error(`account_deletion.cancel: RPC failed: ${error.message}`);
      }
      const rpc = (data ?? {}) as {
        cancelled?: boolean;
        user_id?: string;
        scheduled_purge_at?: string;
      };
      if (!rpc.cancelled) {
        throw new Error('not_in_grace');
      }
      const userId = rpc.user_id!;
      const scheduledPurgeAt = rpc.scheduled_purge_at
        ? new Date(rpc.scheduled_purge_at)
        : new Date();

      // Best-effort: look up the email, send a cancellation confirmation.
      try {
        const { data: ures } = await admin.auth.admin.getUserById(userId);
        const email = ures?.user?.email ?? null;
        if (email) {
          await sendDeletionCancelledEmail(emailService, sender, brand, email);
        }
      } catch (e) {
        logger.warn('[lgpd_email_cancelled_failed]', {
          message: e instanceof Error ? e.message : String(e),
          userId,
        });
      }

      return { userId, scheduledPurgeAt };
    },
  };
}

function makeDataExport(deps: UseCaseDeps): DataExportUseCases {
  const { admin, domainAdapter, lgpdEmail, logger } = deps;

  return {
    async request(userId) {
      // Rate limit: 1 completed export per 30 days.
      const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
      const { count, error: rlErr } = (await admin
        .from('lgpd_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'data_export')
        .eq('status', 'completed')
        .gt('completed_at', thirtyDaysAgo)) as {
          count: number | null;
          error: { message: string } | null;
        };
      if (rlErr) {
        throw new Error(`data_export.request: rate-limit query failed: ${rlErr.message}`);
      }
      if ((count ?? 0) >= 1) {
        throw new Error('rate_limited');
      }

      // Block if an account_deletion is already in flight.
      const { data: pending, error: pendErr } = await admin
        .from('lgpd_requests')
        .select('id, status')
        .eq('user_id', userId)
        .eq('type', 'account_deletion')
        .in('status', ['pending', 'processing'])
        .limit(1)
        .maybeSingle();
      if (pendErr) {
        throw new Error(`data_export.request: pending-deletion query failed: ${pendErr.message}`);
      }
      if (pending) {
        throw new Error('pending_deletion');
      }

      const token = generateRawToken();
      const hash = sha256Hex(token);
      const requestedAt = new Date();
      const expiresAt = new Date(requestedAt.getTime() + BLOB_TTL_DAYS * DAY_MS);

      // Create the row up front so we have a requestId for the blob path.
      const { data: insRow, error: insErr } = await admin
        .from('lgpd_requests')
        .insert({
          user_id: userId,
          type: 'data_export',
          status: 'processing',
          confirmation_token_hash: hash,
        })
        .select('id')
        .single();
      if (insErr || !insRow) {
        throw new Error(`data_export.request: insert failed: ${insErr?.message ?? 'unknown'}`);
      }
      const requestId = (insRow as { id: string }).id;

      // Collect + upload.
      let blobPath = `${userId}/${requestId}.json`;
      try {
        const payload = await domainAdapter.collectUserData(userId);
        const body = JSON.stringify(payload);
        const { error: upErr } = await admin.storage
          .from(EXPORTS_BUCKET)
          .upload(blobPath, body, {
            contentType: 'application/json',
            upsert: true,
          });
        if (upErr) {
          throw new Error(`storage.upload failed: ${upErr.message}`);
        }
      } catch (e) {
        // Mark request failed so the user can retry.
        await admin
          .from('lgpd_requests')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            metadata: {
              error: e instanceof Error ? e.message : String(e),
            },
          })
          .eq('id', requestId);
        throw e;
      }

      const { data: signed, error: sigErr } = await admin.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(blobPath, EXPORT_SIGNED_URL_TTL_SEC);
      if (sigErr || !signed?.signedUrl) {
        throw new Error(`data_export.request: signedUrl failed: ${sigErr?.message ?? 'unknown'}`);
      }

      const completedAt = new Date();
      const { error: updErr } = await admin
        .from('lgpd_requests')
        .update({
          status: 'completed',
          blob_path: blobPath,
          blob_uploaded_at: completedAt.toISOString(),
          completed_at: completedAt.toISOString(),
        })
        .eq('id', requestId);
      if (updErr) {
        throw new Error(`data_export.request: update failed: ${updErr.message}`);
      }

      // Fire email. Keep best-effort — the caller may already retry via UI.
      try {
        const { data: ures } = await admin.auth.admin.getUserById(userId);
        const email = ures?.user?.email ?? null;
        if (email) {
          await lgpdEmail.sendExportReady(email, signed.signedUrl, expiresAt);
        }
      } catch (e) {
        logger.warn('[lgpd_email_export_ready_failed]', {
          message: e instanceof Error ? e.message : String(e),
          requestId,
        });
      }

      return { requestId, signedUrl: signed.signedUrl, expiresAt };
    },

    async download(token) {
      const hash = sha256Hex(token);
      const { data: row, error: selErr } = await admin
        .from('lgpd_requests')
        .select('id, user_id, type, status, blob_path, blob_uploaded_at, blob_deleted_at')
        .eq('confirmation_token_hash', hash)
        .eq('type', 'data_export')
        .maybeSingle();
      if (selErr) {
        throw new Error(`data_export.download: lookup failed: ${selErr.message}`);
      }
      if (!row) throw new Error('invalid_token');
      const typedRow = row as {
        blob_path: string | null;
        blob_uploaded_at: string | null;
        blob_deleted_at: string | null;
      };
      if (!typedRow.blob_path) throw new Error('not_found');
      if (typedRow.blob_deleted_at) throw new Error('expired');
      if (typedRow.blob_uploaded_at) {
        const uploaded = Date.parse(typedRow.blob_uploaded_at);
        if (Date.now() - uploaded > BLOB_TTL_DAYS * DAY_MS) {
          throw new Error('expired');
        }
      }

      const { data: signed, error: sigErr } = await admin.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(typedRow.blob_path, DOWNLOAD_SIGNED_URL_TTL_SEC);
      if (sigErr || !signed?.signedUrl) {
        throw new Error(`data_export.download: signedUrl failed: ${sigErr?.message ?? 'unknown'}`);
      }
      return { signedUrl: signed.signedUrl };
    },
  };
}

function makeConsent(deps: UseCaseDeps): ConsentUseCases {
  const { admin } = deps;
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return {
    async recordAnonymous(anonId, category, granted, siteId) {
      if (!UUID_V4.test(anonId)) {
        throw new Error('invalid_uuid_v4');
      }
      const { dbCategory, textId } = resolveConsentCategory(category);
      const row: Record<string, unknown> = {
        anonymous_id: anonId,
        category: dbCategory,
        consent_text_id: textId,
        granted,
      };
      if (siteId) row.site_id = siteId;
      const { error } = await admin.from('consents').insert(row);
      if (error) {
        throw new Error(`consent.recordAnonymous: insert failed: ${error.message}`);
      }
    },

    /**
     * The shipped `merge_anonymous_consents(p_anonymous_id)` RPC relies on
     * `auth.uid()` for the target user — service-role clients have a NULL
     * `auth.uid()`, so the RPC would raise `not_authenticated`. We replicate
     * the RPC's logic in JS via the admin client (same conflict-resolution:
     * if the user already has a current row for the same category+site_id,
     * keep the user row and drop the anonymous one).
     *
     * Deviation from spec: no `FOR UPDATE` row lock. Practical impact is
     * minimal — merge fires once post-sign-in from a single tab and the
     * partial unique index `consents_auth_current` guarantees idempotency
     * on (user_id, category, site_id) conflicts.
     */
    async merge(anonId, userId) {
      const { data: anonRows, error: selErr } = await admin
        .from('consents')
        .select(
          'id, category, site_id, consent_text_id, granted, granted_at, ip, user_agent',
        )
        .eq('anonymous_id', anonId)
        .is('user_id', null);
      if (selErr) {
        throw new Error(`consent.merge: select failed: ${selErr.message}`);
      }
      const rows = (anonRows ?? []) as Array<{
        id: string;
        category: string;
        site_id: string | null;
        consent_text_id: string;
        granted: boolean;
        granted_at: string;
        ip: string | null;
        user_agent: string | null;
      }>;

      let mergedCount = 0;
      for (const r of rows) {
        let existsQ = admin
          .from('consents')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', userId)
          .eq('category', r.category)
          .is('withdrawn_at', null);
        existsQ = r.site_id == null ? existsQ.is('site_id', null) : existsQ.eq('site_id', r.site_id);
        const { count, error: exErr } = (await existsQ) as {
          count: number | null;
          error: { message: string } | null;
        };
        if (exErr) {
          throw new Error(`consent.merge: exists query failed: ${exErr.message}`);
        }
        if ((count ?? 0) > 0) {
          // User already has a consent — drop the anonymous one.
          const { error: delErr } = await admin.from('consents').delete().eq('id', r.id);
          if (delErr) {
            throw new Error(`consent.merge: delete failed: ${delErr.message}`);
          }
          continue;
        }

        const insert: Record<string, unknown> = {
          user_id: userId,
          category: r.category,
          consent_text_id: r.consent_text_id,
          granted: r.granted,
          granted_at: r.granted_at,
          ip: r.ip,
          user_agent: r.user_agent,
        };
        if (r.site_id) insert.site_id = r.site_id;
        const { error: insErr } = await admin.from('consents').insert(insert);
        if (insErr) {
          throw new Error(`consent.merge: insert failed: ${insErr.message}`);
        }
        const { error: delErr } = await admin.from('consents').delete().eq('id', r.id);
        if (delErr) {
          throw new Error(`consent.merge: delete anonymous failed: ${delErr.message}`);
        }
        mergedCount += 1;
      }

      return { mergedCount };
    },
  };
}

function makeCleanupSweep(deps: UseCaseDeps): CleanupSweepUseCases {
  const { admin, appUrl, domainAdapter, emailService, sender, brand, logger } = deps;

  return {
    async advancePhase3() {
      const nowIso = new Date().toISOString();
      const { data, error } = await admin
        .from('lgpd_requests')
        .select('id, user_id')
        .eq('type', 'account_deletion')
        .eq('status', 'processing')
        .eq('phase', 1)
        .lte('scheduled_purge_at', nowIso);
      if (error) {
        throw new Error(`cleanup.advancePhase3: query failed: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{ id: string; user_id: string }>;

      let processed = 0;
      for (const r of rows) {
        try {
          await domainAdapter.phase3Cleanup(r.user_id);
          const finishedAt = new Date().toISOString();
          const { error: updErr } = await admin
            .from('lgpd_requests')
            .update({
              status: 'completed',
              phase: 3,
              phase_3_completed_at: finishedAt,
              completed_at: finishedAt,
            })
            .eq('id', r.id);
          if (updErr) {
            throw new Error(updErr.message);
          }
          processed += 1;
        } catch (e) {
          // Soft-complete on failure so the user is effectively deleted
          // (anonymized) even when FKs block `auth.users` removal.
          const msg = e instanceof Error ? e.message : String(e);
          logger.warn('[lgpd_sweep_phase3_soft]', { requestId: r.id, message: msg });
          const finishedAt = new Date().toISOString();
          await admin
            .from('lgpd_requests')
            .update({
              status: 'completed_soft',
              phase_3_completed_at: finishedAt,
              completed_at: finishedAt,
              metadata: { soft_reason: msg },
            })
            .eq('id', r.id);
          processed += 1;
        }
      }
      return { processed };
    },

    async sendReminders() {
      const now = Date.now();
      const lowerIso = new Date(now).toISOString();
      const upperIso = new Date(now + REMINDER_WINDOW_DAYS * DAY_MS).toISOString();
      const { data, error } = await admin
        .from('lgpd_requests')
        .select('id, user_id, scheduled_purge_at, confirmation_token_hash, metadata')
        .eq('type', 'account_deletion')
        .eq('status', 'processing')
        .eq('phase', 1)
        .gt('scheduled_purge_at', lowerIso)
        .lt('scheduled_purge_at', upperIso);
      if (error) {
        throw new Error(`cleanup.sendReminders: query failed: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{
        id: string;
        user_id: string;
        scheduled_purge_at: string;
        confirmation_token_hash: string | null;
        metadata: Record<string, unknown> | null;
      }>;

      let sent = 0;
      for (const r of rows) {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        if (meta.reminder_sent_at) continue;

        try {
          const { data: ures } = await admin.auth.admin.getUserById(r.user_id);
          const email = ures?.user?.email ?? null;
          if (!email) {
            // No email on the auth row (already anonymized? unusual in grace).
            // Skip silently — nothing actionable.
            continue;
          }
          // The cancel URL needs the raw token; we only have the hash, so the
          // reminder links to the `/lgpd/cancel` landing page and relies on
          // the original email's token. Reminder body simply re-states the
          // grace end and points to the account page.
          const cancelUrl = `${appUrl}/account/delete?requestId=${r.id}`;
          const graceEndsAt = new Date(r.scheduled_purge_at);
          await sendDeletionReminderEmail(
            emailService,
            sender,
            brand,
            email,
            cancelUrl,
            graceEndsAt,
          );
          await admin
            .from('lgpd_requests')
            .update({
              metadata: { ...meta, reminder_sent_at: new Date().toISOString() },
            })
            .eq('id', r.id);
          sent += 1;
        } catch (e) {
          logger.warn('[lgpd_sweep_reminder_failed]', {
            requestId: r.id,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { sent };
    },

    async deleteExpiredBlobs() {
      const cutoffIso = new Date(Date.now() - BLOB_TTL_DAYS * DAY_MS).toISOString();
      const { data, error } = await admin
        .from('lgpd_requests')
        .select('id, blob_path')
        .eq('type', 'data_export')
        .eq('status', 'completed')
        .not('blob_path', 'is', null)
        .is('blob_deleted_at', null)
        .lt('blob_uploaded_at', cutoffIso);
      if (error) {
        throw new Error(`cleanup.deleteExpiredBlobs: query failed: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{ id: string; blob_path: string | null }>;

      let deleted = 0;
      for (const r of rows) {
        if (!r.blob_path) continue;
        try {
          const { error: delErr } = await admin.storage
            .from(EXPORTS_BUCKET)
            .remove([r.blob_path]);
          if (delErr) {
            throw new Error(delErr.message);
          }
          await admin
            .from('lgpd_requests')
            .update({ blob_deleted_at: new Date().toISOString() })
            .eq('id', r.id);
          deleted += 1;
        } catch (e) {
          logger.warn('[lgpd_sweep_blob_delete_failed]', {
            requestId: r.id,
            path: r.blob_path,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { deleted };
    },
  };
}

function makeTokenLookup(deps: UseCaseDeps): TokenLookupUseCases {
  const { admin } = deps;

  return {
    async resolve(token) {
      if (!token) return null;
      const hash = sha256Hex(token);
      const { data, error } = await admin
        .from('lgpd_requests')
        .select(
          'id, user_id, type, status, scheduled_purge_at, blob_path, blob_uploaded_at, blob_deleted_at',
        )
        .eq('confirmation_token_hash', hash)
        .maybeSingle();
      if (error) {
        throw new Error(`token_lookup.resolve: query failed: ${error.message}`);
      }
      if (!data) return null;
      const row = data as {
        id: string;
        user_id: string;
        type: 'account_deletion' | 'data_export';
        status: string;
        scheduled_purge_at: string | null;
        blob_path: string | null;
        blob_uploaded_at: string | null;
        blob_deleted_at: string | null;
      };

      if (row.type === 'data_export') {
        if (!row.blob_path || row.blob_deleted_at) {
          return null;
        }
        if (row.status !== 'completed') {
          // Not yet uploaded; fall through to render invalid.
          return null;
        }
        const { data: signed, error: sigErr } = await admin.storage
          .from(EXPORTS_BUCKET)
          .createSignedUrl(row.blob_path, DOWNLOAD_SIGNED_URL_TTL_SEC);
        if (sigErr || !signed?.signedUrl) {
          throw new Error(`token_lookup.resolve: signedUrl failed: ${sigErr?.message ?? 'unknown'}`);
        }
        return {
          requestId: row.id,
          type: 'data_export',
          status: row.status,
          userId: row.user_id,
          kind: 'data_export',
          signedUrl: signed.signedUrl,
        };
      }

      // account_deletion — distinguish between "confirm pending" and
      // "cancel-in-grace" so the page renders the right action.
      const kind: 'account_deletion' | 'account_deletion_cancel' =
        row.status === 'processing' ? 'account_deletion_cancel' : 'account_deletion';
      return {
        requestId: row.id,
        type: 'account_deletion',
        status: row.status,
        userId: row.user_id,
        kind,
      };
    },
  };
}

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
 *
 * Use-case glue (Phase 2): `accountDeletion`, `dataExport`, `consent`,
 * `cleanupSweep`, `tokenLookup` are local orchestrations that use the
 * service-role admin client + the B-track adapters. `@tn-figueiredo/lgpd@0.1.0`
 * only ships interfaces, so the use-case layer is maintained here until
 * a future minor bump of the package provides reusable factories.
 */
export function createLgpdContainer(): LgpdContainer {
  if (memo) return memo;

  const admin = getSupabaseServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com';
  const domainAdapter = new BythiagoLgpdDomainAdapter(admin);
  const inactiveUserFinder = new SupabaseInactiveUserFinder(admin);
  const emailService = getEmailService();
  const sender = {
    email: 'privacidade@bythiagofigueiredo.com',
    name: 'bythiagofigueiredo',
  };
  const brand: BrandOpts = {
    brandName: 'bythiagofigueiredo',
    siteUrl: appUrl,
  };
  const lgpdEmail = new BrevoLgpdEmailService(emailService, {
    sender,
    branding: { brandName: brand.brandName, siteUrl: appUrl },
  });

  // Null-object for `lgpdRequestRepo`: @tn-figueiredo/lgpd@0.1.0 ships only
  // interfaces (no use-case factories), so our local use-case glue writes to
  // `lgpd_requests` via the admin client directly. The `ILgpdRequestRepository`
  // slot is retained in LgpdConfig for future-minor bump compatibility — no
  // call site invokes it in Sprint 5a (Fix 7). If a future factory does,
  // every method throws so the regression is obvious.
  const notUsed =
    (method: string) =>
    (..._args: unknown[]): never => {
      throw new Error(
        `lgpdRequestRepo.${method}: not used — remove null-object when @tn-figueiredo/lgpd exposes real use-case factories`,
      );
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nullLgpdRequestRepo = {
    create: notUsed('create'),
    findById: notUsed('findById'),
    findByUserId: notUsed('findByUserId'),
    findPendingByUserId: notUsed('findPendingByUserId'),
    findByConfirmationToken: notUsed('findByConfirmationToken'),
    findByDeletionPhaseOlderThan: notUsed('findByDeletionPhaseOlderThan'),
    findPendingExports: notUsed('findPendingExports'),
    findExpiredExports: notUsed('findExpiredExports'),
    update: notUsed('update'),
    countByStatus: notUsed('countByStatus'),
    countByTypeAndStatus: notUsed('countByTypeAndStatus'),
    countCompletedThisMonth: notUsed('countCompletedThisMonth'),
    avgProcessingTime: notUsed('avgProcessingTime'),
  } as unknown as LgpdConfig['lgpdRequestRepo'];

  const config: LgpdConfig = {
    domainAdapter,
    lgpdRequestRepo: nullLgpdRequestRepo,
    lgpdAuditLogRepo: new AuditLogLgpdRepository(admin),
    emailService: lgpdEmail,
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

  const deps: UseCaseDeps = {
    admin,
    appUrl,
    domainAdapter,
    emailService,
    lgpdEmail,
    sender,
    brand,
    logger: config.logger,
  };

  memo = {
    config,
    inactiveUserFinder,
    domainAdapter,
    accountDeletion: makeAccountDeletion(deps),
    dataExport: makeDataExport(deps),
    consent: makeConsent(deps),
    cleanupSweep: makeCleanupSweep(deps),
    tokenLookup: makeTokenLookup(deps),
  };
  return memo;
}

/** Test helper — reset the singleton between suites. */
export function __resetLgpdContainerForTests(): void {
  memo = null;
}
