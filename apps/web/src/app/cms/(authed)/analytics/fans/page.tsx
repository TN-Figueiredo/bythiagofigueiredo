import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function FansPage({ searchParams }: Props) {
  const params = await searchParams
  const qs = new URLSearchParams(params)
  qs.set('tab', 'fans')
  redirect(`/cms/analytics?${qs.toString()}`)
}
