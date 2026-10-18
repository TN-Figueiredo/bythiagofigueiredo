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
  falhou = false,
): EntradaResolvida {
  if (!pedido) return { videoId: null, aviso: null }
  if (falhou && !elegiveis.some((v) => v.id === pedido)) {
    return { videoId: null, aviso: 'Não foi possível abrir esse vídeo agora. Escolha um vídeo abaixo.' }
  }
  const alvo = elegiveis.find((v) => v.id === pedido) ?? (idResolvido ? elegiveis.find((v) => v.id === idResolvido) : undefined)
  if (alvo) {
    if (alvo.hasActiveTest) {
      return { videoId: null, aviso: 'Este vídeo já tem um teste (ou rascunho) aberto, então não dá para criar outro agora. Escolha outro vídeo abaixo.' }
    }
    return { videoId: alvo.id, aviso: null }
  }
  if (idResolvido) {
    return { videoId: null, aviso: 'Este vídeo não está entre os mais recentes disponíveis para teste. Escolha um vídeo abaixo.' }
  }
  return { videoId: null, aviso: 'Não encontramos esse vídeo no seu canal. Escolha um vídeo abaixo.' }
}

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Filtro `.or()` do PostgREST para achar o vídeo pelo pedido, ou null se o
 * pedido não é nem id do YouTube nem uuid (nunca interpola texto livre).
 */
export function filtroBuscaVideo(pedido: string): string | null {
  if (ID_YOUTUBE.test(pedido)) return `youtube_video_id.eq.${pedido}`
  if (UUID.test(pedido)) return `id.eq.${pedido}`
  return null
}

/**
 * A regra da imagem de referência mora em `lib/youtube/ab-referencia` (módulo puro, importável por cliente).
 * O curinga do Blob aceita qualquer loja `*.public.blob.vercel-storage.com`, não só a do projeto: dívida declarada.
 */
export { thumbReferenciaSegura } from '@/lib/youtube/ab-referencia'
