# Manutenção NAS, etapa M2 (partições): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** as três séries de vídeo de concorrente (`competitor_video_daily`, `competitor_video_early`, `competitor_video_hourly`) passam a tabelas particionadas por mês de São Paulo, com as partições no schema `obs_part`, 12 meses à frente criados por uma tarefa diária da agenda (`particoes_a_frente`) e vigiados pelo invariante "meses à frente"; nasce a tabela de ensaio `obs_archive_rehearsal`; e um teste sem banco lê as migrations e segura os pedidos 1, 3, 5 e 13 da seção 17.

**Architecture:** uma migration (`*_manutencao_m2_particoes.sql`, escrita até o dia do push como rascunho em `supabase/rascunhos/m2.sql`, fora da pasta que o `db push` lê: TRAVA M2-1) cria o schema `obs_part`, funções internas nele (nome, limites, criação de partição, assinatura do catálogo, lista de dependentes, conversor genérico), as duas funções públicas que a aplicação chama (`obs_partitions_ensure`, `obs_partitions_months_ahead`), a tabela de ensaio e o registro da conversão; depois converte as três tabelas num único bloco `do` (uma transação: copia, confere contagem e soma de `views`, compara a assinatura do catálogo antes e depois, ou desfaz tudo). No site, uma tarefa leve e `nuncaDesliga` da agenda chama `obs_partitions_ensure`, e o relatório de saúde dos crons (o vigia) ganha o item `agenda:particoes_meses_a_frente`, amarelo abaixo de 6 e vermelho abaixo de 3. Até o sétimo dia, `obs_part.desfazer` é a volta atrás (só o dono, pelo SQL do painel). Sete dias depois, uma segunda migration remove as tabelas antigas.

**Tech Stack:** PostgreSQL 17 (Supabase), PL/pgSQL, Next.js 16 (rotas da agenda e do vigia), TypeScript strict, Vitest, `pg` e `@supabase/supabase-js` nos testes de integração.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` — `02` §10.2 (partições) e §10.3 (política por tabela); `03` §13.3 (tabela de ensaio); `05` §15.1 (linha M2), §16.3 (comandos do dono) e §17 (pedidos 1, 3, 5, 6 e 13); `06` §18 itens 7 a 15, 71 a 73 e 119. O `00` §3 (decisões D1 a D27) vale como lei.

## Global Constraints

- Migration nova só por `npm run db:new <nome>`, e **só no dia do push** (Tarefa 8, Step 0). Até lá o SQL vive em `supabase/rascunhos/m2.sql` (rastreado pelo git; o CLI do Supabase só lê `supabase/migrations/` e `supabase/seeds/dev.sql`, `supabase/config.toml:25-29`), fora da pasta que o `db push` lê (o mesmo padrão da M10a e da MG6 da E10). Nomes no dia: `manutencao_m2_particoes` (e, no sétimo dia, `manutencao_m2_remove_antigas`). **Toda migration desta fase leva `_manutencao_` no nome** (o teste da Tarefa 1 identifica as migrations da fase por isso; a M10a segue a mesma regra).
- Idempotência: `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`, `create ... if not exists`, `create or replace function`; a conversão sai sem fazer nada se a tabela já é particionada.
- Limites de partição: **meia-noite de São Paulo do dia 1**; na diária (`date`) o limite é a data; nas outras duas (`timestamptz`) o limite é escrito com `-03` explícito (`'2026-11-01 00:00:00-03'`), nunca dependente do fuso da sessão.
- Faixa da conversão: do mês de `min(coluna)` (tabela vazia: o mês corrente) até 12 meses à frente. **Sem partição `DEFAULT`.**
- Partições moram em `obs_part`, com RLS ligada e `revoke all` de `public`, `anon`, `authenticated` e `service_role`, feitos pela função que cria.
- Funções que criam partição: `security definer`, `search_path` vazio, nomes por `format('%I')`; o nome da partição é derivado de tabela e mês (`<tabela>_<AAAAMM>`), nunca vem de quem chama.
- Funções novas em `public`: `revoke all ... from public, anon, authenticated` e `grant execute ... to service_role` só onde a aplicação chama. **Neste Postgres local, chamar função sem `EXECUTE` como `anon`/`authenticated` derruba o servidor (SIGSEGV): permissão se testa com `has_function_privilege`, nunca chamando.**
- Invariante "meses à frente": amarelo abaixo de 6, vermelho abaixo de 3; função ausente ou leitura que falha: vermelho; tarefa parada há mais de 72 h: vermelho. Vale sem a E10.
- Janela de `db:push:prod`: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40. Todo push é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), arquivos em série (`--no-file-parallelism`). Os testes que precisam da conversão **confirmada** no banco (Tarefa 5) pulam enquanto `M2_EM_MIGRATION` for `false` e a conversão não existir no banco (`m2NoBanco()`), como `M10A_EM_MIGRATION` na M10a; os outros aplicam o rascunho dentro de `begin … rollback`.
- **Banco compartilhado:** nenhum passo converte de vez as três séries do `bythiago_int` antes de a semente do passado estar lá. A conversão confirmada só acontece na Tarefa 5, Step 1, no mesmo comando que roda a semente; antes disso, o que se confirma no banco é só a parte 1 (`aplicarM2SoFuncoes`, funções em `obs_part`, nenhuma tabela real tocada).
- TypeScript strict, sem `any`; arquivos em kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito, no `staging`; nunca `git add -A`, stash ou reset. **Arquivo novo:** `git add -- <caminhos>` antes de todo `git commit -- <caminhos>` (o commit por caminho não leva arquivo não rastreado).
- `.superpowers/` é ignorado pelo git: ledger, LEIAME e saídas ficam só no disco, nunca em `git add`/`git commit` (um caminho ignorado faz o commit falhar inteiro). O que teste ou CI precisa ler vive em caminho rastreado.
- O sistema falha em VERDE: cada passo diz o que acontece quando o dado não existe antes do que acontece quando dá erro.

## Travas e ordem de execução

- **TRAVA M2-1:** nenhum arquivo `*_manutencao_m2_*` em `supabase/migrations/` (nem não commitado: o `db push` lê o disco, não o git) antes da Tarefa 8, Step 0. Até lá o SQL vive em `supabase/rascunhos/m2.sql` e os testes o leem por `M2_SQL_CAMINHO` (um só lugar, `apps/web/test/helpers/m2.ts`). O teste `migrations-leitura.test.ts` (Tarefa 2) segura a trava. Motivo: um `db:push:prod` de qualquer outra trilha levaria a M2 pela metade, e o Supabase nunca mais rodaria o arquivo (controla por versão, não por conteúdo); outra trilha que criasse migration depois do `<ts>` e fizesse push primeiro deixaria a M2 "out of order".
- **TRAVA M2-2:** nenhuma linha das Tarefas 6 e 7 (nem na árvore sem commit: outra trilha que commita o mesmo arquivo por caminho levaria o trabalho junto) antes de a migration da M2 estar aplicada em produção e conferida (Tarefa 8, Step 3, linha "TRAVA M2-2 solta em <data hora>" no ledger). Motivo: com o código no `staging`, a promoção de qualquer outra frente leva a tarefa e o item do vigia a produção antes da função; o vigia fica vermelho (`down`) e a tarefa termina `erro funcao_ausente` até o push.
- **Ordem de execução:** Tarefa 1 → 2 → 3 → 4 → 5 → **8** (a vez da migration, push e conferência) → 6 → 7 → promoção → 9 (sétimo dia). A numeração das tarefas não muda (a M10a cita a "Tarefa 8, Step 3" deste plano).
- Dívida declarada: entre as Tarefas 2 e 8 o SQL só é provado no banco local de quem o escreve (na CI os testes que precisam da conversão confirmada pulam). Gatilho de pagamento: Tarefa 8, Step 0.

## Review Focus

1. **Gravação em voo durante a troca.** Um `upsert` da coleta que espera a trava da tabela antiga tem de cair na tabela nova depois do `commit` (o Postgres reabre o nome depois de esperar a trava), nunca na `_antiga`. Coberto na Tarefa 2, passo de concorrência, com gravador em outra conexão.
2. **A hora da virada do mês.** `hour_slot = 2026-11-01 02:00 UTC` é 23:00 de 31/10 em São Paulo e tem de cair na partição de outubro, nunca na de novembro. Coberto na Tarefa 3.
3. **A tarefa rodando antes da migration.** `obs_partitions_ensure` ausente ou tabela ainda não particionada: a tarefa termina `erro` com motivo próprio, nunca `ok`. Coberto nas Tarefas 3 (banco) e 6 (tarefa).
4. **O vigia sem dado.** Função ausente, resposta vazia, tabela fora da resposta, mês corrente sem partição (`months_ahead = -1`) e tarefa nunca rodada há mais de 72 h desde a conversão: vermelho em todos. Coberto na Tarefa 7.
5. **A tabela antiga exposta pela API nos 7 dias.** `competitor_video_daily_antiga` e as outras duas ficam em `public`; a conversão revoga tudo delas de `anon`, `authenticated` e `service_role`. Coberto na Tarefa 2.
6. **A volta atrás dos 7 dias.** `obs_part.desfazer` devolve a tabela comum com o conteúdo atual, as FKs e as concessões de antes, conferida pela assinatura. Coberto na Tarefa 2.

---

## Fatos conferidos antes de desenhar (com arquivo e linha)

| Fato | Onde |
|---|---|
| `competitor_video_daily`: PK `(video_id, snap_date)`, FK `video_id → competitor_videos(id) on delete cascade`, índice `idx_cvd_date (snap_date)`, policy `competitor_video_daily_select` com `exists` em `competitor_videos` e `competitor_channels` | `supabase/migrations/20261003000002_observatorio_versoes.sql:31-40`, `:58-62` |
| `competitor_video_early`: PK `(video_id, taken_at)`, FKs para `competitor_videos` e `sites` (cascade), policy `can_view_site(site_id)`, **sem índice além da PK** | `supabase/migrations/20261012000003_observatorio_a5_e2_serie_faixas.sql:31-43` |
| `competitor_video_hourly`: PK `(video_id, hour_slot)`, FKs para `competitor_videos` e `sites`, `check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC')` (nome `competitor_video_hourly_check`), índice `idx_cvh_slot (hour_slot)`, policy `can_view_site(site_id)` | `supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:10-21`, `:71-75` |
| As três PKs já contêm a coluna de tempo: nenhuma muda para particionar | idem |
| No `bythiago_int` (14/10): sem gatilho nas três; concessões = as padrão do Supabase (`anon`, `authenticated`, `service_role` com tudo); sem comentário de tabela; sem publicação; `pg_depend` só acusa as policies da própria tabela; `obs_part` não existe | MEDIDO (consulta ao catálogo, 54422) |
| Partição em `obs_part` com `revoke all` de todos, sem `usage` no schema: `service_role` lê e grava pela mãe, `authenticated` e `anon` leem pela mãe (RLS da mãe vale); a chave estrangeira herdada aparece na partição com `conparentid <> 0`; `insert` em mês sem partição falha com `SQLSTATE 23514`, "no partition of relation … found for row" | MEDIDO no 54422 dentro de `begin … rollback` |
| `pg_get_indexdef` de índice de tabela particionada traz `ON ONLY`; `pg_get_constraintdef` é idêntico | MEDIDO |
| Quem grava: diária em `competitor-sync.ts:862` e `:1251` (`onConflict: 'video_id,snap_date'`); `early` em `competitor-sync.ts:1179` e `horaria/gravar.ts:309`, `:340` (`'video_id,taken_at'`); `hourly` em `horaria/gravar.ts:300` (`'video_id,hour_slot'`). Nenhum `on conflict on constraint`. O pedido 6 já está cumprido no código de hoje | `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/src/lib/youtube/horaria/gravar.ts` |
| Falha de gravação: a horária devolve `fim: 'falhou'` (`gravar.ts:258-265`), e a tarefa termina `erro` com `gravacao_falhou` (`horaria/executar.ts:211`); a diária lança (`fail`, `competitor-sync.ts:512-514`); a `early` acumula em `lateFailure` e lança no fim (`:517-521`). Nenhum dos três diz "ok" | idem |
| Leitura embutida que tem de continuar funcionando: `competitor_video_daily … competitor_videos!inner(competitor_channels!inner(site_id))` | `apps/web/src/lib/youtube/observatorio/load.ts:484`, `:606` |
| `OBS_HOURLY_RAW_PURGE`: nenhum código lê hoje | `grep` em `apps`, `packages`, `supabase`, `scripts` |
| E10: a MG6 **não é migration ainda**; a fonte é o Apêndice A do plano da E10 (`2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md:44`, `:79`) e a cópia de teste vive em `apps/web/test/fixtures/sql/a5-e10-mg6.sql` (3 commits da E10 em 14/10: arquivo em edição ativa; a M2 não o edita). `obs_archive_uncovered` (`:388`) **sem** `relispartition`; `obs_db_size_record` (`:140`) só `relkind = 'r'` em `public`. md5 do `prosrc` instalado a partir dela: `obs_archive_uncovered` = `04acb555daf84c61933b740e13a85e21`, `obs_db_size_record` = `3b6daeff58c7e884d8b6e944c8e234a7` | MEDIDO (fixture aplicada em `begin … rollback` no 54422) |
| Testes da E10 afirmam `obs_archive_uncovered() = '{}'` (`observatorio-a5-e10-migration.test.ts:82`, `:628`, `:704`): **quebram depois da M2** se a fixture não ganhar a cláusula do pedido 1. E `:340` grava `current_date + 400` na diária: depois da M2 só há partição até 12 meses à frente (`23514`) | arquivo citado |
| `supabase db push` embrulha o arquivo inteiro numa transação: CLI 2.98.2 (a do repositório), banco descartável no 54422, `create table` seguido de `select 1/0` → `DbPushApplyError … At statement: 2`, tabela ausente e nenhuma versão registrada | MEDIDO (Phil, 14/10) |
| `CREATE TABLE … PARTITION OF` pega `AccessExclusiveLock` na mãe e `ShareRowExclusive` em `competitor_videos` e `sites` (pela FK herdada); partição vazia com PK e um índice ocupa 16.384 bytes | MEDIDO (Phil, 14/10, PG 17.11) |
| `obs_part.desfazer` (a volta atrás) e o caso "privilégio revogado do dono desfaz com `M2:catalogo_divergente` (detalhe `concessoes`)": rodados num banco descartável no 54422 com o SQL da Tarefa 2; a volta deixa a tabela comum com 30 + 3 linhas, as 4 constraints de antes e a assinatura igual | MEDIDO (14/10) |
| O bloco 11 (recriar as duas funções da E10) com o corpo literal da Tarefa 4: instalados os corpos da fixture de 14/10 (md5 `04acb555…` e `3b6daeff…`), o bloco recria as duas com `relispartition` e `obs_db_size_record` roda | MEDIDO (14/10, banco descartável) |
| CI de integração: `supabase db reset --local` (aplica migrations e `supabase/seeds/dev.sql`) e roda `integration/` em série | `.github/workflows/ci.yml:144-149`; `supabase/config.toml:25-29` |
| 13 arquivos de teste gravam nas três séries, vários em datas passadas (ex.: `current_date - 40` em `test/helpers/mg6.ts:158`): sem partição do passado, quebram na CI | `grep` em `apps/web/test` |
| Agenda: definições em `agenda/definicoes.ts`, catálogo em `agenda/catalogo.ts` (teste compara os dois), `antesDoLoteAntigo` em `agenda/executar.ts:34` (teste exige toda `nuncaDesliga` nela: `test/youtube/agenda/tarefas.test.ts:611`), o vigia em `agenda/saude.ts` e o relatório em `lib/ops/cron-health-report.ts:363-412` (`late` + `severity: 'critical'` dá `down`) | arquivos citados |
| Ordens 3, 4 e 5 da agenda estão reservadas no teste do despachante para `soma_do_mapa`, `tamanho_do_banco` e `podas` (A5) | `test/youtube/agenda/despachante.test.ts:40-42` |

**NÃO VERIFICADO (conferir no dia, antes do push):**
- CP6: em produção, `competitor_video_hourly` e `competitor_video_early` ainda vazias, `min`/`max` das três e a dona das tabelas. A migration funciona em qualquer caso (faixa a partir de `min`); muda só quantos meses de passado nascem. A consulta é o item 1b do LEIAME (Tarefa 8), que o dono roda antes do push.
- A versão do PostgREST de produção embute pela chave de tabela particionada como a local. O teste da Tarefa 5 prova no local; a conferência da Tarefa 8 (item 4, com valor esperado) repete a leitura embutida em produção pela tela do Observatório. Se falhar, não falha em verde: `load.ts:481` lança `ObservatoryLoadError`.
- Se a MG10 (`20261013000001`, agenda) está aplicada em produção (Tarefa 8, Step 1).
- O caminho `duplicate_table` de `obs_part.criar_particao` (dois `ensure` ao mesmo tempo): escrito, compilado, não reproduzido com corrida real.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/rascunhos/m2.sql` (criar à mão na Tarefa 2; `git rm` na Tarefa 8, Step 0) | o rascunho rastreado do SQL até a vez da migration (TRAVA M2-1): schema `obs_part`, funções internas e públicas, a volta atrás, tabela de ensaio, registro da conversão, a recriação condicional das duas funções da E10, a conversão |
| `supabase/migrations/<ts>_manutencao_m2_particoes.sql` (criar na Tarefa 8, Step 0, por `npm run db:new` + cópia do rascunho) | o mesmo SQL, no dia do push |
| `supabase/seeds/dev.sql` (modificar) | 36 meses de partição para trás, só no banco local e na CI |
| `apps/web/test/helpers/migrations.ts` (criar) | ler `supabase/migrations`, achar a última definição de uma função, listar as migrations da fase |
| `apps/web/test/manutencao/migrations-leitura.test.ts` (criar) | itens 15, 71 e 119 (sem banco) |
| `apps/web/test/helpers/m2.ts` (criar) | `M2_SQL_CAMINHO` e `M2_EM_MIGRATION` (o único lugar que a Tarefa 8, Step 0, muda), aplicar o SQL da M2 numa conexão (inteiro ou só a parte 1), `m2NoBanco`, tabela de brinquedo |
| `apps/web/test/integration/manutencao-m2-particoes.test.ts` (criar) | itens 7, 8, 10, 72 (catálogo), 73 e o conversor |
| `apps/web/test/integration/manutencao-m2-e10.test.ts` (criar) | itens 13 e 14 sobre a fixture da E10 |
| `apps/web/test/integration/manutencao-m2-api.test.ts` (criar) | itens 9 (gravação real) e 72 (API e `authenticated`) |
| `.superpowers/sdd/manutencao-nas/entrega-e10-pedidos-1-e-3.md` (criar, só disco) | o texto dos pedidos 1 e 3 e da linha `:340`, entregue à trilha da E10 (a M2 **não** edita a fixture nem o plano da E10) |
| `apps/web/src/lib/youtube/agenda/definicoes.ts` (modificar) | `DEFINICAO_PARTICOES_A_FRENTE`, `DEFINICOES_MANUTENCAO`, `TODAS_AS_DEFINICOES` |
| `apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts` (criar) | a `Tarefa` que chama `obs_partitions_ensure` |
| `apps/web/src/lib/youtube/agenda/catalogo.ts`, `executar.ts` (modificar) | entrada no catálogo e em `antesDoLoteAntigo` |
| `apps/web/src/lib/youtube/agenda/particoes.ts` (criar) | leitura de `obs_partitions_months_ahead` e avaliação do invariante (módulo leve) |
| `apps/web/src/lib/youtube/agenda/saude.ts`, `apps/web/src/lib/ops/cron-health-report.ts` (modificar) | `gravidade` no item, o item do invariante no relatório |
| `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (modificar, só disco) | os comandos do dono no dia, inclusive a volta atrás |
| `supabase/migrations/<ts>_manutencao_m2_remove_antigas.sql` (criar no sétimo dia) | remover as três `_antiga` com guarda de data |

---

### Task 1: o teste que lê as migrations (itens 15, 71 e 119)

**Files:**
- Create: `apps/web/test/helpers/migrations.ts`
- Create: `apps/web/test/manutencao/migrations-leitura.test.ts`

**Interfaces:**
- Produces: `lerMigrations(dir?: string): Migration[]` com `interface Migration { arquivo: string; sql: string }`, em ordem de nome; `ultimaDefinicao(migs: Migration[], funcao: string): { arquivo: string; corpo: string } | null`; `migrationsDaFase(migs: Migration[]): Migration[]` (nome contém `_manutencao_`). A M10a usa as três.

- [ ] **Step 1: Escrever o teste (falha porque o helper não existe)**

```ts
// apps/web/test/manutencao/migrations-leitura.test.ts
// @vitest-environment node
/**
 * Manutenção M2 (spec 06 §18, itens 15, 71 e 119). Sem banco: lê os arquivos.
 * 71: se alguma migration define obs_archive_uncovered ou obs_db_size_record, a ÚLTIMA definição sabe de partição.
 * 119: migration desta fase que cita obs_archive_is_site_admin exige que alguma migration a defina.
 * 15: nenhum código lê OBS_HOURLY_RAW_PURGE (pedido 5).
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { lerMigrations, ultimaDefinicao, migrationsDaFase } from '../helpers/migrations'

const RAIZ = resolve(__dirname, '../../../..')

function pastaFalsa(arquivos: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'm2-migs-'))
  for (const [nome, sql] of Object.entries(arquivos)) writeFileSync(join(d, nome), sql)
  return d
}

export function regra71(dir?: string): string[] {
  const migs = lerMigrations(dir)
  const erros: string[] = []
  const u = ultimaDefinicao(migs, 'obs_archive_uncovered')
  if (u && !/relispartition/.test(u.corpo)) erros.push(`obs_archive_uncovered em ${u.arquivo} sem relispartition (pedido 1)`)
  const s = ultimaDefinicao(migs, 'obs_db_size_record')
  if (s && !/relispartition/.test(s.corpo)) erros.push(`obs_db_size_record em ${s.arquivo} sem relispartition (pedido 3)`)
  if (s && !/relkind\s+in\s*\(\s*'r'\s*,\s*'p'/.test(s.corpo)) erros.push(`obs_db_size_record em ${s.arquivo} sem relkind in ('r','p') (pedido 3)`)
  return erros
}

export function regra119(dir?: string): string[] {
  const migs = lerMigrations(dir)
  const define = migs.some(m => /create\s+(or\s+replace\s+)?function\s+(public\.)?obs_archive_is_site_admin\s*\(/i.test(m.sql))
  if (define) return []
  return migrationsDaFase(migs).filter(m => /obs_archive_is_site_admin/.test(m.sql)).map(m => `${m.arquivo} cita obs_archive_is_site_admin e nenhuma migration a define`)
}

describe('item 71: a última definição das duas funções da E10 sabe de partição', () => {
  it('no repositório', () => { expect(regra71()).toEqual([]) })
  it('pega a definição sem a cláusula', () => {
    const d = pastaFalsa({ '20990101000001_e10.sql': 'create or replace function public.obs_archive_uncovered() returns text[] language sql as $$ select 1 $$;' })
    expect(regra71(d)).toEqual(['obs_archive_uncovered em 20990101000001_e10.sql sem relispartition (pedido 1)'])
  })
  it('vale a ÚLTIMA definição: consertada e depois quebrada acusa', () => {
    const d = pastaFalsa({
      '20990101000001_a.sql': "create or replace function public.obs_db_size_record(p timestamptz) returns jsonb language sql as $$ select 1 where relispartition and relkind in ('r', 'p') $$;",
      '20990101000002_b.sql': "create or replace function public.obs_db_size_record(p timestamptz) returns jsonb language sql as $$ select 1 where relkind = 'r' $$;",
    })
    expect(regra71(d)).toHaveLength(2)
  })
  it('sem definição nenhuma não acusa', () => { expect(regra71(pastaFalsa({ '20990101000001_x.sql': 'select 1;' }))).toEqual([]) })
})

describe('item 119: obs_archive_is_site_admin citada pela fase só se alguma migration a define', () => {
  it('no repositório', () => { expect(regra119()).toEqual([]) })
  it('acusa a migration da fase que cita sem definição', () => {
    const d = pastaFalsa({ '20990101000001_manutencao_m3b.sql': 'select public.obs_archive_is_site_admin(null, null);' })
    expect(regra119(d)).toEqual(['20990101000001_manutencao_m3b.sql cita obs_archive_is_site_admin e nenhuma migration a define'])
  })
  it('migration de fora da fase não conta', () => {
    expect(regra119(pastaFalsa({ '20990101000001_e10.sql': 'select public.obs_archive_is_site_admin(null, null);' }))).toEqual([])
  })
})

describe('item 15: ninguém lê OBS_HOURLY_RAW_PURGE (pedido 5)', () => {
  it('nenhum arquivo de código cita a variável', () => {
    const raizes = ['apps/web/src', 'apps/api/src', 'packages', 'supabase/migrations', 'scripts'].map(p => join(RAIZ, p))
    const achados: string[] = []
    const varrer = (d: string): void => {
      let nomes: string[]
      try { nomes = readdirSync(d) } catch { return }
      for (const n of nomes) {
        if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue
        const p = join(d, n)
        if (statSync(p).isDirectory()) { varrer(p); continue }
        if (!/\.(ts|tsx|js|mjs|cjs|sql|sh|json)$/.test(n)) continue
        if (readFileSync(p, 'utf8').includes('OBS_HOURLY_RAW_PURGE')) achados.push(p.slice(RAIZ.length + 1))
      }
    }
    for (const r of raizes) varrer(r)
    expect(achados).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `apps/web`): `npx vitest run test/manutencao/migrations-leitura.test.ts`
Expected: FAIL, "Failed to resolve import ../helpers/migrations".

- [ ] **Step 3: Escrever o helper**

```ts
// apps/web/test/helpers/migrations.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Migration { arquivo: string; sql: string }

export const PASTA_DAS_MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')

/** Todas as migrations, em ordem de nome (= ordem de aplicação). */
export function lerMigrations(dir: string = PASTA_DAS_MIGRATIONS): Migration[] {
  return readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(arquivo => ({ arquivo, sql: readFileSync(join(dir, arquivo), 'utf8') }))
}

/**
 * A última definição (`create [or replace] function [public.]<funcao>(`) e o texto até o fim do corpo `$$ ... $$`
 * (ou até o fim do arquivo, se o corpo não fechar). Definição dentro de `execute $f$ ... $f$` também conta.
 */
export function ultimaDefinicao(migs: readonly Migration[], funcao: string): { arquivo: string; corpo: string } | null {
  const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${funcao}\\s*\\(`, 'gi')
  let achada: { arquivo: string; corpo: string } | null = null
  for (const m of migs) {
    for (const hit of m.sql.matchAll(re)) {
      const ini = hit.index ?? 0
      const resto = m.sql.slice(ini)
      const abre = resto.search(/\$[a-z_]*\$/i)
      if (abre < 0) { achada = { arquivo: m.arquivo, corpo: resto }; continue }
      const marca = (resto.slice(abre).match(/^\$[a-z_]*\$/i) ?? ['$$'])[0]
      const fecha = resto.indexOf(marca, abre + marca.length)
      achada = { arquivo: m.arquivo, corpo: fecha < 0 ? resto : resto.slice(0, fecha + marca.length) }
    }
  }
  return achada
}

/** As migrations desta fase: o nome leva `_manutencao_` (regra do plano da M2). */
export function migrationsDaFase(migs: readonly Migration[]): Migration[] {
  return migs.filter(m => m.arquivo.includes('_manutencao_'))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/manutencao/migrations-leitura.test.ts`
Expected: PASS (8 testes). Com banco vazio de definições, 71 e 119 passam no repositório; o caso "consertada e depois quebrada" prova que vale a última.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/helpers/migrations.ts apps/web/test/manutencao/migrations-leitura.test.ts
git commit -m "test: lê as migrations e segura os pedidos 1, 3, 5 e 13 da manutenção (M2, itens 15, 71 e 119)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/test/helpers/migrations.ts apps/web/test/manutencao/migrations-leitura.test.ts
```

---

### Task 2: a migration, parte 1 — `obs_part`, as funções internas e o conversor genérico, provados numa tabela de brinquedo

**Files:**
- Create: `supabase/rascunhos/m2.sql` (à mão; **não** é migration: TRAVA M2-1)
- Create: `apps/web/test/helpers/m2.ts`
- Create: `apps/web/test/integration/manutencao-m2-particoes.test.ts`
- Modify: `apps/web/test/manutencao/migrations-leitura.test.ts` (a TRAVA M2-1 como teste)

**TRAVA M2-1:** `npm run db:new` **não** roda aqui; o arquivo em `supabase/migrations/` nasce na Tarefa 8, Step 0.

**Interfaces:**
- Produces (SQL, todas em `obs_part`, `execute` revogado de todos; só o dono da migration e as funções `security definer` chamam):
  - `obs_part.primeiro_dia(p date) returns date` (immutable)
  - `obs_part.mes_corrente_sp() returns date` (stable; 1º dia do mês corrente em São Paulo)
  - `obs_part.nome_da_particao(p_tabela text, p_mes date) returns text` (immutable; `<tabela>_<AAAAMM>`)
  - `obs_part.criar_particao(p_mae regclass, p_mes date) returns boolean` (true = criou; false = já existia anexada; erro se o nome existe e não é partição da mãe)
  - `obs_part.assinatura(p_tabela regclass) returns jsonb` (colunas, constraints, índices, policies, gatilhos, concessões, RLS, comentário, publicações)
  - `obs_part.dependentes(p_tabela regclass) returns text[]` (F7 com `pg_depend`)
  - `obs_part.converter(p_tabela regclass, p_coluna text, p_soma text) returns jsonb` (`{tabela, feito, motivo?, linhas?, soma?, meses?}`)
  - `obs_part.desfazer(p_tabela regclass) returns jsonb` (`{tabela, feito, motivo?, linhas?, particionada_fica_em?}`): a volta atrás dos 7 dias; erros `M2:sem_registro`, `M2:antiga_ausente`, `M2:dependente_novo`, `M2:volta_divergente`
  - `public.obs_partition_conversions (table_name text pk, old_table text, partition_column text, converted_at timestamptz, rows_copied bigint, views_sum numeric, signature jsonb)`
- Produces (TS, em `apps/web/test/helpers/m2.ts`): `M2_SQL_CAMINHO: string`, `M2_EM_MIGRATION: boolean` (os dois, o único lugar que a Tarefa 8, Step 0, muda), `M2_SQL: string`, `aplicarM2(c: Client): Promise<void>`, `MARCA_PARTE_2`, `aplicarM2SoFuncoes(c: Client): Promise<void>`, `m2NoBanco(url?: string): Promise<boolean>`, `criarBrinquedo(c: Client, o?: { gatilhoQueMuda?: boolean; unicoSemTempo?: boolean }): Promise<string>` (nome da tabela), `apagarBrinquedo(c: Client, nome: string): Promise<void>`.

- [ ] **Step 1: Criar o rascunho**

Criar `supabase/rascunhos/m2.sql` (vazio). Conferir: `ls supabase/migrations | grep manutencao_m2` vazio (TRAVA M2-1).

- [ ] **Step 2: Escrever o helper de teste e os testes do conversor (falham: as funções não existem)**

```ts
// apps/web/test/helpers/m2.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

/**
 * O SQL da M2. Até a Tarefa 8, Step 0: o rascunho, fora de supabase/migrations (TRAVA M2-1). No dia, o Step 0 troca estas duas
 * constantes (e só elas) para o arquivo da migration e `true`. Caminho por `__dirname`, nunca pelo `cwd` (muda entre `npm test -w`
 * e `npx vitest` da raiz).
 */
export const M2_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m2.sql')
export const M2_EM_MIGRATION = false
export const M2_SQL: string = readFileSync(M2_SQL_CAMINHO, 'utf8')

/** Aplica o SQL inteiro na conexão (dentro da transação de quem chama, se houver). */
export async function aplicarM2(c: Client): Promise<void> {
  await c.query(M2_SQL)
}

/**
 * Só a parte 1 (obs_part, funções, registro da conversão), sem a tabela de ensaio, sem as funções da E10 e sem a conversão das
 * três séries: segura para confirmar no banco compartilhado. Sem o marcador: se o SQL já converte as séries, falha alto (nunca
 * confirma a conversão por engano); se ainda não converte (Tarefa 2), aplica o que há.
 */
export const MARCA_PARTE_2 = '-- 8. A tabela de ensaio'
export async function aplicarM2SoFuncoes(c: Client): Promise<void> {
  const corte = M2_SQL.indexOf(MARCA_PARTE_2)
  if (corte < 0) {
    if (/obs_part\.converter\('public\.competitor_video_/.test(M2_SQL)) throw new Error(`marcador "${MARCA_PARTE_2}" ausente no SQL da M2`)
    await c.query(M2_SQL)
    return
  }
  await c.query(M2_SQL.slice(0, corte))
}

/** A conversão das três séries está confirmada neste banco (`relkind = 'p'`). Banco fora do ar: false (quem chama já pulou por `skipIfNoLocalDb`). */
export async function m2NoBanco(url: string = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'): Promise<boolean> {
  const c = new Client({ connectionString: url })
  try {
    await c.connect()
    const r = await c.query(`select relkind::text as k from pg_class where oid = to_regclass('public.competitor_video_daily')`)
    return (r.rows[0] as { k?: string } | undefined)?.k === 'p'
  } catch {
    return false
  } finally {
    await c.end().catch(() => undefined)
  }
}

/**
 * Uma tabela com a forma da leitura horária, em `public`, com tudo o que a conversão tem de copiar: PK com a coluna de tempo,
 * duas FKs em cascata, check, índice, policy, RLS, comentário e as concessões padrão. Opcional: gatilho `before insert` que
 * soma 1 a `views` (faz a cópia divergir) e índice único sem a coluna de tempo (proibido em tabela particionada).
 */
export async function criarBrinquedo(c: Client, o: { gatilhoQueMuda?: boolean; unicoSemTempo?: boolean } = {}): Promise<string> {
  const t = 'zz_m2_brinquedo_' + randomUUID().replace(/-/g, '').slice(0, 10)
  await c.query(`create table public.${t} (
      video_id uuid not null references public.competitor_videos(id) on delete cascade,
      hour_slot timestamptz not null,
      taken_at timestamptz not null,
      site_id uuid not null references public.sites(id) on delete cascade,
      views bigint not null,
      likes bigint,
      comments bigint,
      primary key (video_id, hour_slot),
      check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC'))`)
  await c.query(`create index ${t}_slot on public.${t} (hour_slot)`)
  await c.query(`alter table public.${t} enable row level security`)
  await c.query(`create policy ${t}_select on public.${t} for select using (public.can_view_site(site_id))`)
  await c.query(`comment on table public.${t} is 'brinquedo da M2'`)
  if (o.gatilhoQueMuda) {
    await c.query(`create or replace function public.${t}_soma() returns trigger language plpgsql as $$ begin new.views := new.views + 1; return new; end $$`)
    await c.query(`create trigger ${t}_soma before insert on public.${t} for each row execute function public.${t}_soma()`)
  }
  if (o.unicoSemTempo) await c.query(`create unique index ${t}_unico on public.${t} (video_id, views)`)
  return t
}

export async function apagarBrinquedo(c: Client, t: string): Promise<void> {
  await c.query(`drop table if exists public.${t} cascade`)
  await c.query(`drop table if exists public.${t}_antiga cascade`)
  await c.query(`drop table if exists public.${t}_particionada cascade`)
  await c.query(`drop function if exists public.${t}_soma()`)
  await c.query(`delete from public.obs_partition_conversions where table_name = 'public.' || $1`, [t])
}
```

```ts
// apps/web/test/integration/manutencao-m2-particoes.test.ts
// @vitest-environment node
/**
 * Manutenção M2 (spec 02 §10.2; 06 §18 itens 7, 8, 10, 72 e 73). Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m2-particoes.test.ts --no-file-parallelism
 * Tudo roda em `begin … rollback`, salvo o caso de concorrência, que confirma só a parte 1 (funções em obs_part) e uma tabela de
 * brinquedo própria, apagada no fim com o site que a semeou.
 * O banco é dividido com outras etapas: nenhuma afirmação conta linhas de tabela inteira de produção.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarCanal, criarVideo, escalar, tenta, q1 } from '../helpers/mg6'
import { aplicarM2, aplicarM2SoFuncoes, criarBrinquedo, apagarBrinquedo } from '../helpers/m2'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M2: o conversor numa tabela de brinquedo', () => {
  let pg: Client
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    // varre brinquedo órfão de execução morta (ele entra no fecho de cascata que obs_archive_uncovered da E10 percorre)
    const { rows } = await pg.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'zz\\_m2\\_brinquedo\\_%' and c.relkind in ('r', 'p') and not c.relispartition`)
    for (const r of rows as { relname: string }[]) await apagarBrinquedo(pg, r.relname)
  })
  afterAll(async () => { await pg.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      // o mês corrente e os 12 à frente, qualquer que seja o mês em que a M2 foi aplicada neste banco (fixture temporal relativa)
      if (await escalar<string | null>(pg, `select to_regprocedure('public.obs_partitions_ensure(integer)')::text`)) await pg.query('select public.obs_partitions_ensure(12)')
      return await fn()
    } finally { await pg.query('rollback') }
  }
  async function semear(t: string, n: number): Promise<{ site: string; video: string }> {
    const { site } = await criarSite(pg)
    const canal = await criarCanal(pg, site)
    const video = await criarVideo(pg, canal, 3)
    // n horas a partir de 15 h antes da virada do mês corrente em SP: com n > 15, cruza a virada sempre (exercita duas partições)
    await pg.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views)
      select $1, z.b + make_interval(hours => g), z.b + make_interval(hours => g), $2, g
        from generate_series(0, $3 - 1) g,
             (select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '15 hours' as b) z`, [video, site, n])
    return { site, video }
  }

  it('converte: particionada, mesma assinatura, mesma contagem e soma, partições em obs_part com RLS e sem concessão, antiga sem FK e sem concessão', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await semear(t, 30)
      const antes = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      const r = await escalar<{ feito: boolean; linhas: number }>(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.feito).toBe(true)
      expect(r.linhas).toBe(30)
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('p')
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(antes)
      const parts = await pg.query(`select n.nspname, c.relrowsecurity, c.relacl::text as acl
          from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace where i.inhparent = 'public.${t}'::regclass`)
      expect(parts.rows.length).toBeGreaterThanOrEqual(14) // mês anterior (a semente cruza a virada) .. corrente + 12
      for (const p of parts.rows as { nspname: string; relrowsecurity: boolean; acl: string | null }[]) {
        expect(p.nspname).toBe('obs_part')
        expect(p.relrowsecurity).toBe(true)
        expect(p.acl ?? '').not.toMatch(/anon=|authenticated=|service_role=/)
      }
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.${t}_antiga'::regclass and contype = 'f'`)).toBe(0)
      for (const papel of ['anon', 'authenticated', 'service_role']) {
        expect(await escalar<boolean>(pg, `select has_table_privilege($1, 'public.${t}_antiga', 'select')`, [papel])).toBe(false)
      }
      expect(await escalar<number>(pg, `select count(*)::int from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.${t}'::regclass and pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`)).toBe(0)
      expect(await escalar<number>(pg, `select rows_copied::int from public.obs_partition_conversions where table_name = 'public.${t}'`)).toBe(30)
    })
  })

  it('segunda chamada não faz nada (idempotente); a migration aplicada duas vezes não muda nada', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await semear(t, 5)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      const r = await escalar<{ feito: boolean; motivo: string }>(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r).toMatchObject({ feito: false, motivo: 'ja_particionada' })
      const assinatura = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      const n = await escalar<number>(pg, `select count(*)::int from public.${t}`)
      await aplicarM2(pg)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(assinatura)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(n)
    })
  })

  it('tabela vazia: partições do mês corrente até 12 à frente, nenhuma do passado', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(await escalar<number>(pg, `select count(*)::int from pg_inherits where inhparent = 'public.${t}'::regclass`)).toBe(13)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.' || obs_part.nome_da_particao($1, obs_part.mes_corrente_sp()))::text`, [t])).not.toBeNull()
    })
  })

  it('cópia que diverge (gatilho que muda views) desfaz tudo: a tabela continua comum e sem _antiga', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg, { gatilhoQueMuda: true })
      await semear(t, 5)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:copia_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
      expect(await escalar<string | null>(pg, `select to_regclass('public.${t}_antiga')::text`)).toBeNull()
    } finally { await pg.query('rollback') }
  })

  it('índice único sem a coluna de tempo (pedido 6) recusa alto e desfaz', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg, { unicoSemTempo: true })
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
    } finally { await pg.query('rollback') }
  })

  it('dependente novo (view, FK de outra tabela) recusa com M2:dependente_novo', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg)
      await pg.query(`create view public.${t}_v as select video_id from public.${t}`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:dependente_novo/)
      await pg.query('rollback to savepoint s')
      await pg.query(`drop view public.${t}_v`)
      await pg.query(`create table public.${t}_filha (video_id uuid, hour_slot timestamptz, foreign key (video_id, hour_slot) references public.${t} (video_id, hour_slot))`)
      await pg.query('savepoint s2')
      const r2 = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.message).toMatch(/M2:dependente_novo/)
      await pg.query('rollback to savepoint s2')
    } finally { await pg.query('rollback') }
  })

  it('a assinatura acusa diferença de concessão (o que faz a conversão desfazer)', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      const a = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      await pg.query(`revoke select on public.${t} from anon`)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).not.toEqual(a)
    })
  })

  it('catálogo que o DDL capturado não reproduz (privilégio revogado do dono) desfaz com M2:catalogo_divergente', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      const t = await criarBrinquedo(pg)
      await pg.query(`revoke truncate on public.${t} from current_user`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:catalogo_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
    } finally { await pg.query('rollback') }
  })

  it('volta atrás (02 §10.2, os 7 dias): converter, gravar 3 linhas novas, desfazer → tabela comum, antes + 3 linhas, assinatura de antes', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      const { site, video } = await semear(t, 30)
      const antes = await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await pg.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views)
        select $1, date_trunc('hour', now()) + make_interval(hours => g), date_trunc('hour', now()) + make_interval(hours => g), $2, 1000 + g
          from generate_series(1, 3) g`, [video, site])
      const r = await escalar<{ feito: boolean; linhas: number }>(pg, `select obs_part.desfazer('public.${t}'::regclass)`)
      expect(r).toMatchObject({ feito: true, linhas: 33 })
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.${t}'::regclass`)).toBe('r')
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(33)
      expect(await escalar<unknown>(pg, `select obs_part.assinatura('public.${t}'::regclass)`)).toEqual(antes)
      // a particionada fica de lado, fora do fecho de cascata e da API
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.${t}_particionada'::regclass and contype = 'f'`)).toBe(0)
      expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.${t}_particionada', 'select')`)).toBe(false)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_partition_conversions where table_name = 'public.${t}'`)).toBe(0)
      // sem dado: tabela já comum não faz nada
      expect(await escalar<unknown>(pg, `select obs_part.desfazer('public.${t}'::regclass)`)).toMatchObject({ feito: false, motivo: 'nao_particionada' })
    })
  })

  it('volta atrás sem registro da conversão recusa com M2:sem_registro (nunca adivinha FK nem concessão)', async () => {
    await emTx(async () => {
      const t = await criarBrinquedo(pg)
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await pg.query(`delete from public.obs_partition_conversions where table_name = 'public.${t}'`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select obs_part.desfazer('public.${t}'::regclass)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:sem_registro/)
      await pg.query('rollback to savepoint s')
    })
  })

  it('gravação concorrente: nenhuma linha confirmada se perde e nada cai na _antiga depois da cópia', async () => {
    // Commita de verdade (o caso pede duas conexões), mas só a parte 1: nenhuma tabela real do banco compartilhado muda.
    // A tabela de brinquedo e o site que a semeou são apagados no fim.
    await aplicarM2SoFuncoes(pg)
    const t = await criarBrinquedo(pg)
    const { site, video } = await semear(t, 10)
    const g = new Client({ connectionString: PG_URL }); await g.connect()
    const confirmadas: number[] = []
    let parar = false
    // a base fixa: se a hora virar no meio do teste, o i novo não colide com o i+1 velho (on conflict engoliria a linha)
    const base = (await escalar<string>(pg, `select date_trunc('hour', now())::text`))
    const gravador = (async () => {
      for (let i = 1000; !parar; i++) {
        await g.query(`insert into public.${t} (video_id, hour_slot, taken_at, site_id, views) values ($1, $4::timestamptz + make_interval(hours => $2), $4::timestamptz + make_interval(hours => $2), $3, $2)
          on conflict (video_id, hour_slot) do nothing`, [video, i, site, base])
        confirmadas.push(i)
      }
    })()
    try {
      await new Promise(r => setTimeout(r, 200))
      await pg.query('begin')
      await pg.query(`select obs_part.converter('public.${t}'::regclass, 'hour_slot', 'views')`)
      await new Promise(r => setTimeout(r, 300)) // o gravador fica esperando a trava
      await pg.query('commit')
      await new Promise(r => setTimeout(r, 200))
      parar = true
      await gravador
      const naNova = await escalar<number>(pg, `select count(*)::int from public.${t} where views >= 1000`)
      expect(naNova).toBe(confirmadas.length)
      const copiadas = await escalar<number>(pg, `select rows_copied::int from public.obs_partition_conversions where table_name = 'public.${t}'`)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}_antiga`)).toBe(copiadas)
      expect(await escalar<number>(pg, `select count(*)::int from public.${t}`)).toBe(10 + confirmadas.length)
    } finally {
      parar = true
      await gravador.catch(() => undefined)
      await g.end()
      await apagarBrinquedo(pg, t)
      await pg.query('delete from public.sites where id = $1', [site])
    }
  })
})
```

Note: o caso de concorrência confirma só a parte 1 (funções em `obs_part`), que não toca nenhuma tabela real. A conversão das três séries só é confirmada no `bythiago_int` no Step 1 da T5, junto com as 36 partições do passado, depois do aviso no ledger.

E, em `apps/web/test/manutencao/migrations-leitura.test.ts` (sem banco: roda na CI), acrescentar a TRAVA M2-1 como teste:

```ts
import { existsSync } from 'node:fs'
import { M2_EM_MIGRATION, M2_SQL_CAMINHO } from '../helpers/m2'
import { PASTA_DAS_MIGRATIONS } from '../helpers/migrations'

describe('TRAVA M2-1: o SQL da M2 só entra em supabase/migrations no dia do push', () => {
  const daM2 = (): string[] => readdirSync(PASTA_DAS_MIGRATIONS).filter(n => /_manutencao_m2_/.test(n))
  it('antes do dia: nenhum arquivo da M2 em supabase/migrations e o rascunho existe; no dia: o arquivo existe e o rascunho saiu', () => {
    if (!M2_EM_MIGRATION) {
      expect(daM2()).toEqual([])
      expect(M2_SQL_CAMINHO.endsWith('supabase/rascunhos/m2.sql')).toBe(true)
    } else {
      expect(daM2().some(n => n.endsWith('_manutencao_m2_particoes.sql'))).toBe(true)
      expect(existsSync(resolve(__dirname, '../../../../supabase/rascunhos/m2.sql'))).toBe(false)
    }
  })
})
```

(`readdirSync` e `resolve` já estão importados no arquivo; `existsSync` entra na importação de `node:fs`.)

Run: `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m2-particoes.test.ts --no-file-parallelism`
Expected: FAIL (o rascunho está vazio: `obs_part.assinatura` não existe).

- [ ] **Step 3: Escrever a parte 1 do rascunho**

Conteúdo de `supabase/rascunhos/m2.sql`:

```sql
-- =============================================================================
-- MIGRATION: manutenção M2, as três séries particionadas por mês de São Paulo
-- Rascunho até a Tarefa 8, Step 0 (TRAVA M2-1): vira supabase/migrations/<ts>_manutencao_m2_particoes.sql por db:new + cópia.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.2. Plano: docs/superpowers/plans/2026-10-14-manutencao-nas-m2-particoes.md
-- Idempotente: a conversão sai sem fazer nada se a tabela já é particionada; o resto é create-or-replace / if not exists.
-- O que acontece sem dado: tabela vazia ganha partições do mês corrente a 12 à frente. Erro: a conversão inteira desfaz.
-- =============================================================================
set lock_timeout = '5s';

-- 1. Onde moram as partições: fora do que a API expõe, sem concessão a ninguém.
create schema if not exists obs_part;
revoke all on schema obs_part from public, anon, authenticated, service_role;
comment on schema obs_part is 'Partições mensais das séries do Observatório (manutenção M2). Nada aqui é lido diretamente: lê-se pela tabela-mãe em public.';

-- 2. O registro da conversão (a guarda de 7 dias da remoção e a referência das 72 h do vigia)
create table if not exists public.obs_partition_conversions (
  table_name text primary key,
  old_table text not null,
  partition_column text not null,
  converted_at timestamptz not null default now(),
  rows_copied bigint not null,
  views_sum numeric not null,
  signature jsonb
);
alter table public.obs_partition_conversions add column if not exists signature jsonb;
comment on column public.obs_partition_conversions.signature is 'obs_part.assinatura da tabela antes da conversão: a volta atrás (obs_part.desfazer) recria FKs e concessões a partir dela e confere o resultado contra ela.';
alter table public.obs_partition_conversions enable row level security;
revoke all on table public.obs_partition_conversions from anon, authenticated;
comment on table public.obs_partition_conversions is 'Uma linha por tabela convertida a particionada (M2): quando, quantas linhas e a soma de views copiadas. Sem policy: só service_role e o dono leem.';

-- 3. Mês, nome e limites
create or replace function obs_part.primeiro_dia(p date) returns date
language sql immutable set search_path = '' as $$
  select pg_catalog.make_date(extract(year from p)::int, extract(month from p)::int, 1)
$$;

create or replace function obs_part.mes_corrente_sp() returns date
language sql stable set search_path = '' as $$
  select obs_part.primeiro_dia((pg_catalog.now() at time zone 'America/Sao_Paulo')::date)
$$;

create or replace function obs_part.nome_da_particao(p_tabela text, p_mes date) returns text
language sql immutable set search_path = '' as $$
  select p_tabela || '_' || pg_catalog.to_char(obs_part.primeiro_dia(p_mes), 'YYYYMM')
$$;

-- 4. Criar uma partição: RLS ligada e revoke, sempre. true = criou; false = já existia anexada à mesma mãe.
create or replace function obs_part.criar_particao(p_mae regclass, p_mes date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_mes date;
  v_rel text;
  v_nsp text;
  v_tipo text;
  v_nome text;
  v_existente regclass;
  v_de text;
  v_ate text;
begin
  if p_mae is null or p_mes is null then
    raise exception 'M2:parametro_nulo' using errcode = '22023';
  end if;
  v_mes := obs_part.primeiro_dia(p_mes);
  select c.relname, n.nspname into v_rel, v_nsp
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_mae and c.relkind = 'p';
  if v_rel is null then
    raise exception 'M2:nao_particionada: %', p_mae::text using errcode = '22023';
  end if;
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_partitioned_table pt
    join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae and pt.partstrat = 'r' and pt.partnatts = 1;
  v_nome := obs_part.nome_da_particao(v_rel, v_mes);
  v_existente := pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', v_nome));
  if v_existente is not null then
    if exists (select 1 from pg_catalog.pg_inherits i where i.inhrelid = v_existente and i.inhparent = p_mae) then
      return false;
    end if;
    raise exception 'M2:nome_ocupado: obs_part.%', v_nome using errcode = '42P07';
  end if;
  if v_tipo = 'date' then
    v_de := pg_catalog.to_char(v_mes, 'YYYY-MM-DD');
    v_ate := pg_catalog.to_char((v_mes + interval '1 month')::date, 'YYYY-MM-DD');
  elsif v_tipo = 'timestamp with time zone' then
    v_de := pg_catalog.to_char(v_mes, 'YYYY-MM-DD') || ' 00:00:00-03';
    v_ate := pg_catalog.to_char((v_mes + interval '1 month')::date, 'YYYY-MM-DD') || ' 00:00:00-03';
  else
    raise exception 'M2:tipo_de_chave: %', coalesce(v_tipo, 'nulo') using errcode = '22023';
  end if;
  begin
    execute pg_catalog.format('create table obs_part.%I partition of %I.%I for values from (%L) to (%L)', v_nome, v_nsp, v_rel, v_de, v_ate);
  exception when duplicate_table then
    if exists (select 1 from pg_catalog.pg_inherits i where i.inhrelid = pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', v_nome)) and i.inhparent = p_mae) then
      return false;
    end if;
    raise;
  end;
  execute pg_catalog.format('alter table obs_part.%I enable row level security', v_nome);
  execute pg_catalog.format('revoke all on table obs_part.%I from public, anon, authenticated, service_role', v_nome);
  return true;
end $$;

-- 5. A assinatura do catálogo de uma tabela (antes e depois têm de ser iguais). search_path vazio: tudo sai qualificado.
create or replace function obs_part.assinatura(p_tabela regclass) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'colunas', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid)) order by a.attnum), '[]'::jsonb)
                  from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                 where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped),
    'constraints', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.conname, k.contype, pg_catalog.pg_get_constraintdef(k.oid)) order by k.conname), '[]'::jsonb)
                      from pg_catalog.pg_constraint k where k.conrelid = p_tabela),
    'indices', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(ic.relname, pg_catalog.replace(pg_catalog.pg_get_indexdef(i.indexrelid), ' ON ONLY ', ' ON ')) order by ic.relname), '[]'::jsonb)
                  from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela),
    'policies', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(p.polname, p.polpermissive, p.polcmd,
                        (select pg_catalog.array_agg(case when r = 0 then 'public' else pg_catalog.pg_get_userbyid(r)::text end order by r) from pg_catalog.unnest(p.polroles) r),
                        pg_catalog.pg_get_expr(p.polqual, p.polrelid), pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]'::jsonb)
                   from pg_catalog.pg_policy p where p.polrelid = p_tabela),
    'gatilhos', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(g.tgname, pg_catalog.pg_get_triggerdef(g.oid), g.tgenabled) order by g.tgname), '[]'::jsonb)
                   from pg_catalog.pg_trigger g where g.tgrelid = p_tabela and not g.tgisinternal),
    'concessoes', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(case when x.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(x.grantee)::text end, x.privilege_type, x.is_grantable) order by case when x.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(x.grantee)::text end, x.privilege_type), '[]'::jsonb)
                     from pg_catalog.pg_class c, pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x where c.oid = p_tabela),
    'rls', (select pg_catalog.jsonb_build_array(c.relrowsecurity, c.relforcerowsecurity) from pg_catalog.pg_class c where c.oid = p_tabela),
    'comentario', pg_catalog.obj_description(p_tabela, 'pg_class'),
    'publicacoes', (select coalesce(pg_catalog.jsonb_agg(pb.pubname order by pb.pubname), '[]'::jsonb)
                      from pg_catalog.pg_publication_rel pr join pg_catalog.pg_publication pb on pb.oid = pr.prpubid where pr.prrelid = p_tabela)
  )
$$;

-- 6. F7 com pg_depend: o que impediria trocar a tabela por outra de mesmo nome.
create or replace function obs_part.dependentes(p_tabela regclass) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(z.x order by z.x), '{}'::text[]) from (
    select 'chave estrangeira de ' || k.conrelid::regclass::text || ' (' || k.conname || ')' as x
      from pg_catalog.pg_constraint k where k.contype = 'f' and k.confrelid = p_tabela and k.conrelid <> p_tabela
    union all
    select 'view ou regra ' || rw.ev_class::regclass::text
      from pg_catalog.pg_depend d join pg_catalog.pg_rewrite rw on rw.oid = d.objid
     where d.classid = 'pg_catalog.pg_rewrite'::regclass and d.refobjid = p_tabela and rw.ev_class <> p_tabela
    union all
    select 'policy ' || p.polname || ' de ' || p.polrelid::regclass::text
      from pg_catalog.pg_depend d join pg_catalog.pg_policy p on p.oid = d.objid
     where d.classid = 'pg_catalog.pg_policy'::regclass and d.refobjid = p_tabela and p.polrelid <> p_tabela
    union all
    select 'função ' || f.oid::regprocedure::text
      from pg_catalog.pg_depend d join pg_catalog.pg_proc f on f.oid = d.objid
     where d.classid = 'pg_catalog.pg_proc'::regclass
       and (d.refobjid = p_tabela or d.refobjid = (select c.reltype from pg_catalog.pg_class c where c.oid = p_tabela))
    union all
    select 'on conflict on constraint em ' || f.oid::regprocedure::text
      from pg_catalog.pg_proc f join pg_catalog.pg_constraint k on k.conrelid = p_tabela
     where f.prosrc ~* ('on\s+conflict\s+on\s+constraint\s+"?' || k.conname || '\M')
    union all
    select 'publicação ' || pb.pubname
      from pg_catalog.pg_publication_rel pr join pg_catalog.pg_publication pb on pb.oid = pr.prpubid where pr.prrelid = p_tabela
  ) z
$$;

-- 7. O conversor: uma tabela comum vira particionada por mês, com o mesmo nome e o mesmo catálogo. Chamado dentro de um só `do`.
create or replace function obs_part.converter(p_tabela regclass, p_coluna text, p_soma text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_nsp text; v_rel text; v_kind "char"; v_antiga text; v_nova regclass; v_tipo text;
  v_antes jsonb; v_depois jsonb; v_dep text[]; v_diff text;
  v_ddl text[] := '{}'; v_fks text[] := '{}'; v_cols text; v_com text; v_rls boolean; v_force boolean;
  v_min date; v_mes date; v_ate date; v_meses integer := 0;
  v_n_antes bigint; v_s_antes numeric; v_n_depois bigint; v_s_depois numeric;
  r record; x text;
begin
  select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity into v_nsp, v_rel, v_kind, v_rls, v_force
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where c.oid = p_tabela;
  if v_kind = 'p' then
    return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', false, 'motivo', 'ja_particionada');
  end if;
  if v_kind is distinct from 'r' then
    raise exception 'M2:nao_e_tabela: %', p_tabela::text using errcode = '22023';
  end if;
  execute pg_catalog.format('lock table %I.%I in access exclusive mode', v_nsp, v_rel);

  v_dep := obs_part.dependentes(p_tabela);
  if pg_catalog.cardinality(v_dep) > 0 then
    raise exception 'M2:dependente_novo: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.array_to_string(v_dep, '; ');
  end if;

  -- o retrato de antes e o DDL que o reproduz (capturados ANTES de renomear: os nomes saem os de agora, qualificados)
  v_antes := obs_part.assinatura(p_tabela);
  v_com := pg_catalog.obj_description(p_tabela, 'pg_class');
  for r in select k.conname, k.contype, pg_catalog.pg_get_constraintdef(k.oid) as def
             from pg_catalog.pg_constraint k
            where k.conrelid = p_tabela and k.contype in ('p', 'u', 'x', 'f')
            order by case k.contype when 'p' then 0 when 'u' then 1 when 'x' then 2 else 3 end, k.conname loop
    v_ddl := v_ddl || pg_catalog.format('alter table %I.%I add constraint %I %s', v_nsp, v_rel, r.conname, r.def);
    if r.contype = 'f' then v_fks := v_fks || r.conname::text; end if;
  end loop;
  for r in select pg_catalog.pg_get_indexdef(i.indexrelid) as def
             from pg_catalog.pg_index i
            where i.indrelid = p_tabela
              and not exists (select 1 from pg_catalog.pg_constraint k where k.conindid = i.indexrelid and k.conrelid = p_tabela)
            order by 1 loop
    v_ddl := v_ddl || r.def;
  end loop;
  if v_rls then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable row level security', v_nsp, v_rel); end if;
  if v_force then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I force row level security', v_nsp, v_rel); end if;
  for r in select p.polname, p.polpermissive, p.polcmd,
                  pg_catalog.pg_get_expr(p.polqual, p.polrelid) as q, pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as w,
                  (select pg_catalog.string_agg(case when x0 = 0 then 'public' else pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(x0)::text) end, ', ') from pg_catalog.unnest(p.polroles) x0) as papeis
             from pg_catalog.pg_policy p where p.polrelid = p_tabela order by p.polname loop
    v_ddl := v_ddl || pg_catalog.format('create policy %I on %I.%I as %s for %s to %s%s%s', r.polname, v_nsp, v_rel,
      case when r.polpermissive then 'permissive' else 'restrictive' end,
      case r.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
      r.papeis, coalesce(' using (' || r.q || ')', ''), coalesce(' with check (' || r.w || ')', ''));
  end loop;
  for r in select g.tgname, pg_catalog.pg_get_triggerdef(g.oid) as def, g.tgenabled
             from pg_catalog.pg_trigger g where g.tgrelid = p_tabela and not g.tgisinternal order by g.tgname loop
    v_ddl := v_ddl || r.def;
    if r.tgenabled = 'D' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I disable trigger %I', v_nsp, v_rel, r.tgname);
    elsif r.tgenabled = 'A' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable always trigger %I', v_nsp, v_rel, r.tgname);
    elsif r.tgenabled = 'R' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable replica trigger %I', v_nsp, v_rel, r.tgname);
    end if;
  end loop;
  v_ddl := v_ddl || pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  for r in select x0.grantee, x0.privilege_type, x0.is_grantable
             from pg_catalog.pg_class c, pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x0
            where c.oid = p_tabela and x0.grantee <> c.relowner loop
    v_ddl := v_ddl || pg_catalog.format('grant %s on table %I.%I to %s%s', r.privilege_type, v_nsp, v_rel,
      case when r.grantee = 0 then 'public' else pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(r.grantee)::text) end,
      case when r.is_grantable then ' with grant option' else '' end);
  end loop;
  if v_com is not null then v_ddl := v_ddl || pg_catalog.format('comment on table %I.%I is %L', v_nsp, v_rel, v_com); end if;
  select pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped;
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attname = p_coluna and not a.attisdropped;
  if v_tipo is null then raise exception 'M2:coluna_ausente: %', p_coluna using errcode = '22023'; end if;

  -- a antiga sai do caminho: nome, índices, chaves estrangeiras (sai do fecho de cascata) e concessões
  v_antiga := v_rel || '_antiga';
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_rel, v_antiga);
  for r in select ic.relname from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela loop
    execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, r.relname, pg_catalog.left(r.relname, 56) || '_antiga');
  end loop;
  foreach x in array v_fks loop
    execute pg_catalog.format('alter table %I.%I drop constraint %I', v_nsp, v_antiga, x);
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_antiga);

  -- a nova: mesmas colunas, defaults e checks (LIKE), particionada pela coluna de tempo; depois o DDL capturado
  execute pg_catalog.format('create table %I.%I (like %I.%I including defaults including constraints including generated including identity including storage including comments including statistics) partition by range (%I)',
    v_nsp, v_rel, v_nsp, v_antiga, p_coluna);
  v_nova := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, v_rel));
  foreach x in array v_ddl loop execute x; end loop;

  -- partições: do mês de min(coluna) (vazia: o corrente) até 12 à frente. Mês em São Paulo.
  execute pg_catalog.format('select (min(%I)%s)::date from %I.%I', p_coluna,
    case when v_tipo = 'timestamp with time zone' then ' at time zone ''America/Sao_Paulo''' else '' end, v_nsp, v_antiga) into v_min;
  v_ate := (obs_part.mes_corrente_sp() + interval '12 months')::date;
  v_mes := least(coalesce(obs_part.primeiro_dia(v_min), obs_part.mes_corrente_sp()), obs_part.mes_corrente_sp());
  while v_mes <= v_ate loop
    perform obs_part.criar_particao(v_nova, v_mes);
    v_meses := v_meses + 1;
    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  -- a cópia e a conferência: contagem e soma iguais, ou tudo desfaz
  execute pg_catalog.format('insert into %I.%I (%s) select %s from %I.%I', v_nsp, v_rel, v_cols, v_cols, v_nsp, v_antiga);
  execute pg_catalog.format('select count(*), coalesce(sum(%I), 0) from %I.%I', p_soma, v_nsp, v_antiga) into v_n_antes, v_s_antes;
  execute pg_catalog.format('select count(*), coalesce(sum(%I), 0) from %I.%I', p_soma, v_nsp, v_rel) into v_n_depois, v_s_depois;
  if v_n_antes <> v_n_depois or v_s_antes <> v_s_depois then
    raise exception 'M2:copia_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001',
      detail = pg_catalog.format('antes %s linhas e soma %s; depois %s e %s', v_n_antes, v_s_antes, v_n_depois, v_s_depois);
  end if;

  v_depois := obs_part.assinatura(v_nova);
  if v_depois is distinct from v_antes then
    select pg_catalog.string_agg(k, ', ' order by k) into v_diff from pg_catalog.jsonb_object_keys(v_antes) k where v_antes -> k is distinct from v_depois -> k;
    raise exception 'M2:catalogo_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = coalesce(v_diff, 'chaves');
  end if;

  insert into public.obs_partition_conversions (table_name, old_table, partition_column, converted_at, rows_copied, views_sum, signature)
  values (v_nsp || '.' || v_rel, v_nsp || '.' || v_antiga, p_coluna, pg_catalog.now(), v_n_depois, v_s_depois, v_antes)
  on conflict (table_name) do update set old_table = excluded.old_table, partition_column = excluded.partition_column,
    converted_at = excluded.converted_at, rows_copied = excluded.rows_copied, views_sum = excluded.views_sum, signature = excluded.signature;

  return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', true, 'linhas', v_n_depois, 'soma', v_s_depois, 'meses', v_meses);
end $$;

revoke all on function obs_part.primeiro_dia(date) from public, anon, authenticated, service_role;
revoke all on function obs_part.mes_corrente_sp() from public, anon, authenticated, service_role;
revoke all on function obs_part.nome_da_particao(text, date) from public, anon, authenticated, service_role;
revoke all on function obs_part.criar_particao(regclass, date) from public, anon, authenticated, service_role;
revoke all on function obs_part.assinatura(regclass) from public, anon, authenticated, service_role;
revoke all on function obs_part.dependentes(regclass) from public, anon, authenticated, service_role;
revoke all on function obs_part.converter(regclass, text, text) from public, anon, authenticated, service_role;

-- 7b. A volta atrás dos 7 dias (02 §10.2: "a antiga fica 7 dias como volta atrás"). Só o dono, pelo SQL do painel; ninguém tem execute.
--     Numa transação: a antiga recebe o conteúdo ATUAL da nova (a nova é a verdade: linhas gravadas, atualizadas e apagadas em cascata
--     depois da conversão), volta ao nome, aos índices, às chaves estrangeiras e às concessões de antes (pela assinatura gravada) e a
--     assinatura final tem de ser igual à de antes, ou tudo desfaz. A nova fica como <tabela>_particionada, sem FK e sem concessão.
--     Sem dado: sem registro ou sem assinatura → M2:sem_registro; sem a antiga (já removida no sétimo dia) → M2:antiga_ausente;
--     tabela já comum → {feito: false, motivo: 'nao_particionada'}.
create or replace function obs_part.desfazer(p_tabela regclass) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_nsp text; v_rel text; v_kind "char"; v_antiga text; v_volta regclass; v_cols text; v_parada text;
  v_reg record; v_dep text[]; v_depois jsonb; v_diff text; v_n_nova bigint; v_n_volta bigint;
  r record; x jsonb;
begin
  select n.nspname, c.relname, c.relkind into v_nsp, v_rel, v_kind
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where c.oid = p_tabela;
  if v_kind is distinct from 'p' then
    return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', false, 'motivo', 'nao_particionada');
  end if;
  select c.* into v_reg from public.obs_partition_conversions c where c.table_name = v_nsp || '.' || v_rel;
  if v_reg.table_name is null or v_reg.signature is null then
    raise exception 'M2:sem_registro: %', v_nsp || '.' || v_rel using errcode = 'P0001';
  end if;
  if pg_catalog.to_regclass(v_reg.old_table) is null then
    raise exception 'M2:antiga_ausente: %', v_reg.old_table using errcode = 'P0001';
  end if;
  v_antiga := v_rel || '_antiga';
  v_parada := pg_catalog.left(v_rel, 49) || '_particionada';
  execute pg_catalog.format('lock table %I.%I, %I.%I in access exclusive mode', v_nsp, v_rel, v_nsp, v_antiga);
  v_dep := obs_part.dependentes(p_tabela);
  if pg_catalog.cardinality(v_dep) > 0 then
    raise exception 'M2:dependente_novo: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.array_to_string(v_dep, '; ');
  end if;

  -- 1. o conteúdo: a antiga passa a ter exatamente o que a nova tem
  select pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped;
  execute pg_catalog.format('truncate %I.%I', v_nsp, v_antiga);
  execute pg_catalog.format('insert into %I.%I (%s) select %s from %I.%I', v_nsp, v_antiga, v_cols, v_cols, v_nsp, v_rel);
  execute pg_catalog.format('select count(*) from %I.%I', v_nsp, v_rel) into v_n_nova;
  execute pg_catalog.format('select count(*) from %I.%I', v_nsp, v_antiga) into v_n_volta;
  if v_n_nova <> v_n_volta then
    raise exception 'M2:volta_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.format('nova %s linhas; antiga %s', v_n_nova, v_n_volta);
  end if;

  -- 2. a nova sai do caminho: nome, índices, chaves estrangeiras (sai do fecho de cascata) e concessões
  for r in select ic.relname from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela loop
    execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, r.relname, pg_catalog.left(r.relname, 50) || '_particao');
  end loop;
  for r in select k.conname from pg_catalog.pg_constraint k where k.conrelid = p_tabela and k.contype = 'f' and k.conparentid = 0 loop
    execute pg_catalog.format('alter table %I.%I drop constraint %I', v_nsp, v_rel, r.conname);
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_rel, v_parada);

  -- 3. a antiga volta: nome, índices (o conversor os renomeou para left(nome, 56) || '_antiga'), FKs e concessões da assinatura
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_antiga, v_rel);
  v_volta := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, v_rel));
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'indices') loop
    if pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, pg_catalog.left(x ->> 0, 56) || '_antiga')) is not null then
      execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, pg_catalog.left(x ->> 0, 56) || '_antiga', x ->> 0);
    end if;
  end loop;
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'constraints') loop
    if x ->> 1 = 'f' then
      execute pg_catalog.format('alter table %I.%I add constraint %I %s', v_nsp, v_rel, x ->> 0, x ->> 2);
    end if;
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'concessoes') loop
    continue when x ->> 0 = (select pg_catalog.pg_get_userbyid(c.relowner)::text from pg_catalog.pg_class c where c.oid = v_volta);
    execute pg_catalog.format('grant %s on table %I.%I to %s%s', x ->> 1, v_nsp, v_rel,
      case when x ->> 0 = 'public' then 'public' else pg_catalog.quote_ident(x ->> 0) end,
      case when (x ->> 2)::boolean then ' with grant option' else '' end);
  end loop;

  -- 4. a conferência: a assinatura de agora é a de antes da conversão, ou tudo desfaz
  v_depois := obs_part.assinatura(v_volta);
  if v_depois is distinct from v_reg.signature then
    select pg_catalog.string_agg(k, ', ' order by k) into v_diff from pg_catalog.jsonb_object_keys(v_reg.signature) k where v_reg.signature -> k is distinct from v_depois -> k;
    raise exception 'M2:volta_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = coalesce(v_diff, 'chaves');
  end if;
  delete from public.obs_partition_conversions c where c.table_name = v_nsp || '.' || v_rel;
  return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', true, 'linhas', v_n_volta, 'particionada_fica_em', v_nsp || '.' || v_parada);
end $$;
revoke all on function obs_part.desfazer(regclass) from public, anon, authenticated, service_role;
```

Observações para quem implementa:
- `LIKE … including constraints` copia o `check` com o mesmo nome (`competitor_video_hourly_check`); PK e FKs entram pelo DDL capturado, com os nomes de antes. O gatilho é recriado **antes** da cópia de propósito: um gatilho que muda a linha faz a conferência divergir e a conversão desfazer (é o que o teste do gatilho prova).
- A conversão acontece dentro da trava `access exclusive` da tabela antiga. A coleta que chegar nesse instante espera; ao ganhar a trava, o Postgres relê o nome e acha a tabela nova (o teste de concorrência prova).
- A volta atrás (`obs_part.desfazer`) copia para a antiga o conteúdo **atual** da nova (apaga e copia), não só as linhas que faltam: a nova é a verdade depois da conversão (linhas novas, linhas atualizadas pelo `upsert` e linhas apagadas em cascata). Os índices da antiga voltam pelo nome gravado na assinatura (o conversor os renomeou para `left(nome, 56) || '_antiga'`); renomear o índice renomeia a constraint que ele sustenta. Depois da volta, `obs_partitions_months_ahead` devolve `null` para a tabela e o vigia fica vermelho: correto, a M2 não está mais de pé (o LEIAME diz isso ao dono).

- [ ] **Step 4: Rodar e ver passar**

Run: o mesmo comando do Step 2, e `npx vitest run test/manutencao/migrations-leitura.test.ts`.
Expected: PASS (11 testes no arquivo de integração; o da TRAVA M2-1 no outro). Se `M2:catalogo_divergente` aparecer fora do caso que o provoca, o `detail` diz qual chave da assinatura difere: consertar o DDL capturado, nunca a assinatura. Conferir depois: `select relkind from pg_class where oid = 'public.competitor_video_daily'::regclass` no 54422 continua `r`.

- [ ] **Step 5: Commit**

```bash
git add supabase/rascunhos/m2.sql apps/web/test/helpers/m2.ts apps/web/test/integration/manutencao-m2-particoes.test.ts apps/web/test/manutencao/migrations-leitura.test.ts
git commit -m "feat: rascunho da M2 com obs_part, o conversor e a volta atrás, provados em tabela de brinquedo, fora de supabase/migrations (M2)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m2.sql apps/web/test/helpers/m2.ts apps/web/test/integration/manutencao-m2-particoes.test.ts apps/web/test/manutencao/migrations-leitura.test.ts
```

---

### Task 3: a migration, parte 2 — `obs_partitions_ensure`, `obs_partitions_months_ahead`, a tabela de ensaio, a conversão das três séries e a semente do passado

**Files:**
- Modify: `supabase/rascunhos/m2.sql` (acrescentar ao fim)
- Modify: `supabase/seeds/dev.sql` (acrescentar ao fim)
- Modify: `apps/web/test/integration/manutencao-m2-particoes.test.ts` (novo `describe`)

**Interfaces:**
- Consumes: as funções de `obs_part` da Tarefa 2.
- Produces:
  - `public.obs_partitions_ensure(p_months_ahead integer default 12) returns table (table_name text, last_month date, created integer)` — `security definer`, `execute` só para `service_role`. Erros: `M2:meses_fora_da_faixa` (22023), `M2:tabela_nao_particionada: <t>` (P0001).
  - `public.obs_partitions_months_ahead() returns table (table_name text, months_ahead integer, last_month date, converted_at timestamptz)` — `months_ahead`: `null` = tabela não particionada; `-1` = mês corrente sem partição; `0` = só o corrente; `12` logo depois da conversão. `execute` só para `service_role`.
  - `public.obs_archive_rehearsal` (particionada por `hour_slot`, sem partição criada aqui; a carga da M8 cria o mês dela por `obs_part.criar_particao`).
  - **Contrato com a M3b:** `obs_partitions_ensure` lê, se existir, `public.obs_archive_months(table_name text, month date, detached_at, dropped_at)` e pula mês com `detached_at` ou `dropped_at`. A M3b cria a tabela com essas quatro colunas com esses nomes; se mudar, o `ensure` falha alto (o vigia fica vermelho), nunca pula em silêncio.

- [ ] **Step 1: Escrever os testes (falham: as funções públicas não existem)**

Acrescentar ao arquivo de teste:

```ts
describe.skipIf(skipIfNoLocalDb())('M2: as três séries, o ensure, os meses à frente e a tabela de ensaio', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  const TRES = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const
  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    // ensure(12) logo depois: os testes não dependem do mês em que a M2 foi aplicada neste banco (fixture temporal relativa)
    try { await aplicarM2(pg); await pg.query('select public.obs_partitions_ensure(12)'); return await fn() } finally { await pg.query('rollback') }
  }

  it('item 7: as três particionadas, partições em obs_part, RLS ligada, sem select de anon nem authenticated, sem DEFAULT, do mês de min(coluna) a 12 à frente', async () => {
    await emTx(async () => {
      for (const t of TRES) {
        expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = $1::regclass`, ['public.' + t])).toBe('p')
        const r = await pg.query(`select n.nspname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon_le,
              has_table_privilege('authenticated', c.oid, 'select') as auth_le, pg_get_expr(c.relpartbound, c.oid) as faixa
            from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace where i.inhparent = $1::regclass`, ['public.' + t])
        for (const p of r.rows as { nspname: string; relrowsecurity: boolean; anon_le: boolean; auth_le: boolean; faixa: string }[]) {
          expect(p).toMatchObject({ nspname: 'obs_part', relrowsecurity: true, anon_le: false, auth_le: false })
          expect(p.faixa).not.toBe('DEFAULT')
        }
      }
      const m = await pg.query(`select table_name, months_ahead from public.obs_partitions_months_ahead() order by 1`)
      expect(m.rows).toEqual(TRES.map(t => ({ table_name: t, months_ahead: 12 })))
      // a semente do passado (dev.sql) não conta: o que se afirma é que o mês de min(coluna) existe
      for (const [t, col] of [['competitor_video_daily', 'snap_date'], ['competitor_video_early', 'taken_at'], ['competitor_video_hourly', 'hour_slot']] as const) {
        const minMes = await escalar<string | null>(pg, `select to_char(obs_part.primeiro_dia((min(${col})${col === 'snap_date' ? '' : " at time zone 'America/Sao_Paulo'"})::date), 'YYYYMM') from public.${t}`)
        if (minMes !== null) expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${t}_' || $1)::text`, [minMes])).not.toBeNull()
      }
    })
  })

  it('a hora da virada: 02:00 UTC de 1º/11 (23:00 de 31/10 em SP) cai na partição de outubro', async () => {
    await emTx(async () => {
      await pg.query(`select obs_part.criar_particao('public.competitor_video_hourly'::regclass, '2026-10-01'), obs_part.criar_particao('public.competitor_video_hourly'::regclass, '2026-11-01')`)
      const { site } = await criarSite(pg)
      const video = await criarVideo(pg, await criarCanal(pg, site), 3)
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-11-01 02:00:00+00', '2026-11-01 02:10:00+00', $2, 1), ($1, '2026-11-01 03:00:00+00', '2026-11-01 03:10:00+00', $2, 2)`, [video, site])
      const r = await pg.query(`select tableoid::regclass::text as part, views from public.competitor_video_hourly where video_id = $1 order by views`, [video])
      expect(r.rows).toEqual([{ part: 'obs_part.competitor_video_hourly_202610', views: '1' }, { part: 'obs_part.competitor_video_hourly_202611', views: '2' }])
    })
  })

  it('itens 10 e 73: ensure recria o que falta à frente, liga RLS e revoga, é idempotente e nunca cria mês passado', async () => {
    await emTx(async () => {
      const ultimo = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', (obs_part.mes_corrente_sp() + interval '12 months')::date)`)
      await pg.query(`drop table obs_part.${ultimo}`)
      const passado = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_daily', (obs_part.mes_corrente_sp() - interval '30 months')::date)`)
      await pg.query(`drop table if exists obs_part.${passado}`) // a semente cria −1..−36; o teste prova que o ensure não a recria
      const r1 = await pg.query(`select table_name, created from public.obs_partitions_ensure(12) order by 1`)
      expect(r1.rows).toEqual([
        { table_name: 'competitor_video_daily', created: 0 },
        { table_name: 'competitor_video_early', created: 0 },
        { table_name: 'competitor_video_hourly', created: 1 },
      ])
      expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = to_regclass('obs_part.${ultimo}')`)).toBe(true)
      expect(await escalar<boolean>(pg, `select has_table_privilege('service_role', 'obs_part.${ultimo}', 'select')`)).toBe(false)
      const r2 = await pg.query(`select sum(created)::int as n from public.obs_partitions_ensure(12)`)
      expect(r2.rows[0].n).toBe(0)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${passado}')::text`)).toBeNull()
    })
  })

  it('item 73: mês com detached_at ou dropped_at no registro nunca é recriado', async (ctx) => {
    await emTx(async () => {
      const existe = await escalar<string | null>(pg, `select to_regclass('public.obs_archive_months')::text`)
      if (existe === null) {
        // a M3b ainda não existe: a forma mínima do contrato (table_name, month, detached_at, dropped_at), só nesta transação
        await pg.query(`create table public.obs_archive_months (table_name text, month date, detached_at timestamptz, dropped_at timestamptz)`)
      }
      const mes = await escalar<string>(pg, `select to_char((obs_part.mes_corrente_sp() + interval '12 months')::date, 'YYYY-MM-DD')`)
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_early', $1::date)`, [mes])
      await pg.query(`drop table obs_part.${nome}`)
      if (existe === null) await pg.query(`insert into public.obs_archive_months values ('competitor_video_early', $1::date, now(), null)`, [mes])
      else ctx.skip() // com a M3b viva, o teste dela cobre o caso com a chave completa: aparece como pulado, nunca como verde
      await pg.query(`select * from public.obs_partitions_ensure(12)`)
      expect(await escalar<string | null>(pg, `select to_regclass('obs_part.${nome}')::text`)).toBeNull()
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_early'`)
      expect(m.rows[0].months_ahead).toBe(11)
    })
  })

  it('o que acontece sem dado: ensure com tabela não particionada falha alto; meses à frente devolve null', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      await pg.query(`alter table public.competitor_video_early rename to competitor_video_early_x`)
      await pg.query(`create table public.competitor_video_early (video_id uuid)`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `select * from public.obs_partitions_ensure(12)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:tabela_nao_particionada: competitor_video_early/)
      await pg.query('rollback to savepoint s')
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_early'`)
      expect(m.rows[0].months_ahead).toBeNull()
      const r2 = await tenta(pg, `select * from public.obs_partitions_ensure(0)`)
      expect(r2.ok).toBe(false)
    } finally { await pg.query('rollback') }
  })

  it('mês corrente sem partição: months_ahead = -1', async (ctx) => {
    await emTx(async () => {
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', obs_part.mes_corrente_sp())`)
      const n = await escalar<number>(pg, `select count(*)::int from obs_part.${nome}`)
      if (n > 0) ctx.skip() // banco com leitura horária do mês: não se apaga dado para testar (pulado, nunca verde)
      await pg.query(`drop table obs_part.${nome}`)
      const m = await pg.query(`select months_ahead from public.obs_partitions_months_ahead() where table_name = 'competitor_video_hourly'`)
      expect(m.rows[0].months_ahead).toBe(-1)
    })
  })

  it('permissões: só service_role executa as duas públicas (has_function_privilege; chamar como anon derruba o Postgres local)', async () => {
    await emTx(async () => {
      for (const f of ['public.obs_partitions_ensure(integer)', 'public.obs_partitions_months_ahead()']) {
        expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1, 'execute')`, [f])).toBe(true)
        expect(await escalar<boolean>(pg, `select has_function_privilege('anon', $1, 'execute')`, [f])).toBe(false)
        expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', $1, 'execute')`, [f])).toBe(false)
      }
      for (const f of ['obs_part.criar_particao(regclass,date)', 'obs_part.converter(regclass,text,text)']) {
        expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', $1, 'execute')`, [f])).toBe(false)
      }
    })
  })

  it('a tabela de ensaio: particionada por hour_slot, sem FK, RLS ligada, sem concessão a anon e authenticated, linha só sintética', async () => {
    await emTx(async () => {
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.obs_archive_rehearsal'::regclass`)).toBe('p')
      expect(await escalar<number>(pg, `select count(*)::int from pg_constraint where conrelid = 'public.obs_archive_rehearsal'::regclass and contype = 'f'`)).toBe(0)
      expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = 'public.obs_archive_rehearsal'::regclass`)).toBe(true)
      expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.obs_archive_rehearsal', 'select')`)).toBe(false)
      expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', 'public.obs_archive_rehearsal', 'select')`)).toBe(false)
      await pg.query(`select obs_part.criar_particao('public.obs_archive_rehearsal'::regclass, '2026-03-01')`)
      await pg.query('savepoint s')
      const r = await tenta(pg, `insert into public.obs_archive_rehearsal (video_id, hour_slot, taken_at, site_id, views, synthetic) values (gen_random_uuid(), '2026-03-10 10:00+00', '2026-03-10 10:05+00', gen_random_uuid(), 1, false)`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/obs_archive_rehearsal_synthetic/)
      await pg.query('rollback to savepoint s')
    })
  })
})
```

Run: o comando da Tarefa 2.
Expected: FAIL nos casos novos (`obs_partitions_months_ahead` não existe).

- [ ] **Step 2: Acrescentar a parte 2 ao rascunho**

(O bloco 11, as funções da E10, entra na Tarefa 4, **antes** do bloco 12 abaixo.)

```sql
-- 8. A tabela de ensaio (03 §13.3): mesma forma da leitura horária, sem FK, só linhas sintéticas. Partições: criadas pela carga da M8.
create table if not exists public.obs_archive_rehearsal (
  video_id uuid not null,
  hour_slot timestamptz not null,
  taken_at timestamptz not null,
  site_id uuid not null,
  views bigint not null,
  likes bigint,
  comments bigint,
  synthetic boolean not null default true,
  constraint obs_archive_rehearsal_pkey primary key (video_id, hour_slot),
  constraint obs_archive_rehearsal_check check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC'),
  constraint obs_archive_rehearsal_synthetic check (synthetic)
) partition by range (hour_slot);
alter table public.obs_archive_rehearsal enable row level security;
revoke all on table public.obs_archive_rehearsal from anon, authenticated;
comment on table public.obs_archive_rehearsal is 'Dado de teste do ensaio do arquivo (classe ensaio). Sem FK de propósito (fica fora do fecho de cascata). Só o grupo "Dado de teste" da página do arquivo a lê, pelo servidor.';

-- 9. Criar o que falta à frente (chamada pela tarefa diária particoes_a_frente). Nunca cria mês passado nem mês destacado. Criar partição trava a mãe em access exclusive (medido): no máximo 3 s, uma vez por mês por tabela.
create or replace function public.obs_partitions_ensure(p_months_ahead integer default 12)
returns table (table_name text, last_month date, created integer)
language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare
  v_t text;
  v_oid regclass;
  v_corrente date := obs_part.mes_corrente_sp();
  v_mes date;
  v_criadas integer;
  v_ultimo date;
  v_bloqueado boolean;
  v_tem_registro boolean := pg_catalog.to_regclass('public.obs_archive_months') is not null;
begin
  if p_months_ahead is null or p_months_ahead < 1 or p_months_ahead > 24 then
    raise exception 'M2:meses_fora_da_faixa' using errcode = '22023';
  end if;
  foreach v_t in array array['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] loop
    v_oid := pg_catalog.to_regclass('public.' || v_t);
    if v_oid is null or (select c.relkind from pg_catalog.pg_class c where c.oid = v_oid) <> 'p' then
      raise exception 'M2:tabela_nao_particionada: %', v_t using errcode = 'P0001';
    end if;
    v_criadas := 0;
    v_ultimo := null;
    for i in 0 .. p_months_ahead loop
      v_mes := (v_corrente + pg_catalog.make_interval(months => i))::date;
      v_bloqueado := false;
      if v_tem_registro then
        execute 'select exists (select 1 from public.obs_archive_months m where m.table_name = $1 and m.month = $2 and (m.detached_at is not null or m.dropped_at is not null))'
          into v_bloqueado using v_t, v_mes;
      end if;
      continue when v_bloqueado;
      if obs_part.criar_particao(v_oid, v_mes) then v_criadas := v_criadas + 1; end if;
      v_ultimo := v_mes;
    end loop;
    table_name := v_t; last_month := v_ultimo; created := v_criadas;
    return next;
  end loop;
end $$;

-- 10. O invariante "meses à frente", lido pelo vigia. Contíguos a partir do corrente; -1 = corrente ausente; null = não particionada.
create or replace function public.obs_partitions_months_ahead()
returns table (table_name text, months_ahead integer, last_month date, converted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t text;
  v_oid regclass;
  v_corrente date := obs_part.mes_corrente_sp();
  v_mes date;
begin
  foreach v_t in array array['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] loop
    v_oid := pg_catalog.to_regclass('public.' || v_t);
    table_name := v_t;
    converted_at := (select c.converted_at from public.obs_partition_conversions c where c.table_name = 'public.' || v_t);
    months_ahead := null;
    last_month := null;
    if v_oid is not null and (select c.relkind from pg_catalog.pg_class c where c.oid = v_oid) = 'p' then
      months_ahead := -1;
      for i in 0 .. 36 loop
        v_mes := (v_corrente + pg_catalog.make_interval(months => i))::date;
        exit when not exists (
          select 1 from pg_catalog.pg_inherits h
            join pg_catalog.pg_class c on c.oid = h.inhrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where h.inhparent = v_oid and n.nspname = 'obs_part' and c.relname = obs_part.nome_da_particao(v_t, v_mes));
        months_ahead := i;
        last_month := v_mes;
      end loop;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.obs_partitions_ensure(integer) from public, anon, authenticated;
revoke all on function public.obs_partitions_months_ahead() from public, anon, authenticated;
grant execute on function public.obs_partitions_ensure(integer) to service_role;
grant execute on function public.obs_partitions_months_ahead() to service_role;

-- 12. A conversão das três séries: um só bloco, uma só transação (se uma falhar, nenhuma muda).
do $$
begin
  perform obs_part.converter('public.competitor_video_daily'::regclass, 'snap_date', 'views');
  perform obs_part.converter('public.competitor_video_early'::regclass, 'taken_at', 'views');
  perform obs_part.converter('public.competitor_video_hourly'::regclass, 'hour_slot', 'views');
end $$;

-- o autovacuum nunca analisa a mãe particionada, só as partições: a estatística da mãe nasce aqui
analyze public.competitor_video_daily, public.competitor_video_early, public.competitor_video_hourly;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: A semente do passado, só para banco local e CI**

Acrescentar ao fim de `supabase/seeds/dev.sql`:

```sql
-- Manutenção M2: 36 meses de partição para trás nas três séries. Só banco local e CI (o `db reset` roda este arquivo; produção, nunca).
-- Sem isto, teste que grava série em data passada (ex.: current_date - 40) falha com "no partition of relation".
do $$
declare
  t text;
  i integer;
begin
  if pg_catalog.to_regprocedure('obs_part.criar_particao(regclass,date)') is null then return; end if;
  foreach t in array array['public.competitor_video_daily', 'public.competitor_video_early', 'public.competitor_video_hourly'] loop
    -- só a parte 1 confirmada (funções sem a conversão, Tarefa 2): tabela comum, nada a semear
    continue when (select c.relkind from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass(t)) is distinct from 'p';
    for i in 1 .. 36 loop
      perform obs_part.criar_particao(t::regclass, (obs_part.mes_corrente_sp() - pg_catalog.make_interval(months => i))::date);
    end loop;
  end loop;
end $$;
```

E conferir: `grep -rn "competitor_video_\(daily\|early\|hourly\)" apps/web/test | grep -n "interval '[0-9]\{4,\} days\|+ 400\|+ 900"` — nenhum teste grava mais de 36 meses atrás nem mais de 12 meses à frente nas três. Achado: o teste em questão cria a partição dele com `obs_part.criar_particao` no próprio `begin … rollback`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando da Tarefa 2.
Expected: PASS (todos os casos dos dois `describe`). Conferir: no 54422, `select relkind from pg_class where oid = 'public.competitor_video_daily'::regclass` continua `r` (nada até a Tarefa 5, Step 1, converte de vez o banco compartilhado).

- [ ] **Step 5: Commit**

```bash
git add supabase/rascunhos/m2.sql supabase/seeds/dev.sql apps/web/test/integration/manutencao-m2-particoes.test.ts
git commit -m "feat: rascunho da M2 com as três séries particionadas, obs_partitions_ensure, meses à frente e a tabela de ensaio (M2, itens 7, 10 e 73)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m2.sql supabase/seeds/dev.sql apps/web/test/integration/manutencao-m2-particoes.test.ts
```

---

### Task 4: as duas funções da E10 sabem de partição (pedidos 1 e 3; itens 13 e 14)

**Files:**
- Modify: `supabase/rascunhos/m2.sql` (bloco 11, condicional, **antes** do bloco 12, a conversão)
- Create: `apps/web/test/integration/manutencao-m2-e10.test.ts`
- Create (só disco, sem commit): `.superpowers/sdd/manutencao-nas/entrega-e10-pedidos-1-e-3.md`

A M2 **não edita** `apps/web/test/fixtures/sql/a5-e10-mg6.sql` nem o plano da E10: os dois são da E10, que os edita agora (3 commits em 14/10).

**Interfaces:**
- Consumes: `garantirMg6`, `semearCena`, `exportarConferirConfirmar`, `contagemPorTabela`, `escalar` de `apps/web/test/helpers/mg6.ts`; `aplicarM2` da Tarefa 2.
- Produces: o texto dos pedidos 1 e 3, entregue à trilha da E10 por arquivo. **Entrega ao controlador da E10 ANTES do Step 1 desta tarefa, com confirmação por escrito no ledger** (os arquivos são dela). O agente grava `.superpowers/sdd/manutencao-nas/entrega-e10-pedidos-1-e-3.md` (só disco: `.superpowers/` é ignorado pelo git) com este texto e, abaixo dele, os dois trechos SQL do Step 2, literais: "Aplicar no Apêndice A do plano da E10 E na fixture `a5-e10-mg6.sql` o texto dos pedidos 1 e 3 (abaixo, literal); e em `observatorio-a5-e10-migration.test.ts:340`, trocar `current_date + 400` por `current_date + 300` (a linha precisa só de uma data que não colida com a cena; depois da M2 só existem partições até 12 meses à frente). Sem isso, os testes da E10 quebram no banco local depois da M2, e o teste `test/manutencao/migrations-leitura.test.ts` fica vermelho se a MG6 entrar como migration sem os dois." O ledger da fase ganha duas linhas: "entrega E10 gravada em <data hora>" e "E10 confirmou a entrega em <data hora> (commit <sha>)". Sem a confirmação, a Tarefa 5, Step 1, não roda.

- [ ] **Step 1: Escrever o teste (falha: a fixture ainda acusa as partições)**

```ts
// apps/web/test/integration/manutencao-m2-e10.test.ts
// @vitest-environment node
/**
 * Manutenção M2, itens 13 e 14 (pedidos 1 e 3): com as três séries particionadas, obs_archive_uncovered() continua vazia
 * (partições, tabela _antiga guardada e tabela destacada _saida), o export de canal funciona, e o registro de tamanho soma
 * as partições de obs_part sob o nome da mãe. Roda sobre a fixture da MG6 (a E10 ainda não é migration), em begin … rollback.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg6, semearCena, exportarConferirConfirmar, contagemPorTabela, escalar } from '../helpers/mg6'
import { aplicarM2 } from '../helpers/m2'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M2 e a E10: uncovered vazio e tamanho somando partições', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  async function emTx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin')
    try {
      // a MG6 ANTES da M2: enquanto a fixture estiver sem o conserto, quem põe a cláusula é o bloco 11 da M2 (o caminho que
      // recria fica testado); depois que a E10 consertar, o bloco 11 sai sem fazer nada e o teste continua valendo
      await garantirMg6(pg)
      await aplicarM2(pg)
      for (let i = 1; i <= 3; i++) {
        await pg.query(`select obs_part.criar_particao(t::regclass, (obs_part.mes_corrente_sp() - make_interval(months => $1))::date)
          from unnest(array['public.competitor_video_daily','public.competitor_video_early','public.competitor_video_hourly']) t`, [i])
      }
      await fn()
    } finally { await pg.query('rollback') }
  }

  it('item 13: vazio com as três particionadas, com a _antiga guardada e com uma tabela destacada _saida; o export de canal conta a série', async () => {
    await emTx(async () => {
      expect(await escalar<boolean>(pg, `select prosrc ~ 'relispartition' from pg_proc where oid = 'public.obs_archive_uncovered()'::regprocedure`)).toBe(true)
      expect(await escalar<boolean>(pg, `select prosrc ~ 'relispartition' from pg_proc where oid = 'public.obs_db_size_record(timestamp with time zone)'::regprocedure`)).toBe(true)
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      // uma tabela destacada como a M3b fará: detach, sem FK, sufixo _saida
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', (obs_part.mes_corrente_sp() + interval '12 months')::date)`)
      await pg.query(`alter table public.competitor_video_hourly detach partition obs_part.${nome}`)
      for (const r of (await pg.query(`select conname from pg_constraint where conrelid = 'obs_part.${nome}'::regclass and contype = 'f'`)).rows as { conname: string }[]) {
        await pg.query(`alter table obs_part.${nome} drop constraint ${r.conname}`)
      }
      await pg.query(`alter table obs_part.${nome} rename to ${nome}_saida`)
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      const cena = await semearCena(pg)
      await exportarConferirConfirmar(pg, cena, cena.canalA, 'lote-m2')
      expect((await contagemPorTabela(pg, cena.canalA)).competitor_video_daily).toBeGreaterThan(0)
    })
  })

  it('item 14: o tamanho soma as partições de obs_part sob a mãe; nenhuma chave obs_part.* no top', async () => {
    await emTx(async () => {
      await semearCena(pg)
      await pg.query(`select public.obs_db_size_record(now())`)
      const top = await escalar<Record<string, number>>(pg, `select top_relations from public.obs_db_size_daily where day = (now() at time zone 'America/Sao_Paulo')::date`)
      expect(Object.keys(top).some(k => k.startsWith('obs_part.'))).toBe(false)
      const daily = await escalar<number>(pg, `select coalesce(sum(pg_total_relation_size(i.inhrelid)), 0)::bigint from pg_inherits i where i.inhparent = 'public.competitor_video_daily'::regclass`)
      expect(Number(daily)).toBeGreaterThan(0)
      const comp = await escalar<string>(pg, `select competitor_bytes::text from public.obs_db_size_daily where day = (now() at time zone 'America/Sao_Paulo')::date`)
      expect(Number(comp)).toBeGreaterThanOrEqual(Number(daily))
    })
  })

  it('bloco 11: corpo instalado diferente do conhecido e sem a cláusula recusa com M2:obs_archive_uncovered_divergente, ANTES da conversão', async () => {
    await pg.query('begin')
    try {
      await garantirMg6(pg)
      const antes = await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)
      await pg.query(`create or replace function public.obs_archive_uncovered() returns text[] language sql stable security definer set search_path = '' as $$ select '{}'::text[] $$`)
      await pg.query('savepoint s')
      const r = await tenta(pg, M2_SQL)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:obs_archive_uncovered_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)).toBe(antes)
    } finally { await pg.query('rollback') }
  })
})
```

(Importações: `tenta` de `../helpers/mg6` e `M2_SQL` de `../helpers/m2`, ao lado das que já estão no topo.)

Run: `HAS_LOCAL_DB=1 … npx vitest run test/integration/manutencao-m2-e10.test.ts --no-file-parallelism`
Expected: FAIL no item 13 (o corpo instalado não tem `relispartition` e a lista traz as partições de `obs_part`), no item 14 (chaves `obs_part.*` no top ou `competitor_bytes` menor que a série) e no caso do bloco 11 (o bloco ainda não existe: o SQL não recusa).

- [ ] **Step 2: Texto entregue à E10 (não aplicar aqui)**

O SQL abaixo vai, literal, no arquivo de entrega (Interfaces). A M2 não o aplica na fixture. Em `a5-e10-mg6.sql`, no `select` final de `obs_archive_uncovered()` (hoje `:403-405`), a E10 acrescenta a cláusula:

```sql
   where not c.relispartition
     and not (n.nspname = 'public' and c.relname::text in (select r.table_name from public.obs_archive_registry() r))
     and not (n.nspname = 'public' and c.relname::text in (select e.table_name from public.obs_archive_excluded() e));
```

E troca em `obs_db_size_record` (hoje `:158-174`) as duas leituras por:

```sql
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'competitor\_%'), 0)::bigint,
         coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'yt\_own\_%' or m.mae like 'yt\_reporting\_%'), 0)::bigint
    into v_comp, v_own
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      select case
               when c.relispartition then (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
               when n.nspname = 'obs_part' then pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
               else c.relname::text
             end as mae
    ) m
   where n.nspname in ('public', 'obs_part') and c.relkind in ('r', 'p');
  select coalesce(jsonb_object_agg(z.nome, z.bytes), '{}'::jsonb) into v_top
    from (
      select y.nome, sum(y.bytes)::bigint as bytes
        from (
          select case
                   when c.relispartition then 'public.' || (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
                   when n.nspname = 'obs_part' then 'public.' || pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
                   else n.nspname || '.' || c.relname
                 end as nome,
                 pg_catalog.pg_total_relation_size(c.oid) as bytes
            from pg_catalog.pg_class c
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where c.relkind in ('r', 'm', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
        ) y
       group by y.nome
       order by 2 desc, 1
       limit 30
    ) z;
```

(O nome `<tabela>_<AAAAMM>_saida` da destacada é contrato com a M3b: o `detach` dela renomeia assim.)

- [ ] **Step 3: Recriação condicional no rascunho da M2 (se a MG6 chegar antes, sem o conserto)**

Acrescentar logo **antes** do bloco `-- 12. A conversão das três séries` do rascunho (a recusa por md5 é pré-condição: falha antes de mexer em três tabelas):

```sql
-- 11. Pedidos 1 e 3: se a MG6 da E10 já estiver aplicada sem o conserto, recria as duas funções com ele.
--     Função ausente: nada (o teste das migrations segura a ordem inversa). Corpo diferente do conhecido e sem o conserto: recusa.
do $$
declare
  v_src text;
begin
  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.obs_archive_uncovered()');
  if v_src is not null and v_src !~ 'relispartition' then
    if pg_catalog.md5(v_src) <> '04acb555daf84c61933b740e13a85e21' then
      raise exception 'M2:obs_archive_uncovered_divergente' using errcode = 'P0001',
        detail = 'o corpo instalado não é o da fixture de 14/10: copiar o corpo instalado com a cláusula do pedido 1 para esta migration';
    end if;
    execute $f$
create or replace function public.obs_archive_uncovered()
returns text[]
language sql
stable
security definer
set search_path = ''
as $b$
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid
      from pg_catalog.pg_constraint k
      join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(array_agg(c.relname::text order by c.relname::text), '{}'::text[])
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where not c.relispartition
     and not (n.nspname = 'public' and c.relname::text in (select r.table_name from public.obs_archive_registry() r))
     and not (n.nspname = 'public' and c.relname::text in (select e.table_name from public.obs_archive_excluded() e));
$b$;
$f$;
  end if;

  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.obs_db_size_record(timestamp with time zone)');
  if v_src is not null and v_src !~ 'relispartition' then
    if pg_catalog.md5(v_src) <> '3b6daeff58c7e884d8b6e944c8e234a7' then
      raise exception 'M2:obs_db_size_record_divergente' using errcode = 'P0001',
        detail = 'o corpo instalado não é o da fixture de 14/10: copiar o corpo instalado com o conserto do pedido 3 para esta migration';
    end if;
    execute $f$
create or replace function public.obs_db_size_record(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $b$
declare
  v_day date;
  v_db bigint;
  v_comp bigint;
  v_own bigint;
  v_top jsonb;
begin
  if p_now is null then
    raise exception 'E10:parametro_nulo: obs_db_size_record' using errcode = '22023';
  end if;
  v_day := (p_now at time zone 'America/Sao_Paulo')::date;
  v_db := pg_catalog.pg_database_size(pg_catalog.current_database());
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'competitor\_%'), 0)::bigint,
         coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'yt\_own\_%' or m.mae like 'yt\_reporting\_%'), 0)::bigint
    into v_comp, v_own
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      select case
               when c.relispartition then (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
               when n.nspname = 'obs_part' then pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
               else c.relname::text
             end as mae
    ) m
   where n.nspname in ('public', 'obs_part') and c.relkind in ('r', 'p');
  select coalesce(jsonb_object_agg(z.nome, z.bytes), '{}'::jsonb) into v_top
    from (
      select y.nome, sum(y.bytes)::bigint as bytes
        from (
          select case
                   when c.relispartition then 'public.' || (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
                   when n.nspname = 'obs_part' then 'public.' || pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
                   else n.nspname || '.' || c.relname
                 end as nome,
                 pg_catalog.pg_total_relation_size(c.oid) as bytes
            from pg_catalog.pg_class c
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where c.relkind in ('r', 'm', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
        ) y
       group by y.nome
       order by 2 desc, 1
       limit 30
    ) z;
  insert into public.obs_db_size_daily as d (day, db_bytes, competitor_bytes, own_bytes, measured_at, top_relations)
  values (v_day, v_db, v_comp, v_own, p_now, v_top)
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, competitor_bytes = excluded.competitor_bytes, own_bytes = excluded.own_bytes,
        measured_at = excluded.measured_at, top_relations = excluded.top_relations;
  return jsonb_build_object('day', v_day, 'db_bytes', v_db, 'competitor_bytes', v_comp, 'own_bytes', v_own, 'measured_at', p_now);
end $b$;
$f$;
  end if;
end $$;
```

O segundo `execute` é a função `obs_db_size_record` da fixture de 14/10 com o conserto do Step 2, com o delimitador do corpo trocado de `$$` para `$b$` (MEDIDO: recria e roda, seção "Fatos"). Os dois md5 não se conferem à mão: enquanto a fixture não for consertada pela E10, o teste da Tarefa 4 instala o corpo dela e o caminho de recriar roda em toda passada (o md5 se confirma sozinho); o caso "bloco 11" prova a recusa.

- [ ] **Step 4: Rodar os testes da M2 e os da E10**

Run: `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m2-e10.test.ts test/integration/observatorio-a5-e10-migration.test.ts test/integration/observatorio-a5-e10-rls.test.ts test/integration/observatorio-a5-e4-migration.test.ts test/manutencao/migrations-leitura.test.ts --no-file-parallelism > /tmp/m2-e10.log 2>&1; grep -E "FAIL|✗|Tests " /tmp/m2-e10.log`
Expected: PASS em todos, depois de a E10 confirmar a entrega (inclusive a linha :340). Sem a confirmação, este passo espera: não editar o arquivo da E10. (Rodar com saída em arquivo: a suíte da E10 é longa.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m2-e10.test.ts
git commit -m "feat: o rascunho da M2 recria obs_archive_uncovered e obs_db_size_record sabendo de partição (pedidos 1 e 3; M2, itens 13 e 14)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m2.sql apps/web/test/integration/manutencao-m2-e10.test.ts
```

---

### Task 5: aplicar nos bancos locais e provar pela API (itens 9 e 72)

**Files:**
- Create: `apps/web/test/integration/manutencao-m2-api.test.ts`

**Interfaces:**
- Consumes: `gravarLeituras` (`apps/web/src/lib/youtube/horaria/gravar.ts:273`), `Alvo` (`horaria/lista.ts:34`), `Contagem` (`horaria/leitura.ts:15`); o rascunho da M2 aplicado de vez no `bythiago_int`, com a semente do passado.

- [ ] **Step 1: Aplicar o rascunho nos dois Supabase locais, no mesmo comando que a semente do passado**

**Pré-condição:** a linha "E10 confirmou a entrega" no ledger (Tarefa 4). Sem ela, este passo espera: com as séries convertidas e a fixture da E10 sem a cláusula, os testes da E10 que afirmam `obs_archive_uncovered() = '{}'` e o da linha `:340` quebram no banco compartilhado.

O `bythiago_int` (54422) e o do navegador (54322) recebem o rascunho por `psql -f` e, **no mesmo comando**, a semente do passado (nenhum passo converte de vez as séries antes de a semente estar lá). A versão **não** se registra em `supabase_migrations.schema_migrations` aqui: o arquivo da migration ainda não existe (TRAVA M2-1); isso entra na Tarefa 8, Step 0. Antes, avisar no ledger da fase: "M2 aplicada nos bancos locais às HH:MM; testes que gravam série em mês sem partição passam a falhar alto". Comandos (o agente roda; é banco local):

```bash
F=supabase/rascunhos/m2.sql
for P in 54422 54322; do
  { PGPASSWORD=postgres /opt/homebrew/bin/psql -h 127.0.0.1 -p $P -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -f "$F" -f <(sed -n '/Manutenção M2: 36 meses/,$p' supabase/seeds/dev.sql); } > /tmp/m2-$P.log 2>&1
  echo "porta $P: $?"
done
```

(`-1`: o rascunho e a semente numa transação só; se a semente falhar, a conversão também volta.)

Expected: `porta 54422: 0` e `porta 54322: 0`. Conferir: `select table_name, months_ahead from public.obs_partitions_months_ahead()` dá 12 nas três, nas duas portas, e `select count(*) from pg_inherits where inhparent = 'public.competitor_video_daily'::regclass` no 54422 dá 36 + 13 = 49 ou mais.

- [ ] **Step 2: Escrever o teste da API**

```ts
// apps/web/test/integration/manutencao-m2-api.test.ts
// @vitest-environment node
/**
 * Manutenção M2, itens 9 e 72, pela API (54421) com a M2 aplicada de vez. Semeia o SEU site/canal/vídeo, commita e apaga no fim.
 * 9: upsert com onConflict pelas colunas da chave funciona na particionada; gravação em mês sem partição falha alto e a
 *    leitura horária devolve falhouCruas (a tarefa vira erro 'gravacao_falhou', horaria/executar.ts:211), nunca "ok".
 * 72: a leitura embutida competitor_videos!inner pela API e a leitura como authenticated pela mãe, com as partições revogadas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb, localSupabaseUrl } from '../helpers/db-skip'
import { criarSite, criarCanal, criarVideo, criarUsuario, escalar } from '../helpers/mg6'
import { M2_EM_MIGRATION, m2NoBanco } from '../helpers/m2'
import { gravarLeituras } from '@/lib/youtube/horaria/gravar'
import type { Alvo } from '@/lib/youtube/horaria/lista'
import type { Contagem } from '@/lib/youtube/horaria/leitura'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
// Pula até a conversão existir no banco (rascunho aplicado no Step 1, ou a migration pelo `db reset` da CI depois da Tarefa 8,
// Step 0). Com M2_EM_MIGRATION = true a condição volta a ser só a do banco: migration ausente FALHA, não pula (sem verde falso).
const pular = skipIfNoLocalDb() || (!M2_EM_MIGRATION && !(await m2NoBanco(PG_URL)))

describe.skipIf(pular)('M2 pela API (pula até a conversão existir no banco)', () => {
  let pg: Client
  let sb: SupabaseClient
  let site = '', org = '', canal = '', video = '', editor = ''
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    sb = createClient(localSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
    const s = await criarSite(pg); site = s.site; org = s.org
    canal = await criarCanal(pg, site)
    video = await criarVideo(pg, canal, 3)
    editor = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [site, editor])
  })
  afterAll(async () => {
    await pg.query(`delete from public.sites where id = $1`, [site])
    await pg.query(`delete from public.organizations where id = $1`, [org])
    await pg.query(`delete from auth.users where id = $1`, [editor])
    await pg.end()
  })

  it('item 9: upsert pela chave funciona e repetir não duplica', async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    const linha = { video_id: video, snap_date: hoje, views: 10, taken_at: new Date().toISOString() }
    const r1 = await sb.from('competitor_video_daily').upsert([linha], { onConflict: 'video_id,snap_date', ignoreDuplicates: true }).select('video_id')
    expect(r1.error).toBeNull()
    const r2 = await sb.from('competitor_video_daily').upsert([linha], { onConflict: 'video_id,snap_date', ignoreDuplicates: true }).select('video_id')
    expect(r2.error).toBeNull()
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1`, [video])).toBe(1)
  })

  it('item 9: upsert da diária em mês sem partição falha alto com 23514 (a coleta diária lança, competitor-sync.ts:862)', async () => {
    const longe = new Date(Date.now() + 15 * 31 * 24 * 3_600_000).toISOString().slice(0, 10) // além dos 12 meses criados
    const r = await sb.from('competitor_video_daily').upsert([{ video_id: video, snap_date: longe, views: 1, taken_at: new Date().toISOString() }], { onConflict: 'video_id,snap_date' })
    expect(r.error?.code).toBe('23514')
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1 and snap_date = $2::date`, [video, longe])).toBe(0)
  })

  it('item 9: leitura horária em mês sem partição falha alto (falhouCruas), nada gravado', async () => {
    const longe = Date.now() + 15 * 31 * 24 * 3_600_000 // 15 meses à frente: além dos 12 criados
    const alvo: Alvo = { ytId: 'yt-' + video.slice(0, 8), tipo: 'concorrente', uuid: video, canalId: canal, siteId: site, publishedAt: new Date(longe - 30 * 24 * 3_600_000).toISOString(), descobertoEm: null }
    const contagem: Contagem = { ytId: alvo.ytId, lidoEm: new Date(longe).toISOString(), views: 5, likes: null, comments: null, privacidade: null }
    const r = await gravarLeituras(sb, [alvo], [contagem], { agoraMs: longe, podeGravar: () => true })
    expect(r.falhouCruas).toBe(true)
    expect(r.cruas).toBe(0)
    expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_hourly where video_id = $1`, [video])).toBe(0)
  })

  it('item 72: a leitura embutida competitor_videos!inner pela API devolve a linha do site', async () => {
    const { data, error } = await sb.from('competitor_video_daily')
      .select('snap_date, taken_at, competitor_videos!inner(competitor_channels!inner(site_id))')
      .eq('competitor_videos.competitor_channels.site_id', site)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('item 72: authenticated lê pela mãe (RLS da mãe), e não lê a partição diretamente', async () => {
    await pg.query('begin')
    try {
      // o nome se calcula ANTES de trocar de papel: authenticated não tem execute em obs_part.* (chamar derruba o Postgres local)
      const part = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_daily', obs_part.mes_corrente_sp())`)
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: editor, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [site])
      await pg.query('set local role authenticated')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily where video_id = $1`, [video])).toBe(1)
      await pg.query('savepoint s2')
      await expect(pg.query(`select count(*) from obs_part.${part}`)).rejects.toThrow(/permission denied/)
      await pg.query('rollback to savepoint s2')
    } finally { await pg.query('rollback') }
  })
})
```

- [ ] **Step 3: Rodar o teste novo e a pasta de integração inteira**

Run: `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ --no-file-parallelism > /tmp/m2-int.log 2>&1; grep -E "FAIL|Tests |Test Files" /tmp/m2-int.log`
Expected: PASS na pasta toda. Falha com "no partition of relation": o teste grava fora dos 36 meses de passado ou dos 12 à frente; se o teste é desta etapa, o conserto é criar a partição dele no próprio teste com `obs_part.criar_particao`, nunca partição `DEFAULT`; se é de outra trilha, vai ao controlador dela por escrito (a M2 não edita arquivo de outra trilha).

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/integration/manutencao-m2-api.test.ts
git commit -m "test: tabela particionada pela API, upsert pela chave, gravação sem partição falha alto (M2, itens 9 e 72)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/test/integration/manutencao-m2-api.test.ts
```

---

### Task 6: a tarefa diária `particoes_a_frente` (o chamador de `obs_partitions_ensure`)

**Pré-condição (TRAVA M2-2):** a migration da M2 está em produção e conferida, e o ledger tem a linha "TRAVA M2-2 solta em <data hora>" (Tarefa 8, Step 3). Antes disso esta tarefa **não começa** (nem fica na árvore sem commit).

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts`
- Create: `apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts`
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts`
- Modify: `apps/web/src/lib/youtube/agenda/executar.ts:33-34`
- Modify: `apps/web/test/youtube/agenda/catalogo.test.ts:154-176`
- Create: `apps/web/test/youtube/agenda/particoes-a-frente.test.ts`

**Interfaces:**
- Produces: `DEFINICAO_PARTICOES_A_FRENTE: Definicao`, `DEFINICOES_MANUTENCAO: readonly Definicao[]` (em `definicoes.ts`); `particoesAFrente: Tarefa` e `MESES_A_FRENTE_ALVO = 12` (em `tarefas/particoes-a-frente.ts`). Nome da tarefa: `'particoes_a_frente'` (o vigia da Tarefa 7 lê o `ultimoOk` dela por este nome).

- [ ] **Step 1: Escrever os testes (falham: a definição não existe)**

```ts
// apps/web/test/youtube/agenda/particoes-a-frente.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { particoesAFrente, MESES_A_FRENTE_ALVO } from '@/lib/youtube/agenda/tarefas/particoes-a-frente'
import { CATALOGO } from '@/lib/youtube/agenda/catalogo'
import { TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import { antesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

type Resp = { data: unknown; error: { code: string; message: string } | null }
function ctx(resp: Resp | 'lanca'): { c: ContextoTarefa; chamadas: Array<{ fn: string; args: unknown }> } {
  const chamadas: Array<{ fn: string; args: unknown }> = []
  const sb = {
    rpc: (fn: string, args: unknown) => {
      chamadas.push({ fn, args })
      return { abortSignal: () => (resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)) }
    },
  } as unknown as SupabaseClient
  return { c: { t0: 0, agora: () => 0, apiKey: '', sb, linhas: null }, chamadas }
}
const TRES = [
  { table_name: 'competitor_video_daily', last_month: '2027-10-01', created: 0 },
  { table_name: 'competitor_video_early', last_month: '2027-10-01', created: 1 },
  { table_name: 'competitor_video_hourly', last_month: '2027-10-01', created: 0 },
]

describe('particoes_a_frente no catálogo (item 10: falha se a tarefa que chama ensure não existir)', () => {
  it('existe no catálogo, na lista do vigia e em antesDoLoteAntigo, nuncaDesliga, devida a partir das 06:00 de SP', () => {
    expect(CATALOGO.map(t => t.nome)).toContain('particoes_a_frente')
    expect(TODAS_AS_DEFINICOES.map(d => d.nome)).toContain('particoes_a_frente')
    expect(antesDoLoteAntigo.map(t => t.nome)).toContain('particoes_a_frente')
    expect(TODAS_AS_DEFINICOES.find(d => d.nome === 'particoes_a_frente')).toMatchObject({
      peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 6, nuncaDesliga: true, tetoTentativas: 12,
    })
  })
})

describe('particoes_a_frente: o que roda', () => {
  it('chama obs_partitions_ensure com 12 meses e termina ok com as criadas', async () => {
    const { c, chamadas } = ctx({ data: TRES, error: null })
    const r = await particoesAFrente.rodar(c)
    expect(chamadas).toEqual([{ fn: 'obs_partitions_ensure', args: { p_months_ahead: MESES_A_FRENTE_ALVO } }])
    expect(r).toEqual({ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { criadas: 1 } })
  })
  it('função ausente (migration não aplicada): erro funcao_ausente, nunca ok', async () => {
    for (const code of ['PGRST202', '42883']) {
      const r = await particoesAFrente.rodar(ctx({ data: null, error: { code, message: 'x' } }).c)
      expect(r).toMatchObject({ estado: 'erro', motivo: 'funcao_ausente' })
    }
  })
  it('tabela ainda não particionada ou outro erro do banco: erro banco_recusou', async () => {
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: 'P0001', message: 'M2:tabela_nao_particionada: competitor_video_early' } }).c)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'banco_recusou' })
  })
  it('resposta vazia, fora da forma ou sem uma das três: erro resposta_invalida', async () => {
    for (const data of [null, [], [TRES[0], TRES[1]], [{ ...TRES[0], last_month: null }, TRES[1], TRES[2]], 'x']) {
      const r = await particoesAFrente.rodar(ctx({ data, error: null }).c)
      expect(r, JSON.stringify(data)).toMatchObject({ estado: 'erro', motivo: 'resposta_invalida' })
    }
  })
  it('exceção (rede): erro inesperado, sem texto de fora', async () => {
    const r = await particoesAFrente.rodar(ctx('lanca').c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' })
  })
  it('prazo estourado (AbortSignal.timeout volta como error, não lança): erro prazo, nunca banco_recusou', async () => {
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: '', message: 'AbortError: This operation was aborted' } }).c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'prazo' })
  })
})
```

Em `apps/web/test/youtube/agenda/catalogo.test.ts`, trocar as expectativas da lista única (linhas 168-175) por:

```ts
  it('são seis, em ordem, e as do catálogo e as do vigia vêm do mesmo lugar (catalogo re-exporta o módulo leve)', () => {
    expect(TODAS_AS_DEFINICOES.map(d => d.nome)).toEqual(['leitura_horaria', 'anular_identidade', 'sincronizar_canais', 'retratos_comentarios', 'serie_semanal', 'particoes_a_frente'])
    expect(TODAS_AS_DEFINICOES.map(d => d.ordem)).toEqual([1, 2, 6, 7, 8, 10])
    expect(DEFINICOES_COMENTARIOS.map(d => d.nome)).toEqual(['anular_identidade', 'retratos_comentarios'])
    expect(DEFINICOES.length).toBe(3)
    expect(TODAS_AS_DEFINICOES.length).toBe(DEFINICOES.length + DEFINICOES_COMENTARIOS.length + DEFINICOES_MANUTENCAO.length)
  })
```

e acrescentar `DEFINICOES_MANUTENCAO` à importação de `@/lib/youtube/agenda/definicoes` (linha 6).

Run (em `apps/web`): `npx vitest run test/youtube/agenda/ > /tmp/m2-agenda.log 2>&1; grep -E "FAIL|Tests " /tmp/m2-agenda.log`
Expected: FAIL (`particoes-a-frente` não existe).

- [ ] **Step 2: A definição**

Em `definicoes.ts`, depois de `DEFINICOES_COMENTARIOS` (e acrescentando `BANCO_MS` à importação de `./relogio`):

```ts
/**
 * `particoes_a_frente` (manutenção M2, spec 02 §10.2 e §10.6): cria, uma vez por dia, as partições que faltam das três séries até 12 meses à
 * frente (`obs_partitions_ensure`). Do tipo que não desliga: sem partição, a coleta grava lacuna (a hora não lida não volta). Ordem 10: as
 * ordens 3 a 5 estão reservadas pela A5 (`soma_do_mapa`, `tamanho_do_banco`, `podas`). Quem a cobra além da tolerância é o invariante
 * "meses à frente" (`agenda/particoes.ts`), vermelho com a tarefa parada há mais de 72 h.
 */
export const DEFINICAO_PARTICOES_A_FRENTE: Definicao = {
  nome: 'particoes_a_frente', rotulo: 'partições à frente', ordem: 10, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 6,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: LEVE_COMECA_ATE_MS + BANCO_MS + 5_000, nuncaDesliga: true,
  motivos: {
    funcao_ausente: 'a função de partições não existe no banco (migration da M2 não aplicada)',
    prazo: 'o banco não respondeu a tempo',
    banco_recusou: 'o banco recusou criar as partições',
    resposta_invalida: 'resposta do banco fora da forma esperada',
    inesperado: 'a criação de partições falhou com erro inesperado (ver Sentry)',
  },
}

/** As tarefas da fase de manutenção. */
export const DEFINICOES_MANUTENCAO: readonly Definicao[] = [DEFINICAO_PARTICOES_A_FRENTE]
```

E trocar a lista única:

```ts
export const TODAS_AS_DEFINICOES: readonly Definicao[] = [...DEFINICOES, ...DEFINICOES_COMENTARIOS, ...DEFINICOES_MANUTENCAO].sort((a, b) => a.ordem - b.ordem)
```

- [ ] **Step 3: A tarefa**

```ts
// apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts
import * as Sentry from '@sentry/nextjs'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { DEFINICAO_PARTICOES_A_FRENTE } from '../definicoes'
import { BANCO_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** Quantos meses à frente a tarefa garante (o mesmo número da conversão). */
export const MESES_A_FRENTE_ALVO = 12
const TABELAS = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const

interface LinhaEnsure { table_name: string; last_month: string; created: number }

function ler(data: unknown): LinhaEnsure[] | null {
  if (!Array.isArray(data)) return null
  const linhas: LinhaEnsure[] = []
  for (const x of data) {
    if (typeof x !== 'object' || x === null) return null
    const o = x as Record<string, unknown>
    if (typeof o.table_name !== 'string' || typeof o.last_month !== 'string' || typeof o.created !== 'number' || !Number.isInteger(o.created)) return null
    linhas.push({ table_name: o.table_name, last_month: o.last_month, created: o.created })
  }
  const nomes = new Set(linhas.map(l => l.table_name))
  return TABELAS.every(t => nomes.has(t)) && linhas.length === TABELAS.length ? linhas : null
}

/**
 * Chama `obs_partitions_ensure(12)`. Nenhuma exceção chega ao despachante e nenhum texto do banco sai daqui (só código de catálogo).
 * Sem dado (resposta vazia, sem uma das três, `last_month` nulo): `resposta_invalida`, nunca `ok`.
 */
export const particoesAFrente: Tarefa = {
  ...DEFINICAO_PARTICOES_A_FRENTE,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const { data, error } = await c.sb.rpc('obs_partitions_ensure', { p_months_ahead: MESES_A_FRENTE_ALVO }).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (error) {
        if (/abort/i.test(String(error.message ?? ''))) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'prazo' }
        const codigo = typeof error.code === 'string' ? error.code : ''
        return { estado: 'erro', feitas: 0, deixadas: null, motivo: CODIGOS_SCHEMA_AUSENTE.includes(codigo) ? 'funcao_ausente' : 'banco_recusou' }
      }
      const linhas = ler(data)
      if (!linhas) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'resposta_invalida' }
      const criadas = linhas.reduce((s, l) => s + l.created, 0)
      return { estado: 'ok', feitas: criadas, deixadas: 0, detalhe: { criadas } }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'agenda', tarefa: 'particoes_a_frente' } })
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
```

Em `catalogo.ts`: importar `import { particoesAFrente } from './tarefas/particoes-a-frente'`, re-exportar `DEFINICOES_MANUTENCAO` e `DEFINICAO_PARTICOES_A_FRENTE` no bloco `export { … } from './definicoes'`, e acrescentar `particoesAFrente,` ao fim de `CATALOGO`. Em `executar.ts:33-34`:

```ts
/** As tarefas que rodam ANTES do lote antigo quando a agenda não roda (`OBS_AGENDA=off` ou a MG10 ausente): as `nuncaDesliga` — a anulação de identidade (LGPD) e as partições à frente (M2). */
export const antesDoLoteAntigo: readonly Tarefa[] = [anularIdentidade, particoesAFrente]
```

(com `import { particoesAFrente } from './tarefas/particoes-a-frente'`). No caminho `OBS_AGENDA=off`, `rodarUmaAntes` não olha `aPartirDaHoraSP` (`executar.ts:105-153`): a tarefa roda no primeiro disparo do dia e, com o período fechado `ok`, não roda de novo (`status === 'ok'` → `nao_devida`). O `ensure` é idempotente.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/youtube/agenda/ test/youtube/cron-competitors-agenda.test.ts > /tmp/m2-agenda.log 2>&1; grep -E "FAIL|Tests " /tmp/m2-agenda.log`
Expected: PASS. Se `cron-competitors-agenda.test.ts:36` falhar por listar `antesDoLoteAntigo` com só `anular_identidade`, acrescentar `{ nome: 'particoes_a_frente' }` àquela lista (é o mesmo fato, dito pelo teste). Depois: `npm run typecheck -w apps/web` (ou o script de typecheck do `apps/web/package.json`) sem erro.

- [ ] **Step 5: Commit**

Commit só depois da Tarefa 8, Step 2 (M2 em produção) e da linha "TRAVA M2-2 solta" no ledger. A janela do deploy (a tarefa nova fica `late`, `degraded`, até o primeiro `ok` depois das 06:00 de SP) está declarada no LEIAME da Tarefa 8.

```bash
git add apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts apps/web/test/youtube/agenda/particoes-a-frente.test.ts
git commit -m "feat: tarefa diária particoes_a_frente chama obs_partitions_ensure, nuncaDesliga, a partir das 06:00 de SP (M2, item 10)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/agenda/definicoes.ts apps/web/src/lib/youtube/agenda/catalogo.ts apps/web/src/lib/youtube/agenda/executar.ts apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts apps/web/test/youtube/agenda/catalogo.test.ts apps/web/test/youtube/agenda/particoes-a-frente.test.ts apps/web/test/youtube/cron-competitors-agenda.test.ts
```

---

### Task 7: o invariante "meses à frente" no vigia (item 11)

**Pré-condição (TRAVA M2-2):** a mesma da Tarefa 6. Antes disso esta tarefa **não começa**.

**Files:**
- Create: `apps/web/src/lib/youtube/agenda/particoes.ts`
- Modify: `apps/web/src/lib/youtube/agenda/saude.ts:17-23` (`ItemAgenda.gravidade`)
- Modify: `apps/web/src/lib/ops/cron-health-report.ts:363-412`
- Create: `apps/web/test/youtube/agenda/particoes.test.ts`

**Interfaces:**
- Consumes: `ItemAgenda` (saude.ts), `lerAgendaDoVigia` (devolve o item `particoes_a_frente` com `ultimoOk`), `CODIGOS_SCHEMA_AUSENTE`, `BANCO_MS`, `comPrazo`.
- Produces:
  - `ItemAgenda.gravidade?: 'amarelo' | 'vermelho'` (opcional; quem não preenche compila). No relatório: `vermelho` → `severity: 'critical'` (com `late`, o agregado vira `down`); senão `info` (agregado `degraded`). **A M10a pode usar a mesma gravidade para a consulta de órfãs no vigia (spec 02 §10.8).**
  - `interface LinhaParticao { tabela: string; mesesAFrente: number | null; convertidaEm: string | null }`
  - `lerMesesAFrente(sb: SupabaseClient): Promise<Lido<LinhaParticao[]>>`
  - `avaliarParticoes(lido: Lido<LinhaParticao[]>, ultimoOkTarefa: string | null | undefined, agoraMs: number): ItemAgenda` — nome do item `particoes_meses_a_frente`. `undefined` = a agenda não foi lida (o item da tarefa não veio): passadas as 72 h, o vermelho sai com `MOTIVO_NAO_LIDO`, nunca com "tarefa parada".
  - Constantes: `AMARELO_ABAIXO_DE = 6`, `VERMELHO_ABAIXO_DE = 3`, `TAREFA_PARADA_H = 72`.

- [ ] **Step 1: Escrever os testes (falham: o módulo não existe)**

```ts
// apps/web/test/youtube/agenda/particoes.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { avaliarParticoes, lerMesesAFrente, MOTIVO_NAO_LIDO, type LinhaParticao } from '@/lib/youtube/agenda/particoes'
import { buildCronHealthReport } from '@/lib/ops/cron-health-report'

const H = 3_600_000
const AGORA = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
const linhas = (m: [number | null, number | null, number | null], conv: string | null = iso(AGORA - 10 * 24 * H)): { valor: LinhaParticao[] } => ({
  valor: [
    { tabela: 'competitor_video_daily', mesesAFrente: m[0], convertidaEm: conv },
    { tabela: 'competitor_video_early', mesesAFrente: m[1], convertidaEm: conv },
    { tabela: 'competitor_video_hourly', mesesAFrente: m[2], convertidaEm: conv },
  ],
})
const okRecente = iso(AGORA - 2 * H)

describe('avaliarParticoes: amarelo abaixo de 6, vermelho abaixo de 3', () => {
  it('12, 12, 12 com a tarefa em dia: ok', () => {
    expect(avaliarParticoes(linhas([12, 12, 12]), okRecente, AGORA)).toMatchObject({ nome: 'particoes_meses_a_frente', status: 'ok' })
  })
  it('6 é ok, 5 é amarelo, 3 é amarelo, 2 é vermelho; vale o pior das três', () => {
    expect(avaliarParticoes(linhas([12, 6, 12]), okRecente, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 5, 12]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo' })
    expect(avaliarParticoes(linhas([3, 12, 12]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'amarelo' })
    expect(avaliarParticoes(linhas([12, 12, 2]), okRecente, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
  })
  it('sem dado é vermelho: leitura que falha, schema ausente, lista vazia, tabela fora da lista, não particionada (null), corrente ausente (-1)', () => {
    const v = (x: ReturnType<typeof avaliarParticoes>): void => { expect(x).toMatchObject({ status: 'late', gravidade: 'vermelho' }) }
    v(avaliarParticoes({ porque: 'o banco não respondeu', causa: 'prazo' }, okRecente, AGORA))
    v(avaliarParticoes({ porque: 'x', causa: 'schema_ausente', codigo: 'PGRST202' }, okRecente, AGORA))
    v(avaliarParticoes({ valor: [] }, okRecente, AGORA))
    v(avaliarParticoes({ valor: linhas([12, 12, 12]).valor.slice(0, 2) }, okRecente, AGORA))
    v(avaliarParticoes(linhas([12, null, 12]), okRecente, AGORA))
    v(avaliarParticoes(linhas([12, 12, -1]), okRecente, AGORA))
  })
  it('tarefa parada há mais de 72 h: vermelho mesmo com 12 meses; sem nenhum ok conta desde a conversão', () => {
    expect(avaliarParticoes(linhas([12, 12, 12]), iso(AGORA - 73 * H), AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
    expect(avaliarParticoes(linhas([12, 12, 12]), iso(AGORA - 71 * H), AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 20 * H)), null, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 80 * H)), null, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
    expect(avaliarParticoes(linhas([12, 12, 12], null), null, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho' })
  })
  it('agenda não lida (undefined): até 72 h da conversão ok; depois, vermelho com MOTIVO_NAO_LIDO, nunca "tarefa parada"', () => {
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 20 * H)), undefined, AGORA).status).toBe('ok')
    expect(avaliarParticoes(linhas([12, 12, 12], iso(AGORA - 80 * H)), undefined, AGORA)).toMatchObject({ status: 'late', gravidade: 'vermelho', motivo: MOTIVO_NAO_LIDO, ultimoOk: null })
  })
  it('o motivo é frase fixa, sem número de mês nem texto do banco', () => {
    const x = avaliarParticoes({ porque: 'erro do banco (código XX000) SEGREDO', causa: 'erro_do_banco' }, okRecente, AGORA)
    expect(x.motivo ?? '').not.toMatch(/SEGREDO|XX000/)
  })
})

describe('no relatório: vermelho derruba (down), amarelo degrada', () => {
  it('vermelho → severity critical → down; amarelo → degraded', () => {
    const verm = avaliarParticoes(linhas([12, 12, 2]), okRecente, AGORA)
    const amar = avaliarParticoes(linhas([12, 5, 12]), okRecente, AGORA)
    expect(buildCronHealthReport([], new Date(AGORA), [verm]).status).toBe('down')
    expect(buildCronHealthReport([], new Date(AGORA), [amar]).status).toBe('degraded')
    expect(buildCronHealthReport([], new Date(AGORA), [verm]).lateNames).toContain('agenda:particoes_meses_a_frente')
  })
})

describe('lerMesesAFrente', () => {
  const sb = (resp: { data: unknown; error: { code: string } | null } | 'lanca'): SupabaseClient => ({
    rpc: () => ({ abortSignal: () => (resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)) }),
  }) as unknown as SupabaseClient
  it('lê as três linhas', async () => {
    const r = await lerMesesAFrente(sb({ data: [{ table_name: 'competitor_video_daily', months_ahead: 12, last_month: '2027-10-01', converted_at: null }], error: null }))
    expect(r).toEqual({ valor: [{ tabela: 'competitor_video_daily', mesesAFrente: 12, convertidaEm: null }] })
  })
  it('função ausente: schema_ausente; exceção: excecao; forma estranha: forma_invalida', async () => {
    expect(await lerMesesAFrente(sb({ data: null, error: { code: 'PGRST202' } }))).toMatchObject({ causa: 'schema_ausente' })
    expect(await lerMesesAFrente(sb('lanca'))).toMatchObject({ causa: 'excecao' })
    expect(await lerMesesAFrente(sb({ data: [{ table_name: 1 }], error: null }))).toMatchObject({ causa: 'forma_invalida' })
  })
})
```

Run: `npx vitest run test/youtube/agenda/particoes.test.ts`
Expected: FAIL (módulo ausente).

- [ ] **Step 2: O módulo do invariante**

```ts
// apps/web/src/lib/youtube/agenda/particoes.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { BANCO_MS } from './relogio'
import type { ItemAgenda } from './saude'
import type { Lido } from './tipos'

/**
 * O invariante "meses de partição à frente" (manutenção M2, spec 02 §10.2). Módulo leve: o vigia o lê sem carregar a coleta.
 * Regras, nesta ordem: leitura que falha (inclusive função ausente) → vermelho; tabela que falta, não particionada (null) ou sem o mês
 * corrente (-1) → vermelho; tarefa `particoes_a_frente` sem `ok` há mais de 72 h (sem nenhum ok: desde a conversão; sem conversão
 * registrada: vermelho; agenda não lida, `undefined`: o mesmo prazo, com o motivo "não lido") → vermelho; o pior das três abaixo de 3 → vermelho; abaixo de 6 → amarelo; senão ok. Nunca "12 à frente" sem leitura.
 */
export const AMARELO_ABAIXO_DE = 6
export const VERMELHO_ABAIXO_DE = 3
export const TAREFA_PARADA_H = 72
export const NOME_DO_ITEM = 'particoes_meses_a_frente'
const TABELAS = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const
const H = 3_600_000

export const MOTIVO_NAO_LIDO = 'não foi possível ler as partições à frente'
export const MOTIVO_SEM_PARTICAO = 'tabela sem partição do mês corrente ou não particionada'
export const MOTIVO_TAREFA_PARADA = 'a tarefa de partições à frente não roda há mais de 72 horas'
export const MOTIVO_POUCOS = 'menos de 3 meses de partição à frente'
export const MOTIVO_ALERTA = 'menos de 6 meses de partição à frente'

export interface LinhaParticao { tabela: string; mesesAFrente: number | null; convertidaEm: string | null }

export async function lerMesesAFrente(sb: SupabaseClient): Promise<Lido<LinhaParticao[]>> {
  try {
    const { data, error } = await sb.rpc('obs_partitions_months_ahead').abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) {
      const codigo = typeof error.code === 'string' ? error.code : ''
      return CODIGOS_SCHEMA_AUSENTE.includes(codigo)
        ? { porque: 'função de partições ausente', causa: 'schema_ausente', codigo }
        : { porque: 'erro do banco', causa: 'erro_do_banco' }
    }
    if (!Array.isArray(data)) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
    const out: LinhaParticao[] = []
    for (const x of data as unknown[]) {
      if (typeof x !== 'object' || x === null) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
      const o = x as Record<string, unknown>
      const m = o.months_ahead
      const conv = o.converted_at
      if (typeof o.table_name !== 'string' || !(m === null || (typeof m === 'number' && Number.isInteger(m))) || !(conv === null || typeof conv === 'string')) {
        return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
      }
      out.push({ tabela: o.table_name, mesesAFrente: m, convertidaEm: conv })
    }
    return { valor: out }
  } catch {
    return { porque: 'o banco não respondeu', causa: 'excecao' }
  }
}

const item = (status: ItemAgenda['status'], gravidade: 'amarelo' | 'vermelho' | undefined, motivo: string | undefined, ultimoOk: string | null | undefined): ItemAgenda => ({
  nome: NOME_DO_ITEM, status, ultimoOk: ultimoOk ?? null, toleranciaH: TAREFA_PARADA_H,
  ...(gravidade ? { gravidade } : {}), ...(motivo ? { motivo } : {}),
})

export function avaliarParticoes(lido: Lido<LinhaParticao[]>, ultimoOkTarefa: string | null | undefined, agoraMs: number): ItemAgenda {
  if ('porque' in lido) return item('late', 'vermelho', MOTIVO_NAO_LIDO, ultimoOkTarefa)
  const porTabela = new Map(lido.valor.map(l => [l.tabela, l]))
  const meses: number[] = []
  for (const t of TABELAS) {
    const l = porTabela.get(t)
    if (!l || l.mesesAFrente === null || l.mesesAFrente < 0) return item('late', 'vermelho', MOTIVO_SEM_PARTICAO, ultimoOkTarefa)
    meses.push(l.mesesAFrente)
  }
  const conversoes = lido.valor.map(l => (l.convertidaEm ? Date.parse(l.convertidaEm) : Number.NaN)).filter(n => !Number.isNaN(n))
  const okMs = ultimoOkTarefa ? Date.parse(ultimoOkTarefa) : Number.NaN
  const referencia = !Number.isNaN(okMs) ? okMs : conversoes.length ? Math.max(...conversoes) : Number.NaN
  if (Number.isNaN(referencia) || agoraMs - referencia > TAREFA_PARADA_H * H) {
    return item('late', 'vermelho', ultimoOkTarefa === undefined ? MOTIVO_NAO_LIDO : MOTIVO_TAREFA_PARADA, ultimoOkTarefa)
  }
  const pior = Math.min(...meses)
  if (pior < VERMELHO_ABAIXO_DE) return item('late', 'vermelho', MOTIVO_POUCOS, ultimoOkTarefa)
  if (pior < AMARELO_ABAIXO_DE) return item('late', 'amarelo', MOTIVO_ALERTA, ultimoOkTarefa)
  return item('ok', undefined, undefined, ultimoOkTarefa)
}
```

- [ ] **Step 3: A gravidade no item e a ligação ao relatório**

Em `saude.ts`, na `interface ItemAgenda`, acrescentar:

```ts
  /** Só itens de invariante (M2: meses à frente). 'vermelho' vira severity 'critical' no relatório (late + critical = down). */
  gravidade?: 'amarelo' | 'vermelho'
```

Em `cron-health-report.ts`, em `itemDaAgenda` trocar `severity: 'info',` por `severity: a.gravidade === 'vermelho' ? 'critical' : 'info',` e trocar `lerAgendaParaRelatorio` por:

```ts
import { avaliarParticoes, lerMesesAFrente } from '@/lib/youtube/agenda/particoes'
import { BANCO_MS, comPrazo } from '@/lib/youtube/agenda/relogio'

/**
 * A leitura da agenda para as duas rotas (`/api/health` e `cron-watchdog`), mais o invariante "meses à frente" (M2), que vale sem a E10
 * e com a agenda desligada. Nada aqui lança: leitura que falha vira item `late` (o do invariante, vermelho).
 */
export async function lerAgendaParaRelatorio(sb: SupabaseClient, now: Date): Promise<{ itens: ItemAgenda[]; nota: string | null }> {
  const [agenda, meses] = await Promise.all([
    lerAgendaDoVigia(sb, now.getTime(), process.env),
    comPrazo(lerMesesAFrente(sb), BANCO_MS + 1_000).catch(() => ({ estourou: true as const })),
  ])
  const lido = 'estourou' in meses ? { porque: 'o banco não respondeu', causa: 'prazo' as const } : meses.valor
  // item da tarefa ausente (agenda não lida: uma entrada `leitura`, saude.ts:113) → undefined, e o motivo do vermelho diz "não lido"
  const itemTarefa = agenda.itens.find(i => i.nome === 'particoes_a_frente')
  const ultimoOk = itemTarefa ? itemTarefa.ultimoOk : undefined
  return { itens: [...agenda.itens, avaliarParticoes(lido, ultimoOk, now.getTime())], nota: agenda.nota }
}
```

- [ ] **Step 4: Rodar e ver passar (e as rotas do vigia)**

Run: `npx vitest run test/youtube/agenda/ test/ops/ > /tmp/m2-vigia.log 2>&1; grep -E "FAIL|Tests " /tmp/m2-vigia.log` (se `test/ops/` não existir, `grep -rl "cron-health-report\|cron-watchdog" test` dá a lista).
Expected: PASS. Testes das rotas (`saude.test.ts`, o do `cron-watchdog`) que comparam a lista inteira de itens ganham `agenda:particoes_meses_a_frente`: o mock do `sb.rpc` que responde a qualquer função devolve forma errada para `obs_partitions_months_ahead`, e o item sai vermelho. Conserto no teste: o mock responde `obs_partitions_months_ahead` com as três linhas em 12 e `converted_at` recente, e a expectativa inclui o item `ok`. Depois: typecheck do `apps/web` sem erro.

- [ ] **Step 5: Commit**

Commit só depois da Tarefa 8, Step 2 (M2 em produção) e da linha "TRAVA M2-2 solta" no ledger.

```bash
git add apps/web/src/lib/youtube/agenda/particoes.ts apps/web/test/youtube/agenda/particoes.test.ts
git commit -m "feat: o vigia lê o invariante meses à frente, amarelo abaixo de 6 e vermelho abaixo de 3 (M2, item 11)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/agenda/particoes.ts apps/web/src/lib/youtube/agenda/saude.ts apps/web/src/lib/ops/cron-health-report.ts apps/web/test/youtube/agenda/particoes.test.ts apps/web/test/youtube/agenda/saude.test.ts
```

(Acrescentar ao commit, por caminho, qualquer outro teste de rota consertado no Step 4.)

---

### Task 8: a vez da migration e o dia da M2 em produção (dono: `db:push:prod`, na janela)

Roda logo depois da Tarefa 5 (ordem de execução: T1 → T5 → **T8** → T6 → T7 → T9).

**Files:**
- Create (Step 0, por `npm run db:new manutencao_m2_particoes` + cópia do rascunho): `supabase/migrations/<ts>_manutencao_m2_particoes.sql`
- Delete (Step 0, `git rm` no mesmo commit): `supabase/rascunhos/m2.sql`
- Modify (Step 0): `apps/web/test/helpers/m2.ts` (só `M2_SQL_CAMINHO` e `M2_EM_MIGRATION`)
- Modify (só disco, sem commit): `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (seção "AGORA") e o ledger da fase

**Interfaces:**
- Consumes: as Tarefas 1 a 5 no `staging`, CI verde. As Tarefas 6 e 7 (código que lê a M2) só começam e só são commitadas depois do Step 3 desta tarefa (TRAVA M2-2).
- Produces: M2 em produção e conferida; a linha "TRAVA M2-2 solta" no ledger. **Só depois disto a M10a faz o `db:new` e o `db:push:prod` dela** (o arquivo da M2 tem de existir e estar aplicado para o da M10a ter timestamp posterior).

**O que acontece quando o dado não existe:** sem a confirmação da E10 no ledger, sem CI verde ou sem a saída do item 1b do LEIAME, nada desta tarefa começa e o arquivo da migration não é criado (TRAVA M2-1). Se o item 1b voltar vazio (as consultas não rodaram), o push espera: a conta sem o "antes" não prova nada.

- [ ] **Step 0: A vez da migration (agente, no dia, só depois de TODAS as pré-condições do Step 1 anotadas no ledger; logo antes de escrever o LEIAME; o dono faz o push na mesma sessão)**

```bash
git fetch origin staging
npm run db:new manutencao_m2_particoes
F=$(ls supabase/migrations/*_manutencao_m2_particoes.sql); V=$(basename "$F" | cut -c1-14)
cp supabase/rascunhos/m2.sql "$F"
```

Em `apps/web/test/helpers/m2.ts`, trocar as duas constantes (e só elas) por:

```ts
export const M2_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/migrations', readdirSync(resolve(__dirname, '../../../../supabase/migrations')).find(n => n.endsWith('_manutencao_m2_particoes.sql')) ?? 'manutencao_m2_ausente.sql')
export const M2_EM_MIGRATION = true
```

(com `readdirSync` na importação de `node:fs`). Depois: `git rm supabase/rascunhos/m2.sql`; registrar a versão nos dois bancos locais, que já têm o SQL desde a Tarefa 5, Step 1:

```bash
for P in 54422 54322; do
  PGPASSWORD=postgres /opt/homebrew/bin/psql -h 127.0.0.1 -p $P -U postgres -d postgres -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations (version, name) values ('$V', 'manutencao_m2_particoes') on conflict do nothing"
  echo "porta $P: $?"
done
```

Rodar `npx vitest run test/manutencao/migrations-leitura.test.ts` (a TRAVA M2-1 passa a afirmar "o arquivo existe e o rascunho saiu") e os três arquivos de integração da M2 com banco local: passam. Commit só destes caminhos (`$F` é arquivo novo: `git add` antes, senão o commit por caminho falha):

```bash
git add "$F" apps/web/test/helpers/m2.ts
git commit -m "feat: migration da M2, as três séries particionadas por mês (M2, a vez da migration)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- "$F" supabase/rascunhos/m2.sql apps/web/test/helpers/m2.ts
```

Anotar no ledger o `<ts>` (a M10a depende dele) e "TRAVA M2-1 solta em <data hora>".

- [ ] **Step 1: Pré-condições (o agente confere e anota no ledger ANTES do Step 0; uma falhando, o Step 0 não roda)**
  - CI verde no `staging` com as Tarefas 1 a 5 (inclusive `integration/`). As Tarefas 6 e 7 não começaram (TRAVA M2-2).
  - Pedidos 5 e 6 (§17): texto entregue ao controlador da A5. Recusa ou demora não bloqueia: o teste do item 15 e o `obs_part.dependentes` na migration neutralizam do lado desta fase.
  - Entrega à E10 (Tarefa 4) gravada e confirmada no ledger.
  - No `migration list`, `20261013000001` (agenda) aparece aplicada. Sem ela, o invariante fica vermelho 72 h depois da conversão (`ultimoOk` nunca é gravado): não aplicar a M2 antes.
  - Nenhuma migration nova da A5 que crie dependente das três séries desde 14/10: `grep -l "competitor_video_\(daily\|early\|hourly\)" supabase/migrations/*` depois de `20261013000006`; se houver, ler: view, FK ou função `begin atomic` que as cite faz a migration recusar com `M2:dependente_novo`, e é melhor saber antes.

- [ ] **Step 2: Escrever os comandos do dono no LEIAME**

Seção nova no topo de `LEIAME-COMANDOS.md`:

````markdown
## AGORA: M2, partições (no Mac)

Quando: fora de 08:30 a 10:00 de São Paulo (11:30 a 13:00 UTC) e fora dos minutos 0, 20 e 40 de qualquer hora (exemplo: 14:07).

1. Ver as pendentes. Tem de aparecer **só** a linha `…_manutencao_m2_particoes`. Se aparecer outra, pare e me mande a lista.
```
npx supabase migration list --linked
```
1b. Medir antes (guarde a saída; o item 3c compara).
```
npx supabase db query --linked "select 'competitor_video_daily' t, count(*) n, coalesce(sum(views),0) soma, min(snap_date)::text de, max(snap_date)::text ate, (select pg_get_userbyid(relowner) from pg_class where oid='public.competitor_video_daily'::regclass) dona from public.competitor_video_daily union all select 'competitor_video_early', count(*), coalesce(sum(views),0), min((taken_at at time zone 'America/Sao_Paulo')::date)::text, max((taken_at at time zone 'America/Sao_Paulo')::date)::text, (select pg_get_userbyid(relowner) from pg_class where oid='public.competitor_video_early'::regclass) from public.competitor_video_early union all select 'competitor_video_hourly', count(*), coalesce(sum(views),0), min((hour_slot at time zone 'America/Sao_Paulo')::date)::text, max((hour_slot at time zone 'America/Sao_Paulo')::date)::text, (select pg_get_userbyid(relowner) from pg_class where oid='public.competitor_video_hourly'::regclass) from public.competitor_video_hourly;"
```
Deve dar: `dona` = `postgres` nas três; `ate` no máximo hoje. Se a dona for outra, pare e me mande.
2. Aplicar (pede YES).
```
npm run db:push:prod
```
3. Conferir. Cada uma imprime uma tabela; não precisa me mandar nada se bater com o "deve dar".
```
npx supabase db query --linked "select c.relname, c.relkind, (select count(*) from pg_inherits i where i.inhparent = c.oid) as particoes from pg_class c where c.oid in ('public.competitor_video_daily'::regclass, 'public.competitor_video_early'::regclass, 'public.competitor_video_hourly'::regclass);"
```
Deve dar: as três com `relkind` = `p` e pelo menos 13 partições.
```
npx supabase db query --linked "select n.nspname, c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon_le from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relispartition and n.nspname = 'obs_part' order by 2;"
```
Deve dar: todas em `obs_part`, `relrowsecurity` = `t`, `anon_le` = `f`.
```
npx supabase db query --linked "select * from public.obs_partitions_months_ahead();"
```
Deve dar: `months_ahead` = 12 nas três.
3c. A conta fecha.
```
npx supabase db query --linked "select table_name, rows_copied, views_sum, converted_at from public.obs_partition_conversions order by 1;"
```
Deve dar: `rows_copied` e `views_sum` iguais a `n` e `soma` do item 1b, tabela a tabela (a coleta pode ter gravado entre 1b e 2: diferença só para mais, nunca para menos).
4. Abrir o Observatório no site e uma página de canal: a página de um canal mostra o ponto de hoje na série diária (o mesmo número de views que aparecia antes do push, ou maior).

Se o passo 2 falhar: nada mudou (a conversão é uma transação só). Me mande a mensagem; o código `M2:…` diz o porquê.
Duas falhas não têm código M2: "lock timeout" (alguém estava gravando; nada mudou: repita em outro minuto permitido) e "no partition of relation … found for row" (há linha fora da faixa: me mande a saída do item 1b).

Depois que eu promover a tarefa diária (Tarefas 6 e 7): o `/api/health` pode mostrar `agenda:particoes_a_frente` atrasada (`degraded`) até a primeira rodada depois das 06:00 de São Paulo. É esperado; vermelho não é.

### Se precisar voltar (só até o sétimo dia, enquanto as tabelas `_antiga` existem)

No SQL do painel do Supabase (exceção do `05` §16), numa vez só:
```
begin; set local lock_timeout = '5s'; select obs_part.desfazer('public.competitor_video_daily'::regclass); select obs_part.desfazer('public.competitor_video_early'::regclass); select obs_part.desfazer('public.competitor_video_hourly'::regclass); commit; notify pgrst, 'reload schema';
```
Deve dar: três linhas com `"feito": true`. As séries voltam a tabelas comuns, com tudo o que foi gravado depois do push; as particionadas ficam de lado como `…_particionada`, sem acesso pela API. Depois disso o vigia mostra `agenda:particoes_meses_a_frente` vermelho: é o certo (a M2 não está mais de pé); me avise para eu tirar a tarefa e o item. Se der erro `M2:…`: nada mudou; me mande a mensagem.
````

- [ ] **Step 3: Depois da conferência do dono**
  - Ledger: hora do push, as saídas dos itens 1b, 3 e 3c lado a lado, `converted_at`, e a linha **"TRAVA M2-2 solta em <data hora>"**. **Liberar a M10a** (o `db:new` e o push dela).
  - Executar as Tarefas 6 e 7; commitá-las no `staging` (só agora, com a M2 aplicada e conferida), conferir a CI e promover para `main` (regra do projeto: push e promoção são do agente), conferir a CI do push.
  - No dia seguinte, depois das 06:00 de SP: `agenda:particoes_a_frente` com `ok` e `agenda:particoes_meses_a_frente` `ok` no `/api/health` (leitura).
  - Registrar, para o item 12 do aceite: a data de medida é 28 dias depois de a leitura horária começar a gravar, ou 15/12/2026, o que vier primeiro.

- [ ] **Step 4: Nada de `.superpowers/` vai a commit.** `.superpowers/` está no `.gitignore` e `git commit -- <caminho ignorado>` falha com `pathspec ... did not match`. O `LEIAME-COMANDOS.md`, a entrega à E10 e o ledger ficam só no disco desta máquina. O único commit desta tarefa é o do Step 0.

---

### Task 9: no sétimo dia, remover as tabelas antigas

**Files:**
- Create (só no sétimo dia depois do push da Tarefa 8, por `npm run db:new manutencao_m2_remove_antigas`): `supabase/migrations/<ts>_manutencao_m2_remove_antigas.sql`
- Modify: `apps/web/test/integration/manutencao-m2-particoes.test.ts` (um caso)

**Interfaces:**
- Consumes: `public.obs_partition_conversions` (Tarefa 2).

- [ ] **Step 1: Escrever o teste da guarda (falha: a migration não existe)**

```ts
describe.skipIf(skipIfNoLocalDb())('M2, sétimo dia: a remoção das antigas', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  // no topo do arquivo: import { readdirSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
  //                     import { PASTA_DAS_MIGRATIONS } from '../helpers/migrations'
  const SQL = (): string => {
    const f = readdirSync(PASTA_DAS_MIGRATIONS).find(n => n.endsWith('_manutencao_m2_remove_antigas.sql'))
    if (!f) throw new Error('migration de remoção ausente')
    return readFileSync(join(PASTA_DAS_MIGRATIONS, f), 'utf8')
  }
  it('recusa com linhas e menos de 7 dias; recusa se a antiga ganhou linha; remove com 7; antiga vazia sai já; sem antiga não faz nada', async () => {
    await pg.query('begin')
    try {
      await aplicarM2(pg)
      // cenário próprio: uma _antiga com 1 linha e o registro dela
      await pg.query(`drop table if exists public.competitor_video_daily_antiga`)
      await pg.query(`create table public.competitor_video_daily_antiga (like public.competitor_video_daily)`)
      const { site } = await criarSite(pg)
      const video = await criarVideo(pg, await criarCanal(pg, site), 3)
      await pg.query(`insert into public.competitor_video_daily_antiga (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now())`, [video])
      await pg.query(`insert into public.obs_partition_conversions (table_name, old_table, partition_column, converted_at, rows_copied, views_sum)
        values ('public.competitor_video_daily', 'public.competitor_video_daily_antiga', 'snap_date', now() - interval '6 days', 1, 1)
        on conflict (table_name) do update set old_table = excluded.old_table, converted_at = excluded.converted_at, rows_copied = 1, views_sum = 1`)
      await pg.query(`delete from public.obs_partition_conversions where table_name <> 'public.competitor_video_daily'`)
      await pg.query('savepoint s')
      const r = await tenta(pg, SQL()); expect(r.ok).toBe(false); if (!r.ok) expect(r.message).toMatch(/M2:antes_do_setimo_dia/)
      await pg.query('rollback to savepoint s')
      await pg.query(`update public.obs_partition_conversions set converted_at = now() - interval '7 days 1 minute'`)
      await pg.query(`insert into public.competitor_video_daily_antiga (video_id, snap_date, views, taken_at) values ($1, current_date - 1, 2, now())`, [video])
      await pg.query('savepoint s2')
      const r2 = await tenta(pg, SQL()); expect(r2.ok).toBe(false); if (!r2.ok) expect(r2.message).toMatch(/M2:antiga_mudou/)
      await pg.query('rollback to savepoint s2')
      await pg.query(SQL())
      expect(await escalar<string | null>(pg, `select to_regclass('public.competitor_video_daily_antiga')::text`)).toBeNull()
      await pg.query(SQL()) // sem antiga: nada
      // antiga vazia com menos de 7 dias sai já (é o caso de todo banco novo: CI e db reset)
      await pg.query(`create table public.competitor_video_daily_antiga (like public.competitor_video_daily)`)
      await pg.query(`update public.obs_partition_conversions set converted_at = now(), rows_copied = 0, views_sum = 0`)
      await pg.query(SQL())
      expect(await escalar<string | null>(pg, `select to_regclass('public.competitor_video_daily_antiga')::text`)).toBeNull()
    } finally { await pg.query('rollback') }
  })
})
```

- [ ] **Step 2: A migration**

```sql
-- =============================================================================
-- MIGRATION: manutenção M2, sétimo dia: remove as três tabelas antigas (a volta atrás da conversão).
-- Guarda: recusa se alguma conversão COM LINHAS tem menos de 7 dias, ou se a antiga não tem exatamente as linhas copiadas
-- (alguém gravou nela depois). Sem a antiga: nada a fazer.
-- =============================================================================
set lock_timeout = '5s';
do $$
declare
  r record;
  v_n bigint;
begin
  for r in select c.table_name, c.old_table, c.converted_at, c.rows_copied from public.obs_partition_conversions c
            where c.table_name in ('public.competitor_video_daily', 'public.competitor_video_early', 'public.competitor_video_hourly') loop
    if pg_catalog.to_regclass(r.old_table) is null then continue; end if;
    -- antiga vazia não é volta atrás de nada: sai já (é o caso de todo banco novo: CI, db reset, e a early e a horária de hoje)
    if r.rows_copied > 0 and r.converted_at > pg_catalog.now() - interval '7 days' then
      raise exception 'M2:antes_do_setimo_dia: %', r.table_name using errcode = 'P0001', detail = 'convertida em ' || r.converted_at::text;
    end if;
    execute pg_catalog.format('select count(*) from %s', r.old_table) into v_n;
    if v_n <> r.rows_copied then
      raise exception 'M2:antiga_mudou: %', r.old_table using errcode = 'P0001', detail = pg_catalog.format('%s linhas; copiadas %s', v_n, r.rows_copied);
    end if;
    execute pg_catalog.format('drop table %s', pg_catalog.to_regclass(r.old_table)::text);
  end loop;
end $$;
notify pgrst, 'reload schema';
```

- [ ] **Step 3: Rodar e ver passar**

Run: o comando da Tarefa 2, só este arquivo.
Expected: PASS, com as 9 afirmações rodando também na CI (o cenário é montado pelo teste; não depende de o banco ainda ter as antigas). Com a guarda de `rows_copied > 0` desfeita, o último caso falha. Conferir também: `npm run db:reset` num banco local com as duas migrations termina sem erro, e `to_regclass('public.competitor_video_daily_antiga')` dá nulo.

- [ ] **Step 4: Commit e comandos do dono**

```bash
git add supabase/migrations/<ts>_manutencao_m2_remove_antigas.sql
git commit -m "feat: remove as tabelas antigas das três séries no sétimo dia, com guarda de data e de contagem (M2)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/migrations/<ts>_manutencao_m2_remove_antigas.sql apps/web/test/integration/manutencao-m2-particoes.test.ts
```

No LEIAME, a mesma sequência da Tarefa 8 (pendentes = só `…_manutencao_m2_remove_antigas`, `npm run db:push:prod`) e a conferência:

```
npx supabase db query --linked "select to_regclass('public.competitor_video_daily_antiga') as d, to_regclass('public.competitor_video_early_antiga') as e, to_regclass('public.competitor_video_hourly_antiga') as h;"
```

Deve dar: as três vazias (nulas).

---

## O que a M2 entrega que a M10a pode consumir

1. **A ordem dos pushes:** a M10a só faz o `db:new` e o `db:push:prod` dela depois da Tarefa 8, Step 3 (M2 aplicada e conferida, linha "TRAVA M2-2 solta" no ledger). As pendentes da M10a, no `migration list`, são só as dela. O nome do arquivo da M2 (`<ts>_manutencao_m2_particoes.sql`) só existe a partir da Tarefa 8, Step 0, e o `<ts>` fica anotado no ledger.
2. **A regra de nome:** toda migration desta fase leva `_manutencao_` (o teste do item 119 identifica as da fase assim).
3. **Os helpers de leitura de migration** (`apps/web/test/helpers/migrations.ts`: `lerMigrations`, `ultimaDefinicao`, `migrationsDaFase`): o teste dos leitores de `competitor_videos` (item 139) varre as migrations com eles. **A migration da M2 cita `competitor_videos`** (a FK recriada pelo conversor e o teste do brinquedo): ela entra na lista `leitores-competitor-videos.ts` como `indiferente` (só chave estrangeira; não lê vídeo).
4. **`obs_part.assinatura(regclass)`**: a M10a pode comparar o catálogo das 8 tabelas antes e depois de instalar a guarda de `insert`, provando que só o gatilho mudou.
5. **`ItemAgenda.gravidade`** e o padrão de `particoes.ts` (leitura que falha = vermelho): a consulta de órfãs depois do congelamento (02 §10.8), que roda no vigia, usa o mesmo mecanismo.
6. **Nada em `obs_part` nem nas três séries é tocado pela M10a**: as 8 tabelas da classe `video_antigo` não são particionadas.

## Contratos que esta etapa fixa para a M3b

- Nome da partição: `obs_part.<tabela>_<AAAAMM>`; destacada: `obs_part.<tabela>_<AAAAMM>_saida` (o `obs_db_size_record` consertado conta assim).
- `obs_partitions_ensure` lê `public.obs_archive_months(table_name, month, detached_at, dropped_at)` se existir. Com a chave por (site, classe, tabela, mês), qualquer linha da tabela e do mês com `detached_at` ou `dropped_at` bloqueia o mês (a partição é uma só para todos os sites). **A M3b acrescenta ao teste da Tarefa 3 o caso com a tabela real** (o caso de hoje só roda quando ela não existe).
- `obs_part.criar_particao` é o único jeito de criar partição (inclusive o mês da tabela de ensaio, na carga da M8).

## Autorrevisão (feita)

- Cobertura: itens 7 (T3), 8 (T2), 9 (T5, diária e horária), 10 (T3 + T6), 11 (T7), 13 e 14 (T4), 15, 71 e 119 (T1), 72 (T2 catálogo, inclusive o "desfaz se diferir", + T5 API), 73 (T3); tabela de ensaio (T3); pedidos 1 e 3 (T4, entregues à E10), 5 (T1), 6 (T2 `dependentes` e índice único); a volta atrás dos 7 dias (02 §10.2, T2 e LEIAME da T8). Item 12 (medida aos 28 dias ou 15/12) é data de medida, registrada na T8.
- Tipos: `ItemAgenda.gravidade`, `LinhaParticao`, `particoesAFrente`, `MESES_A_FRENTE_ALVO`, `obs_partitions_ensure(integer)` e `obs_partitions_months_ahead()` têm o mesmo nome e forma em todas as tarefas.
- Sem placeholder: o segundo `execute` da T4, Step 3, traz o corpo literal (medido num banco descartável).
- Pareceres de revisão de 14/10 (Phil e Yannis) aplicados; destino de cada achado em `.superpowers/sdd/manutencao-nas/resolucao-plano-m2.md`.
- Ordem de execução e travas: seção "Travas e ordem de execução" (T1 → T5 → T8 → T6 → T7 → T9).
