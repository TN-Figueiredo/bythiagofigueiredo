/**
 * Grupos e nomes das telas de origem das views (plano E5b, Tarefa 7; mockup 12). Puro.
 * Quem consome decide o que fazer com o valor desconhecido: aqui ele cai em `outras` / `outros` com `catalogado: false`.
 */
import { rotuloAparelho, rotuloOrigem } from '@/lib/youtube/reporting/codigos'

export type GrupoOrigem = 'pesquisa' | 'sugeridos' | 'navegacao' | 'shorts' | 'externa' | 'outras'

/** A ordem fixa do mockup. */
export const ORDEM_ORIGEM: readonly GrupoOrigem[] = ['pesquisa', 'sugeridos', 'navegacao', 'shorts', 'externa', 'outras']

export const ROTULO_ORIGEM: Record<GrupoOrigem, { nome: string; de: string }> = {
  pesquisa: { nome: 'Pesquisa do YouTube', de: 'da pesquisa do YouTube' },
  sugeridos: { nome: 'Vídeos sugeridos', de: 'de vídeos sugeridos' },
  navegacao: { nome: 'Início e inscrições', de: 'do início e das inscrições' },
  shorts: { nome: 'Feed de Shorts', de: 'do feed de Shorts' },
  externa: { nome: 'Sites e apps de fora', de: 'de sites e apps de fora do YouTube' },
  outras: { nome: 'Outras origens', de: 'de outras origens' },
}

/** Nome da API e código do lote de cada grupo (pergunta 8). Todo o resto do catálogo, e o que está fora dele, é `outras`. */
const GRUPO_DA_ORIGEM: Readonly<Record<string, Exclude<GrupoOrigem, 'outras'>>> = {
  YT_SEARCH: 'pesquisa', '5': 'pesquisa',
  RELATED_VIDEO: 'sugeridos', '7': 'sugeridos', '32': 'sugeridos',
  SUBSCRIBER: 'navegacao', '3': 'navegacao',
  SHORTS: 'shorts', '24': 'shorts',
  EXT_URL: 'externa', '9': 'externa',
}

const texto = (x: unknown): string => (typeof x === 'string' ? x.trim() : '')

/** Aceita o nome da API e o código do lote. Vazio, nulo e desconhecido: `outras`, não catalogado. Nunca lança. */
export function grupoDaOrigem(valor: string): { grupo: GrupoOrigem; catalogado: boolean } {
  const v = texto(valor)
  if (v === '') return { grupo: 'outras', catalogado: false }
  const grupo = Object.hasOwn(GRUPO_DA_ORIGEM, v) ? GRUPO_DA_ORIGEM[v] : undefined
  return { grupo: grupo ?? 'outras', catalogado: rotuloOrigem(v).catalogado }
}

export type GrupoAparelho = 'celular' | 'computador' | 'tv' | 'tablet' | 'outros'
export const ORDEM_APARELHO: readonly GrupoAparelho[] = ['celular', 'computador', 'tv', 'tablet', 'outros']
export const ROTULO_APARELHO: Record<GrupoAparelho, string> = {
  celular: 'Celular', computador: 'Computador', tv: 'TV', tablet: 'Tablet', outros: 'Outros aparelhos',
}

const GRUPO_DO_APARELHO: Readonly<Record<string, Exclude<GrupoAparelho, 'outros'>>> = {
  MOBILE: 'celular', '104': 'celular',
  DESKTOP: 'computador', '101': 'computador',
  TV: 'tv', '102': 'tv',
  TABLET: 'tablet', '105': 'tablet',
}

/** "MOBILE|ANDROID" e o código do lote: só a parte antes da barra decide. */
export function grupoDoAparelho(valor: string): { grupo: GrupoAparelho; catalogado: boolean } {
  const v = texto(valor).split('|')[0]!.trim()
  if (v === '') return { grupo: 'outros', catalogado: false }
  const grupo = Object.hasOwn(GRUPO_DO_APARELHO, v) ? GRUPO_DO_APARELHO[v] : undefined
  return { grupo: grupo ?? 'outros', catalogado: rotuloAparelho(v).catalogado }
}

export function grupoDeInscrito(valor: string): 'inscritos' | 'nao_inscritos' | null {
  const v = texto(valor)
  if (v === 'SUBSCRIBED') return 'inscritos'
  if (v === 'UNSUBSCRIBED') return 'nao_inscritos'
  return null
}
