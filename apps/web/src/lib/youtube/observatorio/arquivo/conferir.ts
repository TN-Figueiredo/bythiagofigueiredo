/**
 * A5 · E10: `conferirLote`, o passo 2 do arquivo. Só `node:` e importação relativa. Refaz TUDO do zero, sem confiar no export:
 *   (a) o manifesto e o `manifesto.sha256` batem com o disco (arquivo faltando, sobrando, sha256 diferente);
 *   (b) cada CSV.gz: descomprime, confere o sha256 do CSV, o cabeçalho, o número de registros e a soma;
 *   (c) no banco, com a mesma sessão do export: refaz cada consulta e compara o sha256 do CSV que ela daria; compara as miniaturas;
 *   (d) só com tudo igual, `obs_archive_verify` (que reconta e carimba `verified_at`).
 * Para na primeira CLASSE de diferença, lista até 20, não marca nada. `conferir` nunca recomprime para comparar.
 */
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { codigoE10, FRASES_E10 } from './codigos'
import { ehArquivoDoSistema } from './sistema'
import { lerCsv, CsvInvalido } from './csv'
import { validarManifesto, textoDoSha256, type Manifesto } from './manifesto'
import {
  abrirLeitura, fechar, consultaDoArquivo, lerCsvDoBanco, colunasDaExpressao, lerRegistro, lerMiniaturasDoBanco, type ClienteSql, type EntradaDoRegistro,
} from './sessao'
import type { Disco } from './exportar'

export type ResultadoConferencia =
  | { ok: true; arquivos: number; miniaturas: number }
  | { ok: false; codigo: string; frase: string; diferencas: string[] }

export const LIMITE_DE_DIFERENCAS = 20

export const FRASES_DA_CONFERENCIA: Record<string, string> = {
  sem_manifesto: 'A pasta da exportação não tem manifesto. Sem ele a exportação não vale.',
  manifesto_invalido: 'O manifesto da exportação está ilegível ou fora da forma esperada.',
  manifesto_de_outro_canal: 'O manifesto desta pasta é de outro canal, de outro site ou de outra exportação.',
  arquivo_faltando: 'Faltam arquivos que o manifesto lista.',
  arquivo_sobrando: 'Há arquivos na pasta que o manifesto não lista.',
  sha256_diferente: 'Algum arquivo mudou depois de exportado: o sha256 não bate.',
  csv_diferente: 'O conteúdo de algum arquivo não bate com o manifesto (registros, cabeçalho ou soma).',
  banco_mudou: 'O banco mudou depois da exportação: há dado diferente do que está nos arquivos.',
  miniaturas_diferentes: 'O conjunto de miniaturas do banco é diferente do que está no manifesto.',
  erro_do_banco: 'O banco devolveu um erro durante a conferência. Nada foi marcado.',
  // 57014 na conferência: a frase do catálogo fala da remoção (revisão Yannis 14/10, I1)
  demorou_demais: 'O banco passou do tempo durante a conferência. Nada foi marcado. Tente de novo; se repetir, avise.',
}

const sha256 = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex')
const juntar = (...partes: string[]): string => partes.join('/').replace(/\/{2,}/g, '/')
const falha = (codigo: string, diferencas: string[]): ResultadoConferencia => ({
  ok: false, codigo, frase: FRASES_DA_CONFERENCIA[codigo] ?? FRASES_E10[codigo as keyof typeof FRASES_E10] ?? FRASES_E10.inesperado, diferencas: diferencas.slice(0, LIMITE_DE_DIFERENCAS),
})

/** As linhas de um `manifesto.sha256`: `{ hash, caminho }`. Linha fora do formato é diferença. */
function lerSha256(texto: string): { itens: Map<string, string>; ruins: string[] } {
  const itens = new Map<string, string>()
  const ruins: string[] = []
  for (const l of texto.split('\n')) {
    if (l === '') continue
    const m = /^([0-9a-f]{64}) {2}(\S.*)$/.exec(l)
    if (!m) { ruins.push('linha ilegível em manifesto.sha256'); continue }
    itens.set(m[2]!, m[1]!)
  }
  return { itens, ruins }
}

export async function conferirLote(o: { sql: ClienteSql; disco: Disco; pastaRaiz: string; lote: string; siteId: string; canalId: string }): Promise<ResultadoConferencia> {
  const { sql, disco } = o
  const pasta = juntar(o.pastaRaiz, o.lote)

  // (a) o manifesto e o disco
  if (!(await disco.existe(juntar(pasta, 'manifesto.json')))) return falha('sem_manifesto', ['manifesto.json'])
  const bruto = Buffer.from(await disco.ler(juntar(pasta, 'manifesto.json')))
  let manifesto: Manifesto
  try {
    const v = validarManifesto(JSON.parse(bruto.toString('utf8')))
    if (!('valor' in v)) return falha('manifesto_invalido', [v.porque])
    manifesto = v.valor
  } catch {
    return falha('manifesto_invalido', ['manifesto.json não é um JSON legível'])
  }
  if (manifesto.canal.id !== o.canalId || manifesto.site !== o.siteId || manifesto.lote !== o.lote) {
    return falha('manifesto_de_outro_canal', ['canal, site ou nome da exportação diferentes do pedido'])
  }
  if (!(await disco.existe(juntar(pasta, 'manifesto.sha256')))) return falha('sem_manifesto', ['manifesto.sha256'])
  const { itens, ruins } = lerSha256(Buffer.from(await disco.ler(juntar(pasta, 'manifesto.sha256'))).toString('utf8'))
  if (ruins.length > 0) return falha('manifesto_invalido', ruins)
  const esperado = lerSha256(textoDoSha256(manifesto, sha256(bruto))).itens
  // o Finder e o Explorer deixam `.DS_Store` e `Thumbs.db` na pasta que o dono abre para copiar ao NAS (revisão Yannis 14/10, M8): não são arquivo da exportação
  const presentes = new Set((await disco.listar(pasta)).filter(c => !ehArquivoDoSistema(c)))
  const faltando: string[] = []
  const sobrando: string[] = []
  const diferentes: string[] = []
  for (const caminho of esperado.keys()) if (!presentes.has(caminho)) faltando.push(caminho)
  for (const caminho of presentes) if (caminho !== 'manifesto.sha256' && !esperado.has(caminho)) sobrando.push(caminho)
  // o arquivo manifesto.sha256 tem de dizer o que o manifesto diz, nem mais nem menos
  for (const [caminho, hash] of esperado) if (itens.get(caminho) !== hash) diferentes.push(`${caminho} (manifesto.sha256 e manifesto.json discordam)`)
  for (const caminho of itens.keys()) if (!esperado.has(caminho)) sobrando.push(`${caminho} (só em manifesto.sha256)`)
  if (faltando.length > 0) return falha('arquivo_faltando', faltando)
  if (sobrando.length > 0) return falha('arquivo_sobrando', sobrando)
  for (const [caminho, hash] of esperado) {
    if (diferentes.length >= LIMITE_DE_DIFERENCAS) break
    if (caminho === 'manifesto.json') { if (sha256(bruto) !== hash) diferentes.push(caminho); continue }
    if (sha256(await disco.ler(juntar(pasta, caminho))) !== hash) diferentes.push(caminho)
  }
  if (diferentes.length > 0) return falha('sha256_diferente', diferentes)

  // (b) cada CSV: descomprime, confere o sha256 do CSV, o cabeçalho, os registros
  const csvs = new Map<string, { sha256: string; linhas: number; soma: bigint | null }>()
  const ruim: string[] = []
  let entradas: EntradaDoRegistro[]
  try {
    entradas = await lerRegistroSeguro(sql)
  } catch {
    return falha('erro_do_banco', []) // sem o registro não há como conferir a soma: nunca seguir como se estivesse tudo bem
  }
  for (const a of manifesto.arquivos) {
    try {
      const csv = gunzipSync(Buffer.from(await disco.ler(juntar(pasta, a.caminho))))
      const lido = lerCsv(csv.toString('utf8'))
      const csvSha = sha256(csv)
      if (csvSha !== a.csvSha256) ruim.push(`${a.caminho}: o conteúdo mudou (sha256 do CSV)`)
      if (lido.colunas.join(',') !== a.colunas.map(c => c.nome).join(',')) ruim.push(`${a.caminho}: o cabeçalho difere do manifesto`)
      if (lido.linhas.length !== a.linhas) ruim.push(`${a.caminho}: ${lido.linhas.length} registro(s) no arquivo, ${a.linhas} no manifesto`)
      csvs.set(a.caminho, { sha256: csvSha, linhas: lido.linhas.length, soma: null })
      // a soma só se confere onde o registro diz qual coluna soma
      const coluna = colunasDaExpressao(entradas.find(x => x.tabela === a.tabela)?.soma ?? null)?.[0] ?? null
      if (a.soma !== null && coluna !== null) {
        const i = lido.colunas.indexOf(coluna)
        if (i < 0) { ruim.push(`${a.caminho}: a coluna somada não está no arquivo`); continue }
        let total = BigInt(0)
        for (const l of lido.linhas) { const v = l[i]; if (v !== null && v !== undefined) total += BigInt(v) }
        if (total.toString() !== a.soma) ruim.push(`${a.caminho}: soma ${total.toString()} no arquivo, ${a.soma} no manifesto`)
      }
    } catch (err) {
      ruim.push(`${a.caminho}: ${err instanceof CsvInvalido ? 'CSV malformado' : 'não foi possível descomprimir ou ler'}`)
    }
  }
  if (ruim.length > 0) return falha('csv_diferente', ruim)

  // (c) o banco, com a mesma sessão do export
  const diferencas: string[] = []
  let miniaturasNoBanco: string[] = []
  try {
    await abrirLeitura(sql)
    try {
      for (const a of manifesto.arquivos) {
        const e = entradas.find(x => x.tabela === a.tabela)
        if (!e) { diferencas.push(`${a.tabela}: a tabela saiu do registro do banco`); continue }
        const unico = a.periodo === 'unico'
        const lido = await lerCsvDoBanco(sql, {
          consulta: consultaDoArquivo({ tabela: a.tabela, filtro: e.filtro, periodo: e.periodo, ordem: e.ordem, colunas: a.colunas.map(c => c.nome) }),
          parametros: unico ? [o.canalId] : [o.canalId, a.periodStart],
          colunas: a.colunas.map(c => c.nome), colunaDaSoma: null, colunasDeOrdem: colunasDaExpressao(e.ordem),
        })
        if (lido.sha256 !== a.csvSha256) diferencas.push(`${a.tabela} ${unico ? 'arquivo único' : a.periodo}: o banco tem ${lido.linhas} registro(s), o arquivo ${a.linhas}`)
        if (diferencas.length >= LIMITE_DE_DIFERENCAS) break
      }
      miniaturasNoBanco = (await lerMiniaturasDoBanco(sql, o.canalId)).map(m => m.url)
    } finally {
      await fechar(sql, 'rollback').catch(() => undefined)
    }
  } catch {
    return falha('erro_do_banco', [])
  }
  if (diferencas.length > 0) return falha('banco_mudou', diferencas)
  const doManifesto = new Set(manifesto.miniaturas.map(m => m.url))
  const doBanco = new Set(miniaturasNoBanco)
  const mini: string[] = []
  for (const u of doBanco) if (!doManifesto.has(u)) mini.push('miniatura no banco que o manifesto não tem')
  for (const u of doManifesto) if (!doBanco.has(u)) mini.push('miniatura no manifesto que o banco não tem mais')
  if (mini.length > 0) return falha('miniaturas_diferentes', mini)

  // (d) só com tudo igual: o banco reconta e carimba
  try {
    await sql.query('begin')
    await sql.query('select public.obs_archive_verify($1, $2, $3)', [o.siteId, o.lote, o.canalId])
    await fechar(sql, 'commit')
  } catch (err) {
    await fechar(sql, 'rollback').catch(() => undefined)
    const c = codigoE10(err as { message?: string; code?: string })
    return falha(c === 'inesperado' ? 'erro_do_banco' : c, [])
  }
  return { ok: true, arquivos: manifesto.arquivos.length, miniaturas: manifesto.miniaturas.filter(m => !m.ausente).length }
}

/** O registro do banco. Tem de ler dentro de uma transação; é só leitura: abre e desfaz. */
async function lerRegistroSeguro(sql: ClienteSql): Promise<EntradaDoRegistro[]> {
  await abrirLeitura(sql)
  try {
    return await lerRegistro(sql)
  } finally {
    await fechar(sql, 'rollback').catch(() => undefined)
  }
}
