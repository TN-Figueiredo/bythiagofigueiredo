# A/B Lab S8, fase 1: gravação (carimbo da regra, retrato diário, sonda da miniatura) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 18/10/2026 (1ª versão, Opus). Antes de executar: Phil e Yannis (G4) revisam; conserta-se até haver acordo;
depois o "pode" do dono (o "seguir a recomendação em tudo" de 18/10 já libera a F1 antes do E8, P2).

**Goal:** gravar, por teste A/B, variante e dia, o que o placar e a regra v2 futuros vão precisar e que não se
reconstrói depois (carimbo `regra_duracao`, retrato `ab_test_dias`, sonda horária `ab_test_sondas`), sem mudar
rotação, `settleOnAir`, drift, avaliação nem placar.

**Architecture:** uma migration (coluna com default, duas tabelas, três funções SQL, um índice, quatro CHECKs
alargados por superconjunto provado, na mesma transação). Duas rotas de cron novas que só leem o resto do banco e o CDN e só escrevem nas
tabelas novas. A decisão fica em funções puras em `apps/web/src/lib/youtube/ab-gravacao/` (estado do alcance,
atribuição do dia, montagem do retrato, classificação da sonda); a rota só carrega em lote, chama a função pura e
grava.

**Tech Stack:** Next.js 16 (rotas de cron `GET`), TypeScript estrito, Vitest, Supabase (Postgres 17; integração no
`bythiago_int`, 54421/54422), `sharp` (já dependência, via `thumb-fingerprint.ts`).

**Spec:** `docs/superpowers/specs/2026-10-18-ab-s8-placar-e-duracao-design.md` (r2, acordo de Phil e Yannis): §1,
§2 inteira, §3 (estados), §6 (casos de 25 h que valem para o retrato), §7, §8 C-1 a C-7, §9, §11. Pendências que este
plano fecha: `~/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/pendencias-plano-s8.md`
(seção "Pendências", no fim). Decisões do dono: `perguntas-dono-s6-s8.md` na mesma pasta (P2, P3, corte da Hanna).

## Global Constraints

- **Lista proibida (C-1, G0):** o diff do lote não toca `apps/web/src/app/api/cron/ab-rotate/**`,
  `apps/web/src/app/api/cron/ab-evaluate/**`, `apps/web/src/app/api/cron/ab-watchdog/**`,
  `apps/web/src/lib/youtube/ab-rotation.ts`, `ab-rotate-phases.ts`, `ab-settle*.ts`, `ab-drift*.ts`, `ab-watchdog*.ts`,
  `ab-evaluate*.ts`, `ab-statistics.ts`, `ab-gates.ts`, `ab-restore.ts`, `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts`,
  `ab-lab/_components/**`, `ab-lab/actions.ts`, e **`apps/web/src/lib/youtube/thumb-fingerprint.ts`** (partilhado com a A5).
  A conferência é por lista PERMITIDA (Task 7), mais forte que a proibida.
- **Nenhum código da F1 escreve `regra_duracao`** nem usa `regra_v2`, `teste_youtube` ou `pulado_teste_youtube`.
- **Escrita só em `ab_test_dias` e `ab_test_sondas`.** Nada em `ab_tests`, `ab_test_cycles`, `ab_test_variants`, YouTube.
- **Migration** só por `npm run db:new ab_lab_s8_f1_gravacao`, criada **no dia da aplicação**; até lá o SQL vive no
  rascunho `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/s8-f1-migration.sql` (checkout principal) e é ensaiado no
  54422. Idempotente: `if not exists`, `create or replace`, `drop constraint if exists`, `drop policy if exists`.
  `set lock_timeout = '5s'`. Aplicar fora de 07:50–08:10 e 11:50–12:10 UTC (T19). Fila: Migration A (aplicada,
  `20261018000003`) → S8-F1 ou S4 da A5 (a que ficar pronta primeiro) → S7 fase 1 → Migration B; tudo até
  **29/10 23:59 UTC**.
- **Push** por sha literal em `bash -c`, fora de 07:50–08:10, 09:50–10:10, 11:50–12:10, 19:50–20:10 UTC. Commit por
  caminho explícito. Nunca `stash`/`reset`. G1: `db:push:prod` antes do push do código que lê as tabelas.
- **TDD:** vermelho por asserção (o módulo e a assinatura existem, o corpo devolve o valor errado), nunca "módulo não
  encontrado". Lib pura e teste de rota sob `// @vitest-environment node`. Datas relativas ou fake timers.
- **Nomes de dado** (copiados do spec): `alcance_estado in ('medido','zero_medido','ausente_no_relatorio','aguardando','nao_medido')`;
  `views_estado in ('medido','zero_medido','nao_medido')`; `motivo_sem_variante in ('menos_de_90','meta_ausente','meta_nula','dia_de_outro_teste','teste_apagado')`;
  `leitura_estado in ('bate','nenhuma_bate','sem_referencia','ambigua','falhou')`; `erro in ('timeout','rede','http_<n>','imagem_invalida')`.
  Relatório: `report_type_id = 'channel_reach_basic_a1'`. Limiar: `0,9 × segundos_do_dia`. D+10: `diffDias(day_pt, ontemPt(agora)) >= 10`.
- Crons: `{ "path": "/api/cron/ab-retrato", "schedule": "0 14 * * *" }` e
  `{ "path": "/api/cron/ab-sonda-miniatura", "schedule": "15 * * * *" }`; 49 → 51 agendas. **Sem** a 2ª agenda
  `*/10 8-11` (P3).

## Review Focus

1. **Dia de 25 h e de 23 h** (01/11/2026 cai dentro da vida do T19): `segundos_do_dia` 90 000/82 800 e o limiar de
   90% do próprio dia, nunca 77 760 fixo. Teste em Task 2.
2. **Dois relatórios do mesmo dia** (backfill/reemissão), o mais novo ainda `listado` e o velho normalizado: tem de
   dar `aguardando`, nunca o estado do velho; com o mais novo `expirado_sem_baixar`, `nao_medido`. Teste em Task 1.
3. **Teste apagado com linhas abertas**: nenhuma linha fica `aguardando` para sempre. Teste em Task 5 (integração).
4. **Vídeo que ficou privado ou CDN fora** (HEAD 404, `fetch` rejeita por timeout): a sonda grava `falhou` com
   `erro = 'http_404'`/`'timeout'`, e a rodada não morre pelos outros testes (`allSettled`). Teste em Task 6.
5. **Uma leitura em lote falha no meio** (ex.: `yt_reporting_reports` dá erro depois de `meta_daily` ter vindo):
   nada é escrito, `recordCronFailure('ab-retrato', …)`, nenhum dia vira `aguardando` por falta de leitura. Teste em Task 5.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/s8-f1-migration.sql` (checkout principal) | rascunho da migration até o dia da aplicação |
| `supabase/migrations/<ts>_ab_lab_s8_f1_gravacao.sql` | criado por `db:new` no dia; cópia do rascunho |
| `apps/web/src/lib/youtube/ab-gravacao/tipos.ts` | tipos das linhas lidas e gravadas (abaixo) |
| `apps/web/src/lib/youtube/ab-gravacao/estado.ts` | `estadoDoAlcance`, `estadoDasViews`, `ehFinal` (puras) |
| `apps/web/src/lib/youtube/ab-gravacao/atribuicao.ts` | `atribuirDia`, `diasDoTeste` (puras) |
| `apps/web/src/lib/youtube/ab-gravacao/retrato.ts` | `montarRetrato` (pura: entradas em `Map` → linhas) |
| `apps/web/src/lib/youtube/ab-gravacao/retrato-step.ts` | `rodarRetrato` (carrega em lote, chama `montarRetrato`, grava por RPC) |
| `apps/web/src/lib/youtube/ab-gravacao/sonda.ts` | `classificarLeitura`, `erroDaSonda`, `enviadaEmDoEtag`, `horaDe` (puras) |
| `apps/web/src/lib/youtube/ab-gravacao/sonda-step.ts` | `rodarSonda` (carrega, sonda em paralelo, grava) |
| `apps/web/src/app/api/cron/ab-retrato/route.ts` | rota fina: auth, `withCronLock`, `rodarRetrato` |
| `apps/web/src/app/api/cron/ab-sonda-miniatura/route.ts` | rota fina: auth, `withCronLock`, `rodarSonda`, `maxDuration = 60` |
| `apps/web/vercel.json` | duas agendas |
| `apps/web/test/youtube/ab-gravacao/*.test.ts` | testes puros e de step |
| `apps/web/test/ab-cron-retrato.test.ts`, `test/ab-cron-sonda.test.ts` | testes das rotas |
| `apps/web/test/integration/ab-s8-f1-*.test.ts` | schema, CHECKs (C-10a), RLS, `apply`, retrato e sonda contra 54422 |

**Desvio declarado do spec (para Phil e Yannis):** o spec manda importar `uploadInstant` de `thumb-fingerprint.ts`, mas
ela **não é exportada** (`thumb-fingerprint.ts:47`, função local) e o mesmo spec diz que o arquivo não muda. Escolha:
`enviadaEmDoEtag(etag)` em `sonda.ts`, mesma regra (`/^\d{9,11}$/`, epoch em segundos, aspas e `W/` tiradas), devolvendo
ISO; teste de paridade contra `probeThumb` com `fetch` falso (o `lastModified` de `probeThumb` e o nosso apontam o mesmo
instante). Exportar seria 1 palavra num arquivo da A5; fica como alternativa se Yannis preferir.

---

### Task 1: migration (rascunho), ensaio no 54422 e a prova de superconjunto (C-10a)

**Files:**
- Create: `~/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/s8-f1-migration.sql`
- Test: `apps/web/test/integration/ab-s8-f1-checks.test.ts`, `ab-s8-f1-schema-rls.test.ts`

**Interfaces:**
- Produces (SQL):
  - `ab_tests.regra_duracao text not null default 'v1' check (regra_duracao in ('v1','v2'))`.
  - `ab_tests_completed_reason_check`: `completed_reason is null or completed_reason in ('auto_resolve','manual_winner','manual_archive','max_duration','inconclusive','manual_no_apply','manual_apply','regra_v2')`.
    O CHECK de `20260531000007` não tem `is null or`, mas CHECK com `NULL` passa de todo jeito; escrever `is null or` explícito.
  - `ab_test_cycles_end_reason_check`: `end_reason is null or end_reason in ('pausa','encerrado','falha_api','duracao_maxima','drift','rotacao','regra_v2','teste_youtube')`.
  - `ab_tests_restore_status_shape`: idêntico ao de `20261014000005` (copiar a expressão inteira), com
    `'pulado_teste_youtube'` acrescentado à lista de `estado` **nos dois ramos** (`title` e `thumbnail`). **Corte da Hanna:**
    com isso a migration da S7 fase 1 não reescreve CHECK nenhum; o plano da S6/S7 fase 1 tem de tirar as duas
    reescritas dele (avisar o controlador). Marcado para Phil e Yannis confirmarem.
  - `ab_test_restores_estado_check` (**4º CHECK**, Phil D1 / Yannis B1): tabela `ab_test_restores`, CHECK inline de
    `20261014000005_ab_restore_status.sql:120`; novo: `estado in ('ok','falhou','pulado_sem_original','pulado_drift','desistiu','pulado_teste_youtube')`
    (`em_andamento` continua fora: o gatilho `ab_tests_restore_log` pula esse estado). Motivo: o gatilho copia
    `restore_status -> k ->> 'estado'` para essa tabela; alargar só o `shape` deixaria a fase 2 da S7 quebrar com `23514`
    dentro do gatilho. Os dois (shape e histórico) mudam **na mesma migration e na mesma transação**, com uma prova só (Step 2).
    O plano da S6/S7 fase 1 tira a parte (d) da T6 e o teste "superconjunto" de `ab_test_restores` (avisar o controlador); o pré-requisito dela vira
    "o CHECK de `ab_test_restores` do 54422 aceita `pulado_teste_youtube`".
  - Os quatro por `drop constraint if exists` + `add constraint ... not valid` + `validate constraint`. (`supabase db push` roda o arquivo
    numa transação: o `validate` não reduz o lock; o que protege o T19 é `lock_timeout = '5s'`, a transação única e a janela. Manter por padrão da casa.)
  - Tabelas `ab_test_dias` e `ab_test_sondas` e as três funções: **DDL completo na seção "DDL fechado da Task 1"**, logo abaixo
    (o executor copia, não escolhe tipo). Decididas aqui além do spec: `motivo_nulo_meta text`, `segundos_do_dia int not null`
    (o dia sempre tem duração conhecida) e `variantes_sem_referencia smallint` na sonda (pendência 7).
  - `ab_test_dias_apply(p_rows jsonb) returns integer`, `ab_test_dias_fechar_apagados(p_test_ids uuid[]) returns integer` e
    `ab_test_dias_fechar_antigas(p_antes date) returns integer` (Yannis B2): `security definer`, `set search_path = ''`, corpos abaixo.
  - As três funções: `revoke all ... from public, anon, authenticated; grant execute ... to service_role`.
  - RLS nas duas tabelas: `enable row level security`; `select using (public.can_edit_site(site_id))`; sem policy de
    escrita; `revoke all from anon`; `revoke insert, update, delete, truncate from authenticated`.
  - Índice `yt_reporting_reports_tipo_canal_inicio on yt_reporting_reports (report_type_id, channel_id, start_time)`.
  - `comment on` de cada tabela e coluna nova dizendo o que nulo quer dizer (copiar da tabela do spec §2.3). Exceção com texto fixo
    (Phil D5, Yannis P3): `comment on column public.ab_test_dias.motivo_nulo_meta is 'Recalculado pela S8 (recálculo) com os ciclos só deste teste; nulo = não reproduzido aqui; não é o valor que a A5 calculou nem o que a meta_daily viu.'`.

#### DDL fechado da Task 1 (copiar para o rascunho; tipos conferidos no 54422)

```sql
set lock_timeout = '5s';

alter table public.ab_tests add column if not exists regra_duracao text not null default 'v1';
alter table public.ab_tests drop constraint if exists ab_tests_regra_duracao_check;
alter table public.ab_tests add constraint ab_tests_regra_duracao_check check (regra_duracao in ('v1','v2'));

create table if not exists public.ab_test_dias (
  test_id uuid not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (length(youtube_video_id) = 11),
  regra_duracao text not null,
  variant_id uuid,
  motivo_sem_variante text check (motivo_sem_variante in ('menos_de_90','meta_ausente','meta_nula','dia_de_outro_teste','teste_apagado')),
  motivo_nulo_meta text,
  segundos_no_ar int,
  segundos_do_dia int not null,
  dia_de_troca boolean,
  ciclos jsonb not null check (jsonb_typeof(ciclos) = 'array' and jsonb_array_length(ciclos) > 0),
  impressoes bigint,
  ctr numeric,
  alcance_estado text not null check (alcance_estado in ('medido','zero_medido','ausente_no_relatorio','aguardando','nao_medido')),
  source_report_id text,
  report_create_time timestamptz,
  views bigint,
  views_estado text not null check (views_estado in ('medido','zero_medido','nao_medido')),
  views_fonte text,
  metric_version text,
  engaged_views bigint,
  watch_time_minutes numeric,
  avg_view_percentage numeric,
  troca_vista_em timestamptz,
  retratado_em timestamptz not null,
  final boolean not null default false,
  primary key (test_id, day_pt),
  check ((variant_id is null) = (motivo_sem_variante is not null)),
  check (troca_vista_em is null or dia_de_troca)
);
create index if not exists ab_test_dias_abertas on public.ab_test_dias (test_id) where not final;

create table if not exists public.ab_test_sondas (
  test_id uuid not null,
  hora timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text,
  lida_em timestamptz not null,
  http int,
  erro text,
  etag text,
  enviada_em timestamptz,
  sha16 text,
  dhash text,
  variante_esperada uuid,
  variante_vista uuid,
  leitura_estado text not null check (leitura_estado in ('bate','nenhuma_bate','sem_referencia','ambigua','falhou')),
  variantes_sem_referencia smallint not null default 0,
  primary key (test_id, hora)
);

create or replace function public.ab_test_dias_apply(p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.ab_test_dias (test_id, day_pt, site_id, youtube_video_id, regra_duracao, variant_id, motivo_sem_variante,
    motivo_nulo_meta, segundos_no_ar, segundos_do_dia, dia_de_troca, ciclos, impressoes, ctr, alcance_estado, source_report_id,
    report_create_time, views, views_estado, views_fonte, metric_version, engaged_views, watch_time_minutes, avg_view_percentage,
    troca_vista_em, retratado_em, final)
  select x.test_id, x.day_pt, x.site_id, x.youtube_video_id, x.regra_duracao, x.variant_id, x.motivo_sem_variante,
    x.motivo_nulo_meta, x.segundos_no_ar, x.segundos_do_dia, x.dia_de_troca, x.ciclos, x.impressoes, x.ctr, x.alcance_estado,
    x.source_report_id, x.report_create_time, x.views, x.views_estado, x.views_fonte, x.metric_version, x.engaged_views,
    x.watch_time_minutes, x.avg_view_percentage, x.troca_vista_em, x.retratado_em, x.final
  from jsonb_to_recordset(p_rows) as x(test_id uuid, day_pt date, site_id uuid, youtube_video_id text, regra_duracao text,
    variant_id uuid, motivo_sem_variante text, motivo_nulo_meta text, segundos_no_ar int, segundos_do_dia int, dia_de_troca boolean,
    ciclos jsonb, impressoes bigint, ctr numeric, alcance_estado text, source_report_id text, report_create_time timestamptz,
    views bigint, views_estado text, views_fonte text, metric_version text, engaged_views bigint, watch_time_minutes numeric,
    avg_view_percentage numeric, troca_vista_em timestamptz, retratado_em timestamptz, final boolean)
  on conflict (test_id, day_pt) do update set
    site_id = excluded.site_id, youtube_video_id = excluded.youtube_video_id, regra_duracao = excluded.regra_duracao,
    variant_id = excluded.variant_id, motivo_sem_variante = excluded.motivo_sem_variante, motivo_nulo_meta = excluded.motivo_nulo_meta,
    segundos_no_ar = excluded.segundos_no_ar, segundos_do_dia = excluded.segundos_do_dia, dia_de_troca = excluded.dia_de_troca,
    ciclos = excluded.ciclos, impressoes = excluded.impressoes, ctr = excluded.ctr, alcance_estado = excluded.alcance_estado,
    source_report_id = excluded.source_report_id, report_create_time = excluded.report_create_time, views = excluded.views,
    views_estado = excluded.views_estado, views_fonte = excluded.views_fonte, metric_version = excluded.metric_version,
    engaged_views = excluded.engaged_views, watch_time_minutes = excluded.watch_time_minutes,
    avg_view_percentage = excluded.avg_view_percentage, troca_vista_em = excluded.troca_vista_em,
    retratado_em = excluded.retratado_em, final = excluded.final
  where not public.ab_test_dias.final;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.ab_test_dias_fechar_apagados(p_test_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.ab_test_dias set final = true, retratado_em = now(),
    alcance_estado = case when alcance_estado = 'aguardando' then 'nao_medido' else alcance_estado end,
    motivo_sem_variante = case when variant_id is null then 'teste_apagado' else motivo_sem_variante end
  where test_id = any(p_test_ids) and not final;
  get diagnostics n = row_count;
  return n;
end $$;

-- Linhas abertas antigas demais para a janela de leitura: fecham sem tocar variante nem motivo (Yannis B2).
create or replace function public.ab_test_dias_fechar_antigas(p_antes date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.ab_test_dias set final = true, retratado_em = now(),
    alcance_estado = case when alcance_estado = 'aguardando' then 'nao_medido' else alcance_estado end
  where day_pt < p_antes and not final;
  get diagnostics n = row_count;
  return n;
end $$;
-- depois: revoke/grant das três, RLS (enable + policy select can_edit_site), índice de yt_reporting_reports, comments,
-- e os quatro CHECKs (completed_reason, end_reason, restore_status_shape, ab_test_restores_estado) no padrão drop/add not valid/validate.
```

- [ ] **Step 1: trazer `origin/staging` para o lote** (`git fetch origin staging && git merge --ff-only origin/staging`
  ou `git rebase origin/staging`, sem stash; o lote está 5 commits à frente só com docs). Conferir que
  `supabase/migrations/20261018000003_ab_tipo_sem_descricao.sql` existe e que nenhuma migration posterior a `20261014000005`
  redefiniu os quatro CHECKs: `grep -ln "end_reason_check\|completed_reason_check\|restore_status_shape\|ab_test_restores_estado_check\|ab_test_restores\b" supabase/migrations/*.sql`
  devolve só `20260531000007`, `20261014000005` e (se o `ab_settle_claim`/gatilho foi redefinido) `20261018000001`; o CHECK de `ab_test_restores` está em `20261014000005:120`.
  Conferir também no 54422: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ab_test_restores'::regclass and contype = 'c'`.
  Diferente disso: a expressão "antiga" da prova é a da última.

- [ ] **Step 2: escrever o teste C-10a** (`ab-s8-f1-checks.test.ts`, `describe.skipIf(skipIfNoLocalDb())`, `semearTesteAb`):
  - `it.each` sobre todo `completed_reason` antigo (7 valores) + `null`: `update` aceito. `'regra_v2'` aceito. `'xyz'`: erro casando `/ab_tests_completed_reason_check/`.
  - `it.each` sobre todo `end_reason` antigo (6) + `null` num ciclo fechado: aceito; `'regra_v2'` e `'teste_youtube'` aceitos; `'xyz'` recusado.
  - `restore_status`: para cada estado antigo (`em_andamento, ok, falhou, pulado_sem_original, pulado_drift, desistiu`) × ramo (`title`, `thumbnail`) com a fixture `OK` de `ab-restore-status-forma.test.ts`: aceito; `pulado_teste_youtube` nos dois ramos com `escreveu: false, motivo: 'gatilho:drift'`: aceito; `'xyz'`: recusado com `/ab_tests_restore_status_shape/`.
  - **4º CHECK (C-10a):** `ab_test_restores`: `it.each` dos 5 estados antigos aceitos em `insert` direto como `postgres`; `pulado_teste_youtube` aceito; `'xyz'` recusado com `/ab_test_restores_estado_check/`.
    **De ponta a ponta pelo gatilho `ab_tests_restore_log`:** `update ab_tests set restore_status = <fixture OK com estado pulado_teste_youtube no ramo title>` → 1 linha nova em `ab_test_restores` (`select estado from ab_test_restores where test_id = <semente> and campo = 'title'`) com esse estado, sem erro; idem no ramo `thumbnail`; e `it.each` dos 5 estados antigos gravados por `update ab_tests set restore_status` chegam ao `ab_test_restores`. É a prova de que `shape` e histórico aceitam o mesmo conjunto. `'xyz'` no `shape` é recusado antes do gatilho.
  - Os casos recusados de `ab-restore-status-forma.test.ts` continuam recusados (rodar esse arquivo sem mudança).
  - `select regra_duracao from ab_tests where id = <semente>` = `'v1'` sem ninguém escrever.

- [ ] **Step 3: escrever `ab-s8-f1-schema-rls.test.ts`** (padrão de `a5-e18-rls.test.ts`, GUC `app.site_id` forjado como
  não superusuário): anon lê 0 linhas das duas tabelas; reporter do site A lê 0 (não edita); editor de A lê a linha de A;
  editor de B com `app.site_id` = A lê 0; `authenticated` com insert/update/delete recebe `42501`; `has_function_privilege('authenticated', 'ab_test_dias_apply(jsonb)', 'execute')` = false (nunca CHAMAR como authenticated: derruba o 54422);
  `apply` como service role: linha nova inserida; segunda chamada com outro `impressoes` e `final = true` na primeira → a linha não muda (devolve 0).
  **Releitura campo a campo (Yannis D4):** `apply` com uma linha com **todas** as colunas preenchidas (inclusive `motivo_nulo_meta`, `engaged_views`, `troca_vista_em`) e, na 2ª chamada com todos os valores diferentes e `final = false`, a releitura bate com a 2ª campo a campo (pega coluna esquecida no `do update set`). `fechar_antigas(p_antes)`: linha aberta com `day_pt` antigo vira `final`/`nao_medido` sem mudar `variant_id`/`motivo_sem_variante`; linha de `day_pt >= p_antes` não muda. Execute das três funções negado a `authenticated` (por `has_function_privilege`).

- [ ] **Step 4: rodar e ver vermelho por asserção**:
  `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-s8-f1-checks.test.ts test/integration/ab-s8-f1-schema-rls.test.ts --no-file-parallelism > /tmp/s8f1-t1.log 2>&1`
  (em `apps/web`; saída para arquivo, no contexto só as falhas). Esperado: `regra_v2`/`teste_youtube`/`pulado_teste_youtube`
  recusados pelo CHECK antigo; `ab_test_dias` inexistente. Se o 54422 não estiver de pé: `npm run db:start` no projeto do int
  (memória "Banco local de integração"), em background, nunca esperar mais de 4 min parado.

- [ ] **Step 5: escrever o rascunho SQL** com o que está em Interfaces e aplicar duas vezes:
  `psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -v ON_ERROR_STOP=1 -f <rascunho>` (2ª vez sem erro = idempotente).

- [ ] **Step 6: rodar os dois testes + `ab-restore-status-forma.test.ts` + `ab-p4a-*.test.ts`** (o `ab_settle_claim` real ainda passa). Esperado: PASS.

- [ ] **Step 7: commit** só dos testes (o rascunho fica fora do git até o `db:new`):
  `git add apps/web/test/integration/ab-s8-f1-checks.test.ts apps/web/test/integration/ab-s8-f1-schema-rls.test.ts && git commit -m "test: S8-F1, CHECKs superconjunto e RLS das tabelas de gravação"`.

---

### Task 2: estado do alcance e das views, atribuição do dia (puras)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-gravacao/tipos.ts`, `estado.ts`, `atribuicao.ts`
- Test: `apps/web/test/youtube/ab-gravacao/estado.test.ts`, `atribuicao.test.ts`

**Interfaces:**
- Consumes: `dayPt`, `ontemPt`, `diffDias`, `addDays`, `boundsAnalytics`, `type DiaPt` de `lib/youtube/coleta/day-pt.ts`;
  `calcularAbDoDia`, `type AbCycle`, `type AbTest`, `type MotivoNulo` de `lib/youtube/coleta/ab-seconds.ts` (sem mudar).
- Produces:
  - `type EstadoAlcance = 'medido'|'zero_medido'|'ausente_no_relatorio'|'aguardando'|'nao_medido'`; `type EstadoViews = 'medido'|'zero_medido'|'nao_medido'`;
    `type MotivoSemVariante = 'menos_de_90'|'meta_ausente'|'meta_nula'|'dia_de_outro_teste'|'teste_apagado'`.
  - `interface RelatorioDoDia { report_id: string; status: 'listado'|'baixado'|'vazio'|'erro'|'expirado_sem_baixar'; create_time: string; normalized_at: string|null }`
  - `interface LinhaAlcance { thumbnail_impressions: number|null; thumbnail_ctr: number|null; source_report_id: string; report_create_time: string }`
  - `estadoDoAlcance(i: { day: DiaPt; ontem: DiaPt; relatorios: RelatorioDoDia[]; linha: LinhaAlcance|null }): EstadoAlcance`
  - `estadoDasViews(i: { day: DiaPt; linha: { views: number|null } | null; coberto: boolean }): EstadoViews`
  - `ehFinal(day: DiaPt, ontem: DiaPt): boolean` = `diffDias(day, ontem) >= 10`
  - `interface MetaDoDia { ab_test_id: string|null; ab_variant_id: string|null; seconds_on_air_analytics: number|null; captured_at: string }`
  - `atribuirDia(i: { testId: string; day: DiaPt; meta: MetaDoDia|null; teste: AbTest; ciclos: AbCycle[] }): { variant_id: string|null; motivo_sem_variante: MotivoSemVariante|null; motivo_nulo_meta: MotivoNulo|null; segundos_no_ar: number|null; segundos_do_dia: number }`
  - `diasDoTeste(ciclos: AbCycle[], teste: AbTest, ontem: DiaPt, desde: DiaPt): DiaPt[]` — dias do Pacífico (por `boundsAnalytics`) com
    sobreposição > 0 de algum ciclo, ciclo aberto vai até `completed_at ?? paused_at ?? agora`; **nunca antes de `desde`** (Yannis B2 / Phil P1:
    dia fora da janela de leitura não pode ser gravado como `meta_ausente`/`nao_medido` com a meta existindo no banco) e nunca depois de `ontem`; ordenados.
    `desde` é, por teste, `max(janelaDesde(ontem), dayPt(started_at do teste))` (Task 5), com `janelaDesde(ontem) = addDays(ontem, -JANELA_RETRATO_DIAS)` exportada de `retrato.ts` junto da constante única `JANELA_RETRATO_DIAS = 40`, nunca o número repetido no step.

Regras que o teste fixa (o spec §2.3 e decisões deste plano):
- `estadoDoAlcance`, nesta ordem: linha com impressões não nulas → `medido`; linha com impressões nulas → `nao_medido`;
  relatório que vale = maior `create_time`; `expirado_sem_baixar` → `nao_medido`; `vazio` com `normalized_at` → `zero_medido`;
  `baixado` com `normalized_at` e sem linha → `ausente_no_relatorio`; resto (`listado`, `baixado`/`vazio` sem normalizar,
  `erro`, nenhum relatório) → `ehFinal ? 'nao_medido' : 'aguardando'`.
- `estadoDasViews`: linha com `views` não nulo → `views > 0 ? 'medido' : 'zero_medido'`; linha com `views` nulo → `nao_medido`;
  sem linha e `coberto` (algum intervalo `base` de `yt_own_video_coverage` com `covered_from <= day <= covered_to`) → `zero_medido`; senão `nao_medido`.
- **Decisão (Phil D5 e Yannis P2: acordada, com emenda no spec §2.3 e no C-3, feita no mesmo commit do plano):** `final` = `ehFinal(day, ontem)` e só isso (fora o teste apagado e as linhas fechadas por `fechar_antigas`). Motivo: a A5 relê os últimos
  10 dias do diário (`cobertura.ts`, `inicioDaJanela`: `hoje − 10`), então as views só param de mudar no D+10; congelar antes
  congelaria número provisório. Consequência: "estado final" do alcance antes do D+10 não fecha a linha; o C-3
  "`expirado_sem_baixar` fica `nao_medido` na hora" vale para o **estado**, não para `final`.
- `atribuirDia`, nesta ordem: sem meta → `meta_ausente`; `meta.ab_test_id` não nulo e ≠ `testId` → `dia_de_outro_teste`;
  `ab_test_id` nulo ou `ab_variant_id` nulo → `meta_nula`, com `motivo_nulo_meta` = `calcularAbDoDia({ day, tests: [teste], cycles: ciclos, capturedAt: Date.parse(meta.captured_at), titleAtCapture: null }).motivoNulo`
  (a `meta_daily` não grava o `motivoNulo`; recalculado só com os ciclos deste teste, `mais_de_um_teste` não aparece e o
  resultado pode ser nulo = "não reproduzido aqui"); `seconds_on_air_analytics < 0,9 × segundos_do_dia` → `menos_de_90`;
  senão `variant_id = meta.ab_variant_id`. `segundos_do_dia = (end − start) / 1000` de `boundsAnalytics(day)`.

- [ ] **Step 1: criar os três arquivos com as assinaturas e corpos que devolvem o valor errado** (`'aguardando'`, `false`, `{ variant_id: null, motivo_sem_variante: 'meta_ausente', ... }`).
- [ ] **Step 2: escrever `estado.test.ts`** (tabela de casos, `// @vitest-environment node`, dias relativos via `addDays(ontemPt(new Date()), -n)`):
  sem relatório D+2 → `aguardando`; sem relatório D+10 → `nao_medido`; `vazio` normalizado → `zero_medido`; `vazio` sem `normalized_at` → `aguardando`;
  `baixado` normalizado sem linha → `ausente_no_relatorio`; linha com 1234 → `medido` mesmo com o relatório mais novo `listado`;
  linha com impressões nulas → `nao_medido`; velho `vazio` normalizado + novo `listado` → `aguardando`; velho normalizado + novo `expirado_sem_baixar` → `nao_medido`;
  `erro` D+3 → `aguardando`, D+10 → `nao_medido`. Views: linha 0 → `zero_medido`; sem linha coberto → `zero_medido`; sem linha fora → `nao_medido`; `views: null` → `nao_medido`. `ehFinal` em D+9 false, D+10 true.
- [ ] **Step 3: escrever `atribuicao.test.ts`**, incluindo os casos de 25 h do spec §6 por busca relativa: função de teste
  `proximoDiaCom(segundos: number)` procura com `boundsAnalytics` a partir de hoje, teto 400 dias, e **lança** se não achar.
  Dia de 90 000 s com 86 400 no ar → variante (96%); com 80 000 → `menos_de_90`; dia de 82 800 s com 76 000 → variante (91,8%);
  `segundos_do_dia` = 90 000 / 82 800. C-4: meta ausente → `variant_id` nulo e `meta_ausente`, nunca a variante do ciclo.
  `ab_test_id` de outro → `dia_de_outro_teste`. Meta com variante nula e dois ciclos abertos do teste → `meta_nula`, `motivo_nulo_meta = 'ciclo_aberto_duplicado'`.
  `diasDoTeste`: ciclo que começa às 23:50 PT conta o dia; nunca devolve `dayPt(agora)`; pausa de 2 dias some da lista;
  **ciclo de 50–60 dias atrás com `desde = ontem − 40` → nenhum dia anterior a `desde`** (mutante: tirar o filtro faz este teste e o do step falharem).
- [ ] **Step 4: rodar** `npx vitest run test/youtube/ab-gravacao/ > /tmp/s8f1-t2.log 2>&1`; esperado FAIL por asserção.
- [ ] **Step 5: implementar** os corpos pelas regras acima.
- [ ] **Step 6: rodar de novo**; esperado PASS. `npx tsc --noEmit -p apps/web` sem erro novo.
- [ ] **Step 7: commit** dos 5 arquivos por caminho: `feat: S8-F1, estado do alcance e atribuição do dia (puras)`.

---

### Task 3: montar o retrato (pura)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-gravacao/retrato.ts`
- Test: `apps/web/test/youtube/ab-gravacao/retrato.test.ts`

**Interfaces:**
- Consumes: Task 2 inteira.
- Produces:
  - `interface TesteParaRetrato extends AbTest { site_id: string; test_type: 'thumbnail'|'title'|'combo'; regra_duracao: 'v1'|'v2'; youtube_id: string; channel_id: string }` (`youtube_id` = `youtube_videos.youtube_video_id`, 11 caracteres; nunca `ab_tests.youtube_video_id`, que é o uuid).
  - `interface EntradasDoRetrato { testes: TesteParaRetrato[]; ciclosPorTeste: Map<string, AbCycle[]>; metaPorVideoDia: Map<string, MetaDoDia>; alcancePorVideoDia: Map<string, LinhaAlcance>; relatoriosPorCanalDia: Map<string, RelatorioDoDia[]>; viewsPorVideoDia: Map<string, LinhaViews>; coberturaPorVideo: Map<string, Array<{ de: DiaPt; ate: DiaPt }>>; sondasPorTesteDia: Map<string, LinhaSonda[]>; desde: DiaPt }`, chave `${id}|${day}`; as sondas já vêm **agrupadas por teste e dia** (por `dayPt(hora)`), para a busca da `troca_vista_em` ser O(S_d) por dia de troca, nunca varrer a lista inteira do teste por dia.
  - `interface LinhaViews { views: number|null; engaged_views: number|null; watch_time_minutes: number|null; avg_view_percentage: number|null; source: string; metric_version: string }`
  - `interface LinhaSonda { hora: string; lida_em: string; leitura_estado: string; variante_vista: string|null }`
  - `interface LinhaRetrato` = as colunas de `ab_test_dias` (snake_case, exatamente como a tabela), `ciclos: Array<{ id: string; started_at: string; ended_at: string|null }>`.
  - `montarRetrato(e: EntradasDoRetrato, agora: Date): LinhaRetrato[]` — uma linha por (teste, `diasDoTeste(ciclos, teste, ontem, e.desde)`); `ontem = ontemPt(agora)`; exporta `JANELA_RETRATO_DIAS = 40`;
    `dia_de_troca` = variante ≠ a do dia anterior **da lista do mesmo teste**, nulo no primeiro dia ou quando uma das duas é nula;
    `troca_vista_em` só com `dia_de_troca = true` e `test_type` em `thumbnail`/`combo`: `lida_em` da primeira sonda com
    `leitura_estado = 'bate'` e `variante_vista = variant_id` dentro de `boundsAnalytics(day)`; senão nulo;
    `views`/`views_estado` do dia (nunca o total de 90 dias), `views_fonte = LinhaViews.source` e `metric_version = LinhaViews.metric_version` (nulos sem linha); `final = ehFinal(day, ontem)`; `retratado_em = agora.toISOString()`.
    O dia anterior é recalculado na mesma rodada (mesmas entradas), não lido de `ab_test_dias`; a linha `final` não muda porque o `apply` a protege.

- [ ] **Step 1: criar `retrato.ts` com a assinatura e `return []`.**
- [ ] **Step 2: escrever `retrato.test.ts`** (fixture com 2 variantes em ABBA, 6 dias, datas relativas):
  `views_fonte`/`metric_version` copiados da linha do diário (`reporting_api` aparece como veio); teste iniciado 45 dias atrás com `desde = ontem − 40` → nenhuma linha com `day_pt < desde`;
  4 dias com ciclo → 4 linhas e nenhuma com `day_pt = dayPt(agora)` (pendência 3: o retrato só vai até `ontemPt`);
  `dia_de_troca` [nulo, true, false, true]; troca vista: sonda `bate` da nova variante às 10:15 UTC → `troca_vista_em` = aquele `lida_em`;
  sonda `sem_referencia` ou hora sem sonda → nulo; teste `title` → `troca_vista_em` nulo sempre; dia com `views: 0` na linha do diário → `zero_medido` e `views = 0`;
  dia do D+10 → `final = true` e `aguardando` vira `nao_medido`; teste de dia de 25 h: `segundos_do_dia = 90000` (mesma busca da Task 2).
- [ ] **Step 3: rodar, ver FAIL por asserção** (`expected 4, received 0`).
- [ ] **Step 4: implementar.** `Map` por chave, nunca `find` dentro do laço dos dias.
- [ ] **Step 5: rodar, PASS.** Commit: `feat: S8-F1, montagem do retrato diário (pura)`.

---

### Task 4: sonda da miniatura: classificação (pura)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-gravacao/sonda.ts`
- Test: `apps/web/test/youtube/ab-gravacao/sonda.test.ts`

**Interfaces:**
- Consumes: `DHASH_MAX_SAME`, `hamming` de `lib/youtube/thumb-hamming.ts`; `probeThumb` só no teste de paridade.
- Produces:
  - `type LeituraEstado = 'bate'|'nenhuma_bate'|'sem_referencia'|'ambigua'|'falhou'`
  - `classificarLeitura(dhashLido: string, referencias: Array<{ variant_id: string; dhash: string|null }>): { leitura_estado: Exclude<LeituraEstado,'falhou'>; variante_vista: string|null; variantes_sem_referencia: number }`
  - `erroDaSonda(e: unknown | { status: number }): string` → `'timeout'` (`TimeoutError`/`AbortError`), `'rede'` (outro rejeite), `` `http_${status}` ``, `'imagem_invalida'` (falha do `sharp`).
  - `enviadaEmDoEtag(etag: string|null): string|null` (ISO; ver "Desvio declarado").
  - `etagUtil(raw: string|null): string|null` (Yannis D2): a mesma regra de `usableEtag` (`thumb-fingerprint.ts:36-40`): tira `W/` e aspas; `"0"` → nulo. O reuso do dHash da sonda só vale com `etagUtil(atual) !== null && etagUtil(atual) === etagUtil(anterior)`; ETag `"0"` (48% dos vídeos no spike S1) nunca reusa.
  - `horaDe(lidaEm: Date): string` = início da hora UTC em ISO.

**Decisão da pendência 7 (Phil):** a comparação usa só as variantes com referência. Exatamente uma a Hamming
`<= DHASH_MAX_SAME` → `bate` com `variante_vista` = ela, **mesmo que outra variante não tenha referência**; o número de
variantes sem referência vai em `variantes_sem_referencia` (coluna nova), para a leitura poder descartar a linha se quiser.
Duas ou mais → `ambigua`, `variante_vista` nulo. Nenhuma e alguma sem referência → `sem_referencia` (não dá para dizer
"nenhuma"). Nenhuma e todas com referência → `nenhuma_bate`. `bate` não exige `variante_vista = variante_esperada`: a
diferença é justamente a troca ainda não vista. Motivo: a variante sem Blob é rara, e transformar toda linha do teste
em `sem_referencia` jogaria fora a medida do `m` do teste inteiro.

- [ ] **Step 1: criar `sonda.ts` com as assinaturas e corpos errados** (`{ leitura_estado: 'nenhuma_bate', variante_vista: null, variantes_sem_referencia: 0 }`, `'rede'`, `null`).
- [ ] **Step 2: escrever `sonda.test.ts`:** dHash igual ao de B → `bate`, `variante_vista = B`; igual a A e a B (referências idênticas) → `ambigua`, nulo;
  B igual e A sem referência → `bate`, `variantes_sem_referencia = 1`; nada igual e A sem referência → `sem_referencia`; nada igual, todas com referência → `nenhuma_bate`;
  `erroDaSonda(new DOMException('x','TimeoutError'))` = `'timeout'`; `{ status: 404 }` = `'http_404'`; `TypeError('fetch failed')` = `'rede'`;
  `enviadaEmDoEtag('"1760774400"')` = `'2025-10-18T08:00:00.000Z'`; `'"0"'`, `'W/"abc"'`, nulo → nulo; paridade: o mesmo ETag em `probeThumb` com `fetch` falso dá o mesmo instante (`Date.parse` igual);
  `etagUtil('"0"')` = nulo, `etagUtil('W/"123"')` = `'123'`, nulo = nulo (entra no teste de paridade com `usableEtag` via `probeThumb`, comentário dizendo que a paridade de `uploadInstant` só fixa o caso ETag numérico: o i.ytimg.com não manda `Last-Modified`); `horaDe(new Date('…T10:15:42Z'))` = `'…T10:00:00.000Z'`. Nulo nunca vira `""` nem `0`.
- [ ] **Step 3: FAIL por asserção. Step 4: implementar. Step 5: PASS.** Commit: `feat: S8-F1, classificação da sonda da miniatura (pura)`.

---

### Task 5: rota `ab-retrato` (carga em lote, gravação, integração C-3/C-3b)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-gravacao/retrato-step.ts`, `apps/web/src/app/api/cron/ab-retrato/route.ts`
- Modify: `apps/web/vercel.json` (acrescentar `{ "path": "/api/cron/ab-retrato", "schedule": "0 14 * * *" }`)
- Test: `apps/web/test/ab-cron-retrato.test.ts`, `apps/web/test/youtube/ab-gravacao/retrato-step.test.ts`, `apps/web/test/integration/ab-s8-f1-retrato.test.ts`

**Interfaces:**
- Consumes: `montarRetrato` (Task 3); `withCronLock`, `newRunId` de `@/lib/logger`; `recordCronFailure` de `@/lib/cron-health`; `getSupabaseServiceClient`.
- Consumes também: `lerPaginado` de `lib/youtube/coleta/paginar.ts` (já existe).
- Produces: `rodarRetrato(sb: SupabaseClient, agora: Date): Promise<{ status: 'ok'; testes: number; linhas: number; fechadas_apagados: number; fechadas_antigas: number; fechadas_sem_alcance: number; notas: string[] } | { status: 'error'; error: string; health_written: true }>`.

**Toda leitura da carga passa por `lerPaginado`** (Phil B1, Yannis D1: o PostgREST corta em 1.000 linhas, `supabase/config.toml:15 max_rows = 1000`),
ordenada por chave única, com teto explícito por tabela: `ab_tests`/`ab_test_cycles` (`id`) 5.000; `ab_test_dias` (`test_id, day_pt`) 20.000; `yt_own_video_*` (`youtube_video_id, day_pt`) 20.000;
`yt_reporting_reports` (`report_id`) 20.000; `ab_test_sondas` (`test_id, hora`) 20.000. `passou_do_teto` ou `erro_de_banco` → mesmo caminho do erro de leitura (abaixo): `recordCronFailure`, nada escrito, `rpc` nunca chamado.
Carga (uma leitura lógica por tabela, `in (...)`, nunca por teste; as páginas não contam como consultas):
1. `ab_tests` `select('id, site_id, status, test_type, regra_duracao, paused_at, completed_at, original_title, youtube_videos!inner(youtube_video_id, channel_id)')`
   com `.or('status.in.(active,paused),and(status.in.(completed,archived),completed_at.gte.<agora − 11 d>)')`.
2. `ab_test_dias` `select('test_id').eq('final', false)` (índice parcial); ids que não vieram em (1) → segunda leitura de `ab_tests` `.in('id', faltantes)` com o mesmo `select`; os que nem assim existem = **apagados**. **Os achados na 2ª leitura entram em `testes`** com os mesmos ciclos, fontes e retrato, e são retratados na mesma rodada (o D+10 os fecha) (Phil D2): ex.: `archived` com `completed_at` nulo (como o `1765747a` de produção) ou `completed` há mais de 11 dias após cron parado; só os que não existem viram `fechar_apagados`.
3. `ab_test_cycles` `.in('test_id', ids)`; 4. `yt_own_video_meta_daily` `.in('youtube_video_id', vids).gte('day_pt', janelaDesde(ontem))`;
5. `yt_own_video_reach_daily` idem; 6. `yt_reporting_reports` `.eq('report_type_id','channel_reach_basic_a1').in('channel_id', canais).gte('start_time', <meiaNoite(janelaDesde(ontem)) − 1 d>)`, agrupado por `dayPt(start_time)` (nunca `start_time::date`);
7. `yt_own_video_daily` idem 4 (colunas da `LinhaViews`); 8. `yt_own_video_coverage` `.in('youtube_video_id', vids).eq('metric_set','base')`; 9. `ab_test_sondas` `.in('test_id', ids).eq('leitura_estado','bate').gte('hora', <meiaNoite(menor dia aberto do teste, ≤ 11 dias)>)` (só o que o retrato usa: ≤ 264 linhas por teste), agrupadas por `${test_id}|${dayPt(hora)}`.
`janelaDesde(ontem) = addDays(ontem, −JANELA_RETRATO_DIAS)` (28 dias de teste + 10 de espera + folga), exportada de `retrato.ts`. As leituras de fonte 4–7 usam `janelaDesde(ontem)` (superconjunto, vale para todos os testes). **Por teste**, o `desde` de `montarRetrato`/`diasDoTeste` é `max(janelaDesde(ontem), dayPt(started_at do teste))` (Yannis B2). Nenhum `menorDia` de teste é passado a `fechar_antigas`: a função é global (sem `test_id`) e um valor por teste fecharia, como `final`/`nao_medido` irreversível, linhas abertas legítimas de um teste mais antigo (Phil/Yannis r2 N1).
Antes de gravar: `sb.rpc('ab_test_dias_fechar_antigas', { p_antes: janelaDesde(ontem) })` (sempre a constante, nunca o `menorDia` de um teste) fecha as linhas abertas com `day_pt < janelaDesde(ontem)` (cron parado >30 dias), para que nenhum dia que nunca foi lido fique marcado como `final` com dado inventado e nenhuma fique `aguardando` para sempre; conta em `fechadas_antigas`. Leitura com `error` ou `data` não-array em **qualquer** uma → `recordCronFailure('ab-retrato', '<tabela>: <mensagem>')`, nada é escrito, devolve `status: 'error', health_written: true` (o `withCronLock` não grava sucesso por cima).

Gravação: `sb.rpc('ab_test_dias_apply', { p_rows: linhas })` (uma chamada; com mais de 500 linhas, em blocos de 500); apagados → `sb.rpc('ab_test_dias_fechar_apagados', { p_test_ids })`. Erro de RPC → `recordCronFailure` e `status: 'error'`.
`fechadas_sem_alcance` (Phil P2) = linhas que passaram de `aguardando` a `nao_medido` por D+10 na rodada (o número sai no log do cron).
Notas: para cada linha de teste `active` com `alcance_estado = 'aguardando'` e `diffDias(day_pt, ontem) >= 5`, `Sentry.captureMessage('ab-retrato: alcance aguardando', { level: 'info', fingerprint: ['ab-retrato-aguardando', testId, day], extra })` e a frase em `notas`. **Decisão:** a nota não chama `recordCronFailure` (isso marcaria o cron como falho por um atraso do YouTube); o spec diz "nota de falha da rodada, nível info", e o Sentry com fingerprint por teste e dia dá o "uma vez por teste e dia". Para Yannis confirmar.
Zero teste e zero linha aberta: `{ status: 'ok', testes: 0, ... }` e o `withCronLock` grava sucesso (o `cron-watchdog` não a acusa morta).

Rota: `export const maxDuration = 60`; `export async function GET(req)`; `Bearer ${CRON_SECRET}` senão 401; `withCronLock(sb, 'ab-retrato', newRunId(), 'ab-retrato', () => rodarRetrato(sb, new Date()))`. `JOB` = `'ab-retrato'`, o nome da pasta.

- [ ] **Step 1: criar `retrato-step.ts` e a rota com `rodarRetrato` devolvendo `{ status: 'ok', testes: 0, linhas: 0, fechadas_apagados: 0, notas: [] }` sem ler nada.**
- [ ] **Step 2: escrever `retrato-step.test.ts`** com cliente falso que registra chamadas: leitura de `yt_reporting_reports` com erro → `rpc` nunca chamado e `recordCronFailure('ab-retrato', expect.stringContaining('yt_reporting_reports'))`;
  total de consultas **lógicas** (`from(...)` distintos, páginas não contam) por rodada com 3 testes ≤ 10 (lote, não por teste);
  **B1:** cliente falso que devolve 1.000 linhas na 1ª página e 500 na 2ª da sonda → as 1.500 chegam ao `montarRetrato`; teto excedido (`passou_do_teto`) → `recordCronFailure` e `rpc` nunca chamado;
  **B2:** teste `paused` iniciado 45 dias atrás → nenhuma linha com `day_pt < janelaDesde(ontem)` no `p_rows` e `fechar_antigas` chamado com `p_antes = janelaDesde(ontem)` (= ontem−40);
  **N1 (r2):** dois testes, A iniciado há 5 dias e B há 30 com linha aberta em ontem−10 → `p_antes = ontem−40` (falha se o código passar o `menorDia` de A) e a linha de B segue `final = false` e está no `p_rows` do `apply`; variante: um teste de 45 dias e outro iniciado ontem → `p_antes = ontem−40` e as linhas abertas do teste novo seguem no `p_rows`;
  **D2:** teste `archived`, `completed_at` nulo, com linha aberta em `ab_test_dias` → aparece no `p_rows` do `apply`; 6 dias `aguardando` → `captureMessage` 1 vez com `level: 'info'`; 4 dias → 0; teste em `ab_test_dias` aberto e ausente de `ab_tests` → `fechar_apagados` com o id.
- [ ] **Step 3: escrever `ab-cron-retrato.test.ts`** (molde de `ab-cron-evaluate.test.ts`): sem segredo → 401; zero teste → 200 e `recordCronSuccess('ab-retrato')`.
- [ ] **Step 4: escrever `ab-s8-f1-retrato.test.ts`** (54422, `semearTesteAb` + linhas de `yt_own_video_meta_daily`, `yt_own_video_reach_daily`, `yt_reporting_reports` semeadas, fake timers só no `agora` passado a `rodarRetrato`):
  C-3: um dia sem relatório → `aguardando`; `vazio` normalizado → `zero_medido`; velho normalizado + novo `listado` → `aguardando`; `baixado` normalizado sem a linha → `ausente_no_relatorio`; `expirado_sem_baixar` → `nao_medido`.
  C-3b: 2ª rodada com `thumbnail_impressions` mudado: linha `final` igual (inclusive `retratado_em`), as abertas mudam só o número e `retratado_em`;
  teste `completed` às 00:30 PT e 11 rodadas diárias (`agora` + 1 d cada) → todas as linhas `final`; teste apagado (`delete from ab_tests`) com linhas abertas → `final`, `nao_medido`, `teste_apagado` onde não havia variante.
  **B2 (integração):** linha aberta antiga (`day_pt < janelaDesde(ontem)`, semeada) → `final = true`, `nao_medido`, `variant_id` intocado após a rodada; nenhuma linha `final` com dado nunca lido.
  C-4: `delete` da `meta_daily` de um dia → `variant_id` nulo, `meta_ausente`.
  Leitura do Phil para o C-2 em produção fica na Task 7.
- [ ] **Step 5: rodar os três (saída em arquivo); esperado FAIL por asserção.**
- [ ] **Step 6: implementar `rodarRetrato`; acrescentar a agenda no `vercel.json`.**
- [ ] **Step 7: rodar os três + `test/api/cron/vercel-get-export-guard.test.ts` + `test/lib/ops/cron-health-report.test.ts` + `test/api/health.test.ts`; PASS.**
- [ ] **Step 8: commit** por caminho: `feat: S8-F1, cron ab-retrato (retrato diário por teste e dia)`.

---

### Task 6: rota `ab-sonda-miniatura` (C-5, C-6)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-gravacao/sonda-step.ts`, `apps/web/src/app/api/cron/ab-sonda-miniatura/route.ts`
- Modify: `apps/web/vercel.json` (`{ "path": "/api/cron/ab-sonda-miniatura", "schedule": "15 * * * *" }`)
- Test: `apps/web/test/youtube/ab-gravacao/sonda-step.test.ts`, `apps/web/test/ab-cron-sonda.test.ts`, `apps/web/test/integration/ab-s8-f1-sonda.test.ts`

**Interfaces:**
- Consumes: Task 4; `thumbUrl`, `dhashOf` de `thumb-fingerprint.ts` (só import); `dhashDoArquivo` de `lib/youtube/ab-variant-dhash.ts:29` (só import; allowlist de host, `AbortSignal.timeout(15_000)` em `ab-youtube.ts:115`; o arquivo não está na lista proibida e não muda); `lerPaginado`.
- Produces: `rodarSonda(sb: SupabaseClient, agora: Date, f: typeof fetch = fetch): Promise<{ status: 'ok'; testes: number; gravadas: number; falhas: number } | { status: 'error'; error: string; health_written: true }>`.

Fluxo: (1) `ab_tests` `status = 'active'`, `test_type in ('thumbnail','combo')`, com `youtube_videos!inner(youtube_video_id)`; zero → devolve sem nenhuma outra leitura e **sem nenhum `fetch`** (C-6).
(2) Em lote: `ab_test_variants` `.in('test_id')` (`id, test_id, thumbnail_dhash, blob_url`); ciclos abertos `ab_test_cycles` `.in('test_id').is('ended_at', null)` (`variante_esperada`; mais de um aberto → nulo);
última sonda por teste `ab_test_sondas` `.in('test_id').gte('hora', agora − 48 h)` por `lerPaginado` ordenada por `(test_id, hora)` (Phil B1; maior `hora` por teste: `etag`, `dhash`, `sha16`). Erro de leitura → `recordCronFailure('ab-sonda-miniatura', …)`, nada gravado.
(3) Por teste, em `Promise.allSettled`: HEAD `thumbUrl(id)` com `AbortSignal.timeout(10_000)`; `!ok` → linha `falhou`, `erro = http_<n>`; `etagUtil(atual) !== null && etagUtil(atual) === etagUtil(anterior)` e a anterior com `dhash` → reusa `dhash`/`sha16` sem GET (ETag `"0"` nunca reusa, Yannis D2); senão GET (`timeout(15_000)`), `dhashOf(bytes)` (falha → `imagem_invalida`), `sha16` = 16 primeiros hex do SHA-256 dos bytes. Referência de cada variante: `thumbnail_dhash`; nulo → `dhashDoArquivo(blob_url, f)` (Yannis D3, Phil D4; nunca grava em `ab_test_variants`), as variantes do mesmo teste em paralelo e junto com o HEAD (pior caso 10 + 15 + 15 = 40 s < 60 s): `ok` → referência; `sem_base` → `dhash: null` (vira `sem_referencia` quando nada bate); `falha` (Blob lento/5xx) → aquela variante fica sem referência e conta em `variantes_sem_referencia`; a linha **não** vira `falhou` por causa do Blob. `classificarLeitura`. `enviada_em = enviadaEmDoEtag(etag)`.
(4) Grava todas as linhas numa chamada: `sb.from('ab_test_sondas').upsert(linhas, { onConflict: 'test_id,hora', ignoreDuplicates: true })` (= `on conflict do nothing`). Rejeição de um teste no `allSettled` vira linha `falhou` com `erroDaSonda(reason)`, `http` nulo.

Rota: `export const maxDuration = 60`, `GET`, `Bearer`, `withCronLock(sb, 'ab-sonda-miniatura', newRunId(), 'ab-sonda-miniatura', () => rodarSonda(sb, new Date()))`.

- [ ] **Step 1: criar step e rota com corpo vazio que devolve `{ status: 'ok', testes: 0, gravadas: 0, falhas: 0 }`.**
- [ ] **Step 2: escrever `sonda-step.test.ts`** (`fetch` injetado, cliente falso): zero teste ativo → `fetch` chamado 0 vezes e só 1 `from` (C-6);
  `fetch` que rejeita com `TimeoutError` → linha com `http: null`, `erro: 'timeout'`, `leitura_estado: 'falhou'`; HEAD 404 → `http: 404`, `erro: 'http_404'`;
  ETag útil igual ao da sonda anterior → só HEAD, `dhash` reusado; **ETag `"0"` nas duas rodadas com imagem diferente → a 2ª faz GET e grava o `dhash` novo** (Yannis D2); variante sem `thumbnail_dhash` com `blob_url` → comparação feita via `dhashDoArquivo`; sem Blob → `sem_referencia` (quando nada mais bate);
  **Blob que rejeita com `TimeoutError` (ou nunca resolve, fake timers, 15 s) → linha gravada, `variantes_sem_referencia = 1`, as outras linhas da rodada gravadas** (Phil D4);
  leitura da última sonda com 1.000 linhas na 1ª página e 10 na 2ª → as 1.010 chegam à decisão do reuso;
  dois testes, um rejeita e outro bate → duas linhas, uma `falhou` e uma `bate`; nenhuma linha com `''` em campo de texto.
- [ ] **Step 3: escrever `ab-cron-sonda.test.ts`:** 401 sem segredo; zero teste → 200 e `recordCronSuccess('ab-sonda-miniatura')`.
- [ ] **Step 4: escrever `ab-s8-f1-sonda.test.ts`** (54422): `rodarSonda` duas vezes com o mesmo `agora` (mesma hora) → 1 linha (C-5); hora seguinte → 2.
- [ ] **Step 5: FAIL por asserção. Step 6: implementar e acrescentar a agenda. Step 7: rodar os três + guard do `GET` + `cron-health-report`; PASS.**
- [ ] **Step 8: commit** por caminho: `feat: S8-F1, cron ab-sonda-miniatura (sonda horária da miniatura)`.

---

### Task 7: portões, migration no dia, deploy e conferências com data

**Files:**
- Create (no dia da aplicação): `supabase/migrations/<ts>_ab_lab_s8_f1_gravacao.sql` por `npm run db:new ab_lab_s8_f1_gravacao`, conteúdo = rascunho da Task 1.
- Modify: `~/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/impl-progresso.md` (ou o ledger do lote) e o arquivo de lembretes datados da frente.

- [ ] **Step 1: C-1 por lista permitida.** `git diff --name-only origin/staging...HEAD` contém **só** os arquivos da tabela "Estrutura de arquivos", `apps/web/vercel.json`, a migration e docs deste lote; e
  `git diff --name-only origin/staging...HEAD | grep -E 'ab-rotat|ab-settle|ab-drift|ab-watchdog|ab-evaluate|ab-statistics|ab-gates|ab-restore|ab-lab/(queries|actions)\.ts|ab-lab/_components/|thumb-fingerprint\.ts'` não imprime nada. Confere: Yannis.
- [ ] **Step 2: C-7.** Rodar sem mudança `test/ab-cron-evaluate.test.ts test/ab-cron-rotate.test.ts test/youtube/ab-evaluate-phases.test.ts` e os testes de `queries` do ab-lab; depois a suíte inteira `npx vitest run > /tmp/s8f1-suite.log 2>&1` em background (~160 s), no contexto só as falhas; `npm run build:packages` não é preciso (nada em `packages/`); typecheck web e api (o pre-commit já roda).
- [ ] **Step 3: limite de agendas da Vercel (P3, pendência 9) — fechado.** Fato do controlador (18/10): o limite é **100 por projeto em todo plano** (docs da Vercel, changelog "Cron jobs now support 100 per project on every plan"); 49 → 51 cabe. A Vercel não agenda, sem erro, o que passar do limite, e o painel não prova que o cron rodou: a prova é o `cron_health` no D+1 (Step 8).
- [ ] **Step 4: revisão G4.** Phil e Yannis revisam o lote (diff + resultados dos testes) e as decisões marcadas: corte da Hanna nos CHECKs (agora quatro), `final` só no D+10, pendência 7, `motivo_nulo_meta`, nota `info` fora do `recordCronFailure`, `enviadaEmDoEtag` local. Conserta-se até haver acordo.
- [ ] **Step 5: leitura em produção antes do `db:push:prod`** (`supabase db query --linked`, só leitura), cada uma = 0 ou não empurra:
  `select count(*) from ab_tests where not (completed_reason is null or completed_reason in (<lista nova>))`;
  `select count(*) from ab_test_cycles where not (end_reason is null or end_reason in (<lista nova>))`;
  `select count(*) from ab_tests where not coalesce((<expressão nova de restore_status_shape>), false)`;
  `select count(*) from ab_test_restores where estado not in (<lista nova de 6>)`;
  `md5(pg_get_constraintdef(oid))` dos **quatro** CHECKs em produção x 54422 iguais (antes do `db:push:prod`); e conferir `select max(version) from supabase_migrations.schema_migrations` = a última da fila (Migration A ou S4), avisar a A5 (alinhar antes do `db:new`, spec §2.6.4).
- [ ] **Step 6: no dia, fora de 07:50–08:10 e 11:50–12:10 UTC:** `git fetch` e trazer `origin/staging` (a S4 pode ter entrado);
  `npm run db:new ab_lab_s8_f1_gravacao`; colar o rascunho; aplicar duas vezes no 54422 e rodar os testes de integração da Task 1 de novo;
  commit da migration (`feat: S8-F1, migration da gravação`); `npm run db:push:prod` (confirmação YES); C-10b: `relrowsecurity = true` nas duas tabelas e os **quatro** CHECKs aceitam os valores novos e recusam `'xyz'` (uma transação com `rollback`; o de `ab_test_restores` aceita `pulado_teste_youtube`).
- [ ] **Step 7: push** (G1: depois da migration), fora das quatro janelas: `bash -c 'git push origin <sha>:refs/heads/staging'`; conferir o CI do push e o deploy da Vercel; promover `main` pela regra da casa.
- [ ] **Step 8: conferências com data** (gravar no arquivo de lembretes da frente; o handoff manda recriar os crons):
  D+1: `select regra_duracao, count(*) from ab_tests group by 1` só `v1` e o T19 `0d31687e` `v1` (C-2, Phil);
  `select leitura_estado, count(*) from ab_test_sondas where test_id = '0d31687e-8c34-448c-9387-31c7f5343c37' and hora > now() - interval '24 hours' group by 1` → **`bate` ≥ 22 de 24**, `nenhuma_bate` = 0, `sem_referencia` = 0 (C-5; hoje o CDN está a Hamming 1 da variante `e3e0c8dc`; "24 sondas e zero `sem_referencia`" passaria com a sonda cega);
  depois da rotação de 19/10 08:00 UTC: a primeira sonda `bate` com `variante_vista = aada02ed` e `enviada_em` entre 08:00 e a `lida_em` dela;
  `select cron_name, last_success_at, consecutive_failures from cron_health where cron_name in ('ab-retrato','ab-sonda-miniatura')` → as duas com `last_success_at` nas últimas 24 h e `consecutive_failures = 0` (colunas reais conferidas em `20260531000001_cron_health.sql`); sem linha = a Vercel não agendou: abrir o painel antes de qualquer outra coisa;
  linhas do T19 em `ab_test_dias` desde o primeiro ciclo (primeira rodada retrata o passado inteiro; 20+ linhas é o esperado);
  D+3: `select count(*) from ab_test_dias where not final and day_pt < (now() at time zone 'America/Los_Angeles')::date - 11` = 0 (`current_date` é UTC no Postgres);
  D+14: p95 de `normalized_at − end_time` dos relatórios `channel_reach_basic_a1`; acima de 7 dias, rever o D+10 antes da F4 (spec §11).

---

## Pendências do `pendencias-plano-s8.md`, uma a uma

| # | Pendência | Como este plano fecha |
|---|---|---|
| 1 | §2.3 "escreve só em `ab_test_dias`" × §5.2.5 | **F1:** o `ab-retrato` só escreve em `ab_test_dias` (Global Constraints; teste da Task 5 conta as tabelas escritas). **F4:** passa a escrever `result_metadata.v2` e a chamar o settle; isso vai no plano da F4, junto com a mudança do texto do §2.3 |
| 2 | `settleOnAir` falhando às 14:00 | **F4** (a F1 não chama settle). Regra herdada para o plano da F4: falha do settle → `recordCronFailure('ab-retrato', …)` e nada em `completed_reason`/`result_metadata.v2` sem o ciclo fechado; teste com o settle falso rejeitando |
| 3 | Retrato até `ontemPt`, relógio inclui hoje | **F1:** teste "nenhuma linha com `day_pt = dayPt(agora)`" (Tasks 2 e 3). **F4:** teste do dia parcial no relógio (spec §5.2.1) |
| 4 | `ab-evaluate` v1 só tem o dever da duração máxima | **Conferido na leitura deste plano (18/10):** `phaseEvaluateActiveTests` (`ab-evaluate-phases.ts:65-123`) só faz a duração máxima (`daysSinceStart >= max_duration_days` → `settleOnAir(..., 'duracao_maxima')`); a **rota** faz também `phaseAutoStartPlayoffs`, `checkAndEscalate` e `runLongevityChecks`. Logo a guarda da F4 vai no laço de `phaseEvaluateActiveTests` (pular `regra_duracao = 'v2'`), nunca na entrada da rota. Para o plano da F4 |
| 5 | Na F4 o `ab-retrato` deixa de ser só escrita no retrato | igual ao 1 |
| 6 | ~6 h a mais de uma variante no dia do teto | registrado para a F4 (a rotação das 08:00 roda antes da decisão das 14:00); a F1 não muda nada |
| 7 | Sonda com variante sem referência | decidido na Task 4: uma batida única vale; `variantes_sem_referencia` guarda o resto |
| 8 | "Janela de promoção" vale para deploy, não para cron | anotado: as agendas `0 14 * * *` e `15 * * * *` podem cruzar as janelas; só push e `db:push:prod` respeitam as janelas |
| 9 | D+14 e limite de agendas | **Fechada:** limite de 100 crons por projeto em todo plano (fato do controlador, 18/10); 51 cabe. D+14 e a prova por `cron_health`: Task 7, Step 8 |
| — | Dívida: `completed_reason` mistura motivo e versão da regra | registrada; gatilho: regra v3. Nada na F1 |
| — | 2ª agenda da sonda | não ligada (P3); gatilho: mistura média acima de 20% ou o dono pedir o número exato |

## O que este plano não conferiu

- Se o plano da S6/S7 fase 1, escrito em paralelo, já tirou as reescritas de CHECK (os quatro) que este plano assume (corte da Hanna); o controlador avisa.
- `thumbnail_dhash` do T19: conferido pelo controlador em produção (18/10), preenchido nas duas variantes; a sonda ainda calcula pelo Blob se faltar em outro teste.
- A retenção das tabelas normalizadas da A5 (spec §2.6.3): a F1 só as lê; a confirmação continua aberta com a A5.

## Conserto r1 (18/10, Sonnet; fontes: `review-plano-s8-f1-phil.md`, `review-plano-s8-f1-yannis.md`, `fatos-controlador-planos-f1.md`)

| Id | O que mudou | Onde |
|---|---|---|
| Yannis B1 / Phil D1 | 4º CHECK `ab_test_restores_estado_check` na mesma migration e transação; teste de ponta a ponta pelo gatilho `ab_tests_restore_log`; grep do Step 1 acha o CHECK; leitura em produção e md5; avisar a S6/S7 | Architecture; Task 1 Interfaces, Step 1, Step 2; Task 7 Steps 4–6 |
| Yannis B2 / Phil P1 | `diasDoTeste(..., desde)`, `JANELA_RETRATO_DIAS = 40` única, `fechar_antigas(p_antes)` fecha linhas abertas antigas; testes (mutante do filtro) | Task 1 DDL; Task 2; Task 3; Task 5 Carga e testes |
| Phil B1 / Yannis D1 | toda leitura por `lerPaginado` com ordem por chave única e teto; sonda lida só `bate` e dias abertos; testes de 1.000+500 e de teto; contagem de consultas lógicas | Task 5 Carga e Step 2; Task 6 fluxo (2) e testes |
| Phil D2 | achados na 2ª leitura entram em `testes` e são retratados na mesma rodada; teste `archived` com `completed_at` nulo | Task 5 Carga item 2 e Step 2 |
| Phil D3 | D+1 exige `bate` ≥ 22 de 24, `nenhuma_bate` = 0, primeira `bate` da nova variante após 08:00 UTC, `cron_health` (`cron_name`, `last_success_at`, `consecutive_failures`) dos dois jobs; D+3 em fuso do Pacífico | Task 7 Step 8 |
| Phil D4 / Yannis D3 | download do Blob por `dhashDoArquivo` (timeout 15 s, allowlist), em paralelo; falha vira `variantes_sem_referencia`; teste com `TimeoutError` | Task 6 Consumes, fluxo (3), Step 2 |
| Yannis D2 | `etagUtil` (regra de `usableEtag`): ETag `"0"` não reusa o dHash; teste de 2 rodadas | Task 4 Interfaces e Step 2; Task 6 fluxo (3) e Step 2 |
| Yannis D4 / Phil (pergunta 4) | DDL completo das duas tabelas e corpos de `ab_test_dias_apply`, `fechar_apagados`, `fechar_antigas`; mapa `source → views_fonte`; teste de releitura campo a campo | Task 1 "DDL fechado"; Task 3; Task 1 Step 3 |
| Phil D5 / Yannis P2 / P3 | `final` só no D+10 emendado no spec §2.3 e no C-3 (com linha de histórico); comentário de `motivo_nulo_meta` diz recálculo da S8 | Task 1 Interfaces; Task 2; spec §2.3, C-3, Registro de revisões |
| Phil P2 | `fechadas_sem_alcance` no retorno de `rodarRetrato` | Task 5 Produces e Notas |
| Controlador | limite de crons: 100 por projeto, pendência 9 fechada; `thumbnail_dhash` do T19 conferido | Task 7 Step 3; tabela de pendências; "O que não conferiu" |
| Yannis P1, P4, P5, P6 | aceitos sem mudança (cópia local de `uploadInstant` com paridade, `info` no Sentry, pendência 7); P6 vira nota no Interfaces (o lock vem do `lock_timeout`, não do `not valid`) | Task 1 Interfaces |
| Phil / Yannis r2 N1 | "r2": `p_antes` de `fechar_antigas` é sempre a constante `janelaDesde(ontem)` (exportada de `retrato.ts`), nunca o `menorDia` de um teste; por teste, leituras e `desde` usam `max(janelaDesde(ontem), início do teste)`; B2 reescrito e teste N1 novo (dois testes) | Task 2 `diasDoTeste`; Task 5 Carga e Step 2; spec §2.3 (linha residual) |
| Phil, nota para a S7 | não é desta fase: o registro `pulado_teste_youtube` da S7 precisa de `destino`, `em`, `forcado`, `attempts` (o `shape` fica estrito); fica para o controlador repassar à S6/S7 | não aplicado aqui, por ser da S7 |
