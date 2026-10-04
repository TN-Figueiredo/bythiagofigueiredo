import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CAMPAIGN_INTERESTS } from '@/lib/campaigns/interest'
import {
  NEW_CAMPAIGN_EMPTY_TRANSLATION_TEXTS,
  type CampaignTranslationLocale,
} from '@/lib/campaigns/new-campaign-defaults'
import type { GraduateCampaignOptions } from '../schemas'
import { PipelineServiceError } from './types'

type Supabase = ReturnType<typeof getSupabaseServiceClient>
type Item = Record<string, unknown>

/** Tudo o que será gravado: a mesma estrutura serve ao dry run (devolvida ao cliente) e ao insert. */
export interface CampaignDraftPlan {
  campaign: { site_id: string; interest: string; status: 'draft'; locale: string; form_fields: never[] }
  translation: Record<string, string | null> & { locale: string; slug: string; main_hook_md: string; context_tag: string }
}

const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v : null

/** kebab-case ASCII; tira acentos antes (o regex puro de blog/curso trocaria "ç" por hífen). */
export function slugFromTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

/**
 * Monta o rascunho a partir do item + opções, ou lança 422 VALIDATION_ERROR dizendo EXATAMENTE
 * o que falta. Função pura: o dry run e a graduação real passam por aqui, então o dry run nunca
 * diz "ok" para algo que a graduação recusaria por falta de campo.
 *
 * Origem dos campos: ver o relatório do plano; `interest` nunca é inventado.
 */
export function planCampaignDraft(
  siteId: string,
  item: Item,
  opts: GraduateCampaignOptions | undefined,
): CampaignDraftPlan {
  const o = opts ?? {}
  const locale: CampaignTranslationLocale = o.locale ?? (item.language === 'en' ? 'en' : 'pt-BR')
  const title = (locale === 'en'
    ? nonEmpty(item.title_en) ?? nonEmpty(item.title_pt)
    : nonEmpty(item.title_pt) ?? nonEmpty(item.title_en)) as string
  const hook = o.main_hook_md ?? nonEmpty(item.hook) ?? nonEmpty(item.synopsis)
  const slug = o.slug ?? slugFromTitle(title)

  const missing: string[] = []
  if (!o.interest) missing.push('interest')
  if (!hook) missing.push('main_hook_md')
  if (!slug) missing.push('slug')
  if (missing.length > 0) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      `Cannot create a valid campaign draft: missing ${missing.join(', ')}. ` +
        (missing.includes('interest') ? `Pass campaign.interest (one of ${CAMPAIGN_INTERESTS.join(', ')}). ` : '') +
        (missing.includes('main_hook_md') ? 'Pass campaign.main_hook_md or fill the item hook/synopsis. ' : '') +
        (missing.includes('slug') ? 'Pass campaign.slug (the title yields no usable slug). ' : ''),
      422,
      { missing_fields: missing },
    )
  }
  const interest = o.interest as string

  return {
    campaign: { site_id: siteId, interest, status: 'draft', locale, form_fields: [] },
    translation: {
      locale,
      slug,
      main_hook_md: hook as string,
      meta_title: title,
      meta_description: o.meta_description ?? nonEmpty(item.synopsis),
      og_image_url: nonEmpty(item.cover_image_url),
      body_content_md: nonEmpty(item.body_content),
      context_tag: o.context_tag ?? interest,
      ...NEW_CAMPAIGN_EMPTY_TRANSLATION_TEXTS,
      ...(o.success_headline !== undefined ? { success_headline: o.success_headline } : {}),
      ...(o.success_headline_duplicate !== undefined ? { success_headline_duplicate: o.success_headline_duplicate } : {}),
      ...(o.success_subheadline !== undefined ? { success_subheadline: o.success_subheadline } : {}),
      ...(o.success_subheadline_duplicate !== undefined ? { success_subheadline_duplicate: o.success_subheadline_duplicate } : {}),
      ...(o.check_mail_text !== undefined ? { check_mail_text: o.check_mail_text } : {}),
      ...(o.download_button_label !== undefined ? { download_button_label: o.download_button_label } : {}),
      ...(o.form_button_label !== undefined ? { form_button_label: o.form_button_label } : {}),
      ...(o.form_button_loading_label !== undefined ? { form_button_loading_label: o.form_button_loading_label } : {}),
    },
  }
}

/**
 * O trigger `campaign_translations_validate_slug` recusa (23505) slug repetido no mesmo
 * (site, locale). Checar antes dá 409 claro também no dry run e evita criar a campanha à toa.
 * Duas consultas simples (traduções com o slug/locale; depois quais dessas campanhas são do site)
 * em vez de um embed `campaigns!inner`, para o filtro de site ser verificável.
 */
export async function assertCampaignSlugFree(
  supabase: Supabase,
  siteId: string,
  locale: string,
  slug: string,
): Promise<void> {
  const { data: txs, error } = await supabase
    .from('campaign_translations')
    .select('campaign_id')
    .eq('locale', locale)
    .eq('slug', slug)
  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to check campaign slug', 500)
  }
  const ids = (txs ?? []).map((t) => t.campaign_id as string)
  if (ids.length === 0) return
  const { data: owned, error: ownedError } = await supabase
    .from('campaigns')
    .select('id')
    .in('id', ids)
    .eq('site_id', siteId)
  if (ownedError) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to check campaign slug', 500)
  }
  if ((owned ?? []).length > 0) {
    throw new PipelineServiceError(
      'CONFLICT',
      `A campaign with slug "${slug}" already exists for locale ${locale}. Pass campaign.slug to choose another.`,
      409,
      { slug, locale },
    )
  }
}

/**
 * Cria campanha + tradução; se a tradução falhar, desfaz a campanha (a FK é ON DELETE CASCADE).
 * Usada pela graduação do pipeline e pela action "Nova campanha" do CMS: o `create` do pacote
 * cms@0.2.0 escreve colunas brevo que não existem mais.
 */
export async function insertCampaignDraft(
  supabase: Supabase,
  plan: CampaignDraftPlan,
): Promise<string> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(plan.campaign)
    .select('id')
    .single()
  if (error || !campaign) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to create campaign', 500)
  }

  const { error: txError } = await supabase
    .from('campaign_translations')
    .insert({ campaign_id: campaign.id, ...plan.translation })
  if (txError) {
    await deleteCampaignDraft(supabase, campaign.id as string, plan.campaign.site_id)
    if (txError.code === '23505') {
      throw new PipelineServiceError(
        'CONFLICT',
        `A campaign with slug "${plan.translation.slug}" already exists for locale ${plan.translation.locale}.`,
        409,
      )
    }
    throw new PipelineServiceError('DB_ERROR', 'Failed to create campaign translation', 500)
  }
  return campaign.id as string
}

/**
 * Rollback: apaga a campanha (site-scoped). Se o delete falhar, a campanha fica órfã: reporta ao
 * Sentry com o id e devolve false; quem chama continua respondendo o erro original ao cliente.
 */
export async function deleteCampaignDraft(
  supabase: Supabase,
  campaignId: string,
  siteId: string,
): Promise<boolean> {
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId).eq('site_id', siteId)
  if (error) {
    Sentry.captureException(new Error('campaign rollback failed: orphan draft campaign'), {
      tags: { component: 'pipeline-campaign-graduation' },
      extra: { campaign_id: campaignId, site_id: siteId, code: error.code },
    })
    return false
  }
  return true
}
