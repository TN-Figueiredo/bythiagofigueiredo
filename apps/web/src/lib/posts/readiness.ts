import type { SectionStatus, PostTab } from './types'

export interface ReadinessInput {
  content: { titleFilled: boolean; hookFilled: boolean; bodyFilled: boolean }
  images: { coverSet: boolean }
  seo: { metaTitleFilled: boolean; metaDescriptionFilled: boolean; score: number }
  social: { platformsConfigured: number }
  schedule: { dateSet: boolean; dateSaved: boolean }
  newsletter: { decisionMade: boolean }
}

export interface ReadinessSection {
  tab: PostTab | 'schedule' | 'newsletter'
  status: SectionStatus
  weight: number
  earned: number
}

export interface ReadinessResult {
  score: number
  sections: Record<string, ReadinessSection>
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const contentFilled = [input.content.titleFilled, input.content.hookFilled, input.content.bodyFilled]
  const contentRatio = contentFilled.filter(Boolean).length / contentFilled.length
  const contentEarned = Math.round(contentRatio * 20)
  const contentStatus: SectionStatus = contentRatio === 1 ? 'done' : contentRatio > 0 ? 'warn' : 'empty'

  const imagesEarned = input.images.coverSet ? 15 : 0
  const imagesStatus: SectionStatus = input.images.coverSet ? 'done' : 'empty'

  const seoFieldsFilled = [input.seo.metaTitleFilled, input.seo.metaDescriptionFilled].filter(Boolean).length
  const seoFieldRatio = seoFieldsFilled / 2
  const seoScoreOk = input.seo.score >= 70
  const seoComplete = seoFieldRatio === 1 && seoScoreOk
  const seoEarned = seoComplete ? 20 : Math.round(seoFieldRatio * 15)
  const seoStatus: SectionStatus = seoComplete ? 'done' : seoFieldRatio > 0 ? 'warn' : 'empty'

  const socialEarned = input.social.platformsConfigured >= 1 ? 20 : 0
  const socialStatus: SectionStatus = input.social.platformsConfigured >= 1 ? 'done' : 'empty'

  const scheduleEarned = input.schedule.dateSet && input.schedule.dateSaved ? 15 : 0
  const scheduleStatus: SectionStatus =
    input.schedule.dateSet && input.schedule.dateSaved ? 'done' : input.schedule.dateSet ? 'warn' : 'empty'

  const newsletterEarned = input.newsletter.decisionMade ? 10 : 0
  const newsletterStatus: SectionStatus = input.newsletter.decisionMade ? 'done' : 'empty'

  const score = contentEarned + imagesEarned + seoEarned + socialEarned + scheduleEarned + newsletterEarned

  return {
    score,
    sections: {
      content: { tab: 'content', status: contentStatus, weight: 20, earned: contentEarned },
      images: { tab: 'images', status: imagesStatus, weight: 15, earned: imagesEarned },
      seo: { tab: 'seo', status: seoStatus, weight: 20, earned: seoEarned },
      social: { tab: 'social', status: socialStatus, weight: 20, earned: socialEarned },
      schedule: { tab: 'schedule', status: scheduleStatus, weight: 15, earned: scheduleEarned },
      newsletter: { tab: 'newsletter', status: newsletterStatus, weight: 10, earned: newsletterEarned },
    },
  }
}
