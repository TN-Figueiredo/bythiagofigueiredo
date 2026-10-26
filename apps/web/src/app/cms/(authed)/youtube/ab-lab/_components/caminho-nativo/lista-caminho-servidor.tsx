// Componente de servidor assíncrono: a leitura da lista mora AQUI, dentro do <Suspense> da página, para o esqueleto aparecer
// e para um erro de leitura cair no <ListaErro> sem derrubar o painel dos testes. Nunca `await` no corpo do `page`.
import type { ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import { leituraDoEditor } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerLinhasDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube,
} from '../../actions-nativo'
import { pauseAbTest, retryRestore } from '../../actions'
import type { AcoesCaminho } from './lista-caminho'
import { ListaCaminhoComPaineis } from './lista-caminho-paineis'

export const ACOES: AcoesCaminho = {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube, pauseAbTest, retryRestore,
}

export async function ListaCaminhoServidor({ siteId, videoInicial }: { siteId: string; videoInicial: string | null }): Promise<ReactElement> {
  // Lança em erro de banco: nunca uma lista vazia "0 vídeos" falsa.
  // O volume vem de uma RPC que lê dado privado do canal (impressões): a borda repete a prova de edição, sem confiar na ordem do `page`.
  // Sem prova a lista abre sem volume (nunca erro, nunca o dado) e o Sentry fica sabendo.
  const leitura = await leituraDoEditor(siteId)
  if (leitura === null) Sentry.captureMessage('ab-lab lista: sem prova de edição; lista sem volume', { level: 'warning', tags: { component: 'ab-lab-lista' }, extra: { siteId } })
  const linhas = await lerLinhasDoCaminho(getSupabaseServiceClient(), siteId, new Date(), leitura)
  return <ListaCaminhoComPaineis linhas={linhas} videoInicial={videoInicial} acoes={ACOES} />
}
