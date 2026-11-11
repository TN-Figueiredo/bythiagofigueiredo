// A7c1 T10: o resumo do todo, só com contagens, calculado sobre TODAS as linhas da lista principal e das tabelas coluna (antes da janela).
// Puro: sem relógio, sem banco. Cada coluna numérica tem seis estados disjuntos que somam M; "não medido", "falhou" e "restrito" nunca viram zero.
// Nenhuma conta além de contar: mediana, quartis e maiores esperam o `x` na origem (A7c2).
import { naCelula } from '../contexto-ia/terceiros'
import { median, quant } from '../stats'
import type { Celula, Tabela } from '../contexto-ia/tipos'

/** Tamanho máximo do resumo, em caracteres (contagens + a tabela de mediana e quartis da A7c2). */
export const RESUMO_MAX = 5_000
/** A7c2 T11: colunas que não entram na tabela de mediana (posição não é medida). */
export const NAO_RESUMIR: Readonly<Record<'canais' | 'outliers' | 'mudancas', readonly string[]>> = { canais: ['Posição'], outliers: [], mudancas: [] }
const NOME_MAX = 24
const FMT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
/** Colunas de texto da lista principal que ganham "Por X: valor n; …". `Grupo` (Destaques) e `Tipo` (Mudanças, com o quadro de efeito) a tela já manda: quem chama tira. */
export const CATEGORIAS_NO_RESUMO: Readonly<Record<'canais' | 'outliers' | 'mudancas', readonly string[]>> = { canais: [], outliers: ['Nicho'], mudancas: ['Tipo', 'Nicho'] }

const VALORES_MAX = 8
const VALOR_MAX = 40

/** Uma tabela coluna e a dona de cada linha dela (posição na principal; -1 = sem dona). */
export interface ApoioDoResumo { tabela: Tabela; donos: readonly number[] }

interface Contas { medidos: number; zeros: number; semMedida: number; falhou: number; restrito: number; semLinha: number }
const zerada = (): Contas => ({ medidos: 0, zeros: 0, semMedida: 0, falhou: 0, restrito: 0, semLinha: 0 })

function contar(c: Contas, cel: Celula | undefined): void {
  if (!cel || cel.papel !== 'numero') { c.semLinha += 1; return }
  // switch fechado: um estado novo esquecido não compila
  switch (cel.estado) {
    case 'medido': c.medidos += 1; return
    case 'zero_medido': c.zeros += 1; return
    case 'nao_medido': c.semMedida += 1; return
    case 'falhou': c.falhou += 1; return
    case 'restrito': c.restrito += 1; return
  }
}

const linhaDaTabela = (nome: string, c: Contas): string => `| ${naCelula(nome)} | ${c.medidos} | ${c.zeros} | ${c.semMedida} | ${c.falhou} | ${c.restrito} | ${c.semLinha} |`

/**
 * As linhas de contagem de uma tabela: uma por coluna numérica. Quais colunas aparecem se decide por TODAS as linhas da tabela (`todas`); as contagens saem das `usadas`
 * (uma por dona). `m` = linhas da principal (para "Sem linha"). Tabela sem nenhuma linha: uma linha só (título + "sem nenhuma linha"), com Sem linha = M.
 */
function linhasDaTabela(t: Tabela, todas: ReadonlyArray<readonly Celula[]>, usadas: ReadonlyArray<readonly Celula[]>, m: number, titulos: Map<string, number>): string[] {
  // Tabela sem nenhuma linha: não há como saber o tipo de cada coluna; uma linha só, com o título, e Sem linha = M (nada de coluna de texto como "Medidos 0").
  if (todas.length === 0) return [linhaDaTabela(`${t.titulo} (sem nenhuma linha)`, { ...zerada(), semLinha: m })]
  const out: string[] = []
  t.colunas.forEach((titulo, j) => {
    if (!todas.some((l) => l[j]?.papel === 'numero')) return
    const c = zerada()
    for (const l of usadas) contar(c, l[j])
    c.semLinha += m - usadas.length
    const n = (titulos.get(titulo) ?? 0) + 1
    titulos.set(titulo, n)
    out.push(linhaDaTabela(n === 1 ? titulo : `${titulo} (${n})`, c))
  })
  return out
}

const valorDaCategoria = (c: Celula | undefined): string => {
  if (!c || c.papel === 'numero') return '(sem valor)'
  const v = naCelula(c.texto.replace(/[;|]/g, ','))
  const letras = Array.from(v)
  return letras.length > VALOR_MAX ? `${letras.slice(0, VALOR_MAX - 1).join('')}…` : v
}

function porCategoria(principal: Tabela, nome: string, quantos: number): string | null {
  const j = principal.colunas.indexOf(nome)
  if (j < 0) return null
  const contagem = new Map<string, number>()
  for (const l of principal.linhas) { const v = valorDaCategoria(l[j]); contagem.set(v, (contagem.get(v) ?? 0) + 1) }
  const ordem = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
  const itens = ordem.slice(0, quantos).map(([v, n]) => `${v} ${n}`)
  if (ordem.length > quantos) itens.push(`mais ${ordem.length - quantos} valores`)
  return `Por ${naCelula(nome)}: ${itens.join('; ')}`
}

/** O resumo passou do tamanho previsto (só as contagens já não cabem). */
export const resumoPassou = (texto: string): boolean => texto.length > RESUMO_MAX

interface Ponto { x: number; nome: string; texto: string }
const nomeDaLinha = (l: readonly Celula[]): string => {
  const c = l.find((x) => x.papel === 'terceiros')
  if (!c || c.papel !== 'terceiros') return '(sem nome)'
  const letras = Array.from(naCelula(c.texto.replace(/[;|]/g, ',')))
  return letras.length > NOME_MAX ? `${letras.slice(0, NOME_MAX - 1).join('')}…` : letras.join('')
}

/**
 * A7c2 T11: uma linha por coluna numérica com n, mediana e quartis (funções do motor, `stats.ts`) sobre o `x` das células medido e zero_medido; a coluna é ordenada
 * UMA vez e mediana, quartis, maiores e menores saem do mesmo vetor. `maiores`: só a principal. `semX` conta as células medidas sem `x` finito.
 */
function estatisticas(t: Tabela, usadas: ReadonlyArray<readonly Celula[]>, fora: readonly string[], maiores: boolean, titulos: Map<string, number>, semXPorTabela: Map<string, number>): string[] {
  const out: string[] = []
  t.colunas.forEach((titulo, j) => {
    if (fora.includes(titulo) || !t.linhas.some((l) => l[j]?.papel === 'numero')) return
    const pontos: Ponto[] = []
    // `semXMotivo` = "sem variação" dentro do arredondamento: não é falha de origem, mas também não é número; fica fora do n e a coluna diz quantas
    let semX = 0, medidas = 0, semVariacao = 0
    for (const l of usadas) {
      const c = l[j]
      if (!c || c.papel !== 'numero' || (c.estado !== 'medido' && c.estado !== 'zero_medido')) continue
      if (c.semXMotivo !== undefined) { semVariacao += 1; continue }
      medidas += 1
      if (typeof c.x === 'number' && Number.isFinite(c.x)) pontos.push({ x: c.x, nome: nomeDaLinha(l), texto: c.texto })
      else semX += 1
    }
    const n = (titulos.get(titulo) ?? 0) + 1
    titulos.set(titulo, n)
    const nome = naCelula(`${n === 1 ? titulo : `${titulo} (${n})`}${semVariacao > 0 ? ` (${semVariacao} sem variação, fora da conta)` : ''}`)
    const vazio = 'sem medida'
    if (semX > 0) {
      semXPorTabela.set(t.id, (semXPorTabela.get(t.id) ?? 0) + semX)
      const f = `não calculado: ${semX} de ${medidas} sem valor de máquina`
      out.push(`| ${nome} | ${pontos.length} | ${f} | ${f} | ${f} |${maiores ? ` ${f} | ${f} |` : ''}`)
      return
    }
    if (pontos.length === 0) { out.push(`| ${nome} | 0 | ${Array(maiores ? 5 : 3).fill(vazio).join(' | ')} |`); return }
    // ordena uma vez (estável: empate na ordem da tela); a conta do motor sobre o mesmo vetor
    const asc = [...pontos].sort((a, b) => a.x - b.x)
    const xs = asc.map((p) => p.x)
    const q = (v: number | null): string => (v === null ? vazio : FMT.format(v))
    const base = `| ${nome} | ${pontos.length} | ${q(median(xs))} | ${q(quant(xs, 0.25))} | ${q(quant(xs, 0.75))} |`
    if (!maiores) { out.push(base); return }
    const lista = (ps: Ponto[]): string => ps.map((p) => `${p.nome} ${p.texto}`).join('; ')
    const desc = [...pontos].sort((a, b) => b.x - a.x)
    out.push(`${base} ${lista(desc.slice(0, 3))} | ${lista(asc.slice(0, 3))} |`)
  })
  return out
}

/**
 * `''` quando a principal não tem linha (a frase do vazio já é a 1ª linha). Senão o título, a tabela de contagens e as linhas "Por …".
 * Cabe em `RESUMO_MAX`: se passar, as categorias descem de 8 para 3 valores e depois saem, com a frase dizendo; as contagens nunca saem. Se só as contagens já passam, o texto sai inteiro
 * (nunca corte calado) e quem chama confere `resumoPassou` para avisar.
 * `paginado`: a tela mostra só parte do conjunto (o título diz).
 */
export function resumoDoTodo(principal: Tabela, apoio: readonly ApoioDoResumo[], categorias: readonly string[], paginado?: { mostrados: number; total: number }, opcoes?: { tela?: keyof typeof NAO_RESUMIR; avisar?: (passo: string, extra: Record<string, number | string>) => void }): string {
  const m = principal.linhas.length
  if (m === 0) return ''
  const titulos = new Map<string, number>()
  const linhas = linhasDaTabela(principal, principal.linhas, principal.linhas, m, titulos)
  const fora = opcoes?.tela ? NAO_RESUMIR[opcoes.tela] : []
  const tit2 = new Map<string, number>(), semXPorTabela = new Map<string, number>()
  const stats = estatisticas(principal, principal.linhas, fora, true, tit2, semXPorTabela)
  for (const a of apoio) {
    // uma linha por dona: sem dona e repetida não entram (a soma nunca passa de M)
    const vistas = new Set<number>()
    const usadas = a.tabela.linhas.filter((_, i) => { const d = a.donos[i] ?? -1; if (d < 0 || vistas.has(d)) return false; vistas.add(d); return true })
    linhas.push(...linhasDaTabela(a.tabela, a.tabela.linhas, usadas, m, titulos))
    stats.push(...estatisticas(a.tabela, usadas, fora, false, tit2, semXPorTabela))
  }
  // só contagem e id, nunca valor; um aviso por tabela com célula sem `x`
  for (const [tabela, n] of semXPorTabela) opcoes?.avisar?.('resumo_sem_x', { tabela, n })
  const tabelaStats = stats.length === 0 ? [] : [
    'Mediana e quartis: conta da ferramenta sobre os números da tela',
    '| Coluna | n | Mediana | 1º quartil | 3º quartil | Maiores (3) | Menores (3) |', '| --- | --- | --- | --- | --- | --- | --- |', ...stats,
  ]
  const titulo = `## Resumo do todo (calculado sobre as ${m} linhas do pacote, antes da janela${paginado ? `; a tela mostra ${paginado.mostrados} de ${paginado.total}` : ''})`
  const corpo = ['| Coluna | Medidos | Zeros medidos | Sem medida | Falhou | Restrito | Sem linha |', '| --- | --- | --- | --- | --- | --- | --- |', ...linhas]
  for (const quantos of [VALORES_MAX, 3, 0]) {
    const cats = quantos === 0 ? [] : categorias.flatMap((c) => { const l = porCategoria(principal, c, quantos); return l === null ? [] : [l] })
    const nota = quantos === VALORES_MAX || categorias.length === 0 ? [] : [quantos === 0 ? 'As contagens por categoria não couberam no resumo.' : '']
    const texto = [titulo, ...corpo, ...tabelaStats, ...cats, ...nota.filter(Boolean)].join('\n')
    if (texto.length <= RESUMO_MAX || quantos === 0) return texto
  }
  return ''
}
