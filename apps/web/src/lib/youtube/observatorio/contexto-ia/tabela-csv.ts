// A5 F1a (T5): o gerador de CSV. Puro: lê o MESMO `PacoteModelo` que passou por `segmentar` (que lança com dado privado sem direito) e escreve,
// por tabela, um bloco CSV com número de máquina (`Celula.x`), buraco como buraco (célula vazia + id de motivo) e uma dica de gráfico.
// Nunca converte o texto de uma célula em número: o número vem de `x`. Nenhuma frase fixa mora aqui (ficam em `frases.ts`).
import * as F from './frases'
import { FIM_DE_LINHA } from './terceiros'
import type { Celula, Tabela } from './tipos'

export type Grafico = 'linha' | 'barra' | 'pizza' | 'nenhum'

/**
 * Ids de tabela provados (D2): a soma das partes medidas é o todo da tela. Cada id entra com o seu teste (`acesso-ia-tabela.test.ts`, (11)):
 * `canais-resumo-direcao` (subindo + sem mudança + descendo = canais da principal com direção medida) e `grupos` de Destaques (soma dos grupos = cartões).
 */
export const PIZZA_PERMITIDA: ReadonlySet<string> = new Set<string>(['canais-resumo-direcao', 'grupos'])
export const FRASE_DO_GRAFICO: Record<Grafico, string> = F.FRASE_DO_GRAFICO

const CONTROLES_E_BIDI = /[\u0000-\u0008\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g
const PERIGO_DE_PLANILHA = /^[=+\-@\t\r]/
const TRES_CRASES_OU_MAIS = /`{3,}/g

/** Prosa do bloco (título, coluna, legenda): uma linha só, sem controle, bidi nem cerca; sem aspas nem prefixo de fórmula. */
function linhaDoBloco(s: string): string {
  return s.split(FIM_DE_LINHA).join(' ').replace(CONTROLES_E_BIDI, '').replace(TRES_CRASES_OU_MAIS, (c) => "'".repeat(c.length))
}

/** Um campo CSV (RFC 4180): uma linha só, sem controle nem bidi, sem cerca de código, sem fórmula; cerca com aspas quando precisa. */
export function campoCsv(texto: string): string {
  let t = texto.split(FIM_DE_LINHA).join(' ') // `split`, nunca `replace`: o regex não tem /g
  t = t.replace(CONTROLES_E_BIDI, '').replace(TRES_CRASES_OU_MAIS, (c) => "'".repeat(c.length))
  if (PERIGO_DE_PLANILHA.test(t.replace(/^ +/, ''))) t = `'${t}`
  if (/[,"]/.test(t) || /^\s|\s$/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/** Inteiro sem separador; fração com 6 algarismos significativos abaixo de 1 e 4 casas acima; ponto decimal; sem notação científica. */
export function numeroCsv(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`numeroCsv: ${String(x)} não é número finito`)
  if (x !== 0 && Math.abs(x) < 1e-20) throw new Error(`numeroCsv: ${String(x)} some no arredondamento`)
  const arred = Math.abs(x) < 1 ? Number(x.toPrecision(6)) : Math.abs(x) >= 1e11 ? x : Math.round(x * 1e4) / 1e4
  if (Math.abs(arred) >= Number.MAX_SAFE_INTEGER) return BigInt(arred).toString() // o ICU arredonda os algarismos de um inteiro enorme
  return arred.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
}

export type EstadoVazio = 'nao_medido' | 'falhou' | 'restrito'
export interface Legenda { idDe(estado: EstadoVazio, frase: string): string; linhas(): string[] }

/** m1, m2… na ordem em que aparecem; o mesmo (estado, frase) devolve o mesmo id. */
export function novaLegenda(): Legenda {
  const ids = new Map<string, { id: string; estado: EstadoVazio; frase: string }>()
  return {
    idDe(estado, frase) {
      const chave = `${estado}\u0000${frase}`
      const achado = ids.get(chave)
      if (achado) return achado.id
      const id = `m${ids.size + 1}`
      ids.set(chave, { id, estado, frase })
      return id
    },
    linhas() {
      if (ids.size === 0) return []
      return [F.LEGENDA_TITULO, ...[...ids.values()].map((m) => F.legendaLinha(m.id, m.estado, linhaDoBloco(m.frase)))]
    },
  }
}

export interface ColunaExtra { chave: string; titulo: string; valor: (linha: number) => string | null }
export interface CsvDaTabela {
  titulo: string
  dicionario: string
  cabecalho: string
  linhas: string[]
  semX: number
  grafico: Grafico
  privada: boolean
  /** Os `chave:mN` de cada linha (paralelo a `linhas`). */
  motivosNovos: string[][]
  /** Códigos de aviso para quem chama (`avisar`): 'pizza_nao_fecha'. */
  avisos: string[]
}

const ehNumero = (c: Celula): boolean => c.papel === 'numero'
const vazioNoCsv = (c: Celula): boolean => c.papel === 'numero' && !((c.estado === 'medido' || c.estado === 'zero_medido') && c.x !== undefined && c.x !== null && Number.isFinite(c.x))

function graficoDaTabela(t: Tabela, avisos: string[]): { grafico: Grafico; frase: string } {
  let g: Grafico = t.grafico ?? (t.tipo === 'dia_a_dia' ? 'linha' : t.tipo === 'lista' && t.linhas.some((l) => l.some(ehNumero)) ? 'barra' : 'nenhum')
  let k = 0
  if (g === 'pizza') {
    // parte sem número (célula vazia no CSV, ou linha que não tem a célula numérica das outras, como a do grupo de base fraca) não é parte medida
    const largura = Math.max(0, ...t.linhas.map((l) => l.filter(ehNumero).length))
    k = t.linhas.reduce((s, l) => s + l.filter(vazioNoCsv).length + (l.filter(ehNumero).length < largura ? 1 : 0), 0)
    if (!PIZZA_PERMITIDA.has(t.id) || k > 0) { g = 'barra'; avisos.push('pizza_nao_fecha') }
  }
  return { grafico: g, frase: F.FRASE_DO_GRAFICO[g].replace('{k}', String(k)) }
}

/** CSV largo de uma tabela. `null` se a tabela não declara `chaves` (ou elas não casam com as colunas e as linhas): quem chama avisa e manda para o modo texto. */
export function csvDaTabela(t: Tabela, legenda: Legenda, extras: readonly ColunaExtra[] = []): CsvDaTabela | null {
  const chaves = t.chaves
  if (!chaves || chaves.length !== t.colunas.length || new Set(chaves).size !== chaves.length) return null
  if (t.linhas.some((l) => l.length !== chaves.length)) return null
  if (chaves.slice(0, -1).includes('motivos')) return null
  const temMotivos = chaves.length > 0 && chaves[chaves.length - 1] === 'motivos'
  const colunasDeDados = temMotivos ? chaves.length - 1 : chaves.length
  const avisos: string[] = []
  const { grafico, frase } = graficoDaTabela(t, avisos)

  const cabecalhoChaves = [...extras.map((e) => e.chave), ...chaves, ...(temMotivos ? [] : ['motivos'])]
  if (new Set([...extras.map((e) => e.chave), ...chaves, ...(temMotivos ? [] : ['motivos'])]).size !== extras.length + chaves.length + (temMotivos ? 0 : 1)) return null
  const dic = [
    ...extras.map((e) => F.dicionarioLinha(e.chave, linhaDoBloco(e.titulo))),
    ...chaves.map((k, i) => F.dicionarioLinha(k, linhaDoBloco(t.colunas[i]!))),
    ...(temMotivos ? [] : [F.dicionarioLinha('motivos', F.COLUNA_MOTIVOS)]),
  ]
  let semX = 0
  const linhas: string[] = []
  const motivosNovos: string[][] = []
  t.linhas.forEach((linha, n) => {
    const refs: string[] = []
    const notas: string[] = []
    const campos: string[] = extras.map((e) => campoCsv(e.valor(n) ?? ''))
    for (let i = 0; i < colunasDeDados; i++) {
      const c = linha[i]!
      const chave = chaves[i]!
      if (c.papel !== 'numero') { campos.push(campoCsv(c.texto)); continue }
      if (c.estado !== 'nao_medido' && c.estado !== 'falhou' && c.estado !== 'restrito') {
        if (c.semXMotivo !== undefined) { refs.push(`${chave}:${legenda.idDe('nao_medido', c.semXMotivo)}`); campos.push(''); continue }
        if (c.x !== undefined && c.x !== null && Number.isFinite(c.x)) {
          if (c.nota !== undefined && c.nota !== '') notas.push(`${chave}: ${c.nota}`) // M3: ressalva sobre um número medido; não é id de legenda
          campos.push(numeroCsv(c.x))
          continue
        }
        semX += 1
        refs.push(`${chave}:${legenda.idDe('falhou', F.MOTIVO_SEM_NUMERO_DE_MAQUINA)}`)
        campos.push('')
        continue
      }
      refs.push(`${chave}:${legenda.idDe(c.estado, c.motivo)}`)
      campos.push('')
    }
    const doModelo = temMotivos ? linha[chaves.length - 1]! : null
    const textoDaA4 = doModelo && doModelo.papel !== 'numero' ? doModelo.texto : ''
    campos.push(campoCsv([...refs, ...notas, ...(textoDaA4 === '' ? [] : [textoDaA4])].join('; ')))
    linhas.push(campos.join(','))
    motivosNovos.push(refs)
  })
  return { titulo: linhaDoBloco(t.titulo), dicionario: [...dic, F.graficoSugerido(frase)].join('\n'), cabecalho: cabecalhoChaves.map(campoCsv).join(','), linhas, semX, grafico, privada: t.privada, motivosNovos, avisos }
}

/** `## título`, privado, dicionário (já com a linha do gráfico), e o CSV cercado. `linhas` pode ser um recorte (o corte da A7). */
export function blocoDaTabela(c: CsvDaTabela, linhas: readonly string[]): string {
  return [`## ${c.titulo}`, ...(c.privada ? [F.TABELA_PRIVADA] : []), c.dicionario, '```csv', c.cabecalho, ...linhas, '```'].join('\n')
}
