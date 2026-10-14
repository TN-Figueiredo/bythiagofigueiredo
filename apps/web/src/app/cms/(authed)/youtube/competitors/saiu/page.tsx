import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { abrirFila } from '../_saiu/dados'
import { apagarItem, ignorarVoltaDoGrupo, manterItens, responderVolta, tentarApagarDeNovo } from '../_saiu/actions'
import { FilaScreen } from '../_saiu/fila-screen'
import { buildFilaView, lerMostrar } from '../_saiu/view-model'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import '../_saiu/saiu.css'

export const metadata = { title: 'Saíram do YouTube · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function SaiuPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const mostrar = lerMostrar(sp?.mostrar)
  const leitura = await abrirFila(mostrar)
  const view = buildFilaView(leitura, { agoraMs: observatoryNow(), mostrar })
  return (
    <ObservatoryChromeServer tab="saiu" searchParams={sp}>
      <FilaScreen view={view} acoes={{ apagar: apagarItem, manter: manterItens, volta: responderVolta, tentar: tentarApagarDeNovo, ignorarGrupo: ignorarVoltaDoGrupo }} />
    </ObservatoryChromeServer>
  )
}
