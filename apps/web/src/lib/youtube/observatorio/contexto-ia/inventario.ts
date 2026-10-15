// A5 · E17 degrau 1, Tarefa 5: o inventário de folhas do modelo de uma tela. É o mecanismo que faz "tela que ganhar um número sem o
// empacotador quebra o teste" (item 160) ser verdade: cada folha do modelo tem de ter um destino declarado (número, base, motivo,
// rótulo, texto de terceiros, série, ou "descartado" com o motivo), e cada declaração tem de ter uma folha de verdade por trás.
//
// Caminhos: chaves de objeto separadas por '.', e '[]' para qualquer posição de lista (o índice não entra). 'canais[].numeros.mediana.texto'.
// Função pura, sem relógio nem rede.

export type Destino =
  | 'numero' | 'base' | 'motivo' | 'rotulo' | 'terceiros' | 'serie'
  | { descartado: 'endereço' | 'imagem' | 'aparência' | 'identificador' | 'controle de tela' | 'repetido' }

/** A chave é o caminho generalizado; `*` no fim casa o resto (`'canais[].capa.*'`). `*` no meio não é curinga. */
export type Inventario = Record<string, Destino>

export type ValorDeFolha = string | number | boolean | null
export interface Folha { caminho: string; valor: ValorDeFolha }
export interface Ignorado { caminho: string; tipo: 'funcao' | 'elemento_react' | 'simbolo' | 'colecao_nao_percorrida' }

const juntar = (pai: string, chave: string): string => (pai === '' ? chave : `${pai}.${chave}`)

const ehElementoReact = (v: object): boolean => '$$typeof' in v

function percorrer(valor: unknown, caminho: string, folhas: Folha[], ignorados: Ignorado[], visitados: WeakSet<object>): void {
  if (valor === null || valor === undefined) { folhas.push({ caminho, valor: null }); return } // dado ausente continua sendo uma folha: o destino dele também tem de estar declarado
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') { folhas.push({ caminho, valor }); return }
  if (typeof valor === 'bigint') { folhas.push({ caminho, valor: valor.toString() }); return }
  if (typeof valor === 'function') { ignorados.push({ caminho, tipo: 'funcao' }); return }
  if (typeof valor === 'symbol') { ignorados.push({ caminho, tipo: 'simbolo' }); return }
  if (typeof valor !== 'object') return
  if (valor instanceof Date) { folhas.push({ caminho, valor: Number.isNaN(valor.getTime()) ? null : valor.toISOString() }); return } // data é uma folha (texto ISO), não um objeto vazio
  if (valor instanceof Map || valor instanceof Set) { ignorados.push({ caminho, tipo: 'colecao_nao_percorrida' }); return } // sem chave enumerável: não some em silêncio, o teste da tela vê em `ignorados`
  if (ehElementoReact(valor)) { ignorados.push({ caminho, tipo: 'elemento_react' }); return }
  if (visitados.has(valor)) return // referência circular: o objeto já está na descida em curso (ancestral de si mesmo)
  // `visitados` guarda só os ancestrais da descida: o objeto sai do conjunto ao terminar, porque o mesmo objeto sob duas chaves (DAG) não é ciclo
  // e cada caminho dele precisa de destino.
  visitados.add(valor)
  try {
    if (Array.isArray(valor)) {
      for (const item of valor) percorrer(item, `${caminho}[]`, folhas, ignorados, visitados)
      return
    }
    for (const [chave, v] of Object.entries(valor)) percorrer(v, juntar(caminho, chave), folhas, ignorados, visitados)
  } finally {
    visitados.delete(valor)
  }
}

/** Toda folha do modelo (objetos e listas percorridos; o índice de lista vira `[]`). Funções e elementos React não são folhas: ver `ignorados`. */
export function folhas(valor: unknown): Folha[] {
  const saida: Folha[] = []
  percorrer(valor, '', saida, [], new WeakSet())
  return saida
}

/** O que `folhas` deixou de fora: funções e elementos React, com o caminho. */
export function ignorados(valor: unknown): Ignorado[] {
  const saida: Ignorado[] = []
  percorrer(valor, '', [], saida, new WeakSet())
  return saida
}

const prefixoDoCuringa = (chave: string): string | null => (chave.endsWith('*') && chave.indexOf('*') === chave.length - 1 ? chave.slice(0, -1) : null)

/** O destino de um caminho: a chave exata, ou o curinga de prefixo mais longo. */
export function destinoDe(caminho: string, inv: Inventario): Destino | undefined {
  if (Object.prototype.hasOwnProperty.call(inv, caminho)) return inv[caminho]
  let melhor: { tamanho: number; destino: Destino } | null = null
  for (const [chave, destino] of Object.entries(inv)) {
    const prefixo = prefixoDoCuringa(chave)
    if (prefixo !== null && caminho.startsWith(prefixo) && (melhor === null || prefixo.length > melhor.tamanho)) melhor = { tamanho: prefixo.length, destino }
  }
  return melhor?.destino
}

/** Caminhos de folha do modelo que o inventário não declara (campo novo na tela sem empacotador). Sem repetição, na ordem em que aparecem. */
export function semDestino(modelo: unknown, inv: Inventario): string[] {
  const vistos = new Set<string>()
  for (const f of folhas(modelo)) if (destinoDe(f.caminho, inv) === undefined) vistos.add(f.caminho)
  return [...vistos]
}

/** Chaves do inventário sem nenhuma folha por trás (declaração velha, ou `*` no meio da chave, que não é curinga). */
export function semUso(modelo: unknown, inv: Inventario): string[] {
  const todas = folhas(modelo).map((f) => f.caminho)
  return Object.keys(inv).filter((chave) => {
    const prefixo = prefixoDoCuringa(chave)
    return prefixo === null ? !todas.includes(chave) : !todas.some((c) => c.startsWith(prefixo))
  })
}

// ───────────────────────── origem de célula: caminho concreto, com índice
export type Passo = { chave: string } | { indice: number | null }

/** 'pack.canais[2].numeros.mediana' em passos. A primeira palavra ('pack') é só o nome da raiz e não entra. */
export function passosDaOrigem(origem: string): Passo[] {
  const dentro = /^[^.[]*/.exec(origem)?.[0].length ?? 0
  const resto = origem.slice(dentro).replace(/^\./, '')
  const passos: Passo[] = []
  for (const m of resto.matchAll(/([^.[\]]+)|\[(\d*)\]/g)) {
    if (m[1] !== undefined) passos.push({ chave: m[1] })
    else passos.push({ indice: m[2] === '' ? null : Number(m[2]) })
  }
  return passos
}

/** O caminho generalizado (sem índices) que casa com as chaves do inventário. */
export const generalizar = (passos: readonly Passo[]): string =>
  passos.reduce((c, p) => ('chave' in p ? juntar(c, p.chave) : `${c}[]`), '')

/** Segue a origem no modelo. `semIndice` marca origem que cruza uma lista sem dizer a posição. */
export function resolverOrigem(modelo: unknown, origem: string): { existe: boolean; valor: ValorDeFolha | undefined; semIndice: boolean; indices: number[] } {
  const passos = passosDaOrigem(origem)
  let atual: unknown = modelo
  let semIndice = false
  const indices: number[] = []
  let existe = true
  for (const p of passos) {
    if ('chave' in p) {
      if (atual === null || typeof atual !== 'object' || Array.isArray(atual) || !Object.prototype.hasOwnProperty.call(atual, p.chave)) { existe = false; break }
      atual = (atual as Record<string, unknown>)[p.chave]
    } else if (p.indice === null) {
      semIndice = true
      existe = false
      break
    } else {
      if (!Array.isArray(atual) || p.indice >= atual.length) { existe = false; break }
      indices.push(p.indice)
      atual = atual[p.indice]
    }
  }
  const folha = existe && (atual === null || ['string', 'number', 'boolean'].includes(typeof atual))
  return { existe: folha, valor: folha ? (atual as ValorDeFolha) : undefined, semIndice, indices }
}
