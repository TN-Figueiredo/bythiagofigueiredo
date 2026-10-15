import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import { gerarPacoteIa } from '../contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { toggleChangeBookmark, pinVideo, unpinVideo } from '../actions'
import { askForjaReading } from '../forja-actions'
import { montarMudancas } from '../_mudancas/montar'
import { MudancasScreen } from '../_mudancas/mudancas-screen'
import '../_mudancas/mudancas.css'

export const metadata = { title: 'Mudanças · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function MudancasPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { pagina: { obs, meuCanalLembrado }, view } = await montarMudancas(flat)
  return (
    <ObservatoryChromeServer tab="mudancas" searchParams={sp} obs={obs} forja={view.forja} meuCanalLembrado={meuCanalLembrado}
      perguntarIa={{ tela: 'mudancas', nomeDaTela: TELAS_IA['mudancas'].nome, exemplos: TELAS_IA['mudancas'].exemplos, onGerar: gerarPacoteIa }}>
      <MudancasScreen view={view} onToggleSwipe={toggleChangeBookmark} onAskForja={askForjaReading} onPin={pinVideo} onUnpin={unpinVideo} />
    </ObservatoryChromeServer>
  )
}
