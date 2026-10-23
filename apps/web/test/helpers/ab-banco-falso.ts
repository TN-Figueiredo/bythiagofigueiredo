// Banco falso mínimo por Proxy (S8-F2 T5b, reaproveitado na T6): `from(tabela)` devolve uma cadeia que aceita qualquer
// método fluente e, ao ser aguardada, entrega as linhas semeadas daquela tabela. `single`/`maybeSingle` entregam a
// primeira linha (ou null). `insert`/`upsert`/`update` ficam registrados em `chamadas`, e `insert(...).select().single()`
// devolve `{ id: 'novo' }`.
export interface ChamadaGravacao { tabela: string; metodo: 'insert' | 'upsert' | 'update'; args: unknown[] }

export function bancoFalso(sementes: Record<string, unknown[]>) {
  const chamadas: ChamadaGravacao[] = []
  const client = {
    chamadas,
    from(tabela: string) {
      const linhas = sementes[tabela] ?? []
      let gravou = false
      const cadeia: unknown = new Proxy({}, {
        get(_alvo, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve({ data: gravou ? null : linhas, error: null }).then(resolve, reject)
          }
          if (prop === 'single' || prop === 'maybeSingle') {
            return () => Promise.resolve({ data: gravou ? { id: 'novo' } : (linhas[0] ?? null), error: null })
          }
          if (prop === 'insert' || prop === 'upsert' || prop === 'update') {
            return (...args: unknown[]) => { gravou = true; chamadas.push({ tabela, metodo: prop, args }); return cadeia }
          }
          return () => cadeia
        },
      })
      return cadeia
    },
  }
  return client
}
