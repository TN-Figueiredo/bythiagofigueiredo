import { welcomeTemplate, ensureUnsubscribeToken } from '@tn-figueiredo/email';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getEmailService } from '../../../../../lib/email/service';
import { getEmailSender } from '../../../../../lib/email/sender';
import { createBrevoContact } from '../../../../../lib/brevo';

const BATCH_SIZE = 50;
const LOCK_KEY = 'cron:sync-newsletter-pending';

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

type SupabaseSvc = ReturnType<typeof getSupabaseServiceClient>;

async function tryLock(supabase: SupabaseSvc): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('cron_try_lock', { p_job: LOCK_KEY });
    if (error) return true; // fail open in envs where RPC isn't deployed yet
    return data === true;
  } catch {
    return true;
  }
}

async function releaseLock(supabase: SupabaseSvc): Promise<void> {
  try {
    await supabase.rpc('cron_unlock', { p_job: LOCK_KEY });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  // H6: advisory lock — skip overlapping runs.
  const gotLock = await tryLock(supabase);
  if (!gotLock) {
    return Response.json({ status: 'locked' }, { status: 200 });
  }

  const start = Date.now();
  let synced = 0;
  let unsubscribed = 0;
  // H2: errors log subscription_id only — never raw email (PII).
  const errors: Array<{ id: string | null; error: string }> = [];

  // M6: hoist email service + base url out of the loop.
  const emailService = getEmailService();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
  const senderCache = new Map<string, Awaited<ReturnType<typeof getEmailSender>>>();
  async function senderFor(siteId: string) {
    let s = senderCache.get(siteId);
    if (!s) {
      s = await getEmailSender(siteId);
      senderCache.set(siteId, s);
    }
    return s;
  }

  try {
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
      errors.push({ id: null, error: `query pending: ${pendingErr.message}` });
    }

    for (const row of (pending as PendingSub[] | null) ?? []) {
      try {
        const site = row.sites;
        if (!site?.brevo_newsletter_list_id) continue;

        // Reserve the row with a sentinel before the Brevo call so a
        // concurrent run (or racing process) cannot pick it up.
        const sentinel = `syncing:${cryptoRandom()}`;
        const { data: reserved, error: reserveErr } = await supabase
          .from('newsletter_subscriptions')
          .update({ brevo_contact_id: sentinel })
          .eq('id', row.id)
          .is('brevo_contact_id', null)
          .select('id');

        if (reserveErr || !reserved || reserved.length === 0) {
          // Another runner already claimed this row — skip.
          continue;
        }

        const contact = await createBrevoContact({
          email: row.email,
          listId: site.brevo_newsletter_list_id,
        });

        const brevoId = contact.id != null ? String(contact.id) : 'synced';

        // Commit the Brevo sync FIRST. If the welcome-email step crashes for
        // any reason, the next cron run will NOT re-sync this row (avoiding
        // both a duplicate Brevo contact and a duplicate welcome send).
        await supabase
          .from('newsletter_subscriptions')
          .update({ brevo_contact_id: brevoId })
          .eq('id', row.id);

        // Send welcome email (best-effort — don't fail the sync if email sending fails).
        // Belt+suspenders against C1 double-send:
        //   1. Pre-check sent_emails for an existing welcome row (skip if present).
        //   2. Wrap insert in 23505 catch (the new unique partial index makes
        //      concurrent double-inserts impossible at the DB level).
        try {
          const { data: existingWelcome } = await supabase
            .from('sent_emails')
            .select('id')
            .eq('site_id', row.site_id)
            .eq('to_email', row.email)
            .eq('template_name', 'welcome')
            .limit(1)
            .maybeSingle();

          if (existingWelcome) {
            synced++;
            continue;
          }

          const sender = await senderFor(row.site_id);
          const unsubscribeUrl = await ensureUnsubscribeToken(
            supabase,
            row.site_id,
            row.email,
            baseUrl,
          );
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

          // H8: send is synchronous here → status 'sent', not 'queued'.
          const { error: welcomeInsErr } = await supabase.from('sent_emails').insert({
            site_id: row.site_id,
            template_name: 'welcome',
            to_email: row.email,
            subject: 'Welcome',
            provider: 'brevo',
            provider_message_id: result.messageId ?? null,
            status: 'sent',
          });

          // 23505 = duplicate via unique partial index → already sent, no-op.
          if (welcomeInsErr && (welcomeInsErr as { code?: string }).code !== '23505') {
            errors.push({
              id: row.id,
              error: `welcome insert: ${welcomeInsErr.message}`,
            });
          }
        } catch (emailErr) {
          errors.push({
            id: row.id,
            error: `welcome: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`,
          });
        }

        synced++;
      } catch (e) {
        // Rollback sentinel on failure so next run retries.
        try {
          await supabase
            .from('newsletter_subscriptions')
            .update({ brevo_contact_id: null })
            .eq('id', row.id)
            .like('brevo_contact_id', 'syncing:%');
        } catch {
          /* best-effort */
        }
        errors.push({
          id: row.id,
          error: `sync: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // --- Sync unsubscribes → clear brevo_contact_id ---
    const { data: unsubs, error: unsubErr } = await supabase
      .from('newsletter_subscriptions')
      .select('id, brevo_contact_id')
      .eq('status', 'unsubscribed')
      .not('brevo_contact_id', 'is', null)
      .limit(BATCH_SIZE);

    if (unsubErr) {
      errors.push({ id: null, error: `query unsubscribed: ${unsubErr.message}` });
    }

    for (const sub of (unsubs as UnsubSub[] | null) ?? []) {
      try {
        await supabase
          .from('newsletter_subscriptions')
          .update({ brevo_contact_id: null })
          .eq('id', sub.id);
        unsubscribed++;
      } catch (e) {
        errors.push({
          id: sub.id,
          error: `unsub clear: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // --- Cron audit log ---
    try {
      await supabase.from('cron_runs').insert({
        job: 'sync-newsletter-pending',
        status: errors.length > 0 ? 'error' : 'ok',
        duration_ms: Date.now() - start,
        items_processed: synced + unsubscribed,
        error:
          errors.length > 0
            ? errors
                .map((e) => `${e.id ?? '-'}:${e.error}`)
                .join('; ')
                .slice(0, 1000)
            : null,
      });
    } catch {
      /* best-effort */
    }

    return Response.json({ synced, unsubscribed, errors: errors.length });
  } finally {
    await releaseLock(supabase);
  }
}

function cryptoRandom(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
