import { z } from 'zod'

export const MAX_IDS_FILTRO = 20
const MAX_ENTRADA = 2000 // 20 uuids + vírgulas cabem em ~740; o resto é lixo

const uuid = z.string().uuid()

/** ids de `?ids=`: uuids válidos, únicos, no máximo 20; nenhum → null. */
export function lerFiltroDeIds(v: unknown): string[] | null {
  if (typeof v !== 'string' || v.length === 0) return null
  const vistos = new Set<string>()
  for (const bruto of v.slice(0, MAX_ENTRADA).split(',')) {
    const r = uuid.safeParse(bruto)
    if (r.success) vistos.add(r.data.toLowerCase())
    if (vistos.size >= MAX_IDS_FILTRO) break
  }
  return vistos.size > 0 ? [...vistos] : null
}

const totalSchema = z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(1).max(10000))

/** `?total=`: inteiro 1–10000, senão null. */
export function lerTotal(v: unknown): number | null {
  const r = totalSchema.safeParse(v)
  return r.success ? r.data : null
}

export interface DadosFaixa {
  mostrados: number
  total: number
}

export function montarFaixa(ids: string[] | null, total: number | null, encontrados: number): DadosFaixa | null {
  if (!ids) return null
  return { mostrados: encontrados, total: Math.max(total ?? ids.length, ids.length) }
}
