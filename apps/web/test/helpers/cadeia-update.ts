// Cadeia de `update(...)` do PostgREST para dublês encadeados (P4a T9): aceita `.eq/.is` em qualquer ordem,
// vira promessa quando aguardada e, com `.select(...)`, devolve as linhas "reivindicadas".
import { vi } from 'vitest'

export interface FiltroRegistrado { col: string; op: 'eq' | 'is'; valor: unknown }

export function cadeiaUpdate(
  dados: unknown,
  opcoes: { reivindicadas?: Array<{ restore_seq: number }>; registrar?: (r: { data: unknown; filtros: FiltroRegistrado[] }) => void } = {},
) {
  const filtros: FiltroRegistrado[] = []
  const resolvida = Promise.resolve({ data: null, error: null })
  const cadeia: Record<string, unknown> = {
    eq: vi.fn((col: string, valor: unknown) => { filtros.push({ col, op: 'eq', valor }); return cadeia }),
    is: vi.fn((col: string, valor: unknown) => { filtros.push({ col, op: 'is', valor }); return cadeia }),
    select: vi.fn(() => Promise.resolve({ data: opcoes.reivindicadas ?? [{ restore_seq: 1 }], error: null })),
    then: resolvida.then.bind(resolvida),
    catch: resolvida.catch.bind(resolvida),
  }
  opcoes.registrar?.({ data: dados, filtros })
  return cadeia
}
