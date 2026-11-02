// Observatório — quanto cada etapa de uma abertura de tela levou. Página em streaming não define cabeçalho, então não há Server-Timing:
// a página cria a medição, e o `after()` dela grava UMA linha JSON no log da Vercel quando a resposta termina.
// A linha só leva nomes de etapa e números: nenhum id, canal ou dado de pessoa.
import { AsyncLocalStorage } from 'node:async_hooks'
import { after } from 'next/server'

export interface MedicaoDaAbertura {
  tela: string
  inicio: number
  /** ms somados por etapa. Etapas correm em paralelo: a soma pode passar do total. */
  etapas: Record<string, number>
  /** Quantas leituras do banco o cache não evitou, por tipo. Inclui recálculo por trás de entrada velha, que ninguém espera. */
  frios: Record<string, number>
}

const atual = new AsyncLocalStorage<MedicaoDaAbertura>()

export function novaMedicao(tela: string): MedicaoDaAbertura {
  return { tela, inicio: performance.now(), etapas: {}, frios: {} }
}

/** Tudo o que `f` chamar, mesmo em espera, soma nesta medição. Fora dela, `medirEtapa` e `contarFrio` não fazem nada. */
export function comMedicao<T>(m: MedicaoDaAbertura, f: () => Promise<T>): Promise<T> {
  return atual.run(m, f)
}

/** `m` explícito serve a quem renderiza fora de `comMedicao` (o chrome). Uma etapa que lança conta o tempo e deixa o erro passar. */
export async function medirEtapa<T>(nome: string, f: () => Promise<T>, m: MedicaoDaAbertura | undefined = atual.getStore()): Promise<T> {
  if (!m) return f()
  const inicio = performance.now()
  try {
    return await f()
  } finally {
    m.etapas[nome] = (m.etapas[nome] ?? 0) + (performance.now() - inicio)
  }
}

export function contarFrio(nome: string): void {
  const m = atual.getStore()
  if (m) m.frios[nome] = (m.frios[nome] ?? 0) + 1
}

/** A linha do log. Procurar por `obs-abertura`. */
export function linhaDaMedicao(m: MedicaoDaAbertura): string {
  const etapas = Object.fromEntries(Object.entries(m.etapas).map(([k, v]) => [k, Math.round(v)]))
  return JSON.stringify({ evento: 'obs-abertura', tela: m.tela, total_ms: Math.round(performance.now() - m.inicio), etapas, frios: m.frios })
}

/** Grava a linha quando a resposta terminar. `after` lança fora de uma requisição: medir nunca derruba a tela. */
export function gravarAoFim(m: MedicaoDaAbertura): void {
  try { after(() => { console.info(linhaDaMedicao(m)) }) } catch { /* sem requisição não há o que gravar */ }
}
