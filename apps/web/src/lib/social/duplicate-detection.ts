// apps/web/src/lib/social/duplicate-detection.ts
//
// Detects existing social posts for the same CMS content.
// Used at Composer load time (CMS mode) to warn users about
// potential duplicate postings per spec Section 6.8.

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExistingPost {
  id: string
  platform: string
  status: string
  published_at: string | null
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean
  posts: ExistingPost[]
}

export type DuplicateSeverity = 'none' | 'warning' | 'confirm'

export interface DuplicateWarnings {
  /** All existing posts for this content (any platform) */
  totalExisting: number
  /** Existing posts on the same platform(s) the user selected */
  samePlatformPosts: ExistingPost[]
  /** Severity: 'none' = no duplicates, 'warning' = cross-platform only, 'confirm' = same-platform */
  severity: DuplicateSeverity
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Queries social_posts for existing posts linked to the same content.
 * Excludes cancelled and failed posts (they don't count as duplicates).
 */
export async function checkDuplicates(
  supabase: SupabaseClient,
  sourceType: string,
  sourceId: string,
): Promise<DuplicateCheckResult> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('id, platform, status, published_at')
    .eq('source_content_type', sourceType)
    .eq('source_content_id', sourceId)
    .not('status', 'in', '("cancelled","failed")')

  if (error || !data) {
    return { hasDuplicates: false, posts: [] }
  }

  const posts: ExistingPost[] = data.map((row) => ({
    id: row.id as string,
    platform: row.platform as string,
    status: row.status as string,
    published_at: row.published_at as string | null,
  }))

  return {
    hasDuplicates: posts.length > 0,
    posts,
  }
}

// ---------------------------------------------------------------------------
// Warning computation (client-side, no DB access needed)
// ---------------------------------------------------------------------------

/**
 * Given existing posts and the platforms the user wants to post to,
 * computes the appropriate warning level.
 *
 * - Same content, same platform = 'confirm' (requires explicit confirmation)
 * - Same content, different platform = 'warning' (informational banner)
 * - No existing posts = 'none'
 */
export function getDuplicateWarnings(
  existingPosts: ExistingPost[],
  targetPlatforms: string[],
): DuplicateWarnings {
  if (existingPosts.length === 0) {
    return {
      totalExisting: 0,
      samePlatformPosts: [],
      severity: 'none',
    }
  }

  const samePlatformPosts = existingPosts.filter((p) =>
    targetPlatforms.includes(p.platform),
  )

  const severity: DuplicateSeverity =
    samePlatformPosts.length > 0 ? 'confirm' : 'warning'

  return {
    totalExisting: existingPosts.length,
    samePlatformPosts,
    severity,
  }
}
