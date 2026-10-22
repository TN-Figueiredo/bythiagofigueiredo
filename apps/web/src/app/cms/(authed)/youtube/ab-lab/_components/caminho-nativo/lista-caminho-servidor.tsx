// Componente de servidor assíncrono: a leitura da lista mora AQUI, dentro do <Suspense> da página, para o esqueleto aparecer
// e para um erro de leitura cair no <ListaErro> sem derrubar o painel dos testes. Nunca `await` no corpo do `page`.
import type { ReactElement } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerLinhasDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube,
} from '../../actions-nativo'
import { pauseAbTest, retryRestore } from '../../actions'
import type { AcoesCaminho } from './lista-caminho'
import { ListaCaminhoComPaineis } from './lista-caminho-paineis'

const ACOES: AcoesCaminho = {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, pauseAbTest, retryRestore,
}

export async function ListaCaminhoServidor({ siteId, videoInicial }: { siteId: string; videoInicial: string | null }): Promise<ReactElement> {
  // Lança em erro de banco: nunca uma lista vazia "0 vídeos" falsa.
  const linhas = await lerLinhasDoCaminho(getSupabaseServiceClient(), siteId, new Date())
  return <ListaCaminhoComPaineis linhas={linhas} videoInicial={videoInicial} acoes={ACOES} />
}
