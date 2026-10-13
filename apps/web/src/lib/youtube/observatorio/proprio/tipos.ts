// Tipos puros do dado privado do canal próprio (alcance e diário por vídeo).
// Regra de ouro: nulo nunca vira zero. Zero medido é a linha com valor 0;
// não medido é a FALTA da linha (diário) ou o relatório que não foi lido (alcance).

/** 'AAAA-MM-DD': o dia como veio da fonte (dia do YouTube, Pacífico). Nunca se junta a uma data de São Paulo. */
export type DiaYt = string

export interface AlcanceLinha {
  ytId: string
  dia: DiaYt
  imp: number | null
  ctr: number | null
}

export type StatusRelatorio =
  | 'listado'
  | 'baixado'
  | 'vazio'
  | 'erro'
  | 'expirado_sem_baixar'
  | 'desconhecido'

export interface RelatorioDia {
  dia: DiaYt
  status: StatusRelatorio
  normalizado: boolean
}

export interface DiarioLinha {
  ytId: string
  dia: DiaYt
  views: number | null
  /**
   * `avg_view_percentage`: média do percentual assistido DAQUELE dia, em PONTOS (0 em diante; pode passar de 100, trecho revisto) (a Analytics API entrega 51,5, e a
   * coleta grava 51,5, sem escala). Nulo = não medido (dia sem view, coluna não pedida, valor negativo ou acima de 999,99). Nunca 0 por ausência.
   */
  pctAssistido: number | null
  /** `avg_view_duration_seconds`: duração média assistida do dia, em segundos. Nulo = não medido. */
  duracaoMediaSeg: number | null
}

export interface AlcanceCanal {
  canalId: string
  relatorios: RelatorioDia[]
  linhas: AlcanceLinha[]
  /** o dia do relatório mais novo do canal, SEM janela: com a série vazia na janela, "parou em dd/mm" e não "nunca coletado" */
  ultimoRelatorio: DiaYt | null
  /** linhas ou relatórios com valor ruim (CTR fora de 0 a 1, número negativo, data inválida) que viraram nulo ou foram descartados: quem chama avisa o Sentry uma vez por requisição */
  descartados: number
}

/**
 * Quantos vídeos o diário lê por canal (os mais novos da lista pedida). O resto NÃO é lido: o leitor devolve quais ficaram de fora
 * (`DiarioCanal.foraDoTeto`) para nenhum total sair menor sem aviso.
 */
export const TETO_VIDEOS_DIARIO = 50

export interface DiarioCanal {
  canalId: string
  /** o último dia gravado do canal, SEM janela (a série é que é limitada): é ele que diz "parou em dd/mm" */
  ultimoDia: DiaYt | null
  linhas: DiarioLinha[]
  /**
   * Os ytIds pedidos que ficaram além de TETO_VIDEOS_DIARIO e por isso NÃO foram lidos (o fim da lista: os mais antigos). Vídeo daqui não tem linha por causa do
   * corte, não porque o YouTube não mediu: quem soma ou compara diz que ele ficou de fora, e nunca o chama de "sem views" nem de "poucos dias". Ausente = nenhum corte.
   */
  foraDoTeto?: readonly string[]
  /** linhas com views negativas, % assistido negativo ou acima de 999,99 ou duração negativa, que viraram nulos: quem chama avisa o Sentry uma vez por requisição */
  descartados: number
}

/** 'negado' = quem pede não edita o site (nada foi consultado); 'erro' = a leitura falhou (só onde D5 permite). */
export type Privado<T> = { acesso: 'ok'; dado: T } | { acesso: 'negado' } | { acesso: 'erro' }
