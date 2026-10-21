# Sugestões do nicho, F0: coleta dos canais próprios (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 21/10/2026 (Opus, 1º rascunho); **r2** (Sonnet) conserta a 1ª revisão de Phil (84, sem acordo: P1 e P2) e Yannis (76, sem acordo: P-B1, P-B2, P-I1 a P-I3). **Libera:** revisão de Phil e Yannis deste plano. **Não libera:** execução,
migration em produção, push nem promoção; isso vem do "pode" do dono depois do acordo dos dois.

**Goal:** a partir da implantação, todo canal próprio conectado (parado, sem vídeos ou novo) tem os 13 jobs da Reporting
servidos, linha de coleta **ou motivo** todo dia, o detalhe da origem em D+2 a D+4 e capacidade de download para o
canal novo, sem cota extra da Analytics nem da Data API.

**Architecture:** nenhuma coleta nova. Três consertos no que já existe (prioridade da fila, motivo `sem_videos`, um
invariante "conectado ⇒ coleta ligada" vigiado por critério), um modo parcial da rota `sync-analytics-metrics`
(`?passos=`, veredito e linha de execução próprios) chamado por uma segunda entrada do cron às 00:07 UTC, uma visão SQL
de termos sobre o detalhe da origem que já é gravado, e conferências datadas (C4, C6) que não pedem código na F0.

**Tech Stack:** Next.js 16 (rota de cron), TypeScript estrito, Zod, Vitest, Supabase (Postgres 17; integração no
`bythiago_int`, 54421/54422), YouTube Reporting API.

**Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r5, emenda sobre a r4 `577a89ef4`; ver `git log` do arquivo): §2
inteira (2.1 a 2.3), §7 linha F0, §8 linhas "Coleta F0", "Fila da Reporting", "Playlists", "Bruto". Revisões que entram
aqui: `review-r4-e-plano-f0-phil.md` e `review-r4-e-plano-f0-yannis.md` (esta rodada) e `.superpowers/sdd/ab-lab/sugestoes-de-teste-discussao/review-spec-r3-phil.md` (acordo para planejar a F0; M1) e
`review-spec-r3-yannis.md` (B1, B2, I5, I9, M5, M6). Decisões do dono: `decisoes-dono-21-10.md` (D1, D3, D17; D20 do spec, "nada sobre o desempenho do vídeo nosso", conferida: a F0 só coleta e não tem condição sobre vídeo nosso).

> **Para quem executa:** `superpowers:subagent-driven-development`, tarefa por tarefa, agente `executor` (Sonnet,
> effort `medium`). Revisão do lote (Tarefa 10): Phil e Yannis (Opus, `medium`). Leituras de produção: só `select`,
> preparadas em `comandos/` do ledger; se o modo automático negar, o dono roda (uma linha `bash <arquivo>.sh`).

> **Abreviações:** `W` = `~/Workspace/wt-sugestoes-f0`; `C` = `apps/web/src/lib/youtube/coleta`; `R` =
> `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts`; `T` = `apps/web/test`. Ledger:
> `.superpowers/sdd/2026-10-21-sugestoes-f0-coleta-plan/progress.md`.

## Global Constraints

- **Calendário da A5 (Yannis P-B2, r2; a regra da r1 nunca abria):** a A5 **não toca** `C/**`, `reporting/**`, `R`,
  `vercel.json` nem `cron-health-report.ts` (conferido: `git diff --name-only origin/main...HEAD | grep -E "coleta|reporting|sync-analytics|vercel.json|cron-health|agenda/definicoes|outliers"` vazio em `wt-a5-pacote` e `wt-a5-rc2`).
  As Tarefas 3 a 9 **começam** quando `git diff --name-only origin/main...<HEAD de cada worktree ativo da A5>` não
  tocar nenhum desses caminhos, com o resultado colado no ledger (hoje a interseção é vazia: podem andar já, em `W`).
  **O que espera a promoção da A5 é só o push** (orçamento de builds e promoção combinados). No dia do push: `git fetch`,
  rebase de `W`, refazer os `git grep` da §2 (corrigir números de linha no ledger) e rodar a suíte inteira.
- **Migration (Yannis P-B1, r2): o SQL nasce como fixture; o número só se cria depois.** O `db:new` pega a maior migration
  **da árvore** e soma 1, e a A5 tem `20261021000002_observatorio_a5_remover_canal_f1.sql` (em `origin/staging` `caa7a8f47` desde
  o `fetch` de 21/10, ainda fora de `origin/main`); criar a nossa antes faria uma delas sumir em silêncio no `db:push:prod`
  (a versão aparece como aplicada e o CLI pula a outra, sem erro). Portanto: (1) hoje, o SQL vive em
  `apps/web/test/fixtures/sql/sugestoes-f0-coleta.sql` e é provado no `bythiago_int` pelo mesmo teste (precedente da A5 e da
  P4b, `fcbb5af22`); (2) o `npm run db:new sugestoes_f0_coleta` só roda em `W` **depois** de `git fetch` mostrar
  `20261021000002_observatorio_a5_*` em `origin/staging` (confirmar de novo no dia) e de o número escolhido ser maior que
  todos de `origin/staging` **e** dos worktrees ativos (`ls ~/Workspace/wt-*/supabase/migrations | sort | tail -1`); o
  arquivo gerado é cópia byte a byte da fixture (`cmp` igual); (3) antes do `db:push:prod`, o número é **reservado numa
  linha de `.superpowers/sdd/a5/fila-do-db-push.md`** (e se há MG15 a MG17 armada na seção 1, nada se cria nem se aplica);
  (4) nada vai a produção antes de o arquivo estar em `origin/staging`, porque ninguém enxerga um número que só existe no
  nosso worktree; (5) verificação: `ls supabase/migrations | cut -c1-14 | sort | uniq -d` vazio em `W` depois do rebase.
  Nunca no checkout principal (está atrás).
- **Migration antes do código** que a usa: a da Tarefa 2 vai a produção (já em `origin/staging`) antes do push das Tarefas 4 e 7.
- **Nenhuma chamada nova à Analytics nem à Data API** na F0. O modo parcial **não** chama `parteAntiga`, `metadados`,
  `versoes`, `diario`, `dimensoes` nem `retencao`.
- **Veredito separado (Yannis B1):** a execução parcial grava `cron_health` como `sync-analytics-metrics-parcial`;
  nunca como `sync-analytics-metrics`. A linha de `yt_own_collection_runs` leva `escopo = 'parcial'`.
- **Lista fechada de passos parciais:** `jobs`, `relatorios`, `alcance`, `normalizadores`. Qualquer outro valor, valor
  vazio, caixa diferente ou **parâmetro repetido** (`searchParams.getAll('passos').length > 1`): HTTP 400, sem ler nenhuma
  tabela de coleta. **Erro de digitação no `vercel.json` não pode virar silêncio (Yannis P-I1):** com a autorização
  válida e `passos` inválido, grava-se `recordCronFailure('sync-analytics-metrics-parcial', 'passos inválidos: <lista truncada em 80>')`
  antes de devolver 400 (sem essa gravação o vigia daria `unknown`, que fica fora do agregado, para sempre). Teste de
  configuração: toda entrada do `vercel.json` real com `passos` passa em `parsePassos`.
- **Playlists no mesmo push (Phil P1, r2):** os 6 tipos `playlist_*` entram em `REPORT_TYPES_ENABLED` no mesmo push da
  F0-a e F0-c (Tarefa 9), com a conta escrita no ledger: Σ histórico pendente ÷ download/dia ≤ dias até o vencimento mais
  próximo − 7. Adiar até 31/10 perdia 12 relatórios por dia na origem e nada vencia (conta refeita por Phil: 9 dias, folga
  de 14 a 21).
- **"Conectado"** (spec M6) = linha em `social_connections` com `provider = 'youtube'`, `account_id = youtube_channels.channel_id`,
  mesmo `site_id`, `revoked_at is null`, e `collection_status <> 'reautorizar'`.
- **Invariante (Yannis B2, opção a):** canal próprio conectado ⇒ `sync_enabled = true`. Não se mexe em `ativos`
  (`C/index.ts`) nem nos dez filtros por `sync_enabled`. Conectado com `sync_enabled = false` vira **vermelho**
  (`falhas`) **e** `acao_do_dono`, com o texto exato: `coleta: <nome> está conectado com a coleta desligada; ligue a coleta ou desconecte o canal`.
  Isto substitui o "canal desligado de propósito não vira vermelho" do spec (M6): desligar de propósito passa a ser
  desconectar (D3: medir todos os canais próprios).
- **Motivo novo** `sem_videos` em `yt_own_collection_attempts.outcome`: uma tentativa **por canal e dia**, `scope_type = 'canal'`,
  nos kinds `meta` e `diario`; nunca conta como falha, atraso ou orçamento.
- **Sem backfill** (D3): nenhum passo busca dia anterior à implantação além do que o YouTube já entrega sozinho.
- **Bruto sem prazo** (D17): nada muda na limpeza; `yt_reporting_blobs_purge` continua devolvendo 0.
- Regra do CLAUDE.md "env com fallback": o modo parcial não cria variável; o teste equivalente é "sem `?passos` o
  comportamento é o de hoje" (Yannis M6).
- Testes que precisam de banco: `describe.skipIf(skipIfNoLocalDb())`, rodados com
  `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`, sem paralelismo entre arquivos.

## Review Focus

1. **`?passos=` malformado** (`passos=`, `passos=JOBS`, `passos=jobs,,relatorios`, `passos=jobs,jobs`): os três primeiros
   recusam com 400 (gravando a falha sob o nome parcial); o duplicado dentro do valor é aceito e vira um conjunto; o parâmetro repetido (`?passos=a&passos=b`) recusa. Teste nas Tarefas 6 e 7.
2. **Execução parcial no meio da contagem de "passo desligado há N execuções"**: a linha parcial não tem
   `resumo.<passo>.desligado`, e sem filtro zeraria a sequência e calaria o vermelho de `criterioDesligados`. Esperado:
   leitores de `yt_own_collection_runs` que contam execuções (`criteria-desligados.ts`) leem só `escopo = 'completo'`.
   Teste na Tarefa 7.
3. **Canal conectado e desligado, mas com conexão revogada ou em `reautorizar`**: não pinta o critério novo (já sai como
   "reautorizar" ou como "sem conexão"). Teste na Tarefa 5.
4. **`sem_videos` lido por quem conta tentativas**: `criterioOrcamento`, `contarPorResultado` e qualquer critério que trate
   chave desconhecida de `tentativas` como sujeira (precedente: a MG15 só aceitava `ok`, `sem_dado_na_janela`, `video_novo`).
   Esperado: nenhum vermelho novo. Teste na Tarefa 4.
5. **Completo vermelho e parcial verde no mesmo dia** (ou o inverso): o vigia continua vendo o completo vermelho, e um
   parcial que não roda há 26 h acende pelo próprio nome. Teste na Tarefa 7 (rota) e na Tarefa 7 (`resolveCronName`).

---

## 1. Mapa de arquivos

| Arquivo | Tarefa | O quê |
|---|---|---|
| `apps/web/test/fixtures/sql/sugestoes-f0-coleta.sql` (hoje) e, depois, `supabase/migrations/<carimbo>_sugestoes_f0_coleta.sql` (por `db:new`, cópia byte a byte) | 2 | CHECK de `outcome` com `sem_videos`; coluna `escopo` em `yt_own_collection_runs`; visão `yt_own_search_terms` |
| `T/integration/sugestoes-f0-migration.test.ts` (novo) | 2 | prova da migration no `bythiago_int` |
| `.superpowers/sdd/a5/fila-do-db-push.md` | 2 | linha com o número reservado (Yannis P-B1) |
| `C/fila-relatorios.ts` | 3 | faixa 1 = `REACH_TYPES ∪ {channel_traffic_source_a3}` |
| `T/youtube/coleta/fila-relatorios.test.ts` | 3 | ordenação |
| `C/types.ts`, `C/meta-step.ts`, `C/diario-step.ts` | 4 | `sem_videos` |
| `T/youtube/coleta/meta-step.test.ts`, `T/youtube/coleta/diario-step.test.ts`, `T/youtube/coleta/orcamento.test.ts` | 4 | idem |
| `C/criteria-conectados.ts` (novo), `C/index.ts` | 5 | critério do invariante |
| `T/youtube/coleta/criteria-conectados.test.ts` (novo) | 5 | idem |
| `C/passos-parciais.ts` (novo), `C/index.ts` | 6 | lista fechada e `rodarColeta` com `passos` |
| `T/youtube/coleta/passos-parciais.test.ts` (novo), `T/youtube/coleta/index.test.ts` | 6 | idem |
| `R`, `apps/web/vercel.json`, `apps/web/src/lib/ops/cron-health-report.ts`, `C/criteria-desligados.ts` | 7 | modo parcial na rota, cron 00:07, nome do veredito, filtro `escopo` |
| `T/cron/sync-analytics-metrics.test.ts`, `T/cron/sync-analytics-metrics-veredito.test.ts`, `T/lib/ops/cron-health-report.test.ts`, `T/youtube/coleta/criteria-desligados.test.ts` | 7 | idem |
| `apps/web/src/lib/youtube/reporting/types.ts`, `T/integration/observatorio-a5-e10-migration.test.ts` | 8 | comentário de `SEM_NORMALIZADOR`; teste do NAS |
| `apps/web/src/lib/youtube/reporting/` (`REPORT_TYPES_ENABLED`) e testes que contam 13 tipos | 9 | C6 em código: 6 tipos `playlist_*`, aceite "19 tipos" |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md`, `docs/ops/env-vars.md` | 9 | entrada parcial, critério novo, `sem_videos`, C6, "última execução" com `escopo = 'completo'` |

## 2. Fatos conferidos (`origin/main` `b04049787`; `origin/staging` `caa7a8f47` já tem o pacote da A5 em curso, incluindo a migration `20261021000002`, mas `main` ainda não)

Números de linha abaixo valem para hoje e serão refeitos no dia do push (Global Constraints).

- **Divergências deliberadas do spec (Yannis P-M7, S-M2):** (1) o nome do cron é `sync-analytics-metrics-parcial` (hífen) e o limiar é o mecanismo genérico do vigia (`resolveCronName`, tolerância de metade do intervalo, `cron-health-report.ts:218-222`), não "`:parcial`/26 h" do spec r3/r4; (2) T3 e a tabela de eventos vazia ficam na F2 (§6; Phil P8, o spec r5 moveu a linha); (3) C6 vira código no mesmo push (spec r5).

- `C/fila-relatorios.ts:57-58`: `faixa = venceEm − agora ≤ URGENTE_DIAS ? 0 : ALCANCE.includes(tipo) ? 1 : 2`, com
  `ALCANCE = REACH_TYPES`. Dentro da faixa, vencimento crescente (causa dos 16 dias, spec §2.1).
- `C/index.ts:39` `PASSOS_LIGADOS` é constante global; `:176` `ativos = channels.filter(c => c.sync_enabled)`; jobs
  (`:191`), relatórios (`:233`), diário (`:278`), dimensões (`:293`), retenção (`:350`) recebem `ativos`; metadados
  recebe `channels`. Fase `antes`: metadados, versões, jobs (+ `criterioJobsEmErro`). Fase `depois`: guarda, relatórios,
  alcance, critérios de relatórios, diário, dimensões, normalizadores, L2, cobertura, E11, retenção, desligados,
  metadados (critério), orçamento, `voltarAOk`.
- `R:359-512`: `GET` lê canais `sync_enabled`, `coletar('antes')`, `parteAntiga` (Analytics) se `lista.length > 0`,
  `coletar('depois')`, insere em `yt_own_collection_runs`, apaga runs com mais de 90 dias, um único
  `recordCronSuccess/Failure('sync-analytics-metrics')`. `maxDuration = 300` (`R:31`).
- `apps/web/vercel.json:25`: `/api/cron/sync-analytics-metrics` às `0 12 * * *`. O mesmo `path` com `?query` diferente
  já é usado (`sync-youtube?mode=…`, 5 entradas), e `cron-health-report.ts:44-53` (`resolveCronName`) mapeia `?mode=` para
  o nome que o handler grava. Logo o plano B do Yannis (rota irmã) não é preciso.
- `yt_own_collection_attempts.outcome`: CHECK inline sem nome na migration `20261007000006` (nome automático
  `yt_own_collection_attempts_outcome_check`, a confirmar em produção na Tarefa 1); `C/types.ts:5-8` `OUTCOMES` igual.
  O CHECK de `kind` já é regex (`20261013000004:245-247`).
- `C/meta-step.ts:227` e `C/diario-step.ts:109`: `if (videos.length === 0) continue` sem tentativa.
- Conexão do canal (`(authed)/youtube/_actions/channels.ts:181`) já grava `sync_enabled: true`; o painel
  (`dashboard-connected.tsx:597`) deixa o dono desligar. Token: `ensureFreshToken(site, 'youtube', channel_id)` lê
  `social_connections` (`lib/social/token-refresh.ts:98-106`).
- `C/criteria.ts:300-358` já acusa "tipo habilitado sem job" para canal `sync_enabled`; com o invariante isso cobre todo
  canal conectado, então F0-b não precisa de critério de "sem job" novo, só do invariante.
- Leitores de `yt_own_collection_runs`: `C/criteria-desligados.ts` (conta execuções), `C/guarda.ts:95` (base de
  `blobs_guardados`, a parcial também tem guarda: útil), `R` (grava e poda). A MG15 (`20261016000001`) já rodou e não volta.
- `yt_own_video_traffic_detail_daily` (`20261013000006:55-74`): `source_type` é o código cru do CSV (`'5'` = YT_SEARCH em
  `reporting/codigos.ts:49`; a confirmar na Tarefa 1), `detail` ≤ 300, RLS `can_view_private_site` (ou `can_edit_site`),
  `source` com CHECK `in ('reporting_api')` e `source_report_id`/`report_create_time` `not null`.
- `reports-step.ts:590-596`: purge chamado e `> 0` vira falha (verificação de M3 já existe). `obs_archive_batches`
  (`20261014000002:56-57`): `deleted_at` exige `nas_confirmed_at`, que exige `verified_at`.
- `reporting/types.ts:30`: comentário "o bruto é apagado 180 dias depois do download" (falso desde a MG13).
- Tipos `playlist_*`: só `playlist_basic_a2` aparece no código (teste de jobs). Os 6 ids exatos vêm de produção (Tarefa 1).

## 3. As tarefas

| # | Tarefa | Quando | Onde |
|---|---|---|---|
| 1 | árvore, linha de base, leituras de produção | agora | `W` |
| 2 | SQL como fixture + visão de termos (F0-e); migration real só depois (P-B1) | agora | `W` |
| 3 | fila (F0-a) | já, se a interseção da A5 estiver vazia (só o push espera) | `W` |
| 4 | `sem_videos` (F0-b) | idem | idem |
| 5 | invariante conectado ⇒ coleta (F0-b, Yannis B2) | idem | idem |
| 6 | `passos` em `rodarColeta` (F0-c) | idem | idem |
| 7 | modo parcial na rota + cron (F0-c, Yannis B1) | idem | idem |
| 8 | comentário do bruto + teste do NAS (F0-d) | idem | idem |
| 9 | C6 em código, runbook e C4 | idem | idem |
| 10 | revisão do lote (Phil, Yannis) | depois da 9 | — |

### Tarefa 1: árvore, linha de base e leituras de produção

**Files:** nenhum código. Ledger e `comandos/f0-leitura-prod.sh` (só `select`).

- [ ] **Passo 1:** `git fetch origin && git worktree add --detach ~/Workspace/wt-sugestoes-f0 origin/staging` (Yannis P-M6: sem
  branch de feature, a memória do dono veta). `npm ci` em `W`. O push sai de `W` com `bash -c 'git push origin HEAD:staging'`,
  depois do rebase e com o pre-commit verde, sem `--force`. Colar no ledger o resultado da interseção de arquivos da A5 (Global Constraints).
- [ ] **Passo 2:** linha de base: `npm run build:packages && npx tsc -p apps/web --noEmit` em `W`; rodar
  `npx vitest run test/youtube/coleta test/cron test/lib/ops` (saída em arquivo; no ledger só a contagem e falhas
  pré-existentes).
- [ ] **Passo 3:** preparar e rodar (ou entregar ao dono) as leituras, resultado colado no ledger:
  ```sql
  select conname, pg_get_constraintdef(oid) from pg_constraint
   where conrelid = 'public.yt_own_collection_attempts'::regclass and contype = 'c';
  select distinct report_type_id, status from public.yt_reporting_jobs where report_type_id like 'playlist%';
  select source_type, count(*), count(*) filter (where detail = '') as vazios
    from public.yt_own_video_traffic_detail_daily group by 1 order by 2 desc;
  select count(*) filter (where status = 'listado') as listado,
         count(*) filter (where status = 'listado' and create_time < now() - interval '7 days') as listado_7d
    from public.yt_reporting_reports;
  select c.name, c.sync_enabled, c.collection_status, (s.id is not null) as conectado
    from public.youtube_channels c
    left join public.social_connections s on s.site_id = c.site_id and s.provider = 'youtube'
         and s.account_id = c.channel_id and s.revoked_at is null;
  -- capacidade e fila (Phil P1/P2): pendentes por is_backfill e downloads por dia
  select is_backfill, count(*) as pendentes, min(create_time) as mais_antigo
    from public.yt_reporting_reports where status = 'listado' group by 1;
  select date_trunc('day', downloaded_at)::date as dia, count(*) as baixados
    from public.yt_reporting_reports where downloaded_at > now() - interval '10 days' group by 1 order by 1;
  ```
  (os nomes de coluna das duas últimas vêm de `f0b.sql` do Phil, no scratchpad da revisão; conferir antes de rodar.)
  Com o resultado, escrever no ledger a **conta das playlists**: Σ histórico pendente (incl. +360 das playlists) ÷ download/dia ≤ dias até o vencimento mais próximo − 7.
  Esperado: um CHECK de `outcome`, nome `yt_own_collection_attempts_outcome_check`; 6 tipos `playlist_*` `desativado`;
  código de pesquisa (`'5'` ou `'YT_SEARCH'`); os 2 canais `conectado = true`, `sync_enabled = true`. Divergência: parar e
  avisar o controlador antes da Tarefa 2.

### Tarefa 2: SQL como fixture e visão de termos (F0-e)

**Files:**
- Create (hoje): `apps/web/test/fixtures/sql/sugestoes-f0-coleta.sql`. Create (depois, Passo 6): `supabase/migrations/<carimbo>_sugestoes_f0_coleta.sql` por `npm run db:new sugestoes_f0_coleta` em `W`
- Test: `T/integration/sugestoes-f0-migration.test.ts`

**Interfaces:**
- Produces: `outcome` aceita `'sem_videos'`; `yt_own_collection_runs.escopo text not null default 'completo' check (escopo in ('completo','parcial'))`;
  visão `public.yt_own_search_terms(site_id, channel_id, video_id, youtube_video_id, day_pt, termo, sem_termo, views, watch_time_minutes)`.

- [ ] **Passo 1: teste que falha** (`describe.skipIf(skipIfNoLocalDb())`):
  - `insere tentativa com outcome 'sem_videos'` → sucesso; `outcome 'qualquer'` → erro `23514`.
  - `insert em yt_own_collection_runs sem escopo` → linha com `escopo = 'completo'`; `escopo = 'meio'` → `23514`.
  - `yt_own_search_terms` com 3 linhas semeadas no detalhe (pesquisa com termo, pesquisa com `detail = ''`, `RELATED_VIDEO`)
    devolve 2 linhas, `sem_termo` `false`/`true`, nenhuma de `RELATED_VIDEO`.
  - `has_table_privilege('anon', 'public.yt_own_search_terms', 'select')` é `false`; como `authenticated` sem
    `can_view_private_site` do site, 0 linhas (security invoker; GUC `app.site_id` falsificado não muda: padrão de
    `reference_rls_guc_spoof_pattern`). Permissão por `has_*_privilege`, nunca chamando função sem EXECUTE (SIGSEGV local).
- [ ] **Passo 2:** o teste carrega a fixture no `bythiago_int` (`psql -f`) e deve falhar antes do corpo. Não se registra versão em `schema_migrations` (não há número ainda).
- [ ] **Passo 3: corpo da migration** (idempotente). Guarda do CHECK, porque um `drop … if exists` por palpite não faz
  nada (lição do `check3`):
  ```sql
  do $$
  declare v text;
  begin
    select string_agg(conname, ',' order by conname) into v from pg_constraint
     where conrelid = 'public.yt_own_collection_attempts'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%outcome%';
    if v is distinct from 'yt_own_collection_attempts_outcome_check' then
      raise exception 'F0: CHECK de outcome inesperado (%)', v;
    end if;
  end $$;
  ```
  Depois: `drop constraint yt_own_collection_attempts_outcome_check` e `add constraint` com o mesmo nome e a lista
  atual mais `'sem_videos'`; `add column if not exists escopo`; `create or replace view public.yt_own_search_terms with (security_invoker = true)`
  filtrando `source_type in (<código confirmado na Tarefa 1>)`, `termo = detail`, `sem_termo = (detail = '')`;
  `revoke all on public.yt_own_search_terms from public, anon, authenticated; grant select on public.yt_own_search_terms to authenticated;` (Phil P5: o padrão do Supabase dá `insert/update/delete` a objeto novo e uma visão de uma tabela é atualizável). Filtro `source_type = '5'` com comentário citando `ORIGEM_DE_BUSCA` (`reporting/codigos.ts`). No teste: `has_table_privilege('authenticated', 'public.yt_own_search_terms', 'insert') = false`. Comentário da visão: "termos de pesquisa (F0-e); zero job". Hoje a visão devolve 3 linhas, todas `sem_termo` (10 no detalhe inteiro, última de 05/10): vazia não é defeito enquanto a F0-a não andar (anotar no runbook).
- [ ] **Passo 4:** teste passa; `npx tsc -p apps/web --noEmit`; regenerar `database.types.ts` só se o projeto o fizer por
  script (`npm run db:types` ou equivalente; senão editar à mão as duas entradas).
- [ ] **Passo 5: commit** (`feat: SQL da F0 das sugestões como fixture (sem_videos, escopo da execução, termos de pesquisa)`),
  só os caminhos da tarefa.
- [ ] **Passo 6: migration real (só quando o Global Constraints "Migration" permitir):** `git fetch`; confirmar a migration da A5 em `origin/staging`;
  escolher o número; `npm run db:new sugestoes_f0_coleta`; copiar a fixture para o arquivo gerado (`cmp` igual); reservar o número em
  `.superpowers/sdd/a5/fila-do-db-push.md`; `ls supabase/migrations | cut -c1-14 | sort | uniq -d` vazio; commit. O `db:push:prod` é depois
  do acordo da Tarefa 10 e com o arquivo em `origin/staging`.

### Tarefa 3: fila com o detalhe da origem na faixa 1 (F0-a)

**Files:** Modify `C/fila-relatorios.ts`; Test `T/youtube/coleta/fila-relatorios.test.ts`.

**Interfaces:** Produces `export const FAIXA_1: readonly string[] = [...REACH_TYPES, 'channel_traffic_source_a3']`.

- [ ] **Passo 1: testes que falham:**
  - `traffic_source corrente passa na frente de histórico de outro tipo que vence antes`: `channel_device_os_a3`
    (`is_backfill: true`, criado há 10 dias, vence em 20) e `channel_traffic_source_a3` (`is_backfill: false`, criado há
    5 dias, vence em 55) → ordem `[traffic, device]`.
  - `urgente continua na frente`: um histórico de `channel_demographics_a1` que vence em 6 dias vem antes do `traffic`.
  - `alcance e traffic na mesma faixa desempatam por vencimento` (sem mudar a regra interna da faixa).
  - (Yannis P-M4) `traffic` histórico (vence em 30 dias) e `reach_basic` corrente (vence em 60), ambos na faixa 1 → ordem `[traffic, reach]`; fixa a ordem escolhida. Comentário: com o canal novo, ~30 históricos de `traffic_source` passam à frente do alcance corrente, efeito transitório (hoje 2 canais).
- [ ] **Passo 2:** rodar → falha no primeiro.
- [ ] **Passo 3:** `faixa` usa `FAIXA_1` no lugar de `ALCANCE`; comentário do bloco cita F0-a e a causa (spec §2.1).
  `criteria.ts` continua com `REACH_TYPES` (não muda).
- [ ] **Passo 4:** `npx vitest run test/youtube/coleta/fila-relatorios.test.ts test/youtube/coleta/reports-step.test.ts` → PASS.
- [ ] **Passo 5: commit** `fix: detalhe da origem na faixa 1 da fila da Reporting (F0-a)`.

### Tarefa 4: motivo `sem_videos` nos passos `meta` e `diario` (F0-b)

**Files:** Modify `C/types.ts` (`OUTCOMES` + `'sem_videos'`), `C/meta-step.ts`, `C/diario-step.ts`; Test
`T/youtube/coleta/meta-step.test.ts`, `T/youtube/coleta/diario-step.test.ts`, `T/youtube/coleta/orcamento.test.ts`.

**Interfaces:** Consumes o CHECK da Tarefa 2.

- [ ] **Passo 1: testes que falham** (o caso de orçamento abaixo já passa hoje: é **regressão**, rotulado assim, P-M3; o que falha primeiro é o de `meta-step`):
  - meta: canal ativo com 0 vídeos → exatamente uma tentativa `{ scope_type: 'canal', scope_id: c.id, kind: 'meta', outcome: 'sem_videos' }`
    e nenhuma chamada a `obterToken`/`videosList`.
  - diário: idem com `kind: 'diario'`; canal com vídeos no mesmo lote segue gravando `ok`.
  - `criterioOrcamento` com uma tentativa `sem_videos` nos 14 dias: `falhas` vazio (regressão).
  - (Phil P4) leitura truncada: com o lote no teto (`LIMITE_VIDEOS` do diário, 1.000 do PostgREST no meta), nenhum canal ganha `sem_videos`; o canal fora do lote fica `nao_alcancado_orcamento`. `sem_videos` só quando a leitura não bateu no teto.
  - (Yannis P-M1) canal desligado e sem vídeos: o `meta` recebe **todos** os canais (`meta-step.ts:187`), então grava `sem_videos` em `meta`; o diário não (`diario-step.ts:78`). O teste afirma os dois comportamentos.
  - (Yannis P-M2) integração: vídeo publicado hoje num canal antes vazio com tentativa `sem_videos` de `meta` no dia — `yt_own_versions_prova` (`20261014000008:314-318`) não pode tratá-la como motivo de título ausente além do desenhado.
  - `grep -rn "'ok', 'sem_dado_na_janela'" C/` lista os leitores de chave de tentativa; para cada um que trate chave
    desconhecida como erro, um caso com `sem_videos` que afirma "sem vermelho" (Review Focus 4).
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3:** no lugar do `continue`, `await registrarTentativa(ctx, { ...tCanal, outcome: 'sem_videos' })` e
  `continue` (nos dois passos), só se a leitura não bateu no teto. No diário o canal desligado continua fora (o invariante da Tarefa 5 é que cobra isso); no meta ele entra (P-M1).
- [ ] **Passo 4:** `npx vitest run test/youtube/coleta` → PASS.
- [ ] **Passo 5: commit** `feat: tentativa sem_videos para canal próprio sem vídeos (F0-b)`.

### Tarefa 5: invariante "conectado ⇒ coleta ligada" (F0-b, Yannis B2)

**Files:** Create `C/criteria-conectados.ts`; Modify `C/index.ts` (chamada na fase `antes`, logo depois de
`criterioJobsEmErro`); Test `T/youtube/coleta/criteria-conectados.test.ts`, `T/youtube/coleta/index.test.ts`.

**Interfaces:**
- Produces `export async function criterioConectadoDesligado(ctx: { supabase: SupabaseClient; falhas: string[]; channels: ColetaChannel[] }): Promise<string[]>`
  (devolve as notas de `acao_do_dono`; o vermelho vai direto em `ctx.falhas`). Uma leitura de `social_connections` só
  para os canais com `sync_enabled = false`; nenhuma leitura quando não há nenhum.

- [ ] **Passo 1: testes que falham:**
  - canal `sync_enabled: false`, `collection_status: 'ok'`, conexão viva → `falhas` e retorno contêm o texto exato das
    Global Constraints.
  - mesmo canal com `revoked_at` preenchido, ou `collection_status: 'reautorizar'` → nada (Review Focus 3).
  - todos `sync_enabled: true` → zero chamadas a `from('social_connections')`.
  - leitura falha → `falhas` ganha `critérios: não foi possível avaliar canais conectados com a coleta desligada (social_connections)`; nunca verde.
  - `index.test.ts`: com `passos` ausente (Tarefa 6), a fase `antes` chama o critério e junta o retorno em `resumo.acao_do_dono`.
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3:** implementar; seguir a regra de `criteria.ts` ("leitura que falha nunca vira verde"); `pushUnico`.
- [ ] **Passo 4:** `npx vitest run test/youtube/coleta` → PASS.
- [ ] **Passo 5: commit** `feat: critério acusa canal conectado com a coleta desligada (F0-b)`.

### Tarefa 6: `passos` em `rodarColeta` (F0-c, parte 1)

**Files:** Create `C/passos-parciais.ts`; Modify `C/index.ts`; Test `T/youtube/coleta/passos-parciais.test.ts`,
`T/youtube/coleta/index.test.ts`.

**Interfaces:**
- Produces `export const PASSOS_PARCIAIS = ['jobs', 'relatorios', 'alcance', 'normalizadores'] as const`,
  `export type PassoParcial = (typeof PASSOS_PARCIAIS)[number]`,
  `export function parsePassos(raw: string | null): { ok: true; passos: ReadonlySet<PassoParcial> | null } | { ok: false; motivo: string }`
  (`null` = sem parâmetro = execução completa; Zod `z.array(z.enum(PASSOS_PARCIAIS)).min(1)` sobre `raw.split(',')`).
- Produces `ColetaCtx.passos?: ReadonlySet<PassoParcial>`. Regra dentro de `executar`: com `passos` presente roda só o
  passo listado **e** os critérios que são dele (`jobs` → `criterioJobsEmErro` e `criterioConectadoDesligado`;
  `relatorios` → guarda de abertura e fim, `criteriosRelatorios`; `alcance` e `normalizadores` → só o passo);
  `criterioOrcamento` recebe só os kinds dos passos que rodaram; `voltarAOk` **não** roda (P6). Pulados:
  metadados, versões, diário, dimensões, retenção, L2, cobertura, E11, desligados, critério de metadados.

- [ ] **Passo 1: testes que falham:**
  - `parsePassos(null)` → `{ ok: true, passos: null }`; `'jobs,relatorios'` → conjunto de 2; `'jobs,jobs'` → conjunto de 1;
    `''`, `'JOBS'`, `'jobs,,relatorios'`, `'diario'` → `ok: false` (Review Focus 1).
  - `rodarColeta({ fase: 'antes', passos: {jobs} })` não chama `passoMetadados` nem `passoVersoes` (mocks que lançam).
  - `rodarColeta({ fase: 'depois', passos: {relatorios, alcance, normalizadores} })` não chama diário, dimensões,
    retenção, `criteriosL2`, `criteriosE11`, `criterioDesligados`, `criterioMetadados`.
  - sem `passos`: o mesmo conjunto de chamadas de hoje (regressão, Yannis M6).
  - (P-I2) com `YT_OWN_STEPS_OFF=normalizadores` e `passos={normalizadores}`: `passoNormalizadores` não é chamado e `resumo.normalizadores` não vira `{desligado:true}` na linha parcial; com a variável apagada (`delete process.env.YT_OWN_STEPS_OFF`), roda.
  - (P6) canal em `reautorizar` marcado pela Analytics + parcial com Reporting autorizada: `voltarAOk` não é chamado e o canal continua `reautorizar`.
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3 (Yannis P-I2, P-I1 do tsc):** duas funções, não uma fórmula. `rodaParcial(p: PassoParcial) = !ctx.passos || ctx.passos.has(p)`.
  `jobs`, `relatorios`, `alcance`: `PASSOS_LIGADOS[p] && rodaParcial(p)`. `normalizadores` **não está** em `PASSOS_LIGADOS` (é
  `passoDesligado('normalizadores')`, lê `YT_OWN_STEPS_OFF`, `index.ts:298-305`): condição `rodaParcial('normalizadores') && !passoDesligado('normalizadores')`, e o
  modo parcial **não** empurra para `desligados` (só a execução completa conta a sequência). Os demais passos: `!ctx.passos && …`. Sem cast nem `true` por padrão.
  `voltarAOk` **não** roda no modo parcial (Phil P6: a parcial só vê a Reporting e poderia devolver a `ok` um canal em `reautorizar` marcado pela Analytics, fazendo o estado oscilar duas vezes ao dia; só o completo devolve).
- [ ] **Passo 4:** `npx vitest run test/youtube/coleta` → PASS.
- [ ] **Passo 5: commit** `feat: rodarColeta aceita lista fechada de passos (F0-c)`.

### Tarefa 7: modo parcial na rota, cron das 00:07 e veredito próprio (F0-c, parte 2, Yannis B1)

**Files:** Modify `R`, `apps/web/vercel.json`, `apps/web/src/lib/ops/cron-health-report.ts`, `C/criteria-desligados.ts`;
Test `T/cron/sync-analytics-metrics.test.ts`, `T/cron/sync-analytics-metrics-veredito.test.ts`,
`T/lib/ops/cron-health-report.test.ts`, `T/youtube/coleta/criteria-desligados.test.ts`.

**Interfaces:** Consumes `parsePassos`, `ColetaCtx.passos` (Tarefa 6), coluna `escopo` (Tarefa 2).
Produces o nome `sync-analytics-metrics-parcial` em `cron_health`; a rota usa `searchParams.getAll('passos')` (tamanho > 1 recusa); `resolveCronName('/api/cron/sync-analytics-metrics?passos=…') === 'sync-analytics-metrics-parcial'`.

- [ ] **Passo 1: testes que falham:**
  - `passos=desconhecido` (autorizado) → 400, zero leitura de tabela de coleta e `recordCronFailure('sync-analytics-metrics-parcial', 'passos inválidos: …')` com a lista truncada em 80 (P-I1). Sem `Authorization` continua 401 antes de tudo, sem gravar nada. `?passos=jobs&passos=diario` (repetido) → 400.
  - configuração: para toda entrada do `vercel.json` real cujo `path` tenha `passos`, `parsePassos(new URL(path, 'http://x').searchParams.get('passos')).ok === true`.
  - `groupCronSchedules`: tirando a linha da parcial do `vercel.json`, a chave `sync-analytics-metrics-parcial` some e o vigia para de avaliá-la (é o "desfazer" da §5).
  - (Phil P2b) parcial com o passo de relatórios devolvendo `baixados = 0` e `parou_por_limite = true` com fila `listado` > 0: grava em `falhas` "relatórios: a parcial não baixou nada com N na fila" e `recordCronFailure('sync-analytics-metrics-parcial')`; com fila vazia, verde.
  - `passos=jobs,relatorios,alcance,normalizadores` → `parteAntiga` e o cliente da Analytics não são chamados; `coletar`
    recebe `passos`; insert em `yt_own_collection_runs` com `escopo: 'parcial'` e `resumo.passos` = lista; `recordCronSuccess('sync-analytics-metrics-parcial')`.
  - falha na parcial → `recordCronFailure('sync-analytics-metrics-parcial', …)`; nunca o nome do completo.
  - sem `passos` → `escopo: 'completo'` e `recordCron*('sync-analytics-metrics')` (regressão).
  - a leitura de canais que falha na parcial grava a falha sob o nome parcial.
  - `resolveCronName` do caminho com `?passos=` → nome parcial; `groupCronSchedules` com o `vercel.json` real tem as duas
    chaves, `sync-analytics-metrics` (`0 12 * * *`) e `sync-analytics-metrics-parcial` (`7 0 * * *`) (Review Focus 5).
  - `criterioDesligados`: 7 execuções completas com o passo desligado e 7 parciais intercaladas → o vermelho sai na 8ª
    completa, como hoje (Review Focus 2). A leitura filtra `.eq('escopo', 'completo')`.
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3:** na rota: `parsePassos` logo depois da autorização; `const nomeCron = passos ? 'sync-analytics-metrics-parcial' : 'sync-analytics-metrics'`
  em todo `recordCron*`; com `passos`, pular `parteAntiga` (inclusive a nota "all N channels returned an empty
  analytics report"); `escopo` e `resumo.passos` no insert; a poda de 90 dias continua. `vercel.json`:
  `{ "path": "/api/cron/sync-analytics-metrics?passos=jobs,relatorios,alcance,normalizadores", "schedule": "7 0 * * *" }`
  (00:07 UTC, fora dos minutos 0, 5, 15, 20 e 30 já ocupados). `resolveCronName`: caso `sync-analytics-metrics` com
  `passos` → nome parcial (comentário ao lado do caveat do `sync-youtube`).
- [ ] **Passo 4:** `npx vitest run test/cron test/lib/ops test/youtube/coleta test/api/cron` → PASS; `npx tsc -p apps/web --noEmit`.
- [ ] **Passo 5: commit** `feat: entrada parcial da coleta às 00:07 UTC com veredito próprio (F0-c)`.

### Tarefa 8: comentário do bruto e teste do NAS (F0-d)

**Files:** Modify `apps/web/src/lib/youtube/reporting/types.ts:30`; Test `T/integration/observatorio-a5-e10-migration.test.ts`
(acrescentar, se ainda não houver; conferir com `grep -n "nas_confirmed_at" T/integration/observatorio-a5-e10-*.test.ts` antes).

- [ ] **Passo 1:** testes (banco local): `update obs_archive_batches set deleted_at = now()` com `nas_confirmed_at is null`
  → `23514`; `select public.yt_reporting_blobs_purge(<lista>)` com um bruto baixado há 200 dias → `0` e o bruto continua lá.
- [ ] **Passo 2:** comentário passa a dizer: "Tipos sem normalizador: só o bruto comprimido, guardado sem prazo (D17; a
  limpeza devolve 0 desde a MG13 e só a MG6 apaga, e só lote confirmado no NAS)". Nenhuma mudança de código.
- [ ] **Passo 3:** testes passam; **commit** `docs: bruto da Reporting sem prazo no comentário e teste do NAS (F0-d)`.

### Tarefa 9: runbook, C4 e C6 (sem código na F0)

**Files:** `docs/ops/youtube-coleta-canais-proprios-runbook.md`, `docs/ops/env-vars.md` (Yannis M5: uma linha dizendo
que a entrada parcial **não** tem variável; desligar = tirar a linha do `vercel.json`), ledger.

- [ ] **Passo 1:** runbook: entrada parcial (horário, passos, nome no `cron_health`, como desligar), critério do
  invariante e o que o dono faz ("ligar a coleta ou desconectar"), significado de `sem_videos`, visão `yt_own_search_terms` (vazia não é defeito antes da F0-a). **Consulta manual de "última execução" de `yt_own_collection_runs` leva `escopo = 'completo'`** (Phil P9; `conferencias.ts:433` lê `resumo.versoes` da execução das 12:00), e um comentário na coluna `escopo` avisa os leitores futuros.
- [ ] **Passo 2: C4 (só registro, código na F2b):** anotar no ledger, para o plano da F2b: janela pré `[-28, -1]` e pós
  `[+1, +30]` (Phil M1, alinhada ao §3.6); R1 e R4 não têm poda (conferir com
  `git grep -n "delete from public.yt_own_video_daily\|delete from public.yt_own_video_dim_daily" origin/main -- supabase`);
  a gravação `source = 'analytics'` em `yt_own_video_traffic_detail_daily` exige migration na F2b (CHECK
  `source in ('reporting_api')`, `source_report_id` e `report_create_time` `not null`).
- [ ] **Passo 3: C6 em código, no mesmo push (Phil P1/S2):** os 6 ids de `playlist_*` (Tarefa 1) em `REPORT_TYPES_ENABLED`; os
  testes que contam 13 tipos passam a 19; aceite "19 tipos". **Portão por conta**, refeita com o número do dia antes do push
  (consulta de pendentes por `is_backfill` e downloads por dia da Tarefa 1): Σ histórico pendente ÷ download/dia ≤ dias até o
  vencimento mais próximo − 7, escrita no ledger. Se não couber, o commit fica fora do push desse dia. Conferência **D+10**:
  zero `expirado_sem_baixar` em `playlist%` e `listado` com idade > 7 dias = 0.
- [ ] **Passo 4: commit** `docs: runbook da coleta com a entrada parcial, o invariante e sem_videos (F0)`.

### Tarefa 10: revisão do lote

- [ ] Phil (dado, migration, cota) e Yannis (concorrência do modo parcial, veredito, testes) leem o diff de `W` contra
  `origin/staging`; conserta-se até o acordo dos dois; só então o pedido de "pode" ao dono para o envio.

## 4. Envio

1. **Agora (21/10), sem push:** Tarefas 1 e 2 (SQL como fixture) em `W`. As Tarefas 3 a 9 também podem andar em `W` desde que a
   interseção de arquivos com a A5 esteja vazia (Global Constraints). Nada em produção.
2. **Migration:** Passo 6 da Tarefa 2 só depois de a migration da A5 estar em `origin/staging` (confirmada em 21/10: `caa7a8f47`)
   e de o número estar reservado em `fila-do-db-push.md`. Só aditiva (CHECK ampliado, coluna com padrão, visão): qualquer hora
   fora das janelas do vigia. O `db:push:prod` é do dono e só com o arquivo em `origin/staging`.
3. **Dia do push (depois da promoção da A5 de 22/10):** `git fetch`, rebase de `W`, refazer os `git grep` da §2, suíte inteira,
   `uniq -d` de prefixos de migration vazio.
4. **Portões:** Tarefa 10 com acordo; `db:push:prod` da migration **antes** do push; pre-commit verde; conta das playlists escrita.
5. **Push a `staging`** (um só, juntando 3 a 9 incl. C6; conta no teto de 3 pushes/dia/terminal até 27/10), CI verde.
6. **Promoção:** 23/10 é da A5 (T9 da E19); a F0 entra nela **só** se combinada com a A5 até a véspera; senão 24/10, sozinha.
7. **Antes de conectar o 1º canal novo (Phil P2c):** conta no ledger com a capacidade medida em (D+1/D+2): capacidade/dia ≥ 1,3 × (canais × 19).
8. **Conferências datadas** (Phil, só `select`, resultados no ledger):

| Quando | O quê | Esperado |
|---|---|---|
| D+1 e D+2 da promoção | `cron_health` tem `sync-analytics-metrics-parcial` com `last_success_at` depois das 00:07 UTC; linha `escopo='parcial'` sem nota de Analytics; `resumo->'relatorios'->>'baixados'` e `listado` total | `baixados` ≥ 30; `listado` cai ≥ 80/dia enquanto houver fila; valor real = capacidade medida |
| D+3, por canal conectado | faixa 1 (alcance e `traffic_source`) com `create_time`/`end_time` recentes (>= now() − 4 d); tentativa de `meta` e `diario` no dia; relatório **listado** (qualquer status) por tipo e canal com `create_time >= now() − 4 d` (prova que o job está vivo; Yannis P-M5) | 1 por canal; `ok`, `sem_dado_na_janela` ou `sem_videos` |
| dia seguinte a `listado_7d = 0` e 31/10 | os tipos restantes com relatório `baixado`/`vazio` e `create_time >= now() − 4 d` por canal (os 157 históricos da faixa 2 só escoam por volta de 31/10) | todos |
| D+7 | `listado` com `create_time < now() − 7 d` | 0 |
| D+10 | `expirado_sem_baixar` em `playlist%`; `listado` > 7 d | 0; 0 |

   **Teste de vermelho (Phil P2b):** parcial sem download com fila não vazia fecha vermelha; o plano não aceita "parcial verde com 0 baixados".

## 5. Riscos

| Risco | Resposta |
|---|---|
| A A5 reescreve `index.ts`/rota e as linhas da §2 mudam | regra verificável das Global Constraints; refazer os `git grep` no dia |
| Parcial e completo se sobrepõem | 00:07 e 12:00 UTC, `maxDuration` 300 s: sem sobreposição; a parcial não chama a Analytics |
| A parcial gasta o 429 por minuto e atrasa o completo | é o objetivo (dividir o download em duas janelas); conferência D+7 |
| CHECK de `outcome` com outro nome em produção | o `do $$` da migration recusa e nada muda (Tarefa 1 já avisa antes) |
| Dono desliga a coleta de um canal e vê vermelho | é o invariante pedido (D3); o texto diz a saída; desconectar resolve |
| Leitor futuro de `yt_own_collection_runs` esquece `escopo` | comentário na coluna e no runbook; a Tarefa 7 testa o único leitor que conta execuções |
| Parcial leva 429 e não baixa nada | vermelho com fila não vazia (T7) e conferência D+1/D+2 de `baixados` ≥ 30 |
| Erro de digitação em `passos` no `vercel.json` | falha gravada sob o nome parcial e teste do `vercel.json` real (P-I1) |
| Migration da F0 e da A5 com o mesmo número | fixture primeiro, `db:new` só depois da A5 em `origin/staging`, número reservado, `uniq -d` (P-B1) |
| Tipos `playlist_*` nunca gerados para o canal | o critério existente manda para `acao_do_dono`, não vermelho (`criteria.ts`, bloco `paradosBruto`, marca nula) |

## 6. Fora deste plano

- **T3** (calibração com o motor) e a **tabela `niche_signals` vazia com a função de leitura** (§7 do spec, linha F0):
  vão ao plano da F2, que precisa do script de custo do Phil (A8). O spec r5 já moveu essa linha da F0 para a F2 (Phil P8); registrado no ledger.
- C4 em código, gravação `source = 'analytics'` e a janela de evento: F2b.
- Pausa sem escrever, ficha e lembrete: F1a.

## 7. Desfazer (Yannis P-I3)

| O quê | Como |
|---|---|
| Código das Tarefas 3 a 9 | `git revert` do intervalo e um push. A migration **fica**: é aditiva, o código antigo não escreve `escopo` (o padrão `completo` cobre) e a coluna nova não quebra leitor antigo |
| Só a coleta parcial | tirar a linha do `vercel.json`; a chave `sync-analytics-metrics-parcial` some do `groupCronSchedules` e o vigia para de avaliá-la (teste da Tarefa 7) |
| Só as playlists (C6) | tirar os 6 ids de `REPORT_TYPES_ENABLED` e voltar os testes a 13; os jobs criados ficam no YouTube sem prejuízo |
| CHECK de `outcome` (só se preciso) | `delete from yt_own_collection_attempts where outcome = 'sem_videos'` **antes** de recriar a lista antiga, senão o `add constraint` falha na validação |
| Migration já em produção e código que cai | nada a fazer no banco |

## 8. Achados não aplicados

Nenhum dos achados de Phil e Yannis foi recusado. Ajustes de forma: (1) Yannis P-M5 e Phil P3 foram fundidos numa só conferência D+3 (faixa 1 mais relatório listado por tipo) e numa conferência posterior (tipos restantes); (2) Phil P6 foi resolvido pelo caminho mais simples, `voltarAOk` não roda no modo parcial, em vez de filtrar negados/autorizados da Reporting (o comportamento exato é do Yannis na re-revisão); (3) as colunas das consultas de fila/downloads (Tarefa 1) dependem de `f0b.sql` do Phil e devem ser conferidas antes de rodar; (4) Phil P7 (referência ao spec r5) aplicada no cabeçalho.
