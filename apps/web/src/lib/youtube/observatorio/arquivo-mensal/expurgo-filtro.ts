// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts
/**
 * Manutenção M9: o filtro do item na unidade antiga e a serialização da versão nova (02 §11.3, "Como o expurgo reescreve").
 * Puro (só `node:` e relativo): o `tsx` da raiz o importa no Mac. Nada aqui lê banco, rede ou relógio.
 */
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { lerCsv } from '../arquivo/csv'
import { serializarLinhas } from '../arquivo/exportar'

export type Celula = string | null
export interface UnidadeLida { colunas: string[]; linhas: Celula[][] }
export interface UnidadeSerializada {
  gz: Buffer | null; sha256_bytes: string | null; csv_sha256: string | null; file_bytes: number; row_count: number; control_sum: string | null; hash_conteudo: string
}

/** A coluna que carrega a chave do item, por tabela (`m3b.sql:310-350`, `obs_archive_table_exprs` l.787-806). */
export const COLUNA_DA_CHAVE: Readonly<Record<string, { video: string | null; comentario: readonly string[] | null }>> = {
  competitor_video_hourly: { video: 'video_id', comentario: null },
  competitor_video_daily: { video: 'video_id', comentario: null },
  competitor_video_early: { video: 'video_id', comentario: null },
  competitor_video_comments: { video: 'video_id', comentario: ['id', 'parent_id'] },
  competitor_video_comment_marks: { video: null, comentario: ['comment_id'] },
  competitor_raw: { video: 'video_id', comentario: null },
}

const sha = (d: Uint8Array | string): string => createHash('sha256').update(d).digest('hex')

export function lerUnidadeGz(gz: Buffer): UnidadeLida {
  const { colunas, linhas } = lerCsv(gunzipSync(gz).toString('utf8'))
  return { colunas, linhas }
}

function indice(u: UnidadeLida, coluna: string): number {
  const i = u.colunas.indexOf(coluna)
  if (i < 0) throw new Error(`coluna_da_chave_ausente: ${coluna}`)
  return i
}

/** Ids dos comentários da chave E das respostas dela (`parent_id`), sobre a unidade de comentários NÃO filtrada do mesmo mês: o que as marcas do item devem tirar. */
export function idsDeComentarioComRespostas(comentariosOriginais: UnidadeLida, chaves: ReadonlySet<string>): Set<string> {
  const ii = indice(comentariosOriginais, 'id'), ip = indice(comentariosOriginais, 'parent_id')
  const ids = new Set<string>()
  for (const l of comentariosOriginais.linhas) {
    const id = l[ii]; const pai = l[ip]
    if (id != null && (chaves.has(id) || (pai != null && chaves.has(pai)))) ids.add(id)
  }
  return ids
}

export function idsDeComentariosDoVideo(comentarios: UnidadeLida, videos: ReadonlySet<string>): Set<string> {
  const iv = indice(comentarios, 'video_id'), ii = indice(comentarios, 'id')
  const ids = new Set<string>()
  for (const l of comentarios.linhas) { const v = l[iv]; const id = l[ii]; if (v != null && id != null && videos.has(v)) ids.add(id) }
  return ids
}

export function filtrarUnidade(o: {
  tabela: string; kind: 'video' | 'comentario'; chaves: ReadonlySet<string>; unidade: UnidadeLida; comentariosDoVideo?: ReadonlySet<string>
}): { unidade: UnidadeLida; removidas: number } {
  const regra = COLUNA_DA_CHAVE[o.tabela]
  if (!regra) throw new Error(`tabela_sem_chave: ${o.tabela}`)
  let tira: (l: Celula[]) => boolean
  if (o.kind === 'video' && regra.video) {
    const i = indice(o.unidade, regra.video)
    tira = l => l[i] != null && o.chaves.has(l[i]!)
  } else if (o.kind === 'video' && o.tabela === 'competitor_video_comment_marks') {
    if (!o.comentariosDoVideo) throw new Error('marcas_sem_comentarios_do_video')
    const i = indice(o.unidade, 'comment_id'); const ids = o.comentariosDoVideo
    tira = l => l[i] != null && ids.has(l[i]!)
  } else if (o.kind === 'comentario' && regra.comentario) {
    const is = regra.comentario.map(c => indice(o.unidade, c))
    tira = l => is.some(i => l[i] != null && o.chaves.has(l[i]!))
  } else {
    return { unidade: o.unidade, removidas: 0 }       // a tabela não carrega esse tipo de item (ex.: comentário na diária)
  }
  const ficam = o.unidade.linhas.filter(l => !tira(l))
  return { unidade: { colunas: o.unidade.colunas, linhas: ficam }, removidas: o.unidade.linhas.length - ficam.length }
}

/** O texto de `to_jsonb(array[...]::text[])` do Postgres: `["a", null]`, com ", " entre os elementos (`m3b.sql:376-381`). */
const jsonbTexto = (l: ReadonlyArray<Celula>): string => '[' + l.map(v => (v === null ? 'null' : JSON.stringify(v))).join(', ') + ']'
export const hashConteudo = (linhas: ReadonlyArray<ReadonlyArray<Celula>>): string => sha(linhas.map(jsonbTexto).join('\n'))

/** Inteiro de coluna bigint/integer: `BigInt('')`, `' 7 '` e `'0x10'` não podem passar em silêncio. */
function inteiroDe(v: string, coluna: string): bigint {
  if (!/^-?\d+$/.test(v)) throw new Error(`valor_nao_inteiro: ${coluna}`)
  return BigInt(v)
}

function soma(u: UnidadeLida, coluna: string | null): string | null {
  if (coluna === null) return null
  const i = indice(u, coluna)
  let s = BigInt(0)
  for (const l of u.linhas) { const v = l[i]; if (v != null) s += inteiroDe(v, coluna) }
  return s.toString()
}

export function serializarUnidade(u: UnidadeLida, colunaControle: string | null): UnidadeSerializada {
  const hash = hashConteudo(u.linhas)
  const control_sum = soma(u, colunaControle)
  if (u.linhas.length === 0) return { gz: null, sha256_bytes: null, csv_sha256: null, file_bytes: 0, row_count: 0, control_sum, hash_conteudo: hash }
  const csv = serializarLinhas(u.colunas, u.linhas)
  const gz = gzipSync(csv, { level: 9 })
  return { gz, sha256_bytes: sha(gz), csv_sha256: sha(csv), file_bytes: gz.byteLength, row_count: u.linhas.length, control_sum, hash_conteudo: hash }
}
