/**
 * Roda `fn` sobre `itens` com no máximo `limite` em voo. `deveParar` é consultado ANTES de iniciar cada item:
 * quando devolve true, ninguém mais começa (os que já estão em voo terminam) e o resto conta em `adiados`.
 * `feitos` guarda os resultados na ordem dos itens iniciados. Rejeição de `fn` rejeita a chamada: quem não quer isso
 * trata o erro dentro de `fn`.
 */
export async function emParalelo<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (t: T) => Promise<R>,
  deveParar?: () => boolean,
): Promise<{ feitos: R[]; adiados: number }> {
  const resultados: Array<{ r: R } | undefined> = new Array(itens.length)
  let proximo = 0
  let parou = false
  const trabalhador = async (): Promise<void> => {
    while (!parou && proximo < itens.length) {
      if (deveParar?.()) { parou = true; return }
      const i = proximo++
      resultados[i] = { r: await fn(itens[i] as T) }
    }
  }
  const n = Math.max(1, Math.min(Math.floor(limite) || 1, itens.length))
  await Promise.all(Array.from({ length: itens.length === 0 ? 0 : n }, () => trabalhador()))
  const feitos = resultados.flatMap((x) => (x ? [x.r] : []))
  return { feitos, adiados: itens.length - feitos.length }
}
