import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { MOCK_WINNER, MOCK_WINNER_MINIMAL, MOCK_PLAYOFF, MOCK_ACTIVE } from '../_components/mock-views'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const MOCK_VIEWS = {
  winner: MOCK_WINNER,
  'winner-minimal': MOCK_WINNER_MINIMAL,
  playoff: MOCK_PLAYOFF,
  active: MOCK_ACTIVE,
} as const

export default async function AbTestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { testId } = await params
  const sp = await searchParams
  const mockKey = typeof sp.view === 'string' ? sp.view : undefined

  if (mockKey && mockKey in MOCK_VIEWS) {
    const view = MOCK_VIEWS[mockKey as keyof typeof MOCK_VIEWS]
    if (view.status !== 'completed') return <ActiveDetail view={view} />
    if (view.outcome === 'winner') return <WinnerDetail view={view} />
    return <PlayoffDetail view={view} />
  }

  const results = await getTestResults(testId)
  if (!results) notFound()

  const view = toDetailView(results)

  if (view.status !== 'completed') return <ActiveDetail view={view} />
  if (view.outcome === 'winner') return <WinnerDetail view={view} />
  return <PlayoffDetail view={view} />
}
