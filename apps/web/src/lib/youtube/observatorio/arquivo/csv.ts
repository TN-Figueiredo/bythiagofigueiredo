/**
 * A5 · E10: o CSV do arquivo, sem dependência. Puro, só `node:`/relativo (o `tsx` da raiz importa este módulo).
 *
 * As regras são as do `\copy … csv header` do Postgres, que é quem recarrega o arquivo: separador vírgula; fim de linha `\n`;
 * campo com vírgula, aspas, `\n` ou `\r` vai entre aspas, com as aspas dobradas; **nulo é campo vazio SEM aspas e texto vazio é
 * `""`** (é o que deixa a recarga distinguir os dois); a primeira linha é o cabeçalho. Toda coluna entra como TEXTO
 * (`coluna::text` na leitura), então "123", "2026-01-01" e "{0.1,0.30000001}" voltam byte a byte: nada aqui interpreta valor.
 */

const PRECISA_DE_ASPAS = /[",\n\r]/

/** Uma linha de dados ou de cabeçalho, sem o fim de linha. `null` é nulo (campo vazio); `''` é texto vazio (`""`). */
export function linhaCsv(valores: ReadonlyArray<string | null>): string {
  return valores
    .map(v => {
      if (v === null) return ''
      if (v === '') return '""'
      return PRECISA_DE_ASPAS.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
    })
    .join(',')
}

export class CsvInvalido extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'CsvInvalido'
  }
}

/**
 * Lê o texto inteiro. Lança `CsvInvalido` em: texto sem cabeçalho, aspas que não fecham, aspas no meio de um campo sem aspas,
 * caractere depois de aspas fechadas, e linha com número de campos diferente do cabeçalho (nunca completa com nulo).
 * Uma linha sem nada, no meio do arquivo, é uma linha de um campo nulo (só serve a tabela de uma coluna).
 */
export function lerCsv(texto: string): { colunas: string[]; linhas: Array<Array<string | null>> } {
  const registros: Array<Array<string | null>> = []
  let campos: Array<string | null> = []
  let i = 0
  const n = texto.length
  while (i < n) {
    // um campo
    let valor: string | null
    if (texto[i] === '"') {
      i++
      let acc = ''
      for (;;) {
        if (i >= n) throw new CsvInvalido('campo entre aspas sem fechar')
        const c = texto[i]!
        if (c === '"') {
          if (texto[i + 1] === '"') { acc += '"'; i += 2; continue }
          i++
          break
        }
        acc += c
        i++
      }
      valor = acc
      const prox = texto[i]
      if (prox !== undefined && prox !== ',' && prox !== '\n' && !(prox === '\r' && texto[i + 1] === '\n')) {
        throw new CsvInvalido('caractere depois de aspas fechadas')
      }
    } else {
      let j = i
      while (j < n && texto[j] !== ',' && texto[j] !== '\n') j++
      let cru = texto.slice(i, j)
      if (j < n && texto[j] === '\n' && cru.endsWith('\r')) cru = cru.slice(0, -1) // \r\n
      if (cru.includes('"')) throw new CsvInvalido('aspas no meio de um campo sem aspas')
      if (cru.includes('\r')) throw new CsvInvalido('\\r solto num campo sem aspas')
      valor = cru === '' ? null : cru
      i = j
    }
    campos.push(valor)
    // o que fecha o campo
    if (i >= n) { registros.push(campos); campos = []; break }
    if (texto[i] === ',') {
      i++
      // vírgula no fim do texto: ainda há um último campo (vazio)
      if (i >= n) { campos.push(null); registros.push(campos); campos = []; break }
      continue
    }
    if (texto[i] === '\r') i++ // o \n vem logo depois (conferido acima)
    i++ // o \n
    registros.push(campos)
    campos = []
  }
  if (registros.length === 0) throw new CsvInvalido('texto sem cabeçalho')
  const cabecalho = registros[0]!
  const colunas: string[] = []
  for (const c of cabecalho) {
    if (c === null || c === '') throw new CsvInvalido('cabeçalho com coluna sem nome')
    colunas.push(c)
  }
  const linhas = registros.slice(1)
  linhas.forEach((l, k) => {
    if (l.length !== colunas.length) {
      throw new CsvInvalido(`linha ${k + 2} tem ${l.length} campo(s); o cabeçalho tem ${colunas.length}`)
    }
  })
  return { colunas, linhas }
}
