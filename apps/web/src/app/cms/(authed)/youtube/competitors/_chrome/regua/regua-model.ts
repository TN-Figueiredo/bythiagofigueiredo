/**
 * A conta da régua do nicho (spec telas v9, 18.5 e 17.3; mockup M/regua.js: escalar, espalhar, nicho, ajustar). Pura: não importa
 * o motor nem a tela. Mora em `_chrome/` porque a fase A4 reusa a escala e os empates na régua do vídeo próprio.
 *
 * A régua desenha UM traço por canal do conjunto (o nicho, ou o geral), do menor ao maior valor, e destaca os lados A e B. Posição
 * escrita sempre com o conjunto ("13º de 14 em Viagem"), 1º = o maior, empate dito; nunca percentil. Nulo nunca vira zero: lado sem
 * valor não ganha traço e o texto diz de quem falta e por quê.
 */
import { posicoes } from '@/lib/youtube/observatorio/posicao'

/** Menos canais que isto com valor: a régua não se desenha (spec 17.3, "menos de 3 com o dado"; a mesma conta vale aqui). */
export const MIN_REGUA = 3

export interface Escala { min: number; max: number; comprimida: boolean; pct(x: number): number }

/**
 * Linear; comprimida (raiz quadrada de x − min) quando 60% ou mais dos valores caem no primeiro quarto do eixo (x < min + 25% da amplitude).
 * Todos iguais → 50%, linear. Lista vazia não lança.
 */
export function escalar(xs: readonly number[]): Escala {
  if (!xs.length) return { min: 0, max: 0, comprimida: false, pct: () => 50 }
  let min = Infinity, max = -Infinity
  for (const x of xs) { if (x < min) min = x; if (x > max) max = x }
  const corte = min + 0.25 * (max - min)
  const comprimida = max > min && xs.filter(x => x < corte).length / xs.length >= 0.6
  const f = (x: number) => (comprimida ? Math.sqrt(Math.max(0, x - min)) : Math.max(0, x - min))
  return { min, max, comprimida, pct: x => (max === min ? 50 : Math.min(100, (f(x) / f(max)) * 100)) }
}

export interface Traco {
  id: string; nome: string; x: number
  /** O valor como a tela o escreve ("1,53 mil"): é por ele que se decide o empate e é ele que a dica e o leitor de tela falam. */
  texto: string
  /** 0 a 100 no eixo (a escala já aplicada). */
  pct: number
  marca: 'A' | 'B' | null
  /** Px para o lado: empate COM lado destacado abre os outros (4,4 px do destacado, 2,6 px entre eles); o destacado fica em 0. */
  dx: number
  /** Empate SEM lado destacado: empilha na vertical (um bloco por canal, passo de até 5 px). */
  pilha: { i: number; passo: number } | null
  /** Os nomes de quem tem o mesmo valor escrito (inclui este), do menor ao maior, para a dica ("5 canais com 50"). */
  grupo: string[]
}

/** Um lado que não tem traço (sem valor naquele número) e a frase que diz de quem é e por quê. */
export interface SemTraco { letra: 'A' | 'B'; nome: string; texto: string }

/** A posição de um lado já escrita ("13º de 14 em Viagem", com " (empate)" quando é): a MESMA conta do `aria`, para a tela escrevê-la ao lado do valor. */
export interface PosicaoRegua { pos: number; de: number; empate: boolean; texto: string }

export interface ReguaView {
  /** Do menor ao maior valor (empate: pelo nome). Vazio quando `vazio` existe. */
  tracos: Traco[]
  /** Quantos canais do conjunto têm o valor. */
  n: number
  comprimida: boolean
  /** O nome do grupo para o leitor de tela: a posição escrita dos dois lados, o conjunto, a escala e como usar o teclado. */
  aria: string
  /** Frase no lugar da régua quando há poucos canais com valor. */
  vazio: string | null
  semTraco: SemTraco[]
  /** A posição dos dois lados no conjunto (null: lado sem valor). Existe também quando a régua não se desenha ("poucos canais"). */
  posicao: { A: PosicaoRegua | null; B: PosicaoRegua | null }
  /** A unidade para a fala ("inscritos"); vazia quando o valor escrito já a traz. */
  un: string
}

export interface ValorRegua { id: string; nome: string; x: number; texto: string }
export interface MarcaRegua {
  id: string; letra: 'A' | 'B'; nome: string
  /** Por que o lado não tem valor (o motivo do "não medido"). Obrigatório no tipo: quem tem valor passa `null`; lado sem valor e sem motivo é erro. */
  motivo: string | null
}

const PASSO_LADO = 2.6 // entre dois vizinhos do mesmo lado
const BASE_LADO = 4.4 // do destacado (4 px de largura, mais o contorno) ao primeiro vizinho
const SEPARACAO_DOS_DOIS = 2.5 // os dois destacados empatados entre si: cada um sai do valor exato por tanto, para um não cobrir o outro
const COLUNA_MAX = 26 // altura útil da pilha (a régua tem 46 px, 19 ocupados pela linha de base e pela letra)
const dec1 = (v: number) => Math.round(v * 10) / 10

/** O passo da pilha: 5 px, ou menos quando são tantos que a coluna passaria de 26 px. */
const passoPilha = (n: number) => Math.max(1, Math.min(5, Math.floor(COLUNA_MAX / n)))
/** A altura de cada bloco da pilha: 3 px no passo de 5 (cinco canais = coluna de 23 px), menor quando o passo encolhe. */
export const alturaPilha = (passo: number): number => (passo >= 4 ? 3 : Math.max(1, passo - 1))

const cmp = (a: ValorRegua, b: ValorRegua) => a.x - b.x || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const ord = (p: number) => `${p}º`

export function buildRegua(vals: ReadonlyArray<ValorRegua>, marcas: ReadonlyArray<MarcaRegua>, o: { numero: string; conjunto: string; un?: string }): ReguaView {
  for (const v of vals) if (!Number.isFinite(v.x)) throw new Error(`régua: valor inválido em ${v.nome} (${v.id})`)
  const d = [...vals].sort(cmp)
  const n = d.length
  const un = o.un ?? ''
  const marcaDe = new Map(marcas.map(m => [m.id, m.letra] as const))
  const noConjunto = new Set(d.map(v => v.id))

  // quem tem marca e não tem valor: sem traço, e a frase diz por quê (sem o motivo a tela afirmaria "não medido" sem causa: falha alto)
  const semTraco: SemTraco[] = marcas.filter(m => !noConjunto.has(m.id)).map(m => {
    if (!m.motivo || !m.motivo.trim()) throw new Error(`régua: lado ${m.letra} (${m.nome}) sem valor e sem motivo`)
    return { letra: m.letra, nome: m.nome, texto: `sem traço de ${m.nome} (lado ${m.letra}): ${m.motivo}` }
  })

  const pos = posicoes(d.map(v => ({ id: v.id, x: v.x, chave: v.texto })))
  const posDe = (letra: 'A' | 'B'): PosicaoRegua | null => {
    const m = marcas.find(x => x.letra === letra)
    const p = m ? pos.get(m.id) : null
    return p ? { pos: p.pos, de: p.de, empate: p.empate, texto: `${ord(p.pos)} de ${p.de} ${o.conjunto}${p.empate ? ' (empate)' : ''}` } : null
  }
  const posicao = { A: posDe('A'), B: posDe('B') }
  const escrita = (m: MarcaRegua): string => {
    const p = posicao[m.letra]
    if (!p) return semTraco.find(s => s.letra === m.letra)?.texto ?? `sem traço de ${m.nome} (lado ${m.letra})`
    return `Lado ${m.letra}, ${m.nome}: ${p.texto}`
  }

  const vazio = n < MIN_REGUA ? `poucos canais para comparar ${o.conjunto} (${n}; precisa de ${MIN_REGUA})` : null
  const es = escalar(d.map(v => v.x))
  const comprimida = !vazio && es.comprimida

  // só se diz "destacado" do que existe: dois, um ou nenhum traço de lado
  const comTraco = marcas.filter(m => noConjunto.has(m.id)).map(m => m.letra).sort()
  const destacados = comTraco.length === 2 ? '; os destacados são os lados A e B' : comTraco.length === 1 ? `; o destacado é o lado ${comTraco[0]}` : ''

  const aria = vazio
    ? [`Posição em ${o.numero} ${o.conjunto}: ${vazio}.`, ...semTraco.map(s => s.texto + '.')].join(' ')
    : `Posição em ${o.numero} ${o.conjunto}. ${[...marcas].sort((a, b) => a.letra.localeCompare(b.letra)).map(escrita).join('; ')}.` +
      ` Do menor ao maior, um traço por canal ${o.conjunto}${destacados}.` +
      (comprimida ? ' Escala comprimida.' : '') +
      ' Uma parada de Tab; as setas percorrem os canais do menor ao maior valor; Esc fecha a dica.'

  if (vazio) return { tracos: [], n, comprimida: false, aria, vazio, semTraco, posicao, un }

  const tracos: Traco[] = d.map(v => ({
    id: v.id, nome: v.nome, x: v.x, texto: v.texto, pct: es.pct(v.x), marca: marcaDe.get(v.id) ?? null, dx: 0, pilha: null, grupo: [v.nome],
  }))

  // o empate é o do valor ESCRITO (a mesma chave da posição): dois valores que se escrevem igual dividem a posição
  const grupos = new Map<string, number[]>()
  tracos.forEach((t, i) => { const k = t.texto || String(t.x); const g = grupos.get(k); if (g) g.push(i); else grupos.set(k, [i]) })
  for (const idx of grupos.values()) {
    for (const i of idx) tracos[i]!.grupo = idx.map(j => tracos[j]!.nome)
    if (idx.length < 2) continue
    const marcados = idx.filter(i => tracos[i]!.marca)
    const outros = idx.filter(i => !tracos[i]!.marca)
    if (!marcados.length) {
      // sem lado destacado: coluna vertical, um bloco por canal
      const passo = passoPilha(idx.length)
      idx.forEach((i, j) => { tracos[i]!.pilha = { i: j, passo } })
      continue
    }
    // com lado destacado: ele fica no valor exato e os outros abrem para os lados (nas pontas, só para dentro)
    let base = BASE_LADO
    const a = marcados.find(i => tracos[i]!.marca === 'A'), b = marcados.find(i => tracos[i]!.marca === 'B')
    if (a != null && b != null) {
      tracos[a]!.dx = -SEPARACAO_DOS_DOIS; tracos[b]!.dx = SEPARACAO_DOS_DOIS
      base += SEPARACAO_DOS_DOIS
    }
    const ponta = es.max > es.min ? (idx.some(i => tracos[i]!.x === es.min) ? 1 : idx.some(i => tracos[i]!.x === es.max) ? -1 : 0) : 0
    let lado = 1
    outros.forEach((i, j) => {
      tracos[i]!.dx = dec1(ponta ? ponta * (base + j * PASSO_LADO) : lado * (base + Math.floor(j / 2) * PASSO_LADO))
      lado = -lado
    })
  }
  return { tracos, n, comprimida, aria, vazio: null, semTraco, posicao, un }
}

/** A distância mínima entre os centros de duas letras (px); com menos que isto elas se afastam. */
const LETRAS_MIN = 20
/** A folga a mais depois de afastar, para as duas não ficarem exatamente coladas. */
const LETRAS_FOLGA = 2

/**
 * Quanto afastar as duas letras (px, para o lado) quando os traços colidem; os traços não saem do valor. `pctA`/`pctB` são as posições
 * dos traços no eixo (0 a 100) e `larguraPx` a largura da faixa onde eles se desenham. A letra mais à esquerda vai para a esquerda; no
 * mesmo ponto, A fica à esquerda. Nas pontas a letra não sai da faixa: a folga vem toda do outro lado. Sem largura medida: nada.
 */
export function afastarLetras(pctA: number, pctB: number, larguraPx: number): [number, number] {
  if (!Number.isFinite(larguraPx) || larguraPx <= 0 || !Number.isFinite(pctA) || !Number.isFinite(pctB)) return [0, 0]
  const xa = (pctA * larguraPx) / 100, xb = (pctB * larguraPx) / 100
  if (Math.abs(xa - xb) >= LETRAS_MIN) return [0, 0]
  const meio = (xa + xb) / 2, meia = (LETRAS_MIN + LETRAS_FOLGA) / 2
  let esq = meio - meia, dir = meio + meia
  if (esq < 0) { dir += -esq; esq = 0 }
  if (dir > larguraPx) { esq -= dir - larguraPx; dir = larguraPx }
  const aEsquerda = xa <= xb
  const da = (aEsquerda ? esq : dir) - xa, db = (aEsquerda ? dir : esq) - xb
  return [Math.round(da * 100) / 100, Math.round(db * 100) / 100]
}
