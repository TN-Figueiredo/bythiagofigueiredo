export interface VideoElegivel {
  id: string
  hasActiveTest: boolean
}

export interface EntradaResolvida {
  /** id (youtube_videos.id) do vídeo a pré-selecionar, quando elegível */
  videoId: string | null
  /** aviso em português quando o vídeo pedido não pôde ser pré-selecionado */
  aviso: string | null
}

/**
 * `pedido` é o `?videoId=` bruto. `idResolvido` é o youtube_videos.id achado
 * pelo id do YouTube (alguns chamadores mandam o id do YouTube, outros o uuid).
 */
export function resolverVideoPedido(
  elegiveis: VideoElegivel[],
  pedido: string | undefined,
  idResolvido: string | null,
): EntradaResolvida {
  if (!pedido) return { videoId: null, aviso: null }
  const alvo = elegiveis.find((v) => v.id === pedido) ?? (idResolvido ? elegiveis.find((v) => v.id === idResolvido) : undefined)
  if (alvo) {
    if (alvo.hasActiveTest) {
      return { videoId: null, aviso: 'Este vídeo já tem um teste em andamento, então não dá para criar outro agora. Escolha outro vídeo abaixo.' }
    }
    return { videoId: alvo.id, aviso: null }
  }
  if (idResolvido) {
    return { videoId: null, aviso: 'Este vídeo não está entre os mais recentes disponíveis para teste. Escolha um vídeo abaixo.' }
  }
  return { videoId: null, aviso: 'Não encontramos esse vídeo no seu canal. Escolha um vídeo abaixo.' }
}

/** Só mostra imagem de referência vinda da URL se o host for o do YouTube. */
export function thumbReferenciaSegura(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'i.ytimg.com' ? u.toString() : null
  } catch {
    return null
  }
}
