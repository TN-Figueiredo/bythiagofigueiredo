/**
 * A5 · E17 passo 0: o auxiliar que aplica a MG11 (o direito "ver desempenho privado") DENTRO da transação que o teste abriu.
 *
 * O arquivo é procurado nesta ordem: o de `supabase/migrations/` cujo nome termina em
 * `_observatorio_a5_e17_direito_desempenho_privado.sql` (existe depois da Tarefa 1b) e, se não houver,
 * `test/fixtures/sql/a5-e17-p0-mg11.sql`. Os dois são versionados, então a CI os enxerga antes e depois da 1b.
 *
 * O auxiliar EXECUTA o arquivo sempre (ele é idempotente e o teste termina em `rollback`): com a rodada 0, um banco que já
 * tivesse a MG11 de uma versão anterior deixaria os testes verdes contra o SQL velho. Como `create table if not exists` não
 * conserta tabela de forma antiga, ele CONFERE a forma depois e LANÇA se o banco tem outra versão. Sem arquivo nenhum, lança
 * (nunca pula).
 */
import type { Client } from 'pg'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SUFIXO_DA_MIGRATION = '_observatorio_a5_e17_direito_desempenho_privado.sql'
const RAIZ = resolve(__dirname, '..', '..', '..', '..')
const DA_MIGRATION = join(RAIZ, 'supabase', 'migrations')
const DE_ENSAIO = resolve(__dirname, '..', 'fixtures', 'sql', 'a5-e17-p0-mg11.sql')

const COLUNAS_ESPERADAS = ['site_id', 'user_id', 'granted_by', 'granted_at', 'revoked_at', 'revoked_by']

/** Caminho do SQL da MG11 que vale hoje, ou lança se nenhum dos dois existir. */
export function caminhoDaMg11(): string {
  if (existsSync(DA_MIGRATION)) {
    const achado = readdirSync(DA_MIGRATION).filter((f) => f.endsWith(SUFIXO_DA_MIGRATION)).sort()
    if (achado.length > 0) return join(DA_MIGRATION, achado[achado.length - 1])
  }
  if (existsSync(DE_ENSAIO)) return DE_ENSAIO
  throw new Error(`MG11: nenhum arquivo de SQL encontrado (nem ${DA_MIGRATION}/*${SUFIXO_DA_MIGRATION}, nem ${DE_ENSAIO})`)
}

/**
 * O SQL roda dentro da transação do teste: um `begin;`/`commit;`/`rollback;` de nível raiz fecharia essa transação e
 * PERSISTIRIA a MG11 no banco de teste. Bloco plpgsql (`begin` sem ponto e vírgula na linha) não casa.
 */
export function recusarTransacaoNaRaiz(sql: string): void {
  const achado = /^\s*(begin|commit|rollback|start\s+transaction)\b[^;\n]*;/im.exec(sql)
  if (achado) {
    throw new Error(`MG11: o SQL tem "${achado[0].trim()}" de nível raiz; o auxiliar roda dentro da transação do teste e isso persistiria a MG11 no banco`)
  }
}

export function lerSqlDaMg11(): string {
  return readFileSync(caminhoDaMg11(), 'utf8')
}

/**
 * Aplica a MG11 na transação aberta por quem chama. Devolve `ja_aplicada` se `site_private_viewers` já existia antes
 * (nesta transação ou no banco), ou `aplicada_na_transacao`.
 *
 * `conferirForma: false` desliga SÓ a conferência de forma e existe para um uso: a rodada de mutação (f) da Tarefa 2, numa
 * cópia de trabalho que NÃO é commitada. Nenhum teste commitado passa `false` (o teste de schema afirma isso).
 */
export async function garantirMg11(pg: Client, opcoes: { conferirForma?: boolean } = {}): Promise<'ja_aplicada' | 'aplicada_na_transacao'> {
  const conferirForma = opcoes.conferirForma ?? true
  const antes = await pg.query<{ existe: boolean }>(`select to_regclass('public.site_private_viewers') is not null as existe`)
  const estado = antes.rows[0].existe ? 'ja_aplicada' : 'aplicada_na_transacao'
  const sql = lerSqlDaMg11()
  recusarTransacaoNaRaiz(sql)
  await pg.query(sql)
  if (conferirForma) await conferirFormaDaMg11(pg)
  return estado
}

async function conferirFormaDaMg11(pg: Client): Promise<void> {
  const outra = 'o banco tem outra versão da MG11'
  const colunas = await pg.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'site_private_viewers' order by ordinal_position`,
  )
  const nomes = colunas.rows.map((c) => c.column_name)
  if (nomes.join(',') !== COLUNAS_ESPERADAS.join(',')) {
    throw new Error(`${outra}: site_private_viewers tem as colunas (${nomes.join(', ')}), esperado (${COLUNAS_ESPERADAS.join(', ')})`)
  }
  const gatilho = await pg.query<{ def: string }>(
    `select pg_get_triggerdef(oid) as def from pg_trigger where tgrelid = 'public.site_private_viewers'::regclass and tgname = 'audit_site_private_viewers' and not tgisinternal`,
  )
  if (gatilho.rows.length !== 1 || !gatilho.rows[0].def.includes('UPDATE OF revoked_at')) {
    throw new Error(`${outra}: o gatilho audit_site_private_viewers não dispara só em "update of revoked_at"`)
  }
  const trava = await pg.query<{ n: number }>(
    `select count(*)::int as n from pg_constraint where conrelid = 'public.site_private_viewers'::regclass and conname = 'site_private_viewers_revoked_by_so_retirada'`,
  )
  if (trava.rows[0].n !== 1) {
    throw new Error(`${outra}: falta o check site_private_viewers_revoked_by_so_retirada`)
  }
  // (controlador 14/10) as peças do degrau 2 que entram na mesma migration
  const pecas = await pg.query<{ n: number }>(
    `select (select count(*) from pg_constraint where conrelid = 'public.pipeline_api_keys'::regclass and conname in ('pipeline_api_keys_expires_at_finita', 'pipeline_api_keys_perfil_exige_validade'))::int
          + (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'obs_ai_access_log' and indexname = 'idx_oaal_at')::int as n`,
  )
  if (pecas.rows[0].n !== 3) {
    throw new Error(`${outra}: faltam o índice idx_oaal_at ou os checks de validade de pipeline_api_keys`)
  }
}
