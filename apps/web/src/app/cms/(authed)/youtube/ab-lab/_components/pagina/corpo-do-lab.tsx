// Corpo da página do A/B Lab (M7 T5): componente de servidor assíncrono. A leitura mora AQUI, dentro do <Suspense> da página
// (nunca `await` no corpo do `page`). Uma leitura por visita: a lista é a 1ª página de `lerPaginaDoLab`, sem segunda ida ao banco.
import type { ReactElement, ReactNode } from 'react'
import { lerPaginaDoLab } from '../../pagina-borda'
import { startAbTest, avisoDeVolumeDoTeste } from '../../actions'
import { AbLabDashboard } from '../ab-lab-dashboard'
import { ListaErro } from '../caminho-nativo/lista-erro'
import { ListaCaminhoComPaineis } from '../caminho-nativo/lista-caminho-paineis'
import { ACOES } from '../caminho-nativo/lista-caminho-servidor'

export async function CorpoDoLab(
  { siteId, videoInicial, blocoSugestoes }: { siteId: string; videoInicial: string | null; blocoSugestoes?: ReactNode },
): Promise<ReactElement> {
  const lida = await lerPaginaDoLab(siteId, new Date(), videoInicial)
  return (
    <AbLabDashboard
      siteId={siteId}
      stats={lida.legado.stats}
      cards={lida.legado.cards}
      drafts={lida.drafts}
      completed={lida.legado.completed}
      paused={lida.legado.paused}
      learnings={lida.learnings?.combined ?? null}
      channelLearnings={lida.learnings}
      suggested={[]}
      settings={lida.settings}
      eligibleVideos={lida.eligibleVideos}
      iniciarTeste={startAbTest}
      avisoDeVolume={avisoDeVolumeDoTeste}
      pagina={lida.pagina}
      listaInicial={lida.listaInicial}
      listaSlot={
        <ListaErro key="lista-caminho">
          <ListaCaminhoComPaineis linhas={lida.listaInicial.linhas} videoInicial={videoInicial} acoes={ACOES} />
        </ListaErro>
      }
      blocoSugestoes={blocoSugestoes}
    />
  )
}
