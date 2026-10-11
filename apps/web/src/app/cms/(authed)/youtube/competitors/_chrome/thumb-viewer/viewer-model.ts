// Modelo puro do visualizador de thumbnail (spec telas v9, 6.3): que URLs tentar e o que a tela escreve. Sem DOM.
export interface ViewerVersion {
  label: string                 // "Capa B"
  current: boolean
  /** Imagem arquivada (Blob). null = não arquivada. */
  archived: string | null
  /** Só na versão atual: o id do vídeo no YouTube, para pedir maxresdefault → sddefault → hqdefault → mqdefault. */
  youtubeId: string | null
  caption: string               // "Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h"
  from: string; to: string      // para o quadro da versão não arquivada
  /** O período como o cartão da versão o escreve ("vista desde 03/10 até 05/10 14:22"): o quadro da versão não arquivada o usa, igual à legenda. Sem ele, "de from até to". */
  span?: string
  /** A imagem desta versão que JÁ está na tela de quem abriu (cartão, miniatura): o diálogo a mostra enquanto a resolução maior carrega. */
  preview?: string | null
}
export interface ViewerInput { title: string; versions: ViewerVersion[]; start: number }

export const YT_VARIANTS = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'] as const

/** O YouTube devolve um quadro de 120×90 (ou menos) quando a variante pedida não existe: não vale como imagem. */
export const PLACEHOLDER_MAX_W = 120

const YT_HOST = 'https://i.ytimg.com/'
export const isYoutubeUrl = (url: string): boolean => url.startsWith(YT_HOST)

/**
 * URLs a tentar, na ordem; [] = sem imagem para mostrar.
 * Atual: as quatro resoluções do YouTube e, por último, a cópia guardada (se houver). Anterior: só a cópia guardada.
 */
export function candidates(v: ViewerVersion): string[] {
  const urls: string[] = []
  if (v.current && v.youtubeId) for (const n of YT_VARIANTS) urls.push(`${YT_HOST}vi/${encodeURIComponent(v.youtubeId)}/${n}.jpg`)
  if (v.archived) urls.push(v.archived)
  return urls
}

/** O nome do arquivo no fim da URL, sem a query. */
export function fileOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? ''
  return path.slice(path.lastIndexOf('/') + 1)
}

const AMPLIAR = 'Acima de 100% a imagem é aumentada: ganha tamanho, não detalhe.'

/** A linha de baixo da imagem: o arquivo que carregou e o tamanho medido; nunca promete mais do que existe. */
export function resolutionLine(file: string, w: number, h: number, fellBack: boolean, archived: boolean): string {
  if (archived) return `Exibindo a imagem arquivada, ${w}×${h} px (no tamanho em que foi guardada). ${AMPLIAR}`
  const nota = fellBack ? 'o YouTube não tem versão maior deste vídeo' : 'maior resolução disponível'
  return `Exibindo ${file}, ${w}×${h} px (${nota}). ${AMPLIAR}`
}

/** O texto do quadro tracejado da versão que saiu do ar antes de a coleta guardar a imagem (spec 6.3). */
export function missingText(v: Pick<ViewerVersion, 'from' | 'to' | 'span'>): string {
  return `A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (${v.span ?? `${v.from} até ${v.to}`}) saiu do ar antes disso, então não há imagem para mostrar nem para baixar.`
}

export const positionLabel = (label: string, index: number, total: number): string => `${label} · ${index + 1} de ${total}`

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Nome do arquivo ao baixar: da atual, "thumbnail-<id do vídeo>-<arquivo do YouTube>"; da anterior arquivada, "thumbnail-<capa>.<ext>". */
export function downloadName(v: Pick<ViewerVersion, 'label' | 'youtubeId'>, file: string, archived: boolean): string {
  if (!archived && v.youtubeId) return `thumbnail-${v.youtubeId}-${file}`
  const ext = /\.[a-z0-9]{2,5}$/i.exec(file)?.[0].toLowerCase() ?? '.jpg'
  return `thumbnail-${slug(v.label) || 'versao'}${ext}`
}
