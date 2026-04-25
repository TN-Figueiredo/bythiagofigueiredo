import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

export default async function globalTeardown(): Promise<void> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Delete test content (slug prefixed with "test-")
  // slug lives in blog_translations / campaign_translations, not on the parent tables.
  // Collect parent IDs via translations, then delete parents (translations cascade via FK ON DELETE CASCADE).

  const { data: blogTranslations } = await client
    .from('blog_translations')
    .select('post_id')
    .like('slug', 'test-%')
  if (blogTranslations?.length) {
    const postIds = blogTranslations.map((t: { post_id: string }) => t.post_id)
    await client.from('blog_posts').delete().in('id', postIds)
  }

  const { data: uiCreatedPosts } = await client
    .from('blog_translations')
    .select('post_id')
    .like('title', 'Test Draft %')
  if (uiCreatedPosts?.length) {
    const postIds = uiCreatedPosts.map((t: { post_id: string }) => t.post_id)
    await client.from('blog_posts').delete().in('id', postIds)
  }

  const { data: campaignTranslations } = await client
    .from('campaign_translations')
    .select('campaign_id')
    .like('slug', 'test-%')
  if (campaignTranslations?.length) {
    const campaignIds = campaignTranslations.map((t: { campaign_id: string }) => t.campaign_id)
    await client.from('campaigns').delete().in('id', campaignIds)
  }

  // Clean up newsletter test data (including sha256-anonymized emails)
  await client.from('newsletter_subscriptions').delete().like('email', 'e2e-%')
  await client.from('unsubscribe_tokens').delete().like('email', 'e2e-%')

  await client.from('contact_submissions').delete().like('email', '%@test.example')
  await client.from('contact_submissions').delete().like('email', '%@e2e-contact.test')
  await client.from('invitations').delete().like('email', 'e2e-%@test.example')

  // Delete test users
  const { data } = await client.auth.admin.listUsers()
  for (const u of (data?.users ?? []).filter(u => u.email?.endsWith('@test.local'))) {
    await client.auth.admin.deleteUser(u.id)
  }
}
