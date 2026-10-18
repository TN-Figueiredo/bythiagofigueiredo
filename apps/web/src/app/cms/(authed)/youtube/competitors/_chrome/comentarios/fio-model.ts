// Comentários em produção · T1: o modelo puro do fio único (vídeo e canal). Nenhum import de `model.ts` (sem ciclo).
export type ChaveDeMotivo = 'c' | 'k' | 'a' | 'g' | 'p'

export interface CriadorDoFio { nome: string; avatar: string | null; ini: string; color: string }

export type AutorDaFala =
  | { tipo: 'espectador' } // sem `n`: a F2 devolve o campo, com teste, se for aprovada
  | { tipo: 'criador' } // nome e foto vêm de CriadorDoFio
  | { tipo: 'identidade'; nome: string; fotoUrl: string | null; ate: string }
  | { tipo: 'proprio' } | { tipo: 'grande'; faixa: string | null } | { tipo: 'reservado' }

export interface FalaView { autor: AutorDaFala; data: string | null /* dd/mm */; texto: string | null; cortado: boolean }

export interface FioView {
  id: string
  raiz: FalaView
  /** Só do criador na fase 1. */
  respostas: FalaView[]
  /** "O criador respondeu. O texto da resposta é reservado." */
  respostaReservada: string | null
  meta: {
    curtidas: string | null
    /** 0..100 */
    regua: number | null
    /** "1 de 12" */
    posicao: string | null
    /** "N respostas"; n === 0 é zero medido. */
    respostas: { n: number; texto: string } | null
  }
  marcas: { entrou: string | null /* "entrou no dia 7" */; saido: boolean }
  pastilha: { chave: ChaveDeMotivo; texto: string } | null
}

export const RESPOSTAS_VISIVEIS = 3

export function rotuloDoAutor(a: AutorDaFala, criador: CriadorDoFio): string {
  switch (a.tipo) {
    case 'espectador': return 'Espectador'
    case 'criador': return criador.nome
    case 'identidade': return a.nome
    case 'proprio': return 'Seu canal'
    case 'grande': return 'Canal grande'
    case 'reservado': return 'Espectador'
  }
}
