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
  /** Mescla por `videoId` (o novo vence); `substituir` troca tudo (o dashboard, a cada página nova do servidor). */
  registrarLinhas: (linhas: LinhaDoCaminho[], opcoes?: { substituir?: boolean }) => void
  /** `videoId` (uuid) da linha com a pergunta D-8 aberta. */
  perguntaAberta: string | null
  fecharPergunta: () => void
  /** "Ainda não, seguir com o nosso teste": abre o assistente sem gravar nada. */
  seguirComNosso: (l: LinhaDoCaminho) => void
  atualizar: () => void
  /** Estado da lista: 'ausente' (página sem lista), 'carregando', 'pronta' ou 'erro'. */
  lista: 'ausente' | 'carregando' | 'pronta' | 'erro'
  /** A lista ainda carrega: as portas do "Iniciar teste" ficam desabilitadas (a guarda D-8 não sabe das fichas). */
  carregando: boolean
  /** A leitura da lista falhou: as portas abrem sem perguntar (falha aberta aceita). */
  registrarErro: () => void
}

export const videoDaLinha = (l: LinhaDoCaminho): VideoDoAssistente => ({ id: l.videoId, title: l.titulo, thumbnailUrl: l.miniaturaUrl })

export function useControleAssistente(p: { onAbrir: (v: VideoDoAssistente) => void; atualizar: () => void; agora?: () => Date; comLista?: boolean }): ControleAssistente {
  const linhas = useRef<LinhaDoCaminho[]>([])
  const [perguntaAberta, setPergunta] = useState<string | null>(null)
  const { onAbrir, atualizar, agora, comLista } = p
  const [lista, setLista] = useState<ControleAssistente['lista']>(comLista ? 'carregando' : 'ausente')

  const abrirAssistente = useCallback((video: VideoDoAssistente): void => {
    if (lista === 'carregando') return
    const l = linhas.current.find((x) => x.videoId === video.id)
    if (l && cobrarD8(l, (agora ?? (() => new Date()))())) { setPergunta(l.videoId); return }
    setPergunta(null)
    onAbrir(video)
  }, [onAbrir, agora, lista])
  const registrarLinhas = useCallback((l: LinhaDoCaminho[], opcoes?: { substituir?: boolean }): void => {
    // Mescla por videoId: uma busca ou "Mostrar mais" nunca apaga a ficha conhecida (guarda D-8). Sobra de linha velha só faz perguntar a mais.
    if (opcoes?.substituir) linhas.current = l
    else {
      const mapa = new Map<string, LinhaDoCaminho>(linhas.current.map(x => [x.videoId, x]))
      for (const x of l) mapa.set(x.videoId, x)
      linhas.current = [...mapa.values()]
    }
    setLista('pronta')
  }, [])
  const registrarErro = useCallback((): void => setLista('erro'), [])
  const fecharPergunta = useCallback((): void => setPergunta(null), [])
  const seguirComNosso = useCallback((l: LinhaDoCaminho): void => { setPergunta(null); onAbrir(videoDaLinha(l)) }, [onAbrir])

  return useMemo(() => ({ abrirAssistente, registrarLinhas, perguntaAberta, fecharPergunta, seguirComNosso, atualizar, lista, carregando: lista === 'carregando', registrarErro }),
    [abrirAssistente, registrarLinhas, perguntaAberta, fecharPergunta, seguirComNosso, atualizar, lista, registrarErro])
}

/** Sem provedor (lista fora do dashboard): nada abre e nenhuma pergunta aparece. */
export const SEM_ASSISTENTE: ControleAssistente = {
  abrirAssistente: () => {}, registrarLinhas: () => {}, perguntaAberta: null, fecharPergunta: () => {}, seguirComNosso: () => {}, atualizar: () => {},
  lista: 'ausente', carregando: false, registrarErro: () => {},
}
export const ContextoAssistente = createContext<ControleAssistente>(SEM_ASSISTENTE)
