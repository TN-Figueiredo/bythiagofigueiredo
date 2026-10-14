// apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts
/** Manutenção M3b: o único construtor de caminho e de `arquivo_id` do site (o da forja é cópia em Python, com o mesmo teste). */
import { CLASSES, TABELAS_DA_CLASSE, UUID_RE, MES_RE, DIA_RE, SHA_RE, TETO_PARTES, type Classe } from './contrato'

export class CaminhoInvalido extends Error {
  constructor(motivo: string) { super(motivo); this.name = 'CaminhoInvalido' }
}
type PapelResumo = 'canal' | 'video' | 'ficha'
const ehClasse = (c: string): c is Classe => (CLASSES as readonly string[]).includes(c)

function conferir(o: { classe: string; canal?: string; tabela?: string; mes?: string; versao?: number; parte?: number }): void {
  if (!ehClasse(o.classe)) throw new CaminhoInvalido('classe')
  if (o.canal !== undefined && !UUID_RE.test(o.canal)) throw new CaminhoInvalido('canal')
  if (o.tabela !== undefined && !TABELAS_DA_CLASSE[o.classe].includes(o.tabela)) throw new CaminhoInvalido('tabela')
  if (o.mes !== undefined && !MES_RE.test(o.mes)) throw new CaminhoInvalido('mes')
  if (o.versao !== undefined && (!Number.isInteger(o.versao) || o.versao < 1 || o.versao > 9999)) throw new CaminhoInvalido('versao')
  if (o.parte !== undefined && (!Number.isInteger(o.parte) || o.parte < 1 || o.parte > TETO_PARTES)) throw new CaminhoInvalido('parte')
}
const nn = (n: number): string => String(n).padStart(2, '0')

export function caminhoDaUnidade(o: { classe: string; canal: string; tabela: string; mes: string; versao: number }): string {
  conferir(o)
  return `${o.classe}/canais/${o.canal}/${o.tabela}/${o.mes}.v${o.versao}.csv.gz`
}
export function caminhoDaParte(o: { classe: string; canal: string; tabela: string; mes: string; versao: number; parte: number }): string {
  conferir(o)
  return `${o.classe}/canais/${o.canal}/${o.tabela}/${o.mes}.v${o.versao}.p${nn(o.parte)}.csv.gz`
}
export function caminhoDoResumo(o: { classe: string; canal: string; mes: string; versao: number; papel: PapelResumo }): string {
  conferir(o)
  if (o.papel === 'ficha' && o.classe !== 'video_antigo') throw new CaminhoInvalido('ficha')
  return `${o.classe}/canais/${o.canal}/resumo/${o.mes}.v${o.versao}.${o.papel}.csv.gz`
}
export function caminhoDoManifesto(o: { classe: string; mes: string; versao: number; papel: 'json' | 'sha256' }): string {
  conferir(o)
  return `${o.classe}/manifestos/${o.mes}.v${o.versao}.${o.papel}`
}
export function caminhoDoAnexo(o: { classe: string; canal: string; sha256: string; ext: string }): string {
  conferir(o)
  if (o.classe !== 'video_antigo') throw new CaminhoInvalido('anexo')
  if (!SHA_RE.test(o.sha256) || !['jpg', 'png', 'webp'].includes(o.ext)) throw new CaminhoInvalido('anexo')
  return `${o.classe}/canais/${o.canal}/miniaturas/${o.sha256}.${o.ext}`
}
export function caminhoDoCanario(dia: string): string {
  if (!DIA_RE.test(dia)) throw new CaminhoInvalido('dia')
  return `_canario/${dia}`
}

export const idDaUnidade = (id: string): string => `u:${id}`
export const idDaParte = (id: string, parte: number): string => `p:${id}:${nn(parte)}`
export const idDoResumo = (id: string, papel: PapelResumo): string => `s:${id}:${papel}`
export const idDoAnexo = (id: string): string => `a:${id}`
export const idDoManifesto = (classe: Classe, mes: string, versao: number, papel: 'json' | 'sha256'): string => `m:${classe}:${mes}:v${versao}:${papel}`

export type IdLido =
  | { tipo: 'unidade' | 'anexo'; id: string }
  | { tipo: 'parte'; id: string; parte: number }
  | { tipo: 'resumo'; id: string; papel: PapelResumo }
  | { tipo: 'manifesto'; classe: Classe; mes: string; versao: number; papel: 'json' | 'sha256' }

const U = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
export function lerArquivoId(s: string): IdLido | null {
  let m = new RegExp(`^u:${U}$`).exec(s); if (m) return { tipo: 'unidade', id: m[1]! }
  m = new RegExp(`^a:${U}$`).exec(s); if (m) return { tipo: 'anexo', id: m[1]! }
  m = new RegExp(`^p:${U}:(0[1-9]|[1-9][0-9])$`).exec(s); if (m) return { tipo: 'parte', id: m[1]!, parte: Number(m[2]) }
  m = new RegExp(`^s:${U}:(canal|video|ficha)$`).exec(s); if (m) return { tipo: 'resumo', id: m[1]!, papel: m[2] as PapelResumo }
  m = /^m:(horaria|serie|texto|video_antigo|ensaio):(\d{4}-(?:0[1-9]|1[0-2])):v([1-9]\d{0,3}):(json|sha256)$/.exec(s)
  if (m) return { tipo: 'manifesto', classe: m[1] as Classe, mes: m[2]!, versao: Number(m[3]), papel: m[4] as 'json' | 'sha256' }
  return null
}
