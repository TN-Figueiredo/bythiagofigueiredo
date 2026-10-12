# A5 · E20: guarda do bruto dos relatórios em lote (MG13) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## O que mudou na emenda do portão (12/10/2026)

Os dois revisores aprovaram com ressalvas, sem crítico. Resposta linha a linha: `.superpowers/sdd/a5/resposta-revisao-planos-e19-e20.md`. Cada trecho mexido traz `(emenda do portão: <id>)`.

1. **A MG13 mudou, e esta é a versão final** (D-I1, D-I2, D-M2, D-M8): uma coluna a mais (`blob_lost_at`), o comentário de `expired_at` corrigido, e a função de leitura `yt_reporting_guarda_conferir()`. Executada duas vezes no banco local dentro de uma transação desfeita: sem erro.
2. **O sinal de perda é um só e atende os dois revisores** (D-I1, D-I2, D-M1, S20-I2, S20-M1): anti-junção exata, que é falha enquanto durar e tem duas saídas escritas; e queda de `blobs_guardados` contra a última execução com número, que é falha de um dia. A conferência saiu do passo e roda em toda execução (Tarefa 5).
3. **Uma perda, uma nota, no tempo** (D-I3): a nota agregada pula toda linha com `expired_at` (Tarefa 4).
4. **Tarefas 3 e 4 num commit só** (S20-I1).
5. **Tarefa 6, nova:** `lib/conferencias.ts`, o item 246 do spec (S19-I3, S20-I3, D-M9). Não depende da MG13.
6. **Do dono:** janela de aplicação (D-M5), a MG13 vai sozinha (decisão do controlador), e os dois comandos de saída do alarme (D-I2).
7. Menores: prova de idempotência (D-M4), runbook (D-M6), suítes vizinhas (D-M7), volume das duas tabelas (D-vol), medida em 21/10 (D-M9), dívida 9 com destino (D-M3), envio (S20-M3).

## O que é do DONO

**1. Aplicar a MG13 em produção.** É a única escrita em produção da etapa. O agente cria o arquivo (Tarefa 1) e para; o dono aplica.

- Nome: `npm run db:new observatorio_guarda_do_bruto` (o agente roda; cria `supabase/migrations/<timestamp>_observatorio_guarda_do_bruto.sql`).
- **Vai sozinha** (emenda do portão: CTRL-d, S20-M3). As MG1 e MG2 são de um plano que ainda não passou pelo portão. Antes de aplicar (leitura, qualquer um roda): `npx supabase migration list --linked`. Só a MG13 pode estar pendente (produção está em `20261009000001`, que é também a última migration local: conferido em 12/10). Se houver outra pendente, ou outro arquivo novo em `supabase/migrations/`, **pare e devolva ao controlador**: `db:push:prod` aplica todas.
- **Janela** (emenda do portão: D-M5): **não aplicar entre 11:55 e 12:15 UTC** (08:55 a 09:15 de Brasília). O `alter table` pede trava exclusiva por um instante (padrão constante não reescreve a tabela; são 264 linhas) e às 12:00 UTC o cron escreve nela. Fora disso não há outro escritor.
- Aplicar: `npm run db:push:prod` (pede `YES`).
- **Ordem:** a MG13 vai **antes** do código das Tarefas 2 a 5. Ela convive com o código que está em `main` (mesma assinatura da função de limpeza; colunas com padrão ou anuláveis; função nova que ninguém chama ainda). O contrário não: o código novo lê `expired_at` e chama `yt_reporting_guarda_conferir()`; sem a MG13 o passo de relatórios para de baixar e o cron fica vermelho com `schema_ausente: yt_reporting_reports` e `schema_ausente: yt_reporting_guarda_conferir`. A Tarefa 2 começa por uma conferência manual disso. A Tarefa 6 (`lib/conferencias.ts`) não depende da MG13.
- **SQL completo e final** (idempotente; é o conteúdo do arquivo). (emenda do portão: D-I1, D-I2, D-M2, D-M8)

```sql
-- MG13 (A5, E20): o bruto dos relatórios em lote deixa de ser apagado por cron.
-- Mesma assinatura e mesmos grants: o cron diário continua chamando e passa a receber 0.
-- O corpo antigo (apaga o normalizado há 90 dias e o sem normalizador baixado há 180) está em
-- 20261007000006_coleta_canais_proprios_l1a.sql, linhas 186 a 206. Não recriar: é o que apaga.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
begin
  return 0;   -- nada é apagado. A MG6 (E10) troca este corpo por "só o bruto em lote com nas_confirmed_at".
end $$;

revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;

-- Estado que a E12 pediu e não tinha onde gravar (pendência M6 do ledger da E12), e a perda reconhecida pelo dono.
alter table public.yt_reporting_reports
  add column if not exists expired_at timestamptz,
  add column if not exists download_attempts integer not null default 0,
  add column if not exists last_error_at timestamptz,
  add column if not exists blob_lost_at timestamptz;

comment on column public.yt_reporting_reports.expired_at is
  'Instante em que a origem respondeu 404 ou 410 ao download. Nulo = a origem não recusou: não venceu, venceu por idade sem resposta da origem (error = ''passou do prazo sem baixar''), ou linha anterior à MG13 (sem registro de vencimento).';
comment on column public.yt_reporting_reports.download_attempts is
  'Tentativas de download deste relatório desde a MG13 (zero em linha baixada antes dela = não contado). Leitura e soma sem trava: duas execuções sobrepostas podem contar uma só.';
comment on column public.yt_reporting_reports.last_error_at is
  'Última tentativa que não guardou o bruto (download ou gravação). Nulo = nunca falhou desde a MG13.';
comment on column public.yt_reporting_reports.blob_lost_at is
  'O dono reconheceu que o bruto deste relatório se perdeu e não existe mais na origem. Nulo = sem perda reconhecida. Tira o relatório do alarme baixados_sem_bruto; conta em perdas_reconhecidas. Só o dono grava (runbook da coleta, seção 13).';

-- Conferência exata da guarda (anti-junção nos dois sentidos), lida pelo cron em toda execução. Só leitura.
create or replace function public.yt_reporting_guarda_conferir()
returns table (brutos bigint, baixados bigint, baixados_sem_bruto bigint, brutos_sem_baixado bigint, perdas_reconhecidas bigint)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.yt_reporting_report_blobs),
    (select count(*) from public.yt_reporting_reports r where r.downloaded_at is not null),
    (select count(*) from public.yt_reporting_reports r
      where r.downloaded_at is not null and r.blob_lost_at is null
        and not exists (select 1 from public.yt_reporting_report_blobs b where b.report_id = r.report_id)),
    (select count(*) from public.yt_reporting_report_blobs b
      where not exists (select 1 from public.yt_reporting_reports r where r.report_id = b.report_id and r.downloaded_at is not null)),
    (select count(*) from public.yt_reporting_reports r where r.blob_lost_at is not null);
$$;

revoke all on function public.yt_reporting_guarda_conferir() from public, anon, authenticated;
grant execute on function public.yt_reporting_guarda_conferir() to service_role;

notify pgrst, 'reload schema';
```

O que este SQL **não** faz: não cria policy nem gatilho, não reescreve a tabela, não apaga nem altera linha. Provado em 12/10 no banco local, dentro de `begin … rollback` (nada ficou): o arquivo executado duas vezes seguidas sem erro; `colunas_mg13 = 4`; `purge_desligado = true`; a limpeza devolve 0; a função de conferência devolve uma linha; `anon` e `authenticated` sem `execute`, `service_role` com.

- **Consultas que conferem** (emenda do portão: D-I1; as duas primeiras RODADAS em produção em 12/10, depois da emenda). A do topo vale antes e depois da MG13, porque faz a anti-junção direto:

```bash
npx supabase db query --linked "select (select count(*) from information_schema.columns where table_schema='public' and table_name='yt_reporting_reports' and column_name in ('expired_at','download_attempts','last_error_at','blob_lost_at')) as colunas_mg13, (select prosrc not like '%delete from%' from pg_proc where pronamespace='public'::regnamespace and proname='yt_reporting_blobs_purge') as purge_desligado, (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='yt_reporting_guarda_conferir') as funcao_guarda, (select count(*) from yt_reporting_report_blobs) as blobs, (select count(*) from yt_reporting_reports r where r.downloaded_at is not null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id)) as baixados_sem_bruto, (select count(*) from yt_reporting_report_blobs b where not exists (select 1 from yt_reporting_reports r where r.report_id = b.report_id and r.downloaded_at is not null)) as brutos_sem_baixado"
```

Hoje (12/10, antes da MG13): `colunas_mg13 = 0`, `purge_desligado = false`, `funcao_guarda = 0`, `blobs = 160`, `baixados_sem_bruto = 0`, `brutos_sem_baixado = 0`. **Depois da MG13 o esperado é `4`, `true`, `1`, `blobs` maior ou igual ao número anotado antes, `0`, `0`.**

Só depois da MG13 (antes dela responde `42883: function … does not exist`, conferido em 12/10):

```bash
npx supabase db query --linked "select * from public.yt_reporting_guarda_conferir()"
```

Esperado: `brutos` igual ao `blobs` da consulta de cima, `baixados` igual a `brutos` (hoje 160 e 160), `baixados_sem_bruto = 0`, `brutos_sem_baixado = 0`, `perdas_reconhecidas = 0`.

**2. Nada mais para a etapa andar.** Não há chave, variável de ambiente, cron nem escrita na forja.

**3. Só se o alarme `baixados_sem_bruto` aparecer** (emenda do portão: D-I2). O cron fica vermelho todo dia enquanto houver relatório baixado sem bruto, e a saída é sua, com o comando pronto. Listar quais são (leitura; RODADA em produção em 12/10 sem o filtro `blob_lost_at`, que só existe depois da MG13: zero linhas):

```bash
npx supabase db query --linked "select r.report_id, r.report_type_id, r.channel_id, r.create_time, r.downloaded_at, (r.create_time + case when r.is_backfill then interval '30 days' else interval '60 days' end) as some_da_origem_em, (r.create_time + case when r.is_backfill then interval '30 days' else interval '60 days' end) > now() as origem_ainda_tem from yt_reporting_reports r where r.downloaded_at is not null and r.blob_lost_at is null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id) order by r.create_time"
```

Para cada linha, um dos dois (no SQL Editor do Supabase, um por vez; os dois foram executados no banco local dentro de uma transação desfeita, para provar a sintaxe):

- `origem_ainda_tem = true`: devolver à fila. O cron do dia seguinte baixa de novo e a nota some.

```sql
update public.yt_reporting_reports set status = 'listado', downloaded_at = null, error = null where report_id = '<REPORT_ID>' and downloaded_at is not null and blob_lost_at is null;
```

- `origem_ainda_tem = false`: reconhecer a perda. O relatório sai do alarme e passa a contar em `perdas_reconhecidas`, que fica no resumo do cron para sempre (visível, sem vermelho).

```sql
update public.yt_reporting_reports set blob_lost_at = now() where report_id = '<REPORT_ID>' and downloaded_at is not null and blob_lost_at is null;
```

## Perguntas que sobram

Nenhuma trava. Três decisões do plano que o dono pode vetar; todas têm padrão e seguem por ele:

1. **O sinal de perda** (emenda do portão: D-I1, D-M1, S20-I2). O spec (7.6) pede que o cron acuse falha se `blobs_guardados` cair de um dia para o outro. O plano faz isso **e** mais: (a) a queda, comparada com a última execução que tem número (não com "ontem": resolve o dia em que o cron não rodou), é falha de um dia e acaba sozinha; é o único sinal que pega a perda por cascata, em que relatório e bruto somem juntos; quando você remove um canal próprio ela aparece uma vez, e é informativa; (b) todo relatório com `downloaded_at` tem de ter o seu bruto, pela anti-junção exata da função nova; é falha enquanto durar e tem as duas saídas do item 3 acima. Medido hoje: 160 brutos, 160 baixados, zero nos dois sentidos.
2. **Segunda trava não adotada.** O código poderia também parar de chamar a limpeza (o apagamento ficaria desligado mesmo sem a MG13). O plano segue o spec (o cron continua chamando e recebe 0), porque a MG6 da E10 conta com a chamada. Em troca: a conferência manual da Tarefa 2 e o alarme `bruto_apagado > 0`.
3. **"Conferências vencidas" não deixa o cron vermelho** (emenda do portão: CTRL-c). O item 246 diz que o cron "devolve" a lista. O plano a põe no resumo (`coleta.conferencias_vencidas`), não em `falhas`: marcar uma conferência como feita é um commit, que só chega a produção no envio seguinte, e um vermelho que dura dias depois de a conferência ter sido feita ensina a ignorar o vermelho. Se você preferir vermelho, é uma linha (Tarefa 6, Step 3). **DECISÃO DO CONTROLADOR em 12/10 (pergunta 11 ao dono; o engenheiro de dados pediu, o de software não se opôs): conferência vencida há MAIS DE 7 DIAS entra em `falhas` e deixa o cron vermelho; até 7 dias fica só no resumo. A Tarefa 6 implementa assim, com teste nas fronteiras (7 dias: resumo; 8 dias: falha).**

---

**Goal:** Nenhum bruto de relatório em lote é apagado por prazo; o que a origem recusa fica datado (`expired_at`); e a perda de um bruto, se acontecer, deixa o cron vermelho até o dono devolver o relatório à fila ou reconhecer a perda.

**Architecture:** Uma migration (MG13) troca o corpo de `yt_reporting_blobs_purge` por `return 0`, cria quatro colunas em `yt_reporting_reports` e uma função de leitura, `yt_reporting_guarda_conferir()`. No código, o passo de relatórios grava `expired_at`, `download_attempts` e `last_error_at` e acusa `bruto_apagado > 0`; a guarda é conferida em toda execução do cron, fora do passo, pela função (`coleta/guarda.ts`); o critério persistente ganha a porta que faltava (404 ou 410 em relatório criado há mais de 14 dias). Dois envios: o da migration (Tarefa 1) e o do código (Tarefas 2 a 6), nesta ordem. *(emenda do portão: D-I1, S20-M1, CTRL-c)*

**Tech Stack:** Postgres 17 (Supabase), TypeScript estrito, Vitest com `test/youtube/coleta/fake-supabase.ts`; teste de integração com banco local (`HAS_LOCAL_DB=1`).

**Spec:** `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md` seção 7.6 e itens 204 a 206; `06-ciclo-de-vida-volume-e-cota.md` 9.2 (linha 8 da lista do que apaga) e 9.6; `00-indice-decisoes-e-sequencia.md` ordem 2, MG13 e OP-1. Ledger da etapa: `.superpowers/sdd/a5-e20/progress.md` (criar na Tarefa 1).

## Global Constraints

- **Prazo duro:** MG13 aplicada antes de 07/01/2027 e antes de qualquer normalizador da E11. Medido em 12/10: a primeira normalização foi em `2026-10-10 12:01:59 UTC`; a primeira deleção cairia na execução do cron de **08 ou 09/01/2027** (12:00 UTC); a dos tipos sem normalizador, em 08/04/2027.
- Branch `staging`, sem branch nem worktree. **Nunca** `git stash` nem `git reset`. Commit só por caminho explícito (`git commit -m "..." -- <arquivos>`). **Não fazer push:** o push é do controlador, em envio separado da A4 (seção "Envio").
- Nada que escreva em produção por agente. Leitura só por `npx supabase db query --linked "<select>"`.
- Banco local é compartilhado com outros terminais: aplicar migration com `npx supabase migration up --local`. **Nunca** `npm run db:reset`.
- Não criar o arquivo de migration à mão: `npm run db:new`.
- Não tocar em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `api-registry.ts` (a etapa não muda rota de pipeline).
- Nenhum comando nem espera acima de 4 minutos. Suíte: saída para arquivo, só as falhas no contexto.
- TypeScript `strict`, nunca `any`. Testes com `// @vitest-environment node` e datas relativas ao `AGORA` do arquivo.
- **Este sistema falha em verde.** Contagem ausente não é zero; coluna nula não é "não venceu".

## Fatos medidos em produção (12/10/2026, só `select`)

| Fato | Valor |
|---|---|
| Brutos guardados | 160 arquivos, 21.262 bytes de `csv_gz`; a tabela inteira ocupa 176 kB |
| Relatórios | 46 `baixado` (21 normalizados), 114 `vazio` (45 normalizados), 104 `listado` |
| Relatório com `downloaded_at` e sem bruto | 0. Bruto sem relatório baixado: 0. **O `vazio` também tem bruto** (o spec, item 205, dizia que não: a base de comparação é 0, não um número a anotar) |
| O que a limpeza apagaria hoje | 0 linhas |
| Função em produção | corpo com `delete from`; argumentos `p_sem_normalizador text[]`; `search_path=""`; `execute` só para `postgres` e `service_role` |
| Colunas da MG13 | nenhuma existe |
| Chaves estrangeiras do bruto | `report_id` e `site_id`, as duas com `on delete cascade` |
| Resumo do cron | `yt_own_collection_runs.resumo->'relatorios'->>'bruto_apagado'` = `"0"` em 11 e 12/10; `falhas` é `text[]` |
| Banco | 171 MB (teto do plano gratuito: 500 MB) |

## O que continua sendo apagado, e por quê

| O quê | Quem apaga | Por quê | Toca o bruto? |
|---|---|---|---|
| Tudo de um canal **próprio** removido | `youtube_channel_remove`, pelo dono, com o slug digitado | decisão do dono, caso a caso | **sim**, por cascata (relatório leva o bruto). Sem export nesta fase (9.2, linha 11) |
| Tudo de um site apagado | cascata de `site_id` | não acontece em operação normal | sim |
| Linhas de `yt_own_collection_runs` com mais de 90 dias | o próprio cron | é registro de execução, não dado coletado | não |
| Linha de `ops_alert_state` de alerta resolvido | `coleta/alerts.ts` | estado de execução | não |
| O arquivo **na origem** (YouTube) | o YouTube, 60 dias depois de gerado (30 no histórico) | regra do Google | é por isso que o bruto fica aqui |

O `upsert` do bruto por `report_id` troca o arquivo quando um relatório volta à fila e é baixado de novo: é substituição pelo arquivo novo, não deleção. Depois da E20 **nenhuma rotina apaga bruto por prazo**. A MG6 (E10) reabre a função só para bruto em lote confirmado no NAS.

**Efeito no tamanho do banco.** Hoje: 176 kB. Com os 13 tipos ligados nos dois canais (E12, a partir de 13/10) entram cerca de 26 arquivos por dia, perto de 9.500 por ano. Custo por arquivo: entre 0,25 kB (conta de linha e índice) e 1,1 kB (medido hoje, pessimista porque a tabela é pequena e o custo fixo pesa). **Estimativa: de 2,4 a 10 MB por ano**, menos de 2% do teto. O spec (9.6) diz "centenas de kB por ano": foi escrito antes de a E12 triplicar o número de arquivos. A conferência de 12/11/2026 troca a estimativa por medida.

*(emenda do portão: D-vol, D-M9)* **Falta uma parcela nessa conta:** `yt_reporting_reports` também não é apagada e cresce junto, uma linha por arquivo: 391 bytes por linha (a URL de download pesa 151) mais três índices, entre 0,53 e 1,09 kB por relatório, ou **5,5 a 11 MB por ano** (conta do revisor de dados; hoje 264 linhas em 286.720 bytes, medido em 12/10). **Total do lote: de 8 a 23 MB por ano**, 2,4% a 7% dos 329 MB livres; dois anos sem NAS, até 46 MB. O número não é teto: o arquivo cresce com a atividade do canal, e o teto duro do código é 2 MB por arquivo. **Primeira medida real possível: 21/10/2026** (D+8 da E12, com o histórico de 30 dias dos 9 tipos novos já baixado); a de 30 dias, em 12/11.

## O que acontece quando o dado não existe, e em cada falha

| Situação | O que acontece | Como o dono vê |
|---|---|---|
| MG13 não aplicada e código novo no ar | a leitura da fila pede `expired_at`, o banco recusa, o passo não baixa nada; os relatórios seguem `listado` (30 a 60 dias de prazo na origem) | cron vermelho todo dia: `schema_ausente: yt_reporting_reports` |
| MG13 aplicada e código antigo no ar | a limpeza devolve 0; as colunas ficam no padrão | nada muda; `bruto_apagado = 0` no resumo |
| Alguém recria o corpo antigo da função | a limpeza apaga; o resumo traz `bruto_apagado > 0` | vermelho no dia (`a limpeza apagou N bruto(s)`), e vermelho **todo dia seguinte** por `baixados_sem_bruto` |
| Bruto some por outro caminho, e o relatório fica *(emenda do portão: D-I1, D-I2)* | `baixados_sem_bruto > 0`, pela anti-junção exata | vermelho todo dia, **com fim definido**: o dono devolve o relatório à fila (a origem ainda tem o arquivo) ou grava `blob_lost_at` (não tem mais). Comandos em "O que é do DONO", item 3, e na seção 13 do runbook |
| Relatório e bruto somem juntos (cascata: canal removido, `delete` manual, defeito) *(emenda do portão: D-M1, S20-I2)* | a anti-junção fica verde; `blobs_guardados` cai em relação à última execução que tem número | vermelho **por um dia**: `os brutos guardados caíram de N para M…`. No dia seguinte a base já é M |
| Não há execução anterior com número (a primeira depois do envio) | `blobs_guardados_antes = null`, sem comparação | campo nulo no resumo; a queda só passa a valer a partir da segunda execução |
| A função `yt_reporting_guarda_conferir` não existe (código novo sem a MG13) | `PGRST202` | vermelho: `schema_ausente: yt_reporting_guarda_conferir`; os campos da guarda ficam `null`, nunca 0 |
| Relatório com `blob_lost_at` | sai de `baixados_sem_bruto`; conta em `perdas_reconhecidas` | número no resumo para sempre, sem vermelho |
| O `marcar` do 404 falha (banco) *(S20-M4, só registro)* | `contarVencido` trata a perda como coberta naquela execução; o relatório segue `listado` | o erro de banco deixa o dia vermelho; no dia seguinte o 404 se repete e grava |
| "A tela lê sem registro de vencimento" (spec 7.6) *(emenda do portão: D-2.8)* | a E12 e a E20 não têm tela | vale no critério e no resumo do cron (`expirados_sem_registro`); a tela é da E13 |
| Conferência com data vencida e sem a data de feita *(emenda do portão: CTRL-c)* | entra em `coleta.conferencias_vencidas` | campo no resumo do cron; vencida há mais de 7 dias, entra em `falhas` e o cron fica vermelho (decisão do controlador de 12/10, pergunta 3 do topo) |
| O banco não devolve a contagem | `blobs_guardados` fica `null` | nota `guarda do bruto não conferida`; nunca "0 órfãos" |
| O passo sai antes do fim, não roda por falta de tempo, ou lança *(emenda do portão: S20-M1)* | a conferência **roda do mesmo jeito**: ela está fora do passo, em `coleta/index.ts` | os campos de `coleta.guarda` vêm com número em toda execução; `null` só com nota (`schema_ausente`, `erro de banco`, ou `guarda do bruto não conferida`) |
| Relatório expirado antes da MG13 (`expired_at` nulo) | lê como "sem registro de vencimento"; fica nas duas portas antigas do critério | `expirados_sem_registro` no resumo |
| 404 ou 410 em relatório criado há mais de 14 dias | grava `expired_at`; o critério novo avisa por 14 dias | `relatórios: <canal> tem relatório <tipo> expirado sem baixar`, todo dia da janela (antes: só no dia) |
| Bruto gravado e a marca `baixado` falha; ou A marca 404 e B sobreposta baixa (resíduo do G4, ledger da E12) *(emenda do portão: D-I1)* | sobra um bruto cujo relatório não está como baixado. **Não esconde mais nada:** a conta é anti-junção, não subtração | `brutos_sem_baixado` no resumo (visível, não é falha) |
| Duas execuções sobrepostas | `download_attempts` pode contar uma só | declarado no comentário da coluna |

## Simulação do dia do envio e dos seguintes

| Quando | Quem | O quê |
|---|---|---|
| D0 | agente | Tarefa 1: arquivo da MG13, teste de integração, runbook. Commit local |
| D0 | dono | `migration list --linked` (só a MG13 pendente) e `npm run db:push:prod` |
| D0 | agente | consulta de conferência do topo: `4`, `true`, `1`, `blobs >= 160`, `0`, `0`; e a chamada da função. Anota no ledger com a hora *(emenda do portão: D-I1)* |
| D0, 12:00 UTC seguinte | cron (código antigo) | chama a limpeza e recebe 0. Agente confere `bruto_apagado = "0"` e `falhas` sem `schema_ausente` |
| D0 ou D1 | agente | Tarefas 2 a 6; controlador faz o envio separado para `staging`, CI verde, promoção a `main` |
| primeiro cron depois do envio | cron (código novo) | resumo com `guarda.blobs_guardados` (número), `guarda.blobs_guardados_antes = null` (não há base ainda), `guarda.baixados_sem_bruto = 0`, `relatorios.bruto_apagado = 0` |
| segundo cron depois do envio | cron | `guarda.blobs_guardados_antes` igual ao número do dia anterior |
| se o envio do código sair **antes** da MG13 | — | o cron seguinte fica vermelho (`schema_ausente`), nada é baixado naquele dia, nada vence (prazo de 30 a 60 dias). Conserto: aplicar a MG13; não precisa reverter |

## Interruptor e plano de volta

- **Interruptor:** nenhum novo. `PASSOS_LIGADOS.relatorios` (`coleta/index.ts:24`) desliga o passo inteiro, como hoje.
- **Volta do código:** reverter os commits das Tarefas 2 a 6 (um `git revert` por commit; são quatro: o da Tarefa 2, o das Tarefas 3 e 4, o da 5 e o da 6). A MG13 fica; o código antigo convive com ela.
- **Volta da MG13:** recriar o corpo antigo da função. **Não recomendado: é o que apaga.** As quatro colunas e a função de conferência ficam (o código antigo não as lê).

## Envio (separado da fase A4)

A A4 local está 78 commits à frente de `origin/staging` e não pode ir pela metade. `git diff --name-only origin/staging..HEAD -- apps/web/src` em 12/10: 67 arquivos (59 em `app/cms/(authed)`, 8 em `lib/youtube/observatorio`). **Nenhum** é arquivo deste plano (`lib/youtube/coleta/*`, `types/database.types.ts`, `supabase/migrations/*`, `docs/ops/*`, `test/youtube/coleta/*`, `test/integration/coleta-l1a-migration.test.ts`). O envio usa o roteiro da E12 (`.superpowers/sdd/a5-e12/progress.md`, "Roteiro do envio separado"), com a lista de arquivos deste plano. Refazer o `git diff` no dia: a A4 anda.

*(emenda do portão: S20-M3)* **Quando cada commit sobe.** O commit da Tarefa 1 (migration, teste de integração, runbook) fica local até o dono aplicar a MG13: ele aplica do arquivo local, e o cron de produção não depende de o arquivo estar no remoto. Esse commit sobe **junto com o envio 2** (Tarefas 2 a 6). Se o envio 2 atrasar mais de um dia depois da aplicação, o controlador sobe o commit da Tarefa 1 sozinho (três arquivos, nenhum da A4), para o remoto não ficar sem a migration que produção já tem. A Tarefa 6 não depende da MG13: pode subir antes, com o lote 1 da E19, se este sair primeiro. Arquivos novos desta emenda na lista do envio: `lib/youtube/coleta/guarda.ts`, `lib/youtube/coleta/index.ts`, `lib/conferencias.ts`, `test/youtube/coleta/fake-supabase.ts`, `test/youtube/coleta/guarda.test.ts`, `test/lib/conferencias.test.ts`: conferir de novo que a A4 não toca nenhum.

## Review Focus

1. **Código novo sem a MG13:** o passo para de baixar. Esperado: vermelho no primeiro cron, nunca verde. Teste na Tarefa 3 (`schema_ausente` na leitura da fila).
2. **Linha antiga sem `expired_at`:** não pode ler como "não venceu". Teste na Tarefa 2 (registro sem o campo).
3. **Contagem nula do banco:** não pode virar "0 órfãos". Teste na Tarefa 5 (a função devolve nulo, lista vazia, ou não existe).
4. **Uma perda, uma nota:** 404 tardio não pode gerar duas notas quando o prazo da origem também passa. Teste na Tarefa 4.
5. **Sementes de teste com `downloaded_at` e sem bruto:** a conferência nova as acusa. O conserto é semear o bruto, nunca afrouxar a conferência (Tarefa 5).
6. *(emenda do portão)* **Bruto sobrando não pode esconder bruto faltando:** teste com um de cada (Tarefa 1, integração; Tarefa 5, unidade). **A perda reconhecida sai do alarme e continua contada.** **A queda dura um dia.** **A mesma perda não volta a alarmar em +41 dias** (Tarefa 4).

---

### Task 1: MG13, teste de integração e runbook (envio 1)

**Files:**
- Create: `supabase/migrations/<timestamp>_observatorio_guarda_do_bruto.sql` (por `npm run db:new`)
- Modify: `apps/web/test/integration/coleta-l1a-migration.test.ts:102-116`
- Modify: `docs/ops/youtube-coleta-canais-proprios-runbook.md` (linhas 26, 30, 86, 409, 534, 659 a 661; a tabela de notas de "Relatórios", linhas 296 a 316; e o roteiro novo na seção 13)
- Create: `.superpowers/sdd/a5-e20/progress.md`

**Interfaces:**
- Produces: `public.yt_reporting_blobs_purge(text[]) returns integer` (sempre 0); colunas `expired_at timestamptz null`, `download_attempts integer not null default 0`, `last_error_at timestamptz null`, `blob_lost_at timestamptz null`; `public.yt_reporting_guarda_conferir() returns table (brutos, baixados, baixados_sem_bruto, brutos_sem_baixado, perdas_reconhecidas bigint)`, só para `service_role`. *(emenda do portão: D-I1, D-I2)*

- [ ] **Step 1: Anotar a base no ledger.** Rodar a consulta de conferência do topo e gravar o resultado, com a hora, em `.superpowers/sdd/a5-e20/progress.md` (seção "Antes da MG13").

- [ ] **Step 2: Trocar o teste de integração (falha antes da migration).** Substituir o `it` das linhas 102 a 116 por:

```ts
  it('MG13 (E20): a limpeza não apaga nada, nem o normalizado há 91 dias nem o sem normalizador baixado há 181', async () => {
    const velho = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
    const a = relatorio('guarda-a', { report_type_id: 'channel_basic_a3', status: 'baixado', downloaded_at: velho(181) })
    const c = relatorio('guarda-c', { status: 'baixado', downloaded_at: velho(120), normalized_at: velho(91) })
    expect((await sb.from('yt_reporting_reports').insert([a, c])).error).toBeNull()
    const blob = (id: string) => ({ report_id: id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })
    expect((await sb.from('yt_reporting_report_blobs').insert([a, c].map(r => blob(r.report_id)))).error).toBeNull()
    const contar = async () => (await sb.from('yt_reporting_report_blobs').select('report_id', { count: 'exact', head: true }).eq('site_id', siteId)).count
    const antes = await contar()
    for (const lista of [SEM_NORMALIZADOR, [], ['channel_reach_basic_a1', 'channel_basic_a3']]) {
      const purge = await sb.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: lista })
      expect(purge.error).toBeNull()
      expect(purge.data).toBe(0)
    }
    expect(await contar()).toBe(antes)
    const restam = await sb.from('yt_reporting_report_blobs').select('report_id').in('report_id', [a.report_id, c.report_id])
    expect(restam.data!.map(r => r.report_id).sort()).toEqual([a.report_id, c.report_id].sort())
  })

  it('MG13: as quatro colunas de estado existem, com o padrão certo', async () => {
    const r = relatorio('guarda-col')
    expect((await sb.from('yt_reporting_reports').insert(r)).error).toBeNull()
    const lido = await sb.from('yt_reporting_reports').select('expired_at, download_attempts, last_error_at, blob_lost_at').eq('report_id', r.report_id).single()
    expect(lido.error).toBeNull()
    expect(lido.data).toEqual({ expired_at: null, download_attempts: 0, last_error_at: null, blob_lost_at: null })
  })

  // (emenda do portão: D-I1, D-I2) A conferência é anti-junção: um bruto sobrando não esconde um bruto faltando.
  // O banco local é compartilhado: as afirmações são sobre a DIFERENÇA em relação à leitura de antes, não sobre o total.
  it('MG13: yt_reporting_guarda_conferir acusa o baixado sem bruto E o bruto sem baixado, e desconta a perda reconhecida', async () => {
    const ler = async () => {
      const r = await sb.rpc('yt_reporting_guarda_conferir')
      expect(r.error).toBeNull()
      const l = (r.data as Array<Record<string, unknown>>)[0]!
      return { brutos: Number(l.brutos), baixados: Number(l.baixados), sem_bruto: Number(l.baixados_sem_bruto), sem_baixado: Number(l.brutos_sem_baixado), perdas: Number(l.perdas_reconhecidas) }
    }
    const antes = await ler()
    const semBruto = relatorio('guarda-sem-bruto', { status: 'baixado', downloaded_at: new Date().toISOString() })
    const semBaixado = relatorio('guarda-sem-baixado')   // `listado`, sem downloaded_at, mas com bruto: o resíduo da execução sobreposta
    expect((await sb.from('yt_reporting_reports').insert([semBruto, semBaixado])).error).toBeNull()
    expect((await sb.from('yt_reporting_report_blobs').insert({ report_id: semBaixado.report_id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })).error).toBeNull()
    const meio = await ler()
    expect(meio.brutos - antes.brutos).toBe(1)
    expect(meio.baixados - antes.baixados).toBe(1)
    expect(meio.sem_bruto - antes.sem_bruto).toBe(1)        // a subtração "baixados menos brutos" daria 0 aqui
    expect(meio.sem_baixado - antes.sem_baixado).toBe(1)
    expect((await sb.from('yt_reporting_reports').update({ blob_lost_at: new Date().toISOString() }).eq('report_id', semBruto.report_id)).error).toBeNull()
    const fim = await ler()
    expect(fim.sem_bruto - antes.sem_bruto).toBe(0)         // perda reconhecida pelo dono sai do alarme
    expect(fim.perdas - antes.perdas).toBe(1)               // e continua contada
  })

  it('MG13: anon não executa a conferência da guarda', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    expect((await anon.rpc('yt_reporting_guarda_conferir')).error).not.toBeNull()
  })

  it('MG13: anon não executa a limpeza', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    expect((await anon.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: [] })).error).not.toBeNull()
  })
```

- [ ] **Step 3: Rodar e ver falhar.**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts > /tmp/e20-t1.log 2>&1; tail -20 /tmp/e20-t1.log` (antes: `npm run db:start`, se o banco local não estiver de pé)
Expected: FAIL no primeiro `it` (`expected 1 to be 0` ou parecido: a função antiga apaga), no segundo (coluna inexistente) e no da conferência (função inexistente). Se a constante de bytes do bruto do arquivo usar outra forma de escrever o `\x` do `bytea`, use a do arquivo (a mesma do primeiro `it`).

- [ ] **Step 4: Criar a migration.** `npm run db:new observatorio_guarda_do_bruto`; colar no arquivo criado o SQL da seção "O que é do DONO", sem mudar nada.

- [ ] **Step 5: Aplicar no banco local e ver passar.**

Run: `npx supabase migration up --local && cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts > /tmp/e20-t1.log 2>&1; tail -8 /tmp/e20-t1.log`
Expected: PASS em todos.

*(emenda do portão: D-M4)* **Prova de idempotência.** Rodar `migration up --local` de novo não prova nada: a migration já está registrada e a segunda chamada não executa. Executar o **conteúdo do arquivo** mais uma vez, pelo `psql` do contêiner (o arquivo é só `create or replace`, `add column if not exists`, `comment`, `revoke`, `grant` e `notify`: rodar de novo não muda nada):

```bash
docker exec -i supabase_db_bythiagofigueiredo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/*_observatorio_guarda_do_bruto.sql
```

Expected: as linhas `CREATE FUNCTION`, `REVOKE`, `GRANT`, `ALTER TABLE` (com avisos `column … already exists, skipping`), `COMMENT`, `NOTIFY`, e código de saída 0. Rodar o teste de integração de novo depois: PASS. (O planejador já fez essa prova em 12/10 com o SQL do topo, dentro de uma transação desfeita.)

- [ ] **Step 6: Runbook (OP-1).** Em `docs/ops/youtube-coleta-canais-proprios-runbook.md`:
  - linha 26, última coluna: `Sim: o bruto fica guardado (MG13, E20); nenhuma rotina o apaga por prazo`.
  - linha 30: trocar "e o bruto é apagado 180 dias depois do download (o de `channel_reach_basic_a1`, 90 dias depois de normalizado)" por "e o bruto **não é mais apagado por prazo** (MG13, E20)"; apagar a frase "Prazos de apagamento sem exportar (07/01/2027 …)" até o fim dela.
  - linha 86 *(emenda do portão: D-I1, D-M1, S20-M1)*: acrescentar a descrição do campo novo `coleta.guarda`, conferido em toda execução: `blobs_guardados` (brutos no banco; `null` = não conferido, e aí há nota em `falhas`), `blobs_guardados_antes` (o da última execução que tem número; `null` na primeira), `baixados_sem_bruto` (maior que 0 é falha enquanto durar), `brutos_sem_baixado` (bruto cujo relatório não está como baixado; visível, não é falha), `perdas_reconhecidas` (relatórios com `blob_lost_at`), `expirados_sem_registro`; e `coleta.conferencias_vencidas` (lista; Tarefa 6).
  - linha 409: trocar "O bruto de um relatório normalizado é apagado 90 dias depois; sem ele" por "Desde a MG13 o bruto não é apagado por prazo; se mesmo assim faltar,".
  - linha 534: trocar o parêntese final por "(desde a MG13 nenhuma limpeza por prazo vale para ele)".
  - linhas 659 a 661: substituir os três itens por um: "**O bruto não é apagado por prazo (MG13, E20).** `yt_reporting_blobs_purge` devolve 0. Sinais: `relatorios.bruto_apagado` tem de ser 0 e `guarda.baixados_sem_bruto` tem de ser 0; qualquer outro valor deixa o cron vermelho, e uma queda de `guarda.blobs_guardados` deixa vermelho por um dia. Conferências com data: 21/10/2026 e 12/11/2026 (tamanho), 09/01/2027 e 09/04/2027 (as datas em que a limpeza antiga apagaria); elas estão em `apps/web/src/lib/conferencias.ts` (o cron as lista em `coleta.conferencias_vencidas` quando vencem) e em `.superpowers/sdd/a5/conferencias-com-data.md`; as consultas, na seção \"Conferências depois do envio\" do plano `docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md`. Recriar o corpo antigo da função é o que apaga: não fazer." *(emenda do portão: S20-M3, CTRL-c: a data de aplicação não vai neste commit, que é anterior a ela; entra na Tarefa 2, Step 1.)*
  - conferir a linha 606 (`drop function if exists public.yt_reporting_blobs_purge(text[])`): se for o roteiro de desfazer o L1a, deixar e acrescentar ao lado "(a MG13 a recriou: ver a seção de limpeza)", e acrescentar ao mesmo roteiro `drop function if exists public.yt_reporting_guarda_conferir();`.
  - *(emenda do portão: D-M6)* **tabela de notas de "Relatórios (passo 1C e critérios)"** (linhas 296 a 316), cinco linhas novas, no formato da tabela (`Nota | Significa | O que fazer`):
    - `relatórios: a limpeza apagou N bruto(s) nesta execução; desde a MG13 o esperado é 0 (…)` | a função `yt_reporting_blobs_purge` voltou a ter o corpo que apaga | não recriar o corpo antigo; reaplicar o SQL da MG13 (é idempotente); os brutos apagados aparecem no dia seguinte como `baixados_sem_bruto`.
    - `relatórios: N relatório(s) baixado(s) estão sem o bruto guardado (…)` | há relatório com `downloaded_at`, sem bruto e sem perda reconhecida. Fica vermelho todo dia até uma das duas saídas | seção 13, "Bruto que falta: as duas saídas".
    - `relatórios: os brutos guardados caíram de N para M desde a última execução conferida: …` | o número de brutos diminuiu. Dura um dia. Esperado quando você remove um canal próprio (a cascata leva relatório e bruto); fora disso é perda | se você não removeu canal: rodar a consulta do topo do plano da E20 e a de `yt_reporting_reports` por canal, e levar ao controlador no mesmo dia.
    - `relatórios: guarda do bruto não conferida (…)` | a função de conferência não devolveu número, ou a conferência lançou | resolver a nota de banco que vem junto; se vier sozinha dois dias seguidos, Sentry (tag `passo: guarda do bruto`).
    - `schema_ausente: yt_reporting_guarda_conferir` | o código novo está no ar sem a MG13 | aplicar a MG13 (`npm run db:push:prod`, fora de 11:55 a 12:15 UTC).
  - *(emenda do portão: D-I2)* **seção 13, item novo "Bruto que falta: as duas saídas"**: copiar o item 3 de "O que é do DONO" deste plano (a consulta que lista, com `origem_ainda_tem`, e os dois `update`, um por linha), com a frase: "Os dois comandos são seus. Nenhum agente os roda." E a consulta que lista as perdas já reconhecidas: `select report_id, report_type_id, create_time, downloaded_at, blob_lost_at from yt_reporting_reports where blob_lost_at is not null order by blob_lost_at`.

- [ ] **Step 7: Commit (sem push).**

```bash
git add supabase/migrations/*_observatorio_guarda_do_bruto.sql
git commit -m "feat: MG13 desliga o apagamento do bruto dos relatórios, cria expired_at, download_attempts, last_error_at e blob_lost_at e a conferência exata da guarda (A5, E20)" -- supabase/migrations/*_observatorio_guarda_do_bruto.sql apps/web/test/integration/coleta-l1a-migration.test.ts docs/ops/youtube-coleta-canais-proprios-runbook.md
```

**Critério de pronto:** teste de integração verde no banco local; migration idempotente (o arquivo executado duas vezes); o conteúdo do arquivo **igual, byte a byte, ao SQL do topo deste plano** (`diff` entre o bloco e o arquivo: vazio) *(emenda do portão: decisão 45, é a versão que os revisores aprovaram)*; runbook sem nenhuma menção a limpeza com data (`grep -n "07/01/2027\|07/04/2027" docs/ops/youtube-coleta-canais-proprios-runbook.md` devolve só a linha nova). **Parar aqui e devolver ao controlador: a aplicação em produção é do dono.**

---

### Task 2: conferência da ordem e a leitura de `expired_at` (módulo puro)

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/fila-relatorios.ts` (`ItemDaFila`, `perdaCobertaPorCriterios`; função nova)
- Test: `apps/web/test/youtube/coleta/fila-relatorios.test.ts`

**Interfaces:**
- Produces: `ItemDaFila.expired_at?: string | null`; `type RegistroDeVencimento = { tipo: 'origem'; em: string } | { tipo: 'sem_registro' }`; `registroDeVencimento(p: { expired_at?: string | null }): RegistroDeVencimento`.

- [ ] **Step 1: Conferência manual da ordem** *(emenda do portão: S20-R1, S20-M3; não é trava em código: quem segura é este passo e, se ele falhar, o `schema_ausente` do primeiro cron)*. Rodar a consulta de conferência do topo. Se `colunas_mg13` não for `4`, `purge_desligado` não for `true` ou `funcao_guarda` não for `1`: **parar**. As Tarefas 2 a 5 podem ser escritas e testadas, mas o controlador não envia antes disso (a Tarefa 6 pode). Anotar o resultado no ledger, com a hora em que o dono aplicou, e escrever essa data no item da seção 13 do runbook ("MG13, E20, aplicada em <data>"): a mudança do runbook entra no commit das Tarefas 3 e 4.

- [ ] **Step 2: Testes que falham.** Acrescentar a `fila-relatorios.test.ts` (usar o `AGORA` e o `DIA_MS` que o arquivo já define; se o nome for outro, usar o do arquivo):

```ts
describe('E20: registro de vencimento (MG13)', () => {
  it('linha sem o campo (anterior à MG13) é "sem registro de vencimento", nunca "não venceu"', () => {
    const linha: Record<string, unknown> = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), expired_at: '2026-10-01T00:00:00.000Z' }
    delete linha.expired_at
    expect(registroDeVencimento(linha)).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: null })).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: 'lixo' })).toEqual({ tipo: 'sem_registro' })
  })
  it('com a data da origem devolve o instante', () => {
    expect(registroDeVencimento({ expired_at: '2026-10-05T12:00:00Z' })).toEqual({ tipo: 'origem', em: '2026-10-05T12:00:00.000Z' })
  })
  it('404 em corrente criado há 20 dias passa a ser coberto pelos critérios enquanto expired_at estiver na janela', () => {
    const p = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), is_backfill: false }
    expect(perdaCobertaPorCriterios(p, AGORA)).toBe(false)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA).toISOString() }, AGORA)).toBe(true)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA - 15 * DIA_MS).toISOString() }, AGORA)).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/fila-relatorios.test.ts`. Expected: FAIL (`registroDeVencimento is not defined`).

- [ ] **Step 4: Implementar.** Em `fila-relatorios.ts`: acrescentar o campo a `ItemDaFila`, a função, e a terceira porta.

```ts
export interface ItemDaFila {
  report_type_id: string
  create_time: string
  is_backfill?: boolean | null
  /** MG13. Instante em que a origem respondeu 404 ou 410. Ausente ou nulo = sem registro de vencimento, nunca "não venceu". */
  expired_at?: string | null
}

export type RegistroDeVencimento = { tipo: 'origem'; em: string } | { tipo: 'sem_registro' }

/** O que o banco sabe sobre o vencimento na origem. Linha anterior à MG13, campo nulo ou ilegível: sem registro. */
export function registroDeVencimento(p: { expired_at?: string | null }): RegistroDeVencimento {
  const t = p.expired_at ? new Date(p.expired_at).getTime() : Number.NaN
  return Number.isNaN(t) ? { tipo: 'sem_registro' } : { tipo: 'origem', em: new Date(t).toISOString() }
}
```

Em `perdaCobertaPorCriterios`, logo depois de `const janela = ...` e antes do primeiro `return true`, acrescentar (e atualizar o comentário da função: são três portas; "ficam de fora" passa a ser só "o que venceu há mais de 14 dias"):

```ts
  // (c) MG13: a origem recusou (404/410) e o instante está gravado; o critério por expired_at avisa durante a janela.
  const venc = registroDeVencimento(p)
  if (venc.tipo === 'origem' && Date.parse(venc.em) >= agora - janela + MARGEM_COBERTURA_MS) return true
```

- [ ] **Step 5: Rodar e ver passar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/fila-relatorios.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -m "feat: registro de vencimento na origem (expired_at) na fila de relatórios (A5, E20)" -- apps/web/src/lib/youtube/coleta/fila-relatorios.ts apps/web/test/youtube/coleta/fila-relatorios.test.ts`

---

### Task 3: o passo grava `expired_at`, `download_attempts` e `last_error_at`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (`Pendente` linhas 64-73; `baixarUm` 187-343; `lerFilaPendente` 369)
- Modify: `apps/web/src/types/database.types.ts` (bloco `yt_reporting_reports`, linha ~10238: `Row`, `Insert`, `Update`)
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts`

**Interfaces:**
- Consumes: `registroDeVencimento`, `ItemDaFila.expired_at` (Tarefa 2).
- Produces: nada novo para fora; as três colunas passam a ser gravadas.

- [ ] **Step 1: Testes que falham.** Acrescentar ao fim de `reports-step.test.ts`:

```ts
describe('E20: estado do download gravado no relatório (MG13)', () => {
  it('404 grava expired_at e last_error_at com a hora da execução e soma a tentativa', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('sumiu', { download_attempts: 2 })] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'sumiu')).toMatchObject({ status: 'expirado_sem_baixar', expired_at: AGORA.toISOString(), last_error_at: AGORA.toISOString(), download_attempts: 3 })
  })
  it('vencido por idade NÃO ganha expired_at (a origem não respondeu nada): continua "sem registro"', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('velho', { create_time: ha(61) })] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'velho')!.expired_at ?? null).toBeNull()
  })
  it('download com 500: continua listado, soma a tentativa e grava last_error_at; expired_at fica nulo', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'listado', download_attempts: 1, last_error_at: AGORA.toISOString() })
    expect(rel(db, 'r1')!.expired_at ?? null).toBeNull()
  })
  it('download que dá certo soma a tentativa e não grava last_error_at', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', download_attempts: 1 })
    expect(rel(db, 'r1')!.last_error_at ?? null).toBeNull()
  })
  it('falha ao gravar o bruto soma a tentativa e grava last_error_at', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.writeErrors.yt_reporting_report_blobs = { code: '08006', message: 'conexão caiu' }
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'listado', download_attempts: 1, last_error_at: AGORA.toISOString() })
  })
  it('o prazo acaba dentro do download: não conta tentativa (não houve resposta da origem)', async () => {
    api.download.mockRejectedValue(new SemTempoError())
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')!.download_attempts ?? 0).toBe(0)
  })
  it('MG13 não aplicada (a coluna não existe): schema_ausente em falhas, nada é baixado, nada lança', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.erroNaLeitura = (tabela, _n, colunas) => (tabela === 'yt_reporting_reports' && colunas.includes('expired_at') ? { code: '42703', message: 'column does not exist' } : undefined)
    const ctx = ctxDe(db)
    await expect(passoRelatorios(ctx)).resolves.toBeDefined()
    expect(ctx.falhas).toContain('schema_ausente: yt_reporting_reports')
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(api.download).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "E20: estado" > /tmp/e20-t3.log 2>&1; tail -30 /tmp/e20-t3.log`. Expected: FAIL nos sete.

- [ ] **Step 3: Implementar.**

  (a) `Pendente` ganha `download_attempts?: number | null` e `expired_at?: string | null`; o `select` de `lerFilaPendente` passa a `'site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time, is_backfill, download_attempts, expired_at'`.

  (b) Em `baixarUm`, logo depois da definição de `marcar`:

```ts
  // MG13: a tentativa é somada a partir do valor lido na fila (o PostgREST não soma num update). Duas execuções
  // sobrepostas podem contar uma só: o `.eq('status', 'listado')` de `marcar` garante que nenhuma rebaixa a outra.
  const tentativa = (p.download_attempts ?? 0) + 1
  const falhou = () => ({ download_attempts: tentativa, last_error_at: new Date().toISOString() })
```

  (c) Nas marcações: `recusarPorTamanho` → `marcar({ status: 'erro', error: 'grande_demais', bytes, ...extra, ...falhou() })`; `url_inesperada` → `marcar({ status: 'erro', error: 'url_inesperada', ...falhou() })`; 404 ou 410:

```ts
        const quando = falhou()
        conferirBanco(await marcar({ status: 'expirado_sem_baixar', error: `HTTP ${erro.status}`, expired_at: quando.last_error_at, ...quando }), 'yt_reporting_reports', ctx.falhas)
        resumo.expirados++
        contarVencido(resumo, { ...p, expired_at: quando.last_error_at }, Date.now())
        return
```

  (d) Erro passageiro (antes do `registrarTentativa` da linha 276) e falha de gravação do bruto (antes do `registrarTentativa` da linha 314): `conferirBanco(await marcar(falhou()), 'yt_reporting_reports', ctx.falhas)`.

  (e) Sucesso: acrescentar `download_attempts: tentativa` ao objeto do `marcar` da linha 322.

  (f) Os dois retornos `sem_tempo` (linhas 250 e 251) ficam como estão: não contam tentativa.

  (g) `database.types.ts`, bloco `yt_reporting_reports`: em `Row`, `blob_lost_at: string | null`, `download_attempts: number`, `expired_at: string | null`, `last_error_at: string | null`; em `Insert` e `Update`, os quatro como opcionais (`blob_lost_at?: string | null`, `download_attempts?: number`, `expired_at?: string | null`, `last_error_at?: string | null`), em ordem alfabética como o resto. No bloco `Functions`, `yt_reporting_guarda_conferir: { Args: Record<PropertyKey, never>; Returns: { brutos: number; baixados: number; baixados_sem_bruto: number; brutos_sem_baixado: number; perdas_reconhecidas: number }[] }`, no formato das funções vizinhas. O código **nunca grava** `blob_lost_at`: é coluna do dono. *(emenda do portão: D-I1, D-I2)*

- [ ] **Step 4: Rodar o arquivo inteiro.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts > /tmp/e20-t3.log 2>&1; grep -E "✓|×|FAIL|Tests" /tmp/e20-t3.log | grep -v "✓" | head -30`. Expected: os sete novos PASS. Os testes antigos que comparam `db.writes` ou a linha inteira do relatório com `toEqual` podem quebrar pelas colunas novas: ajustar a expectativa no mesmo commit, **sem** tirar as colunas do código. Os dois testes que mudam de sentido (linhas 665 e 1093) são trocados na Tarefa 4, Step 1, e **entram no mesmo commit**: com este Step 3 aplicado e sem a Tarefa 4, o teste da linha 665 fica vermelho e o 404 em relatório de 20 dias fica sem nota nenhuma (o passo já o trata como coberto e o critério ainda não lê `expired_at`). *(emenda do portão: S20-I1)*

- [ ] **Step 5: Typecheck, SEM commit** *(emenda do portão: S20-I1)*. Run: `npm run typecheck -w apps/web > /tmp/e20-tc.log 2>&1; tail -5 /tmp/e20-tc.log`. Expected: sem erro. **Não commitar aqui.** O pre-commit não roda testes, e o commit desta tarefa sozinho deixaria a árvore com um teste vermelho e uma perda sem aviso. Seguir direto para a Tarefa 4; o commit único das duas está no Step 5 dela.

---

### Task 4: o critério persistente lê `expired_at`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/criteria.ts:161-211`
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts` (bloco "uma perda, uma nota por execução", linhas 1060-1117, e os testes das linhas 665 e 1093)

**Interfaces:**
- Consumes: `registroDeVencimento` (Tarefa 2); `expired_at` gravado (Tarefa 3).

- [ ] **Step 1: Trocar os dois testes que mudam de sentido e acrescentar os novos.**

  - Linha 665 (`perda que NENHUM critério persistente cobre (404 em corrente criado há 20 dias)…`): o 404 tardio agora é coberto. Renomear para `404 em corrente criado há 20 dias agora é do critério persistente: o passo não anota; o resumo conta todas as vencidas` e trocar a última expectativa por `expect(ctx.falhas).toEqual([])`.
  - Linha 1093: substituir o `it` por:

```ts
  it('404 em corrente criado há 20 dias: UMA nota no dia (a por relatório, pelo expired_at), que dura 14 dias e acaba sozinha', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(20) })],
    })
    const nota = ['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar']
    expect(await rodar(db)).toEqual(nota)
    vi.setSystemTime(new Date(AGORA.getTime() + 13 * DIA_MS))
    expect(await rodar(db)).toEqual(nota)
    vi.setSystemTime(new Date(AGORA.getTime() + 15 * DIA_MS))
    expect(await rodar(db)).toEqual([])
  })

  it('404 tardio cujo prazo da origem também passa dentro da janela: continua UMA nota (a agregada não soma o mesmo relatório)', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(55) })],   // corrente: vence na origem daqui a 5 dias
    })
    expect(await rodar(db)).toHaveLength(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 7 * DIA_MS))               // o prazo da origem passou há 2 dias; expired_at há 7
    expect(await rodar(db)).toEqual(['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar'])
  })

  // (emenda do portão: D-I3) A mesma perda não volta a alarmar: 404 aos 20 dias de criado avisa do dia 20 ao 34 e ACABA.
  // Sem o conserto, a nota agregada reabria do dia 60 ao 74 (quando o prazo da origem passa), com outro texto.
  it('404 aos 20 dias de criado: depois da janela de 14 dias, silêncio; e continua silêncio quando o prazo da origem passa (+41 dias)', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(20) })],   // corrente: vence na origem daqui a 40 dias
    })
    expect(await rodar(db)).toHaveLength(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 15 * DIA_MS))               // expired_at há 15 dias: a nota por relatório acabou
    expect(await rodar(db)).toEqual([])
    // Daqui em diante só interessam as notas desta perda: 41 dias depois outros critérios (relatório novo atrasado) podem falar.
    const destaPerda = (notas: string[]) => notas.filter(n => n.includes('venceram sem baixar') || n.includes('expirado sem baixar'))
    vi.setSystemTime(new Date(AGORA.getTime() + 41 * DIA_MS))               // criado há 61 dias: o prazo da origem passou ontem
    expect(destaPerda(await rodar(db))).toEqual([])
    vi.setSystemTime(new Date(AGORA.getTime() + 47 * DIA_MS))               // meio da janela em que a agregada reabria
    expect(destaPerda(await rodar(db))).toEqual([])
  })

  it('vencido por IDADE (sem expired_at) continua na nota agregada: o conserto não a calou', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('velho', { create_time: ha(63), status: 'expirado_sem_baixar', error: 'passou do prazo sem baixar' })],
    })
    expect(await rodar(db)).toEqual(['relatórios: 1 relatório(s) venceram sem baixar nos últimos 14 dias (channel_reach_basic_a1: 1)'])
  })

  it('expirado antes da MG13 (expired_at nulo), criado há 20 dias: sem registro de vencimento, nenhuma nota nova inventada', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('antigo', { create_time: ha(20), status: 'expirado_sem_baixar', error: 'HTTP 404' })],
    })
    expect(await rodar(db)).toEqual([])
  })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "uma perda, uma nota" > /tmp/e20-t4.log 2>&1; tail -30 /tmp/e20-t4.log`. Expected: FAIL no primeiro e no segundo (zero notas: nenhum critério lê `expired_at`). O teste de +41 dias só falha depois de a leitura `expTarde` do Step 3 existir e antes de o `continue` novo entrar: conferir essa ordem ao implementar (escrever a leitura, ver o teste de +41 falhar com a nota agregada, escrever o `continue`, ver passar). Se o nome do helper `rodar`, de `ha` ou de `DIA_MS` for outro no arquivo, usar o do arquivo.

- [ ] **Step 3: Implementar em `criteria.ts`.** Importar `registroDeVencimento` de `./fila-relatorios`. Logo depois do bloco `exp` (termina na linha 177), acrescentar:

```ts
  // MG13 (E20): 404/410 em relatório criado há MAIS de 14 dias. A leitura acima só vê quem foi criado na janela; esta lê o
  // instante em que a origem recusou (`expired_at`) e dura JANELA_PERDA_DIAS a partir dele. Linha anterior à MG13 tem
  // expired_at nulo ("sem registro de vencimento"): fica com as duas portas antigas, nenhuma nota é inventada para ela.
  const expTarde = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, channel_id, report_type_id, status, create_time, expired_at')
    .eq('status', 'expirado_sem_baixar')
    .in('report_type_id', [...HABILITADOS])
    .gte('expired_at', corte14)
    .lt('create_time', corte14)
    .limit(LIMITE_LEITURA)
  if (leituraOk(expTarde, 'yt_reporting_reports', 'relatórios recusados pela origem', ctx.falhas)) {
    const lidos = (expTarde.data ?? []) as Recente[]
    if (lidos.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `relatórios recusados pela origem (yt_reporting_reports): leitura cortada em ${LIMITE_LEITURA}`)
    }
    for (const r of lidos) {
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório ${r.report_type_id} expirado sem baixar`)
    }
  }
```

No bloco `venc` (nota agregada): acrescentar `expired_at` ao `select` e ao tipo de `lidos` (`expired_at?: string | null`), e, como primeira linha do `for`:

```ts
      // (emenda do portão: D-I3) Quem tem o instante da origem gravado é SÓ da nota por relatório, que dura 14 dias a partir
      // dele e acaba. Sem olhar a idade do registro: se olhasse, a mesma perda voltaria aqui quando o prazo da origem passasse.
      if (registroDeVencimento(r).tipo === 'origem') continue
```

*(emenda do portão: S20-NV)* A leitura `expTarde` usa `.gte('expired_at', corte14)` numa coluna que é nula na maior parte das linhas. No Postgres, nulo não passa em `>=`. Conferir que o `fake-supabase` faz o mesmo (`gte` com valor `null` ou ausente tem de devolver falso): o terceiro teste do Step 1 (expirado antes da MG13, `[]`) é o que prova; se ele falhar por o banco em memória tratar nulo como menor que tudo, o conserto é no `fake-supabase` (nulo nunca casa em `gte`, `gt`, `lt`, `lte`), no mesmo commit.

Atualizar o comentário do bloco (a frase "quase nunca quem venceu por idade" continua certa; a que diz que o 404 tardio fica sem aviso sai).

- [ ] **Step 4: Rodar o arquivo e os vizinhos.** Run: `cd apps/web && npx vitest run test/youtube/coleta test/cron test/api/cron > /tmp/e20-t4.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e20-t4.log | head -20`. Expected: tudo PASS. *(emenda do portão: D-M7: três arquivos de `test/cron` e `test/api/cron` montam a coleta inteira com o banco em memória.)*

- [ ] **Step 5: Commit único das Tarefas 3 e 4** *(emenda do portão: S20-I1)*. Typecheck de novo (`npm run typecheck -w apps/web > /tmp/e20-tc.log 2>&1; tail -5 /tmp/e20-tc.log`), e então:

```bash
git commit -m "feat: o passo de relatórios grava expired_at, download_attempts e last_error_at, e o relatório recusado pela origem avisa por 14 dias a partir de expired_at (A5, E20; fecha a pendência M6 da E12)" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/src/lib/youtube/coleta/criteria.ts apps/web/src/types/database.types.ts apps/web/test/youtube/coleta/reports-step.test.ts docs/ops/youtube-coleta-canais-proprios-runbook.md
```

(O runbook entra por causa da data de aplicação da MG13, Tarefa 2, Step 1; e o `fake-supabase.ts`, se o Step 3 pediu conserto nele.)

---

### Task 5: a guarda conferida em toda execução

*(emenda do portão: D-I1, D-I2, D-M1, S20-I2, S20-M1. A tarefa foi reescrita do Step 1 ao Step 5 porque a conferência mudou de lugar e de conta; o alarme `bruto_apagado > 0`, o seu teste e o item (c) são os de antes.)* Três mudanças em relação à versão que foi ao portão: a conta é a anti-junção da função `yt_reporting_guarda_conferir()` (antes: subtração de duas contagens); a conferência sai de dentro do passo de relatórios e vai para `coleta/index.ts`, logo depois dele, para rodar também quando o passo sai cedo, fica sem tempo ou lança; e a queda de `blobs_guardados` contra a última execução com número volta a ser falha (de um dia), como o item 205 pede.

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/guarda.ts`
- Modify: `apps/web/src/lib/youtube/coleta/index.ts` (logo depois da chamada de `passo('relatorios', …)`, linhas 197 a 200)
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (só o passo 4, linhas 515-521: o alarme da limpeza)
- Modify: `apps/web/test/youtube/coleta/fake-supabase.ts` (resposta padrão da função nova, junto da de `yt_own_attempt_record`, linha 243)
- Test: `apps/web/test/youtube/coleta/guarda.test.ts` (novo); `apps/web/test/youtube/coleta/reports-step.test.ts` (o teste da linha 392); `apps/web/test/youtube/coleta/index.test.ts` (um teste novo)

**Interfaces:**
- Consumes: `public.yt_reporting_guarda_conferir()` (MG13); `yt_own_collection_runs.resumo` das execuções anteriores.
- Produces: `interface GuardaResumo { blobs_guardados, blobs_guardados_antes, baixados_sem_bruto, brutos_sem_baixado, perdas_reconhecidas, expirados_sem_registro: number | null }`; `conferirGuarda(ctx: { supabase: SupabaseClient; falhas: string[] }): Promise<GuardaResumo>`; o resumo do cron ganha `coleta.guarda` (gravado em `yt_own_collection_runs.resumo->'guarda'`). `RelatoriosResumo` **não muda** (os objetos escritos à mão em `index.test.ts:44` e `:485` ficam como estão).

- [ ] **Step 1: Testes que falham.**

  (a) Em `reports-step.test.ts`, trocar o teste da linha 392:

```ts
  it('chama a limpeza do bruto com os tipos sem normalizador; desde a MG13 qualquer bruto apagado é falha', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 3, error: null })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(db.rpcCalls.find(c => c.name === 'yt_reporting_blobs_purge')!.args).toEqual({ p_sem_normalizador: SEM_NORMALIZADOR })
    expect(resumo.bruto_apagado).toBe(3)
    expect(ctx.falhas).toContain('relatórios: a limpeza apagou 3 bruto(s) nesta execução; desde a MG13 o esperado é 0 (a função foi recriada com o corpo antigo?)')
  })
```

  (b) Em `fake-supabase.ts`, dentro de `fakeSupabase`, ao lado da resposta padrão de `yt_own_attempt_record`: a mesma anti-junção da MG13, sobre as tabelas em memória. Sem isto, todo teste que monta a coleta inteira receberia `schema_ausente: yt_reporting_guarda_conferir` (o `rpc` sem resposta registrada devolve `PGRST202`).

```ts
  // E20 (MG13): a anti-junção de yt_reporting_guarda_conferir() sobre as tabelas em memória. Teste que semeia relatório
  // com downloaded_at e sem bruto é acusado, como em produção: o conserto é semear o bruto, nunca tirar esta resposta.
  db.rpcHandlers.yt_reporting_guarda_conferir = () => {
    const rel = db.tables.yt_reporting_reports ?? []
    const comBruto = new Set((db.tables.yt_reporting_report_blobs ?? []).map(b => b.report_id))
    const baixados = rel.filter(r => r.downloaded_at != null)
    const idsBaixados = new Set(baixados.map(r => r.report_id))
    return {
      data: [{
        brutos: comBruto.size,
        baixados: baixados.length,
        baixados_sem_bruto: baixados.filter(r => r.blob_lost_at == null && !comBruto.has(r.report_id)).length,
        brutos_sem_baixado: [...comBruto].filter(id => !idsBaixados.has(id)).length,
        perdas_reconhecidas: rel.filter(r => r.blob_lost_at != null).length,
      }],
      error: null,
    }
  }
```

  (c) Criar `apps/web/test/youtube/coleta/guarda.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type FakeDb } from './fake-supabase'
import { conferirGuarda } from '@/lib/youtube/coleta/guarda'

type Linha = Record<string, unknown>
const baixado = (id: string, extra: Linha = {}): Linha => ({ report_id: id, status: 'baixado', downloaded_at: '2026-10-01T12:00:00.000Z', ...extra })
const bruto = (id: string): Linha => ({ report_id: id, site_id: 'site-1', csv_gz: '\\x00' })
/** Uma execução anterior do cron. `blobs = null`: execução que não conferiu a guarda (resumo sem o número). */
const execucao = (ran_at: string, blobs: number | null): Linha => ({ ran_at, resumo: blobs === null ? { relatorios: {} } : { guarda: { blobs_guardados: blobs } } })
const rodar = async (db: FakeDb) => {
  const falhas: string[] = []
  const guarda = await conferirGuarda({ supabase: db.client, falhas })
  return { guarda, falhas }
}

describe('E20: conferirGuarda', () => {
  it('todo baixado tem bruto: os números vêm, nenhuma falha; sem execução anterior não há base de comparação', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('b'), { report_id: 'c', status: 'listado' }], yt_reporting_report_blobs: [bruto('a'), bruto('b')] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 2, blobs_guardados_antes: null, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0 })
    expect(falhas).toEqual([])
  })

  it('um baixado sem bruto E um bruto sem baixado: os dois aparecem (a subtração antiga daria zero)', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a'), baixado('faltou'), { report_id: 'sobrou', status: 'expirado_sem_baixar', expired_at: '2026-10-02T12:00:00.000Z' }],
      yt_reporting_report_blobs: [bruto('a'), bruto('sobrou')],
    })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 2, baixados_sem_bruto: 1, brutos_sem_baixado: 1 })
    expect(falhas).toEqual(['relatórios: 1 relatório(s) baixado(s) estão sem o bruto guardado (2 baixados, 2 brutos): liste e resolva pela seção 13 do runbook da coleta (devolver à fila ou reconhecer a perda)'])
  })

  it('perda reconhecida pelo dono (blob_lost_at): sai do alarme, conta em perdas_reconhecidas, nenhuma falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('perdido', { blob_lost_at: '2026-10-03T12:00:00.000Z' })], yt_reporting_report_blobs: [bruto('a')] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ baixados_sem_bruto: 0, perdas_reconhecidas: 1 })
    expect(falhas).toEqual([])
  })

  it('a função devolve nulo: "não conferida", nunca zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
    db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [{ brutos: null, baixados: 1, baixados_sem_bruto: null, brutos_sem_baixado: 0, perdas_reconhecidas: 0 }], error: null })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados).toBeNull()
    expect(guarda.baixados_sem_bruto).toBeNull()
    expect(falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
  })

  it('a função devolve lista vazia: "não conferida"', async () => {
    const db = fakeSupabase({})
    db.rpcHandlers.yt_reporting_guarda_conferir = () => ({ data: [], error: null })
    expect((await rodar(db)).falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
  })

  it('MG13 não aplicada (a função não existe): schema_ausente, campos nulos, nada lança', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')] })
    delete db.rpcHandlers.yt_reporting_guarda_conferir   // sem resposta registrada, o rpc do banco em memória devolve PGRST202
    const { guarda, falhas } = await rodar(db)
    expect(falhas).toContain('schema_ausente: yt_reporting_guarda_conferir')
    expect(guarda.blobs_guardados).toBeNull()
    expect(guarda.baixados_sem_bruto).toBeNull()
  })

  it('queda contra a ÚLTIMA EXECUÇÃO QUE TEM NÚMERO (pula a que não conferiu): falha, com os dois números', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a')],
      yt_reporting_report_blobs: [bruto('a')],
      yt_own_collection_runs: [execucao('2026-10-03T12:02:00.000Z', null), execucao('2026-10-02T12:02:00.000Z', 3), execucao('2026-10-01T12:02:00.000Z', 9)],
    })
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_antes: 3 })
    expect(falhas).toEqual(['relatórios: os brutos guardados caíram de 3 para 1 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
  })

  it('a queda dura um dia: na execução seguinte a base já é o número novo', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [baixado('a')],
      yt_reporting_report_blobs: [bruto('a')],
      yt_own_collection_runs: [execucao('2026-10-04T12:02:00.000Z', 1), execucao('2026-10-02T12:02:00.000Z', 3)],
    })
    expect((await rodar(db)).falhas).toEqual([])
  })

  it('número igual ou maior que o da última execução: nenhuma falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a'), baixado('b')], yt_reporting_report_blobs: [bruto('a'), bruto('b')], yt_own_collection_runs: [execucao('2026-10-02T12:02:00.000Z', 1)] })
    const { guarda, falhas } = await rodar(db)
    expect(guarda.blobs_guardados_antes).toBe(1)
    expect(falhas).toEqual([])
  })

  it('a leitura das execuções anteriores falha: a anti-junção vale, a queda fica sem base e o erro aparece', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [baixado('a')], yt_reporting_report_blobs: [bruto('a')] })
    db.erroNaLeitura = (tabela) => (tabela === 'yt_own_collection_runs' ? { code: '08006', message: 'conexão caiu' } : undefined)
    const { guarda, falhas } = await rodar(db)
    expect(guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_antes: null, baixados_sem_bruto: 0 })
    expect(falhas).toEqual(['erro de banco ao ler yt_own_collection_runs'])
  })

  it('conta os expirados sem registro de vencimento (anteriores à MG13, ou vencidos por idade)', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        { report_id: 'velho', status: 'expirado_sem_baixar' },
        { report_id: 'novo', status: 'expirado_sem_baixar', expired_at: '2026-10-02T12:00:00.000Z' },
      ],
    })
    expect((await rodar(db)).guarda.expirados_sem_registro).toBe(1)
  })
})
```

  As datas escritas à mão são passadas e nenhuma afirmação depende do relógio. Se o `fake-supabase` não exportar o tipo `FakeDb` ou a assinatura de `erroNaLeitura` for outra, usar a do arquivo (ele é a referência; a afirmação não muda).

  (d) Em `index.test.ts`, um teste novo, usando o arnês que o arquivo já tem para o passo de relatórios sem tempo (os testes de `nao_alcancado_orcamento`): com o passo **sem rodar**, `resumo.guarda` existe e `blobs_guardados` é número; e, com `db.rpcHandlers.yt_reporting_guarda_conferir` lançando (`() => { throw new Error('x') }`), `falhas` contém `relatórios: guarda do bruto não conferida (a conferência lançou)` e `rodarColeta` não lança.

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/guarda.test.ts test/youtube/coleta/reports-step.test.ts -t "conferirGuarda|chama a limpeza" > /tmp/e20-t5.log 2>&1; tail -30 /tmp/e20-t5.log`. Expected: FAIL (módulo `guarda` inexistente; a nota da limpeza não existe).

- [ ] **Step 3: Implementar.**

  (a) Criar `apps/web/src/lib/youtube/coleta/guarda.ts`:

```ts
// E20 (A5, MG13): nenhuma rotina apaga bruto por prazo. Esta conferência roda em TODA execução do cron, tenha o passo de
// relatórios rodado inteiro, saído cedo, ficado sem tempo ou lançado. Contagem ausente não é zero.
import type { SupabaseClient } from '@supabase/supabase-js'
import { conferirBanco, pushUnico } from './schema'

export interface GuardaResumo {
  /** Brutos no banco. null = não conferido nesta execução (e há nota em falhas). */
  blobs_guardados: number | null
  /** O `blobs_guardados` da última execução que tem número. null = sem base (a primeira execução depois do envio) ou não conferido. */
  blobs_guardados_antes: number | null
  /** Relatórios com `downloaded_at`, sem bruto e sem perda reconhecida. Maior que 0 é falha enquanto durar. */
  baixados_sem_bruto: number | null
  /** Brutos cujo relatório não está marcado como baixado (resíduo de execução sobreposta). Visível; não é falha. */
  brutos_sem_baixado: number | null
  /** Relatórios com `blob_lost_at`: perda que o dono reconheceu. Visível; não é falha. */
  perdas_reconhecidas: number | null
  /** `expirado_sem_baixar` com `expired_at` nulo: sem registro de vencimento (anteriores à MG13, ou vencidos por idade). */
  expirados_sem_registro: number | null
}

const NAO_CONFERIDA = 'relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'
/** Quantas execuções anteriores olhar à procura de uma que tenha o número. */
const EXECUCOES_PARA_A_BASE = 10

const inteiro = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null

export async function conferirGuarda(ctx: { supabase: SupabaseClient; falhas: string[] }): Promise<GuardaResumo> {
  const out: GuardaResumo = {
    blobs_guardados: null, blobs_guardados_antes: null, baixados_sem_bruto: null, brutos_sem_baixado: null, perdas_reconhecidas: null, expirados_sem_registro: null,
  }

  const semRegistro = await ctx.supabase.from('yt_reporting_reports').select('report_id', { count: 'exact' }).eq('status', 'expirado_sem_baixar').is('expired_at', null).limit(1)
  if (conferirBanco(semRegistro, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') out.expirados_sem_registro = semRegistro.count ?? null

  // Anti-junção exata, nos dois sentidos (MG13). Função ausente = MG13 não aplicada: PGRST202, que conferirBanco lê como
  // schema_ausente. Vermelho, nunca "0 órfãos".
  const g = await ctx.supabase.rpc('yt_reporting_guarda_conferir')
  if (conferirBanco(g, 'yt_reporting_guarda_conferir', ctx.falhas, 'ler') !== 'ok') return out
  const linha = (Array.isArray(g.data) ? g.data[0] : g.data) as Record<string, unknown> | null | undefined
  const brutos = inteiro(linha?.brutos)
  const baixados = inteiro(linha?.baixados)
  const semBruto = inteiro(linha?.baixados_sem_bruto)
  const semBaixado = inteiro(linha?.brutos_sem_baixado)
  const perdas = inteiro(linha?.perdas_reconhecidas)
  if (brutos === null || baixados === null || semBruto === null || semBaixado === null || perdas === null) {
    pushUnico(ctx.falhas, NAO_CONFERIDA)
    return out
  }
  out.blobs_guardados = brutos
  out.baixados_sem_bruto = semBruto
  out.brutos_sem_baixado = semBaixado
  out.perdas_reconhecidas = perdas
  // Falha enquanto durar, com fim definido: o dono devolve o relatório à fila ou grava blob_lost_at (runbook, seção 13).
  if (semBruto > 0) {
    pushUnico(ctx.falhas, `relatórios: ${semBruto} relatório(s) baixado(s) estão sem o bruto guardado (${baixados} baixados, ${brutos} brutos): liste e resolva pela seção 13 do runbook da coleta (devolver à fila ou reconhecer a perda)`)
  }

  // Queda contra a última execução QUE TEM NÚMERO (não "ontem": o cron pode não ter rodado, ou não ter conferido). É o único
  // sinal que pega a perda por cascata, em que relatório e bruto somem juntos e a anti-junção fica verde. Dura um dia: a
  // linha desta execução ainda não foi gravada (a rota grava depois), e amanhã a base já é o número de hoje.
  // Quando a MG6 (E10) reabrir a limpeza para o lote confirmado no NAS, esta comparação tem de descontar o que ela apagou.
  const ant = await ctx.supabase.from('yt_own_collection_runs').select('ran_at, resumo').order('ran_at', { ascending: false }).limit(EXECUCOES_PARA_A_BASE)
  if (conferirBanco(ant, 'yt_own_collection_runs', ctx.falhas, 'ler') !== 'ok') return out
  for (const r of (ant.data ?? []) as Array<{ resumo: unknown }>) {
    const n = inteiro((r.resumo as { guarda?: { blobs_guardados?: unknown } } | null)?.guarda?.blobs_guardados)
    if (n !== null) {
      out.blobs_guardados_antes = n
      break
    }
  }
  if (out.blobs_guardados_antes !== null && brutos < out.blobs_guardados_antes) {
    pushUnico(ctx.falhas, `relatórios: os brutos guardados caíram de ${out.blobs_guardados_antes} para ${brutos} desde a última execução conferida: canal próprio removido ou perda (confira qual)`)
  }
  return out
}
```

  Se o tipo do cliente nos outros passos não for `SupabaseClient` de `@supabase/supabase-js`, usar o de `StepCtx['supabase']`. Nenhum `any`.

  (b) Em `coleta/index.ts`, importar `conferirGuarda` de `./guarda` e, logo depois do bloco que roda o passo de relatórios (`relPasso = r ? { ...r } : undefined`), **fora** do `if (PASSOS_LIGADOS.relatorios)`: a guarda é conferida mesmo com o passo desligado.

```ts
  // E20: a guarda do bruto é conferida em TODA execução, mesmo se o passo de relatórios não rodou (sem tempo, desligado)
  // ou lançou. Falha da conferência nunca vira "0 órfãos": vira nota.
  try {
    resumo.guarda = await conferirGuarda({ supabase: ctx.supabase, falhas })
  } catch (e) {
    falhou('guarda do bruto', e)
    pushUnico(falhas, 'relatórios: guarda do bruto não conferida (a conferência lançou)')
  }
```

  (c) Em `reports-step.ts`, no passo 4 (linhas 515-521), trocar o comentário para `// ── 4. Limpeza do bruto: desde a MG13 devolve 0 (a MG6 da E10 reabre só para lote confirmado no NAS) ──` e, dentro do `if` que grava `resumo.bruto_apagado`, acrescentar:

```ts
      if (purge.data > 0) pushUnico(ctx.falhas, `relatórios: a limpeza apagou ${purge.data} bruto(s) nesta execução; desde a MG13 o esperado é 0 (a função foi recriada com o corpo antigo?)`)
```

- [ ] **Step 4: Rodar a pasta e as vizinhas.** Run: `cd apps/web && npx vitest run test/youtube/coleta test/cron test/api/cron > /tmp/e20-t5.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e20-t5.log | head -30`. Expected: PASS. *(emenda do portão: D-M7)* Teste antigo **que monta a coleta inteira** (`index.test.ts`, `test/cron`, `test/api/cron`) e semeia relatório com `downloaded_at` e **sem** bruto passa a receber a nota nova: o conserto é semear o bruto no teste (`yt_reporting_report_blobs: [{ report_id, site_id, csv_gz }]`), **nunca** afrouxar a conferência nem tirar a resposta padrão do `fake-supabase`. Os testes de `reports-step.test.ts` não são afetados: a conferência não está mais dentro do passo. Teste que compara o resumo inteiro da coleta com `toEqual` ganha a chave `guarda`.

- [ ] **Step 5: Typecheck e commit.** Run: `npm run typecheck -w apps/web > /tmp/e20-tc.log 2>&1; tail -5 /tmp/e20-tc.log`.
`git commit -m "feat: a guarda do bruto é conferida em toda execução do cron pela anti-junção da MG13; bruto apagado, relatório baixado sem bruto ou queda do número de brutos é falha (A5, E20)" -- apps/web/src/lib/youtube/coleta/guarda.ts apps/web/src/lib/youtube/coleta/index.ts apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/fake-supabase.ts apps/web/test/youtube/coleta/guarda.test.ts apps/web/test/youtube/coleta/reports-step.test.ts apps/web/test/youtube/coleta/index.test.ts` (mais os testes de `test/cron` e `test/api/cron` que precisaram da semente do bruto, pelo caminho).

---

### Task 6: conferências com data (`lib/conferencias.ts`, item 246 do spec)

*(emenda do portão: CTRL-c, S19-I3, S20-I3, D-M9. Tarefa nova.)* O spec (`00`, item 246, e o passo 6 da ordem do dia do deploy) manda toda conferência "N dias depois do deploy" virar uma entrada em `lib/conferencias.ts`, com a data absoluta preenchida no commit do deploy, e o cron diário devolver as vencidas. Nenhuma etapa recebeu a criação do arquivo, e ele não existe (`find apps/web/src -name "conferencias*"`: vazio). Esta é a tarefa mínima. **Não depende da MG13** e não toca em nenhum arquivo das Tarefas 2 a 5 além de `coleta/index.ts` (uma linha, em outro ponto do arquivo). A E19 a consome (plano da E19, Tarefa 7, Step 2b).

**Files:**
- Create: `apps/web/src/lib/conferencias.ts`
- Modify: `apps/web/src/lib/youtube/coleta/index.ts` (no retorno final de `executar`, junto de `resumo.ms = ms`, linha 276)
- Test: `apps/web/test/lib/conferencias.test.ts` (novo); `apps/web/test/youtube/coleta/index.test.ts` (um teste)

**Interfaces:**
- Produces: `interface Conferencia { id: string; etapa: string; data: string; responsavel: 'agente' | 'dono'; onde: string; feitaEm: string | null }`; `CONFERENCIAS: readonly Conferencia[]`; `hojeSP(agora?: Date): string`; `conferenciasVencidas(hoje: string, lista?: readonly Conferencia[]): Conferencia[]`; o resumo do cron ganha `coleta.conferencias_vencidas: string[]`.

- [ ] **Step 1: Teste que falha.** Criar `apps/web/test/lib/conferencias.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { CONFERENCIAS, conferenciasVencidas, hojeSP, type Conferencia } from '@/lib/conferencias'

const c = (extra: Partial<Conferencia> = {}): Conferencia => ({ id: 'x-d7', etapa: 'EX', data: '2020-03-10', responsavel: 'agente', onde: 'plano X', feitaEm: null, ...extra })

describe('conferências com data (item 246)', () => {
  it('na véspera e no próprio dia não está vencida; no dia seguinte está, com o nome', () => {
    expect(conferenciasVencidas('2020-03-09', [c()])).toEqual([])
    expect(conferenciasVencidas('2020-03-10', [c()])).toEqual([])
    expect(conferenciasVencidas('2020-03-11', [c()]).map(x => x.id)).toEqual(['x-d7'])
  })
  it('com a data de feita, nunca mais aparece', () => {
    expect(conferenciasVencidas('2030-01-01', [c({ feitaEm: '2020-03-12' })])).toEqual([])
  })
  it('lista vazia: nenhuma vencida', () => {
    expect(conferenciasVencidas('2030-01-01', [])).toEqual([])
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    expect(hojeSP(new Date('2020-03-11T02:59:00Z'))).toBe('2020-03-10')
    expect(hojeSP(new Date('2020-03-11T03:00:00Z'))).toBe('2020-03-11')
  })
  it('a lista publicada é bem formada: ids únicos, datas AAAA-MM-DD, feitaEm nula ou data', () => {
    expect(new Set(CONFERENCIAS.map(x => x.id)).size).toBe(CONFERENCIAS.length)
    for (const x of CONFERENCIAS) {
      expect(x.data, x.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(x.feitaEm === null || /^\d{4}-\d{2}-\d{2}$/.test(x.feitaEm), x.id).toBe(true)
      expect(x.onde.length, x.id).toBeGreaterThan(0)
    }
  })
})
```

  Datas fixas no passado e afirmação sobre a forma da lista publicada, não sobre o conteúdo: o teste não envelhece quando uma conferência vence ou é feita.

- [ ] **Step 2: Implementar `apps/web/src/lib/conferencias.ts`.**

```ts
// A5, item 246: toda conferência "N dias depois do deploy" tem data absoluta, responsável e a data em que foi feita.
// O cron diário da coleta devolve as vencidas (coleta.conferencias_vencidas) enquanto `feitaEm` for nulo.
// Fazer uma conferência = rodar a consulta de `onde`, anotar o resultado no ledger da etapa e preencher `feitaEm` aqui.
// A mesma lista, para quem lê sem abrir o código: .superpowers/sdd/a5/conferencias-com-data.md.
export interface Conferencia {
  id: string
  etapa: string
  /** Dia de São Paulo (AAAA-MM-DD) em que a conferência é devida. Vence no dia seguinte. */
  data: string
  responsavel: 'agente' | 'dono'
  /** Onde está a consulta e o que se espera. */
  onde: string
  /** Dia em que foi feita (AAAA-MM-DD). null = por fazer. */
  feitaEm: string | null
}

const PLANO_E20 = 'docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md, "Conferências depois do envio"'

export const CONFERENCIAS: readonly Conferencia[] = [
  { id: 'e20-tamanho-d8', etapa: 'E20', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, primeira medida`, feitaEm: null },
  { id: 'e20-tamanho-30d', etapa: 'E20', data: '2026-11-12', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, 30 dias`, feitaEm: null },
  { id: 'e20-prova-90d', etapa: 'E20', data: '2027-01-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 > 0 (item 205)`, feitaEm: null },
  { id: 'e20-prova-180d', etapa: 'E20', data: '2027-04-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 maior que em janeiro`, feitaEm: null },
]

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export function hojeSP(agora: Date = new Date()): string {
  return FMT_SP.format(agora)
}

/** Vencida = a data já passou (o próprio dia ainda não conta) e ninguém preencheu `feitaEm`. */
export function conferenciasVencidas(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return lista.filter(c => c.feitaEm === null && c.data < hoje)
}
```

- [ ] **Step 3: Ligar no cron.** Em `coleta/index.ts`, importar `conferenciasVencidas` e `hojeSP` de `@/lib/conferencias` e, no retorno final de `executar` (antes de `resumo.ms = ms`):

```ts
  // Item 246: conferência com data vencida e sem a data de feita aparece em toda execução, com o nome. NÃO entra em
  // `falhas`: marcar como feita é um commit, que só chega a produção no envio seguinte; vermelho por dias depois de a
  // conferência ter sido feita ensinaria a ignorar o vermelho. Lista vazia = nenhuma vencida (o campo está sempre presente).
  resumo.conferencias_vencidas = conferenciasVencidas(hojeSP()).map(c => `${c.id} (${c.etapa}, ${c.data}, ${c.responsavel})`)
```

  Se o dono preferir vermelho (pergunta 3 do topo), é esta linha a mais: `if ((resumo.conferencias_vencidas as string[]).length > 0) pushUnico(falhas, \`conferências vencidas: ${…length} (${…join('; ')})\`)`. **Não incluir sem a palavra dele.**

  Em `index.test.ts`, um teste: com `vi.mock('@/lib/conferencias', …)` devolvendo uma conferência vencida e uma feita, `resumo.conferencias_vencidas` traz só a vencida, e `falhas` não muda.

- [ ] **Step 4: Rodar.** Run: `cd apps/web && npx vitest run test/lib/conferencias.test.ts test/youtube/coleta/index.test.ts > /tmp/e20-t6.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e20-t6.log`. Expected: PASS. Typecheck.

- [ ] **Step 5: Runbook e commit.** No runbook da coleta, seção 3 ("Ler a resposta do cron"), uma linha: "`coleta.conferencias_vencidas`: conferências com data que venceram e ainda não têm a data de feita em `apps/web/src/lib/conferencias.ts`. Não deixa o cron vermelho. Fazer a conferência, anotar no ledger da etapa e preencher `feitaEm`; a linha some no envio seguinte."
`git commit -m "feat: conferências com data em lib/conferencias.ts, listadas pelo cron diário quando vencem (A5, item 246; as quatro da E20)" -- apps/web/src/lib/conferencias.ts apps/web/src/lib/youtube/coleta/index.ts apps/web/test/lib/conferencias.test.ts apps/web/test/youtube/coleta/index.test.ts docs/ops/youtube-coleta-canais-proprios-runbook.md`

**Critério de pronto do envio 2:** `npx vitest run test/youtube/coleta test/cron test/api/cron test/lib/conferencias.test.ts` verde; typecheck verde; conferência manual da Tarefa 2 (Step 1) anotada no ledger com `4`, `true` e `1`. Devolver ao controlador para o envio separado.

---

## Conferências depois do envio (todas só leitura; as consultas foram RODADAS em produção em 12/10, depois da emenda)

| Quando | Consulta | Esperado |
|---|---|---|
| logo depois da MG13 | a consulta do topo e `select * from public.yt_reporting_guarda_conferir()` *(emenda do portão: D-I1)* | `4`, `true`, `1`, `blobs >= 160`, `0`, `0`; a função devolve `brutos = baixados`, `0`, `0`, `0` |
| primeiro cron depois da MG13 (12:00 UTC), e primeiro e segundo depois do envio 2 *(emenda do portão: D-I1, D-M1, CTRL-c)* | `npx supabase db query --linked "select ran_at, resumo->'relatorios'->>'bruto_apagado' as bruto_apagado, resumo->'guarda'->>'blobs_guardados' as blobs_guardados, resumo->'guarda'->>'blobs_guardados_antes' as blobs_guardados_antes, resumo->'guarda'->>'baixados_sem_bruto' as baixados_sem_bruto, resumo->'guarda'->>'brutos_sem_baixado' as brutos_sem_baixado, resumo->'guarda'->>'perdas_reconhecidas' as perdas_reconhecidas, resumo->'conferencias_vencidas' as conferencias_vencidas, falhas from yt_own_collection_runs order by ran_at desc limit 2"` | `bruto_apagado = "0"` sempre. Depois do envio 2: `blobs_guardados` é número, `baixados_sem_bruto = "0"`, `brutos_sem_baixado` anotado (esperado `"0"`), `perdas_reconhecidas = "0"`, `conferencias_vencidas = []`; `blobs_guardados_antes` é nulo no primeiro cron e número no segundo; `falhas` sem `schema_ausente`, sem `guarda do bruto` e sem `caíram`. Hoje (código antigo): `"0"` e os demais nulos |
| **21/10/2026** *(emenda do portão: D-M9, D-vol)* | a consulta de tamanho da linha de 12/11 | primeira medida real (D+8 da E12): anotar no ledger e em `conferencias-com-data.md`; preencher `feitaEm` de `e20-tamanho-d8` |
| **12/11/2026** | `npx supabase db query --linked "select (select count(*) from yt_reporting_report_blobs) as blobs, (select sum(octet_length(csv_gz)) from yt_reporting_report_blobs) as bytes, pg_total_relation_size('public.yt_reporting_report_blobs') as blobs_tabela_bytes, (select count(*) from yt_reporting_reports) as relatorios, pg_total_relation_size('public.yt_reporting_reports') as relatorios_tabela_bytes"` | anotar no ledger e no runbook: é a medida que troca a estimativa de 8 a 23 MB por ano das duas tabelas (hoje: 160, 21.262, 180.224, 264, 286.720); se passar de 30% acima do topo da faixa, corrigir 9.6 do spec |
| **09/01/2027, depois das 12:10 UTC** (item 205) | `npx supabase db query --linked "select count(*) as salvos_pela_e20 from yt_reporting_report_blobs b join yt_reporting_reports r using (report_id) where r.normalized_at < now() - interval '90 days' or (r.report_type_id <> 'channel_reach_basic_a1' and r.downloaded_at < now() - interval '180 days')"` e a consulta do topo | `salvos_pela_e20 > 0` (hoje é 0: são os brutos que a limpeza antiga teria apagado e estão lá; é a prova positiva) e `baixados_sem_bruto = 0` |
| **09/04/2027, depois das 12:10 UTC** | as mesmas duas | `salvos_pela_e20` maior que em janeiro; `baixados_sem_bruto = 0` |

*(emenda do portão: CTRL-c, S20-I3, D-M9)* As quatro com data (21/10, 12/11, 09/01, 09/04) são entradas de `apps/web/src/lib/conferencias.ts` (Tarefa 6): passada a data sem `feitaEm`, o cron diário as lista em `coleta.conferencias_vencidas`. Estão também em `.superpowers/sdd/a5/conferencias-com-data.md`, que vale desde 12/10 e é o que a sessão lê enquanto a Tarefa 6 não está em produção, e no item da seção 13 do runbook. Responsável: o agente da sessão do dia. Cada conferência feita: resultado no ledger da etapa, `feitaEm` preenchido no arquivo e a linha marcada no `.md`. O spec (item 205) marcava 08/01/2027: o plano usa 09/01, depois do cron, porque a primeira normalização medida é de 10/10 às 12:01:59 UTC.

## Fora desta etapa

- Exportar o bruto para o NAS e reabrir a limpeza só para lote confirmado: E10 (MG6). Quando a MG6 chegar, o alarme `bruto_apagado > 0` e a conta de `conferirGuarda` têm de descontar o lote confirmado: está no comentário do código.
- Desistir de um relatório depois de N tentativas (dívida 1 do ledger da E12): `download_attempts` passa a existir, a decisão continua do dono. *(emenda do portão: D-M8)* Quem for decidir só pode ler a coluna em linha `listado`: zero numa linha `baixado` ou `vazio` anterior ao código novo é "não contado", não "baixou sem tentar".
- *(emenda do portão: D-M3)* **Dívida 9 do ledger da E12** (o vermelho de `erro: grande_demais` dura 14 dias a partir de `create_time`, e não do prazo da origem): o destino antigo era "junto da migration `expired_at`". Não pede coluna e a MG13 não a toca; mexer nela aqui mudaria a janela de um critério que esta etapa não testa. **Destino novo: E11**, o primeiro plano que mexe no critério de `erro` dos tipos sem normalizador em `criteria.ts`. Registrada em `.superpowers/sdd/a5/conferencias-com-data.md`, na lista de pendências sem data, para não depender de alguém reler este plano.
- Reconhecer perda por conta própria: o código nunca grava `blob_lost_at`. É coluna do dono.
- O teste da lista fechada do que apaga (item 231) é da E10; a E20 não cria nenhum `delete`.
