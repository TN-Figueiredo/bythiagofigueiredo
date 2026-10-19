import type { CampoTeste, ContagemLeituras, Desfecho, ImagemComparavel, SinalFraco, VereditoTesteYoutube } from '../tipos'

export interface EvidenciaRodada {
  rodada: string // = RodadaTitulo.chave
  de: string
  ate: string
  votos: Record<string, number> // chave = índice da variante ("0","1","2") ou "x" (texto fora das variantes)
  mista: boolean
  ms_desde_escrita: number | null
}

export interface MedidaPropagacao {
  mistas48ForaQuarentena: number
  minDesdeEscrita: number[] | null
}

export type EstadoAvaliacao14 = 'sem_leitura' | 'insuficiente' | 'nada_visivel' | 'provavel_teste' | 'sem_rodada_nova' | 'erro'

export interface NovaAvaliacao {
  avaliadaEm: string
  ateLidaEm: string | null
  estado14: EstadoAvaliacao14
  motivo14: string | null
  estado48: Exclude<EstadoAvaliacao14, 'sem_rodada_nova' | 'erro'> | null
  mistas48: number | null
  mistas48ForaQuarentena: number | null
  minDesdeEscrita: number[] | null
  contagem: ContagemLeituras | null
  escritas: number | null
  versaoRegra: number
  registroId: string | null
  erro: string | null
  retroativa: boolean
  aviso: 'variantes_demais' | null
}

// ---- registro (T4) ----

export interface RegistroAberto {
  id: string
  /** Texto cru do PostgREST (microssegundos e +00:00); NUNCA passar por Date. */
  updatedAt: string
  origem: 'detectado' | 'confirmado'
  campos: CampoTeste[]
  variantesTitulo: string[] | null
  votosTitulo: Record<string, number> | null
  primeiraVista: string | null
  ultimaVista: string | null
  veredito: VereditoTesteYoutube | null
  evidencia: EvidenciaRodada[]
  /** Desfecho já gravado (para não regravar o mesmo). Opcional: ausente = nada gravado. */
  desfechoEstado?: string | null
  desfechoMotivo?: string | null
}

export interface Fechamentos {
  encerradoEm: string | null
  descartadoEm: string | null
}

export interface NovoRegistro {
  id: string
  origem: 'detectado'
  campos: CampoTeste[]
  variantesTitulo: string[]
  votosTitulo: Record<string, number>
  tituloOficial: string | null
  primeiraVista: string
  ultimaVista: string
  veredito: VereditoTesteYoutube
  versaoRegra: number
  sinaisFracos: SinalFraco[]
  evidencia: EvidenciaRodada[]
  evidenciaCortada: boolean
  miniaturaA: ImagemComparavel | null
}

export interface Encerramento {
  estado: 'encerrado' | 'sem_desfecho'
  desfechoEstado: Desfecho['estado'] | null
  desfechoMotivo: string
  desfechoVersaoRegra: number
  vencedorTitulo: string | null
  encerradoEm: string
}

export type AcaoRegistro =
  | { tipo: 'nada' }
  | { tipo: 'criar'; novo: NovoRegistro }
  | { tipo: 'atualizar'; id: string; lido: string; mudanca: Partial<Omit<NovoRegistro, 'id' | 'origem'>> & { desfecho?: Desfecho } }
  | { tipo: 'encerrar'; id: string; lido: string; fim: Encerramento }
  | { tipo: 'encerrar_e_criar'; id: string; lido: string; fim: Encerramento; novo: NovoRegistro }
  | { tipo: 'desfecho'; id: string; lido: string; desfecho: Desfecho }
