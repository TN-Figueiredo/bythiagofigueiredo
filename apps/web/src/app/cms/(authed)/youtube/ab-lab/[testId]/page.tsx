import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { MOCK_ACTIVE, MOCK_WINNER, MOCK_PLAYOFF } from '../_components/mock-views'
import { notFound } from 'next/navigation'
import type { AbTestDetailView } from '@/lib/youtube/ab-types'

export const dynamic = 'force-dynamic'

const MOCK_MAP: Record<string, AbTestDetailView> =
  process.env.NODE_ENV === 'development'
    ? {
        'mock-active-1': MOCK_ACTIVE,
        'mock-active-2': MOCK_ACTIVE,
        'mock-completed-1': MOCK_WINNER,
        'mock-completed-2': MOCK_WINNER,
        'mock-completed-3': MOCK_PLAYOFF,
        'mock-draft-1': MOCK_ACTIVE,
      }
    : {}

function renderView(view: AbTestDetailView) {
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

  const mockView = MOCK_MAP[testId]
  if (mockView) return renderView(mockView)

  const results = await getTestResults(testId)
  if (!results) notFound()

  return renderView(await toDetailView(results))
}
