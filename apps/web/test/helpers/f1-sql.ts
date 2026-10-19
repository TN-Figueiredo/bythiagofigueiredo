/**
 * A5 · F1 do Remover canal: localização e leitura do texto da migration (sem importar `mg6.ts`, que importa este arquivo).
 * Os testes de integração reaplicam a MG6 DENTRO da transação (o que recria o registro e a remoção arquivada antigos); em seguida a F1,
 * para o registro voltar a ter 30 entradas e a remoção arquivada voltar a apagar a watch.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))

export function caminhoDaF1(): string | null {
  const achados = readdirSync(MIGRATIONS).filter(n => n.endsWith('_observatorio_a5_remover_canal_f1.sql'))
  if (achados.length === 0) return null
  if (achados.length > 1) throw new Error(`esperava 1 migration da F1, achei ${achados.length}`)
  return MIGRATIONS + achados[0]
}

export function lerSqlDaF1(): string | null {
  const c = caminhoDaF1()
  return c === null ? null : readFileSync(c, 'utf8')
}
