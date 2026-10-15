/**
 * A5 · E17 degrau 1, Tarefa 9 (emenda 1: S-I2): como o teste de integração do registro convive com a CI ENQUANTO a MG11 não está em
 * `supabase/migrations/`. Regra: tabela presente = roda; ausente E o nome na lista = pula (com aviso no log); ausente e fora da lista = LANÇA.
 * A decisão é tomada na COLETA do arquivo (valor síncrono para `describe.skipIf`), nunca no `beforeAll`.
 * A lista é esvaziada no commit do lote C que traz o arquivo da MG11 (ou, no mais tardar, no do envio): lista vazia e tabela ausente é falha.
 */
import type { Client } from 'pg'

// Esvaziada: a MG11 já está em supabase/migrations/ (20261014000003), então a CI constrói o banco com a tabela e o teste do registro RODA.
export const ESPERA_A_MG11: readonly string[] = []

export async function situacaoDaTabela(pg: Pick<Client, 'query'>, nome: string, lista: readonly string[] = ESPERA_A_MG11): Promise<'roda' | 'pula'> {
  const r = await pg.query<{ existe: string | null }>('select to_regclass($1)::text as existe', ['public.' + nome])
  if (r.rows[0]?.existe) return 'roda'
  if (lista.includes(nome)) {
    console.warn('PULADO: ' + nome + ' ainda não existe (MG11, lote C)')
    return 'pula'
  }
  throw new Error(`a tabela ${nome} não existe e não está na lista de espera da MG11: o teste de integração não pode pular em silêncio`)
}
