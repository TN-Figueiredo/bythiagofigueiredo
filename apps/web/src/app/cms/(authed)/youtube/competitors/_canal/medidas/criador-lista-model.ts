// E5a Tarefa C4: a lista "O que o criador respondeu". Puro. NUNCA traz nome de autor (o autor é sempre "um espectador": o leitor nem consulta
// a tabela de identidade) e nunca escreve "não respondeu". No nível `contagem` não há texto: só o número e a frase de quem vê só a contagem.
// Agrupa por vídeo (o mais novo primeiro) e desenha cada comentário como um fio único (a mesma peça do vídeo). Datas de fala por `dmDeData` (fuso de SP).
import type { ParteLida, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import { FRASES } from '../../_chrome/comentarios/frases'
import type { FalaView, FioView } from '../../_chrome/comentarios/fio-model'
import { dmDeData } from '../../_chrome/comentarios/model'
import { ptn } from './formatos'

export const FRASE_SO_CONTAGEM = {
  negrito: 'Você vê o número, não o texto.',
  resto: ' O texto dos comentários e das respostas só aparece para quem edita o site ou tem acesso ao desempenho privado do canal.',
} as const
export const VISIVEIS_POR_GRUPO = 3
const MAX_COMENTARIOS_GUARDADOS = 12

export interface GrupoDoCriador {
  videoId: string
  titulo: string
  thumb: string | null
  /** "12 respostas dele" */
  respostasDele: string
  fios: FioView[]
}

export type ModeloDaLista =
  | { tipo: 'nao_carregou'; frase: { negrito: string; resto: string } }
  | { tipo: 'vazia'; frase: { negrito: string; resto: string } }
  | { tipo: 'contagem'; total: number; frase: { negrito: string; resto: string }; aviso: { negrito: string; resto: string } }
  | { tipo: 'itens'; total: number; nVideos: number; frase: { negrito: string; resto: string }; grupos: GrupoDoCriador[] }

const curtidasDe = (n: number | null, marco: number | null): string | null => {
  if (n === null || marco === null) return null
  const num = n.toLocaleString('pt-BR')
  return marco === 1 ? `${num} com 1 dia` : `${num} no retrato de ${marco} dias`
}

const fala = (autor: FalaView['autor'], publicadoEm: string | null, texto: string, cortado: boolean): FalaView =>
  ({ autor, data: publicadoEm ? dmDeData(publicadoEm) : null, texto, cortado })

export function listaDoCriador(e: {
  nome: string
  resposta: ParteLida<RespostasDoCriador> | null
  videos: readonly VideoLido[] | null
  titulos: ReadonlyMap<string, string>
  /** id do vídeo -> endereço da thumbnail (nulo sem `ytId`). */
  thumbs?: ReadonlyMap<string, string | null>
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
  // agrupa em O(n) com um Map (a ordem de inserção já é a de idade, do vídeo mais novo para o mais velho)
  const porVideo = new Map<string, GrupoDoCriador>()
  ordenados.forEach((x, i) => {
    let g = porVideo.get(x.videoId)
    if (!g) {
      g = { videoId: x.videoId, titulo: e.titulos.get(x.videoId) ?? '(sem título)', thumb: e.thumbs?.get(x.videoId) ?? null, respostasDele: '', fios: [] }
      porVideo.set(x.videoId, g)
    }
    g.fios.push({
      id: `cr-${x.videoId}-${i}`,
      raiz: fala({ tipo: 'espectador' }, x.publicadoEm, x.texto, x.cortado),
      respostas: x.respostas.map(r => fala({ tipo: 'criador' }, r.publicadoEm, r.texto, r.cortado)),
      respostaReservada: null,
      meta: { curtidas: curtidasDe(x.curtidas, x.marco), regua: null, posicao: null, respostas: null },
      marcas: { entrou: null, saido: false },
      pastilha: null,
    })
  })
  const grupos = [...porVideo.values()]
  for (const g of grupos) {
    const n = g.fios.reduce((s, f) => s + f.respostas.length, 0)
    g.respostasDele = `${n} ${n === 1 ? 'resposta dele' : 'respostas dele'}`
  }
  const videos = grupos.length
  return {
    tipo: 'itens', total: r.total, nVideos: videos, grupos,
    frase: { negrito: `${e.nome} respondeu a ${ptn(r.total, 'comentário guardado', 'comentários guardados')}, em ${ptn(videos, 'vídeo', 'vídeos')}.`, resto: '' },
  }
}
