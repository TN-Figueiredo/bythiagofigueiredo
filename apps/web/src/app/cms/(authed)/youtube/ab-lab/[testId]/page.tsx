import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { EarlyDetail } from '../_components/early-detail'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { AbTestDetailView, AbTestActiveView } from '@/lib/youtube/ab-types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// generateMetadata — show video title in the browser tab
// ---------------------------------------------------------------------------

const FALLBACK_TITLE: Metadata = { title: 'Teste A/B — YouTube' }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>
}): Promise<Metadata> {
  const { testId } = await params

  // Mock IDs (dev only) — skip DB query
  if (testId.startsWith('mock-')) return FALLBACK_TITLE

  try {
    const results = await getTestResults(testId)
    if (!results) return FALLBACK_TITLE

    const videoTitle = (results.test.original_title ?? results.test.name).replace(
      /^Test:\s*/i,
      '',
    )
    return { title: `${videoTitle} — A/B Lab` }
  } catch {
    return FALLBACK_TITLE
  }
}

async function getMockMap(): Promise<Record<string, AbTestDetailView>> {
  if (process.env.NODE_ENV !== 'development') return {}
  const { MOCK_ACTIVE, MOCK_WINNER, MOCK_PLAYOFF, MOCK_EARLY } = await import('../_components/mock-views')
  return {
    'mock-active-1': MOCK_ACTIVE,
    'mock-active-2': MOCK_ACTIVE,
    'mock-completed-1': MOCK_WINNER,
    'mock-completed-2': MOCK_WINNER,
    'mock-completed-3': MOCK_PLAYOFF,
    'mock-draft-1': MOCK_ACTIVE,
    'mock-early-1': MOCK_EARLY,
  }
}

/** Test is in early state when no cycles completed and confidence < 5%. */
function isEarly(view: AbTestDetailView): view is AbTestActiveView {
  if (view.status === 'completed') return false
  const active = view as AbTestActiveView
  return active.cycles.done < 1 && active.confirmedData.confidence < 5
}

function renderView(view: AbTestDetailView) {
  if (isEarly(view)) return <EarlyDetail view={view} />
  if (view.status !== 'completed') return <ActiveDetail view={view} />
  if (view.outcome === 'winner') return <WinnerDetail view={view} />
  return <PlayoffDetail view={view} />
}

export default async function AbTestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = await params

  const mockMap = await getMockMap()
  const mockView = mockMap[testId]
  if (mockView) return renderView(mockView)

  const results = await getTestResults(testId)
  if (!results) notFound()

  return renderView(await toDetailView(results))
}
