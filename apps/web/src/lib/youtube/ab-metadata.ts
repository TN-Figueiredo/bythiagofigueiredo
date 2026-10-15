import * as Sentry from '@sentry/nextjs'
import { YouTubeApiError, erroDaResposta, erroDeRede } from '@/lib/youtube/youtube-api-error'

// `tags` é opcional: o YouTube OMITE a chave em vídeo sem tag (F-D9, Y-P8).
export interface SnippetLido {
  title: string
  description: string
  categoryId: string
  tags?: string[]
  defaultLanguage?: string
  defaultAudioLanguage?: string
}

const TIMEOUT_MS = 10_000

// null = o vídeo não veio na resposta. `description`/`categoryId` saem como lidos (podem faltar): quem escreve valida.
export async function lerSnippet(
  videoId: string,
  accessToken: string,
  f: typeof fetch = fetch,
): Promise<SnippetLido | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}`
  let res: Response
  try {
    res = await f(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw erroDeRede(e, 'videos.list')
  }
  if (!res.ok) throw await erroDaResposta(res, 'videos.list')
  const data: unknown = await res.json().catch(() => null)
  const snippet = (data as { items?: Array<{ snippet?: unknown }> } | null)?.items?.[0]?.snippet
  if (!snippet) return null
  return snippet as SnippetLido
}

export async function escreverTitulo(
  videoId: string,
  titulo: string,
  accessToken: string,
  f: typeof fetch = fetch,
): Promise<void> {
  // P4a-I20: nunca "" gravado.
  if (titulo.trim().length === 0) throw new YouTubeApiError(0, 'titulo_vazio', 'videos.update')

  const lido = await lerSnippet(videoId, accessToken, f)
  if (!lido) throw new YouTubeApiError(404, 'video_inexistente', 'videos.list')
  // videos.update com part=snippet apaga propriedade mutável omitida: aborta sem PUT. "" é valor, não ausência.
  if (typeof lido.description !== 'string') throw new YouTubeApiError(0, 'snippet_sem_descricao', 'videos.update')
  if (typeof lido.categoryId !== 'string' || lido.categoryId.length === 0) {
    throw new YouTubeApiError(0, 'snippet_sem_categoria', 'videos.update')
  }

  const snippet: Record<string, unknown> = {
    title: titulo,
    description: lido.description, // sempre a lida: o A/B não escreve descrição (P3)
    categoryId: lido.categoryId,
  }
  // Só se vieram: não inventar tags nem idioma (Y-P8, F-D9).
  if (lido.tags !== undefined) snippet.tags = lido.tags
  if (lido.defaultLanguage !== undefined) snippet.defaultLanguage = lido.defaultLanguage
  if (lido.defaultAudioLanguage !== undefined) snippet.defaultAudioLanguage = lido.defaultAudioLanguage

  let res: Response
  try {
    res = await f('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, snippet }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw erroDeRede(e, 'videos.update')
  }
  if (!res.ok) {
    const erro = await erroDaResposta(res, 'videos.update')
    Sentry.captureException(erro, { extra: { videoId, status: erro.status, reason: erro.reason } })
    throw erro
  }
}

// Nome mantido: os vi.mock existentes apontam para ele.
export async function updateVideoMetadata(videoId: string, title: string, accessToken: string): Promise<void> {
  await escreverTitulo(videoId, title, accessToken)
}

export async function captureOriginalMetadata(
  videoId: string,
  accessToken: string,
): Promise<{ title: string; description: string } | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const snippet = data.items?.[0]?.snippet
  if (!snippet) return null

  return { title: snippet.title, description: snippet.description }
}
