import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyTurnstileToken } from '../../../../../../lib/turnstile';
import { createBrevoContact } from '../../../../../../lib/brevo';
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service';
import { getLogger } from '../../../../../../lib/logger';

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  locale: z.string().min(2),
  consent_marketing: z.literal(true),
  consent_text_version: z.string().min(1),
  turnstile_token: z.string().min(1),
  interest: z.string().optional(),
});

const CampaignTranslationZ = z.object({
  success_headline: z.string(),
  success_headline_duplicate: z.string(),
  success_subheadline: z.string(),
  success_subheadline_duplicate: z.string(),
  check_mail_text: z.string(),
  download_button_label: z.string(),
});
const CampaignRowZ = z.object({
  id: z.string(),
  brevo_list_id: z.number().nullable(),
  pdf_storage_path: z.string().nullable(),
  interest: z.string(),
  campaign_translations: z.array(CampaignTranslationZ).min(1),
});

const PDF_SIGNED_URL_TTL_SECONDS = Number(
  process.env.CAMPAIGN_PDF_SIGNED_URL_TTL ?? 86_400,
); // default 24h

interface RouteCtx { params: Promise<{ slug: string }>; }

export async function POST(req: NextRequest | Request, ctx: RouteCtx): Promise<Response> {
  const { slug } = await ctx.params;
  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') ?? undefined;

  const turnstileOk = await verifyTurnstileToken(parsed.turnstile_token, ip);
  if (!turnstileOk) return Response.json({ error: 'turnstile_failed' }, { status: 400 });

  const supabase = getSupabaseServiceClient();

  const campaignRes = await supabase
    .from('campaigns')
    .select('id, brevo_list_id, pdf_storage_path, interest, campaign_translations!inner(success_headline, success_headline_duplicate, success_subheadline, success_subheadline_duplicate, check_mail_text, download_button_label)')
    .eq('campaign_translations.slug', slug)
    .eq('campaign_translations.locale', parsed.locale)
    .maybeSingle();

  if (campaignRes.error || !campaignRes.data) {
    return Response.json({ error: 'campaign_not_found' }, { status: 404 });
  }
  let campaign: z.infer<typeof CampaignRowZ>;
  try {
    campaign = CampaignRowZ.parse(campaignRes.data);
  } catch (e) {
    getLogger().error('[invalid_campaign_shape]', {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return Response.json({ error: 'invalid_campaign_shape' }, { status: 500 });
  }
  const tx = campaign.campaign_translations[0];
  if (!tx) {
    return Response.json({ error: 'campaign_not_found' }, { status: 404 });
  }

  // insert submission
  const insert = await supabase.from('campaign_submissions').insert({
    campaign_id: campaign.id,
    email: parsed.email,
    name: parsed.name,
    locale: parsed.locale,
    interest: parsed.interest ?? campaign.interest,
    consent_marketing: true,
    consent_text_version: parsed.consent_text_version,
    ip, user_agent: ua,
  }).select('id').single();

  let duplicate = false;
  const submissionId: string | null = insert.data?.id ?? null;
  if (insert.error) {
    if (insert.error.code === '23505') {
      duplicate = true;
    } else {
      return Response.json({ error: 'insert_failed' }, { status: 500 });
    }
  }

  // Brevo sync (non-blocking for user response)
  if (!duplicate && campaign.brevo_list_id && submissionId) {
    try {
      const contact = await createBrevoContact({
        email: parsed.email,
        name: parsed.name,
        listId: campaign.brevo_list_id,
        attributes: { INTEREST: parsed.interest ?? campaign.interest, LOCALE: parsed.locale },
      });
      await supabase.from('campaign_submissions').update({
        brevo_sync_status: 'synced',
        brevo_contact_id: contact.id != null ? String(contact.id) : null,
        brevo_synced_at: new Date().toISOString(),
      }).eq('id', submissionId);
    } catch (e) {
      await supabase.from('campaign_submissions').update({
        brevo_sync_status: 'failed',
        brevo_sync_error: e instanceof Error ? e.message : String(e),
      }).eq('id', submissionId);
      // Sprint 4 replaces this with Sentry.captureException
      getLogger().error('[brevo_sync_failed]', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  }

  // Signed URL for PDF
  let pdfUrl: string | null = null;
  if (campaign.pdf_storage_path) {
    const signed = await supabase.storage
      .from('campaign-files')
      .createSignedUrl(campaign.pdf_storage_path, PDF_SIGNED_URL_TTL_SECONDS);
    pdfUrl = signed.data?.signedUrl ?? null;
  }

  return Response.json({
    success: true,
    duplicate,
    pdfUrl,
    successCopy: {
      headline: duplicate ? tx.success_headline_duplicate : tx.success_headline,
      subheadline: duplicate ? tx.success_subheadline_duplicate : tx.success_subheadline,
      checkMailText: tx.check_mail_text,
      downloadButtonLabel: tx.download_button_label,
    },
  });
}
