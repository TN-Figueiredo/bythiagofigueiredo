/** Manutenção M3b: o resumo mensal por canal (C0.3, C4). Puro: recebe as linhas de `obs_archive_summary_rows` e devolve os arquivos. Sem SQL, sem relógio. */
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { serializarLinhas } from '../arquivo/exportar'

export type LinhaDoResumo = ReadonlyArray<string | null>

export interface LinhasDoResumo {
  versao: number
  vazio: boolean
  colunas_canal: string[]
  colunas_video: string[]
  canal: LinhaDoResumo[]
  video: LinhaDoResumo[]
  unit_hashes: Record<string, string>
}

export interface ArquivoDoResumo { papel: 'canal' | 'video'; gz: Buffer; sha256: string; bytes: number; linhas: number }
export interface ResumoSerializado {
  versao: number
  vazio: boolean
  unit_hashes: Record<string, string>
  /** Vazio: `[]` (o resumo é terminal sem arquivo, 02 §10.4). */
  arquivos: ArquivoDoResumo[]
}

const sha = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex')

function um(papel: 'canal' | 'video', colunas: string[], linhas: ReadonlyArray<LinhaDoResumo>): ArquivoDoResumo {
  for (const l of linhas) if (l.length !== colunas.length) throw new Error(`resumo ${papel}: linha com ${l.length} campos, esperava ${colunas.length}`)
  const gz = gzipSync(serializarLinhas(colunas, linhas), { level: 9 })
  return { papel, gz, sha256: sha(gz), bytes: gz.byteLength, linhas: linhas.length }
}

/** Valor não medido chega como `null` e sai como campo vazio sem aspas: nunca vira zero. */
export function serializarResumo(rows: LinhasDoResumo): ResumoSerializado {
  if (rows.vazio) return { versao: rows.versao, vazio: true, unit_hashes: rows.unit_hashes, arquivos: [] }
  return {
    versao: rows.versao, vazio: false, unit_hashes: rows.unit_hashes,
    arquivos: [um('canal', rows.colunas_canal, rows.canal), um('video', rows.colunas_video, rows.video)],
  }
}
