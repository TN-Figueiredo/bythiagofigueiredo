import { redirect } from 'next/navigation'

export default function FansPage() {
  redirect('/cms/analytics?tab=fans')
}
