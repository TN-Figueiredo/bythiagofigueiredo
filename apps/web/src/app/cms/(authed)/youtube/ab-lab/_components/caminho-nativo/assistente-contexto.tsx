'use client'
// Guarda D-8 em UM lugar só: `abrirAssistente(video)`. O dashboard a usa nas três portas do "Iniciar teste" do nosso
// (a linha da lista, o seletor de vídeo e o cartão "Sugeridos para testar"); `handleContinueDraft` abre direto.
// A lista (filho assíncrono do servidor) registra as linhas aqui e lê a pergunta aberta pelo contexto.
import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { cobrarD8 } from './guarda-d8'

export interface VideoDoAssistente { id: string; title: string; thumbnailUrl: string | null; sourcePipelineId?: string | null }

export interface ControleAssistente {
  abrirAssistente: (video: VideoDoAssistente) => void
  registrarLinhas: (linhas: LinhaDoCaminho[]) => void
  /** `videoId` (uuid) da linha com a pergunta D-8 aberta. */
  perguntaAberta: string | null
  fecharPergunta: () => void
  /** "Ainda não, seguir com o nosso teste": abre o assistente sem gravar nada. */
  seguirComNosso: (l: LinhaDoCaminho) => void
  atualizar: () => void
}

export const videoDaLinha = (l: LinhaDoCaminho): VideoDoAssistente => ({ id: l.videoId, title: l.titulo, thumbnailUrl: l.miniaturaUrl })

export function useControleAssistente(p: { onAbrir: (v: VideoDoAssistente) => void; atualizar: () => void; agora?: () => Date }): ControleAssistente {
  const linhas = useRef<LinhaDoCaminho[]>([])
  const [perguntaAberta, setPergunta] = useState<string | null>(null)
  const { onAbrir, atualizar, agora } = p

  const abrirAssistente = useCallback((video: VideoDoAssistente): void => {
    const l = linhas.current.find((x) => x.videoId === video.id)
    if (l && cobrarD8(l, (agora ?? (() => new Date()))())) { setPergunta(l.videoId); return }
    setPergunta(null)
    onAbrir(video)
  }, [onAbrir, agora])
  const registrarLinhas = useCallback((l: LinhaDoCaminho[]): void => { linhas.current = l }, [])
  const fecharPergunta = useCallback((): void => setPergunta(null), [])
  const seguirComNosso = useCallback((l: LinhaDoCaminho): void => { setPergunta(null); onAbrir(videoDaLinha(l)) }, [onAbrir])

  return useMemo(() => ({ abrirAssistente, registrarLinhas, perguntaAberta, fecharPergunta, seguirComNosso, atualizar }),
    [abrirAssistente, registrarLinhas, perguntaAberta, fecharPergunta, seguirComNosso, atualizar])
}

/** Sem provedor (lista fora do dashboard): nada abre e nenhuma pergunta aparece. */
export const SEM_ASSISTENTE: ControleAssistente = {
  abrirAssistente: () => {}, registrarLinhas: () => {}, perguntaAberta: null, fecharPergunta: () => {}, seguirComNosso: () => {}, atualizar: () => {},
}
export const ContextoAssistente = createContext<ControleAssistente>(SEM_ASSISTENTE)
