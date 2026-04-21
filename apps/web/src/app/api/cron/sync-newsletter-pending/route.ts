import * as Sentry from '@sentry/nextjs';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getEmailService } from '../../../../../lib/email/service';
import { withCronLock, newRunId, logCron } from '../../../../../lib/logger';

const BATCH_SIZE = 50;
const LOCK_KEY = 'cron:sync-newsletter-pending';
const JOB = 'sync-newsletter-pending';

// M2: scrub PII — replace email addresses with <email>.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function scrubEmails(s: string): string {
  return s.replace(EMAIL_RE, '<email>');
}

function sanitizeError(e: unknown): string {
  if (e && typeof e === 'object') {
    const obj = e as { code?: unknown; message?: unknown };
    const code = typeof obj.code === 'string' ? obj.code : undefined;
    const rawMsg = typeof obj.message === 'string' ? obj.message : String(e);
    const msg = scrubEmails(rawMsg);
    return code ? `${code}: ${msg}` : msg;
  }
  if (e instanceof Error) return scrubEmails(e.message);
  return scrubEmails(String(e));
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const runId = newRunId();

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const errors: Array<{ id: string | null; error: string }> = [];

    const emailService = getEmailService();

    // --- Send welcome emails to confirmed subs that haven't received one ---
    const { data: pending, error: pendingErr } = await supabase
      .from('newsletter_subscriptions')
      .select('id, site_id, email, consent_text_version')
      .eq('status', 'confirmed')
      .eq('welcome_sent', false)
      .limit(BATCH_SIZE);

    if (pendingErr) {
      errors.push({ id: null, error: `query pending: ${sanitizeError(pendingErr)}` });
    }

    let sent = 0;

    for (const sub of (pending as Array<{ id: string; site_id: string; email: string; consent_text_version: string }> | null) ?? []) {
      try {
        await emailService.send({
          from: { name: 'Thiago Figueiredo', email: 'newsletter@bythiagofigueiredo.com' },
          to: sub.email,
          subject: 'Welcome to the newsletter!',
          html: `<p>Thanks for confirming your subscription.</p>`,
        });
        await supabase
          .from('newsletter_subscriptions')
          .update({ welcome_sent: true })
          .eq('id', sub.id);
        sent++;
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'cron', job: JOB, subId: sub.id } });
        errors.push({ id: sub.id, error: `welcome: ${sanitizeError(err)}` });
      }
    }

    // --- Cron audit log (best-effort) ---
    const hasErrors = errors.length > 0;
    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: hasErrors ? 'error' : 'ok',
        items_processed: sent,
        error: hasErrors
          ? errors
              .map((e) => `${e.id ?? '-'}:${e.error}`)
              .join('; ')
              .slice(0, 1000)
          : null,
      });
    } catch {
      /* best-effort */
    }

    if (hasErrors) {
      logCron({
        job: JOB,
        run_id: runId,
        status: 'error',
        err_code: 'partial_failure',
        processed: sent,
        errors_count: errors.length,
      });
    }

    return {
      status: 'ok' as const,
      sent,
      processed: sent,
      errors_count: errors.length,
    };
  });
}
