/**
 * A3 Tarefa 2: as regras e as frases da posição na lista de Canais. Puro: nada aqui lê o motor.
 * O modelo (`view-model.ts`) junta os fatos de cada canal e pergunta aqui o motivo e o texto.
 * Nenhuma ordenação usa número de mentira para "sem medida": o valor é null e o motivo vem de `motivoSemValor`.
 */
import { conjuntoTexto, type Conjunto, type Posicao } from '@/lib/youtube/observatorio/posicao'
import type { Fmt } from '@/lib/youtube/observatorio/types'
import type { CanaisSort } from './view-model'

/** As ordenações que têm posição escrita (D3): Inscritos e Views/dia (nas duas escalas). Ampliar é acrescentar a chave. */
export const POSICIONADAS: readonly CanaisSort[] = ['subs', 'vpd']
export const temPosicao = (sort: CanaisSort): boolean => POSICIONADAS.includes(sort)

export type MotivoSemMedida =
  | 'sem-videos' | 'sem-shorts' | 'sem-views-dia-proprio' | 'aguarda-2o-registro'
  | 'buscando-videos' | 'inscritos-ocultos' | 'sem-nicho' | 'ordenacao-sem-posicao'

/** Os textos são os de 15.2 e 15.5 do spec e o de D4 (b) do plano. Switch exaustivo: um motivo novo não compila sem a frase. */
export function motivoTexto(m: MotivoSemMedida): string {
  switch (m) {
    case 'sem-videos': return 'Sem vídeos: fora das posições por vídeo.'
    case 'sem-shorts': return 'Sem Shorts: fora das posições de Shorts.'
    case 'sem-views-dia-proprio': return 'Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação.'
    case 'aguarda-2o-registro': return 'Aguardando o 2º registro diário: sem contagem diária ainda. Sem posição nesta ordenação.'
    case 'buscando-videos': return 'A primeira sincronização ainda não terminou: a medida aparece quando ela terminar. Sem posição nesta ordenação.'
    case 'inscritos-ocultos': return 'Inscritos ocultos pelo canal: sem esta medida e sem posição nesta ordenação.'
    case 'sem-nicho': return 'Sem posição dentro de um nicho: escolha o nicho do canal para ver a posição.'
    case 'ordenacao-sem-posicao': return 'Esta ordenação não mostra posição. Ordene por Inscritos ou por Views/dia para ver a do seu canal.'
    default: { const nunca: never = m; return nunca }
  }
}

/** O que o modelo sabe de um canal sem valor na coluna ordenada. */
export interface FatosSemValor {
  sort: CanaisSort
  /** Views/dia por mil inscritos (a escala padrão) ou absoluto. */
  porMil: boolean
  /** Primeira sincronização: ainda busca os vídeos. */
  bf: boolean
  /** Nenhum vídeo guardado. */
  semVideos: boolean
  /** Filtro Shorts e nenhum Short guardado. */
  semShorts: boolean
  /** O canal esconde os inscritos (c.subs nulo). */
  subsOcultos: boolean
  /** Views/dia: existe a mediana absoluta, só falta o por mil (inscritos ocultos). */
  temMedianaAbsoluta: boolean
  own: boolean
  /** Tem vídeo acompanhado neste formato, mas a mediana por dia ainda não saiu (falta o 2º registro). */
  aguarda2o: boolean
}

/** Por que a coluna ordenada não tem valor para este canal. A ordem das perguntas é a da causa mais específica para a mais geral. */
export function motivoSemValor(f: FatosSemValor): MotivoSemMedida {
  if (f.sort === 'subs') return 'inscritos-ocultos'
  if (f.bf) return 'buscando-videos'
  if (f.semVideos) return 'sem-videos'
  const porFormato = f.sort === 'vpd' || f.sort === 'active' || f.sort === 'outliers'
  if (f.semShorts && porFormato) return 'sem-shorts'
  if (f.sort === 'vpd') {
    if (f.porMil && f.subsOcultos && f.temMedianaAbsoluta) return 'inscritos-ocultos'
    if (f.own) return 'sem-views-dia-proprio'
    if (f.aguarda2o) return 'aguarda-2o-registro'
    return 'sem-videos'
  }
  return 'ordenacao-sem-posicao'
}

const palavraDe = (f: Fmt) => (f === 'long' ? 'longos' : 'Shorts')

/** "inscritos", "views/dia por mil inscritos nos longos"… : a coluna ordenada, no meio da frase. */
export function emTexto(sort: CanaisSort, fmt: Fmt, porMil: boolean): string {
  switch (sort) {
    case 'subs': return 'inscritos'
    case 'vpd': return porMil ? `views/dia por mil inscritos nos ${palavraDe(fmt)}` : `views/dia nos ${palavraDe(fmt)}`
    case 'active': return `ritmo nos ${palavraDe(fmt)}`
    case 'outliers': return `outliers nos ${palavraDe(fmt)}`
    case 'swaps': return 'trocas'
    case 'growth': return 'crescimento em 30 dias'
    default: { const nunca: never = sort; return nunca }
  }
}

/** "14º de 14 em Viagem, em inscritos, com 1,16 mil." / "1º de 14 no geral (empate), em inscritos, com 1,16 mil." (D4 a). */
export function fraseDePosicao(p: Posicao, c: Conjunto, em: string, valor: string): string {
  return `${p.pos}º de ${p.de} ${conjuntoTexto(c)}${p.empate ? ' (empate)' : ''}, em ${em}, com ${valor}.`
}

/** "Logo acima: Leo Khev (493). É o último da lista." (spec 15.2). Os vizinhos são os da lista, com o valor como a célula o mostra. */
export function fraseVizinhos(acima: { nome: string; valor: string } | null, abaixo: { nome: string; valor: string } | null): string {
  const a = acima ? `Logo acima: ${acima.nome} (${acima.valor}).` : 'É o primeiro da lista.'
  const b = abaixo ? `Logo abaixo: ${abaixo.nome} (${abaixo.valor}).` : 'É o último da lista.'
  return `${a} ${b}`
}

export function divisorDe(n: number, em: string): { titulo: string; nota: string } {
  return { titulo: `Ainda sem medida para ordenar (${n})`, nota: `sem ${em}; ficam no fim em qualquer direção` }
}

/** Emenda 45: o aviso que a tela dá com o nicho em "Todos". */
export const CONJUNTO_AVISO = 'Canais de nichos diferentes têm públicos de tamanhos diferentes, então a posição geral ordena, não julga.'
/** Spec 15.5: a busca filtra as linhas, as posições são as da lista inteira. */
export const BUSCA_NOTA = 'Posição na lista inteira, não só nos resultados da busca.'

/** Nos cartões (spec 15.2, mockup): "Você está na 10ª posição de 14 em Viagem nesta ordenação." Sem posição, a tela diz o motivo (`motivoTexto`). */
export function fraseDoCartao(p: Posicao, c: Conjunto): string {
  return `Você está na ${p.pos}ª posição de ${p.de} ${conjuntoTexto(c)} nesta ordenação${p.empate ? ', em empate' : ''}.`
}

/** O fim do anúncio de ordenação (leitor de tela): "Seu canal: 14º de 14 em Viagem." ou, sem posição, o MESMO motivo que o bloco e o cartão dizem (`motivoTexto`). */
export function fraseSeuCanal(p: Posicao | null, c: Conjunto, semMedida: MotivoSemMedida | null | undefined): string {
  // sem posição e sem motivo seria erro do modelo (o teste de invariante percorre todas as ordenações): a frase não escolhe um motivo por conta própria
  if (p) return `Seu canal: ${p.pos}º de ${p.de} ${conjuntoTexto(c)}${p.empate ? ' (empate)' : ''}.`
  return semMedida ? motivoTexto(semMedida) : ''
}

/** Sob o filtro "só com problema" a lista é menor que o "de N": a posição continua a da lista inteira. */
export const PROBLEMAS_NOTA = 'Posição na lista inteira, não só nos canais com problema.'
