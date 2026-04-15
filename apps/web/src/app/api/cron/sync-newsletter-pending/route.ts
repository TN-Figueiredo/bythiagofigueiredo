import { welcomeTemplate, ensureUnsubscribeToken } from '@tn-figueiredo/email';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getEmailService } from '../../../../../lib/email/service';
import { getEmailSender } from '../../../../../lib/email/sender';
import { createBrevoContact } from '../../../../../lib/brevo';

const BATCH_SIZE = 50;

interface PendingSub {
  id: string;
  site_id: string;
  email: string;
  consent_text_version: string;
  sites: {
    brevo_newsletter_list_id: number | null;
    default_locale: string;
    domains: string[];
    name: string;
  } | null;
}

interface UnsubSub {
  id: string;
  brevo_contact_id: string | null;
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const start = Date.now();
  let synced = 0;
  let unsubscribed = 0;
  const errors: string[] = [];

  // --- Sync pending confirms → Brevo ---
  const { data: pending, error: pendingErr } = await supabase
    .from('newsletter_subscriptions')
    .select(`
      id,
      site_id,
      email,
      consent_text_version,
      sites (
        brevo_newsletter_list_id,
        default_locale,
        domains,
        name
      )
    `)
    .eq('status', 'confirmed')
    .is('brevo_contact_id', null)
    .limit(BATCH_SIZE);

  if (pendingErr) {
    errors.push(`query pending: ${pendingErr.message}`);
  }

  for (const row of (pending as PendingSub[] | null) ?? []) {
    try {
      const site = row.sites;
      if (!site?.brevo_newsletter_list_id) continue;

      const contact = await createBrevoContact({
        email: row.email,
        listId: site.brevo_newsletter_list_id,
      });

      const brevoId = contact.id != null ? String(contact.id) : 'synced';

      // Update brevo_contact_id — if this fails, next run will retry (idempotent via IS NULL filter)
      await supabase
        .from('newsletter_subscriptions')
        .update({ brevo_contact_id: brevoId })
        .eq('id', row.id);

      // Send welcome email (best-effort — don't fail the sync if email sending fails)
      try {
        const sender = await getEmailSender(row.site_id);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
        const unsubscribeUrl = await ensureUnsubscribeToken(
          supabase,
          row.site_id,
          row.email,
          baseUrl,
        );
        const emailService = getEmailService();
        const result = await emailService.sendTemplate(
          welcomeTemplate,
          sender,
          row.email,
          {
            siteUrl: baseUrl,
            branding: {
              brandName: sender.brandName,
              primaryColor: sender.primaryColor,
              unsubscribeUrl,
            },
          },
          site.default_locale ?? 'pt-BR',
        );

        // Audit log — best-effort
        await supabase.from('sent_emails').insert({
          site_id: row.site_id,
          template_name: 'welcome',
          to_email: row.email,
          subject: 'Welcome',
          provider: 'brevo',
          provider_message_id: result.messageId ?? null,
          status: 'queued',
        });
      } catch (emailErr) {
        // Email send failure is non-fatal — contact is already registered in Brevo
        errors.push(
          `welcome email for ${row.email}: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`,
        );
      }

      synced++;
    } catch (e) {
      errors.push(
        `sync ${row.email}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // --- Sync unsubscribes → clear brevo_contact_id ---
  // Sprint 3 minimal: clear brevo_contact_id locally.
  // Brevo deletion API call deferred to Sprint 4.
  const { data: unsubs, error: unsubErr } = await supabase
    .from('newsletter_subscriptions')
    .select('id, brevo_contact_id')
    .eq('status', 'unsubscribed')
    .not('brevo_contact_id', 'is', null)
    .limit(BATCH_SIZE);

  if (unsubErr) {
    errors.push(`query unsubscribed: ${unsubErr.message}`);
  }

  for (const sub of (unsubs as UnsubSub[] | null) ?? []) {
    try {
      await supabase
        .from('newsletter_subscriptions')
        .update({ brevo_contact_id: null })
        .eq('id', sub.id);
      unsubscribed++;
    } catch (e) {
      errors.push(
        `unsub clear ${sub.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // --- Cron audit log ---
  try {
    await supabase.from('cron_runs').insert({
      job: 'sync-newsletter-pending',
      status: errors.length > 0 ? 'error' : 'ok',
      duration_ms: Date.now() - start,
      items_processed: synced + unsubscribed,
      error: errors.length > 0 ? errors.join('; ').slice(0, 1000) : null,
    });
  } catch {
    /* best-effort */
  }

  return Response.json({ synced, unsubscribed, errors: errors.length });
}
