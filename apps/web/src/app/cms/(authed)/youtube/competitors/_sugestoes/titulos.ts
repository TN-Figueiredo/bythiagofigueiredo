// F4 T9: a seção "Ideias de título pela forja" do cartão aberto. Puro: do item (com `titulos_complementares`) e da amostra de títulos
// dos vídeos seus, devolve o que a tela precisa. Textos do mockup 2026-10-29-f4-trafego-e-titulos (NOTAS: sem "validador" na tela).
import type { AmostraDoVideo } from '@/lib/youtube/observatorio/sinais/amostra'
import type { ItemDeSinal } from '@/lib/youtube/observatorio/sinais/leitura'
import type { ParDeTitulos, TitulosDaForja } from '@/lib/youtube/observatorio/sinais/titulos-complementares/ler'

/** Quantos vídeos seus a seção oferece para escolher (os demais ficam fora da amostra). */
export const VIDEOS_NA_SECAO = 3

export interface VideoDosTitulos {
  /** `youtube_videos.id` do vídeo seu. */
  id: string
  titulo: string
  /** O último pedido deste vídeo × este sinal; `null` = nunca pedido. */
  par: ParDeTitulos | null
}
export interface TitulosDaVista {
  sinalId: string
  /** `erro`: a leitura dos pedidos falhou; a seção diz isso e não oferece o botão. */
  leitura: 'ok' | 'erro'
  /** O heartbeat da forja lista `titulo-complementar`. Só `true` libera o botão. */
  sabePedir: boolean
  lugar: string
  /** Até 3 vídeos seus (mais qualquer um com pedido). */
  videos: VideoDosTitulos[]
  /** Total real de vídeos seus sobre o lugar (`proprios_agora_n`). */
  total: number
}

export function montarTitulos(it: ItemDeSinal, amostra: ReadonlyMap<string, AmostraDoVideo>, lugar: string, forja: TitulosDaForja | undefined): TitulosDaVista | null {
  const ids = it.proprios_agora ?? []
  const pares = new Map((it.titulos_complementares ?? []).map((p) => [p.own_video_id, p]))
  // pedido que já existe nunca some da tela, mesmo se o vídeo saiu de `proprios_agora` (a rota e o MCP o mostram): tela = rota = MCP
  if (ids.length === 0 && pares.size === 0) return null
  const escolhidos = [...new Set([...ids.slice(0, VIDEOS_NA_SECAO), ...pares.keys()])]
  const videos = escolhidos.flatMap((id): VideoDosTitulos[] => {
    const a = amostra.get(id)
    return a ? [{ id, titulo: a.titulo, par: pares.get(id) ?? null }] : []
  })
  if (videos.length === 0) return null
  return { sinalId: it.id, // `forja` ausente = a leitura não aconteceu: a seção diz isso, não some
    leitura: forja?.leitura ?? 'erro', sabePedir: forja?.forja_sabe_pedir === true, lugar, videos, total: it.proprios_agora_n ?? ids.length }
}

/** "21h59" (fuso de São Paulo). */
export function hmSP(iso: string | null): string | null {
  if (iso === null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)) p[x.type] = x.value
  return `${p.hour}h${p.minute}`
}

export const MOTIVOS_DO_DESCARTE: Readonly<Record<string, string>> = {
  demais: 'mandou mais de 5',
  longo: 'um título passou de 100 caracteres',
  repetido: 'repetiu um título que já existe, seu ou do concorrente',
  numero_fora: 'usou um número que não está nos dados (por exemplo “7 dias”)',
  reprovado: 'nenhuma das tentativas respeitou as regras de tamanho, repetição e números',
}
export const TEXTO_SEM_CAPACIDADE = 'A forja ainda não sabe fazer este pedido: o kit dela precisa ser atualizado. Nada foi enviado.'
/** Pedido já guardado e a forja viva sem a capacidade: o pedido não sai sozinho; só cancelar resolve. */
export const TEXTO_PEDIDO_SEM_CAPACIDADE = 'A forja ainda não sabe fazer este pedido: o kit dela precisa ser atualizado. O pedido fica guardado, mas não sai até lá; cancele se não quiser esperar.'
export const TEXTO_ZERO = 'A forja não devolveu nenhum título válido.'
export const TEXTO_NADA_MOSTRADO = 'Nada foi mostrado.'
export const TEXTO_PEDIR_DE_NOVO = 'Peça de novo; cada pedido gera títulos novos.'
export const TEXTO_AVISO_IDEIAS = 'Ideias para partir, não para copiar: confira se não repete o título dele.'
export const TEXTO_LEITURA_FALHOU = 'Não deu para ler os pedidos de título agora. Recarregue a página em alguns minutos.'
export const TEXTO_FALHOU = 'A forja não conseguiu gerar os títulos desta vez.'
export const TEXTO_CANCELAR_SEM_PERMISSAO = 'Só quem administra o site pode cancelar o pedido.'
export const TEXTO_CANCELAR_FALHOU = 'Não deu para cancelar o pedido agora. Tente de novo em instantes.'
export const TEXTO_SEM_REDE = 'Não deu para enviar o pedido: a conexão caiu. Nada foi guardado.'

/** Frase de descarte: sempre com o motivo, nunca uma lista vazia calada. `vazio` = nenhum título válido. */
export function fraseDoDescarte(motivo: string): { titulo: string; resto: string } {
  if (motivo === 'vazio') return { titulo: TEXTO_ZERO, resto: `${TEXTO_NADA_MOSTRADO} ${TEXTO_PEDIR_DE_NOVO}` }
  return { titulo: `A forja descartou os títulos: ${MOTIVOS_DO_DESCARTE[motivo] ?? 'a resposta não pôde ser usada'}.`, resto: TEXTO_NADA_MOSTRADO }
}
