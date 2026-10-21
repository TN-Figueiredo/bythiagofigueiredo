# A/B Lab: original em alta resolução (plano de implementação, r2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 19/10/2026. r2 (Sonnet) sobre a r1 (`a5d7d33eb`) com os achados de Phil e Yannis; ver "Decisões da r2" no fim. Antes do portão de Gio e da re-revisão. O dono aprovou o mockup e as decisões
1 a 7; **não** liberou executar nem enviar. O 5º caso de D (D13) espera o dono e está isolado na Tarefa 19.

**Goal:** o dono envia o arquivo original da thumbnail (1280 de largura ou mais, 16:9, até 2 MB); ele vira a A que
restaura o vídeo em toda volta, e um teste com a cópia pública baixa (< 1280) não inicia sem esse envio.

**Architecture:** coleta primeiro: tabela `ab_test_originais` (uma linha por cópia guardada ou envio tentado) e dois
ponteiros em `ab_tests`. Uma função SQL (`ab_registrar_original` sobre `ab_aplicar_original`) registra e aplica numa
transação e reescreve as colunas que todo o código já lê (`original_thumbnail_url`, `blob_url`/`dimensions`/
`thumbnail_dhash`/`file_size_bytes` da variante `is_original`), então settle, rotação, retomada e playoff usam a
enviada sem mudar. O envio é uma rota HTTP multipart (progresso e `abort` por XHR) que chama `enviarOriginal` em `lib`,
com validação e limpeza de metadados próprias sobre os bytes (sharp). O início ganha a guarda no servidor; a
restauração ganha a reserva pública quando a enviada some do Blob.

**Tech Stack:** Next.js 16 (rota `nodejs`, server actions), TypeScript estrito, sharp 0.35.5, Vercel Blob, Supabase
(Postgres 17; integração no `bythiago_int` 54421/54422), Vitest, Playwright (Gio).

**Spec:** `docs/superpowers/specs/2026-10-19-ab-original-em-alta-design.md` (r6, emenda do plano r2); a seção "Para o
plano" virou as tarefas marcadas `[PP-n]`. Mockup aprovado: `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/`
(`index.html` + `README.md`, `85f6fe105`; capturas `shots/r4-*.png`). Decisões do dono:
`.superpowers/sdd/ab-lab/original-em-alta/decisoes-dono.md`.

> **Para quem executa:** `superpowers:subagent-driven-development`, tarefa por tarefa, agente `executor` (Sonnet,
> `medium`). Tarefas 20 (prova local) e o portão: Gio (Sonnet, `medium`); Phil e Yannis (Opus, `medium`) no portão.
> Ledger: `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar na Tarefa 0).

> **Abreviações:** `W` = `~/Workspace/bythiago-ab-s7` (branch `lote/ab-p4b-a`); `AB` =
> `apps/web/src/app/cms/(authed)/youtube/ab-lab`; `Y` = `apps/web/src/lib/youtube`; `T` = `apps/web/test`;
> `M` = a migration nova (`supabase/migrations/<carimbo>_ab_original_em_alta.sql`, criada na Tarefa 2).

## Global Constraints

- `LARGURA_ALTA = 1280`: limiar de "baixa" **e** mínimo do envio, sem outra constante (D1, D3). Baixa = largura nula, 0, ilegível ou < 1280.
- 16:9 com tolerância de 1%: `|L/A − 16/9| / (16/9) > 0,01` recusa.
- `MAX_BYTES = 2 * 1024 * 1024`; `LIMITE_PIXELS = 16_000_000` (constante única em `.metadata()` e em todo processamento).
- Formato lido dos **bytes** (sharp), nunca de `file.type`: JPG, PNG, GIF; GIF guardado como PNG do 1º quadro.
- Nunca `processImage` de `lib/media/process.ts`; reusa só `computeContentHash` (`lib/media/hash.ts`) e `sanitizeFilename` (`lib/media/validation.ts`, corte em 120 caracteres).
- Envio/troca só com o teste em `draft`, `paused` ou `queued`; `active` só pelo início, com `p_restore_seq`.
- O envio não chama o YouTube (D10): nenhum `fetch` a `googleapis.com`.
- Nenhuma linha `aceito` existe sem ter sido vigente; nenhuma linha `recusado` tem `blob_url`/`blob_pathname`.
- `largura`/`altura` nunca gravam 0: nulas quando não medidas.
- Funções SQL de escrita: `security definer`, `set search_path = public`, `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;`. Nunca chamar no `bythiago_int` como `anon`/`authenticated` (SIGSEGV): testar com `has_function_privilege`.
- Migration só por `npm run db:new ab_original_em_alta`; `drop policy if exists`/`create or replace function`/`if not exists`.
- Textos de recusa: o servidor devolve a `mensagem` pronta e **sem o prefixo "Com a pública baixa,"** do mockup [PP-6].
- Testes de sharp e de sanitização: `// @vitest-environment node`. Fixtures temporais relativas.
- Build no worktree: `next build --webpack`. Commit por caminho explícito; proibido `stash`, `reset` e `push` sem o portão.

## Review Focus

1. **Arquivo de celular com `Orientation = 6` e GPS** (o caso mais comum do dono): sai em pé, sem GPS e em até 2 MB pela escada. Teste na Tarefa 6.
2. **Rascunho reaberto depois de um envio que terminou no servidor mas caiu na tela** (abort tardio): a tela relê e mostra C, não B. Teste na Tarefa 16.
3. **Pública que vira alta no YouTube entre a criação e o início** (o dono subiu a maxres depois): o início segue e registra a nova pública, sem exigir envio. Teste na Tarefa 11.
4. **Dois cliques em "Enviar" com o mesmo arquivo** (duas abas): duas linhas, a segunda vigente, nenhum erro; mesma aba com o mesmo arquivo: nenhuma linha nova. Teste na Tarefa 8.
5. **Teste legado com `blob_url` fora do Vercel Blob e `dimensions` nulo** (2 dos 3 de produção): a ficha e o diálogo mostram "baixa", nada quebra ao ler, e o backfill não inventa dimensão. Teste na Tarefa 2.

---

## 1. Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `Y/ab-original-resolucao.ts` (novo) | constantes, `publicaBaixa`, `dimensoesDeTexto`, `proporcaoOk`, `ehQuatroPorTres` |
| `Y/ab-original-jpeg.ts` (novo) | `removerMetadadosJpeg`, `temBytesDepoisDoEoi` (puras, sobre marcadores) |
| `Y/ab-original-envio.ts` (novo) | `validarArquivoDaOriginal`, `mensagemDaRecusa`, `enviarOriginal` (portas), tipos de recusa |
| `Y/ab-original-leitura.ts` (novo) | `IOriginalDoTeste`, `montarOriginalDoTeste` (pura), `SELECT_ORIGINAIS` (fragmento de select das duas FKs) |
| `Y/ab-original-xhr.ts` (novo, cliente) | `enviarOriginalXhr`, `removerOriginalFetch` |
| `Y/ab-envio-original-reducer.ts` (novo) | estado e ações do envio, `podeAvancarComOriginal` |
| `apps/web/src/app/api/youtube/ab-tests/[id]/original/route.ts` (novo) | `POST`/`DELETE` |
| `AB/_components/original-do-teste.tsx` (novo) | bloco do passo Variantes (estados A–F) |
| `AB/_components/original-guardada.tsx` (novo) | linha da ficha (H) |
| `M` (nova) | tabela, colunas, RLS, quatro funções, `create_playoff_test`, backfill |
| `Y/ab-variant-dhash.ts`, `Y/thumb-fingerprint.ts` | `guardarOriginalMaior` devolve `copia` e dimensões nulas |
| `AB/actions.ts` | `createAbTest`, `batchStartTests` registram a pública; `obterOriginalDoTeste` |
| `AB/queries.ts` | `lerOriginalDoTeste`, objeto na lista e no detalhe |
| `Y/ab-start.ts` | guarda do início, passo 2 contra a pública, `codigo` |
| `Y/ab-rotate-phases.ts` | fila sai na hora com `original_baixa`; 404 da enviada pausa |
| `Y/ab-settle.ts`, `Y/ab-restore.ts`, `Y/ab-restore-avisos.ts` | reserva, `MotivoSaida`, aviso |
| `Y/ab-resume.ts` | erro específico do 404 da enviada |
| `AB/_components/encerrar-props.ts` | regra única |
| `AB/_components/ab-create-wizard.tsx`, `AB/_components/step-variantes.tsx`, `AB/_components/step-revisar.tsx`, `Y/ab-wizard-reducer.ts` | assistente |
| `apps/web/src/lib/pipeline/services/youtube.ts`, `apps/web/data/pipeline-docs/cowork-docs-youtube.md` | paridade Cowork/MCP |

## 2. Fatos conferidos no código (W, `5e581375b`)

- O assistente usa o reducer **inline** de `AB/_components/ab-create-wizard.tsx` (`WizardState` :75, `wizardReducer` :166, `stepIsValid` :240); `Y/ab-wizard-reducer.ts` é cópia reexportada por `AB/_components/wizard-reducer.ts`. Por isso o estado do envio vai num módulo próprio (`Y/ab-envio-original-reducer.ts`) que os dois `stepIsValid` chamam.
- `guardarOriginalMaior` (`Y/ab-variant-dhash.ts:79-92`) devolve `meta.width ?? 0`; `biggerCopy` (`Y/thumb-fingerprint.ts:83`) tenta `maxresdefault` e `sddefault`, e o cair para `probeThumb` é a `hqdefault`.
- `createAbTest` só guarda a pública quando `thumbnail_hq_url` é de `ytimg|ggpht|googleusercontent` (`AB/actions.ts:250`); fora disso grava a URL crua. Esses testes recebem a linha por `ab_garantir_original_publica` (marca `backfill`).
- `startAbTestInternal` devolve `{ ok, error? }` (`Y/ab-start.ts:196-200`); `comThumb` é definido depois da reivindicação (:302); o passo 2 regrava por `update` sem guarda de seq (:333-337).
- `phaseProcessQueue` (`Y/ab-rotate-phases.ts:97-135`) zera `queue_start_after` ao reivindicar e chama `adiarInicioDaFila` em toda falha.
- `fonteDoOriginal` (`Y/ab-settle.ts:107`) é privada; o thumbnail é lido em `restaurarCampos` (:404-417) por `fetchVariantImageBuffer`.
- `caminhoDe('falha_api')` → `{ de: ['active'], para: 'paused', endReason: 'falha_api' }` (`Y/ab-settle.ts:151-157`); o check `ab_test_cycles_end_reason_check` (`20261018000004_ab_lab_s8_f1_gravacao.sql:149-151`) aceita `falha_api`. **[PP-7] confirmado: nenhum check muda.**
- Retomada: o `!aplicado.ok` devolve `erro(aplicado.error ?? MSG_YOUTUBE_NAO_ACEITOU)` (`Y/ab-resume.ts:223`); `aplicado.erroApi` vem de `Y/ab-apply.ts:128`.
- Precedente da rota: `apps/web/src/app/api/youtube/poll-stats/route.ts` (`getSiteContext` + `requireSiteScope`). Precedente de RLS com GUC falsificado: `T/integration/observatorio-a5-e10-rls.test.ts:60-75` (`pg`, `set local role authenticated`).
- Projeção do pipeline por lista fechada (`apps/web/src/lib/pipeline/services/youtube.ts:991`): `original_vigente_id`/`original_publica_id` não vazam sem decisão.

## 3. Comandos comuns

Em toda tarefa, antes do commit (saída em arquivo; no contexto só as falhas):

```bash
cd ~/Workspace/bythiago-ab-s7/apps/web
npx vitest run test/youtube test/ab-*.test.ts test/ab-*.test.tsx > /tmp/oea-tN.log 2>&1; tail -30 /tmp/oea-tN.log
npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log   # esperado: 0
```

Integração:

```bash
cd ~/Workspace/bythiago-ab-s7/apps/web
HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_URL=http://127.0.0.1:54421 \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  npx vitest run --no-file-parallelism test/integration/ab-original-*.test.ts > /tmp/oea-int.log 2>&1; tail -30 /tmp/oea-int.log
```

Aplicar `M` no `bythiago_int` (reaplicável; `M` é idempotente):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -v ON_ERROR_STOP=1 -f ~/Workspace/bythiago-ab-s7/supabase/migrations/<carimbo>_ab_original_em_alta.sql
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "insert into supabase_migrations.schema_migrations(version) values ('<carimbo>') on conflict do nothing"
```

Commit: `git -C ~/Workspace/bythiago-ab-s7 add <arquivos> && git -C ~/Workspace/bythiago-ab-s7 commit -m "<tipo>: <descrição>" -- <arquivos>`.

---

## 4. As tarefas

### Tarefa 0: linha de base

**Files:** `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar).

- [ ] **Passo 1:** `git -C ~/Workspace/bythiago-ab-s7 status --short` sem modificações rastreadas além de `shots/`; anotar o sha de `HEAD` no ledger.
- [ ] **Passo 2:** os dois comandos da seção 3 com `tN = t0`. Esperado: 0 falhas, 0 `error TS`. Anotar as contagens.
- [ ] **Passo 3:** `bythiago_int` de pé: `psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "select max(version) from supabase_migrations.schema_migrations"` ≥ `20261018000006`. Falha aqui: parar e avisar o controlador.

### Tarefa 1: regra única de resolução e o diálogo de encerrar

**Files:**
- Create: `Y/ab-original-resolucao.ts`, `T/youtube/ab-original-resolucao.test.ts`
- Modify: `AB/_components/encerrar-props.ts:22` (corpo de `originalBaixaResolucao`; remover o comentário "Ruling do Phil (T15)" e a regra ≤ 480)
- Test: o teste existente de `encerrar-props` (grep `originalBaixaResolucao` em `T/`) ajustado

**Interfaces:**
- Produces: `LARGURA_ALTA = 1280`, `PROPORCAO = 16 / 9`, `TOLERANCIA_PROPORCAO = 0.01`, `MAX_BYTES = 2 * 1024 * 1024`; `publicaBaixa(largura: number | null | undefined): boolean`; `dimensoesDeTexto(d: string | null | undefined): { largura: number; altura: number } | null` (regex `^(\d+)x(\d+)$`, ambos > 0, senão `null`); `proporcaoOk(l: number, a: number): boolean`; `ehQuatroPorTres(l: number, a: number): boolean` (mesma tolerância contra 4/3).

- [ ] **Passo 1: testes que falham**

```ts
// @vitest-environment node
it('1279 é baixa, 1280 não', () => { expect(publicaBaixa(1279)).toBe(true); expect(publicaBaixa(1280)).toBe(false) })
it('nulo, 0 e indefinido são baixa', () => { for (const v of [null, undefined, 0]) expect(publicaBaixa(v)).toBe(true) })
it('dimensoesDeTexto', () => {
  expect(dimensoesDeTexto('1920x1080')).toEqual({ largura: 1920, altura: 1080 })
  for (const d of [null, '', '0x0', '480x0', 'abc', '1920X1080 ']) expect(dimensoesDeTexto(d)).toBeNull()
})
it('tolerância de 1%', () => {
  expect(proporcaoOk(1920, 1080)).toBe(true); expect(proporcaoOk(1280, 727)).toBe(true)  // 0,98%
  expect(proporcaoOk(1280, 712)).toBe(false); expect(proporcaoOk(1200, 900)).toBe(false)
  expect(ehQuatroPorTres(1200, 900)).toBe(true)
})
it('encerrar: selo com nulo, 0, 480 e 1279; sem selo com 1280', () => {
  for (const d of [null, '0x0', '480x360', '640x480', '1279x719']) expect(originalBaixaResolucao(d)).toBe(true)
  expect(originalBaixaResolucao('1280x720')).toBe(false)
})
```

- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-resolucao.test.ts` → FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar; `originalBaixaResolucao(d)` = `publicaBaixa(dimensoesDeTexto(d)?.largura ?? null)`.
- [ ] **Passo 4:** mesmo comando → PASS; comandos da seção 3 (o teste antigo de 640×480 sem selo passa a esperar selo: mudar a expectativa no mesmo commit, critério 18).
- [ ] **Passo 5:** commit `feat: regra única de baixa resolução da original (1280)`.

### Tarefa 2: migration, parte 1 (tabela, ponteiros, RLS, `ab_garantir_original_publica`, backfill)

**Files:**
- Create: `M` por `cd ~/Workspace/bythiago-ab-s7 && npm run db:new ab_original_em_alta`; `T/integration/ab-original-schema.test.ts`
- Modify: `apps/web/src/types/database.types.ts` (regenerado do `bythiago_int`: `npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54422/postgres --schema public > apps/web/src/types/database.types.ts`; conferir o diff: só entra a tabela, as duas colunas e as funções)

**Interfaces:**
- Produces: tabela `public.ab_test_originais` com as colunas, tipos e checks da seção 2 do spec (literal, incluindo `check (resultado = 'aceito' or (blob_url is null and blob_pathname is null))`, `check ((resultado = 'recusado') = (motivo_recusa is not null))`, `largura`/`altura` `> 0` ou nulas); índice `(test_id, criado_em desc)`; `ab_tests.original_vigente_id`, `ab_tests.original_publica_id` (`on delete set null`); `ab_garantir_original_publica(p_test_id uuid) returns uuid` (spec seção 3 passo 4, com `for update` e releitura).

- [ ] **Passo 1: testes de integração que falham** (`describe.skipIf(skipIfNoLocalDb())`; semente com `semearTesteAb` de `T/helpers/db-seed.ts`):
  - `ab_garantir em teste sem linhas cria uma publica/aceito/backfill/status draft e aponta os dois ids; 2ª chamada devolve o mesmo id e count = 1` (critério 19).
  - `intercalação forçada: A begin; select ab_garantir(t) (sem commit); B dispara ab_garantir(t); B não resolveu em 300 ms; A commit; B devolve o mesmo id; count = 1` (19b, Y R1-8). Um Promise.all de duas transações curtas não serve: costuma rodar uma depois da outra e passa sem a trava. Rodar o teste uma vez contra a função sem o `for update` e anotar no ledger que ele falhou.
  - `dimensions '480x360' → largura 480, altura 360, copia_publica 'hqdefault'; dimensions NULL → largura/altura nulas, copia_publica nula; blob fora do Vercel Blob → blob_url mantida` (critério 20, Review Focus 5).
  - `depois do backfill, todo thumbnail/combo tem original_publica_id = original_vigente_id numa linha publica com blob_url, dhash e dimensões iguais às da variante original` (critério 2).
  - `teste 'title' → devolve null e não insere`.
  - `criado_em = ab_tests.created_at`; `original_vigente_id` já preenchido não muda.
  - RLS (padrão de `observatorio-a5-e10-rls.test.ts`): como `authenticated` sem `can_edit_site` e com `set_config('app.site_id', <site>, true)` → 0 linhas; editor do site → lê; `has_function_privilege('authenticated', 'public.ab_garantir_original_publica(uuid)', 'execute')` = false; `has_table_privilege('authenticated', 'public.ab_test_originais', 'insert')` = false (critério 1).
  - `migration reaplicada sobre si mesma não falha e não duplica linhas de backfill`.
  - Os checks recusam (P menor 7): insert `recusado` com `blob_url` → `23514`; `aceito` com `motivo_recusa` → `23514`; `largura = 0` → `23514`.
- [ ] **Passo 2:** comando de integração → FAIL.
- [ ] **Passo 3:** escrever em `M` os passos 1 a 4 da seção 3 do spec, em `begin; ... commit;`, e no fim o backfill: `select public.ab_garantir_original_publica(id) from public.ab_tests where test_type in ('thumbnail','combo') and original_publica_id is null;`. Aplicar no `bythiago_int` (seção 3) e regenerar os tipos.
- [ ] **Passo 4:** integração → PASS; `tsc` → 0.
- [ ] **Passo 5:** commit `feat: tabela ab_test_originais e backfill da pública` (M, teste, `database.types.ts`).

### Tarefa 3: migration, parte 2 (`ab_aplicar_original` e `ab_registrar_original`)

**Files:**
- Modify: `M` (acrescentar as duas funções, spec seção 3 passo 5)
- Create: `T/integration/ab-original-funcoes.test.ts`

**Interfaces:**
- Produces: `ab_aplicar_original(p_test_id uuid, p_original_id uuid, p_restore_seq integer default null) returns text` (`'ok' | 'status' | 'nao_pertence'`); `ab_registrar_original(p_test_id uuid, p_linha jsonb, p_aplicar boolean, p_restore_seq integer default null, p_so_publica boolean default false) returns jsonb` (`{ resultado: 'ok' | 'status' | 'nao_pertence' | 'recusado', original_id: uuid | null, blob_url: text | null }`). Chaves aceitas em `p_linha`: as colunas da tabela menos `id`, `site_id`, `test_id`, `substituida_em`, `ausente_desde` (ignoradas) e `status_do_teste` (sobrescrito pelo status do teste lido sob o `for update`, P C3). `p_so_publica` (spec 3 passo 5, Y R1-1): exige `origem = 'publica'`, `p_aplicar` e `p_restore_seq`, senão `raise`; insere, põe `substituida_em = now()` na pública anterior e aponta só `original_publica_id`. Com origem `enviada` e aplicação `ok`, a função remove `queue_start_failures` do `config` (Y R1-6).

- [ ] **Passo 1: testes que falham:**
  - `aplicar em draft: vigente troca, substituida_em da anterior preenchida, da nova nula; variante is_original recebe blob_url, blob_key, dimensions 'LxA', thumbnail_dhash, file_size_bytes; original_thumbnail_url igual`.
  - `linha com largura nula → dimensions nula`.
  - `active com restore_seq 5: p_restore_seq 5 + linha publica → 'ok'; 4 → 'status'; nulo → 'status'; 5 + linha enviada → 'status'` (10c).
  - `queued aceita; completed → 'status'`.
  - `linha de outro teste → 'nao_pertence'`; `linha recusado → 'nao_pertence'`.
  - `teste com variante is_original e update que toca 0 linhas → raise`; `teste sem variante is_original (playoff) → só original_thumbnail_url muda, 'ok'`.
  - `registrar com p_aplicar true em active sem seq → resultado 'status', a linha existe recusado/status_do_teste com blob_url e blob_pathname nulos, nenhuma linha aceito, blob_url no retorno` (critério 19, [PP-4]).
  - `registrar com p_aplicar false e resultado 'aceito' no JSON → erro`; `p_aplicar false com blob_url não nulo → erro`; `p_aplicar false recusado → linha gravada, vigente intocada`.
  - `JSON com test_id/site_id de outro teste → gravados os de p_test_id` (19b).
  - `enviar, voltar à pública (aplicar publica), ler: substituida_em da pública nula, da enviada preenchida` (19b).
  - `corrida: conexão A begin + update status = 'active' sem commit; conexão B aplicar → espera; A commit; B → 'status'`.
  - `JSON com status_do_teste 'draft' em teste active com p_restore_seq → linha com 'active'; em teste paused → 'paused'` (P C3).
  - `p_so_publica com vigente enviada: muda só original_publica_id, a variante e original_thumbnail_url intocadas, substituida_em da pública velha preenchida, vigente intocada; p_so_publica com origem enviada → raise; sem p_restore_seq → raise` (Y R1-1).
  - `enviada aceita com config {queue_start_failures: 3, rotacao: 'x'} → depois do registro config sem a chave e com rotacao intacta; linha publica não mexe no config` (Y R1-6).
  - `has_function_privilege('authenticated', ..., 'execute')` = false para as duas.
- [ ] **Passo 2:** integração → FAIL.
- [ ] **Passo 3:** implementar em `M` (a lógica de aplicar numa função interna chamada pelas duas, para não duplicar); reaplicar no `bythiago_int`; regenerar tipos.
- [ ] **Passo 4:** integração → PASS.
- [ ] **Passo 5:** commit `feat: funções de registrar e aplicar a original`.

### Tarefa 4: migration, parte 3 (`create_playoff_test` copia as linhas)

**Files:**
- Modify: `M` (`create or replace function public.create_playoff_test(...)`: corpo atual de `supabase/migrations/20260529000001_playoff_mode.sql:29` sem mudança, mais o spec seção 3 passo 6)
- Create: `T/integration/ab-original-playoff.test.ts`

**Interfaces:**
- Consumes: `ab_garantir_original_publica` (Tarefa 2).
- Produces: `create_playoff_test` com a mesma assinatura de hoje.

- [ ] **Passo 1: testes que falham** [PP-2]:
  - `pai com enviada vigente → filho tem duas linhas com copiada_de = ids do pai, test_id do filho, ausente_desde nulo; vigente copiada com substituida_em nulo; pública copiada com o substituida_em do pai; ponteiros do filho nas cópias`.
  - `pai com uma linha só → uma cópia, os dois ids nela`.
  - `pai legado sem original_publica_id → filho com linhas e com thumbnail_dhash na variante is_original` (19b).
  - `pai com ausente_desde → cópia nula`.
  - `delete do pai → ponteiros do filho intactos`; `aplicar a pública no filho (pública alta) → 'ok'`.
  - `dois create_playoff_test do mesmo pai em duas conexões pg → nenhum deadlock (os dois terminam em < 5 s; um pode falhar pela regra de hoje, nenhum com 40P01)` [PP-5].
  - Grep de guarda no teste: o texto de `M` não contém `select \*` dentro de `create_playoff_test` (lê o arquivo e afirma); **e, no corpo de `create_playoff_test`, a chamada a `ab_garantir_original_publica` vem antes do `insert into public.ab_tests`** (Y M-6: o deadlock não se força de fora, a ordem do texto é a prova).
- [ ] **Passo 2:** integração → FAIL.
- [ ] **Passo 3:** implementar com lista de colunas explícita; `ab_garantir_original_publica(p_parent)` como primeira instrução.
- [ ] **Passo 4:** integração das Tarefas 2–4 → PASS; reaplicar `M` duas vezes seguidas sem erro.
- [ ] **Passo 5:** commit `feat: playoff copia as originais do pai`.

### Tarefa 5: leitura (`IOriginalDoTeste`) e captura da pública pelos chamadores

**Files:**
- Create: `Y/ab-original-leitura.ts`, `T/youtube/ab-original-leitura.test.ts`
- Modify: `Y/thumb-fingerprint.ts` (nova `biggerCopyComOrigem`), `Y/ab-variant-dhash.ts:79-92`, `AB/actions.ts` (`createAbTest` :121, `batchStartTests` :~1421, `updateAbTestType` :309-347, nova `obterOriginalDoTeste`), `AB/queries.ts` (`lerOriginalDoTeste`; lista e detalhe com `SELECT_ORIGINAIS`), testes `T/ab-actions-create.test.ts`, `T/youtube/ab-variant-dhash.test.ts`

**Interfaces:**
- Produces:
  - `type CopiaPublica = 'maxresdefault' | 'sddefault' | 'hqdefault'`; `biggerCopyComOrigem(probeUrl, f?): Promise<{ bytes: Buffer; copia: CopiaPublica } | null>` (`biggerCopy` passa a delegar a ela).
  - `guardarOriginalMaior(...)`: `Promise<{ url: string; pathname: string; dhash: string; largura: number | null; altura: number | null; bytes: number; sha256: string; copia: CopiaPublica }>`.
  - `linhaDaPublica(g: Awaited<ReturnType<typeof guardarOriginalMaior>>): Record<string, unknown>` (JSON de `p_linha`: `origem 'publica'`, `registro 'captura'`, `formato_recebido/guardado 'jpeg'`, `sha256_recebido = sha256_guardado`, `bytes_* `, `copia_publica`), em `Y/ab-original-leitura.ts`.
  - `interface IOriginalDoTeste` exatamente como o spec 6.1; `montarOriginalDoTeste(t: { status: string; test_type: string }, vigente: LinhaOriginal | null, publica: LinhaOriginal | null, userId: string | null): IOriginalDoTeste | null` (null para `title`); `type LinhaOriginal = { id; origem; largura; altura; bytes_guardados; blob_url; criado_em; enviado_por; nome_arquivo; ausente_desde; dhash }`; `SELECT_ORIGINAIS = 'vigente:ab_test_originais!ab_tests_original_vigente_id_fkey(...), publica:ab_test_originais!ab_tests_original_publica_id_fkey(...)'` (nome da FK conferido nos tipos gerados).
  - `lerOriginalDoTeste(testId: string): Promise<IOriginalDoTeste | null>` em `AB/queries.ts` (site do contexto; chama `ab_garantir_original_publica` se `original_publica_id` é nulo).
  - Server action `obterOriginalDoTeste(testId: string): Promise<IOriginalDoTeste | null>` em `AB/actions.ts` (com `requireEditUser`).
  - `createAbTest` devolve também `original: IOriginalDoTeste | null`; `updateAbTestType` também (Y R1-3).
  - `linhaDaPublica` não manda `status_do_teste` (a função grava o status real, P C3).

- [ ] **Passo 1: testes que falham:**
  - `montarOriginalDoTeste`: pública 480×360 e vigente = pública → `publicaBaixa true, origem 'publica', podeUsarPublica false`; enviada vigente + pública 1280 + `paused` → `podeTrocar true, podeUsarPublica true`; mesma em `active` → `podeTrocar false, podeUsarPublica false`; `enviado_por = userId` → `enviadaPorMim true`; `ausente_desde` preenchido → `ausente true`; `test_type 'title'` → `null`; `publica.url` nunca é a URL da enviada.
  - `guardarOriginalMaior` sem `width` no metadata → `largura null` (não 0); a cópia `sddefault` → `copia 'sddefault'`; a queda para a hq → `'hqdefault'`.
  - `createAbTest` (mock de supabase): **só para `thumbnail`/`combo`** (Y R1-3) chama `rpc('ab_registrar_original', { p_test_id, p_linha: objectContaining({ origem: 'publica', registro: 'captura', copia_publica }), p_aplicar: true })` depois do insert das variantes; RPC com erro → apaga o teste **e o blob da pública (`del(guardada.url)`, P menor 2)** e devolve o erro de hoje; `thumbnail_hq_url` fora do YouTube → chama `ab_garantir_original_publica` em vez do registro; teste `title` → nenhuma das duas RPCs.
  - `dimensions` com `largura` nula grava `null`, não `'nullxnull'` (`largura && altura ? \`${largura}x${altura}\` : null`, P menor 1 e Y M-2), em `createAbTest` e `batchStartTests`.
  - `batchStartTests`: a mesma chamada por teste criado (só `thumbnail`/`combo`); RPC com erro → apaga o teste e o blob e `continue`, como na falha de captura (Y M-2).
  - `updateAbTestType` de `title` para `thumbnail` com pública 480 → chama `ab_garantir_original_publica` e devolve `original.publicaBaixa true`; para `title` → `original null` (Y R1-3).
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-leitura.test.ts test/youtube/ab-variant-dhash.test.ts test/ab-actions-create.test.ts` → FAIL.
- [ ] **Passo 3:** implementar. A gravação direta de `blob_url/thumbnail_dhash/dimensions` na variante original em `createAbTest`/`batchStartTests` continua no insert (é a mesma pública); a RPC aponta os ids e grava a linha.
- [ ] **Passo 4:** comandos da seção 3 → PASS.
- [ ] **Passo 5:** commit `feat: captura da pública grava a linha e leitura da original do teste`.

### Tarefa 6: limpeza de JPEG sem recodificar (`removerMetadadosJpeg`)

**Files:**
- Create: `Y/ab-original-jpeg.ts`, `T/youtube/ab-original-jpeg.test.ts`

**Interfaces:**
- Produces: `removerMetadadosJpeg(bytes: Buffer): Buffer | null`; `temBytesDepoisDoEoi(bytes: Buffer): boolean` (fim do primeiro EOI depois do SOS < `bytes.length`).

Regra (spec 4.3 passo 6, literal): mantém SOI, DQT, DHT, SOFn, DRI, SOS e entropia; APP0 só se o corpo começa com `JFIF\0`; APP2 só com `ICC_PROFILE\0`; APP14 só com `Adobe`; descarta APP1, APP13, COM e todo outro APPn; copia a entropia até o primeiro `FFD9` (pulando `FF00` e `FFD0`–`FFD7`) e descarta o resto; `null` se faltar SOI, se aparecer SOI/SOS fora de lugar, se um segmento passar do fim ou se não houver EOI.

- [ ] **Passo 1: testes que falham** (`// @vitest-environment node`; imagens geradas por sharp):
  - `JPEG com EXIF+GPS (sharp withExif IFD3 GPSLatitude) e orientação 1 → saída sem exif em metadata(), não contém a string GPS, raw idêntico ao da entrada`.
  - `JPEG com XMP (withXmp) e COM (segmento FFFE inserido à mão) → sem xmp, sem os bytes do comentário`.
  - `JPEG + segundo JPEG com GPS colado depois do EOI + APP2 'MPF\0' → saída termina no primeiro EOI (últimos dois bytes FFD9, comprimento = posição do 1º EOI + 2), sem 'MPF', sem a string do GPS; temBytesDepoisDoEoi(entrada) true, (saída) false` (Y R4-1).
  - `ICC (sharp withIccProfile('srgb')) é mantido`.
  - `marcador truncado (corta no meio do DQT) → null`; `sem EOI → null`; `sem SOI → null` [PP-3].
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-jpeg.test.ts` → FAIL.
- [ ] **Passo 3:** implementar (laço linear sobre marcadores, O(n)).
- [ ] **Passo 4:** → PASS.
- [ ] **Passo 5:** commit `feat: limpeza de metadados de JPEG sem recodificar`.

### Tarefa 7: validação e processamento (`validarArquivoDaOriginal`), sem o 5º caso

**Files:**
- Create: `Y/ab-original-envio.ts` (parte da validação), `T/youtube/ab-original-envio.test.ts`

**Interfaces:**
- Consumes: Tarefa 1 (constantes, `proporcaoOk`, `ehQuatroPorTres`), Tarefa 6, `dhashDosBytes` (`Y/ab-variant-dhash.ts:15`), `hamming`/`DHASH_MAX_SAME` (`Y/thumb-fingerprint.ts`).
- Produces:

```ts
export const LIMITE_PIXELS = 16_000_000
export type MotivoRecusa = 'formato' | 'tamanho' | 'proporcao' | 'pequeno' | 'ilegivel' | 'diferente_da_publica' | 'status_do_teste' | 'armazenamento'
export type Caminho = 'intacto' | 'sem_metadados' | 'reencode_q95' | 'reencode_q90' | 'reencode_q85' | 'png' | 'gif_png'
export type ResultadoValidacao =
  | { ok: true; bytes: Buffer; formatoRecebido: 'jpeg' | 'png' | 'gif'; formatoGuardado: 'jpeg' | 'png'; contentType: 'image/jpeg' | 'image/png';
      largura: number; altura: number; dhash: string; dhashDistanciaPublica: number | null; caminho: Caminho }
  | { ok: false; motivo: MotivoRecusa; formatoRecebido: string | null; largura?: number; altura?: number; bytesGuardados?: number;
      dhash?: string | null; dhashDistanciaPublica?: number | null }
export function validarArquivoDaOriginal(bytes: Buffer, ctx: { larguraPublica: number | null; dhashPublica: string | null }): Promise<ResultadoValidacao>
export function mensagemDaRecusa(motivo: MotivoRecusa, d: { nome: string; bytesRecebidos?: number; bytesGuardados?: number; largura?: number; altura?: number; formato?: string | null }): string
```

Ordem dentro da função (spec 4.3 passos 5 a 9): `metadata()` com `limitInputPixels` (falha → `ilegivel`; formato fora de `jpeg|png|gif` → `formato`); processamento pelos quatro ramos do passo 6 (o "já limpo" exige também `!temBytesDepoisDoEoi`); resultado > `MAX_BYTES` → `tamanho` com `bytesGuardados`; `proporcaoOk` (senão `proporcao`); `largura < LARGURA_ALTA` → `pequeno`; `dhash` e `dhashDistanciaPublica` (contra `ctx.dhashPublica`, nulo sem base) **sempre gravados, sem recusa nesta tarefa** (o 5º caso é a Tarefa 19).

Textos de `mensagemDaRecusa` (MB com uma casa e vírgula, `(bytes / 1024 / 1024).toFixed(1).replace('.', ',')`):
- `tamanho` com `bytesGuardados`: `"<nome> não foi aceito. O arquivo, depois de limpo, ficou com X MB. O limite do YouTube é 2 MB. Comprima e envie de novo."`; com `bytesRecebidos`: `"<nome> não foi aceito. O arquivo tem X MB. O limite do YouTube é 2 MB. Comprima e envie de novo."`
- `formato`: `"<nome> não foi aceito. O arquivo é WEBP. Envie JPG, PNG ou GIF."` (formato em maiúsculas; desconhecido → "num formato que não é imagem")
- `proporcao`: `"<nome> não foi aceito. O arquivo tem 1200×900 (4:3). A thumbnail precisa ser 16:9. Recorte e envie de novo."` (`" (4:3)"` só se `ehQuatroPorTres`)
- `pequeno`: `"<nome> não foi aceito. O arquivo tem 1000×563. A original precisa ter 1280 de largura ou mais. Envie um de 1280×720."` [PP-6]
- `ilegivel`: `"<nome> não foi aceito. Não foi possível ler o arquivo. Tente outro arquivo."`
- `armazenamento`: `"O envio de <nome> não foi concluído e a original não foi guardada. Tente de novo."`
- `status_do_teste`: `"Pause o teste para enviar a original em alta."`

- [ ] **Passo 1: testes que falham** (`// @vitest-environment node`; imagens por sharp na hora; [PP-3], [PP-5], critérios 4–6):
  - `JPEG 1920×1080 q98 sem EXIF → caminho 'intacto', bytes === entrada (Buffer.equals)`.
  - `JPEG EXIF+GPS orientação 1 → 'sem_metadados', sem exif, raw idêntico, bytes ≠ entrada`.
  - `JPEG de ~1,7 MB com EXIF (ruído aleatório 2400×1350 q92) → ok, ≤ 2 MB`.
  - `JPEG 1080×1920 com orientation 6 → reencode, largura 1920 altura 1080 (orientada), metadata().exif ausente, chromaSubsampling '4:4:4'`.
  - `JPEG CMYK 1920×1080 → ok, metadata().space 'srgb'`.
  - `JPEG 3840×2160 com XMP de ~1,9 MB que estoura em q95 → ok, caminho 'reencode_q90' ou 'reencode_q85'`.
  - `JPEG cujo q85 passa de 2 MB → tamanho com bytesGuardados; mensagem cita "depois de limpo"`.
  - `PNG 1280×720 → 'png', formatoGuardado 'png'`; `GIF animado de 2 quadros 1280×720 → 'gif_png', PNG de 1 quadro (metadata().pages ausente ou 1)` (critério 6).
  - `WEBP → formato`; `bytes aleatórios → ilegivel`; `PNG 20000×20000 (cabeçalho IHDR forjado) → ilegivel sem alocar`; `PNG 5000×4000 → ilegivel` (critério 8).
  - `1200×900 → proporcao, mensagem com "(4:3)"`; `1000×563 com larguraPublica 480 e com 1280 → pequeno, mensagem sem "Com a pública baixa"`.
  - `dhashDistanciaPublica: mesma imagem → ≤ 6; sem dhashPublica → null; imagem diferente → ok (sem recusa nesta tarefa) e distância > 6`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-envio.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS.
- [ ] **Passo 5:** commit `feat: validação e limpeza do arquivo da original`.

### Tarefa 8: prova do pior caso do mozjpeg; `maxDuration = 60` [PP-1]

**Files:**
- Create: `apps/web/scripts/medir-original-mozjpeg.ts` (não vai ao build; fora de `src/`)
- Modify: ledger

`maxDuration` é **60 s, fixo** (convenção do repositório: 14 rotas; é teto, não custa nada em cobrança por uso; cobre também o corpo de 2 MB numa conexão lenta). Esta tarefa é uma **prova**, não um cálculo do valor, e **não para o plano por ruído** (ruling do controlador, P C2 × Y R1-5).

- [ ] **Passo 1:** script gera o **pior caso real**: JPEG 5333×3000 (16 Mpx, o `LIMITE_PIXELS`), **afirmado ≤ 2 MB** (`assert`), orientação 6, conteúdo calibrado (ruído com blur 4) para que q95 **e** q90 estourem 2 MB e a escada rode inteira (q95, q90, q85), mais `dhashDosBytes`. `sharp.concurrency(1)`, 5 rodadas, rodando `validarArquivoDaOriginal` inteira. Imprime p50, máximo, caminho usado e a máquina. Rodar: `cd W/apps/web && npx tsx scripts/medir-original-mozjpeg.ts > /tmp/oea-mozjpeg.log 2>&1`. Não usar ruído cru de 4000×3000 > 2 MB: o passo 4 o recusa antes do processamento (Y R1-5, 25 a 28 s sem sentido).
- [ ] **Passo 2:** critério: **máximo ≤ 20 s** (um terço do teto de 60 s; Phil mediu 6,0 a 6,2 s a 16 Mpx no M4 Pro, ×3 ≈ 18,6 s para a Vercel). Acima disso, levar ao controlador com os números. Anotar no ledger a máquina, a concorrência e os números.
- [ ] **Passo 3:** commit `chore: prova do pior caso do mozjpeg da original` (script + ledger).

### Tarefa 9: orquestração do envio (`enviarOriginal`)

**Files:**
- Modify: `Y/ab-original-envio.ts`
- Create: `T/youtube/ab-original-enviar.test.ts`

**Interfaces:**
- Consumes: Tarefas 3, 5, 7.
- Produces:

```ts
export interface PortasEnvio {
  supabase: SupabaseClient
  put: typeof import('@vercel/blob').put
  del: typeof import('@vercel/blob').del
  validar?: typeof validarArquivoDaOriginal   // espionável (critério 8: reenvio não chama sharp)
  revalidar: () => void                        // revalidateTag('youtube', { expire: 0 }) + revalidatePath('/cms/youtube/ab-lab')
  auditar: (e: { acao: 'ab_original_enviada' | 'ab_original_publica_restaurada'; testId: string; siteId: string; orgId: string | null; userId: string; depois: Record<string, unknown> }) => Promise<void>
}
export type RespostaEnvio =
  | { ok: true; original: IOriginalDoTeste }
  | { ok: false; status: 404 | 409 | 413 | 422 | 503; motivo: MotivoRecusa | 'nao_encontrado' | 'tipo'; mensagem: string; largura?: number; altura?: number; bytes?: number }
export type TesteParaEnvio = { id: string; status: string; test_type: string; site_id: string; config: Record<string, unknown>; vigente: LinhaOriginal & { sha256_recebido: string | null }; publica: LinhaOriginal }
// Única leitura do teste (Y R1-7): 404 nao_encontrado, 422 tipo (sem linha), status fora de draft|paused|queued → grava A linha recusado/status_do_teste e devolve 409. A rota e voltarParaPublica chamam esta função; nenhuma outra camada relê ou regrava.
export function prepararEnvio(p: PortasEnvio, a: { siteId: string; userId: string; testId: string; nomeArquivo: string | null }): Promise<{ teste: TesteParaEnvio } | RespostaEnvio>
export function enviarOriginal(p: PortasEnvio, a: { siteId: string; orgId: string | null; userId: string; teste: TesteParaEnvio; arquivo: { nome: string; bytes: Buffer } }): Promise<RespostaEnvio>  // recebe o teste já lido; o status real é rechecado pela função SQL sob a trava
export function registrarRecusaAntesDoCorpo(p: PortasEnvio, t: { id: string; site_id: string }, contentLength: number, nome: string | null): Promise<void>  // passo 3(b): só número finito (P menor 6); bytes_recebidos = Math.min(contentLength, 2_147_483_647)
export function voltarParaPublica(p: PortasEnvio, a: { siteId: string; orgId: string | null; userId: string; testId: string }): Promise<RespostaEnvio>  // usa prepararEnvio
```

Ordem (spec 4.3, passos 1, 2, 4, 4b, 5–9, 11–13). `prepararEnvio` faz o passo 1 e 2 (teste lido no site: ausente → 404 `nao_encontrado`; `title` → 422 `tipo`, sem linha; status fora de `draft|paused|queued` → **a** linha `recusado/status_do_teste` (p_aplicar false) e 409). `enviarOriginal` começa em `bytes.length > MAX_BYTES` → linha `tamanho` com `bytes_recebidos` e 413; `sha256 = computeContentHash(bytes)`; vigente `enviada` com `sha256_recebido === sha256` **e `ausente_desde == null`** (P B1) → `ok` sem linha, sem `validar`, sem `put` (vigente ausente segue pela validação e pelo `put`: é a saída de "Envie de novo"); `validar`; recusa → linha `recusado` com tudo o que foi medido (`largura`, `altura`, `formato_recebido`, `bytes_*`, `dhash`, `dhash_distancia_publica`, `largura_publica`, `nome_arquivo`, `status_do_teste`, `enviado_por`) e 422 (`tamanho` 413); `put('ab-originals/<testId>/enviada-<sha256.slice(0,16)>.<jpg|png>', ..., { access: 'public', addRandomSuffix: true, contentType })` (falha → linha `armazenamento` e 503); `try { rpc ab_registrar_original(p_aplicar true) } catch { await del(url).catch(Sentry.captureException); throw }`; resultado ≠ `ok` → `del(retorno.blob_url)` e 409 `status_do_teste`; `ok` → (a remoção de `config.queue_start_failures` é da função SQL, Tarefa 3; o app não escreve `config`) `revalidar()`, `auditar` (falha só vai ao log), devolve `lerOriginalDoTeste`.

`voltarParaPublica`: `publicaBaixa(publica.largura)` → 409 (D5); status fora → 409; `rpc ab_aplicar_original(testId, original_publica_id)` → `ok`, auditar `ab_original_publica_restaurada`; não apaga blob.

- [ ] **Passo 1: testes que falham** (banco falso como em `T/youtube/ab-settle.test.ts`; `put`/`del` espiões; `fetch` global espionado):
  - `rascunho com pública 480×360 + JPEG 1920×1080 de 1,2 MB → ok; rpc com p_linha contendo largura_publica 480, sha256_*, bytes_*, enviado_por; put com o caminho ab-originals/<id>/enviada-<16 hex>.jpg` (critério 3).
  - `active e completed → 409, put não chamado, linha recusado status_do_teste`; `queued → ok` (critério 8).
  - `reenvio idêntico com vigente enviada → ok, validar não chamado, put não chamado, rpc não chamado` (critério 7, 8; Review Focus 4).
  - `JPEG idêntico à pública 480×360 com vigente publica → pequeno, não ok` (Y R4-2).
  - `rpc lança → del com a URL do put e erro relançado`; `rpc devolve status → del com retorno.blob_url, 409` (critério 19).
  - `put lança → linha armazenamento, 503, sem del`.
  - `ok chama a rpc e não faz nenhum update em ab_tests` (a remoção de `queue_start_failures` é provada na Tarefa 3) [PP-5]; `auditar lança → resposta continua ok`.
  - `vigente enviada com ausente_desde preenchido + mesmo arquivo → validar e put chamados, rpc com p_aplicar true, resposta com original.ausente === false` (P B1).
  - `status fora com prepararEnvio → exatamente uma linha recusado/status_do_teste e 409; enviarOriginal não relê o teste` (Y R1-7).
  - `nenhuma chamada a googleapis.com durante o envio` (critério 15).
  - `voltarParaPublica com pública baixa → 409; com pública 1280 e enviada vigente → ok e podeUsarPublica false na leitura` (critério 9).
  - `registrarRecusaAntesDoCorpo com 99999999999 → bytes_recebidos 2147483647` (a função só recebe número finito; o caso Content-Length ausente/inválido é da rota, Tarefa 10).
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-enviar.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: envio da original (orquestração)`.

### Tarefa 10: a rota `POST`/`DELETE`

**Files:**
- Create: `apps/web/src/app/api/youtube/ab-tests/[id]/original/route.ts`, `T/ab-original-route.test.ts`

**Interfaces:**
- Consumes: Tarefa 9; `assertSameOriginFetch` (`apps/web/src/lib/oauth/origin.ts:117`), `getSiteContext`, `requireSiteScope`.
- Produces: `POST /api/youtube/ab-tests/{id}/original` (multipart, campo `file`) e `DELETE` no mesmo caminho; `export const runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60` (Tarefa 8 é a prova). Resposta 200 `{ ok: true, original }`; recusa `{ ok: false, motivo, mensagem, largura?, altura?, bytes? }` com o status de `RespostaEnvio`.

Ordem no topo dos dois métodos (spec 4.2): `assertSameOriginFetch(req)` (403 sem tocar em mais nada) → `getSiteContext()` + `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` (403) → `prepararEnvio` (404/422/409 de status, que já grava a linha, antes do 413) → `Content-Length` numérico finito `> MAX_BYTES + 64 * 1024` → `registrarRecusaAntesDoCorpo` e 413 JSON sem chamar `formData()` (ausente ou inválido: segue para `formData()` sem linha antes do corpo, P menor 6) → `try { formData() } catch` → 400 `{ ok:false, motivo:'rede' }` sem linha e sem Sentry (cancelamento do cliente, Y M-3); campo `file` ausente ou não-`File` → 400 `ilegivel` sem linha → `enviarOriginal({ teste, … })`.

- [ ] **Passo 1: testes que falham** (`requireSiteScope` simulado, como `T/ab-poll-stats-route.test.ts`; critério 8):
  - `sec-fetch-site: same-site → 403, requireSiteScope e put não chamados`.
  - `reporter (insufficient_access) → 403`; `teste de outro site → 404`.
  - `Content-Length 3000000 → 413 JSON { ok:false, motivo:'tamanho', bytes:3000000 }, formData não chamado, linha recusado`.
  - `Content-Length 99999999999 → 413 JSON e bytes_recebidos 2147483647`.
  - `teste active com Content-Length 3000000 → 409 (status ganha do 413) e exatamente uma chamada de registro com status_do_teste` (Y R1-7).
  - `Content-Length ausente ou 'abc' → segue para formData, nenhuma linha antes do corpo`; `formData lança (abort) → 400 rede, sem linha, Sentry não chamado`; `file ausente ou string → 400 ilegivel, sem linha` (Y M-3, P menor 6).
  - `POST válido → 200 com original`; `DELETE com pública baixa → 409`.
- [ ] **Passo 2:** `npx vitest run test/ab-original-route.test.ts` → FAIL.
- [ ] **Passo 3:** implementar (a rota só costura; nenhuma regra nova aqui). A porta `auditar` é o insert direto em `audit_log` como `Y/ab-restore-acoes.ts:53-58` (`actor_user_id`, `org_id`, `site_id`, `action`, `resource_type: 'ab_test'`, `resource_id`, `after_data` sem URL do Blob); o nome do arquivo passa por `sanitizeFilename` e corta em 120 caracteres antes de `enviarOriginal`.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: rota de envio da original`.

### Tarefa 11: guarda do início e passo 2 contra a pública

**Files:**
- Modify: `Y/ab-start.ts` (assinatura, leitura do teste em :206-211, guarda antes de :282, passo 2 em :313-337)
- Test: `T/ab-start-internal.test.ts`

**Interfaces:**
- Consumes: Tarefas 1, 3, 5.
- Produces: `startAbTestInternal(...): Promise<{ ok: boolean; error?: string; codigo?: 'original_baixa' | 'original_ausente' }>`; `PortasInicio` ganha `sondar?: (ytId: string) => Promise<ThumbProbe>` (padrão `probeThumb(ytId, null)`), `consultarBlob?: (url: string) => Promise<'ok' | 'ausente' | 'erro'>` (padrão `head` de `@vercel/blob`; `BlobNotFoundError` → `ausente`), `guardar?: typeof guardarOriginalMaior`, `medirBlob?: (url: string) => Promise<string | null>` (padrão `dhashDoArquivo`, Blob cota 0), `del?: typeof import('@vercel/blob').del`. A sonda da guarda é **guardada e reusada no passo 2** (uma ida ao ytimg por início, Y M-4). Constantes de texto exportadas: `MSG_ORIGINAL_BAIXA = 'Envie a original em alta resolução (1280 de largura ou mais) para iniciar o teste.'`, `MSG_ORIGINAL_AUSENTE_INICIO = 'A original enviada não está mais guardada. Envie de novo para iniciar.'`, `MSG_THUMB_MUDOU = 'A thumbnail do vídeo mudou no YouTube depois do envio da original. Confira a thumbnail atual e envie a original de novo.'`.

Regras (spec 5.2): a leitura do teste passa a trazer `original_vigente_id, original_publica_id, parent_test_id` e as duas linhas (`SELECT_ORIGINAIS`); `comThumb` sobe para antes da reivindicação. Com `comThumb`: `original_publica_id` nulo → `rpc ab_garantir_original_publica` e relê. Vigente `enviada` → `consultarBlob`: `ausente` → `update ab_test_originais set ausente_desde = now() where id = vigente and ausente_desde is null` e `{ ok:false, error: MSG_ORIGINAL_AUSENTE_INICIO, codigo: 'original_ausente' }`; `erro` → "Não foi possível ler a thumbnail atual do vídeo. Tente de novo." Pública baixa, vigente `publica` e `parent_test_id` nulo → `sondar`: sem `dhash` → "Tente de novo" (texto acima); `hamming(sonda.dhash, publica.dhash) > DHASH_MAX_SAME` → segue; igual → `{ ok:false, error: MSG_ORIGINAL_BAIXA, codigo: 'original_baixa' }`, nenhuma escrita. **`publica.dhash` nulo não recusa** (Y R1-2; o spec 5.2 só recusa com dHash igual): segue para a reivindicação e o passo 2 captura, mede e decide.

Passo 2: base = `publica.dhash`. Vigente `publica` e mudou (ou base nula) → `guardar`, `try { rpc ab_registrar_original(testId, linhaDaPublica(g), true, seq) } catch { await del(g.url).catch(Sentry.captureException); throw }`; resultado ≠ `ok` → `del(retorno.blob_url)` (P C4) e `desfazer(MSG_EM_ANDAMENTO)`; `publicaBaixa(g.largura)` e `parent_test_id` nulo → `desfazer(MSG_ORIGINAL_BAIXA)`. Vigente `enviada` e mudou → `guardar` e `ab_registrar_original(testId, linhaDaPublica(g), true, seq, p_so_publica => true)` (mesmo `try/del`), depois `desfazer(MSG_THUMB_MUDOU)` (Y R1-1: o reenvio passa a comparar com a pública nova e o `DELETE` vale se ela for alta). **Decisão do plano (o spec cobre em 5.2, r6):** vigente `enviada` com `publica.dhash` nulo mede primeiro a pública guardada (`medirBlob(publica.blob_url)`, P menor 3) e só sem base compara contra `vigente.dhash`; os dois nulos → segue sem regravar; registrar no ledger. O `update` direto de `ab_test_variants` (:333-337) e `patchTeste.original_thumbnail_url` saem.

- [ ] **Passo 1: testes que falham** (critérios 10, 10b, 10c, 11, 12; Review Focus 3):
  - `pública 480×360, sem enviada, sonda igual → codigo original_baixa, status draft, nenhum update`.
  - `pública baixa e sonda com dHash diferente (maxres nova no ar) → chega a active; registrar chamado com p_restore_seq = seq e linha 1280`.
  - `sonda sem dhash → "Tente de novo", sem codigo`.
  - `enviada vigente → inicia; enviada vigente e no ar diferente da pública → volta a draft com MSG_THUMB_MUDOU e guardar não chamado`.
  - `enviada 404 → codigo original_ausente e ausente_desde gravado com .is(ausente_desde, null)`; `erro de rede no head → Tente de novo, sem marcar`.
  - `playoff (parent_test_id) com pública baixa → inicia`.
  - `original_publica_id nulo → ab_garantir chamado antes da guarda`.
  - `registrar devolve 'status' → desfaz com MSG_EM_ANDAMENTO`.
  - `teste title → nenhuma das chamadas novas`.
  - `pública sem dHash nem dimensões, sonda com dHash → chega ao passo 2; guardar devolve 1280 → active; devolve 480 → draft com MSG_ORIGINAL_BAIXA e a linha nova gravada` (Y R1-2).
  - `enviada vigente e no ar diferente → guardar chamado uma vez, registrar com p_so_publica true, desfaz com MSG_THUMB_MUDOU; um 2º início com a enviada igual ao no-ar novo → active` (Y R1-1).
  - `registrar devolve 'status' → del chamado com retorno.blob_url antes do desfazer; registrar lança → del com g.url e erro relançado` (P C4).
  - `enviada vigente, publica.dhash nulo, no-ar igual à enviada → active; diferente → desfaz com MSG_THUMB_MUDOU; publica.dhash medido do Blob tem prioridade sobre vigente.dhash` (Y M-1, P menor 3).
  - `a guarda e o passo 2 sondam o ytimg uma vez só` (Y M-4).
- [ ] **Passo 2:** `npx vitest run test/ab-start-internal.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3 (os testes antigos do passo 2 que esperam o `update` da variante mudam para esperar a RPC, no mesmo commit).
- [ ] **Passo 5:** commit `feat: início exige a original em alta e não regrava a enviada`.

### Tarefa 12: a fila sai na hora com `original_baixa`

**Files:**
- Modify: `Y/ab-rotate-phases.ts:123-128`
- Test: `T/youtube/ab-fila-inicio.test.ts`

**Interfaces:**
- Consumes: `codigo` da Tarefa 11.
- Produces: `sairDaFilaPorOriginalBaixa(supabase, queued: TesteDaFila): Promise<void>` (privada): `update { config: { ...config, queue_start_failures: MAX_TENTATIVAS_DA_FILA } }` com `.eq('id').eq('status','draft')`; `queue_start_after` não é tocado (fica nulo); aviso só se `claimAlert(supabase, 'ab-queue-original:<id>', '30 days')`: `fanOutToSiteAdminsDetailed` com `title: 'A/B: o teste saiu da fila'`, `message: 'O teste "<nome>" saiu da fila porque a original do vídeo está em baixa resolução. Envie a original em alta para iniciar. A data marcada foi perdida: escolha outra ao recolocar na fila.'`, `dedupKey: 'ab-queue-original:<id>'`.

- [ ] **Passo 1: testes que falham** (10b): `1ª passada com codigo original_baixa → status draft, queue_start_after nulo, config.queue_start_failures 7, um aviso, adiarInicioDaFila não chamado`; `2ª passada (recolocado e de novo original_baixa) → nenhum aviso novo`; `outro erro → adiarInicioDaFila como hoje`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-fila-inicio.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS.
- [ ] **Passo 5:** commit `feat: fila tira na hora o teste sem original em alta`.

### Tarefa 13: restauração com reserva quando a enviada some (D11, settle)

**Files:**
- Modify: `Y/ab-settle.ts` (`Retrato`, `lerRetratoPadrao` :197, `fonteDoOriginal` :107 e os três usos :260, :304, :407, `restaurarCampos` :404-417), `Y/ab-restore.ts` (lista comentada de `motivo`), `Y/ab-restore-avisos.ts`, `Y/ab-variant-dhash.ts` (`dhashDasVariantes` :62-73), `Y/ab-watchdog-drift.ts:159` (repassa o id)
- Test: `T/youtube/ab-settle.test.ts`, `T/youtube/ab-variant-dhash.test.ts`, `T/youtube/ab-watchdog-nova-tentativa.test.ts`

**Interfaces:**
- Produces: `Retrato.original?: { vigenteId: string | null; vigenteOrigem: 'publica' | 'enviada' | null; reservaUrl: string | null }` (opcional: retratos falsos antigos seguem válidos); `fonteDoOriginal(r): { principal: string | null; reserva: string | null }` (reserva só com vigente `enviada`, `ehCopiaNoBlob` e ≠ principal); `export const MOTIVO_ORIGINAL_AUSENTE = 'original_enviada_ausente'`; `avisarOriginalAusente(supabase, t: { id; site_id; name }): Promise<void>` em `ab-restore-avisos.ts` (`claimAlert(supabase, 'ab-original-ausente:<id>', '30 days')`; mensagem: `'A original enviada do teste "<nome>" não está mais guardada. O vídeo voltou para a cópia pública. Abra o teste e envie a original de novo.'`).

Regra (C1 de Phil): `dhashDasVariantes`, ao preencher o dHash da variante `is_original`, grava também `update ab_test_originais set dhash = $1 where id = <original_vigente_id> and dhash is null and blob_url = <url medida>` (a mesma guarda F-P7); o chamador passa `original_vigente_id` (`Retrato.original.vigenteId` no settle; a leitura do teste no vigia). Sem isso a variante e a linha divergem e a próxima aplicação apaga o dHash medido.

Regra: em `restaurarCampos`, destino `original`: `fetchVariantImageBuffer(principal)`; `YouTubeApiError` com `chamada === 'blob'` e `status === 404` e `reserva` → lê a reserva e escreve; campo `montar(c, { estado: 'ok', escreveu: true, motivo: MOTIVO_ORIGINAL_AUSENTE })`; marca `ausente_desde` (`.is('ausente_desde', null)`); `Sentry.captureMessage(..., 'warning')`; `avisarOriginalAusente` (falha só vai ao Sentry). Sem reserva: o comportamento de hoje (`falhou`).

- [ ] **Passo 1: testes que falham** (critérios 13, 14, 14b):
  - `pausa com enviada vigente → setThumbnail recebe o buffer do blob enviado`; `encerrar → idem`.
  - `enviada 404 + reserva → setThumbnail com o buffer da pública, restore_status.thumbnail { estado 'ok', motivo 'original_enviada_ausente' }, ausente_desde gravado, avisarOriginalAusente chamado uma vez`.
  - `enviada 404 sem reserva → falhou`.
  - `vigente publica 404 → falhou (sem reserva, a mesma URL)`.
  - `nova tentativa do vigia com enviada 404 → usa a reserva` (em `ab-watchdog-nova-tentativa.test.ts`).
  - `lerRetratoPadrao traz original com vigenteOrigem e reservaUrl`.
  - `variante original e linha vigente sem dHash → depois do settle as duas têm o mesmo dHash; linha com blob_url diferente não é tocada; linha com dHash já preenchido não muda` (P C1).
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-settle.test.ts test/youtube/ab-watchdog-nova-tentativa.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: restauração cai para a pública quando a enviada some`.

### Tarefa 14: rotação e retomada com a enviada ausente

**Files:**
- Modify: `Y/ab-settle.ts` (`MotivoSaida` :22, `caminhoDe`), `Y/ab-rotate-phases.ts` (laço :247-400: `nextVariant` declarado fora do `try`; `catch` :390), `Y/ab-resume.ts:208-223`
- Test: `T/youtube/ab-rotate-falha-api.test.ts`, `T/ab-actions-resume.test.ts`

**Interfaces:**
- Consumes: Tarefa 13 (`MOTIVO_ORIGINAL_AUSENTE`).
- Produces: `MotivoSaida` ganha `'original_enviada_ausente'`, com `caminhoDe` igual ao de `falha_api` (`de ['active'], para 'paused', endReason 'falha_api'`, `status_note` de `op.statusNote`); `MSG_ORIGINAL_AUSENTE_RETOMADA = 'A original enviada não está mais guardada. Envie de novo para retomar.'` em `Y/ab-resume.ts`.

Regra (spec 5.3): no `catch` da rotação, antes de `contarFalhaDaRotacao`: `err instanceof YouTubeApiError && err.chamada === 'blob' && err.status === 404 && nextVariant?.is_original` e a vigente lida (`select origem from ab_test_originais where id = test.original_vigente_id`) é `enviada` → `settleOnAir(test.id, { siteId, destino: ORIGINAL, motivo: 'original_enviada_ausente', statusNote: 'pausado: a original enviada não está mais guardada', seqEsperado: seqReivindicado ?? test.restore_seq, prazo: Math.min(Date.now() + 55_000, inicioDaFuncao + PRAZO_FIM_DA_ROTA_MS) })` e `continue` (sem contar falha). A seleção de testes ativos passa a trazer `original_vigente_id`. Na retomada, `!aplicado.ok` com `aplicado.erroApi?.chamada === 'blob' && aplicado.erroApi.status === 404 && proxima.is_original` → mesma gravação de `restore_status` de hoje, `ausente_desde` na vigente (se `enviada`) e `erro(MSG_ORIGINAL_AUSENTE_RETOMADA)`.

- [ ] **Passo 1: testes que falham** (14b; [PP-5], [PP-7]):
  - `vez da A, enviada 404 → settleOnAir chamado uma vez com motivo original_enviada_ausente e seqEsperado; contarFalhaDaRotacao não conta`.
  - `404 numa variante B → settleOnAir não chamado com o motivo novo`.
  - `vez da A, vigente publica e 404 → caminho falha_api de hoje, não o motivo novo`.
  - `caminhoDe('original_enviada_ausente').endReason === 'falha_api'` (o check de `end_reason` aceita; [PP-7]).
  - `retomada com a enviada 404 → error MSG_ORIGINAL_AUSENTE_RETOMADA e ausente_desde gravado; outra variante 404 → mensagem de hoje`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-rotate-falha-api.test.ts test/ab-actions-resume.test.ts` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: rotação pausa e retomada avisa quando a enviada some`.

### Tarefa 15: paridade Cowork/MCP

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts` (`projetarTeste` :1038 e os selects de `GET /ab-tests` e `GET /ab-tests/{id}`), `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (seção "GET /ab-tests/:id e list_tests"), `docs/cowork-pipeline-reference.md` (se a seção de A/B descreve o esquema do teste)
- Test: `T/ab-pipeline-api.test.ts`

**Interfaces:**
- Consumes: `SELECT_ORIGINAIS`, `montarOriginalDoTeste` (Tarefa 5).
- Produces: `out.original = { origem, largura, altura, publica_largura, publica_baixa, enviada_em, ausente } | null` (nulo para `title`); sem `enviado_por`, sem URL do Blob da enviada; `original_vigente_id`/`original_publica_id` continuam fora da lista fechada.

- [ ] **Passo 1: testes que falham** (critério 17): `get_test de teste com enviada → original com as sete chaves e sem enviado_por nem blob_url; list_tests traz o mesmo objeto; teste title → original null; JSON não contém original_vigente_id`.
- [ ] **Passo 2:** `npx vitest run test/ab-pipeline-api.test.ts` → FAIL.
- [ ] **Passo 3:** implementar; documentar o objeto no doc do Cowork; `api-registry.ts` não muda (nenhuma rota nova).
- [ ] **Passo 4:** → PASS. Semente da referência só no envio (seção 5, passo 6): `npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts`.
- [ ] **Passo 5:** commit `feat: original do teste no pipeline e no MCP`.

### Tarefa 16: envio no cliente e estado do assistente

**Files:**
- Create: `Y/ab-original-xhr.ts`, `Y/ab-envio-original-reducer.ts`, `T/youtube/ab-envio-original-reducer.test.ts`, `T/youtube/ab-original-xhr.test.ts` (`// @vitest-environment jsdom`)
- Modify: `AB/_components/ab-create-wizard.tsx` (`WizardState` :75, ações :89, reducer :166, `stepIsValid` :240), `Y/ab-wizard-reducer.ts:150` (mesma regra), `T/youtube/ab-wizard-reducer.test.tsx`

**Interfaces:**
- Consumes: `IOriginalDoTeste`, `MAX_BYTES`, `mensagemDaRecusa` (só os textos de tamanho, para a camada da tela), `obterOriginalDoTeste`.
- Produces:

```ts
export type RecusaDaOriginal = { motivo: MotivoRecusa | 'rede'; mensagem: string; largura?: number; altura?: number; bytes?: number }
export interface EnvioOriginal { fase: 'parado' | 'enviando' | 'caiu' | 'recusado'; progresso: number; arquivo: File | null; recusa: RecusaDaOriginal | null }
export type AcaoEnvioOriginal =
  | { type: 'SET_ORIGINAL'; original: IOriginalDoTeste | null }
  | { type: 'ENVIO_ORIGINAL_INICIO'; arquivo: File } | { type: 'ENVIO_ORIGINAL_PROGRESSO'; progresso: number }
  | { type: 'ENVIO_ORIGINAL_FIM'; original: IOriginalDoTeste } | { type: 'ENVIO_ORIGINAL_CAIU' }
  | { type: 'ENVIO_ORIGINAL_RECUSADO'; recusa: RecusaDaOriginal } | { type: 'ENVIO_ORIGINAL_CANCELADO' }
export const ENVIO_PARADO: EnvioOriginal
export function reduzirEnvioOriginal(s: { original: IOriginalDoTeste | null; envioOriginal: EnvioOriginal }, a: AcaoEnvioOriginal): { original: IOriginalDoTeste | null; envioOriginal: EnvioOriginal }
export function podeAvancarComOriginal(s: { type: TestType | null; original: IOriginalDoTeste | null; envioOriginal: EnvioOriginal }): boolean
export function motivoDoBloqueio(s: ...): string | null   // "A original do vídeo está em baixa resolução. Envie a original para iniciar." (texto do mockup B/G)
export function enviarOriginalXhr(testId: string, arquivo: File, onProgresso: (p: number) => void): { promessa: Promise<{ ok: true; original: IOriginalDoTeste } | { ok: false; recusa: RecusaDaOriginal }>; cancelar: () => void }
export function removerOriginalFetch(testId: string): Promise<{ ok: true; original: IOriginalDoTeste } | { ok: false; recusa: RecusaDaOriginal }>
```

Regras: `podeAvancarComOriginal` = tipo `title` → `true`; tipo de imagem com `original === null` → `false` (esperando a leitura), com `motivoDoBloqueio` "Conferindo a original do vídeo…" e, se a leitura falhou, mensagem com "Tentar de novo" (Y R1-3b/c); senão `!(original.publicaBaixa && original.origem !== 'enviada') && envioOriginal.fase !== 'enviando'`. `CANCELADO` volta a `parado` e zera `arquivo` (mockup: "Cancelar envio" volta a B sem o arquivo); `CAIU` guarda o `arquivo` para "Tentar de novo". `enviarOriginalXhr`: recusa `file.size > MAX_BYTES` antes de abrir o XHR (texto `tamanho` com `bytesRecebidos`); 413 sem JSON → `tamanho`; `onerror`/`ontimeout` → `rede`; corpo JSON → como veio. **`xhr.timeout = 70_000` (`maxDuration` 60 s + 10 s, P C2)** para a tela não declarar "caiu" com o servidor ainda trabalhando. O `File` nunca vai a `saveDraft`. Os dois `stepIsValid(2, …)` e o "Iniciar teste" (passo 4) passam a exigir `podeAvancarComOriginal`.

- [ ] **Passo 1: testes que falham:** `stepIsValid(2) falso com pública baixa e origem publica; verdadeiro com enviada; falso durante 'enviando'; falso com tipo de imagem e original null; title ignora`; `CANCELADO zera arquivo e volta a parado`; `CAIU guarda o arquivo`; `FIM põe a original e volta a parado`; `XHR: 2,5 MB recusado sem abrir conexão; 413 sem JSON → tamanho; erro de rede → rede; progresso chega ao callback; cancelar chama abort`; Review Focus 2: `depois de CAIU, SET_ORIGINAL com origem enviada (releitura) → stepIsValid verdadeiro`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-envio-original-reducer.test.ts test/youtube/ab-original-xhr.test.ts test/youtube/ab-wizard-reducer.test.tsx` → FAIL.
- [ ] **Passo 3:** implementar; o reducer inline delega as ações novas a `reduzirEnvioOriginal`.
- [ ] **Passo 4:** → PASS.
- [ ] **Passo 5:** commit `feat: estado do envio da original no assistente`.

### Tarefa 17: telas do assistente (A–G)

**Files:**
- Create: `AB/_components/original-do-teste.tsx`, `T/youtube/ab-original-do-teste.test.tsx` e `T/ab-wizard-original.test.tsx` (`// @vitest-environment jsdom`)
- Modify: `AB/_components/step-variantes.tsx` (bloco acima do cartão A, só `thumbnail`/`combo`), `AB/_components/step-revisar.tsx` (linha "Original para restaurar", "Iniciar teste" com `aria-disabled` + motivo + "Enviar original"), `AB/_components/ab-create-wizard.tsx` (despacha `SET_ORIGINAL` a partir de `createAbTest`, de `updateAbTestType` (troca de tipo do rascunho, Y R1-3b) e, em F, de `obterOriginalDoTeste(existingDraftId)` no carregamento; foco na área ao voltar de G; **`goNext` e `handleSubmit(true)` checam `podeAvancarComOriginal`**: o Próximo usa `aria-disabled`, então o `onClick` dispara, Y R1-4)

**Interfaces:**
- Consumes: Tarefa 16.
- Produces: `<OriginalDoTeste original envio onEscolher(file) onCancelar() onTentarDeNovo() onUsarPublica() focoRef />`, props explícitas (sem server action importada no cliente; callbacks do wizard).

Desenho e textos: os do mockup aprovado (`index.html`, estados A–H), com as trocas do spec 6.2: E3 cobre `ilegivel` e `armazenamento` com os textos da Tarefa 7 e o fecho "Sem a original guardada, o teste não inicia."; E2 com a pública baixa: "O envio de <nome> parou. A original não foi guardada, e o teste só inicia com ela. Tente de novo."; D usa `recusa.mensagem` do servidor (sem prefixo). Tokens com rgba/hex literais (sem `color-mix`), botões 36 px (44 px a ≤ 480 px), área de envio `label` de `input type=file` com mínimo de 120 px e foco visível; "Escolher arquivo" a ≤ 480 px. Ao cancelar ou cair: `obterOriginalDoTeste` e `SET_ORIGINAL` (se o servidor terminou, mostra C).

- [ ] **Passo 1: testes que falham:** `pública 1280 → A com link "Enviar original"`; `pública baixa → B com "Arquivo original (obrigatório)", Próximo aria-disabled com motivo visível`; `enviada → C com "Não será usada"/"Será usada"; pública baixa só "Trocar arquivo"; pública alta também "Remover e usar a pública"`; `recusa → D com a mensagem do servidor`; `enviando → barra e "Cancelar envio"`; `caiu → "Tentar de novo" reenvia o mesmo File`; `F: existingDraftId com enviada → abre em C`; `G: Iniciar aria-disabled, "Enviar original" leva ao passo 2 e foca a área`; `teste title → bloco ausente e linha de G ausente`; nenhum "undefined" no DOM.
  - **Wizard real (Y R1-4)**, no padrão de `test/ab-wizard-variante-vazia.test.tsx` (`vi.mock` de `actions`; atravessa o `stepIsValid` inline que vai para produção): `createAbTest` devolve `original.publicaBaixa = true`, `origem 'publica'`: (i) Próximo com `aria-disabled="true"` e o motivo visível; (ii) clicar não muda de passo; (iii) no passo 4, "Ativar teste" não chama `startAbTest`; (iv) depois do envio aceito (XHR simulado), o Próximo libera. Troca de tipo `title` → `thumbnail` com pública 480 → Próximo bloqueado até `updateAbTestType` devolver `original`.
  - **Abort tardio no componente (Y M-5, Review Focus 2):** XHR simulado com `onerror` e `obterOriginalDoTeste` devolvendo `enviada` → mostra C.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-do-teste.test.tsx test/youtube/ab-step-variantes.test.tsx` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: original em alta no assistente`.

### Tarefa 18: ficha do teste (H)

**Files:**
- Create: `AB/_components/original-guardada.tsx`, `T/youtube/ab-original-guardada.test.tsx`
- Modify: `AB/[testId]/page.tsx` e a montagem do detalhe em `AB/queries.ts` (`toDetailView` :931 recebe `original`)

**Interfaces:**
- Consumes: `IOriginalDoTeste`, `enviarOriginalXhr` (o envio na ficha usa o mesmo XHR), `MSG_THUMB_MUDOU`.

Linha "Original guardada": origem ("Pública do YouTube" / "Enviada por você" ou "Enviada"), data e "L×A". `publicaBaixa && origem 'publica'`: `active` → "Pause o teste para enviar a original em alta."; `paused`/`draft`/`queued` → aviso + "Enviar original"; Retomar continua livre (D7). `ausente` → "A original enviada não está mais guardada" + "Enviar original". `status_note`/erro do início com `MSG_THUMB_MUDOU` → a mesma frase.

- [ ] **Passo 1: testes que falham:** um por estado acima, mais `title → nada`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-guardada.test.tsx` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: original guardada na ficha do teste`.

### Tarefa 19: o 5º caso de D, "não é a mesma imagem" (D13) — AGUARDA O DONO

Isolada de propósito: removê-la não mexe em nenhuma outra tarefa (a coleta de `dhash_distancia_publica` já está na Tarefa 7; o check da tabela já aceita `diferente_da_publica`). **Só executar com o "pode" do dono para o 5º caso.** Sem ela, a enviada pode ser outra imagem: vira a A, fica no ar depois do teste, e a fila/drift não acusam (a vigente e a variante têm o mesmo dHash). Recomendação do Logan e deste plano: recusar.

**Files:**
- Modify: `Y/ab-original-envio.ts` (passo 9 de `validarArquivoDaOriginal`; `mensagemDaRecusa('diferente_da_publica')`), `Y/ab-original-envio.ts` (`enviarOriginal`: pública sem `dhash` → `dhashDoArquivo(publica.blob_url)`, cota 0), `AB/_components/original-do-teste.tsx` (D5 usa a mensagem do servidor; nada novo além do caso no teste)
- Test: `T/youtube/ab-original-envio.test.ts`, `T/youtube/ab-original-enviar.test.ts`

- [ ] **Passo 1: testes que falham** (critério 5, caso D13): `imagem diferente (distância > 6) → diferente_da_publica, mensagem "<nome> não foi aceito. Não parece a mesma imagem da thumbnail atual do vídeo. Envie o arquivo original dessa thumbnail."`; `distância 6 → ok`; `pública sem dhash e blob legível → mede pelo blob`; `sem base → ok com dhash_distancia_publica null`; `a recusa grava dhash_distancia_publica`.
- [ ] **Passo 2:** → FAIL. **Passo 3:** implementar. **Passo 4:** → PASS; seção 3.
- [ ] **Passo 5:** commit `feat: recusa original que não é a mesma imagem da pública`.

### Tarefa 20: prova local (suíte, build, ponta a ponta)

**Files:** `apps/web/e2e/ab-original-em-alta.spec.ts` e semente (Gio), capturas em `.superpowers/sdd/ab-lab/original-em-alta/prova-shots/`.

- [ ] **Passo 1:** suíte inteira em background: `cd W/apps/web && npx vitest run > /tmp/oea-suite.log 2>&1` (~160 s); integração das Tarefas 2–4 no `bythiago_int`. Esperado: 0 falhas; só falhas no contexto.
- [ ] **Passo 2:** `cd W/apps/web && cp .env.local .env.production.local && npx next build --webpack > /tmp/oea-build.log 2>&1; rm -f .env.production.local; tail -5 /tmp/oea-build.log` → build ok.
- [ ] **Passo 3 (Gio):** CMS autenticado local (runbook `docs/ops/runbook-cms-e2e-local.md`), vídeo de semente com pública 480×360 e outro 1280×720; percorre A–H a 1440 e 390, claro e escuro; compara com `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/shots/r4-*.png`; `scrollWidth` = largura a 390; Tab até a área de envio; envia um JPEG de celular sintético (orientação 6, GPS) e confere no Blob local que a saída não tem EXIF; nenhum "undefined" (critério 16). Veredito em texto no ledger, capturas em arquivo.

### Tarefa 21: medição com o arquivo-mestre real do dono (antes da promoção) [PP-8]

Depende do dono enviar um arquivo-mestre de uma thumbnail do canal (pedido feito só na hora, memória "comando só na hora"). Script: `apps/web/scripts/medir-original-mestre.ts <arquivo> <youtubeId>` (somente leitura: `probeThumb` cota 0, `validarArquivoDaOriginal`, imprime caminho, dimensões, bytes e distância dHash contra a `hqdefault` e a `maxresdefault`).

- [ ] **Passo 1:** escrever o script (commit `chore: medição do arquivo-mestre da original`).
- [ ] **Passo 2:** rodar com o arquivo do dono. **Critério de saída:** distância ≤ 4 → segue; 5 ou 6 → segue e anota o risco no ledger; > 6 → **não promover a Tarefa 19** (sem ela o envio segue) e levar ao controlador com o número. Anotar também o caminho (`intacto`/`sem_metadados`/reencode) e o tamanho.

---

## 5. Portão e envio

**Portão (antes de qualquer push):**
1. Phil (Opus, `medium`): migration, backfill, RLS, volume, conferências do dia; Yannis (Opus, `medium`): concorrência das funções, ordem da validação, rota, erros, rotação; Gio (Sonnet, `medium`): o roteiro da Tarefa 20 e "como se prova pronto". Revisam o plano antes de executar e o lote no fim; conserta-se até haver acordo (sem BLOQUEIA/CORRIGE aberto).
2. O dono decide o 5º caso (Tarefa 19) e manda o arquivo-mestre (Tarefa 21).

**Envio (junto do próximo push com código do lote `lote/ab-p4b-a`; nenhum push só deste plano):**
1. Ordem do CLAUDE.md: **migration antes do código**. Numa árvore em dia com `origin/staging`: conferir que o carimbo de `M` é posterior à última migration de `origin/staging` (se não, `npm run db:new ab_original_em_alta` de novo e mover o corpo; `cmp` idêntico); reservar a vez na fila `.superpowers/sdd/a5/fila-do-db-push.md`.
2. Antes do push, leitura de produção (só `select`, `supabase db query --linked`): `select count(*) from ab_tests where test_type in ('thumbnail','combo')` e as três originais de hoje (ids e `dimensions`) no ledger.
3. `npm run db:push:prod` (depois do portão; o agente roda, memória "comando do dono"); tipos já gerados na Tarefa 2 conferidos contra produção (`npx supabase gen types typescript --linked` sem diff).
4. Conferências logo depois da migration (spec seção 3 passo 7): `original_publica_id is null` em `thumbnail`/`combo` = 0; `registro = 'backfill'` = o `count(*)` de `thumbnail`/`combo` lido no passo 2 (não 3: contam também playoffs, testes fora do ytimg e criados na janela, P menor 4); variante original × vigente com `blob_url` ou `dhash` divergentes = 0 linhas; `resultado = 'recusado' and blob_url is not null` = 0.
5. Push a `staging` (≤ 3 por dia, crédito da Vercel até 27/10), CI verde, promoção ao `main` na janela combinada; **repetir a conferência 4** depois do deploy da Vercel (a janela entre migration e código deixa o `createAbTest` antigo criar teste sem linha; `ab_garantir_original_publica` cobre na leitura, a conferência prova). Se a conferência de divergência variante × vigente der > 0 (o passo 2 antigo regravou a variante e não a linha, P menor 5), rodar só nesses ids: `update ab_test_originais o set blob_url = v.blob_url, dhash = v.thumbnail_dhash, largura = split_part(v.dimensions,'x',1)::int, altura = split_part(v.dimensions,'x',2)::int from ab_tests t join ab_test_variants v on v.test_id = t.id and v.is_original where o.id = t.original_vigente_id and o.registro = 'backfill' and o.origem = 'publica' and v.dimensions ~ '^[1-9][0-9]*x[1-9][0-9]*$' and (o.blob_url is distinct from v.blob_url or o.dhash is distinct from v.thumbnail_dhash)` e conferir de novo = 0.
6. Semente da referência do Cowork (Tarefa 15). `PIPELINE_COWORK_KEY`: só a permanente.
7. Ledger: "envio da original: verificado em produção só por leitura; primeiro envio real pelo dono pendente".

## 6. Riscos

- **D13 depende do dono** (Tarefa 19). Sem ela, uma imagem diferente vira a A do experimento e fica no ar depois do teste. Com ela, um arquivo-mestre com distância > 6 seria recusado: a Tarefa 21 mede antes.
- **`maxDuration = 60`** fixo; a Tarefa 8 prova ≤ 20 s no pior caso local (16 Mpx, escada inteira); a CPU real da Vercel não foi medida (a margem 3× cobre). Se a rota estourar, o envio cai em E2 (a tela relê e mostra a verdade do servidor); o `del` do órfão não roda se o processo morre.
- **Decisão do plano fora do spec** (Tarefa 11): vigente `enviada` com `publica.dhash` nulo compara contra `vigente.dhash`, depois de medir a pública guardada no Blob (r2). Afeta só testes legados sem dHash (1 de 3 em produção tem).
- **Reducer duplicado** (`ab-create-wizard.tsx` inline e `Y/ab-wizard-reducer.ts`): os dois `stepIsValid` chamam `podeAvancarComOriginal`; a unificação fica fora deste lote.
- **Captura sem `ytimg`** (`createAbTest` com `thumbnail_hq_url` de outra origem): a linha nasce com `registro = 'backfill'`, não `captura`; declarado.
- Herdados do spec (seção 10): corrida troca × restauração em teste pausado, blob órfão se o processo morre entre `put` e `catch`, PNG de paleta que cresce, COM em JPEG que vai intacto, blobs substituídos não apagados.

---

## 7. Decisões da r2

Achados de Phil (P) e Yannis (Y) sobre a r1 (`a5d7d33eb`). Ruling do controlador: `maxDuration` fixo em 60 s (Y R1-5), a Tarefa 8 vira prova de pior caso ≤ 20 s (P C2) sem parar o plano por ruído; spec r6 leva B1 e R1-1. A Tarefa 19 (D13, aguarda o dono) segue isolada e intocada.

| Achado | Tarefa | Como ficou |
|---|---|---|
| P B1 reenvio com a enviada ausente | 9 (e spec 4.3 4b) | Idempotência exige `ausente_desde == null`; teste de reenvio com ausente |
| P C1 dHash medido só na variante | 13 | `dhashDasVariantes` grava também na linha vigente (guarda `dhash is null` e `blob_url`) |
| P C2 / Y R1-5 `maxDuration` | 8, 10, 16 | 60 s fixo; Tarefa 8 prova pior caso ≤ 20 s; XHR com `timeout` de 70 s |
| P C3 `status_do_teste` da pública | 3, 5 | A função sobrescreve com o status lido; `linhaDaPublica` não manda o campo |
| P C4 blob órfão no passo 2 | 11 | `try/del` e `del(retorno.blob_url)` |
| P menores 1, 2 e Y M-2 | 5 | `dimensions` nulo; `del` do blob no rollback; lote apaga e continua |
| P menor 3 | 11 | Mede a pública guardada antes de comparar com a enviada |
| P menores 4 e 5 | 5 (seção) | Contagem esperada de `backfill` lida antes; conserto da janela migration → código |
| P menor 6 | 9, 10 | `registrarRecusaAntesDoCorpo` só com número finito; Content-Length inválido segue ao corpo |
| P menor 7 | 2 | Testes de `23514` nos checks |
| Y R1-1 beco sem saída (spec r6) | 3, 11 | `p_so_publica`; passo 2 atualiza só a pública e desfaz |
| Y R1-2 pública sem dHash | 11 | Guarda não recusa; passo 2 decide |
| Y R1-3 tipo `title` e troca de tipo | 5, 16, 17 | RPC só para imagem; `updateAbTestType` devolve `original`; `original null` bloqueia |
| Y R1-4 testes na cópia morta | 17 | Teste do wizard real; `goNext` e `handleSubmit(true)` checam o predicado |
| Y R1-6 `queue_start_failures` | 3, 9 | Remoção dentro de `ab_registrar_original`; o app não escreve `config` |
| Y R1-7 leitura dupla do teste | 9, 10 | `prepararEnvio` única; a linha de status é gravada uma vez |
| Y R1-8 teste de concorrência fraco | 2 | Intercalação forçada; rodar contra a função sem trava |
| Y M-1, M-3, M-4, M-5, M-6 | 11, 10, 11, 17, 4 | Testes do legado `enviada`; `formData` com `catch`; sonda única; abort tardio no componente; guarda textual da ordem do playoff |
