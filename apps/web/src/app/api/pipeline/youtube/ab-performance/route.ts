import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface WinnerVariant {
  id: string
  label: string
  title_text: string | null
  description_text: string | null
  metadata: {
    title_pattern?: string
    thumbnail_tags?: string[]
    emotional_triggers?: string[]
    visual_description?: string
  }
}

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()

  const { data: completedTests } = await supabase
    .from('ab_tests')
    .select(`
      id, name, test_type, confidence_at_completion, result_metadata,
      winner:ab_test_variants!winner_variant_id(id, label, title_text, description_text, metadata)
    `)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  const patterns: Record<string, number> = {}
  const tags: Record<string, { wins: number; tests: number }> = {}

  for (const test of completedTests ?? []) {
    const winnerRaw = test.winner as WinnerVariant[] | WinnerVariant | null
    const winner: WinnerVariant | null = Array.isArray(winnerRaw) ? winnerRaw[0] ?? null : winnerRaw
    if (!winner) continue

    const meta = winner.metadata ?? {}
    if (meta.title_pattern) {
      patterns[meta.title_pattern] = (patterns[meta.title_pattern] ?? 0) + 1
    }
    for (const tag of meta.thumbnail_tags ?? []) {
      const entry = tags[tag] ?? { wins: 0, tests: 0 }
      entry.wins++
      entry.tests++
      tags[tag] = entry
    }
  }

  return pipelineSuccess({
    completed_tests: completedTests?.length ?? 0,
    winning_patterns: patterns,
    winning_tags: tags,
  }, 200, auth)
}
