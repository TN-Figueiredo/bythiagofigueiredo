import type { YouTubeCategoryRow } from './types'

interface VideoInput {
  title: string
  tags: string[]
  description: string
}

interface CategorizeResult {
  categoryId: string
  autoApprove: boolean
}

export function autoCategorize(
  video: VideoInput,
  categories: YouTubeCategoryRow[],
): CategorizeResult | null {
  const searchable = [video.title, ...video.tags, video.description]
    .join(' ')
    .toLowerCase()

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  for (const cat of sorted) {
    const matched = cat.match_keywords.some(
      (kw) => searchable.includes(kw.toLowerCase()),
    )
    if (matched) {
      return { categoryId: cat.id, autoApprove: cat.auto_approve }
    }
  }

  return null
}
