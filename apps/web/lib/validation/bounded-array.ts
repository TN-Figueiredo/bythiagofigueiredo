import { z } from 'zod'

/**
 * GHSA-mrhx-c7xc-m3w5: zod < 4.6.6 acumula 1 issue por elemento inválido, sem
 * teto (1,5 M elementos = ~640 MB). A guarda confere o tamanho ANTES do zod
 * olhar os elementos, então o pior caso é 1 issue e O(1) de memória.
 */
export function boundedArray<T extends z.ZodTypeAny>(item: T, max: number) {
  return z
    .custom<unknown[]>((v) => Array.isArray(v) && v.length <= max, {
      message: `Expected an array with at most ${max} items`,
    })
    .pipe(z.array(item).max(max))
}

/** Igual a `boundedArray`, para `z.record` (conta as chaves antes do zod). */
export function boundedRecord<K extends z.ZodTypeAny, V extends z.ZodTypeAny>(
  key: K,
  value: V,
  max: number,
) {
  return z
    .custom<Record<string, unknown>>(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        !Array.isArray(v) &&
        Object.keys(v).length <= max,
      { message: `Expected an object with at most ${max} keys` },
    )
    .pipe(z.record(key, value))
}

/** Mensagem de erro para o cliente: no máximo 5 issues. */
export function limitedZodMessage(err: z.ZodError, limit = 5): string {
  return err.issues.slice(0, limit).map((i) => i.message).join(', ') || 'Validation failed'
}
