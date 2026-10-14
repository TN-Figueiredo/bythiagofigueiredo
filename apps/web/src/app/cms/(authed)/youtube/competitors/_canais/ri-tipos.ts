/**
 * Contrato de dados das seções Referências e Inscritos da tela Canais (A5 · E5a, 2ª leva, tarefa R3).
 * O modelo (R4, `ri-model.ts`) produz uma `RiView`; os componentes só desenham. Nenhuma frase nasce no componente.
 * Posições (`marca`, `faixa`, `ticks[].pos`) são porcentagens de 0 a 100 da largura da régua; `barra` é a largura da
 * barra divergente em porcentagem de 0 a 50 (metade da caixa).
 */
export type RiPilula = { tipo: 'nm'; texto: string } | { tipo: 'prov'; texto: string }

export interface RiLinhaRef {
  id: string
  nome: string
  proprio: boolean
  rank: number | null
  valor: string | null
  sub: string | null
  marca: number | null
  faixa: { de: number; ate: number } | null
  provisoria: boolean
  pilula: RiPilula | null
  ariaLabel: string
}

export interface RiLinhaIns {
  id: string
  nome: string
  proprio: boolean
  rank: number | null
  classe: 'up' | 'dn' | 'eq' | null
  pct: string | null
  sub: string | null
  barra: { pct: number; abs: number } | null
  pilula: RiPilula | null
  nota: string | null
  ariaLabel: string
}

/** Trechos com e sem negrito: o componente não monta texto. */
export type RiFrase = Array<{ t: string; b?: true }>

/** Linhas uma vez só; cada ordem é uma lista de ids (Yannis m7 / Phil m2). */
export type RiSecao<L, O extends string> =
  | { estado: 'erro'; texto: string; ultimaBoa: string | null }
  | { estado: 'vazio'; titulo: string; texto: string }
  | {
      estado: 'ok'
      frase: RiFrase
      info: { titulo: string; itens: string[] }
      linhas: L[]
      ordens: Record<O, { rotulo: string; ids: string[]; legendaBarra?: string }>
      legenda: string[]
      n: number
    }

export interface RiView {
  aviso: string | null
  atalhos: Array<{ href: '#referencias' | '#inscritos'; rotulo: string }>
  referencias: RiSecao<RiLinhaRef, 'mediana' | 'faixa'>
  inscritos: RiSecao<RiLinhaIns, 'pct' | 'abs'>
  ticks: Array<{ pos: number; rotulo: string }>
  ordem: { ref: 'mediana' | 'faixa'; ins: 'pct' | 'abs' }
  aba: 'ref' | 'ins'
}
