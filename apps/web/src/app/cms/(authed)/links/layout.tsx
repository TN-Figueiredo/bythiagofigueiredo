import { redirect } from 'next/navigation'

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_LINKS_ENABLED !== 'true') redirect('/cms')
  return <>{children}</>
}
