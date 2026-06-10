import type { SocialConfig } from './types'
import type { DistributionPlan } from '@/app/cms/(authed)/blog/[id]/edit/types'

export type BlogDistributionPlan = DistributionPlan

/**
 * Converte o plano de distribuição do editor de blog num SocialConfig pronto
 * pro createSocialPostFromContent. v1: timing por plataforma ainda não viaja
 * (um social_post ativo por conteúdo — índice idx_social_posts_active_per_content);
 * o post social sai junto da publicação do blog.
 */
export function distributionToSocialConfig(
  plan: BlogDistributionPlan,
  hashtags: string[],
): SocialConfig {
  const platforms = Object.keys(plan) as SocialConfig['platforms']
  return {
    enabled: platforms.length > 0,
    platforms,
    captions: {},
    hashtags,
    image_source: 'cover_image',
    ig_template: 'card',
    formats: {},
  }
}
