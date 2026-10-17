// E5a Tarefa C4: a lista "O que o criador respondeu". Puro. NUNCA traz nome de autor (o autor é sempre "um espectador": o leitor nem consulta
// a tabela de identidade) e nunca escreve "não respondeu". No nível `contagem` não há texto: só o número e a frase de quem vê só a contagem.
// O leitor não devolve a data do comentário; a ordem é a do vídeo mais novo primeiro.
import type { ParteLida, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import { FRASES } from '../../_chrome/comentarios/frases'
import { ptn } from './formatos'

export const FRASE_SO_CONTAGEM = {
  negrito: 'Você vê o número, não o texto.',
  resto: ' O texto dos comentários e das respostas só aparece para quem edita o site ou tem acesso ao desempenho privado do canal.',
} as const
export const MAX_NA_LISTA = 10
const MAX_COMENTARIOS_GUARDADOS = 12

export interface ItemDaLista {
  videoId: string
  titulo: string
  texto: string
  cortado: boolean
  respostaTexto: string
  respostaCortada: boolean
  curtidas: string | null
  /** Quantas menções (@nome) viraram "@…" nesse item. */
  mencoes: number
}

export type ModeloDaLista =
  | { tipo: 'nao_carregou'; frase: { negrito: string; resto: string } }
  | { tipo: 'vazia'; frase: { negrito: string; resto: string } }
  | { tipo: 'contagem'; total: number; frase: { negrito: string; resto: string }; aviso: { negrito: string; resto: string } }
  | { tipo: 'itens'; total: number; nVideos: number; subtitulo: string; frase: { negrito: string; resto: string }; itens: ItemDaLista[]; aMais: number }

const curtidasDe = (n: number | null, marco: number | null): string | null =>
  n === null || marco === null ? null : `${ptn(n, 'curtida', 'curtidas')} ${marco === 1 ? 'no dia 1' : `aos ${marco} dias`}`

export function listaDoCriador(e: {
  nome: string
  resposta: ParteLida<RespostasDoCriador> | null
  videos: readonly VideoLido[] | null
  titulos: ReadonlyMap<string, string>
  /** O n de vídeos com retrato de 30 dias da conta (a frase diz "em N vídeos com retrato de 30 dias"). */
  nBase: number
  /** A conferência da permissão falhou (guarda fora do ar): no nível contagem, a frase é a da C3, não a de "falta de direito". */
  permissaoFalhou?: boolean
}): ModeloDaLista {
  if (e.resposta === null || !e.resposta.lido) return { tipo: 'nao_carregou', frase: { negrito: 'Não carregou:', resto: ' não deu para ler a lista de respostas do criador agora.' } }
  const r = e.resposta.dados
  if (r.nivel === 'contagem') {
    return {
      tipo: 'contagem', total: r.total, aviso: e.permissaoFalhou ? { negrito: FRASES.permissaoNaoConferida, resto: '' } : FRASE_SO_CONTAGEM,
      frase: r.total === 0
        ? { negrito: 'Nenhuma resposta dele nos comentários guardados até agora.', resto: ` Guardamos até ${MAX_COMENTARIOS_GUARDADOS} comentários por vídeo; ele pode ter respondido a outros.` }
        : { negrito: `${e.nome} respondeu a ${ptn(r.total, 'comentário guardado', 'comentários guardados')}.`, resto: '' },
    }
  }
  if (r.itens.length === 0) {
    return { tipo: 'vazia', frase: { negrito: 'Nenhuma resposta dele nos comentários guardados até agora.', resto: ` Guardamos até ${MAX_COMENTARIOS_GUARDADOS} comentários por vídeo; ele pode ter respondido a outros.` } }
  }
  const pub = new Map((e.videos ?? []).map(v => [v.id, baseDaIdade(v) ?? 0]))
  const ordenados = r.itens.map((x, i) => ({ x, i })).sort((a, b) => (pub.get(b.x.videoId) ?? 0) - (pub.get(a.x.videoId) ?? 0) || a.i - b.i).map(o => o.x)
  const videos = new Set(ordenados.map(x => x.videoId)).size
  const itens: ItemDaLista[] = ordenados.slice(0, MAX_NA_LISTA).map(x => ({
    videoId: x.videoId, titulo: e.titulos.get(x.videoId) ?? '(sem título)', texto: x.texto, cortado: x.cortado, respostaTexto: x.respostaTexto,
    respostaCortada: x.respostaCortada, curtidas: curtidasDe(x.curtidas, x.marco), mencoes: x.mencoesTrocadas,
  }))
  return {
    tipo: 'itens', total: r.total, nVideos: videos, subtitulo: `Respostas dele nos comentários já guardados (${ptn(videos, 'vídeo', 'vídeos')})`, itens, aMais: Math.max(0, ordenados.length - itens.length),
    frase: {
      negrito: `${e.nome} respondeu a ${ptn(r.total, 'comentário guardado', 'comentários guardados')}, em ${ptn(videos, 'vídeo', 'vídeos')}${e.nBase > 0 ? ' com retrato de 30 dias' : ''}.`,
      resto: ' O vídeo mais recente primeiro.',
    },
  }
}
