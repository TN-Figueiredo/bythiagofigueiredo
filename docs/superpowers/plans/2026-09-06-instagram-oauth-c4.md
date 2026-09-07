# Instagram OAuth — C4: drop da unique global de `ig_media_id` (contract) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a janela C2→C4 aplicando a migration M2 (`drop constraint instagram_posts_ig_media_id_key`), remover o ramo de exclusão `c2c4dup` que só existia para essa janela, e deixar a receita de rollback escrita e provada.

**Architecture:** C1 (M1) criou a chave composta `instagram_posts_account_media_key (account_id, ig_media_id)` deixando-a **coexistir** com a unique global `instagram_posts_ig_media_id_key (ig_media_id)` de `supabase/migrations/20260507190000_instagram_feed.sql:49-50` — expand puro. Enquanto as duas coexistem, a 2ª linha de locale da mesma conta Instagram falha o upsert de `sync.ts` com `23505`, e C2 mascara esse ruído com um ramo `c2c4dup` que classifica o erro como `infra` **sem** incrementar `step_errors`. C4 é o passo *contract*: derruba a global (a composta passa a ser a única unique de `instagram_posts`), o ramo `c2c4dup` sai junto — no mesmo lote — e um `it` de ratchet em `sync.test.ts` impede que ele volte.

**Tech Stack:** PostgreSQL 17 via Supabase CLI (`npm run db:new` / `db:reset` / `db:types` / `db:push:prod`), PostgREST, `pg@8.13.1` (DDL direto nos testes DB-gated), Vitest 3.2.6 (`// @vitest-environment node` para código de servidor), Next.js 16.3.4 App Router, TypeScript 5 strict.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **C4**, §3.2 "M2 (C4)", §3.3 passo 6, §3.4, §5 linha "23505 na janela C2→C4", §6 (DB-gated), §7 passo 4 e o parágrafo "Depois de C4" do rollback.

**Índice dos planos:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md` (ordem `A → A4 → A5 → B → C1 → C2 → C4 → C3`).

## Global Constraints

Herdadas do README (`docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`, seção *Global Constraints*) — valem integralmente aqui; abaixo, as que este commit realmente exercita, com os valores exatos:

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` e `apps/web/src/lib/` — `src/lib/instagram/*` é o desta feature; um `grep` só em `apps/web/src` **não vê** `apps/web/lib`.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `instagram` cai no catch-all `@/*` → `src/`.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Migrations: **sempre** `npm run db:new <nome>` (nunca criar o arquivo à mão, nunca `npx supabase migration new` — C4 cai dias depois de C1 e o timestamp fora de ordem é risco vivo); idempotentes (`drop … if exists` antes de `create`); `db:reset` → `db:types` → commit → `db:push:prod`.
- Banco local tem resíduo de rodadas de revisão: `npm run db:reset` **antes** de validar qualquer coisa DB-gated.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; fixtures temporais relativas ou com `vi.useFakeTimers`; **fix de teste vai no MESMO commit da mudança que o exige** (bisectabilidade).
- **DB-gated MUST ficar em `apps/web/test/integration/`** — a CI seleciona por path (`.github/workflows/ci.yml:137` roda `HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/`). Fora desse diretório o arquivo roda no job comum, sem `HAS_LOCAL_DB`, e `describe.skipIf(skipIfNoLocalDb())` pula a suíte inteira **em silêncio**.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`git reset` (2+ terminais rodam em paralelo em `staging`); **push só após verificação local completa** (cada push dispara builds na Vercel).
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- Definições nomeadas do spec valem por nome: horários `"0 11 * * *"` (refresh) / `"0 13 * * *"` (sync), `REGRA-PII-NTFY`.

### Específicas de C4

- **C4 é UM commit no spec (§0) e três commits locais neste plano.** Os três são pushados juntos, e nenhum deles deixa a árvore vermelha. Isso é seguro **porque o rollback de C4 não é `git revert`**: é a receita SQL da Task 3 (`delete` das cópias extras + recriar a constraint). A granularidade local é livre; a granularidade de *promoção* não é — a promoção acontece uma vez, ao fim do plano.
- **Ordem de entrega (MUST): banco primeiro, código depois.** `db:push:prod` de M2 **antes** de promover `staging→main`. M2 só relaxa (a `onConflict: 'account_id,ig_media_id'` que C2 já usa continua correta), então aplicá-la sob o código de C2 é inócuo; o inverso — código sem o ramo `c2c4dup` rodando ainda sob a unique global — devolveria `step_errors > 0` e um push diário "Instagram cron degraded" em cima de um `23505` esperado.
- **Nenhuma mudança de `vercel.json`, de agenda de cron, de `env.ts` ou de UI entra em C4.** Se o diff final tocar qualquer um deles, o escopo vazou.
- **`npm run db:types` roda, mas o diff esperado é vazio:** constraints `UNIQUE` não aparecem em `apps/web/src/types/database.types.ts`. Diff não-vazio ⇒ algo além de M2 entrou no `db:reset` — investigar antes de commitar.

---

## Portão de tempo e pré-requisitos (BLOQUEANTE — executar antes da Task 1)

§0 e §7 passo 4: C4 entra **depois do primeiro ciclo das 13:00 com C2 em produção** e **em até 2 dias após a promoção de C2**, e **antes de C3**. Nenhuma task começa antes de todas as caixas abaixo estarem marcadas.

`PROD_DB_URL` é a connection string do project `novkqtvcnsiwhkxihurk` (senha em keychain/1Password — Supabase Dashboard → Project Settings → Database), o mesmo mecanismo que `scripts/smoke-test-lgpd.sh:76` usa. As consultas também podem ser coladas no SQL Editor do Dashboard.

- [ ] **G1 — C2 está em produção e o instante da promoção está registrado.**

```bash
git log main --grep='feat(instagram): renovação observável' -1 --format='%h %cI'
```

Anote o `%cI` (ISO-8601) como `C2_PROMOVIDO`. Zero linhas ⇒ C2 não foi promovido ⇒ **C4 não começa**.

- [ ] **G2 — pelo menos um ciclo agendado das 13:00 UTC rodou depois de C2.**

```bash
psql "$PROD_DB_URL" -t -A -c "
  select count(*) from public.instagram_sync_log
   where mode = 'daily'
     and started_at > timestamptz '<C2_PROMOVIDO>'
     and extract(hour from started_at at time zone 'UTC') = 13"
```

Esperado: **≥ 1**. A fonte é `instagram_sync_log` e não `cron_health` de propósito — `cron_health` guarda só o último sucesso, e o `curl` manual de §7 passo 3 o sobrescreve; a linha `mode='daily'` às 13:0x é a prova de que o **agendador** rodou.

- [ ] **G3 — a janela de 2 dias.**

```bash
psql "$PROD_DB_URL" -t -A -c "select now() - timestamptz '<C2_PROMOVIDO>' <= interval '2 days'"
```

Esperado: `t`. **Se der `f`:** a janela é um teto para quanto tempo o mascaramento `c2c4dup` pode ficar de pé, não uma licença para adiar — registre o atraso como desvio no corpo do commit da Task 1 (`Desvio §7: janela de 2 dias excedida em <N> h`) e execute C4 **imediatamente**. C3 permanece bloqueado até C4 estar em produção.

- [ ] **G4 — nenhuma linha `transient:`/`permanent:` inesperada na janela** (§7 passo 3).

```bash
psql "$PROD_DB_URL" -t -A -F'|' -c "
  select started_at, mode, status, left(error_message, 120)
    from public.instagram_sync_log
   where started_at > timestamptz '<C2_PROMOVIDO>' and status = 'failed'
   order by started_at desc limit 20"
```

Esperado: só linhas `infra: duplicate key value … instagram_posts_ig_media_id_key` (essas **são** a janela) e nada mais. Qualquer `transient:` ou `permanent:` ⇒ **pare**: é um episódio de token real, e C4 não é o commit que o resolve.

- [ ] **G5 — backlog de migrations vazio antes de acrescentar M2.**

```bash
npm run db:which
npx supabase@2.98.2 migration list
```

Esperado: nenhuma migration local pendente de aplicação em remoto. Pendências ⇒ aplicar (`npm run db:push:prod`) **antes** de gerar M2 — o `db:push:prod` de C4 aplica tudo o que estiver pendente.

- [ ] **G6 — banco local limpo.**

```bash
npm run db:start
npm run db:reset
```

Esperado: reset conclui sem erro, com M1 (C1) aplicada. Confirme:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -A -c "
  select conname from pg_constraint
   where conrelid = 'public.instagram_posts'::regclass and contype = 'u' order by conname"
```

Esperado, **antes** da Task 1: duas linhas — `instagram_posts_account_media_key` e `instagram_posts_ig_media_id_key`. Só uma ⇒ M1 não está aplicada (ou M2 já entrou) ⇒ pare e investigue.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/<timestamp>_instagram_posts_drop_global_media_unique.sql` (**novo**, gerado por `npm run db:new`) | M2: derruba a unique global, limpa as chaves `c2c4dup:` fósseis de `ops_alert_state`, e carrega a receita de rollback como bloco de comentário `-- ROLLBACK` | 1, 3 |
| `apps/web/test/integration/ops-alert-claim.test.ts` (**modificar** — criado em C1) | Ratchet de catálogo: pós-M2 `instagram_posts` tem **exatamente uma** unique, a composta. Também recebe a prova executável da receita de rollback | 1, 3 |
| `apps/web/test/integration/instagram-accounts-public-view.test.ts` (**modificar** — criado em A/A3, estendido por C1) | Prova comportamental: 2 posts com o mesmo `ig_media_id` em contas diferentes passam; o mesmo par `(account_id, ig_media_id)` ainda dá `23505` | 1 |
| `apps/web/src/app/api/cron/instagram-sync/route.ts` (**modificar** — reescrito em C2) | Remoção do ramo `c2c4dup` do tratamento de erro do sync | 2 |
| `apps/web/src/app/api/cron/instagram-token-refresh/route.ts` (**modificar** — reescrito em C2) | Remoção do ramo `c2c4dup` do tratamento de erro do refresh (§3.4: "mesma ordem de §3.3") | 2 |
| `apps/web/test/instagram/sync.test.ts` (**modificar** — estendido em A e C2) | O `it` que §3.3 passo 6 exige: assere que o ramo saiu, e que a `onConflict` composta ficou | 2 |

**Nenhum leitor muda** (§3.2, cauda de M2): `apps/web/src/lib/instagram/queries.ts:14` e `apps/web/src/app/go/linktree/_lib/queries.ts:120` leem posts por service client e são imunes à mudança de constraint — depois de M2 eles simplesmente enxergam a cópia da própria conta. Não os edite; se um deles aparecer no diff, o escopo vazou.

---

### Task 1: Migration M2 — derrubar a unique global de `ig_media_id`

**Files:**
- Create: `supabase/migrations/<timestamp>_instagram_posts_drop_global_media_unique.sql` (o caminho exato é o que `npm run db:new` imprime — **nunca** escolher o timestamp à mão)
- Test: `apps/web/test/integration/ops-alert-claim.test.ts` (modificar — substitui o `it` de coexistência que C1 deixou)
- Test: `apps/web/test/integration/instagram-accounts-public-view.test.ts` (modificar — acrescenta um `it`)

**Interfaces:**
- Consumes (de C1/M1): a constraint `instagram_posts_account_media_key UNIQUE (account_id, ig_media_id)` em `public.instagram_posts`; a tabela `public.ops_alert_state (key text primary key, last_at timestamptz)`; os arquivos DB-gated `test/integration/ops-alert-claim.test.ts` e `test/integration/instagram-accounts-public-view.test.ts`, ambos com `describe.skipIf(skipIfNoLocalDb())`.
- Consumes (de A/`20260507190000_instagram_feed.sql`): `instagram_posts_ig_media_id_key UNIQUE (ig_media_id)` (`:49-50`); `instagram_accounts` com `UNIQUE (site_id, locale)` e `CHECK (locale IN ('pt','en'))`; `instagram_posts` com `NOT NULL` em `account_id, ig_media_id, media_type, permalink, ig_timestamp` e `CHECK (media_type IN ('IMAGE','VIDEO','CAROUSEL_ALBUM'))`.
- Produces: `public.instagram_posts` com **uma** única constraint `UNIQUE` — `instagram_posts_account_media_key`. Nenhuma assinatura de TypeScript muda; `apps/web/src/types/database.types.ts` fica idêntico.

- [ ] **Step 1: Escrever o teste de catálogo que falha (`ops-alert-claim.test.ts`)**

C1 deixou **DOIS** `it` naquele arquivo presos à coexistência das duas constraints. Os dois passam a
estar errados a partir desta task e os dois são corrigidos aqui, no mesmo commit:

```bash
grep -n "instagram_posts_ig_media_id_key\|instagram_posts_account_media_key\|coexist" \
  apps/web/test/integration/ops-alert-claim.test.ts
```

Se o `grep` vier vazio, repita em todo o diretório (`grep -rn "instagram_posts_account_media_key" apps/web/test/integration/`) e corrija onde estiverem.

**(a)** `it('keeps BOTH unique constraints on instagram_posts after M1 (C4/M2 drops the global one)')`
— apague o `it` inteiro e escreva no lugar o `it` de catálogo abaixo.

**(b)** `it('the composite key allows a second row on the SAME account only for a new ig_media_id, and
the global key still blocks two accounts sharing one ig_media_id (until C4)')` — **não** apague; o
próprio C1 marcou a virada com o comentário `// C4 (M2) derruba instagram_posts_ig_media_id_key e
ESTA asserção vira toBeNull().` Troque as duas últimas linhas do corpo:

```ts
    // Depois de M2 a global se foi: a outra conta ganha a sua própria cópia.
    const crossAccount = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountB, ig_media_id: mediaId })
    expect(crossAccount.error).toBeNull()
```

e ajuste o nome do `it` para `'the composite key blocks the same (account_id, ig_media_id) and, after
M2, allows two accounts to share one ig_media_id'`.

**Nada entra no escopo de módulo:** C1 já criou o arquivo com `import { Client, Pool } from 'pg'` e
com `const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'`
no topo. Redeclarar qualquer um dos dois é `Identifier 'PG_URL' has already been declared` e o arquivo
inteiro para de carregar — use os que já estão lá.

E o `it` de catálogo, no lugar de (a):

```ts
it('M2 leaves exactly one unique on instagram_posts — the composite one', async () => {
  const client = new Client({ connectionString: PG_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.instagram_posts'::regclass
          and contype = 'u'
        order by conname`,
    )
    // Antes de M2 seriam duas (M1 é expand: a composta COEXISTE com a global).
    // Depois de M2 a global some e a composta é a única — é isso que libera a
    // 2ª linha de locale a ter a sua própria cópia dos posts (§3.2, objetivo 1).
    expect(rows.map((r) => r.conname)).toEqual(['instagram_posts_account_media_key'])
  } finally {
    await client.end()
  }
})
```

- [ ] **Step 2: Escrever o teste comportamental que falha (`instagram-accounts-public-view.test.ts`)**

Acrescente ao `describe.skipIf(skipIfNoLocalDb())('M1 (C1) — allow-lists, DML fechado e schema novo', …)`
— o bloco que **C1** acrescentou ao fim do arquivo. Ele é o único que importa `seedSite`; o `describe`
de A3, acima, usa `admin`/`anon` + `seedRbacScenario` e não serve. Nomes reais desse bloco: service
client `svcC1`, client `pg` `pgC1`, array de limpeza `siteIdsC1`.

**No snippet abaixo, `db` é `svcC1`**, e acrescente `siteIdsC1.push(siteId)` logo depois do `seedSite`
para que o `afterAll` de C1 apague o site (sem isso cada execução local deixa um site órfão):

```ts
it('accepts two posts with the same ig_media_id under different accounts (post-M2)', async () => {
  const { siteId } = await seedSite(db)

  const { data: pt } = await db.from('instagram_accounts')
    .insert({ site_id: siteId, locale: 'pt', handle: 'c4dup' })
    .select('id').single()
  const { data: en } = await db.from('instagram_accounts')
    .insert({ site_id: siteId, locale: 'en', handle: 'c4dup' })
    .select('id').single()

  const base = {
    ig_media_id: 'c4-media-1',
    media_type: 'IMAGE',
    media_url: 'https://scontent.cdninstagram.com/a.jpg',
    permalink: 'https://www.instagram.com/p/c4dup/',
    ig_timestamp: new Date(Date.now() - 3_600_000).toISOString(),
  }

  const first = await db.from('instagram_posts').insert({ ...base, account_id: pt!.id })
  expect(first.error).toBeNull()

  // A global se foi: a linha `en` fica com a sua própria cópia do mesmo media.
  const second = await db.from('instagram_posts').insert({ ...base, account_id: en!.id })
  expect(second.error).toBeNull()

  // A composta ficou: o mesmo par (account_id, ig_media_id) continua barrado,
  // que é o que sustenta o `onConflict: 'account_id,ig_media_id'` do sync.
  const same = await db.from('instagram_posts').insert({ ...base, account_id: pt!.id })
  expect(same.error?.code).toBe('23505')

  // Cascade: apagar as contas leva os posts junto (ON DELETE CASCADE).
  await db.from('instagram_accounts').delete().in('id', [pt!.id, en!.id])
})
```

- [ ] **Step 3: Rodar os dois testes e confirmar que falham**

Run (a partir de `apps/web/`):

```bash
cd apps/web && HAS_LOCAL_DB=1 npx vitest run \
  test/integration/ops-alert-claim.test.ts \
  test/integration/instagram-accounts-public-view.test.ts
```

Expected: FAIL nos dois novos — o de catálogo com `expected [ 'instagram_posts_account_media_key', 'instagram_posts_ig_media_id_key' ] to equal [ 'instagram_posts_account_media_key' ]`, e o comportamental no `expect(second.error).toBeNull()` recebendo `23505`. **Se passarem já aqui, pare:** M2 (ou algo equivalente) já foi aplicada no banco local e o teste não está provando nada.

- [ ] **Step 4: Gerar o arquivo de migration**

```bash
npm run db:new instagram_posts_drop_global_media_unique
```

Expected: `Created: supabase/migrations/<timestamp>_instagram_posts_drop_global_media_unique.sql`. Use **esse** caminho nos próximos passos. Não renomeie, não edite o timestamp.

- [ ] **Step 5: Escrever o SQL de M2**

Substitua o conteúdo do arquivo gerado por:

```sql
-- =============================================================================
-- MIGRATION: instagram_posts — drop da unique global de ig_media_id (C4, contract)
-- =============================================================================
-- Spec: docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md
--       §3.2 "M2 (C4)", §0 linha C4, §7 passo 4.
--
-- M1 (C1) acrescentou instagram_posts_account_media_key (account_id, ig_media_id)
-- deixando-a COEXISTIR com instagram_posts_ig_media_id_key (ig_media_id), criada
-- em 20260507190000_instagram_feed.sql:49-50 — expand puro, sem quebrar o código
-- antigo. Enquanto as duas coexistem, a 2ª linha de locale da mesma conta
-- Instagram falha o upsert com 23505 e o ramo `c2c4dup` de §3.3 passo 6 mascara
-- o ruído. Este é o passo contract: a composta passa a ser a única unique, cada
-- linha de locale ganha a sua própria cópia dos posts, e o ramo `c2c4dup` sai do
-- código no mesmo lote.
--
-- Pré-requisitos (§7 passo 4, verificados antes de aplicar): C2 em produção,
-- ≥ 1 ciclo agendado das 13:00 UTC executado, ≤ 2 dias desde a promoção de C2.
-- =============================================================================

alter table public.instagram_posts
  drop constraint if exists instagram_posts_ig_media_id_key;

-- As chaves de rate-limit `c2c4dup:<accountId>` perdem o emissor neste mesmo
-- commit. Sem esta limpeza elas viram fóssil permanente em ops_alert_state.
-- O guard existe porque ops_alert_state nasce em M1 (C1): esta migration não
-- deve depender da ordem de aplicação para ser idempotente.
do $$
begin
  if to_regclass('public.ops_alert_state') is not null then
    delete from public.ops_alert_state where key like 'c2c4dup:%';
  end if;
end $$;

notify pgrst, 'reload schema';
```

- [ ] **Step 6: Aplicar localmente e conferir que os tipos não mudam**

```bash
npm run db:reset
npm run db:types
git diff --stat apps/web/src/types/database.types.ts
```

Expected: `db:reset` conclui sem erro e o `git diff --stat` sai **vazio** (constraints `UNIQUE` não aparecem nos tipos gerados). Diff não-vazio ⇒ algo além de M2 entrou; investigue antes de seguir.

- [ ] **Step 7: Rodar os dois testes e confirmar que passam**

Run:

```bash
cd apps/web && HAS_LOCAL_DB=1 npx vitest run \
  test/integration/ops-alert-claim.test.ts \
  test/integration/instagram-accounts-public-view.test.ts
```

Expected: PASS, com `skipped: 0` nos dois arquivos.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/*_instagram_posts_drop_global_media_unique.sql \
        apps/web/test/integration/ops-alert-claim.test.ts \
        apps/web/test/integration/instagram-accounts-public-view.test.ts
git commit -m "chore(instagram): drop da unique global de ig_media_id (contract)

M2 (spec §3.2): a composta instagram_posts_account_media_key passa a ser a
unica unique de instagram_posts, fechando a janela C2->C4. Limpa tambem as
chaves c2c4dup: de ops_alert_state, que perdem o emissor neste lote.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 2: Remover o ramo de exclusão `c2c4dup` e travar a remoção com um ratchet

**Files:**
- Modify: `apps/web/src/app/api/cron/instagram-sync/route.ts` (o ramo que C2 acrescentou ao tratamento de erro do laço de contas)
- Modify: `apps/web/src/app/api/cron/instagram-token-refresh/route.ts` (o mesmo ramo — §3.4: "mesma ordem de §3.3")
- Test: `apps/web/test/instagram/sync.test.ts` (acrescenta o `it` que §3.3 passo 6 exige)

**Interfaces:**
- Consumes (de C2): `classifyInstagramError(err): 'infra' | 'transient' | 'permanent'` e `redact` de `src/lib/instagram/token.ts`; `ops_alert_claim(key, interval)` via RPC; `closeSyncRow(supabase, logId, result, errorMessage?)` de `src/lib/instagram/sync-log.ts`; a variável de run `stepErrors` de cada cron; `syncInstagramAccount(supabase, account, accessToken, opts?)` com `onConflict: 'account_id,ig_media_id'` em `src/lib/instagram/sync.ts`.
- Produces: nas duas rotas de cron, um `23505` de `instagram_posts` volta a ser um `infra` como qualquer outro — linha `failed`/`'infra: ' + redact(msg)`, `captureException`, `stepErrors++`, e portanto elegível ao push diário de `step_errors` do passo 6. Nenhuma assinatura exportada muda.

- [ ] **Step 1: Escrever o `it` de ratchet que falha (`sync.test.ts`)**

Confirme primeiro que a primeira linha do arquivo é o pragma (C2 já o acrescenta; se não estiver lá, acrescente **como primeira linha do arquivo**, antes de qualquer `import`):

```ts
// @vitest-environment node
```

Acrescente os dois imports **junto dos imports existentes no topo** do arquivo:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
```

E o bloco abaixo no **fim** do arquivo, fora do `describe('syncInstagramAccount', …)` existente:

```ts
// ── C4 ratchet ───────────────────────────────────────────────────────────────
// §3.3 passo 6: o ramo `c2c4dup` existia SÓ para a janela em que a unique global
// instagram_posts_ig_media_id_key coexistia com a composta. M2 fechou a janela;
// se o ramo voltar, um 23505 real (bug nosso, `infra` por §3.2) passa a ser
// engolido sem step_errors e sem push — exatamente o modo de falha silenciosa
// que a feature inteira existe para acabar.
const C4_SOURCES = [
  'src/app/api/cron/instagram-sync/route.ts',
  'src/app/api/cron/instagram-token-refresh/route.ts',
  'src/lib/instagram/sync.ts',
  'src/lib/instagram/token.ts',
] as const

function readWebSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
}

describe('C4 contract — the c2c4dup exclusion branch is gone', () => {
  it.each(C4_SOURCES)('%s carries no c2c4dup exclusion', (relativePath) => {
    const source = readWebSource(relativePath)
    expect(source).not.toMatch(/c2c4dup/i)
    // O nome da constraint é o marcador preciso do ramo. NÃO assere sobre
    // /duplicate key value/i: essa string é legítima em token.ts, onde
    // classifyInstagramError a usa para classificar 23505 como `infra` (§3.2).
    expect(source).not.toMatch(/instagram_posts_ig_media_id_key/)
  })

  it('keeps the composite onConflict that M2 made the only unique', () => {
    expect(readWebSource('src/lib/instagram/sync.ts'))
      .toContain("onConflict: 'account_id,ig_media_id'")
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:

```bash
cd apps/web && npx vitest run test/instagram/sync.test.ts
```

Expected: FAIL em `src/app/api/cron/instagram-sync/route.ts carries no c2c4dup exclusion` e em `src/app/api/cron/instagram-token-refresh/route.ts carries no c2c4dup exclusion` (o ramo de C2 ainda está lá). Os casos de `sync.ts` e `token.ts` e o do `onConflict` já devem passar — se `token.ts` falhar, o ramo `c2c4dup` foi implementado dentro dele em C2 e é ali que a Task 2 o remove (o `grep` do Step 3 mostra onde).

- [ ] **Step 3: Localizar o ramo nas duas rotas**

```bash
grep -rn "c2c4dup\|instagram_posts_ig_media_id_key\|duplicate key value" apps/web/src
```

A saída deste `grep` **define** as linhas a remover — não estime nem reescreva por volta delas. O ramo que C2 deixou tem esta forma (nomes de variáveis podem diferir; a estrutura, não):

```ts
// ANTES (C2) — dentro do catch por conta, o ramo `infra` já classificado.
// O `c2c4dup` é o if ANINHADO com `else`, não um if de topo, e não há `continue`
// (o laço é `await step(...)`). A chamada é via helper `claimAlert`, cujo 3º
// argumento vira `p_min_interval` na RPC (nunca `p_interval`).
if (kind === 'infra') {
  await closeSyncRow(supabase, logId, null, `infra: ${message}`)
  failedInfra++
  if (/duplicate key value.*instagram_posts_ig_media_id_key/.test(message)) {
    // Janela C2→C4 — ramo REMOVIDO em C4.
    if (await claimAlert(supabase, `c2c4dup:${account.id}`, '23 hours')) {
      Sentry.captureMessage('instagram duplicate media in C2→C4 window', 'info')
    }
  } else {
    stepErrors++
    Sentry.captureException(err, { tags: { component: CRON_TAG, account_id: account.id } })
  }
}
```

- [ ] **Step 4: Remover o ramo das duas rotas**

Em **`instagram-sync/route.ts`** e em **`instagram-token-refresh/route.ts`**: apague **só** o `if`
aninhado do `c2c4dup` e o `else`, promovendo o corpo do `else` para o nível do ramo `infra`.
**Não apague o ramo `if (kind === 'infra') { … }` inteiro** — ele carrega o `closeSyncRow`, o
`failedInfra++` e (dentro do `else`) o `stepErrors++`/`captureException` que C4 existe para
restaurar. Não há `continue` a remover.

```ts
// DEPOIS (C4) — um 23505 volta a ser um infra comum:
if (kind === 'infra') {
  await closeSyncRow(supabase, logId, null, `infra: ${message}`)
  failedInfra++
  stepErrors++
  Sentry.captureException(err, { tags: { component: CRON_TAG, account_id: account.id } })
}
```

Confirme depois da edição que `failedInfra` continua sendo incrementado (o corpo da resposta expõe
`failed_infra`) e que `CRON_TAG` continua importado/usado nas duas rotas.

Se, ao remover, sobrar um `import` sem uso (por exemplo `redact` usado só ali — improvável, o ramo genérico também o usa), o typecheck do pré-commit acusa; remova o import junto, no mesmo commit.

Se o `grep` do Step 3 mostrar `c2c4dup` também em `src/lib/instagram/token.ts` (C2 pode ter fatorado o ramo num helper compartilhado pelos dois crons em vez de duplicá-lo), remova-o **lá** e, nas rotas, remova a chamada ao helper — o resultado observável é o mesmo: um `23505` volta a cair no caminho `infra` genérico. Acrescente `apps/web/src/lib/instagram/token.ts` ao `git add` do Step 7.

- [ ] **Step 5: Rodar os testes das duas rotas e do sync e confirmar que passam**

Run:

```bash
cd apps/web && npx vitest run \
  test/instagram/sync.test.ts \
  test/instagram/cron-route.test.ts \
  test/instagram/token-refresh.test.ts \
  test/api/cron/instagram-sync.test.ts \
  test/api/cron/instagram-token-refresh.test.ts
```

Expected: PASS em todos. Se um teste de C2 assertava o comportamento *antigo* (23505 sem `step_errors`, `captureMessage('instagram duplicate media in C2→C4 window', 'info')`), ele descreve a janela que acabou de fechar: atualize-o para a expectativa nova — `stepErrors === 1` e `captureException` — **neste mesmo commit** (bisectabilidade; o commit da mudança carrega o fix do teste).

- [ ] **Step 6: Rodar a suíte inteira de `apps/web`**

Run:

```bash
cd apps/web && npx vitest run
```

Expected: PASS (≈160 s; a suíte completa não trava — medido em 2026-09-03). Os DB-gated ficam `skipped` sem `HAS_LOCAL_DB`, o que é o esperado neste passo.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/cron/instagram-sync/route.ts \
        apps/web/src/app/api/cron/instagram-token-refresh/route.ts \
        apps/web/test/instagram/sync.test.ts \
        apps/web/test/api/cron/instagram-sync.test.ts \
        apps/web/test/api/cron/instagram-token-refresh.test.ts
# Os dois últimos carregam os `it` de C2 que asseravam `step_errors === 0` no
# 23505 da janela ('23505 na janela C2→C4: …' e '23505 => infra: sem streak e sem
# markTokenInvalid'); o Step 5 os reescreve para step_errors === 1 +
# captureException, e o fix TEM de viajar neste commit (bisectabilidade).
git commit -m "chore(instagram): remover a exclusao c2c4dup dos crons

A janela C2->C4 fechou com M2: um 23505 de instagram_posts volta a ser um
infra comum (step_errors + captureException). Ratchet em sync.test.ts impede
o ramo de voltar e fixa o onConflict composto.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 3: Receita de rollback de C4 — documentada no arquivo de migration e provada por teste

O rollback de C4 **não é `git revert`**: recriar a unique global sobre uma tabela que já ganhou cópias por conta falha com `23505` até que as cópias extras saiam. §7 ("Depois de C4") exige a receita completa, com o reset de identidade herdado do passo de banco de C2. Ela vive no bloco `-- ROLLBACK` do próprio arquivo de M2 — é onde `git log`/`git show` do commit a entregam junto com a mudança, e é o único lugar disponível em C4 (o `docs/ops/instagram-token-alert-runbook.md` só nasce em C3, §8, que copia esta receita para lá).

**Files:**
- Modify: `supabase/migrations/<timestamp>_instagram_posts_drop_global_media_unique.sql` (acrescenta o bloco `-- ROLLBACK` ao fim; **nenhum DDL novo** — comentário puro)
- Test: `apps/web/test/integration/ops-alert-claim.test.ts` (acrescenta um `it` que executa a receita dentro de uma transação e dá `rollback` no fim)

**Interfaces:**
- Consumes: `PG_URL` (a constante local criada na Task 1 neste mesmo arquivo); `seedSite(db)` de `../helpers/db-seed`; `public.instagram_feed_slots.post_id` com `ON DELETE SET NULL` (`20260507190000_instagram_feed.sql:59`).
- Produces: nenhuma exportação. O deliverable é o bloco `-- ROLLBACK` verbatim e a prova de que ele funciona.

- [ ] **Step 1: Escrever o teste que falha — a receita executada de ponta a ponta**

Acrescente ao `describe.skipIf(skipIfNoLocalDb())` de `apps/web/test/integration/ops-alert-claim.test.ts` (`db` abaixo é o service client já criado no topo do arquivo — se C1 o nomeou de outro jeito, use o identificador dele; `seedSite` vem de `../helpers/db-seed` e pode já estar importado):

```ts
it('the documented C4 rollback recipe restores the global unique', async () => {
  // Estado pós-M2: duas contas de locale com a mesma cópia do mesmo media.
  const { siteId } = await seedSite(db)
  const { data: pt } = await db.from('instagram_accounts')
    .insert({ site_id: siteId, locale: 'pt', handle: 'c4roll' })
    .select('id').single()
  const { data: en } = await db.from('instagram_accounts')
    .insert({ site_id: siteId, locale: 'en', handle: 'c4roll' })
    .select('id').single()

  const base = {
    ig_media_id: 'c4-roll-1',
    media_type: 'IMAGE',
    media_url: 'https://scontent.cdninstagram.com/a.jpg',
    permalink: 'https://www.instagram.com/p/c4roll/',
    ig_timestamp: new Date(Date.now() - 3_600_000).toISOString(),
  }
  const { data: older } = await db.from('instagram_posts')
    .insert({ ...base, account_id: pt!.id }).select('id').single()
  const { data: newer } = await db.from('instagram_posts')
    .insert({ ...base, account_id: en!.id }).select('id').single()

  // Um slot apontando para a cópia que a receita vai apagar — o efeito
  // colateral que o bloco -- ROLLBACK obriga a registrar no runbook.
  const { data: slot } = await db.from('instagram_feed_slots')
    .insert({ account_id: pt!.id, position: 1, post_id: older!.id })
    .select('id').single()

  const client = new Client({ connectionString: PG_URL })
  await client.connect()
  try {
    await client.query('begin')

    // ── receita, passo 1: apagar as cópias extras (mantém a mais nova) ──
    await client.query(`
      delete from public.instagram_posts
       where id in (
         select id from (
           select id, row_number() over (
             partition by ig_media_id order by created_at desc, id desc
           ) as rn
           from public.instagram_posts
         ) ranked
        where rn > 1)`)

    const survivors = await client.query<{ id: string }>(
      `select id from public.instagram_posts where ig_media_id = $1`, ['c4-roll-1'],
    )
    expect(survivors.rows).toHaveLength(1)
    expect(survivors.rows[0]!.id).toBe(newer!.id)

    // Efeito colateral declarado: o slot que apontava para a cópia apagada
    // vira NULL (ON DELETE SET NULL), não some.
    const slotAfter = await client.query<{ post_id: string | null }>(
      `select post_id from public.instagram_feed_slots where id = $1`, [slot!.id],
    )
    expect(slotAfter.rows[0]!.post_id).toBeNull()

    // ── receita, passo 2: recriar a unique global ──
    await client.query(`
      alter table public.instagram_posts
        drop constraint if exists instagram_posts_ig_media_id_key`)
    await client.query(`
      alter table public.instagram_posts
        add constraint instagram_posts_ig_media_id_key unique (ig_media_id)`)

    // A global voltou: a 2ª conta não pode mais ter a sua cópia.
    await expect(client.query(
      `insert into public.instagram_posts
         (account_id, ig_media_id, media_type, media_url, permalink, ig_timestamp)
       values ($1, $2, 'IMAGE', $3, $4, now())`,
      [pt!.id, 'c4-roll-1', base.media_url, base.permalink],
    )).rejects.toMatchObject({ code: '23505' })
  } finally {
    // Tudo o que a receita fez (DELETE e DDL) morre aqui: o banco local volta
    // ao estado pós-M2 para as outras suítes.
    await client.query('rollback').catch(() => {})
    await client.end()
  }

  await db.from('instagram_accounts').delete().in('id', [pt!.id, en!.id])
})
```

- [ ] **Step 2: Rodar e confirmar que passa (a receita já é correta) — e que o banco não ficou sujo**

Run:

```bash
cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/ops-alert-claim.test.ts
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -A -c "
  select conname from pg_constraint
   where conrelid = 'public.instagram_posts'::regclass and contype = 'u' order by conname"
```

Expected: PASS, e o `psql` devolvendo **uma única linha**, `instagram_posts_account_media_key` — prova de que o `rollback` da transação devolveu o estado pós-M2. Duas linhas ⇒ o `rollback` não rodou ⇒ conserte o `finally` antes de seguir (rodar `npm run db:reset` limpa).

- [ ] **Step 3: Escrever o bloco `-- ROLLBACK` no arquivo de migration**

Acrescente ao **fim** do arquivo criado na Task 1 (comentário puro — nenhum statement executável entra aqui):

```sql
-- =============================================================================
-- ROLLBACK de C4 (§7, parágrafo "Depois de C4") — NÃO é `git revert`.
-- =============================================================================
-- Recriar a unique global sobre uma tabela que já ganhou cópias por conta falha
-- com 23505 enquanto as cópias extras existirem. A ordem abaixo é obrigatória e
-- os três passos são um só procedimento.
--
-- Passo 1 — apagar as cópias extras, mantendo a mais recente de cada media.
-- EFEITO COLATERAL A REGISTRAR NO RUNBOOK: instagram_feed_slots.post_id tem
-- ON DELETE SET NULL (20260507190000_instagram_feed.sql:59); todo slot que
-- apontava para uma cópia apagada vira NULL e o CMS mostra o slot vazio até
-- alguém repicar o post. Nenhum slot é removido.
--
--   delete from public.instagram_posts
--    where id in (
--      select id from (
--        select id, row_number() over (
--          partition by ig_media_id order by created_at desc, id desc
--        ) as rn
--        from public.instagram_posts
--      ) ranked
--     where rn > 1);
--
-- Passo 2 — recriar a unique global.
--
--   alter table public.instagram_posts
--     drop constraint if exists instagram_posts_ig_media_id_key;
--   alter table public.instagram_posts
--     add constraint instagram_posts_ig_media_id_key unique (ig_media_id);
--
-- Passo 3 — MUST quando o rollback continuar para trás e passar por C2
-- (§7: "repetir o mesmo reset de identidade do passo de banco de C2"). Sem
-- ele, ficam linhas com ig_user_id_source='oauth' sem token e sem dono
-- conhecido, alcançáveis pelo data-deletion no roll-forward: uma colisão
-- numérica entre espaços de id apagaria token, instagram_posts,
-- instagram_feed_slots, blobs e instagram_sync_log de um terceiro.
--
--   update public.instagram_accounts
--      set ig_user_id_source = 'legacy', ig_professional_id = null
--    where access_token is null and ig_user_id_source = 'oauth';
--
-- Reversão da limpeza de ops_alert_state: nenhuma. As chaves `c2c4dup:%` são
-- rate limiters de 23 h; ausentes, o primeiro run pós-rollback apenas emite o
-- captureMessage de novo. A composta instagram_posts_account_media_key (M1)
-- FICA — ela não é de C4 e não atrapalha o código pré-C2 (onConflict:'ig_media_id').
--
-- Prova executável desta receita:
-- apps/web/test/integration/ops-alert-claim.test.ts →
--   'the documented C4 rollback recipe restores the global unique'
-- =============================================================================
```

- [ ] **Step 4: Confirmar que o comentário não mudou o comportamento da migration**

Run:

```bash
npm run db:reset
cd apps/web && HAS_LOCAL_DB=1 npx vitest run \
  test/integration/ops-alert-claim.test.ts \
  test/integration/instagram-accounts-public-view.test.ts
```

Expected: `db:reset` sem erro (um bloco de comentário SQL não executa nada) e PASS nos dois arquivos, com `skipped: 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_instagram_posts_drop_global_media_unique.sql \
        apps/web/test/integration/ops-alert-claim.test.ts
git commit -m "docs(instagram): receita de rollback de C4 na migration M2

Bloco -- ROLLBACK com os tres passos de §7 (apagar copias extras, recriar a
unique global, reset de identidade se o rollback passar por C2) e o efeito
colateral em instagram_feed_slots. Provado por teste DB-gated.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

## Verificação local antes do push (BLOQUEANTE)

Cada push dispara builds na Vercel; o orçamento é limitado. Só se empurra com tudo verde localmente.

- [ ] **V1 — suíte completa de `apps/web`, incluindo DB-gated**

```bash
cd apps/web && HAS_LOCAL_DB=1 npx vitest run
```

Expected: PASS. Confira no relatório que `ops-alert-claim`, `instagram-accounts-public-view` e `instagram-token-rpc` aparecem executados, **não** pulados.

- [ ] **V2 — typecheck e build de packages (o que o pré-commit roda)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run build:packages && npm run typecheck -w apps/web
```

Expected: exit 0 nos dois.

- [ ] **V3 — o diff de C4 é só o que C4 é**

```bash
git diff --stat main...staging -- supabase apps/web
```

Expected: exatamente o arquivo de migration novo, as duas rotas de cron, `test/instagram/sync.test.ts` e os dois arquivos DB-gated. Qualquer `vercel.json`, `src/lib/env.ts`, UI ou `.github/` no diff ⇒ escopo vazou; separe antes de empurrar.

- [ ] **V4 — o ramo `c2c4dup` não existe mais em código**

```bash
grep -rn "c2c4dup" apps/web/src apps/web/lib
```

Expected: **nenhuma linha**. (Ocorrências em `docs/superpowers/specs/` e neste plano são texto histórico e ficam.)

---

## Promoção (§7 passo 4) — banco primeiro, código depois

- [ ] **P1 — push para `staging` e CI verde**

```bash
git push origin staging
```

Aguarde `ci.yml` verde, com o job *Integration (DB-gated)* incluído.

- [ ] **P2 — aplicar M2 em produção**

```bash
npm run db:which     # confirma novkqtvcnsiwhkxihurk
npm run db:push:prod # confirmação YES; aplica todas as pendentes
```

Expected: M2 aplicada. Confirme:

```bash
psql "$PROD_DB_URL" -t -A -c "
  select conname from pg_constraint
   where conrelid = 'public.instagram_posts'::regclass and contype = 'u' order by conname"
```

Expected: uma única linha, `instagram_posts_account_media_key`.

- [ ] **P3 — promover `staging → main`**

```bash
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

- [ ] **P4 — provar a janela fechada no ciclo seguinte das 13:00 UTC**

```bash
psql "$PROD_DB_URL" -t -A -F'|' -c "
  select started_at, mode, status, left(error_message, 120)
    from public.instagram_sync_log
   where started_at > now() - interval '26 hours'
   order by started_at desc limit 20"
```

Expected: nenhuma linha `infra: duplicate key value … instagram_posts_ig_media_id_key`, e as linhas de locale `pt` e `en` da mesma conta ambas `completed`. Se um `duplicate key` ainda aparecer, M2 não foi aplicada (volte a P2).

- [ ] **P5 — `cron_health` e `/api/health` saudáveis**

```bash
psql "$PROD_DB_URL" -t -A -F'|' -c "
  select cron_name, last_success_at, consecutive_failures
    from public.cron_health
   where cron_name in ('instagram-sync','instagram-token-refresh')"
curl -fsS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" \
  https://bythiagofigueiredo.com/api/health
```

Expected: `consecutive_failures = 0` nos dois crons e `200` no health. **C3 fica desbloqueado só depois desta caixa.**
