import { YouTubeContentEditor } from './content-editor'
import { loadPageContent } from './actions'

export const metadata = { title: 'Conteúdo' }
export const dynamic = 'force-dynamic'

export default async function YouTubeContentPage() {
  const en = await loadPageContent('en')
  const pt = await loadPageContent('pt-BR')

  return <YouTubeContentEditor initialEn={en} initialPt={pt} />
}
