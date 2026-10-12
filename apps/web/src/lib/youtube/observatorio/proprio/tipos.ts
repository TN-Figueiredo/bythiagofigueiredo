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
}

export interface AlcanceCanal {
  canalId: string
  relatorios: RelatorioDia[]
  linhas: AlcanceLinha[]
  /** linhas cujo CTR veio fora de 0 a 1 e foi descartado (a linha ficou com ctr nulo): quem chama avisa o Sentry uma vez por requisição */
  ctrDescartados: number
}

export interface DiarioCanal {
  canalId: string
  ultimoDia: DiaYt | null
  linhas: DiarioLinha[]
}

/** 'negado' = quem pede não edita o site (nada foi consultado); 'erro' = a leitura falhou (só onde D5 permite). */
export type Privado<T> = { acesso: 'ok'; dado: T } | { acesso: 'negado' } | { acesso: 'erro' }
