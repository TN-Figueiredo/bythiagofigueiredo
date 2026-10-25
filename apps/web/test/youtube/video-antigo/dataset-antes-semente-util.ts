// Normalização e hash do retrato da semente (M10a, Tarefa 0), extraídos para a Tarefa 12 importar sem rodar o describe.
import { createHash } from 'node:crypto'
import path from 'node:path'

export const GOLDEN_SEMENTE = path.resolve(__dirname, '__golden__/dataset-antes-semente.json')

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/** Os ids da semente nascem do site de cada execução (uuid v5) e a cor do canal nasce do id: tira os dois e fica o resto, byte a byte. */
export function normalizar(ds: unknown): string {
  const limpo = (x: unknown): string => JSON.stringify(x, (k, v) => (k === 'color' ? undefined : v)).replace(UUID, '<UUID>')
  // a ordem das listas segue o id, que muda por site: compara como conjunto (cada lista ordenada pelo próprio texto)
  const canon = (x: unknown): unknown => Array.isArray(x)
    ? x.map(canon).map(e => [limpo(e), e] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(e => e[1])
    : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, canon(v)])) : x
  return limpo(canon(ds))
}

/** O arquivo guarda o hash (o texto passa de 5 MB) e a contagem de cada lista de topo. */
export function retrato(ds: Record<string, unknown>): { sha256: string; bytes: number; listas: Record<string, number> } {
  const texto = normalizar(ds)
  const listas: Record<string, number> = {}
  for (const [k, v] of Object.entries(ds)) if (Array.isArray(v)) listas[k] = v.length
  return { sha256: createHash('sha256').update(texto).digest('hex'), bytes: texto.length, listas }
}

