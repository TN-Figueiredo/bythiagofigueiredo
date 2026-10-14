# Fase de manutenção (NAS e forja), M0 e M1: medidas que faltam, podas e espaço (plano de implementação)

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** fechar as conferências de leitura que faltam (M0), com um arquivo de comandos que o dono roda numa linha só, e devolver espaço ao banco (M1): poda de 90 dias em `cron_runs` e `yt_own_collection_attempts`, e recuperação dos cerca de 49 MB de `cron.job_run_details`.

**Arquitetura:** a M0 é um script `bash` de leitura (`select` no banco, `ssh` de leitura no NAS e na forja, versões no Mac), com a saída num arquivo em `saidas/`, que o agente lê e passa para o ledger e para o spec. A M1 é **uma migration aditiva**: duas funções de poda em lotes, `security definer`, executáveis só pelo `service_role`, cada uma com um invólucro e um agendamento diário no `pg_cron`, no molde de `cron_purge_used_dsar_tokens` (`supabase/migrations/20260703000003_purge_used_dsar_tokens.sql:28-79`) e dos agendamentos versionados (`supabase/migrations/20260905000001_pg_cron_jobs_versionados.sql:26-69`). A recuperação de `cron.job_run_details` é um comando do dono no SQL Editor do painel do Supabase (uma das três exceções do `05` §16), com conferências de leitura antes e depois.

**Tecnologia:** PostgreSQL 17 (Supabase), `pg_cron` 1.6.4, Vitest, `pg` (cliente de teste), Supabase CLI (`npx supabase db query --linked`).

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/`: `05` §15.1 (linhas M0 e M1), §16.1, §16.2; `01` §6.1 (F1 a F13), §7 (conferências), §8.4 (alavancas 1, 3 e 4); `02` §10.3 ("Podas simples desta fase"); `06` §18 (itens 1 a 6), §19.3 (J2); `00` §3 (D20). Índice dos planos: `docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md`. Brief: `.superpowers/sdd/manutencao-nas/brief-planos.md`.

## Global Constraints

- Migration nova só por `npm run db:new <nome>` (nunca à mão). Nome desta: `manutencao_m1_podas_execucao`.
- Idempotência: a migration roda duas vezes sem erro (`create or replace function`; `cron.schedule(nome, …)` faz upsert por nome).
- Todo `npm run db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as que o passo do dia lista pelo nome (`05` §16). Antes de `db:new` e de `db:push:prod`, ler `.superpowers/sdd/a5/fila-do-db-push.md` seção 1: arquivo ausente é parar e perguntar, nunca "fila vazia".
- Janela comum do `db:push:prod` (A5, R14): fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40; `lock_timeout` de 5 s.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, só no `bythiago_int` (API 54421, Postgres 54422), nunca no 54321. Teste de SQL sob `// @vitest-environment node`.
- NAS e forja: escrita é do dono, sem exceção. O agente prepara um ARQUIVO de comandos e uma linha curta que o roda, com saída em `.superpowers/sdd/manutencao-nas/saidas/`. Exceções que se colam: segredo, linha do cron por `crontab -e`, e o SQL do painel do Supabase da seção 16.2 (é o caso do `vacuum` desta etapa).
- O sistema falha em VERDE: cada passo diz o que acontece quando o dado não existe antes de dizer o que acontece no erro.
- TypeScript strict, sem `any`, arquivos em kebab-case. Commits `tipo: descrição`, um por tarefa, por caminho explícito (`git commit -- <caminhos>`), no `staging`. Nunca `git add -A`, `stash` ou `reset`. **Arquivo novo:** `git add -- <caminhos>` antes de todo `git commit -- <caminhos>` (o commit por caminho não leva arquivo não rastreado: falha com "pathspec did not match"; Yannis, revisão da M2 r2, N1).
- `.superpowers/` não é versionada (`fila-do-db-push.md`, regras): os scripts, o ledger e as saídas desta etapa não entram em commit.
- Sem datas-meta (D24): só relógio real (a poda só tem o que apagar quando a linha tem mais de 90 dias).
- Prazo da poda: **90 dias** (`02` §10.3). Piso no código: a função recusa `p_dias < 90`.
- Horas dos agendamentos existentes (F11, `saidas/producao.txt`, P7): `pgnet-response-retention` 05:00, `pgcron-run-details-retention` 05:30, `purge-sent-emails` 06:00 diário, `purge-old-contact-submissions` 06:00 de domingo (UTC). Os novos: **06:10** (`purge-cron-runs`) e **06:50** (`purge-yt-own-collection-attempts`).

## Review Focus

1. **Vídeo cuja última tentativa de curva tem mais de 90 dias.** A poda "tudo com mais de 90 dias" que o spec escreve faria `yt_own_retention_facts` devolver `vida_tent_dia` e `vida_resposta_dia` nulos, e a tela da curva (`ler-retencao.ts:207-236`) dizer "nenhuma resposta". Esperado: a última tentativa e a última resposta de cada chave nunca são podadas (desvio D-M1-1). Teste: Tarefa 3, `a última tentativa e a última resposta de cada chave sobrevivem`.
2. **Primeira execução em produção com dezenas de milhares de linhas velhas em `cron_runs`.** Esperado: apaga em lotes de 5.000, no máximo 20 lotes por dia, e converge em dias sem estourar o tempo. Teste: Tarefa 3, `apaga em lotes e para no teto de lotes`.
3. **Chamada com prazo menor que 90 (por engano, ou por outra trilha).** Esperado: recusa com `22023`, nada apagado. Teste: Tarefa 3, `recusa prazo abaixo de 90`.
4. **Banco sem `pg_cron` (CI e `bythiago_int`).** Esperado: a migration aplica as funções e não agenda; não derruba o `supabase start`. Teste: Tarefa 3, `a migration aplica duas vezes sem pg_cron`, e o estático da Tarefa 4 confere o guarda; o teste de integração roda também na CI (`ci.yml`, job `test-db-integration`), onde o banco nasce de `supabase/migrations/` sem `pg_cron`.
5. **O banco recusa `vacuum full` e `truncate` em `cron.job_run_details`.** Esperado: fica como está, registrado com a mensagem (item 6), e nada no site muda. Coberto pela Tarefa 6 (não é teste automático: é comando do dono no painel).

## Fatos de partida (conferidos em 14/10/2026)

| # | Fato | Fonte |
|---|---|---|
| FM1 | `cron_runs (id uuid, job text, ran_at timestamptz, status text check ok/error, duration_ms, items_processed, error)`; índices: `cron_runs_pkey (id)` e `cron_runs_job_ran_at_idx (job, ran_at desc)`; nenhum índice só em `ran_at` | `supabase/migrations/20260507000001_schema.sql:1053-1062`, `:5496`; `pg_indexes` no `bythiago_int` |
| FM2 | Único leitor de `cron_runs` no código: `hub-queries.ts:711`, que pede `job_name, started_at` (colunas inexistentes: J2). Os demais só fazem `insert` | `grep -rn cron_runs apps packages scripts` |
| FM3 | `yt_own_collection_attempts`, chave `(scope_type, scope_id, kind, attempt_day)`; gravada só por `yt_own_attempt_record` (upsert do dia) | `20261007000006_coleta_canais_proprios_l1a.sql:100-120`, `:150-175` |
| FM4 | `yt_own_retention_facts` lê o histórico de tentativas: `min(attempt_day)` (`primeira_tent_dia`, `leva_ancora_dia`), `max(attempt_day)` por tipo (`vida_tent_dia`, `d7_tent_dia`…), última resposta (`*_resposta_dia`), e o diário dos últimos 4 dias | `20261013000005_observatorio_a5_e8_retencao.sql:94-165` |
| FM5 | A regra do passo e o alarme usam esses fatos: `retencao-regra.ts:174-197` (vencimento 7 dias, leva 7 dias) e `criteria-retencao.ts:44-80` (alarme aos 8 dias; caso (D) "nunca teve resposta" quando `vida_resposta_dia` é nulo e não há linha) | código |
| FM6 | A tela lê as 30 tentativas mais novas de `retencao_vida` do vídeo e a última resposta | `ler-retencao.ts:207-236` |
| FM7 | Os outros leitores de tentativas olham no máximo 30 dias para trás (`criteria.ts:106-112` (hoje), `:332`, `:477`, `:527`, `:528-565` (14 dias), `:635-640` (hoje); `criteria-cobertura.ts:136-145` (4 dias); `criteria-l2.ts:71`; `meta-step.ts:534`) ou o último dia (`ler-dimensoes.ts:221-227`) | código |
| FM8 | As janelas de 7 e 30 dias deixam de ser lidas 45 dias depois de fechar (`janelaDesisteDias`), isto é, aos 74 dias da publicação: antes dos 90 | `retencao-regra.ts:9-17`, `:206` |
| FM9 | O teste da lista fechada do que apaga (E10, Tarefa 10, `lista-fechada-do-que-apaga.test.ts` e `observatorio-a5-e10-lista-fechada.test.ts`) **não existe no `staging`** em 14/10; o de integração varrerá funções `yt_*` com `delete from` | `git ls-files`; plano da E10, linhas 1008-1039 |
| FM10 | O `bythiago_int` (17.11) não tem `pg_cron` nem o esquema `cron`; tem `yt_own_collection_attempts`, `cron_runs` e `yt_own_retention_facts` | `psql -p 54422` |
| FM11 | `20261013000004` a `…06` (MG14, MG5, MG7 da A5) estão **aplicadas** em produção (`npx supabase migration list --linked`, 14/10/2026, Yannis; local e remoto terminam ambos em `20261013000006`). Hoje não há pendente: a M1 vai sozinha se nada nascer antes dela | `migration list --linked`, 14/10 |
| FM12 | As três consultas da CP28 foram planejadas sem erro no `bythiago_int` em 14/10 (`explain`); as colunas `competitor_changes.video_id` e `.bookmarked` existem | `psql -p 54422` |
| FM13 | **CP30 MEDIDA em 14/10 pelo agente:** o disco da forja não é cifrado (`SEM-CIFRA`) | `saidas/forja-cp30-2026-10-14.txt` |
| FM14 | O SQL da M1 (Tarefa 3) foi ensaiado no `bythiago_int` dentro de `begin … rollback`: aplicado duas vezes, lotes, idempotência, invariante e recusa conferidos | `.superpowers/sdd/manutencao-nas/apoio/m1-podas-prova.sql` e `m1-podas-prova-saida-2026-10-14.txt` **Aviso (revisão de 14/10):** o ensaio é anterior à guarda da primeira tentativa (`rn_primeira`) e ao registro em `cron_runs` dos invólucros; antes de colar o SQL, refazer `m1-podas-prova.sql` com o invariante de `min(attempt_day)` e o `m1-podas-ensaio.sql` com as mesmas trocas |

## Estado das conferências da M0 (`01` §7, item de aceite 1)

| CP | Estado em 14/10 | Onde |
|---|---|---|
| CP1 a CP6 | **pendentes** (CP4 tem metade lida: `P6-papeis` de 13/10 não traz `authenticated`) | Tarefa 1 |
| CP7 | **respondida** (versões anteriores por 30 dias); falta guardar a captura em `saidas/` se ainda não estiver lá | Tarefa 1, passo 5 |
| CP8 | **quase respondida** (`fast/appdata` recursivo, 2 semanas: `saidas/nas-2026-10-14-0012.txt`); falta o campo `exclude` | Tarefa 1 |
| CP17, CP18 | pendentes | Tarefa 1 |
| CP21, CP22 | **respondidas** em 14/10 (`saidas/nas-2026-10-14-0012.txt`; `decisoes-dono-14-10.md`) | nada |
| CP23, CP25 | **respondidas** em 14/10 (`01` §7.5; `saidas/forja-cp23-*`) | nada |
| CP27 | respondida **pela palavra do dono** ("voltam sozinhas"; BIOS não lida) | Tarefa 2 registra |
| CP28 | pendente (sintaxe validada localmente: FM12) | Tarefa 1 |
| CP30 | **medida** pelo agente em 14/10 (FM13) | Tarefa 2 registra |
| CP31 | **respondida** (Vaultwarden do NAS; cópia offline ainda não existe) | nada |
| Pergunta 12 | aberta; não trava etapa | nada |

## Desvio do spec (vai a Phil e Yannis antes do dono)

**D-M1-1. A poda de `yt_own_collection_attempts` guarda, por chave `(scope_type, scope_id, kind)`, a primeira tentativa, a tentativa mais recente e a resposta mais recente (`ok` ou `sem_dado_na_janela`), mesmo com mais de 90 dias.** O spec (`02` §10.3, `01` §8.4 linha 4) diz "nada: é estado de execução; o vigia do canal próprio olha o recente". O código diz outra coisa (FM4 a FM6): sem a exceção, um vídeo antigo sem views novas, cuja última leitura da curva tem mais de 90 dias, (a) passaria a "nunca tentado" na regra do passo e seria relido (gasto de cota a cada 90 dias), (b) entraria no alarme (D) "nunca teve resposta" até a releitura, e (c) a tela diria "nenhuma resposta". Com a exceção, `min(attempt_day)`, `max(attempt_day)` e a última resposta de toda chave ficam iguais antes e depois da poda (provado: FM14, que precisa ser refeito com o invariante de `min`: ver o aviso do FM14). Guarda-se também a primeira tentativa de cada chave: assim `min(attempt_day)` (`primeira_tent_dia`, `leva_ancora_dia`) também fica igual, e o atraso que o alarme (D) imprime continua verdadeiro (sem a primeira, um vídeo parado por mais de 90 dias e retomado calaria o alarme (D) por até 8 dias, e o atraso impresso teria teto de cerca de 90). Custo: até 3 linhas por chave ficam para sempre: com `chaves` medido na M0 (`M1-tentativas`), cerca de 3 × chaves × 250 B (ESTIMATIVA); com 500 vídeos, cerca de 2,6 MB (0,5% do limite de 500 MB). O item de aceite 3 passa a ler "nenhuma linha com mais de 90 dias **que não seja a primeira tentativa, a última tentativa ou a última resposta da sua chave**".

---

## Tarefa 1: o arquivo de comandos da M0 (só leitura) e a linha no LEIAME

**Arquivos:**
- Criar: `.superpowers/sdd/manutencao-nas/m0-medidas.sh`
- Modificar: `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (bloco "AGORA" novo; o bloco das leituras do NAS de 14/10 desce para "Já rodado")

**Interfaces:**
- Produz: `saidas/m0-AAAA-MM-DD-HHMM.txt`, com uma seção `### <rótulo>` por leitura, rótulos fixos (a Tarefa 2 lê por eles): `CP0-versao`, `CP1`, `CP2`, `CP3`, `CP4`, `CP5`, `CP6`, `CP28-1`, `CP28-2`, `CP28-3`, `M1-cron_runs`, `M1-tentativas`, `M1-tamanhos`, `M1-agendados`, `J2-tela-do-hub`, `migrations-pendentes`, `CP8`, `CP17`, `CP18`.

- [ ] **Passo 1: escrever o script.** Conteúdo exato:

```bash
#!/bin/bash
# M0 da fase de manutenção (NAS e forja): as medidas que faltam. SÓ LEITURA: select no banco, leituras no NAS,
# na forja e no Mac. Nada é escrito em lugar nenhum além do arquivo de saída.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m0-medidas.sh
cd ~/Workspace/bythiagofigueiredo || exit 1
O=.superpowers/sdd/manutencao-nas/saidas/m0-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$(dirname "$O")"; : > "$O"
q() { echo "### $1" >> "$O"; npx supabase db query --linked "$2" >> "$O" 2>&1; echo >> "$O"; }
n() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 nas "$2" >> "$O" 2>&1; echo >> "$O"; }
f() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 forja "$2" >> "$O" 2>&1; echo >> "$O"; }
m() { echo "### $1" >> "$O"; bash -c "$2" >> "$O" 2>&1; echo >> "$O"; }
q CP0-versao "select current_setting('server_version') as versao, now() as medido_em;"
q CP1 "select datname, pg_database_size(datname) as bytes from pg_database order by 2 desc;"
q CP2 "select c.relowner::regrole as dono, has_table_privilege('postgres', c.oid, 'MAINTAIN') as pode_manter, has_table_privilege('postgres', c.oid, 'TRUNCATE') as pode_esvaziar, pg_has_role('postgres', 'pg_maintain', 'member') as e_pg_maintain from pg_class c where c.oid = 'cron.job_run_details'::regclass;"
q CP3 "select (select count(*) from cron.job_run_details) as linhas, (select min(end_time) from cron.job_run_details) as mais_antiga, pg_relation_size('cron.job_run_details') as heap, pg_indexes_size('cron.job_run_details') as indices, pg_total_relation_size('cron.job_run_details') as total, s.n_dead_tup, s.last_autovacuum, s.last_vacuum from pg_stat_all_tables s where s.schemaname = 'cron' and s.relname = 'job_run_details';"
q CP4 "select rolname, rolconfig from pg_roles where rolname in ('authenticator','service_role','authenticated');"
q CP5 "select name, permissions, revoked_at is null as ativa from pipeline_api_keys order by 1;"
q CP6 "select (select min(hour_slot) from public.competitor_video_hourly) as primeira_hora, (select min(taken_at) from public.competitor_video_early) as primeira_early, (select count(*) from public.competitor_hour_fold_log) as dias_somados;"
q CP28-1 "select count(*) as elegiveis, count(distinct competitor_channel_id) as canais, count(distinct (competitor_channel_id, date_trunc('month', published_at at time zone 'America/Sao_Paulo'))) as pares_canal_mes_publicacao, (select count(*) from public.competitor_videos where published_at is null) as sem_data from (select v.competitor_channel_id, v.published_at, v.pinned_at, row_number() over (partition by v.competitor_channel_id order by v.published_at desc nulls last) as rn, c.video_limit from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id) x where published_at < now() - interval '24 months' and rn > video_limit and pinned_at is null;"
q CP28-2 "select competitor_channel_id, count(*) as congelaveis from public.competitor_videos v where published_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '24 months' and pinned_at is null group by 1 order by 2 desc;"
q CP28-3 "select count(distinct g.video_id) as videos_com_troca_salva from public.competitor_changes g join public.competitor_videos v on v.id = g.video_id where g.bookmarked and v.published_at < now() - interval '24 months';"
q M1-cron_runs "select count(*) as linhas, min(ran_at) as mais_antiga, count(*) filter (where ran_at < now() - interval '90 days') as mais_de_90_dias, pg_total_relation_size('public.cron_runs') as bytes from public.cron_runs;"
q M1-tentativas "select count(*) as linhas, min(attempt_day) as mais_antiga, count(*) filter (where attempt_day < current_date - 90) as mais_de_90_dias, count(distinct (scope_type, scope_id, kind)) as chaves, pg_total_relation_size('public.yt_own_collection_attempts') as bytes from public.yt_own_collection_attempts;"
q M1-tamanhos "select pg_total_relation_size('cron.job_run_details') as job_run_details, pg_database_size(current_database()) as banco;"
q M1-agendados "select jobname, schedule, active, username from cron.job order by 1;"
q J2-tela-do-hub "select job_name, started_at from public.cron_runs limit 1;"
m migrations-pendentes "npx supabase migration list --linked"
n CP8 "midclt call pool.snapshottask.query | python3 -m json.tool | grep -E '\"dataset\"|\"recursive\"|\"exclude\"|\"lifetime_value\"|\"lifetime_unit\"|\"enabled\"'"
f CP17 "sudo -n true && echo SEM-SENHA || echo PEDE-SENHA"
m CP18 "docker --version; rclone version | head -1"
echo "pronto: $(grep -c '^###' "$O") leituras em $O"
```

- [ ] **Passo 2: conferir que o script só lê.** Rodar `bash -n .superpowers/sdd/manutencao-nas/m0-medidas.sh` (esperado: sem saída) e `sed -E "s/'(MAINTAIN|TRUNCATE)'//g; s/last_(auto)?vacuum//g" .superpowers/sdd/manutencao-nas/m0-medidas.sh | grep -n -i -E "\b(insert|update|delete|truncate|vacuum|drop|alter|create|cluster|reindex|grant|revoke|comment|copy|refresh)\b|crontab -|\brm |\bmv |\bscp\b|\bsudo\b"`. Esperado: **uma** linha, a da CP17 (`sudo -n true`), que é a leitura que o próprio spec manda (`01`, CP17); qualquer outra linha é parar. O mesmo comando vale para `m1-conferencia.sh` (Tarefa 5), com o esperado "nenhuma linha".

- [ ] **Passo 3: ensaiar as consultas que o banco local responde.** No `bythiago_int`, com `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -At -c "<consulta>"`, rodar CP1, CP4, CP5, CP6, as três da CP28 (como `explain`), `M1-cron_runs` e `M1-tentativas`. CP2 e CP3 rodam trocando `cron.job_run_details` por `public.cron_runs` e `'cron'` por `'public'` (o local não tem `cron`: FM10). Esperado: nenhum erro de sintaxe. `J2-tela-do-hub` **tem de** falhar com `column "job_name" does not exist` (é a prova do defeito J2).

- [ ] **Passo 3b: `sem_data` da CP28-1.** A consulta usa subconsulta para `sem_data` (um `filter (where published_at is null)` dentro de `where published_at < …` é zero por construção). Ensaiar no `bythiago_int`, dentro de `begin … rollback`, com uma linha semeada sem data: tem de dar 1. Avisar o redator da M10 (a consulta veio do spec `01` CP28).

- [ ] **Passo 4: o que acontece quando o dado não existe.** Escrever no topo do bloco "AGORA" do LEIAME, em uma frase cada: tabela vazia devolve linha com nulos (não é erro: `mais_antiga` nula quer dizer "nada para podar"); `ssh nas`/`ssh forja` fora do ar deixa a mensagem do `ssh` na seção e o resto segue; `npx supabase` sem login deixa a mensagem e a Tarefa 2 trata a seção como **não lida** (nunca como zero).

- [ ] **Passo 5: o bloco do LEIAME.** Acrescentar em `LEIAME-COMANDOS.md`, no topo, e descer o bloco "AGORA: leituras do NAS (14/10/2026)" para "Já rodado (histórico)":

````markdown
## AGORA: medidas da M0 (só leitura)

Uma linha só, no terminal do Mac. Lê o banco (só `select`), o NAS e a forja (só leitura), e as versões do Mac; guarda tudo em `saidas/`. Não precisa colar nada de volta.

```
bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m0-medidas.sh
```

Por quê: responde quanto o limite de 500 MB conta de verdade (CP1), se o banco deixa recuperar os 49 MB do histórico do agendador (CP2, CP3), o tamanho da primeira leva de vídeos antigos (CP28) e quanto as duas podas vão apagar na primeira noite.

Duas coisas de tela, se ainda não estiverem feitas: (1) a captura da tela "Lifecycle Settings" do bucket do B2, salva como `saidas/cp7-b2-lifecycle.png`; (2) no painel do Supabase, Project Settings, API, o número "Max rows", anotado aqui embaixo.
````

- [ ] **Passo 6: sem commit.** `.superpowers/` não é versionada. Avisar o controlador que o bloco está pronto para o dono.

## Tarefa 2: ler a saída da M0, ledger e correções do spec

**Arquivos:**
- Criar: `.superpowers/sdd/manutencao-nas/ledger-m0-m1.md`
- Modificar: `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/01-fatos-e-capacidade.md` (§7.1, §7.2, §7.3, §7.5: marca "MEDIDO em <data>" ou "RESPONDIDA" em cada CP fechada, com o arquivo de saída), e qualquer número do spec que a resposta mudar
- Modificar: `docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md` (coluna Estado da linha 1)

**Interfaces:**
- Consome: `saidas/m0-*.txt` (rótulos da Tarefa 1).
- Produz: no ledger, as linhas `CP2: pode_manter=<t|f>, pode_esvaziar=<t|f>` e `antes da M1: job_run_details=<bytes>, banco=<bytes>, cron_runs>90d=<n>, tentativas>90d=<n>, pendentes=<lista>`, que as Tarefas 5 e 6 usam.

- [ ] **Passo 1: ler a saída por seção.** `grep -n "^###" saidas/m0-*.txt` e ler cada seção. Seção com erro de conexão, de login ou de permissão = **não lida**: escrever "não lida: <mensagem>" no ledger e pedir ao controlador nova rodada só dela. Nunca preencher com zero.

- [ ] **Passo 2: o ledger.** Uma linha por CP: data, valor, arquivo. Incluir CP27 ("pela palavra do dono em 14/10: voltam sozinhas; BIOS não lida; a prova é uma queda de luz ou o passo 16 do ensaio"), CP30 (FM13), CP7 (captura: caminho, ou "captura não guardada" se o arquivo não existir) e "Max rows" (CP4, primeira parte).

- [ ] **Passo 3: as decisões que a M0 toma para a M1.** Escrever no ledger:
  - CP2 `pode_manter = true`: a Tarefa 6 tenta `vacuum` e `vacuum full`. `false` e `pode_esvaziar = true`: pula direto para o `truncate` (D20). As duas `false`: a Tarefa 6 só registra "recusado pelo banco" (item 6). CP2 com erro (por exemplo `MAINTAIN` desconhecido): tratar como `pode_manter` desconhecido; a Tarefa 6 tenta e registra a mensagem.
  - `migrations-pendentes`: as três da A5 (`20261013000004` a `…06`) estão aplicadas (FM11, 14/10). A regra passa a ser: **qualquer pendente que não seja a M1** = a M1 espera, e o controlador decide pela `fila-do-db-push.md` (nunca empurrar junto sem decisão).
  - `M1-agendados`: se já existir agendamento com o nome `purge-cron-runs` ou `purge-yt-own-collection-attempts`, parar e avisar (o `cron.schedule` sobrescreveria outro). Conferir também em `M1-agendados` que nenhuma tarefa usa `10 6` nem `50 6` (as horas ocupadas do teste estático são fixas) e anotar o `username` dos agendamentos existentes (esperado `postgres`).

- [ ] **Passo 4: corrigir o spec onde o número mudou.** Exemplos do que conferir: F1 e F2 (CP1 diz se outros bancos do cluster pesam no limite), F68 (tamanho atual de `job_run_details`), a parcela de `cron_runs` em `01` §8.1 (taxa real: `linhas / dias desde mais_antiga`). Cada trecho mexido leva "(M0, <data>)".

- [ ] **Passo 5: commit do spec e do índice.**

```bash
git commit -m "docs: M0 da fase de manutenção: conferências respondidas e números corrigidos no spec" -- docs/superpowers/specs/2026-10-13-fase-manutencao-nas/01-fatos-e-capacidade.md docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md
```

Fecha o item de aceite 1 (com as CP listadas) e o 2 (com a captura). Se a captura não existir, o item 2 fica aberto e o ledger diz isso.

## Tarefa 3: a migration das duas podas, com o teste de integração

**Arquivos:**
- Criar (por `npm run db:new manutencao_m1_podas_execucao`): `supabase/migrations/<número>_manutencao_m1_podas_execucao.sql`
- Teste: `apps/web/test/integration/manutencao-m1-podas.test.ts`

**Interfaces:**
- Produz (SQL, `public`, `security definer`, `search_path = ''`, `execute` só para `service_role`):
  - `purge_cron_runs(p_dias integer default 90, p_lote integer default 5000, p_max_lotes integer default 20, p_now timestamptz default now()) returns integer` (linhas apagadas)
  - `yt_own_collection_attempts_purge(p_dias integer default 90, p_lote integer default 5000, p_max_lotes integer default 20, p_now timestamptz default now()) returns integer`
  - `cron_purge_cron_runs() returns void`, `cron_purge_yt_own_collection_attempts() returns void` (invólucros com `raise log` e uma linha em `cron_runs`, job `pg_cron:purge-*`, com `items_processed` = linhas apagadas)
  - agendamentos `purge-cron-runs` (`10 6 * * *`) e `purge-yt-own-collection-attempts` (`50 6 * * *`), só onde há `pg_cron`
  - erro `22023` para `p_dias < 90`, nulo, `p_lote < 1`, `p_max_lotes < 1` ou `p_now` nulo
  - `p_now` futuro vale como `now()` (`least(p_now, now())`): nunca alarga a poda, e a chamada da E10 com o relógio adiantado 24 meses (Tarefa 10 de lá) roda sem erro e sem apagar além do piso

- [ ] **Passo 1: escrever o teste que falha.** `apps/web/test/integration/manutencao-m1-podas.test.ts`:

```ts
// @vitest-environment node
/**
 * Fase de manutenção, M1: as podas de cron_runs e yt_own_collection_attempts (itens de aceite 3 e 4; desvio D-M1-1).
 * Banco: SÓ o bythiago_int. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m1-podas.test.ts --no-file-parallelism
 * As podas apagam no banco inteiro: todo teste roda dentro de begin … rollback, e só afirma sobre as linhas que semeou.
 * O SQL vem de supabase/migrations/ (o arquivo da M1), aplicado duas vezes dentro da transação.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const MARCA = 'manutencao_m1_podas_execucao'

function lerMigration(): string {
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(MARCA))
  if (!achado) throw new Error(`a migration da M1 (${MARCA}) não existe em supabase/migrations/`)
  return readFileSync(dir + achado, 'utf8')
}

interface LinhaTentativa { scope_id: string; kind: string; idade: number; outcome: string }

describe.skipIf(skipIfNoLocalDb())('M1: podas de estado de execução (bythiago_int)', () => {
  let pg: Client
  let siteId: string
  const job = `teste-m1-${randomUUID()}`
  const pre = `m1-${randomUUID().slice(0, 8)}-`
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    siteId = (await seedSite(service)).siteId
  })
  afterAll(async () => {
    await service.from('sites').delete().eq('id', siteId)
    await pg.end()
  })
  beforeEach(async () => {
    await pg.query('begin')
    const sql = lerMigration()
    await pg.query(sql)
    await pg.query(sql) // idempotente
  })
  afterEach(async () => { await pg.query('rollback') })

  const semearRuns = async (dias: number[]): Promise<void> => {
    await pg.query(
      `insert into public.cron_runs (job, ran_at, status) select $1, now() - make_interval(days => d), 'ok' from unnest($2::int[]) d`,
      [job, dias],
    )
  }
  const idadesRuns = async (): Promise<number[]> => {
    const r = await pg.query<{ idade: number }>(
      `select extract(day from now() - ran_at)::int as idade from public.cron_runs where job = $1 order by 1`, [job])
    return r.rows.map(x => x.idade)
  }
  const semearTentativa = async (scope: 'video' | 'canal', id: string, kind: string, idade: number, outcome: string): Promise<void> => {
    await pg.query(
      `insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, outcome)
       values ($1, $2, $3, (now() at time zone 'utc')::date - $4::int, $5, $6)`,
      [scope, pre + id, kind, idade, siteId, outcome])
  }
  const tentativas = async (): Promise<LinhaTentativa[]> => {
    const r = await pg.query<LinhaTentativa>(
      `select substr(scope_id, length($1) + 1) as scope_id, kind, ((now() at time zone 'utc')::date - attempt_day) as idade, outcome
         from public.yt_own_collection_attempts where scope_id like $1 || '%' order by 1, 2, 3 desc`, [pre])
    return r.rows
  }
  const resumoPorChave = `select scope_type, scope_id, kind, min(attempt_day) as prim, max(attempt_day) as ult,
      max(attempt_day) filter (where outcome in ('ok', 'sem_dado_na_janela')) as resp
    from public.yt_own_collection_attempts where scope_id like $1 || '%' group by 1, 2, 3 order by 1, 2, 3`

  it('a migration aplica duas vezes sem pg_cron e não agenda nada', async () => {
    const r = await pg.query<{ n: number }>(`select count(*)::int as n from pg_extension where extname = 'pg_cron'`)
    expect(r.rows[0].n).toBe(0) // FM10: se um dia o bythiago_int ganhar pg_cron, este teste avisa
    const f = await pg.query<{ n: number }>(`select count(*)::int as n from pg_proc where pronamespace = 'public'::regnamespace and proname in
      ('purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts')`)
    expect(f.rows[0].n).toBe(4)
  })

  it('cron_runs: apaga só o que tem mais de 90 dias, e a segunda chamada não apaga nada', async () => {
    await semearRuns([91, 92, 120, 400, 89, 10])
    const n = (await pg.query<{ n: number }>(`select public.purge_cron_runs() as n`)).rows[0].n as number
    expect(n).toBeGreaterThanOrEqual(4) // o banco compartilhado pode ter linhas velhas de outros: afirma-se sobre as nossas
    expect(await idadesRuns()).toEqual([10, 89])
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs() as n`)).rows[0].n).toBe(0)
  })

  it('cron_runs: apaga em lotes e para no teto de lotes', async () => {
    await pg.query(`delete from public.cron_runs where ran_at < now() - interval '90 days'`) // isola a contagem (desfeito no rollback)
    await semearRuns([91, 92, 93, 94, 95])
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 20) as n`)).rows[0].n).toBe(1)
    expect(await idadesRuns()).toEqual([])
  })

  it('cron_runs: a linha de 90 dias exatos fica', async () => {
    await semearRuns([90])
    await pg.query(`select public.purge_cron_runs()`)
    expect(await idadesRuns()).toEqual([90])
  })

  it('cron_runs: p_now no passado manda no corte', async () => {
    await semearRuns([100])
    await pg.query(`select public.purge_cron_runs(p_now => now() - interval '30 days')`)
    expect(await idadesRuns()).toEqual([100])
  })

  it('cron_runs: p_now no futuro não alarga a poda', async () => {
    await semearRuns([60])
    await pg.query(`select public.purge_cron_runs(p_now => now() + interval '60 days')`)
    expect(await idadesRuns()).toEqual([60])
  })

  it('tentativas: a primeira, a última tentativa e a última resposta de cada chave sobrevivem (D-M1-1)', async () => {
    await semearTentativa('video', 'vA', 'retencao_vida', 200, 'ok')
    await semearTentativa('video', 'vA', 'retencao_vida', 180, 'erro_http')
    await semearTentativa('video', 'vA', 'retencao_vida', 150, 'erro_http')
    await semearTentativa('video', 'vA', 'retencao_vida', 120, 'sem_dado_na_janela')
    await semearTentativa('video', 'vA', 'retencao_vida', 100, 'erro_http')
    await semearTentativa('video', 'vB', 'diario', 97, 'erro_http')
    await semearTentativa('video', 'vB', 'diario', 95, 'ok')
    await semearTentativa('video', 'vB', 'diario', 50, 'ok')
    await semearTentativa('canal', 'c', 'retencao_vida', 91, 'ok')
    await semearTentativa('canal', 'c', 'retencao_vida', 10, 'ok')
    await semearTentativa('video', 'vC', 'retencao_7d', 300, 'erro_http') // só uma linha, velha: é a última, fica
    const antes = (await pg.query(resumoPorChave, [pre])).rows

    await pg.query(`select public.yt_own_collection_attempts_purge()`)

    expect(await tentativas()).toEqual([
      { scope_id: 'c', kind: 'retencao_vida', idade: 91, outcome: 'ok' },
      { scope_id: 'c', kind: 'retencao_vida', idade: 10, outcome: 'ok' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 200, outcome: 'ok' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 120, outcome: 'sem_dado_na_janela' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 100, outcome: 'erro_http' },
      { scope_id: 'vB', kind: 'diario', idade: 97, outcome: 'erro_http' },
      { scope_id: 'vB', kind: 'diario', idade: 50, outcome: 'ok' },
      { scope_id: 'vC', kind: 'retencao_7d', idade: 300, outcome: 'erro_http' },
    ])
    expect((await pg.query(resumoPorChave, [pre])).rows).toEqual(antes)
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge() as n`)).rows[0].n).toBe(0)
  })

  it('tentativas: não toca linha dentro do prazo, nem a de 90 dias exatos', async () => {
    for (const idade of [90, 60, 1, 0]) await semearTentativa('video', 'vD', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge()`)
    expect((await tentativas()).map(l => l.idade)).toEqual([90, 60, 1, 0])
  })

  it('tentativas: p_now no passado manda no corte', async () => {
    for (const idade of [100, 95, 1]) await semearTentativa('video', 'vG', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge(p_now => now() - interval '30 days')`)
    expect((await tentativas()).filter(l => l.scope_id === 'vG').map(l => l.idade)).toEqual([100, 95, 1])
  })

  it('tentativas: p_now no futuro não alarga a poda', async () => {
    for (const idade of [100, 60, 1]) await semearTentativa('video', 'vH', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge(p_now => now() + interval '60 days')`)
    expect((await tentativas()).filter(l => l.scope_id === 'vH').map(l => l.idade)).toEqual([100, 60, 1])
  })

  it('tentativas: apaga em lotes', async () => {
    await pg.query(`delete from public.yt_own_collection_attempts where attempt_day < (now() at time zone 'utc')::date - 90`)
    for (const idade of [10, 91, 92, 93, 94]) await semearTentativa('video', 'vE', 'diario', idade, 'erro_http')
    // a de 94 é a primeira e a de 10 é a última; não há resposta: 91, 92 e 93 saem, de 2 em 2
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge(90, 2, 1) as n`)).rows[0].n).toBe(1)
    expect((await tentativas()).map(l => l.idade)).toEqual([94, 10])
  })

  it.each([
    ['purge_cron_runs(30)'], ['purge_cron_runs(null)'], ['purge_cron_runs(90, 0)'], ['purge_cron_runs(90, 10, 0)'],
    ['yt_own_collection_attempts_purge(89)'], ['yt_own_collection_attempts_purge(90, 10, 1, null)'],
  ])('recusa prazo abaixo de 90 e argumento inválido: %s', async chamada => {
    await pg.query('savepoint s')
    await expect(pg.query(`select public.${chamada}`)).rejects.toMatchObject({ code: '22023' })
    await pg.query('rollback to savepoint s')
  })

  it('privilégio: só service_role executa; anon e authenticated não (conferido por catálogo, sem chamar)', async () => {
    const r = await pg.query<{ proname: string; definer: boolean; anon: boolean; auth: boolean; service: boolean }>(
      `select proname, prosecdef as definer, has_function_privilege('anon', oid, 'execute') as anon,
              has_function_privilege('authenticated', oid, 'execute') as auth,
              has_function_privilege('service_role', oid, 'execute') as service
         from pg_proc where pronamespace = 'public'::regnamespace and proname in
         ('purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts')`)
    expect(r.rows).toHaveLength(4)
    for (const f of r.rows) expect([f.proname, f.definer, f.anon, f.auth, f.service]).toEqual([f.proname, true, false, false, true])
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** Comando do cabeçalho do teste. Esperado: FAIL em todos com `a migration da M1 (manutencao_m1_podas_execucao) não existe em supabase/migrations/`.

- [ ] **Passo 3: criar a migration.** O `db:new` só roda **no dia em que a Tarefa 5 pode empurrar** (M0 lida, janela comum): desde o `db:new` o arquivo aparece como pendente para toda outra frente. Antes: ler `.superpowers/sdd/a5/fila-do-db-push.md` seção 1 (se houver MG15, MG16 ou MG17 armada, parar: nada nasce) e rodar `npx supabase migration list --linked`: se houver pendente de outra trilha, parar e avisar o controlador (a M1 iria junto). Depois `npm run db:new manutencao_m1_podas_execucao` e, **no mesmo passo**, acrescentar à seção 1 da fila a linha `- M1-manutenção; pendente; aditiva, não bloqueia: quem empurrar antes leva junto, lista o nome dela no passo do dia e roda m1-conferencia.sh antes e depois; <arquivo>; plano manutenção M0-M1, Tarefa 3; <data e hora>` (ganha "resolvida" no Passo 3 da Tarefa 5). Colar no arquivo o SQL **abaixo** (o `.superpowers/sdd/manutencao-nas/apoio/m1-podas-ensaio.sql` é anterior às revisões de 14/10: não usar sem as mesmas trocas, e refazer o ensaio de FM14):

```sql
-- =============================================================================
-- MIGRATION: fase de manutenção (NAS e forja), etapa M1: podas de estado de execução
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02-desenho-e-contrato-de-dados.md, seção 10.3;
--       itens de aceite 3 e 4 (06, seção 18). Plano: docs/superpowers/plans/2026-10-14-manutencao-nas-m0-m1-medidas-e-podas.md
-- Aditiva. Roda duas vezes sem erro. Sem pg_cron (banco local, CI) os agendamentos não são criados.
--   1. purge_cron_runs: apaga public.cron_runs com ran_at mais velho que p_dias (90), em lotes.
--   2. yt_own_collection_attempts_purge: idem por attempt_day, MENOS até três linhas por chave (scope_type, scope_id, kind):
--      a primeira tentativa, a mais recente e a resposta mais recente ('ok' ou 'sem_dado_na_janela'). Sem isso, yt_own_retention_facts
--      e a tela da curva diriam "nunca tentado" de vídeo cuja última tentativa passou de 90 dias (desvio D-M1-1).
--   3. Dois agendamentos diários, fora de 05:00 a 06:00 UTC e dos minutos 0, 20 e 40.
-- =============================================================================
set lock_timeout = '5s';

create or replace function public.purge_cron_runs(
  p_dias integer default 90,
  p_lote integer default 5000,
  p_max_lotes integer default 20,
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_corte timestamptz;
  v_n integer;
  v_total integer := 0;
  v_i integer := 0;
begin
  if p_dias is null or p_dias < 90 then
    raise exception 'purge_cron_runs: p_dias % abaixo do piso de 90', p_dias using errcode = '22023';
  end if;
  if p_lote is null or p_lote < 1 or p_max_lotes is null or p_max_lotes < 1 or p_now is null then
    raise exception 'purge_cron_runs: argumento inválido' using errcode = '22023';
  end if;
  -- p_now no futuro não alarga a poda (Phil I-2); no passado, respeitado (Yannis M4b; a E10 chama com +24 meses)
  v_corte := least(p_now, now()) - make_interval(days => p_dias);
  loop
    exit when v_i >= p_max_lotes;
    delete from public.cron_runs
     where id in (select r.id from public.cron_runs r where r.ran_at < v_corte limit p_lote);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    v_i := v_i + 1;
    exit when v_n < p_lote;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.purge_cron_runs(integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.purge_cron_runs(integer, integer, integer, timestamptz) to service_role;

create or replace function public.cron_purge_cron_runs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_ini timestamptz := clock_timestamp();
begin
  select public.purge_cron_runs() into v_n;
  insert into public.cron_runs (job, ran_at, status, duration_ms, items_processed)
  values ('pg_cron:purge-cron-runs', now(), 'ok', (extract(epoch from clock_timestamp() - v_ini) * 1000)::int, v_n);
  raise log '[pg_cron] purge-cron-runs: % rows', v_n;
end;
$$;

revoke all on function public.cron_purge_cron_runs() from public, anon, authenticated;
grant execute on function public.cron_purge_cron_runs() to service_role;

create or replace function public.yt_own_collection_attempts_purge(
  p_dias integer default 90,
  p_lote integer default 5000,
  p_max_lotes integer default 20,
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_corte date;
  v_n integer;
  v_total integer := 0;
  v_i integer := 0;
begin
  if p_dias is null or p_dias < 90 then
    raise exception 'yt_own_collection_attempts_purge: p_dias % abaixo do piso de 90', p_dias using errcode = '22023';
  end if;
  if p_lote is null or p_lote < 1 or p_max_lotes is null or p_max_lotes < 1 or p_now is null then
    raise exception 'yt_own_collection_attempts_purge: argumento inválido' using errcode = '22023';
  end if;
  -- p_now no futuro não alarga a poda (Phil I-2); no passado, respeitado (Yannis M4b)
  v_corte := (least(p_now, now()) at time zone 'utc')::date - p_dias;
  loop
    exit when v_i >= p_max_lotes;
    delete from public.yt_own_collection_attempts t
     using (
       select x.scope_type, x.scope_id, x.kind, x.attempt_day
         from (
           select a.scope_type, a.scope_id, a.kind, a.attempt_day, a.outcome,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind
                                     order by a.attempt_day desc) as rn_tentativa,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind
                                     order by a.attempt_day asc) as rn_primeira,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind,
                                                  (a.outcome in ('ok', 'sem_dado_na_janela'))
                                     order by a.attempt_day desc) as rn_mesmo_tipo
             from public.yt_own_collection_attempts a
         ) x
        where x.attempt_day < v_corte
          and x.rn_tentativa > 1
          and x.rn_primeira > 1
          and not (x.outcome in ('ok', 'sem_dado_na_janela') and x.rn_mesmo_tipo = 1)
        limit p_lote
     ) alvo
     where t.scope_type = alvo.scope_type and t.scope_id = alvo.scope_id
       and t.kind = alvo.kind and t.attempt_day = alvo.attempt_day;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    v_i := v_i + 1;
    exit when v_n < p_lote;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.yt_own_collection_attempts_purge(integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.yt_own_collection_attempts_purge(integer, integer, integer, timestamptz) to service_role;

create or replace function public.cron_purge_yt_own_collection_attempts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_ini timestamptz := clock_timestamp();
begin
  select public.yt_own_collection_attempts_purge() into v_n;
  insert into public.cron_runs (job, ran_at, status, duration_ms, items_processed)
  values ('pg_cron:purge-yt-own-collection-attempts', now(), 'ok', (extract(epoch from clock_timestamp() - v_ini) * 1000)::int, v_n);
  raise log '[pg_cron] purge-yt-own-collection-attempts: % rows', v_n;
end;
$$;

revoke all on function public.cron_purge_yt_own_collection_attempts() from public, anon, authenticated;
grant execute on function public.cron_purge_yt_own_collection_attempts() to service_role;

do $guard$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: podas da M1 não agendadas (esperado fora de produção)';
    return;
  end if;
  perform cron.schedule('purge-cron-runs', '10 6 * * *', $$select public.cron_purge_cron_runs()$$);
  perform cron.schedule('purge-yt-own-collection-attempts', '50 6 * * *', $$select public.cron_purge_yt_own_collection_attempts()$$);
end
$guard$;
```

Custo (Big O): `purge_cron_runs` faz, por lote, uma varredura de `cron_runs` (sem índice em `ran_at`: FM1); com cerca de 36 mil linhas hoje e uma base de 90 dias depois, é O(n) por lote e no máximo 20 lotes por dia. Os 20 lotes rodam dentro de uma única chamada de função, numa transação só: o que limita o custo é o teto de 100.000 linhas por dia, não o tamanho do lote. Não se cria índice: o ganho é de milissegundos numa tabela de MB, e todo `insert` de cron pagaria por ele. A poda de tentativas ordena a tabela inteira por chave a cada lote, O(n log n); com cerca de 100 linhas por dia (693 em 7 dias, F12), o patamar de 90 dias é da ordem de 10 mil linhas (ESTIMATIVA): irrelevante.

- [ ] **Passo 4: rodar e ver passar.** Mesmo comando. Esperado: PASS, 18 testes.

- [ ] **Passo 5: tipos e typecheck.** As funções novas não são chamadas pelo TypeScript (só pelo `pg_cron`): **não** regenerar `database.types.ts` nesta tarefa. Rodar `npm run typecheck -w apps/web > /tmp/m1-tc.txt 2>&1; tail -3 /tmp/m1-tc.txt`. Esperado: sem erro.

- [ ] **Passo 5a: a lista fechada (no mesmo commit da migration).** `git ls-files | grep -E "observatorio-a5-e10-lista-fechada"`. Se existir: acrescentar o par `(yt_own_collection_attempts_purge, yt_own_collection_attempts)` neste commit, com a linha "fase de manutenção, pedido 8; disparo: cron; classe: estado de execução", e rodar esse teste no `bythiago_int` **depois de aplicar a migration da M1 fora de transação** (`psql -p 54422 -f <arquivo>`, que é aditiva e idempotente), porque o teste da M1 não a deixa no catálogo. Se não existir: acrescentar a linha da seção 2 da `fila-do-db-push.md` ANTES do commit. Motivo: o teste de integração roda também na CI (`ci.yml`, job `test-db-integration`, que faz `db reset --local` com `supabase/migrations/` inteiro) e o teste da E10 varre do catálogo toda função `yt_*` com `delete from`; sem o par, o `staging` fica vermelho.

- [ ] **Passo 6: commit.**

```bash
git commit -m "feat: M1 da fase de manutenção: poda de 90 dias em cron_runs e yt_own_collection_attempts, em lotes, guardando a primeira e a última tentativa e a última resposta de cada chave" -- supabase/migrations/<número>_manutencao_m1_podas_execucao.sql apps/web/test/integration/manutencao-m1-podas.test.ts [apps/web/test/integration/observatorio-a5-e10-lista-fechada.test.ts, se o Passo 5a o mexeu]
```

O que acontece quando o dado não existe: tabela vazia ou sem linha velha devolve 0 e o `raise log` registra 0 (é o caso de `yt_own_collection_attempts` até a primeira poda real, porque a tabela nasceu em 07/10/2026; a regra da data está na Tarefa 7, Passo 2). Uma poda que devolve 0 todo dia não é sinal de defeito antes dessa data; depois dela, `items_processed = 0` é defeito (conferido por `m1-conferencia.sh`, seção `poda-registro`). O número de linhas do `raise log` só aparece no Logs Explorer do painel, se o `log_min_messages` do projeto deixar (NÃO VERIFICADO).

## Tarefa 4: o teste estático da migration (roda na CI)

**Arquivos:**
- Teste: `apps/web/test/manutencao/m1-podas-migration.test.ts`

**Interfaces:**
- Consome: o arquivo da migration da Tarefa 3 (pela marca `manutencao_m1_podas_execucao`).

- [ ] **Passo 1: o teste estático.**

```ts
// @vitest-environment node
/** M1: o texto da migration das podas, sem banco (roda na CI, onde o pg_cron não existe e o agendamento não é exercido). */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const nome = readdirSync(DIR).find(f => f.includes('manutencao_m1_podas_execucao'))
const sql = nome ? readFileSync(DIR + nome, 'utf8') : ''

/** Horas já ocupadas por agendamentos do banco (F11 e saidas/producao.txt, P7), em UTC. */
const OCUPADAS = new Set(['0 5', '30 5', '0 6'])

/** Confere o guarda e as agendas; devolve os problemas (vazio = ok). */
function conferirAgendas(texto: string): string[] {
  const problemas: string[] = []
  const guarda = texto.slice(texto.indexOf('do $guard$'))
  if (!guarda.includes(`if not exists (select 1 from pg_extension where extname = 'pg_cron')`)) problemas.push('sem guarda do pg_cron')
  const agendas = [...guarda.matchAll(/cron\.schedule\('([^']+)', '([^']+)'/g)].map(m => [m[1], m[2]])
  const combinado = [['purge-cron-runs', '10 6 * * *'], ['purge-yt-own-collection-attempts', '50 6 * * *']]
  if (JSON.stringify(agendas) !== JSON.stringify(combinado)) problemas.push('agendas diferentes do combinado')
  for (const [, cron] of agendas) {
    const [min, hora] = cron.split(' ')
    if (OCUPADAS.has(`${min} ${hora}`)) problemas.push(`hora ocupada: ${cron}`)
    if (['0', '20', '40'].includes(min)) problemas.push(`minuto proibido: ${cron}`)
  }
  if (texto.slice(0, texto.indexOf('do $guard$')).includes('cron.schedule')) problemas.push('cron.schedule fora do guarda')
  return problemas
}

describe('M1: migration das podas (estático)', () => {
  it('o arquivo existe', () => { expect(nome).toBeDefined() })

  it('os dois agendamentos estão dentro do guarda do pg_cron, com nome e hora fixos', () => {
    expect(conferirAgendas(sql)).toEqual([])
  })

  it('o teste enxerga: agenda às 06:00 é acusada', () => {
    expect(conferirAgendas(sql.replace("'10 6 * * *'", "'0 6 * * *'"))).not.toEqual([])
  })

  it('cada invólucro registra a execução em cron_runs', () => {
    expect(sql.match(/insert into public\.cron_runs/g)).toHaveLength(2)
  })

  it('toda função é security definer, search_path vazio, sem execute para public, anon e authenticated', () => {
    const funcoes = ['purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts']
    for (const f of funcoes) {
      const ini = sql.indexOf(`create or replace function public.${f}(`)
      expect(ini, f).toBeGreaterThanOrEqual(0)
      const corpo = sql.slice(ini, sql.indexOf('$$;', ini))
      expect(corpo, f).toContain('security definer')
      expect(corpo, f).toContain(`set search_path = ''`)
      expect(sql, f).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`))
      expect(sql, f).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`))
    }
  })

  it('o piso de 90 dias está nas duas podas, e nenhuma linha da migration reescreve tabela', () => {
    expect(sql.match(/p_dias < 90/g)).toHaveLength(2)
    expect(sql.match(/p_dias integer default 90/g)).toHaveLength(2)
    expect(sql).not.toMatch(/\b(vacuum|truncate|drop table|cluster)\b/i)
  })

  it('só duas tabelas são apagadas', () => {
    const alvos = [...sql.matchAll(/delete from public\.([a-z_]+)/g)].map(m => m[1])
    expect(alvos).toEqual(['cron_runs', 'yt_own_collection_attempts'])
  })
})
```

- [ ] **Passo 2: rodar.** `npx vitest run test/manutencao/m1-podas-migration.test.ts` (em `apps/web`). Esperado: PASS, 7 testes (a Tarefa 3 já criou o arquivo da migration). A prova de que o teste enxerga é o teste `o teste enxerga`, que não mexe na migration commitada (a pasta é compartilhada).

- [ ] **Passo 3: commit.**

```bash
git commit -m "test: M1: a migration das podas agenda fora das horas ocupadas, só service_role executa e só duas tabelas são apagadas" -- apps/web/test/manutencao/m1-podas-migration.test.ts
```

Fecha o item de aceite 4 em parte: lotes, idempotência e prazo. O par entra na lista fechada no commit da migration (Tarefa 3, Passo 5a); `purge_cron_runs` fica fora porque a varredura da E10 só olha `competitor_*`, `yt_*`, `youtube_channel_*` e `obs_*`: desvio D-M1-2, vai ao dono junto do D-M1-1 (seção "Dívidas declaradas ao dono").

## Tarefa 5: o envio da M1 (dono) e a conferência de leitura

**Arquivos:**
- Criar: `.superpowers/sdd/manutencao-nas/m1-conferencia.sh`
- Modificar: `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (bloco "AGORA: M1")
- Modificar: `.superpowers/sdd/manutencao-nas/ledger-m0-m1.md`

**Interfaces:**
- Consome: ledger da Tarefa 2 (`pendentes`, `CP2`), commits das Tarefas 3 e 4 em `origin/staging` com a CI verde.
- Produz: `saidas/m1-conferencia-AAAA-MM-DD-HHMM.txt`, rótulos `tamanhos`, `cron_runs`, `tentativas`, `tentativas-fora-da-regra`, `agendados`, `ultimas-execucoes`, `poda-registro`, `historico-agendador`, `J2-tela-do-hub`.

- [ ] **Passo 1: o script de conferência (só leitura).**

```bash
#!/bin/bash
# M1: conferência de leitura (antes e depois do envio, e no dia seguinte). Só select.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m1-conferencia.sh
cd ~/Workspace/bythiagofigueiredo || exit 1
O=.superpowers/sdd/manutencao-nas/saidas/m1-conferencia-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$(dirname "$O")"; : > "$O"
q() { echo "### $1" >> "$O"; npx supabase db query --linked "$2" >> "$O" 2>&1; echo >> "$O"; }
q tamanhos "select pg_total_relation_size('cron.job_run_details') as job_run_details, pg_total_relation_size('public.cron_runs') as cron_runs, pg_total_relation_size('public.yt_own_collection_attempts') as tentativas, pg_database_size(current_database()) as banco, now() as medido_em;"
q cron_runs "select count(*) as linhas, min(ran_at) as mais_antiga, count(*) filter (where ran_at < now() - interval '91 days') as mais_de_91_dias from public.cron_runs;"
q tentativas "select count(*) as linhas, min(attempt_day) as mais_antiga, count(*) filter (where attempt_day < current_date - 90) as mais_de_90_dias from public.yt_own_collection_attempts;"
q tentativas-fora-da-regra "select count(*) as devia_ter_saido from (select a.attempt_day, a.outcome, row_number() over (partition by a.scope_type, a.scope_id, a.kind order by a.attempt_day desc) as rn_t, row_number() over (partition by a.scope_type, a.scope_id, a.kind order by a.attempt_day asc) as rn_p, row_number() over (partition by a.scope_type, a.scope_id, a.kind, (a.outcome in ('ok','sem_dado_na_janela')) order by a.attempt_day desc) as rn_m from public.yt_own_collection_attempts a) x where x.attempt_day < current_date - 90 and x.rn_t > 1 and x.rn_p > 1 and not (x.outcome in ('ok','sem_dado_na_janela') and x.rn_m = 1);"
q agendados "select jobname, schedule, active, username from cron.job order by 1;"
q ultimas-execucoes "select j.jobname, d.status, d.start_time, left(d.return_message, 200) as mensagem from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname in ('purge-cron-runs','purge-yt-own-collection-attempts') order by d.start_time desc limit 6;"
q poda-registro "select job, ran_at, status, duration_ms, items_processed from public.cron_runs where job like 'pg_cron:purge-%' order by ran_at desc limit 6;"
q historico-agendador "select j.jobname, d.status, d.start_time, d.end_time, left(d.return_message, 200) as mensagem from cron.job_run_details d join cron.job j on j.jobid = d.jobid order by d.start_time desc limit 300;"
q J2-tela-do-hub "select job_name, started_at from public.cron_runs limit 1;"
echo "pronto: $(grep -c '^###' "$O") leituras em $O"
```

Conferir com `bash -n` e com o comando de escrita da Tarefa 1, Passo 2 (esperado aqui: nenhuma linha). Ensaiar no `bythiago_int` as consultas que não dependem de `cron` (`cron_runs`, `tentativas`, `tentativas-fora-da-regra`).

- [ ] **Passo 2: o bloco do LEIAME (o dia do envio).** Na janela comum (fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40), com a CI do commit verde:

````markdown
## AGORA: M1, podas (no Mac)

1. Leitura antes (uma linha):
```
bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m1-conferencia.sh
```
2. Conferir o que vai subir (leitura):
```
cd ~/Workspace/bythiagofigueiredo && npx supabase migration list --linked
```
**Só siga se a única pendente for `<número>_manutencao_m1_podas_execucao`.** Se houver outra, pare e avise. **Se a M1 já aparecer aplicada** (outra frente a empurrou junto, com o nome listado no passo do dia dela), não rode o passo 3: vá direto ao passo 4 e avise; a leitura "antes" passa a ser a da M0.
3. Enviar:
```
npm run db:push:prod
```
4. Leitura depois: a mesma linha do passo 1.
````

O `<número>` é preenchido pelo controlador com o número real do arquivo antes de entregar o bloco.

- [ ] **Passo 3: ler as duas saídas e registrar.** No ledger: `agendados` tem os dois nomes novos com as horas `10 6 * * *` e `50 6 * * *`, `active = true` e `username = postgres` (qualquer outro papel faria a tarefa falhar no dia seguinte); os tamanhos antes e depois; a linha da fila ganha "resolvida". O que acontece quando o dado não existe: `agendados` sem os dois nomes depois do `push` = o guarda viu "sem `pg_cron`" em produção (impossível pelo F11, mas não se presume): parar e avisar; nada foi apagado e nada será.

- [ ] **Passo 4: no dia seguinte, depois das 07:00 UTC, a mesma linha de conferência.** Esperado (item de aceite 3, com D-M1-1): `cron_runs.mais_de_91_dias = 0` (a folga de um dia existe porque a leitura é feita horas depois do corte das 06:10; o item de aceite 3 lê com a mesma folga, e isto vai para o ledger) se a primeira poda coube em 20 lotes de 5.000 (se `M1-cron_runs` da M0 mostrou mais de 100.000 linhas velhas, esperar os dias que faltam: `ceil(n / 100000)`); `tentativas-fora-da-regra = 0`; `poda-registro` com as duas linhas do dia (ausência da linha do dia = o agendamento não rodou ou falhou: ler `ultimas-execucoes`); `agendados` com `username = postgres`; `ultimas-execucoes` com `succeeded` nas duas. `cron_runs` em bytes **igual** no dia seguinte e sem crescimento em 30 dias: o `delete` libera espaço dentro da tabela e o reaproveita, não devolve ao disco (o ganho de cerca de 14 MB por ano é crescimento evitado); tamanho igual não é falha da poda. `failed` ou mensagem de `lock_timeout`: registrar a mensagem e rodar de novo no dia seguinte; dois dias seguidos falhando, avisar o controlador.

- [ ] **Passo 5: item de aceite 5 (a tela do hub).** `J2-tela-do-hub` dá `column "job_name" does not exist` antes e depois: o defeito J2 está como estava (`06` §19.3); a poda não o cria nem o esconde. Registrar no ledger. **Não consertar aqui** (fora do escopo; J2 é adjacente).

## Tarefa 6: recuperar `cron.job_run_details` (dono, SQL Editor do painel)

**Arquivos:**
- Modificar: `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (bloco "AGORA: M1, recuperar o histórico do agendador")
- Modificar: `.superpowers/sdd/manutencao-nas/ledger-m0-m1.md`

**Interfaces:**
- Consome: CP2 e CP3 (ledger da Tarefa 2); `m1-conferencia.sh` (Tarefa 5).

Não depende do envio da Tarefa 5 (depende só da CP2 e da CP3: `05` §15.1). Pode vir antes.

- [ ] **Passo 1: decidir pelo ledger o caminho** (Tarefa 2, Passo 3): `vacuum` → `vacuum full` → `truncate`, pulando o que a CP2 negou.

- [ ] **Passo 2: o bloco do LEIAME.** Hora: fora de 05:00 a 07:00 UTC (os agendamentos do banco, inclusive os dois da M1, rodam nesse intervalo) e fora dos minutos 0, 20 e 40 (a mesma janela do `db:push:prod`); o `vacuum full` segura a tabela por segundos, e os jobs que começarem nesse tempo só atrasam. **Ordem:** a Tarefa 6 roda **antes** do envio da Tarefa 5 ou **depois** da leitura do Passo 4 dela, nunca no meio (o `truncate` apagaria a primeira execução das podas antes de ela ser lida). O passo 1 do bloco guarda o histórico do agendador em `saidas/` (seção `historico-agendador` do `m1-conferencia.sh`) antes de qualquer `vacuum full` ou `truncate`. Os SQL deste bloco são a exceção escrita do `05` §16: colam-se no SQL Editor do painel do Supabase.

````markdown
## AGORA: M1, recuperar o histórico do agendador (painel do Supabase)

1. Leitura antes, no Mac (uma linha):
```
bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m1-conferencia.sh
```
2. No painel do Supabase, SQL Editor, cole e rode (comando leve; segundos):
```
vacuum (verbose) cron.job_run_details;
```
Se o editor recusar com "cannot run inside a transaction block", anote a mensagem e use a conexão "Session pooler" com `psql` (a mesma via do `vacuum full` da dieta, E6 P3, Apêndice D).
3. Leitura de novo (passo 1). Se `job_run_details` ainda tiver dezenas de MB, no mesmo lugar:
```
vacuum full cron.job_run_details;
```
4. Só se o passo 3 for recusado (e a CP2 disse que pode esvaziar): perde 7 dias de histórico de execução do agendador, e nada mais (D20).
```
truncate table cron.job_run_details;
```
5. Leitura de novo (passo 1).
````

(O redator do bloco apaga do texto entregue os passos que a CP2 já negou, e diz isso numa linha.)

- [ ] **Passo 3: registrar (item de aceite 6).** No ledger: tamanho de `job_run_details` e do banco antes e depois de cada passo; qual via funcionou (`vacuum`, `vacuum full` ou `truncate`), ou "as duas recusadas", com a mensagem literal do banco. O que acontece quando o dado não existe: tabela já pequena antes do passo 2 (alguém recuperou, ou o `pg_cron` foi reinstalado) = registrar o tamanho e não rodar nada. Um `vacuum` comum que "não devolveu nada" não é erro: é o motivo do passo 3. Depois do `truncate`, `v_cron_health` diz "OK" para tarefa sem execução até ela rodar de novo (sem linha em `job_run_details`, `health` cai no `else 'OK'`): não ler esse painel antes das 07:00 UTC do dia seguinte.

- [ ] **Passo 4: conferir no dia seguinte, depois das 07:00 UTC,** que os três agendamentos antigos, e os dois da M1 se a Tarefa 5 já tiver rodado, continuam com `succeeded` em `ultimas-execucoes` (o `truncate` não apaga `cron.job`, só o histórico).

## Tarefa 7: fechamento da etapa

**Arquivos:**
- Modificar: `docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md` (Estado da linha 1: "M0 e M1 em produção, <data>")
- Modificar: `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/06-aceite-e-riscos.md` (item 3: a redação do D-M1-1, com a marca "(M1, <data>)"); `02-desenho-e-contrato-de-dados.md` §10.3 e `01` §8.4 linha 4 (a exceção da primeira tentativa, da última tentativa e da última resposta)

- [ ] **Passo 1: conferir item a item.** 1 (CP respondidas, spec corrigido: Tarefa 2), 2 (captura da CP7), 3 (Tarefa 5, Passo 4, e a conferência com data do Passo 2 desta tarefa), 4 (Tarefas 3 e 4), 5 (Tarefa 5, Passo 5), 6 (Tarefa 6). Item sem prova no ledger fica aberto, e o índice diz qual.

- [ ] **Passo 2: conferência com data, escrita no índice e no ledger.** "Primeira poda real de tentativas: no dia `mais_antiga` (de `M1-tentativas` da M0) **+ 92 dias**, depois das 07:00 UTC (com a primeira linha da tabela em 07/10/2026, é 07/01/2027). Rodar `m1-conferencia.sh`. Esperado: `poda-registro` com `pg_cron:purge-yt-own-collection-attempts` do dia e `items_processed > 0`, e `tentativas-fora-da-regra = 0`. `items_processed = 0` nesse dia é defeito, não silêncio." (+92 e não +91 porque a primeira linha de cada chave fica: a primeira apagável é a do segundo dia.) O dono estará na Ásia: é uma linha do Mac. Sem esta conferência, o item de aceite 3 para essa tabela fecha em "0 = 0", em verde, sem ter exercido a função em produção.

- [ ] **Passo 3: commit.**

```bash
git commit -m "docs: M0 e M1 da fase de manutenção fechadas: itens de aceite 1 a 6 conferidos, desvio D-M1-1 escrito no spec" -- docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md docs/superpowers/specs/2026-10-13-fase-manutencao-nas/06-aceite-e-riscos.md docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02-desenho-e-contrato-de-dados.md docs/superpowers/specs/2026-10-13-fase-manutencao-nas/01-fatos-e-capacidade.md
```

## O que fica NÃO VERIFICADO neste plano

- Se o SQL Editor do painel aceita `vacuum` (ou se é preciso o Session pooler): a Tarefa 6 responde no dia.
- Se o papel `postgres` tem `MAINTAIN`/`TRUNCATE` em `cron.job_run_details`: CP2, na M0.
- O agendamento em si (`cron.schedule`) só existe em produção: nenhum teste local o exerce (FM10). A prova é `agendados` e `ultimas-execucoes` da Tarefa 5.
- O número de linhas velhas de `cron_runs` em produção (quantos dias a primeira poda leva): `M1-cron_runs`, na M0.
- **Decidido pelo controlador em 14/10 (Phil I-2 x Yannis M4b):** `p_now` futuro é truncado em `now()` dentro das duas funções (`least(p_now, now())`), sem erro. O piso de 90 dias não tem porta lateral, e a chamada da E10 com o relógio adiantado continua rodando. Dois testes por função (passado manda; futuro não alarga), em `cron_runs` e em tentativas, matam o mutante (b) nos dois sentidos e nas duas funções. O teste de integração passa a 18.
- O papel que o `db push` do CLI usa para criar a tarefa do `pg_cron` (esperado `postgres`): a conferência `agendados` do dia seguinte responde.

## Dívidas declaradas ao dono

Em linguagem simples. Cada uma tem dono (o controlador) e o que faria pagá-la.

- **D-M1-1: três linhas por vídeo ficam para sempre na tabela de tentativas.** O combinado dizia "apagar tudo com mais de 90 dias". Se fosse assim, um vídeo antigo pareceria "nunca lido", seria relido sem necessidade (gasta cota do YouTube) e o alarme diria que ele nunca teve resposta. Por isso a poda guarda, de cada vídeo, a primeira tentativa, a última e a última resposta. Custo: cerca de 2,6 MB com 500 vídeos, 0,5% do limite. Precisa do seu aceite.
- **D-M1-2: a poda do histórico de execuções do site (`purge_cron_runs`) fica fora da lista fechada de coisas que apagam.** A lista da etapa E10 só olha tabelas do Observatório, e essa tabela não é do Observatório. Fica registrada aqui como apagamento por idade, disparado por cron, sobre estado de execução. Pagar: quando a lista fechada passar a cobrir todo o banco.
- **D-M1-3: se a poda falhar no agendador, nenhum aviso chega a ninguém.** O painel de saúde do agendador (`v_cron_health`) não tem quem o leia, e o log do banco não chega a lugar nenhum que o senhor veja. Cada poda grava uma linha em `cron_runs` (seção `poda-registro` de `m1-conferencia.sh`), mas só quem roda a conferência a vê. Risco: as duas tabelas voltam a crescer sem aviso (cerca de 400 linhas por dia em `cron_runs`). Pagar: na primeira etapa desta fase que criar um vigia de agendamentos, ou quando alguma tela passar a ler `v_cron_health`; até lá, `m1-conferencia.sh` entra na rotina do controlador uma vez por mês.
- **Sem índice em `cron_runs.ran_at`.** A poda varre a tabela inteira uma vez por dia (alguns MB). Pagar: se `cron_runs` passar de cerca de 1 milhão de linhas.
- **J2 (já existia):** a tela do hub lê colunas que não existem em `cron_runs`; a poda não a cria nem a esconde. Fora desta fase (`06` §19.3).

## Dependências de outras etapas e trilhas

- **A5 (fila do `db:push`):** a M1 não é destrutiva, mas o arquivo dela, do `db:new` ao `db:push:prod`, aparece como pendente para toda outra frente. Por isso: (a) o `db:new` só roda no dia em que a Tarefa 5 pode empurrar (M0 lida, nenhuma pendente de outra trilha, janela comum); (b) no mesmo passo do `db:new`, uma linha nova na `fila-do-db-push.md`, seção 1: `- M1-manutenção; pendente; aditiva, não bloqueia: quem empurrar antes leva junto, lista o nome dela no passo do dia e roda m1-conferencia.sh antes e depois; <arquivo>; plano manutenção M0-M1, Tarefa 3; <data e hora>`; (c) a linha ganha "resolvida" no Passo 3 da Tarefa 5. Fato de 14/10/2026 (Yannis, `migration list --linked`): as migrations da A5 `20261013000004` a `…06` já estão aplicadas em produção; a M1 não espera por elas, e se outra frente a empurrar antes, o LEIAME da Tarefa 5 manda ir direto à leitura depois.
- **E10, Tarefa 10 (lista fechada do que apaga):** o par `(yt_own_collection_attempts_purge, yt_own_collection_attempts)` vai no MESMO commit da migration (Tarefa 3, Passo 5a); se o teste da E10 ainda não existir, a linha da seção 2 da `fila-do-db-push.md` é escrita antes desse commit e o commit da E10 a consome.
- **Revisão:** Phil (dados) e Yannis (software) no fim deste plano, antes de ele voltar ao dono; o D-M1-1 é o ponto que pede o aceite dos dois. Pareceres aplicados em 14/10; destino de cada achado em `.superpowers/sdd/manutencao-nas/resolucao-plano-m0-m1.md`.
