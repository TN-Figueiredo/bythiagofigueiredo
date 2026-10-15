// A5 · E5a · Tarefa C1: os tipos do leitor dos comentários de destaque. Só tipos: nenhum texto em português, nenhuma ida ao banco.
// O que a tela vê depende de QUEM VÊ (três níveis). O tipo do nível `contagem` NÃO TEM campo de texto, de autor, de data do comentário
// nem de id do YouTube: o que não existe no tipo não vaza por descuido.
import type { CausaNaoLida } from '../medidas/ler'
import type { EdicaoDoSite } from '../proprio/edicao'
import type { LeituraPrivadaDoSite } from '../proprio/leitura-privada'
import type { Marco } from './tipos'

export type Nivel = 'contagem' | 'texto' | 'identidade'

/** Os dois tokens do passo 0 da E17. `null` em cada campo = sem a prova. */
export interface ProvasDeQuemVe {
  leitura: LeituraPrivadaDoSite | null
  edicao: EdicaoDoSite | null
}

/** Como o leitor devolve o que leu: nunca lança; o que não foi lido traz a causa e o CÓDIGO da falha (nunca texto de exceção). */
export type ParteLida<T> = { lido: true; dados: T } | { lido: false; causa: CausaNaoLida; codigo: string }

export type MotivoDoCartao = 'criador' | 'canal_acompanhado' | 'inscritos' | 'canal_proprio' | 'curtidos'

export interface Faixas { tamanho: string | null; razao: string | null }

/** Curtidas num marco: o número lido, `fora_dos_12` (o marco foi retratado e o comentário não tem leitura nele) ou `ainda_nao` (marco sem retrato ok). */
export type CurtidasNoMarco = number | 'fora_dos_12' | 'ainda_nao'

export interface RespostaDoCriadorVista { texto: string; cortado: boolean }

/** Campos comuns a todo cartão, em qualquer nível. */
export interface CartaoBase {
  /** A posição na lista (1, 2, 3, …): troca o id interno. */
  ordem: number
  motivo: MotivoDoCartao
  curtidas: Record<Marco, CurtidasNoMarco>
  /** Total de respostas na última leitura que existe; nulo = não lido. */
  respostas: number | null
  criador: 'respondeu' | 'nao_vimos' | 'nao_sabemos'
  criadorNome: string | null
  /** A posição do comentário na ordem de relevância do YouTube em cada marco (`relevance_rank`); nulo = sem leitura naquele marco. Dado público. */
  posicao: Record<Marco, number | null>
  /** O comentário foi escrito pelo criador do vídeo (não diz quem é o autor dos outros). */
  doCriador: boolean
  /** O primeiro marco em que o comentário foi escolhido. */
  entrouNoMarco: Marco
  /** Os marcos em que ele foi escolhido (para "entraram" e "saíram" entre dois marcos). */
  nosMarcos: Marco[]
  /** Data NOSSA (`missing_since`, AAAA-MM-DD), não a do comentário. */
  saiuDoYouTubeDesde: string | null
  faixas: Faixas
}

export type CartaoContagem = CartaoBase

export type AutorDoCartao =
  | { tipo: 'espectador' }
  | { tipo: 'criador' }
  | { tipo: 'canal_grande' }

export type AutorComIdentidade = AutorDoCartao | { tipo: 'com_identidade'; nome: string; fotoUrl: string | null; guardadaAte: string }

export interface CartaoTexto extends CartaoBase {
  texto: string
  cortado: boolean
  publicadoEm: string
  respostasDoCriador: RespostaDoCriadorVista[]
  autor: AutorDoCartao
  /** Quantas menções (@…) foram trocadas pelo marcador no texto do comentário e nas respostas dele. */
  mencoesTrocadas: number
}

export interface CartaoIdentidade extends Omit<CartaoTexto, 'autor'> {
  autor: AutorComIdentidade
}

/** O retrato de um marco que existe (`ok`): os números do dia. */
export interface ResumoDoMarco {
  tomadoEmMs: number
  idadeHoras: number
  /** Comentários de topo lidos no lote (até o teto do lote). */
  amostra: number | null
  amostraCompleta: boolean | null
  /** O total de comentários do vídeo NAQUELE DIA. */
  totalDoDia: number | null
  escolhidos: number | null
  autoresConsultados: number | null
  autoresSemTamanho: number | null
}

export type CausaNaoColetado =
  /** `codigo` é o `error_reason` gravado pela coleta (escolhe a frase, nunca é mostrado); `encerrada`: a janela do marco já fechou. */
  | { causa: 'erro'; tentouEmMs: number; ateMs: number; encerrada: boolean; codigo: string; totalDoDia: number | null }
  | { causa: 'tarde' }
  /** A coleta grava a lista vazia com contagem positiva como `erro` + `lista_vazia_com_contagem`; `totalDoDia` é a contagem guardada (pode ser nula). */
  | { causa: 'lista_vazia'; tomadoEmMs: number; ateMs: number; encerrada: boolean; totalDoDia: number | null }
  | { causa: 'janela_perdida' }

export type EstadoDoMarco =
  | { estado: 'ok'; resumo: ResumoDoMarco }
  | { estado: 'sem_comentarios'; tomadoEmMs: number }
  | { estado: 'desligados'; tomadoEmMs: number }
  | { estado: 'nao_coletado'; porque: CausaNaoColetado }
  | { estado: 'antes_da_coleta'; coletaDesdeMs: number }
  | { estado: 'fecha_em'; fechaEmMs: number }
  | { estado: 'a_caminho'; fezEmMs: number; ateMs: number }
  | { estado: 'coleta_parada'; desdeMs: number; semOk: boolean }
  | { estado: 'coleta_nao_comecou' }

export interface ComentariosContagem { nivel: 'contagem'; marcos: Record<Marco, EstadoDoMarco>; comentarios: CartaoContagem[] }
export interface ComentariosTexto { nivel: 'texto'; marcos: Record<Marco, EstadoDoMarco>; comentarios: CartaoTexto[] }
export interface ComentariosIdentidade { nivel: 'identidade'; marcos: Record<Marco, EstadoDoMarco>; comentarios: CartaoIdentidade[] }
export type ComentariosDoVideo = ComentariosContagem | ComentariosTexto | ComentariosIdentidade

/** O que a lista "O que o criador respondeu" traz por item (nenhum autor: o autor é sempre "um espectador"). */
export interface RespostaDoCriador {
  videoId: string
  texto: string
  cortado: boolean
  respostaTexto: string
  respostaCortada: boolean
  /** Curtidas no marco mais recente que tem leitura; nulo se nenhuma. */
  curtidas: number | null
  marco: Marco | null
  mencoesTrocadas: number
}

export interface RespostasDoCriador { nivel: Nivel; total: number; itens: RespostaDoCriador[] }

export interface ContagemDeRespostas {
  porVideo: Map<string, { retrato30: string | null; algumComRespostaDoCriador: boolean }>
  coletaDoSiteDesdeMs: number | null
  coletaDoCanalDesdeMs: number | null
  ultimoOkDaTarefaMs: number | null
  primeiraExecucaoDaTarefaMs: number | null
}
