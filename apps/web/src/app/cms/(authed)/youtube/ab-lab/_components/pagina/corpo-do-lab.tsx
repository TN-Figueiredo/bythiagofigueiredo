// Corpo da página do A/B Lab (M7 T5/T11): componente de servidor assíncrono. A leitura mora AQUI, dentro do <Suspense> da página
// (nunca `await` no corpo do `page`). Uma leitura por visita: a lista é a 1ª página de `lerPaginaDoLab`, sem segunda ida ao banco.
import type { ReactElement, ReactNode } from 'react'
import { lerPaginaDoLab } from '../../pagina-borda'
import { startAbTest, updateAbSiteSettings, avisoDeVolumeDoTeste, endAbTest, aplicarSugerido, revertWinner, pauseAbTest, retryRestore, escolherVersao, conferirNoAr } from '../../actions'
import {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube, lerVideosDoCanal,
} from '../../actions-nativo'
import { AbLabDashboard } from '../ab-lab-dashboard'
import type { AcoesCaminho } from '../caminho-nativo/lista-caminho'
import type { AcoesDecisao } from './painel-o-que-fica'

export const ACOES: AcoesCaminho = {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube, pauseAbTest, retryRestore,
}

const ACOES_DECISAO: AcoesDecisao = { encerrar: endAbTest, aplicarSugerido, voltar: revertWinner, escolher: escolherVersao, conferir: conferirNoAr }

export async function CorpoDoLab(
  { siteId, videoInicial, painelInicial = null, blocoSugestoes }: { siteId: string; videoInicial: string | null; painelInicial?: string | null; blocoSugestoes?: ReactNode },
): Promise<ReactElement> {
  const lida = await lerPaginaDoLab(siteId, new Date(), videoInicial)
  return (
    <AbLabDashboard
      siteId={siteId}
      pagina={lida.pagina}
      settings={lida.settings}
      eligibleVideos={lida.eligibleVideos}
      drafts={lida.drafts}
      iniciarTeste={startAbTest}
      avisoDeVolume={avisoDeVolumeDoTeste}
      acoesDecisao={ACOES_DECISAO}
      acoesCaminho={ACOES}
      lerVideos={lerVideosDoCanal}
      salvarAjustes={updateAbSiteSettings}
      listaInicial={lida.listaInicial}
      videoInicial={videoInicial}
      painelInicial={painelInicial}
      blocoSugestoes={blocoSugestoes}
      learnings={lida.learnings?.combined ?? null}
      channelLearnings={lida.learnings}
    />
  )
}
