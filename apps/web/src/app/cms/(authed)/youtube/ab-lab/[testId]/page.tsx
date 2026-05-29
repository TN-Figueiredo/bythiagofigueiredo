import { getTestResults } from '../queries'
import { AbTestDetail } from '../_components/ab-test-detail'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AbTestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = await params
  const results = await getTestResults(testId)
  if (!results) notFound()
  return <AbTestDetail results={results} />
}
