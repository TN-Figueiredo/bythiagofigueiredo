import type { SupabaseClient } from '@supabase/supabase-js'

export async function seedBlogPost(
  supabase: SupabaseClient,
  siteId: string,
  ownerUserId: string,
  translation: {
    locale?: string
    title: string
    slug: string
    content_mdx?: string
  },
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({ status: 'draft', site_id: siteId, owner_user_id: ownerUserId, ...overrides })
    .select('id')
    .single()
  if (error || !post) throw new Error(`seedBlogPost failed (siteId=${siteId}, slug=${translation.slug}): ${error?.message}`)

  await supabase.from('blog_translations').insert({
    post_id: post.id,
    locale: translation.locale ?? 'pt-BR',
    title: translation.title,
    slug: translation.slug,
    content_mdx: translation.content_mdx ?? '# Test',
  })
  return post.id
}

const CAMPAIGN_TRANSLATION_DEFAULTS = {
  main_hook_md: '# Test',
  context_tag: 'test',
  success_headline: 'Sucesso',
  success_headline_duplicate: 'Sucesso',
  success_subheadline: 'Obrigado',
  success_subheadline_duplicate: 'Obrigado',
  check_mail_text: 'Verifique seu e-mail',
  download_button_label: 'Baixar',
} as const

export async function seedCampaign(
  supabase: SupabaseClient,
  siteId: string,
  ownerUserId: string,
  slug: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      interest: 'other',
      status: 'draft',
      site_id: siteId,
      owner_user_id: ownerUserId,
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !campaign) throw new Error(`seedCampaign failed (siteId=${siteId}, slug=${slug}): ${error?.message}`)

  await supabase.from('campaign_translations').insert({
    campaign_id: campaign.id,
    locale: 'pt-BR',
    slug,
    ...CAMPAIGN_TRANSLATION_DEFAULTS,
  })
  return campaign.id
}

/**
 * Id of the local site whose `domains` contains `localhost` (the site the dev server resolves for
 * http://localhost:3099). Without a client it builds one from NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
export async function getSeedSiteId(supabase?: SupabaseClient): Promise<string> {
  let sb = supabase
  if (!sb) {
    // same local-only guard as the seed (apps/web/.env.local points at production)
    const { localServiceClient } = await import('./observatorio-seed')
    sb = localServiceClient()
  }
  const { data, error } = await sb.from('sites').select('id').contains('domains', ['localhost']).order('created_at').limit(1).maybeSingle()
  if (error || !data) throw new Error(`getSeedSiteId: no site with 'localhost' in domains: ${error?.message ?? 'none'}`)
  return data.id as string
}
