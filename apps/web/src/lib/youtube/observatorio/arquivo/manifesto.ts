/**
 * A5 · E10: o manifesto do arquivo de um canal (`manifesto.json`), o texto do `manifesto.sha256` e o `p_rows` que
 * `obs_archive_register` recebe. Puro, só `node:`/relativo (o `tsx` da raiz importa este módulo).
 *
 * O manifesto é o ÚLTIMO arquivo gravado: pasta sem manifesto é pasta sem valor. `validarManifesto` é a porta de tudo o que lê
 * um manifesto do disco (`conferir`, `comandos-recarga`, `--refazer`): recusa chave faltando, versão desconhecida e, antes de
 * qualquer coisa, caminho que sai da pasta do lote (um manifesto adulterado não pode apontar para fora dela).
 */

export const VERSAO_DO_MANIFESTO = 1

export interface ColunaDoManifesto { nome: string; tipo: string; nulo: boolean }
export interface ArquivoDoManifesto {
  tabela: string
  canal: string
  /** `AAAA-MM`, ou `unico` para a tabela sem coluna de mês. */
  periodo: string
  periodStart: string
  periodEnd: string
  /** `<tabela>/<canal>/<AAAA-MM>.csv.gz`, relativo à pasta do lote. */
  caminho: string
  linhas: number
  /** A soma de controle como TEXTO (bigint passa de 2^53); nulo = a tabela não tem coluna somável. */
  soma: string | null
  menorChave: string | null
  maiorChave: string | null
  /** sha256 do arquivo gravado (o .gz). */
  sha256: string
  /** sha256 do CSV sem compressão: é o que `conferir` refaz contra o banco. */
  csvSha256: string
  colunas: ColunaDoManifesto[]
}
export interface MiniaturaDoManifesto {
  url: string
  caminhoNoBlob: string
  /** Relativo à pasta do lote; nulo quando a miniatura está ausente (404 aceito). */
  caminho: string | null
  bytes: number | null
  sha256: string | null
  ausente: boolean
}
export interface Manifesto {
  versao: 1
  script: string
  lote: string
  site: string
  canal: { id: string; youtubeId: string; nome: string | null }
  geradoEm: string
  sessao: { timezone: 'UTC'; extraFloatDigits: 3 }
  arquivos: ArquivoDoManifesto[]
  tabelasSemLinha: string[]
  tabelasAusentes: string[]
  excluidas: Array<{ tabela: string; motivo: string }>
  miniaturas: MiniaturaDoManifesto[]
  /** Por tabela, o `create table` reconstruído do catálogo (para recarregar daqui a anos sem este banco). */
  esquema: Record<string, string>
}

/** A sentinela que a MG6 grava em `period_start` e `period_end` da tabela sem coluna de mês ("arquivo único"). */
export const PERIODO_UNICO_ISO = '1970-01-01'

const NOME_DE_TABELA = /^[a-z0-9_]+$/
const ID_DE_CANAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PERIODO = /^(\d{4}-(0[1-9]|1[0-2])|unico)$/
const DIA = /^\d{4}-\d{2}-\d{2}$/
const HEX64 = /^[0-9a-f]{64}$/
const LOTE = /^[a-z0-9][a-z0-9-]{2,60}$/
const CAMINHO_DO_ARQUIVO = /^[a-z0-9_]+\/[0-9a-f-]{36}\/(\d{4}-\d{2}|unico)\.csv\.gz$/
const CAMINHO_DA_MINIATURA = /^miniaturas\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,200}$/

/** `<tabela>/<canal>/<AAAA-MM>.csv.gz`. Recusa (lança) o que não for nome seguro: este caminho vira arquivo no disco. */
export function caminhoDoArquivo(tabela: string, canal: string, periodo: string): string {
  if (!NOME_DE_TABELA.test(tabela)) throw new Error('nome de tabela inválido para caminho')
  if (!ID_DE_CANAL.test(canal)) throw new Error('id de canal inválido para caminho')
  if (!PERIODO.test(periodo)) throw new Error('período inválido para caminho')
  return `${tabela}/${canal}/${periodo}.csv.gz`
}

/** `canal-<8 primeiros do id>-<AAAA-MM-DD>`: o nome padrão do lote. */
export function nomeDoLote(canalId: string, dia: string): string {
  if (!ID_DE_CANAL.test(canalId)) throw new Error('id de canal inválido para o nome do lote')
  if (!DIA.test(dia)) throw new Error('dia inválido para o nome do lote')
  return `canal-${canalId.slice(0, 8)}-${dia}`
}

// ───────────────────────── validação ─────────────────────────

type Falha = { porque: string }
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehListaDeTexto = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto)
const ehNumeroInteiro = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const textoOuNulo = (v: unknown): v is string | null => v === null || typeof v === 'string'

const CHAVES_DO_MANIFESTO = [
  'versao', 'script', 'lote', 'site', 'canal', 'geradoEm', 'sessao', 'arquivos', 'tabelasSemLinha', 'tabelasAusentes', 'excluidas', 'miniaturas', 'esquema',
] as const

function validarArquivo(a: unknown, i: number): string | null {
  const nome = `arquivos[${i}]`
  if (!ehObjeto(a)) return `${nome} não é um objeto`
  for (const k of ['tabela', 'canal', 'periodo', 'periodStart', 'periodEnd', 'caminho', 'linhas', 'soma', 'menorChave', 'maiorChave', 'sha256', 'csvSha256', 'colunas']) {
    if (!(k in a)) return `${nome}: chave ausente: ${k}`
  }
  if (!ehTexto(a.tabela) || !NOME_DE_TABELA.test(a.tabela)) return `${nome}.tabela inválida`
  if (!ehTexto(a.canal) || !ID_DE_CANAL.test(a.canal)) return `${nome}.canal inválido`
  if (!ehTexto(a.periodo) || !PERIODO.test(a.periodo)) return `${nome}.periodo inválido`
  if (!ehTexto(a.periodStart) || !DIA.test(a.periodStart) || !ehTexto(a.periodEnd) || !DIA.test(a.periodEnd)) return `${nome}: período fora do formato`
  if (!ehTexto(a.caminho) || !CAMINHO_DO_ARQUIVO.test(a.caminho)) return `${nome}.caminho fora da pasta do lote`
  if (a.caminho !== `${a.tabela}/${a.canal}/${a.periodo}.csv.gz`) return `${nome}.caminho não bate com tabela, canal e período`
  if (!ehNumeroInteiro(a.linhas)) return `${nome}.linhas inválido`
  if (!textoOuNulo(a.soma) || !textoOuNulo(a.menorChave) || !textoOuNulo(a.maiorChave)) return `${nome}: soma e chaves são texto ou nulo`
  if (!ehTexto(a.sha256) || !HEX64.test(a.sha256) || !ehTexto(a.csvSha256) || !HEX64.test(a.csvSha256)) return `${nome}: sha256 inválido`
  if (!Array.isArray(a.colunas) || a.colunas.length === 0) return `${nome}.colunas vazio`
  for (const c of a.colunas) {
    if (!ehObjeto(c) || !ehTexto(c.nome) || c.nome === '' || !ehTexto(c.tipo) || typeof c.nulo !== 'boolean') return `${nome}.colunas fora da forma`
  }
  return null
}

function validarMiniatura(m: unknown, i: number): string | null {
  const nome = `miniaturas[${i}]`
  if (!ehObjeto(m)) return `${nome} não é um objeto`
  for (const k of ['url', 'caminhoNoBlob', 'caminho', 'bytes', 'sha256', 'ausente']) if (!(k in m)) return `${nome}: chave ausente: ${k}`
  if (!ehTexto(m.url) || !ehTexto(m.caminhoNoBlob) || typeof m.ausente !== 'boolean') return `${nome} fora da forma`
  if (m.ausente) {
    if (m.caminho !== null || m.bytes !== null || m.sha256 !== null) return `${nome}: miniatura ausente não tem caminho, tamanho nem sha256`
    return null
  }
  if (!ehTexto(m.caminho) || !CAMINHO_DA_MINIATURA.test(m.caminho)) return `${nome}.caminho fora da pasta do lote`
  if (!ehNumeroInteiro(m.bytes) || !ehTexto(m.sha256) || !HEX64.test(m.sha256)) return `${nome}: tamanho ou sha256 inválido`
  return null
}

/** O motivo em português de o valor não ser um manifesto, ou null. Nomeia chave e posição; nunca ecoa o valor recebido. */
function motivoDeRecusa(x: unknown): string | null {
  if (!ehObjeto(x)) return 'o manifesto não é um objeto'
  for (const k of CHAVES_DO_MANIFESTO) if (!(k in x)) return `chave ausente: ${k}`
  if (x.versao !== VERSAO_DO_MANIFESTO) return 'versão do manifesto desconhecida'
  if (!ehTexto(x.script) || !ehTexto(x.lote) || !LOTE.test(x.lote) || !ehTexto(x.site) || !ehTexto(x.geradoEm) || !Number.isFinite(Date.parse(x.geradoEm))) {
    return 'script, lote, site ou geradoEm fora da forma'
  }
  const c = x.canal
  if (!ehObjeto(c) || !ehTexto(c.id) || !ID_DE_CANAL.test(c.id) || !ehTexto(c.youtubeId) || !textoOuNulo(c.nome)) return 'canal fora da forma'
  const s = x.sessao
  if (!ehObjeto(s) || s.timezone !== 'UTC' || s.extraFloatDigits !== 3) return 'sessão fora da forma'
  if (!Array.isArray(x.arquivos)) return 'arquivos não é uma lista'
  for (let i = 0; i < x.arquivos.length; i++) {
    const e = validarArquivo(x.arquivos[i], i)
    if (e) return e
    if ((x.arquivos[i] as ArquivoDoManifesto).canal !== c.id) return `arquivos[${i}] é de outro canal`
  }
  if (!ehListaDeTexto(x.tabelasSemLinha) || !ehListaDeTexto(x.tabelasAusentes)) return 'tabelasSemLinha e tabelasAusentes são listas de texto'
  if (!Array.isArray(x.excluidas) || !x.excluidas.every(e => ehObjeto(e) && ehTexto(e.tabela) && ehTexto(e.motivo))) return 'excluidas fora da forma'
  if (!Array.isArray(x.miniaturas)) return 'miniaturas não é uma lista'
  for (let i = 0; i < x.miniaturas.length; i++) {
    const e = validarMiniatura(x.miniaturas[i], i)
    if (e) return e
  }
  if (!ehObjeto(x.esquema) || !Object.values(x.esquema).every(ehTexto)) return 'esquema fora da forma'
  const caminhos = [...x.arquivos.map(a => (a as ArquivoDoManifesto).caminho), ...x.miniaturas.map(m => (m as MiniaturaDoManifesto).caminho).filter((p): p is string => p !== null)]
  if (new Set(caminhos).size !== caminhos.length) return 'caminho repetido no manifesto'
  return null
}

function temFormaDeManifesto(x: unknown): x is Manifesto {
  return motivoDeRecusa(x) === null
}

/** O manifesto, ou o motivo de não servir. É a porta de tudo o que lê um manifesto do disco. */
export function validarManifesto(x: unknown): { valor: Manifesto } | Falha {
  const motivo = motivoDeRecusa(x)
  if (motivo !== null) return { porque: motivo }
  return temFormaDeManifesto(x) ? { valor: x } : { porque: 'o manifesto não tem a forma esperada' }
}

// ───────────────────────── sha256 e registro ─────────────────────────

/**
 * O conteúdo de `manifesto.sha256`, no formato de `sha256sum -c` (hash, DOIS espaços, caminho relativo à pasta do lote):
 * todo arquivo, toda miniatura PRESENTE e, por último, o próprio `manifesto.json`. Miniatura ausente (404 aceito) não tem arquivo.
 */
export function textoDoSha256(m: Manifesto, sha256DoManifestoJson: string): string {
  const linhas: string[] = []
  for (const a of m.arquivos) linhas.push(`${a.sha256}  ${a.caminho}`)
  for (const mi of m.miniaturas) if (!mi.ausente && mi.caminho !== null && mi.sha256 !== null) linhas.push(`${mi.sha256}  ${mi.caminho}`)
  linhas.push(`${sha256DoManifestoJson}  manifesto.json`)
  return linhas.join('\n') + '\n'
}

/** Quantas miniaturas o Blob respondeu 404 (aceitas de propósito pelo dono). */
export function miniaturasAusentes(m: Manifesto): number {
  return m.miniaturas.filter(x => x.ausente).length
}

const TABELA_DAS_MINIATURAS = 'competitor_video_versions'

/**
 * O `p_rows` de `obs_archive_register`: uma linha por arquivo. As miniaturas pertencem ao canal inteiro, não a um mês: o total
 * (`blob_count`, `blob_bytes`, `blob_missing`) vai no PRIMEIRO arquivo de `competitor_video_versions` e os outros dessa tabela
 * levam zero, para a soma da tabela ser o total e nunca o dobro. Nas demais tabelas os três campos são nulos.
 */
export function paraRegistro(m: Manifesto): Array<Record<string, unknown>> {
  const presentes = m.miniaturas.filter(x => !x.ausente)
  const total = {
    blob_count: presentes.length,
    blob_bytes: presentes.reduce((s, x) => s + (x.bytes ?? 0), 0),
    blob_missing: miniaturasAusentes(m),
  }
  let primeiro = true
  return m.arquivos.map(a => {
    const base: Record<string, unknown> = {
      table_name: a.tabela,
      period_start: a.periodStart,
      period_end: a.periodEnd,
      row_count: a.linhas,
      control_sum: a.soma,
      file_sha256: a.sha256,
      csv_sha256: a.csvSha256,
      blob_count: null,
      blob_bytes: null,
      blob_missing: null,
    }
    if (a.tabela !== TABELA_DAS_MINIATURAS) return base
    const levar = primeiro ? total : { blob_count: 0, blob_bytes: 0, blob_missing: 0 }
    primeiro = false
    return { ...base, ...levar }
  })
}
