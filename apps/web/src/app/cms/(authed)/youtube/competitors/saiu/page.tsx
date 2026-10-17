import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { gerarPacoteIa } from '../contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { apagarItem, ignorarVoltaDoGrupo, manterItens, responderVolta, tentarApagarDeNovo } from '../_saiu/actions'
import { FilaScreen } from '../_saiu/fila-screen'
import { montarFila } from '../_saiu/montar'
import '../_saiu/saiu.css'

export const metadata = { title: 'Saíram do YouTube · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function SaiuPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { view } = await montarFila(flat)
  return (
    <ObservatoryChromeServer tab="saiu" searchParams={sp}
      perguntarIa={{ tela: 'fila', nomeDaTela: TELAS_IA['fila'].nome, exemplos: TELAS_IA['fila'].exemplos, onGerar: gerarPacoteIa }}>
      <FilaScreen view={view} acoes={{ apagar: apagarItem, manter: manterItens, volta: responderVolta, tentar: tentarApagarDeNovo, ignorarGrupo: ignorarVoltaDoGrupo }} />
    </ObservatoryChromeServer>
  )
}
