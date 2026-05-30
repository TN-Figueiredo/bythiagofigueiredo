import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AbTestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = await params

  if (testId.startsWith('mock-')) notFound()

  const results = await getTestResults(testId)
  if (!results) notFound()

  const view = toDetailView(results)

  if (view.status !== 'completed') return <ActiveDetail view={view} />
  if (view.outcome === 'winner') return <WinnerDetail view={view} />
  return <PlayoffDetail view={view} />
}
