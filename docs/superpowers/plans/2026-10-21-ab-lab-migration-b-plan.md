# A/B Lab, Migration B (limpeza da descrição): plano de implementação, r2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 21/10/2026. **r2**, depois da revisão r1 de Phil (84) e Yannis (84); ver "Decisões da r2" no fim. O dono liberou (21/10) **escrever este plano e levar a revisão a 90+**.
Isso **não** libera executar, nem `db:new`, nem aplicar nada em produção.

**Goal.** Apagar do banco o que sobrou da descrição no A/B Lab: `ab_tests.original_description`,
`ab_test_variants.description_text`, a tabela `ab_test_tracked_links` e a função `create_playoff_test`. Junto saem
`lib/youtube/ab-templates.ts` e os mocks dele, `lib/youtube/ab-playoff.ts` e `phaseAutoStartPlayoffs`, e as últimas
citações em tipos e testes.

**Architecture.** O código vai primeiro e a migration depois, como na P3 e na Migration A. O **envio 1** leva o código,
os testes e o SQL como fixture, provado no `bythiago_int`. Tudo isso funciona com e sem as colunas. No **dia B**, nesta
ordem: portão de dado (só `select`), `pg_dump` do dono com ensaio de restauração no `bythiago_int`, `db:new` com cópia
byte a byte da fixture, linha de bloqueio na fila, **envio 2** no máximo 2 h antes da janela, só com o arquivo da
migration (o CI aplica a B no banco dele e roda a integração inteira em cima),
`db:push:prod` pelo dono por `bash`, conferência D+0 e, no dia seguinte, D+1. O SQL aborta sozinho, sem mudar nada, se o
portão falhar no instante da aplicação. Guarda, `drop` e `alter` vão num único `DO`.

**Tech Stack.** Postgres 17 (Supabase), plpgsql, Vitest + `pg` (integração com `HAS_LOCAL_DB=1`), TypeScript estrito,
Next.js 16.

**Spec.** `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md`: bloco "Migration B" (`:564-574`) e emenda 35
(`:305-314`). Onde os dois discordam, **vale a emenda 35** (a função é apagada, não recriada, D1; e `ab-playoff.ts` e `phaseAutoStartPlayoffs` saem antes da B, D3).
Aceite: `docs/superpowers/specs/2026-10-14-ab-lab-aceite-p3-p4.md` §6. Notas herdadas: plano da P3
`docs/superpowers/plans/2026-10-14-ab-lab-p3-sai-a-descricao-plan.md` §12 (itens 1 a 7), §9 e linhas 46-51 e 102.
Ordem da fila: `docs/superpowers/specs/2026-10-18-ab-s6-s7-guarda-e-nativo-design.md:329` e
`/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/a5/fila-do-db-push.md`.

## Global Constraints

- Migration só por `npm run db:new ab_drop_descricao`, **no dia B e em árvore própria**. Nunca no checkout principal,
  nunca criada à mão. O arquivo gerado é **cópia byte a byte** da fixture (`cmp` sem saída).
- **Nada vai a produção sem `pg_dump` conferido** (aceite §6: "Reprova: aplicar sem o `pg_dump` conferido"). O `pg_dump`
  é feito **antes** do `db:new`. Assim, se outro terminal levar a B junto num `db push`, o backup já existe.
- `db:push:prod` é do dono, por `bash <arquivo>.sh`, na janela. Janela: fora de 11:30-13:00 UTC; fora dos minutos 0, 15,
  20 e 40; longe dos crons do A/B (04:00, 08:00, 10:00, 11:00, 12:00, 14:00 e 20:00 UTC; sonda no minuto 15 de toda hora);
  `lock_timeout` de 5 s. O `lock` inicial pega também `tracked_links` (o `drop table` o exige); durante os milissegundos
  da B, `/go/*` espera na fila (Review Focus 4).
- **Não antes de 22/10/2026 07:02 UTC.** A P3 entrou na `main` em `55ea62df6`, 15/10 04:02 BRT (07:02 UTC), e são 7 dias
  de P3 no ar (aceite §6).
- A fila do banco é uma só (`fila-do-db-push.md`). A B **arma a fila** (emenda 35): enquanto o arquivo existir sem estar
  aplicado, ninguém cria nem aplica outra migration. **A fila armada tem fim:** envio 2 no máximo 2 h antes da janela,
  no mesmo dia; B abortada cuja causa não some em 24 h → `git revert` do arquivo (seção 5). O número tem de ser maior que todos os de `origin/staging` **e** de
  todas as árvores ativas. Hoje já há `20261021000003` reservado pela F0 das sugestões.
- A B **não depende** das tarefas congeladas T2-T19 e T21 do "original em alta"
  (`docs/superpowers/plans/2026-10-19-ab-original-em-alta-plan.md`, D12) e não muda nenhum arquivo delas.
- TypeScript sem `any` e sem `as unknown as`. Commits `tipo: descrição` por lista de arquivos. Nunca `git stash`, nem
  `git reset`, nem push do `staging` local. Push só por `bash -c 'git push origin lote/ab-mb:staging'`.
- Suíte e build com saída em arquivo; nenhum comando acima de 4 min em primeiro plano. Integração local contra o
  `bythiago_int`: `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`.
  O 54321/54322 é do navegador e não se usa aqui.
- Executor: agente `executor` (Sonnet, effort `medium`). Portão: Phil e Yannis (Opus, `medium`). Nada em `high`.

## Review Focus

1. **CI depois do envio 2:** o banco do CI já nasce com a B aplicada. Qualquer teste de integração que ainda cite as
   colunas ou a tabela fica vermelho. O teste da Tarefa 4 recria a forma de antes **dentro da transação desfeita** (fixture
   `-pre`) e roda igual nos dois estados. Teste: Tarefa 4, caso "no banco já migrado".
2. **Outro terminal roda `db:push:prod` entre o envio 2 e a vez do dono.** A B iria junto. Ela aborta sozinha se o portão
   cair, e o `pg_dump` já existe porque é feito antes do `db:new`. A linha de bloqueio na fila avisa. Teste: Tarefa 4 (os
   abortos); procedimento: Tarefa 6, passos 2 e 5.
3. **Assinatura diferente de `create_playoff_test` em produção** (sobrecarga criada à mão). O `drop ... if exists` com a
   assinatura de hoje não a pega e ela ficaria órfã. O SQL confere `pg_proc` depois do `drop` e aborta. Teste: Tarefa 4,
   caso "sobrecarga".
4. **Lock ocupado por um cron ou pelo `go.*`** (a sonda roda no minuto 15; `/go/<code>` lê `tracked_links` a cada clique).
   Com `lock_timeout` de 5 s a B falha e não muda nada. O `drop table` de `ab_test_tracked_links` pede `ACCESS EXCLUSIVE`
   em `tracked_links` (remove os gatilhos da FK; sondado por Yannis), então o `lock` do início já inclui `tracked_links`:
   se falhar, falha cedo. Enquanto a B espera, os `/go/*` ficam na fila por até 5 s; depois da concessão são
   milissegundos. Teste: Tarefa 4, casos "lock" (`ab_test_variants` e `tracked_links`).
5. **Rollback da Vercel depois da B.** Deploy anterior a `55ea62df6` grava `original_description` e lê
   `ab_test_tracked_links`, e quebra. Os deploys de `55ea62df6` em diante não citam esses objetos em tempo de execução
   (conferido por `git grep` em `55ea62df6`; só o destructure tipado de `listVariants`, que não falha com a chave
   ausente). Prova: Tarefa 6, passo 1 (`git grep` no deploy de reserva, **antes** do `pg_dump`) e passo 9 (de novo,
   depois da aplicação, no deploy que de fato ficou de reserva).

---

## 0. Fatos medidos em 21/10 (`origin/staging` `b3b13d769`; produção por `select`)

| Fato | Valor | Fonte |
|---|---|---|
| Testes em produção | 3: 2 `completed` e 1 `archived`, todos `combo`, nenhum com `parent_test_id` | `select` 21/10 |
| `original_description` não nulo | **2 de 3** (29/05, 983 caracteres; 07/10, 393; o de 18/10, criado depois da P3, é nulo). O texto dos 2 também está em `yt_own_video_meta_daily` (md5 igual, 1 linha de 13 em cada vídeo); o `pg_dump` é a segunda cópia | `select` 21/10 (Phil) |
| Variantes / com `description_text` | 7 / **0** | idem |
| `ab_test_tracked_links` / `tracked_links` com `source_type = 'ab_test'` | **0 / 0** | idem |
| Tamanho das três tabelas | `ab_tests` 104 kB, `ab_test_variants` 80 kB, `ab_test_tracked_links` 24 kB | `pg_total_relation_size` |
| Funções que citam as colunas, a tabela ou `ab_test_variants` | só `create_playoff_test(p_parent_test_id uuid, p_variant_ids uuid[], p_cooldown_hours integer)`, `SECURITY DEFINER` | `pg_proc.prosrc` |
| Views dependentes das três tabelas | nenhuma | `pg_depend`/`pg_rewrite` |
| Objetos de `ab_test_tracked_links` | PK, `unique (ab_test_id, variant_id, template_name)`, 3 FKs de saída (ab_tests, ab_test_variants, tracked_links), 3 policies `*_staff`, nenhum trigger; **nenhuma FK de entrada** | `pg_constraint`, `pg_policies` |
| Última migration aplicada | `20261021000002` (inclui MG15 `20261016000001`, aplicada; a linha "MG15 pendente" da fila é velha) | `schema_migrations` |
| Migrations no repositório que citam os objetos | só as antigas: `20260517000002`, `20260529000001` (a função, `:29-134`), `20260611000002` (comentário), `20261007000006` (`description_text` de `yt_own_video_meta_daily`, outra tabela) | `git grep` |
| `src` que lê os objetos | **nenhum**. Sobram `services/youtube.ts:1012` (`_Cobre` com `'description_text'`) e `:1273` (destructure `description_text: _desc`), e `types/database.types.ts` (`:203-260` tabela, `:267/284/301` coluna da variante, `:347/386/425` coluna do teste, `:10901-10908` função) | `git grep` |
| Contrato de entrada que fica (D2) | `ab-schemas.ts:9-44` (`DESCRICAO_FORA_DO_TESTE`, `pedeDescricao`, `description_text` declarado), `mcp/tools.ts:681`, `mcp/errors.ts:55`, `api-registry.ts:194`, `cowork-docs-youtube.md:485` | idem |
| `description_text` de outra tabela (fica) | `coleta/meta-step.ts:459`, `coleta/versoes-step.ts:264,438-449` e seus testes (`yt_own_video_meta_daily`) | idem |
| `ab-templates` | `src/lib/youtube/ab-templates.ts` sem chamador em `src`; `test/ab-templates.test.ts`; **10** arquivos com `vi.mock` (o plano da P3 dizia 14): `ab-actions-acknowledge-drift`, `ab-actions-create`, `ab-actions-resume`, `ab-drift-lifecycle`, `ab-p3-actions`, `api/cron/ab-evaluate`, `api/cron/ab-rotate`, `cms/site-admin-step-ab`, `youtube/ab-apply-metadata`, `youtube/ab-evaluate-phases` (este também importa `resolveTemplates`, `:48` e `:237`) | idem |
| Testes que citam `ab_test_tracked_links` | `integration/youtube-channel-remove.test.ts:94-95,175`; `mcp/mcp-schema-reads.test.ts:348-351,372,387`; `youtube/ab-pipeline-null-aviso.test.ts:66,112,122`; `youtube/ab-p3-recusa-descricao.test.ts:174,187` | idem |
| `ab-playoff.ts` e `phaseAutoStartPlayoffs` | `src/lib/youtube/ab-playoff.ts` (122 linhas) sem importador em `src`; só `test/ab-playoff.test.ts` o importa e `vi.mock` em `test/api/cron/ab-evaluate.test.ts:70` e `test/youtube/ab-evaluate-phases.test.ts:26`. `phaseAutoStartPlayoffs` (`ab-evaluate-phases.ts:22`) é chamada em `api/cron/ab-evaluate/route.ts:6,23` e citada em `test/ab-cron-evaluate.test.ts:12` e `ab-evaluate-phases.test.ts:42,388-404`. Saem no envio 1 (D3, emenda 35). `ab-playoff-notification.test.ts` testa `notification-service`: fica | `git grep` |
| Guarda de esquema | `test/mcp/mcp-schema-guard.test.ts` confere toda tabela, coluna e RPC citada por `src` contra `database.types.ts` | leitura |
| CI | `test-db-integration` roda `HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/ --no-file-parallelism` com todas as migrations do repositório aplicadas | `ci.yml:119-149` |
| Pooler da sessão | `postgresql://postgres.novkqtvcnsiwhkxihurk@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`; `pg_dump` local 18.3 (lê servidor 17) | `supabase/.temp/pooler-url`, `pg_dump --version` |

**Quem executa reconfere tudo por `grep` no dia.** O `origin/staging` anda e as linhas citadas deslocam.

## 1. Fica FORA

- `youtube_videos.view_count_delta_today` e `view_count_yesterday`: emenda 35, migration própria da A5.
- O valor `'ab_test'` do enum `link_source_type`: o Postgres não remove valor de enum sem recriar o tipo (P3 §12.5).
- Linhas de `tracked_links` e de `link_clicks`: a B não as toca. A FK vai de `ab_test_tracked_links` para `tracked_links`,
  então o `drop` não as apaga (P3 §12.1).
- O 422 `DESCRICAO_FORA_DO_TESTE` e o campo `description_text` declarado no Zod e no MCP: ficam (D2).
- As telas de playoff (`playoff-banner`, `playoff-detail`): ficam; leem `parent_test_id` histórico. (`ab-playoff.ts` e `phaseAutoStartPlayoffs` **saem**, D3.)
- `ab_test_cycles.applied_metadata` antigo (`description_set`, `links_resolved`): JSON histórico; nada a migrar.
- Teste antigo de tipo descrição: não existe. A Migration A (`20261018000003`, aplicada em 18/10) tem CHECK de três
  valores e a A0 viu 3 testes `combo`. O "destino de teste antigo de descrição" que a P3 deixou para a B está resolvido.
- Tarefas congeladas do "original em alta" (D12).

## 2. Decisões (recomendação do controlador; a revisão cobra)

| # | Decisão | Recomendação | Alternativa e custo |
|---|---|---|---|
| D1 | `create_playoff_test` | **Apagar** (`drop function if exists` com a assinatura de hoje, mais conferência de `pg_proc` depois). É a emenda 35: função `SECURITY DEFINER` sem chamador é superfície sem dono. O plano da P3 (§12.2) e o corpo do spec diziam "recria"; a emenda vale sobre os dois | Recriar sem as colunas: mantém código sem chamador, e quem quiser playoff de novo teria de revisar a função de qualquer jeito |
| D2 | 422 e `description_text` declarado | **Ficam para sempre.** São o contrato de entrada com o Cowork e não dependem da coluna. Sem o campo declarado, o SDK do MCP descarta a chave em silêncio e o Cowork veria sucesso falso (P3 D3) | Tirar em N semanas: custa um commit e reabre o sucesso falso para cliente antigo |
| D3 | `ab-playoff.ts` e `phaseAutoStartPlayoffs` | **Saem no envio 1** (Tarefa 1 e Tarefa 1b). A emenda 35 do spec manda tirá-los antes da B e vale sobre a recomendação da r1 (ruling do controlador, achados de Phil I4 e Yannis I1). Depois da B nada cria rascunho de playoff, e a fase rodaria a cada cron sem poder achar trabalho. As telas de playoff ficam | Manter: contraria a emenda 35 e deixa código sem dono |
| D4 | `database.types.ts` | **Edição à mão dos quatro blocos**, provada por um teste de tipos (Tarefa 2). O `npm run db:types` gera do 54321 do navegador, que pode estar à frente ou atrás do repositório e traria diferença alheia ao commit | Regenerar do `bythiago_int` com `--db-url`: o mesmo risco de diferença alheia; aceitável só se `git diff --stat` mostrar apenas as remoções |
| D5 | Ordem | **Código antes (envio 1), migration no dia (envio 2), aplicação logo depois.** O código do envio 1 funciona com e sem as colunas | Tudo num envio só: o CI aplica a B no banco dele, mas a produção ficaria com o arquivo pendente esperando o dia, o que arma a fila por mais tempo |
| D6 | Variante com `description_text` | **Aborta** (hoje 0), com até 20 ids e a contagem na mensagem | Só avisar: perde-se texto de variante sem decisão do dono |
| D7 | `original_description` não nulo | **Só avisa** (`raise notice` com a contagem; são 2 de 3), **exceto** texto gravado depois da P3 (`created_at >= '2026-10-15 07:02:00+00'`), que **aborta** porque não estaria no `pg_dump` (rollback da Vercel para antes da P3 voltaria a gravar). A descrição nunca mudou no ar e o texto está no `pg_dump` e em `yt_own_video_meta_daily` | Abortar sempre: a B nunca rodaria |
| D8 | `queued` e `draft` | **Não bloqueiam** (o aceite cita só `active` e `paused`). Nenhum código lê os objetos apagados | Bloquear também: atrasa a B por rascunho que o `ab-draft-cleanup` arquiva em 24 h |
| D9 | Cache do PostgREST | `notify pgrst, 'reload schema'` no fim. O event trigger do Supabase já recarrega; o `notify` é barato e deixa a recarga explícita | Sem `notify`: depende só do event trigger |
| D10 | Testes da P3 que simulam linha com `description_text` (`ab-p3-recusa-descricao`, `ab-actions-text-variant`, `ab-apply`, `ab-schemas`, `ab-variants-route`, `ab-actions-create:496`, `mcp-schema-parity`, `mcp-tools`, `prompt-builders-ab`) | **Ficam.** Provam o contrato de entrada e a projeção por lista fechada, e passam com e sem a coluna | Apagar: perde-se a prova do 422 |

## 3. Arquivos

| Arquivo | Tarefa | Mudança |
|---|---|---|
| `apps/web/src/lib/youtube/ab-templates.ts`, `apps/web/test/ab-templates.test.ts` | 1 | apagados |
| `apps/web/src/lib/youtube/ab-playoff.ts`, `apps/web/test/ab-playoff.test.ts` | 1 | apagados |
| os 10 testes com `vi.mock('@/lib/youtube/ab-templates')` (seção 0) | 1 | sai o `vi.mock` (e, em `ab-evaluate-phases.test.ts`, o `import` e o `mockImplementation`) |
| `apps/web/src/lib/youtube/ab-evaluate-phases.ts`, `apps/web/src/app/api/cron/ab-evaluate/route.ts`, `test/ab-cron-evaluate.test.ts`, `test/api/cron/ab-evaluate.test.ts`, `test/youtube/ab-evaluate-phases.test.ts` | 1b | sai `phaseAutoStartPlayoffs`, a chamada, o campo do resultado e os `vi.mock('@/lib/youtube/ab-playoff')` |
| `apps/web/src/lib/pipeline/services/youtube.ts` (`_Cobre`, `listVariants`) | 2 | sem `'description_text'` |
| `apps/web/src/types/database.types.ts` | 2 | saem a tabela, as duas colunas e a função |
| `apps/web/test/youtube/ab-migration-b-tipos.test.ts` | 2 | novo |
| `integration/youtube-channel-remove.test.ts`, `mcp/mcp-schema-reads.test.ts`, `youtube/ab-pipeline-null-aviso.test.ts`, `youtube/ab-p3-recusa-descricao.test.ts` | 3 | sem `ab_test_tracked_links` |
| `apps/web/test/integration/fixtures/ab-migration-b.sql`, `.../ab-migration-b-pre.sql`, `apps/web/test/integration/ab-migration-b.test.ts` | 4 | novos |
| `supabase/migrations/<carimbo>_ab_drop_descricao.sql` | 6 | `db:new` no dia, cópia da fixture |
| `docs/superpowers/plans/2026-10-14-ab-lab-p3-sai-a-descricao-plan.md` §9 | 6 | uma linha: "Depois da Migration B: ver `2026-10-21-ab-lab-migration-b-plan.md` §5." |

Árvore de execução: `git fetch origin && git worktree add ../bythiago-ab-mb -b lote/ab-mb origin/staging`
(`W` daqui em diante). Ledger: `.superpowers/sdd/ab-lab/migration-b/progress.md`.

---

### Tarefa 0: árvore e inventário do dia

- [ ] **Passo 1:** criar `W` (comando acima); `npm ci` com saída em arquivo; `npm run build:packages`.
- [ ] **Passo 2:** refazer os `git grep` da seção 0 em `W` e colar no ledger a lista com linhas:
  `git grep -n -E "original_description|description_text|ab_test_tracked_links|create_playoff_test|ab-templates|resolveTemplates|parseTemplateTokens|ab-playoff|phaseAutoStartPlayoffs" -- apps packages/*/src`.
  Esperado: os mesmos arquivos da seção 0. Arquivo novo na lista → classificar (sai na B, fica pela D2/D10, ou é
  `yt_own_video_meta_daily`) e anotar antes de seguir.

### Tarefa 1: saem `ab-templates` e `ab-playoff.ts`

**Files:** Delete `apps/web/src/lib/youtube/ab-templates.ts`, `apps/web/test/ab-templates.test.ts`,
`apps/web/src/lib/youtube/ab-playoff.ts`, `apps/web/test/ab-playoff.test.ts`. Modify os 10 testes da seção 0 e os dois
que fazem `vi.mock('@/lib/youtube/ab-playoff')`.

**Interfaces:** Produces: nenhum símbolo `resolveTemplates`/`parseTemplateTokens`/`checkPlayoffEligibility`/`selectPlayoffVariants` no repositório.

- [ ] **Passo 1 (vermelho):** `git grep -n -E "ab-templates|resolveTemplates|parseTemplateTokens|lib/youtube/ab-playoff|checkPlayoffEligibility|selectPlayoffVariants" -- apps | wc -l` → hoje > 0.
- [ ] **Passo 2:** apagar os dois arquivos; tirar a linha (ou o bloco de 2-3 linhas) do `vi.mock` de cada um dos 10; em
  `youtube/ab-evaluate-phases.test.ts`, tirar também o `import { resolveTemplates }` e o `mockImplementation` do
  `beforeEach`. Apagar `ab-playoff.ts` e `test/ab-playoff.test.ts`; tirar o `vi.mock('@/lib/youtube/ab-playoff', ...)` de
  `test/api/cron/ab-evaluate.test.ts:70` e `test/youtube/ab-evaluate-phases.test.ts:26`. (`ab-playoff-notification.test.ts`
  fica: testa `notification-service`.)
- [ ] **Passo 3 (verde):** o mesmo `git grep` → `0`. Rodar os 10 arquivos:
  `npx vitest run test/ab-actions-acknowledge-drift.test.ts test/ab-actions-create.test.ts test/ab-actions-resume.test.ts test/ab-drift-lifecycle.test.ts test/ab-p3-actions.test.ts test/api/cron/ab-evaluate.test.ts test/api/cron/ab-rotate.test.ts test/cms/site-admin-step-ab.test.ts test/youtube/ab-apply-metadata.test.ts test/youtube/ab-evaluate-phases.test.ts > /tmp/mb-t1.txt 2>&1; tail -5 /tmp/mb-t1.txt`
  (em `apps/web`). Esperado: todos passam, com o mesmo número de testes de antes, menos os de `ab-templates.test.ts` (que não está na lista).
- [ ] **Passo 4:** `npx tsc -p apps/web --noEmit`, limpo.
- [ ] **Passo 5:** commit por lista: `chore: A/B Lab Migration B: sai ab-templates (sem chamador desde a P3), ab-playoff.ts e os mocks`.

### Tarefa 1b: sai `phaseAutoStartPlayoffs` (emenda 35, D3)

**Files:** Modify `apps/web/src/lib/youtube/ab-evaluate-phases.ts` (a função `phaseAutoStartPlayoffs`, `:22`, e o que
só ela usa), `apps/web/src/app/api/cron/ab-evaluate/route.ts` (`:6,23`, o campo `playoffs` do resultado),
`apps/web/test/ab-cron-evaluate.test.ts:12`, `apps/web/test/api/cron/ab-evaluate.test.ts`,
`apps/web/test/youtube/ab-evaluate-phases.test.ts` (`:42` e o `describe` `:388-404...`).

- [ ] **Passo 1 (vermelho):** `git grep -n phaseAutoStartPlayoffs -- apps | wc -l` → hoje > 0. Escrever primeiro, em
  `test/ab-cron-evaluate.test.ts`, `expect(body).not.toHaveProperty('playoffs_started')` sobre o JSON de resposta da rota (a chave real, `route.ts:71`; falha hoje).
- [ ] **Passo 2:** apagar a função e seus imports exclusivos; na rota, tirar a chamada `phaseAutoStartPlayoffs(supabase)`
  o campo `playoffs_started` do resultado e dos logs, e `totalErrors = evaluation.errors` (sem o termo `playoffs.errors`, `route.ts:42`); `test/ab-cron-evaluate.test.ts:12` (`phaseAutoStartPlayoffs: fases.playoffs`) sai junto; nos testes, tirar o mock da fase, o `describe` dela e as expectativas
  da fase. Conferir antes por `git grep` se algo mais lê o campo `playoffs` do resultado do cron (painel, docs):
  anotar no ledger o que achar. As telas de playoff ficam.
- [ ] **Passo 3 (verde):** `git grep -n phaseAutoStartPlayoffs -- apps | wc -l` → `0`;
  `npx vitest run test/ab-cron-evaluate.test.ts test/api/cron/ab-evaluate.test.ts test/youtube/ab-evaluate-phases.test.ts > /tmp/mb-t1b.txt 2>&1; tail -5 /tmp/mb-t1b.txt`
  passa; `npx tsc -p apps/web --noEmit` limpo. Yannis confere este diff no passo 2 da Tarefa 5.
- [ ] **Passo 4:** commit por lista: `chore: A/B Lab Migration B: sai phaseAutoStartPlayoffs do cron ab-evaluate (emenda 35)`.

### Tarefa 2: tipos e serviço sem as colunas

**Files:** Modify `apps/web/src/types/database.types.ts`, `apps/web/src/lib/pipeline/services/youtube.ts:1012,1273`.
Test: Create `apps/web/test/youtube/ab-migration-b-tipos.test.ts`.

**Interfaces:** Consumes: `loadSchema(typesPath: string): { schema: Map<string, { columns: Set<string> }>; functions: Set<string> }`
de `test/helpers/schema-audit.ts`. Produces: `database.types.ts` sem `ab_test_tracked_links`,
`ab_tests.original_description`, `ab_test_variants.description_text` e `create_playoff_test`.

- [ ] **Passo 1: teste que falha.**
  ```ts
  import { describe, it, expect } from 'vitest'
  import { resolve, join } from 'node:path'
  import { loadSchema } from '../helpers/schema-audit'

  const { schema, functions } = loadSchema(join(resolve(__dirname, '../..'), 'src/types/database.types.ts'))

  describe('Migration B: os tipos já não têm o que a B apaga', () => {
    it('sem a tabela ab_test_tracked_links', () => expect(schema.has('ab_test_tracked_links')).toBe(false))
    it('ab_tests sem original_description', () => expect(schema.get('ab_tests')!.columns.has('original_description')).toBe(false))
    it('ab_test_variants sem description_text', () => expect(schema.get('ab_test_variants')!.columns.has('description_text')).toBe(false))
    it('sem a função create_playoff_test', () => expect(functions.has('create_playoff_test')).toBe(false))
    it('controle positivo: o leitor acha o que existe', () => {
      expect(schema.get('yt_own_video_meta_daily')!.columns.has('description_text')).toBe(true)
      expect(schema.get('ab_test_variants')!.columns.has('title_text')).toBe(true)
      expect(functions.has('create_waitlist_with_translation')).toBe(true)
    })
  })
  ```
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-migration-b-tipos.test.ts` → 4 falhas e o controle positivo passa.
- [ ] **Passo 3:** em `database.types.ts`, apagar o bloco `ab_test_tracked_links: { ... }` inteiro (Row, Insert,
  Update, Relationships), as três linhas `description_text` de `ab_test_variants`, as três `original_description` de
  `ab_tests` e o bloco `create_playoff_test: { Args ... Returns: string }`. A âncora é o texto, não o número da linha.
- [ ] **Passo 4:** em `services/youtube.ts`, o `_Cobre` passa a
  `Exclude<ColunaVariante, (typeof CAMPOS_DA_VARIANTE)[number] | 'thumbnail_dhash'>` e o comentário passa a dizer "só
  `thumbnail_dhash` fica de fora". O `listVariants` troca `select('*')` pela **lista literal** das 13 colunas de
  `CAMPOS_DA_VARIANTE` (`'id, test_id, label, is_original, blob_url, blob_key, file_size_bytes, dimensions, title_text, metadata, sort_order, source_variant_id, created_at'`,
  literal para o cliente tipado inferir a linha) e devolve as linhas **sem destructure**, mantendo o `as VariantRow[]`
  (o `metadata` vem como `Json` e a interface `VariantRow`, `:219-232`, tem `VariantMetadata`); se o `tsc` recusar o
  `as`, o executor para e anota no ledger, sem `as unknown as`. Motivo da troca: o destructure `description_text: _desc`
  (`:1273`) deixa de compilar quando a coluna sai dos tipos; e a lista literal garante, também no intervalo entre o
  envio 1 e a B (em que a coluna ainda existe), que `description_text` não vaza. A prova de que a lista não diverge é o
  conjunto exato das 13 chaves em `ab-p3-recusa-descricao.test.ts:154` (o dublê `fake-postgrest.ts` projeta o `select` e
  devolve 42703 para coluna desconhecida); **não** se escreve teste que leia o texto de `services/youtube.ts`, e
  `CAMPOS_DA_VARIANTE` **não** é exportada.
- [ ] **Passo 5 (verde):** `npx vitest run test/youtube/ab-migration-b-tipos.test.ts test/mcp/mcp-schema-guard.test.ts test/youtube/ab-p3-recusa-descricao.test.ts test/mcp/mcp-schema-reads.test.ts > /tmp/mb-t2.txt 2>&1; tail -8 /tmp/mb-t2.txt`
  → tudo passa; `npx tsc -p apps/web --noEmit` limpo (é ele que pega quem ainda tipa as colunas em `src`).
- [ ] **Passo 6:** commit: `chore: A/B Lab Migration B: tipos e listVariants sem description_text, original_description, ab_test_tracked_links e create_playoff_test`.

### Tarefa 3: testes sem `ab_test_tracked_links`

**Files:** Modify `apps/web/test/integration/youtube-channel-remove.test.ts:85,94-95,165,175`,
`apps/web/test/mcp/mcp-schema-reads.test.ts:348-351,372,387`, `apps/web/test/youtube/ab-pipeline-null-aviso.test.ts:66,112,122`,
`apps/web/test/youtube/ab-p3-recusa-descricao.test.ts:174,187`.

- [ ] **Passo 1 (vermelho):** `git grep -n ab_test_tracked_links -- apps | wc -l` → hoje > 0.
- [ ] **Passo 2:** em `youtube-channel-remove.test.ts`, sair o `insert` em `tracked_links` (`:94`, só servia ao link
  do teste) e o `insert` em `ab_test_tracked_links` (`:95`), e a asserção `:175`; o comentário `:85` e o nome do `it`
  `:165` perdem "link rastreado". As contagens esperadas (`pipeline_links: 1`, `ab_tests: 3`) não mudam: o
  `pipeline_links` vem de outro lugar (o executor confere no corpo de `youtube_channel_remove` e anota no ledger). Nos
  três testes de mock, sair a tabela de `tables` e de `columns`, a expectativa `sb.on('ab_test_tracked_links')` e o nome
  da tabela no predicado `fail`. As expectativas sobre `link_clicks` e `tracked_links` ficam.
- [ ] **Passo 3 (verde):** o `git grep` → `0`. `npx vitest run test/mcp/mcp-schema-reads.test.ts test/youtube/ab-pipeline-null-aviso.test.ts test/youtube/ab-p3-recusa-descricao.test.ts`
  passa; `youtube-channel-remove` com `HAS_LOCAL_DB=1` contra o `bythiago_int` passa (sem a B aplicada ali).
- [ ] **Passo 4:** commit: `test: A/B Lab Migration B: testes sem ab_test_tracked_links`.

### Tarefa 4: o SQL como fixture, provado no `bythiago_int`

**Files:** Create `apps/web/test/integration/fixtures/ab-migration-b.sql` (o corpo da migration, abaixo, literal),
`apps/web/test/integration/fixtures/ab-migration-b-pre.sql` (só para teste), `apps/web/test/integration/ab-migration-b.test.ts`.

**Interfaces:** Consumes: `skipIfNoLocalDb()`, `seedSite(db)`, `seedYoutubeChannelAndVideo(db, siteId)`, `clienteServico()`
(`test/helpers`). Produces: o arquivo que a Tarefa 6 copia byte a byte.

**O corpo da migration** (fixture `ab-migration-b.sql`; é o texto que vai a produção):
```sql
-- ab_drop_descricao (A/B Lab, Migration B). IRREVERSÍVEL. Plano: docs/superpowers/plans/2026-10-21-ab-lab-migration-b-plan.md
-- Apaga ab_tests.original_description, ab_test_variants.description_text, a tabela ab_test_tracked_links e a
-- função create_playoff_test (sem chamador desde a P2; emenda 35 do spec). Antes: pg_dump das três tabelas, pelo dono.
-- Aborta sem mudar nada se houver teste active/paused, playoff vivo, link rastreado de A/B, variante com descrição
-- ou original_description gravado depois da P3. Mensagens listam até 20 ids e a contagem total.
-- Idempotente. Atômica por construção: guardas, drops e alters num único DO.
set lock_timeout = '5s';

do $$
declare
  v_ids  text;
  v_n    bigint;
  v_tot  bigint;
  v_tem_links boolean := to_regclass('public.ab_test_tracked_links') is not null;
  v_tem_desc  boolean := exists (select 1 from pg_attribute where attrelid = 'public.ab_test_variants'::regclass
                                   and attname = 'description_text' and not attisdropped);
  v_tem_orig  boolean := exists (select 1 from pg_attribute where attrelid = 'public.ab_tests'::regclass
                                   and attname = 'original_description' and not attisdropped);
begin
  lock table public.ab_tests, public.ab_test_variants, public.tracked_links in access exclusive mode;
  if v_tem_links then
    lock table public.ab_test_tracked_links in access exclusive mode;
  end if;

  select count(*), string_agg(id::text || ' (' || status || ')', '; ') into v_tot, v_ids
    from (select id, status from public.ab_tests where status in ('active', 'paused') order by created_at limit 20) x;
  if v_ids is not null then
    select count(*) into v_tot from public.ab_tests where status in ('active', 'paused');
    raise exception 'Migration B abortada: % teste(s) em andamento ou pausado (até 20): %. Nada mudou.', v_tot, v_ids;
  end if;

  select string_agg(id::text || ' (' || status || ', filho de ' || parent_test_id::text || ')', '; ') into v_ids
    from (select id, status, parent_test_id from public.ab_tests
           where parent_test_id is not null and status in ('draft', 'queued', 'active', 'paused')
           order by created_at limit 20) x;
  if v_ids is not null then
    select count(*) into v_tot from public.ab_tests
     where parent_test_id is not null and status in ('draft', 'queued', 'active', 'paused');
    raise exception 'Migration B abortada: % playoff(s) vivo(s) (até 20): %. Nada mudou.', v_tot, v_ids;
  end if;

  select count(*) into v_n from public.tracked_links where source_type = 'ab_test';
  if v_n > 0 then
    raise exception 'Migration B abortada: % link(s) de A/B em tracked_links (source_type = ab_test); o dono decide o destino deles e dos cliques. Nada mudou.', v_n;
  end if;

  if v_tem_links then
    execute 'select count(*) from public.ab_test_tracked_links' into v_n;
    if v_n > 0 then
      raise exception 'Migration B abortada: % linha(s) em ab_test_tracked_links. Nada mudou.', v_n;
    end if;
  end if;

  if v_tem_desc then
    execute $q$select string_agg(id::text, '; ') from (select id from public.ab_test_variants
               where description_text is not null order by created_at limit 20) x$q$ into v_ids;
    if v_ids is not null then
      execute 'select count(*) from public.ab_test_variants where description_text is not null' into v_tot;
      raise exception 'Migration B abortada: % variante(s) com description_text (até 20 ids): %. Nada mudou.', v_tot, v_ids;
    end if;
  end if;

  if v_tem_orig then
    execute $q$select string_agg(id::text, '; ') from (select id from public.ab_tests
               where original_description is not null and created_at >= '2026-10-15 07:02:00+00'
               order by created_at limit 20) x$q$ into v_ids;
    if v_ids is not null then
      execute $q$select count(*) from public.ab_tests
                 where original_description is not null and created_at >= '2026-10-15 07:02:00+00'$q$ into v_tot;
      raise exception 'Migration B abortada: % teste(s) com original_description gravado depois da P3 (até 20 ids; o texto não estaria no pg_dump): %. Nada mudou.', v_tot, v_ids;
    end if;
    execute 'select count(*) from public.ab_tests where original_description is not null' into v_n;
    raise notice 'Migration B: % teste(s) com original_description; o texto fica no pg_dump e em yt_own_video_meta_daily.', v_n;
  end if;

  drop function if exists public.create_playoff_test(uuid, uuid[], integer);
  select string_agg(pg_get_function_identity_arguments(oid), ' | ') into v_ids
    from pg_proc where proname = 'create_playoff_test' and pronamespace = 'public'::regnamespace;
  if v_ids is not null then
    raise exception 'Migration B abortada: create_playoff_test com assinatura inesperada (%). Nada mudou.', v_ids;
  end if;

  drop table if exists public.ab_test_tracked_links;
  alter table public.ab_test_variants drop column if exists description_text;
  alter table public.ab_tests drop column if exists original_description;
end $$;

reset lock_timeout;
notify pgrst, 'reload schema';
```
Sem `cascade` em nenhum `drop`: se algo inesperado depender, a B falha alto e não muda nada. O `lock` inicial inclui
`tracked_links` porque o `drop table` de `ab_test_tracked_links` remove os gatilhos de FK do lado referenciado e pede
`ACCESS EXCLUSIVE` nela (sondado por Yannis: com `access share` ocupado a B morria no `drop table`, após 5 s); pegar
cedo faz falhar cedo, com o tempo de espera num lugar só. O modo é `access exclusive` (não `share row exclusive`, que
Phil propôs): é o modo que o `drop table` pede, e o menor não evitaria a espera no fim.

**A fixture `-pre`** (cabeçalho: "Só para teste. Devolve a forma de antes da B dentro da transação desfeita, para o teste
rodar igual no banco do CI, que já nasce migrado."): `alter table public.ab_tests add column if not exists original_description text;`,
`alter table public.ab_test_variants add column if not exists description_text text;`,
`create table if not exists public.ab_test_tracked_links` (`id uuid pk default gen_random_uuid()`, `ab_test_id` → ab_tests
`on delete cascade`, `variant_id` → ab_test_variants `on delete cascade`, `link_id` → tracked_links `on delete cascade`,
`template_name text not null`, `short_code text not null`, `created_at timestamptz not null default now()`,
`unique (ab_test_id, variant_id, template_name)`) e
`create or replace function public.create_playoff_test(p_parent_test_id uuid, p_variant_ids uuid[], p_cooldown_hours integer default 4) returns uuid language sql security definer set search_path = public as $f$ select null::uuid $f$;`.

**Forma do teste.** Um `pg.Client` (`SUPABASE_DB_URL`, padrão `127.0.0.1:54322`, como em `ab-p4b-corte.test.ts`) abre
`begin` em cada `it` e fecha com `rollback` no `finally`. Dentro da transação: `\i` da `-pre` (por `query(readFileSync)`),
`truncate public.ab_tests cascade`, `delete from public.tracked_links where source_type = 'ab_test'`, e a semente do caso
por `insert ... returning id` com o `site_id` e o `youtube_video_id` criados no `beforeAll` (`seedSite`,
`seedYoutubeChannelAndVideo`, gravados de verdade; colunas do teste como em `semearTesteAb`). Os abortos usam
`savepoint s` antes de aplicar e `rollback to savepoint s` depois, e conferem o catálogo em seguida. Funções do teste:
`colunaExiste(c, tabela, coluna): Promise<boolean>`, `tabelaExiste(c, nome): Promise<boolean>`,
`funcoes(c, nome): Promise<number>`, `aplicar(c): Promise<void>`. O arquivo **roda sozinho** (o `lock` e o `truncate`
seguram `ab_tests` até o `rollback`). Higiene do banco compartilhado: o `truncate public.ab_tests cascade` prende
`ACCESS EXCLUSIVE` em 11 tabelas (`ab_test_variants`, `ab_test_cycles`, `ab_test_tracked_links`, `optimization_cycles`,
`yt_notifications`, `ab_test_polls`, `youtube_fatigue_alerts`, `thumbnail_library`, `ab_test_restores`,
`thumbnail_longevity`) durante cada `it`, e o `beforeAll` grava site, canal e vídeo de verdade: o `afterAll` apaga o que o
`beforeAll` criou. **Guarda do banco dos outros terminais:** o `beforeAll` anota se a forma é "antes da B" (colunas e
tabela existem, o caso local) ou "já migrada" (CI); o `afterAll` afirma que, no primeiro caso, as duas colunas, a
tabela e a função **ainda existem** (nenhum teste pode ter aplicado a B de verdade no `bythiago_int`, nunca apagar
colunas de verdade ali). Local: `npx vitest run test/integration/ab-migration-b.test.ts`; no CI já é
`--no-file-parallelism`.

- [ ] **Passo 1: teste que falha.** `describe.skipIf(skipIfNoLocalDb())('Migration B (fixture)')`. **Toda semente com `original_description` fixa `created_at` explicitamente antes de 15/10 (a guarda R7 aborta o que nasce depois); o `aplicar duas vezes` herda a semente do caso 1:**
  - `'banco sem bloqueio: somem as duas colunas, a tabela e a função; ab_tests e ab_test_variants ficam'`: semente de 1
    teste `completed` com 2 variantes (`original_description = 'x'`, `created_at = '2026-10-01'`); `aplicar` → `colunaExiste(ab_tests, original_description)`
    `false`, `colunaExiste(ab_test_variants, description_text)` `false`, `tabelaExiste(ab_test_tracked_links)` `false`,
    `funcoes(create_playoff_test)` `0`, `select count(*) from ab_test_variants` `2`, e
    `insert into ab_test_variants (test_id, label, is_original, sort_order)` funciona.
  - `'aplicar duas vezes não dá erro'`: `aplicar`, `aplicar` → sem exceção; o mesmo estado final.
  - `'avisa quantos testes têm original_description'`: 2 testes com texto (`created_at` antes de 15/10) e 1 nulo; o `notice` capturado por
    `c.on('notice')` contém `'2 teste(s) com original_description'`.
  - `it.each` dos abortos; em cada um a mensagem contém `'Migration B abortada'` e o trecho indicado, e depois do
    `rollback to savepoint` as duas colunas, a tabela e a função **ainda existem**:
    | semente | trecho da mensagem |
    |---|---|
    | teste `active` | o id do teste e `(active)` |
    | teste `paused` | o id e `(paused)` |
    | teste `draft` com `parent_test_id` de um `completed` | `playoff vivo` e o id |
    | `tracked_links` com `source_type = 'ab_test'` | `1 link(s) de A/B` |
    | linha em `ab_test_tracked_links` (link com `source_type` padrão) | `1 linha(s) em ab_test_tracked_links` |
    | variante com `description_text = ''` | `1 variante(s) com description_text` e o id (string vazia não é nula) |
    | teste `completed` com `original_description = 'x'` e `created_at = '2026-10-16'` | `gravado depois da P3` e o id |
    | 25 testes `active` | `25 teste(s)` e exatamente 20 ids na mensagem (teto) |
    | sobrecarga criada na transação por `create function public.create_playoff_test(p_parent_test_id uuid) returns uuid language sql as 'select null::uuid'` | `assinatura inesperada (p_parent_test_id uuid)` |
  - `'não bloqueiam: playoff completed, teste queued, rascunho sem playoff'`: os três semeados → `aplicar` sem exceção.
  - `it.each` **`'lock ocupado: falha em ~5 s com 55P03 e nada muda'`**, uma linha por tabela presa: `ab_test_variants` e
    `tracked_links`. Estes casos não usam `-pre` nem `truncate` (o `ALTER` da `-pre` também pede lock). O primeiro cliente
    anota o estado do catálogo (as quatro funções do teste); um segundo `Client` faz
    `begin; lock table public.<tabela> in access share mode;` e fica aberto; o primeiro **abre `begin`**, e **antes** de
    aplicar o teste confirma que o segundo segura o lock
    (`select 1 from pg_locks where relation = 'public.<tabela>'::regclass and mode = 'AccessShareLock' and granted`,
    esperado 1 linha, lida pelo primeiro cliente); só então aplica a B, recebe `55P03` em menos de 8 s e dá `rollback` no
    `finally`; o catálogo está igual ao anotado; o segundo dá `rollback`. **Se a B não der erro, o teste falha** (e o
    `rollback` do `finally` a desfaz). Vale nos dois estados (local antes da B, CI depois), porque o `lock` é o primeiro
    comando do `DO`.
  - `'no banco já migrado (como o CI): a -pre devolve a forma de antes e a B roda igual'`: aplicar a B, depois a `-pre`,
    depois a B → estado final igual ao do primeiro caso.
- [ ] **Passo 2:** rodar contra o `bythiago_int` antes das fixtures existirem → falha por arquivo ausente.
- [ ] **Passo 3:** escrever as duas fixtures (o corpo acima, literal, e a `-pre`).
- [ ] **Passo 4 (verde):** `HAS_LOCAL_DB=1 ... npx vitest run test/integration/ab-migration-b.test.ts > /tmp/mb-t4.txt 2>&1; tail -15 /tmp/mb-t4.txt`
  → todos passam. Em seguida, o mesmo arquivo de novo (prova de que o `rollback` não deixou resto) e
  `youtube-channel-remove.test.ts` (prova de que o banco compartilhado segue na forma de antes).
- [ ] **Passo 5:** commit: `test: A/B Lab Migration B: SQL como fixture e prova no bythiago_int (abortos, idempotência, lock)`.

### Tarefa 5: portão do lote e envio 1

- [ ] **Passo 1:** suíte inteira do web com saída em arquivo (`npx vitest run > /tmp/mb-suite.txt 2>&1`, em background;
  no contexto só as falhas) e a integração do A/B contra o `bythiago_int` (`test/integration/ab-*`, um por vez).
  `npx tsc -p apps/web --noEmit` e `-p apps/api`.
- [ ] **Passo 2:** Phil e Yannis (Opus, `medium`) revisam o diff das Tarefas 1 a 4 (inclusive 1b) e a seção 4 deste plano (o que roda no
  dia B). Conserto (Sonnet, `medium`) até haver acordo; re-revisão de emenda em Sonnet.
- [ ] **Passo 3:** envio 1, dentro do orçamento de builds (≤ 3 pushes de `staging` por dia por terminal; não é push só de
  docs): `git fetch origin && git rebase origin/staging` em `W`; refazer o `git grep` da Tarefa 0;
  `bash -c 'git push origin lote/ab-mb:staging'`; CI verde (incluindo `test-db-integration`). A promoção a `main` vai na
  combinada do dia; a B **não** a exige, porque o código de `main` desde `55ea62df6` não lê os objetos (Review Focus 5).

## 4. O dia B (Tarefa 6) e o dia seguinte (Tarefa 7)

### Tarefa 6: portão, `pg_dump`, migration, aplicação, D+0

- [ ] **Passo 1: G0, pré-condições sem banco.** Agora ≥ 22/10/2026 07:02 UTC.
  `git merge-base --is-ancestor 3f1bc2482 origin/main && echo P3-na-main`. Envio 1 em `origin/staging` com CI verde.
  Fila (`fila-do-db-push.md`, seção 1) sem linha de bloqueio pendente (MG16/17 ou outra destrutiva). A linha "MG15
  pendente" é velha: `20261016000001` já está em `schema_migrations`. Regra geral: cada linha "pendente" é conferida
  contra `schema_migrations`; aplicada e sem marca → pedir ao controlador da A5 que a marque `RESOLVIDA`, não parar nem
  seguir por ela. **Migration 0** (emenda 35: a B vem "sempre depois da Migration 0"): conferir a versão dela em
  `schema_migrations` (hoje aplicada; item de conferência, não de espera). **Deploy de reserva da Vercel** (o de produção
  anterior ao atual): `git grep -n -E "original_description|ab_test_tracked_links|create_playoff_test" <sha> -- apps/web/src ':!apps/web/src/types/database.types.ts'`
  → só `_Cobre`/destructure de `services/youtube.ts` e nenhum `from('ab_test_tracked_links')` nem `insert` com
  `original_description`; se o reserva for anterior a `55ea62df6`, o dono é avisado **antes** do `pg_dump`. `ab-rotate` e
  `ab-evaluate` sem erro em 7 dias, pelo Sentry (`SENTRY_READ_TOKEN`, `statsPeriod=7d`, `query=ab-rotate` e depois
  `ab-evaluate`), **com controle positivo** (`level:warning` devolve evento). Falso verde declarado: com zero teste
  ativo, isso prova só que o cron não quebrou.
- [ ] **Passo 2: G1 a G8, portão de dado** (só `select`, por `npx supabase db query --linked -o json`; se o modo
  automático negar, o controlador põe as consultas em `.superpowers/sdd/ab-lab/migration-b/portao.sh` e manda ao dono
  `bash .superpowers/sdd/ab-lab/migration-b/portao.sh`). Saída no ledger **antes** do `pg_dump`.
  ```sql
  -- G1, testes em andamento ou pausados. Esperado: nenhuma linha
  select id, status, test_type from ab_tests where status in ('active', 'paused');
  -- G2, playoff vivo. Esperado: nenhuma linha
  select id, status, parent_test_id from ab_tests
   where parent_test_id is not null and status in ('draft', 'queued', 'active', 'paused');
  -- G3, links de A/B. Esperado: 0, 0, 0
  select (select count(*) from tracked_links where source_type = 'ab_test') as links_ab,
         (select count(*) from ab_test_tracked_links) as ligacoes,
         (select count(*) from link_clicks lc join tracked_links tl on tl.id = lc.link_id where tl.source_type = 'ab_test') as cliques;
  -- G4, descrição. Esperado: variantes_com_desc = 0; testes_com_original = 2 (21/10); depois_da_p3 = 0
  select (select count(*) from ab_test_variants where description_text is not null) as variantes_com_desc,
         (select count(*) from ab_tests where original_description is not null) as testes_com_original,
         (select count(*) from ab_tests where original_description is not null
             and created_at >= '2026-10-15 07:02:00+00') as depois_da_p3;
  -- G4b, o texto que sai tem cópia na coleta. Esperado: uma linha por teste com original, copias >= 1
  select t.id, (select count(*) from yt_own_video_meta_daily m
                 where m.youtube_video_id = v.youtube_video_id
                   and md5(m.description_text) = md5(t.original_description)) as copias
    from ab_tests t join youtube_videos v on v.id = t.youtube_video_id
   where t.original_description is not null;
  -- G5, linha de base para o D+0 (21/10: 3, 7, ciclos e links a anotar; links só cresce, o D+0 compara com >=)
  select (select count(*) from ab_tests) as testes, (select count(*) from ab_test_variants) as variantes,
         (select count(*) from ab_test_cycles) as ciclos, (select count(*) from tracked_links) as links;
  -- G6, a função. Esperado: uma linha, p_parent_test_id uuid, p_variant_ids uuid[], p_cooldown_hours integer
  select pg_get_function_identity_arguments(oid) from pg_proc
   where proname = 'create_playoff_test' and pronamespace = 'public'::regnamespace;
  -- G7, quem mais cita os objetos. Esperado: nenhuma linha
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname <> 'create_playoff_test'
     and p.prosrc ~ '(original_description|ab_test_tracked_links|description_text)';
  -- se aparecer função de yt_own_video_meta_daily (description_text de outra tabela), classificar no ledger
  select distinct c.relname from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class c on c.oid = r.ev_class
   where d.refobjid in ('public.ab_tests'::regclass, 'public.ab_test_variants'::regclass, 'public.ab_test_tracked_links'::regclass)
     and c.relname not in ('ab_tests', 'ab_test_variants', 'ab_test_tracked_links');
  -- G8, última migration aplicada (anotar)
  select version from supabase_migrations.schema_migrations order by 1 desc limit 3;
  ```
  Qualquer esperado que falhe: **para**, sem `pg_dump` e sem `db:new`. G1 ou G2 → esperar o teste acabar (a B espera o
  ciclo). G3 > 0 → o dono decide o destino dos links e dos cliques (P3 §12.1). G4 variantes > 0 → o dono decide (D6); G4 `depois_da_p3` > 0 → o dono decide (o texto não estaria no dump); `testes_com_original` diferente de 2 ou G4b com `copias` 0 → anotar no ledger e contar ao dono (não é parada; a B só avisa).
  G6 diferente → Yannis revisa a guarda. G7 com linha → o objeto entra no plano (r2).
- [ ] **Passo 3: `pg_dump`, do dono.** Mensagem ao dono (um por linha; a senha do banco está no 1Password, e o `pg_dump`
  pede a senha):
  ```bash
  mkdir -p ~/Backups/ab-lab
  pg_dump "postgresql://postgres.novkqtvcnsiwhkxihurk@aws-1-sa-east-1.pooler.supabase.com:5432/postgres" -Fc -t public.ab_tests -t public.ab_test_variants -t public.ab_test_tracked_links -f ~/Backups/ab-lab/ab-antes-da-migration-b.dump
  ```
  O caminho é a proposta do controlador; o dono pode trocar e diz onde ficou (aceite §6). **Retenção:** o arquivo (~200 kB,
  sem dado pessoal: títulos e descrições públicos e URLs de blob) fica em `~/Backups/ab-lab/` até o D+30; depois o dono
  decide; nunca no repositório nem no NAS compartilhado. A definição de
  `create_playoff_test` não entra no `pg_dump -t`; ela está em `supabase/migrations/20260529000001_playoff_mode.sql:29-134`,
  no git.
- [ ] **Passo 4: conferência do `pg_dump`** (controlador, leitura local):
  `ls -l ~/Backups/ab-lab/ab-antes-da-migration-b.dump` (> 0);
  `pg_restore -l ~/Backups/ab-lab/ab-antes-da-migration-b.dump | grep -c "TABLE DATA public"` → `3`;
  `pg_restore -f - ~/Backups/ab-lab/ab-antes-da-migration-b.dump | awk '/^COPY public\./{t=$2;n=0;next} /^\\\.$/{if(t)print t, n; t=""} t{n++}'`
  → as contagens do G5 (`ab_tests 3`, `ab_test_variants 7`, `ab_test_tracked_links 0` em 21/10) e
  `pg_restore -f - ... | grep -c original_description` ≥ 1. Saída no ledger, com o caminho do arquivo. **Sem isso, não
  há `db:new`.**
- [ ] **Passo 4b: ensaio de restauração** (obrigatório antes do `db:new`; controlador, só no `bythiago_int` 54422, nunca
  no 54322 nem em produção; as três tabelas não usam tipo próprio nem default com função, então `pre-data` + `data`
  restaura num banco vazio, e FKs e policies, que ficam no `post-data`, se pulam):
  ```bash
  psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "drop database if exists ab_mb_ensaio"
  psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "create database ab_mb_ensaio"
  pg_restore --section=pre-data --section=data --no-owner --no-acl -d postgresql://postgres:postgres@127.0.0.1:54422/ab_mb_ensaio ~/Backups/ab-lab/ab-antes-da-migration-b.dump
  psql postgresql://postgres:postgres@127.0.0.1:54422/ab_mb_ensaio -c "select (select count(*) from public.ab_tests) t, (select count(original_description) from public.ab_tests) o, (select count(*) from public.ab_test_variants) v"
  psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "drop database ab_mb_ensaio"
  ```
  Esperado: `t` e `v` iguais ao G5 (3 e 7), `o = 2`. Saída no ledger. O passo é reexecutável (o `drop database if exists` da primeira linha limpa rodada interrompida). O `pg_restore` pode imprimir `schema "public" already exists` em `pre-data`: esperado, ignorável; vale o `select`, não o código de saída. O `drop database` final roda mesmo se o `select` falhar.
- [ ] **Passo 5: o arquivo.** Em `W`: `git fetch origin && git rebase origin/staging`; maior carimbo de `origin/staging`
  e das árvores ativas (`ls ~/Workspace/wt-*/supabase/migrations ~/Workspace/bythiago-*/supabase/migrations 2>/dev/null | grep -E '^[0-9]{14}' | sort | tail -1`);
  se houver número reservado na fila maior que esse, esperar o arquivo dele chegar a `origin/staging` (regra da F0).
  `npm run db:new ab_drop_descricao`; `cp apps/web/test/integration/fixtures/ab-migration-b.sql supabase/migrations/<carimbo>_ab_drop_descricao.sql`;
  `cmp` das duas sem saída; `ls supabase/migrations | cut -c1-14 | sort | uniq -d` vazio. Acrescentar à seção 1 da fila:
  `- (<AAAA-MM-DD HH:MM> UTC) A/B Migration B pendente: db push bloqueado (arquivo <carimbo>_ab_drop_descricao.sql em lote/ab-mb; destrutiva e irreversível; pg_dump em <caminho>; aplicação pelo dono por aplicar-migration-b.sh na janela)`.
  Avisar o controlador da A5 (a fila é dele também) antes do push.
- [ ] **Passo 6: envio 2** (**no máximo 2 h antes da janela, no mesmo dia, e só se o CI couber antes dela**; janela
  perdida → a linha da fila ganha hora de retomada, ou o arquivo é revertido, seção 5). Commit só do arquivo da migration:
  `feat: A/B Lab Migration B: apaga original_description, description_text, ab_test_tracked_links e create_playoff_test`.
  `bash -c 'git push origin lote/ab-mb:staging'`; CI verde. O `test-db-integration` agora roda **sobre a B aplicada**:
  é a prova de que nenhum teste de integração depende do que saiu.
- [ ] **Passo 7: aplicação, do dono, na janela** (proposta: 21:25 a 21:35 UTC, 18:25 a 18:35 em São Paulo, num dia útil
  a partir de 22/10). O controlador escreve `.superpowers/sdd/ab-lab/migration-b/aplicar-migration-b.sh`, que roda **no
  checkout de `W`** e faz: `git fetch origin && git rebase origin/staging` **imediatamente antes** (se outra migration
  foi aplicada entre o passo 5 e este e o arquivo dela não está em `W`, o `db push` recusa por versão remota ausente);
  `npx supabase db push --linked --dry-run`, mostrando a lista; para se a lista não for
  **exatamente** `<carimbo>_ab_drop_descricao.sql`; depois `npm run db:push:prod` (o `YES` é do dono); por fim, as
  consultas do passo 8, com saída em `.superpowers/sdd/ab-lab/migration-b/saidas/`. Mensagem ao dono:
  `bash .superpowers/sdd/ab-lab/migration-b/aplicar-migration-b.sh`, com a frase: "a lista do push tem **um** arquivo,
  `..._ab_drop_descricao.sql`; se tiver mais, responda não". Se a B abortar (exceção), nada mudou: o controlador lê a
  mensagem, decide pela tabela do passo 2, e a linha da fila fica pendente **com prazo**: se a causa não sumir em 24 h, `git revert` do
  arquivo no próximo push de código e a linha vira "arquivo retirado"; a B volta a nascer com número novo no dia em que o
  portão passar (seção 5).
- [ ] **Passo 8: D+0** (logo depois, pelo script ou pelo controlador):
  ```sql
  -- esperado: nenhuma linha
  select table_name, column_name from information_schema.columns where table_schema = 'public'
     and ((table_name = 'ab_tests' and column_name = 'original_description')
       or (table_name = 'ab_test_variants' and column_name = 'description_text'));
  -- esperado: null e 0
  select to_regclass('public.ab_test_tracked_links') as tabela,
         (select count(*) from pg_proc where proname = 'create_playoff_test') as funcoes;
  -- esperado: testes, variantes e ciclos iguais ao G5; links >= G5 (o Links Engine e a newsletter criam links o dia todo)
  select (select count(*) from ab_tests) as testes, (select count(*) from ab_test_variants) as variantes,
         (select count(*) from ab_test_cycles) as ciclos, (select count(*) from tracked_links) as links;
  -- esperado: o carimbo da B no topo
  select version from supabase_migrations.schema_migrations order by 1 desc limit 3;
  -- a prévia de remoção de canal responde (função de leitura; ids do canal próprio)
  select public.youtube_channel_removal_impact(c.site_id, c.id) from youtube_channels c order by c.created_at limit 1;
  ```
  E pelo app, com a chave do Claude Code (nunca a `PIPELINE_COWORK_KEY`):
  `curl -s -o /dev/null -w '%{http_code}' -H "X-Pipeline-Key: <chave>" https://bythiagofigueiredo.com/api/pipeline/youtube/ab-tests`
  → `200`, e o corpo lista 3 testes. O `go.*` segue vivo (a B pegou lock em `tracked_links`):
  `curl -s -o /dev/null -w '%{http_code}' https://go.bythiagofigueiredo.com/<code de um link vivo>` → `30x`. Pelo MCP: `manage_ab_test` `get_test` de um dos 3 → sucesso, sem `original_description`.
  Tela: Gio (Sonnet, `medium`) abre `/cms/youtube/ab-lab` e o detalhe de um teste encerrado em produção autenticada; sem
  sessão, o dono por `open -a Opera https://bythiagofigueiredo.com/cms/youtube/ab-lab`. Esperado: a lista e o detalhe
  abrem sem erro. Depois de tudo verde: a linha da fila vira `RESOLVIDA (<data hora> UTC, aplicada em produção; D+0 ok)`;
  ledger com as saídas e a frase "o rollback da Vercel para deploy anterior a `55ea62df6` quebra" (aceite §6).
- [ ] **Passo 9: rollback, por escrito.** No plano da P3 (§9), acrescentar a linha: "Depois da Migration B: ver
  `2026-10-21-ab-lab-migration-b-plan.md` §5." Conferir **de novo**, depois da aplicação, o deploy de reserva da Vercel
  que de fato ficou (o de produção anterior ao atual; o G0 já conferiu o de antes): `git grep -n -E "original_description|ab_test_tracked_links|create_playoff_test" <sha> -- apps/web/src ':!apps/web/src/types/database.types.ts'`
  → só o `_Cobre`/destructure de `services/youtube.ts`, nenhum `from('ab_test_tracked_links')` nem `insert` com
  `original_description`. Commit de docs junto do próximo push de código (sem push só de docs).

### Tarefa 7: D+1

- [ ] **Passo 1:** no dia seguinte, depois das 08:00 UTC (`ab-rotate`) e das 12:00 UTC (`ab-evaluate`): Sentry sem
  evento novo de `ab-rotate`, `ab-evaluate` ou `ab-watchdog` (com controle positivo) e `/api/health` sem falha desses
  crons. Falso verde declarado: zero teste ativo; a prova é que o cron não quebrou.
- [ ] **Passo 2:** Sentry sem `column ... does not exist` nem `relation "ab_test_tracked_links" does not exist` desde a
  aplicação (`query="does not exist"`, `statsPeriod=2d`).
- [ ] **Passo 3:** o mesmo `select` de contagens do D+0 → igual. Ledger fechado; P3 §12 marcado como pago.

## 5. Como se reverte

- **Antes do envio 2:** `git revert` dos commits das Tarefas 1 a 4 (inclusive 1b), em ordem inversa. O banco não mudou.
- **Depois do envio 2 e antes do `db:push:prod`:** `git revert` do commit da migration (envio próprio). A linha da fila
  vira "arquivo retirado". **Regra de tempo:** B abortada cuja causa não some em 24 h → `git revert` do arquivo no próximo
  push de código; a B volta a nascer com `db:new` e número novo no dia em que o portão passar. A fila armada nunca fica
  pendente sem prazo.
- **Depois da aplicação: irreversível pelo caminho normal.** Não há ALTER inverso que traga os dados. A volta possível
  é manual: recriar colunas, tabela e função (a `-pre` mostra a forma; a função real está em `20260529000001`),
  restaurar os dados do `pg_dump` numa tabela temporária (`pg_restore --data-only -t ab_tests -f -` mais `update ... from`)
  e regravar `original_description`. A **restauração do arquivo é ensaiada** (passo 4b); a regravação em produção
  (`update ... from`) continua sem ensaio e só com plano próprio, se o dono pedir.
- **ALTER inverso da Migration A** (P3 §9): deixa de ter sentido depois da B, porque o deploy anterior à P3 quebra de
  qualquer jeito.
- **Rollback instantâneo da Vercel:** para deploys de `55ea62df6` (15/10) em diante, funciona. Para deploys anteriores,
  quebra: criar teste grava `original_description`, e o funil e o detalhe leem `ab_test_tracked_links`.

## 6. O que acontece quando o dado não existe, e em cada falha

| Situação | Resultado |
|---|---|
| Teste `active`/`paused` no instante do push | a B aborta com a contagem e até 20 ids; nada muda; a fila fica pendente por no máximo 24 h, depois `git revert` do arquivo |
| `original_description` gravado depois da P3 | aborta (o texto não estaria no `pg_dump`) |
| Playoff `draft`/`queued` | aborta (G2); o dono arquiva ou espera |
| Link de A/B criado depois do G3 | aborta (só a B saberia; o código não cria desde a P3) |
| `ab_test_tracked_links` já não existe (B aplicada antes) | as guardas pulam essa parte; `drop ... if exists`; sem erro |
| Coluna já apagada | `v_tem_desc`/`v_tem_orig` falsos; o `execute` não roda; `drop column if exists` |
| Sobrecarga de `create_playoff_test` | aborta com a assinatura na mensagem |
| Lock por mais de 5 s (inclusive `tracked_links`, lida pelo `go.*`) | `55P03`; nada muda; tenta-se noutra janela. Enquanto espera, `/go/*` fica na fila por até 5 s |
| Deadlock (`40P01`) ou lock negado (`55P03`) na B | aborto limpo, sem perda de dado (rollback inteiro); repetir na próxima janela; o script do dono imprime o código de erro |
| Outro terminal empurra a B junto | a B roda com as mesmas guardas; o `pg_dump` já existe; o controlador confere o D+0 assim que vir |
| `pg_dump` vazio ou sem as três tabelas | sem `db:new` (passo 4) |
| CI vermelho no envio 2 | não se aplica; o defeito é corrigido em `W`; nada em produção |
| Cowork manda `description_text` com texto | 422 de sempre (D2) |
| Cowork lia `original_description` do `GET` | já não vinha desde a P3 (lista fechada); nada muda |

## 7. Para o dono

| Quando | O que ele faz | Quanto tempo |
|---|---|---|
| Agora | ler este plano e dar o "pode" descritivo: "pode executar as Tarefas 0 a 5 (código, testes, fixture e envio 1); não libera `db:new` nem produção" | 10 min |
| Dia B, depois do portão G0-G8 verde (a partir de 22/10 07:02 UTC) | rodar as duas linhas do `pg_dump` (Tarefa 6, passo 3) e dizer onde ficou o arquivo | 5 min |
| Dia B, depois do envio 2 com CI verde, na janela | `bash .superpowers/sdd/ab-lab/migration-b/aplicar-migration-b.sh` e `YES` se a lista tiver um arquivo só | 5 min |
| Se não houver sessão autenticada do Gio | abrir o A/B Lab no Opera e dizer se abriu | 2 min |

Tudo o mais (consultas, conferência do `pg_dump`, fila, envios, D+0, D+1) é do controlador. Cada comando vai ao dono
**no dia**, não antes.

## 8. Riscos que ficam

- **O texto de `original_description` dos 2 testes que o têm sai do banco** e fica no `pg_dump` e **também** em
  `yt_own_video_meta_daily` (G4b: perda real hoje, zero). É a descrição do vídeo no dia em que o teste nasceu; a do ar
  nunca mudou (P3, C1).
- **Dado restaurável ensaiado** (passo 4b); a regravação em produção (`update ... from`) continua sem ensaio, só com
  plano próprio.
- **Durante a B, `ab_tests`, `ab_test_variants` e `tracked_links` ficam presos** por milissegundos; a espera pelo `lock`
  é de até 5 s por tabela, e o `/go/*` espera na fila nesse tempo (nada se perde).
- **O teste de lock depende de tempo** (~5 s); no CI lento, o teto de 8 s pode ficar apertado. Se falhar por tempo,
  subir o teto, não o `lock_timeout`.
- **Linhas citadas deslocam**; a Tarefa 0 refaz o inventário.
- **A janela pode não existir** se outra destrutiva armar a fila. A B espera; nada no produto depende dela.

## 9. Decisões da r2

Revisão r1: Phil 84, Yannis 84, ambos "aprovado com ressalvas". Rulings do controlador aplicados em bloco.

| # | Decisão | Origem |
|---|---|---|
| R1 | **D3 cai.** A emenda 35 do spec é a autoridade: `ab-playoff.ts` (sem importador em `src`) sai na Tarefa 1 e `phaseAutoStartPlayoffs` na nova Tarefa 1b, com testes, no envio 1, antes da B. As telas de playoff ficam | ruling; Phil I4, Yannis I1 |
| R2 | "2 de 3" com `original_description` (era 3 de 3) em todos os lugares; G4 esperado 2; G4b de cópia em `yt_own_video_meta_daily` | Phil I1 |
| R3 | Passo 4b: ensaio de restauração do `pg_dump` no `bythiago_int` (os 4 comandos de Phil) | Phil I2, Yannis (ensaio) |
| R4 | Envio 2 no máximo 2 h antes da janela; B abortada sem causa removida em 24 h → `git revert` do arquivo; `fetch && rebase` imediatamente antes do dry-run (no script) | Phil I3, Yannis M5 |
| R5 | `lock` inicial inclui `tracked_links`; caso novo de teste (lock em `tracked_links`); Review Focus 4 e seção 6 citam o `go.*`; D+0 confere um `/go/` com `30x` | Yannis I2, Phil M5 |
| R6 | Teste de lock com `begin`/`rollback`, confirmação por `pg_locks`, falha se a B não errar; `afterAll` de guarda e de limpeza; nunca apagar colunas de verdade no `bythiago_int` | Phil I5, Yannis I3, M7 |
| R7 | Guarda de `original_description` gravado depois da P3 (aborta), com caso de teste | Phil M2 |
| R8 | G7 com regex largo (`description_text`) e classificação no ledger | Phil M3 |
| R9 | D+0: `links >= G5`, as outras contagens iguais | Phil M4 |
| R10 | Retenção do backup: até D+30, depois o dono decide, nunca no repositório nem no NAS | Phil M6 |
| R11 | G0 confere cada linha "pendente" da fila contra `schema_migrations` (MG15 aplicada) e a Migration 0 | Phil M1, M7 |
| R12 | `-pre` com `default 4`; caso "sobrecarga" cria `create_playoff_test(p_parent_test_id uuid)` e espera `assinatura inesperada (p_parent_test_id uuid)` | Yannis M1, M2 |
| R13 | Tarefa 2: motivação corrigida; `as VariantRow[]` mantido; sem `it` de leitura de texto de `services/youtube.ts`; `CAMPOS_DA_VARIANTE` não exportada | Yannis M3 |
| R14 | Mensagens de aborto: contagem total e até 20 ids | Yannis M4 |
| R15 | Deploy de reserva conferido no G0 (antes do `pg_dump`) **e** de novo depois da aplicação | Yannis M6 e ruling |

**Conflitos decididos.** (1) Modo do lock em `tracked_links`: Phil propôs `share row exclusive`, Yannis `access exclusive`
(sondado: o `drop table` pede esse modo). Vale **`access exclusive`**, no mesmo `lock` das outras duas tabelas, porque o
modo menor não tira a espera do fim. (2) Onde conferir o deploy de reserva: Yannis no G0, o ruling também depois da
aplicação; vale **os dois**. (3) Teste de lock em `tracked_links`: entra como linha do `it.each`, não como teste à parte.

## Fecho da r2: Phil 93, Yannis 90; N1/N2 dos dois aplicados

- Yannis N1: semente com `original_description` fixa `created_at` antes de 15/10 (Tarefa 4). Yannis N2: asserção `not.toHaveProperty('playoffs_started')` e `totalErrors` sem `playoffs.errors` (Tarefa 1b).
- Phil N1: passo 4b reexecutável (`drop database if exists`, aviso `schema "public" already exists` ignorável). Phil N2: `40P01` e `55P03` = aborto limpo (seção 6).
