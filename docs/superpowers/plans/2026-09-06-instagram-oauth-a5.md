# Instagram OAuth — Commit A5 (condicional) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o transporte do "Sync Now" do Instagram no ramo que o **gate de herança de `maxDuration` depois de A** (spec §7) escolher — apagando `mode`/`accountId` do cron quando a server action provou rodar em processo, ou restaurando o `fetch` HTTP autenticado quando ela não provou.

**Architecture:** A5 é **um único commit**, entregue logo depois de A4 e antes de B. Ele tem **dois corpos mutuamente exclusivos**; o gate pós-A decide qual. **Corpo 1 (gate PASSOU)** — `chore(instagram): drop manual mode from sync cron`: `api/cron/instagram-sync` perde os parâmetros `mode` e `accountId`, o lock vira `'instagram-sync'`, e as duas edições de teste de §6 viajam no mesmo commit. **Corpo 2 (gate REPROVOU)** — `fix(instagram): restore HTTP transport for Sync Now`: `triggerInstagramSync` volta ao `fetch` autenticado para `/api/cron/instagram-sync?mode=manual&accountId=<uuid>`, a rota **mantém** os dois parâmetros, e **nenhuma** das duas edições de §6 acontece. Nos dois ramos o `select('*').eq('id', accountId).eq('site_id', siteId).single()` entregue por A2 **permanece** — é ele que prova o escopo de site. A5 existe nos dois ramos, nunca é reeditado dentro de A e **nunca migra para C2**.

**Tech Stack:** Next.js 16.3.4 (App Router, Route Handlers, server actions, `revalidateTag(tag, { expire: 0 })`, `revalidatePath`), React 19, TypeScript 5 strict, Supabase (PostgREST via service client), Vitest (happy-dom default; `// @vitest-environment node` para rota/lib de servidor), Sentry.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **A5** e linha A item (iii), §3.4 último bullet, §6 (linha 361), §7 "Gate depois de A".

**Índice dos planos:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md` (ordem `A → A4 → A5 → B → C1 → C2 → C4 → C3`).

## Global Constraints

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` (`lib/home/queries.ts`, `lib/cms/site-context.ts`, `lib/supabase/service.ts`) e `apps/web/src/lib/` (`src/lib/instagram/*`, `src/lib/logger.ts`, `src/lib/env.ts`). Há dois `queries.ts` e dois `logger.ts` — sempre qualificar. **`@/lib/logger` resolve para `apps/web/src/lib/logger.ts`** (o `withCronLock` de lock em memória), não para `apps/web/lib/logger.ts`.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `@/lib/<domínio>/*` mapeia para `apps/web/lib/` só para 16 prefixos; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`. `test/**` está **excluído** do `tsconfig.json`.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`.
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` no topo; `getSupabaseServiceClient()` só após guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; fix de teste vai no mesmo commit.
- Migrations: **sempre** `npm run db:new <nome>`; idempotentes. **A5 não tem migration nos dois corpos** — `instagram_sync_log_mode_check` (`supabase/migrations/20260507190000_instagram_feed.sql:85-86`) já aceita `('daily','manual','token_refresh')` e continua aceitando os três nos dois ramos.
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só após verificação local completa** (cada push dispara builds na Vercel).
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto.
- Definições nomeadas do spec valem por nome: `CAMPOS_DE_EPISÓDIO` (5 campos), horários `"0 11 * * *"` / `"0 13 * * *"`, `REGRA-PII-NTFY`.
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do dono: `America/Sao_Paulo`.

**Restrições específicas de A5 (spec §0 linha A5, §3.4, §7):**

- A5 é **um único commit**. Os dois corpos são **mutuamente exclusivos**: execute o Grupo 1 **ou** o Grupo 2, nunca os dois, nunca partes de ambos.
- **`git revert` puro**: o commit tem de ser revertível sozinho, sem tocar em A/A4.
- Nos dois corpos, **A não é reeditado** (`src/lib/instagram/sync.ts`, `src/lib/instagram/sync-log.ts`, `src/lib/redact-secrets.ts` e o `maxDuration = 120` de `settings/page.tsx` ficam como A os deixou).
- Nos dois corpos, o `select('*').eq('id', accountId).eq('site_id', siteId).single()` de A2 **permanece** em `triggerInstagramSync`.
- O conteúdo de A5 **nunca migra para C2** em nenhum dos dois ramos.

---

### Task 0: Ler o veredito do gate e escolher o corpo

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md` (append da entrada de ledger, só se ela ainda não existir)

**Interfaces:**
- Consumes: os commits **A** e **A4** já em `staging` **e promovidos para `main`** (A precisa estar em produção — o gate mede a função real na Vercel).
- Produces: a variável de decisão `GATE = PASSOU | REPROVOU`, que seleciona **Grupo 1 (Tasks 1–2)** ou **Grupo 2 (Tasks 3–4)**. Nenhuma outra task deste plano roda antes desta.

- [ ] **Step 1: Confirmar que A e A4 estão na árvore e promovidos**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git log --oneline -20 main | grep -E 'fechar vazamentos vivos|strip trusted headers'
```

Esperado: **duas** linhas — o commit A (`fix(instagram)!: fechar vazamentos vivos + base de observabilidade (sync-log, redact)`) e o A4 (`fix(middleware): strip trusted headers`), ambas em `main`.
Se faltar qualquer uma: **PARE**. A5 só existe depois de A4, e o gate só pode ser medido com A em produção (spec §7: "com A promovido — portanto com a chamada em processo de A2 no ar").

- [ ] **Step 2: Ler a entrada de ledger do gate**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
sed -n '/^## Ledger — gate de herança de `maxDuration` (pós-A)/,$p' \
  docs/superpowers/plans/2026-09-06-instagram-oauth-README.md
```

Esperado (um dos dois): a seção existe e traz uma linha `**Resultado:** PASSOU` ou `**Resultado:** REPROVOU`.
Se a saída for **vazia**, o gate ainda não foi medido/registrado ⇒ vá para o Step 3. Se existir, vá para o Step 4.

- [ ] **Step 3: Rodar o gate e registrar o ledger (só se o Step 2 veio vazio)**

O gate é o experimento discriminante de §7 — ele **MUST** ser medido, nunca presumido nem "dado por aprovado por omissão":

1. No painel da Vercel, registre a **duração-padrão de função do projeto** (hoje 60 s no plano Pro).
2. Com A em produção, abra `/cms/settings?section=instagram` e dispare **um `Sync Now` sobre a conta real de produção** — o volume de imagens que ela tem hoje, **sem atraso sintético e sem variável de ambiente nova**.
3. Leia a **duração da função** no log da Vercel do segmento `/cms/settings` (painel de Functions ou `vercel logs`). Alvo: **≈ 70 s** (sempre acima da duração-padrão registrada e abaixo de 120 s).
4. Leitura do resultado:
   - duração **≈ 70 s ou mais terminando em 200** (`{ ok:true }` ou `{ ok:true, partial:true }`) ⇒ **PASSOU** (a `export const maxDuration = 120` da page **foi herdada** pela server action);
   - **504/timeout em ~60 s** ⇒ **REPROVOU** (não foi herdada);
   - run real **abaixo de 60 s** ⇒ **INCONCLUSIVO**: repita com o run mais pesado disponível. **Nunca** registre PASSOU por omissão.

Depois, anexe ao fim de `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md` exatamente esta seção, preenchida:

```markdown
## Ledger — gate de herança de `maxDuration` (pós-A)

**Medido em:** <YYYY-MM-DD HH:MM America/Sao_Paulo>
**Duração-padrão de função do projeto (painel Vercel):** <N> s
**Run medido:** `Sync Now` na conta real de produção (`instagram_accounts.id = <uuid>`), sem atraso sintético
**Duração da função `/cms/settings` no log da Vercel:** <N> s
**Status HTTP / corpo da action:** <200 · { ok:true } | 200 · { ok:true, partial:true } | 504 timeout>
**Resultado:** <PASSOU | REPROVOU>
**Corpo de A5 selecionado:** <chore(instagram): drop manual mode from sync cron | fix(instagram): restore HTTP transport for Sync Now>
```

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add docs/superpowers/plans/2026-09-06-instagram-oauth-README.md
git commit -m "docs(instagram): registrar veredito do gate de maxDuration pos-A"
```

- [ ] **Step 4: Selecionar o grupo de tasks**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
grep -m1 '^\*\*Resultado:\*\*' docs/superpowers/plans/2026-09-06-instagram-oauth-README.md
```

- Saída `**Resultado:** PASSOU` ⇒ execute **Grupo 1 — Tasks 1 e 2**. Ignore as Tasks 3 e 4 por completo.
- Saída `**Resultado:** REPROVOU` ⇒ execute **Grupo 2 — Tasks 3 e 4**. Ignore as Tasks 1 e 2 por completo.
- Qualquer outra saída (inclusive `INCONCLUSIVO`) ⇒ **PARE** e volte ao Step 3.

Anote a escolha no relatório da task: `GATE = PASSOU → Grupo 1` ou `GATE = REPROVOU → Grupo 2`.

---

## Grupo 1 — corpo `chore(instagram): drop manual mode from sync cron` (executar **só** se `GATE = PASSOU`)

### Task 1: Rota do cron perde `mode`/`accountId`; lock vira `'instagram-sync'`

**Files:**
- Modify: `apps/web/src/app/api/cron/instagram-sync/route.ts` (arquivo inteiro — hoje 101 linhas; `:7` importa `InstagramSyncMode`, `:18-21` lê e valida `mode`, `:23` lê `accountId`, `:27` monta o lock `` `instagram-sync-${mode}` ``, `:33-35` aplica `.eq('id', accountId)`)
- Test: `apps/web/test/api/cron/instagram-sync.test.ts` (remove `it('returns 400 for invalid mode')`, hoje `:106-111`; acrescenta o pragma e dois testes)
- Test: `apps/web/test/instagram/cron-route.test.ts` (reescreve o `makeRequest` de `:30-34` e seus três call sites; acrescenta o pragma e um teste)

**Interfaces:**
- Consumes: `withCronLock(supabase, key, runId, tag, fn)` e `newRunId()` de `@/lib/logger` (`apps/web/src/lib/logger.ts:24-30`); `syncInstagramAccount(supabase, account, accessToken?, opts?)` de `@/lib/instagram/sync` (assinatura final entregue por A); `InstagramAccountRow` de `@/lib/instagram/types`; `getSupabaseServiceClient()` de `@/lib/supabase/service`.
- Produces: `GET(req: NextRequest): Promise<Response>` em `/api/cron/instagram-sync` sem nenhum parâmetro de query; lock e tag ambos `'instagram-sync'`; corpo de sucesso `{ status: 'ok', mode: 'daily', inserted: number, updated: number, cached: number }` **ou** `{ status: 'ok', message: 'no accounts configured' }`; linhas de `instagram_sync_log` escritas por esta rota sempre com `mode = 'daily'`. `InstagramSyncMode` (`src/lib/instagram/types.ts:94`) **continua existindo** — é o tipo da coluna em `InstagramSyncLogRow` (`types.ts:51`) e o `'manual'` continua sendo escrito pela server action `triggerInstagramSync` (A2).

- [ ] **Step 1: Escrever os testes que falham em `test/api/cron/instagram-sync.test.ts`**

Acrescente o pragma **na primeira linha do arquivo** (é teste de rota de servidor — Global Constraints):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
```

Logo abaixo do `import { GET } … ` e do `import { revalidateTag } from 'next/cache'` já existentes, acrescente o import do mock do lock:

```ts
import { withCronLock } from '@/lib/logger'
```

Acrescente este helper ao lado de `accountsQuery` (o `accountsQuery` atual é um Proxy que devolve um `vi.fn()` novo a cada acesso — não guarda os argumentos, por isso o novo teste precisa de um gravador próprio):

```ts
/** Query encadeável que GRAVA cada `.eq(col, val)` aplicado. */
function recordingAccountsQuery(data: unknown[]) {
  const eqCalls: Array<[string, unknown]> = []
  const result = Promise.resolve({ data, error: null })
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val])
      return chain
    },
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  }
  return { chain, eqCalls }
}
```

**Remova por completo** o teste hoje em `:106-111`:

```ts
  it('returns 400 for invalid mode', async () => {
    const res = await GET(makeRequest({ mode: 'invalid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid mode')
  })
```

E acrescente, no fim do `describe('GET /api/cron/instagram-sync')`, os dois testes novos:

```ts
  it('ignores mode and accountId query params: no per-account filter, single lock key', async () => {
    const { chain, eqCalls } = recordingAccountsQuery([])
    mockFrom.mockImplementation((table: string) =>
      table === 'instagram_accounts' ? chain : {},
    )

    const res = await GET(makeRequest({ mode: 'manual', accountId: 'acc-2' }))

    expect(res.status).toBe(200)
    // Só o filtro do cron diário sobrevive — nada vindo da query string.
    expect(eqCalls).toEqual([['sync_enabled', true]])
    // Lock literal: nunca mais `instagram-sync-${mode}`.
    expect(vi.mocked(withCronLock).mock.calls[0]?.[1]).toBe('instagram-sync')
    // A tag de cron_health continua sendo a mesma de sempre.
    expect(vi.mocked(withCronLock).mock.calls[0]?.[3]).toBe('instagram-sync')
  })

  it('logs every run as mode=daily', async () => {
    const fakeAccount = {
      id: 'acc-1',
      site_id: 'site-1',
      sync_enabled: true,
      access_token: 'tok',
    }
    mockSyncInstagramAccount.mockResolvedValue({
      postsFound: 1,
      postsInserted: 1,
      postsUpdated: 0,
      mediaCached: 0,
    })
    const log = syncLogInsert()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([fakeAccount])
      if (table === 'instagram_sync_log') return log
      return {}
    })

    const res = await GET(makeRequest({ mode: 'manual' }))
    const body = await res.json()

    expect(body.mode).toBe('daily')
    expect(log.insert).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'daily', status: 'started', site_id: 'site-1' }),
    )
  })
```

- [ ] **Step 2: Rodar o arquivo e verificar que os dois testes novos falham**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/api/cron/instagram-sync.test.ts
```

Esperado: **FAIL** (2 testes). O primeiro falha em `expect(eqCalls).toEqual([['sync_enabled', true]])` — o código atual acrescenta `['id','acc-2']` — e/ou em `'instagram-sync-manual' !== 'instagram-sync'`. O segundo falha com `expected 'manual' to be 'daily'`. Os demais testes do arquivo (401 ×2, "no accounts configured", happy path, Sentry) devem continuar **PASS** — se algum quebrou, foi o pragma `node`: investigue antes de seguir.

- [ ] **Step 3: Reescrever `src/app/api/cron/instagram-sync/route.ts`**

Conteúdo final completo do arquivo:

```ts
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// Este cron roda em um único modo. O modo 'manual' (o botão "Sync Now" do CMS)
// saiu daqui em A5: a server action `triggerInstagramSync` chama
// `syncInstagramAccount` em processo desde A2, o que (a) fecha o `accountId`
// vindo do cliente, que filtrava por `id` sem `site_id`, e (b) para de carimbar
// `cron_health['instagram-sync']` a cada clique humano — `withCronLock` recebia
// a mesma tag independentemente do modo.
const MODE = 'daily' as const

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, 'instagram-sync', runId, 'instagram-sync', async () => {
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('sync_enabled', true)

    if (!accounts || accounts.length === 0) {
      return { status: 'ok' as const, message: 'no accounts configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalCached = 0

    for (const account of accounts as InstagramAccountRow[]) {
      const { data: logRow } = await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: MODE,
        status: 'started',
      }).select('id').single()

      const logId = logRow?.id

      try {
        const result = await syncInstagramAccount(supabase, account)
        totalInserted += result.postsInserted
        totalUpdated += result.postsUpdated
        totalCached += result.mediaCached

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'completed',
            posts_found: result.postsFound,
            posts_inserted: result.postsInserted,
            posts_updated: result.postsUpdated,
            media_cached: result.mediaCached,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        Sentry.captureException(err, { tags: { component: 'instagram-sync', mode: MODE } })
      }
    }

    if (totalInserted > 0 || totalUpdated > 0) {
      revalidateTag('instagram-feed', { expire: 0 })
    }

    return {
      status: 'ok' as const,
      mode: MODE,
      inserted: totalInserted,
      updated: totalUpdated,
      cached: totalCached,
    }
  })
}
```

Note o que **não** muda: `runtime`, `maxDuration`, o 401, a tag `'instagram-sync'` de `cron_health`, a forma do corpo de resposta (o campo `mode` continua existindo, agora literal — retirá-lo seria mudança observável de API sem ganho) e a chamada `syncInstagramAccount(supabase, account)` de dois argumentos que A deixou (o `accessToken` é opcional desde A; o `deadlineAt` deste cron entra em C2, §3.4).

- [ ] **Step 4: Rodar os testes da rota e verificar que passam**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/api/cron/instagram-sync.test.ts
```

Esperado: **PASS**. O arquivo tinha 6 testes; sai com 7 — 5 sobreviventes (401 sem header, 401 com segredo errado, "no accounts configured", happy path, Sentry) + os 2 novos, menos o `returns 400 for invalid mode` removido. Se A tiver acrescentado testes a este arquivo, some-os à conta; o que não pode existir é qualquer teste citando `'invalid mode'`.

- [ ] **Step 5: Reescrever `test/instagram/cron-route.test.ts` (o `?mode=` de `:30`)**

Acrescente o pragma na primeira linha e troque o helper e seus call sites:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
```

`makeRequest` (hoje `:30-34`) passa a ser:

```ts
function makeRequest(secret = 'test-secret'): NextRequest {
  return new NextRequest('http://localhost/api/cron/instagram-sync', {
    headers: { authorization: `Bearer ${secret}` },
  })
}
```

Call sites: `GET(makeRequest('daily', 'wrong-secret'))` vira `GET(makeRequest('wrong-secret'))`; as duas ocorrências de `GET(makeRequest())` ficam como estão.

E acrescente, no fim do `describe`, o teste que substitui a intenção do `returns 400 for invalid mode` removido:

```ts
  it('accepts unknown query params without a 400 branch', async () => {
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    } as never)
    const req = new NextRequest(
      'http://localhost/api/cron/instagram-sync?mode=invalid&accountId=acc-9',
      { headers: { authorization: 'Bearer test-secret' } },
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('no accounts configured')
  })
```

- [ ] **Step 6: Rodar os dois arquivos de teste da rota**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/api/cron/instagram-sync.test.ts test/instagram/cron-route.test.ts
```

Esperado: **PASS** nos dois arquivos, zero `skipped`.

- [ ] **Step 7: Provar que nenhum consumidor do `mode`/`accountId` ficou para trás**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
grep -rn "instagram-sync?mode\|instagram-sync-\${\|instagram-sync-daily\|instagram-sync-manual" \
  apps/web/src apps/web/lib apps/web/test apps/web/vercel.json .github scripts docs/ops
```

Esperado: **nenhuma linha**. `apps/web/vercel.json:16` já aponta para `/api/cron/instagram-sync` sem query string, e `triggerInstagramSync` (A2) não faz mais `fetch`. Se aparecer alguma linha em `apps/web/src` ou `apps/web/test`, ela é um consumidor vivo e tem de morrer **neste** commit.

- [ ] **Step 8: Rodar as suítes vizinhas do domínio**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram test/api/cron/instagram-sync.test.ts \
  test/api/cron/instagram-token-refresh.test.ts test/lib/logger-in-memory-lock.test.ts
```

Esperado: **PASS** em todos. `logger-in-memory-lock.test.ts` entra porque é o teste do `withCronLock` que esta rota usa (`src/lib/logger.ts`), e o lock passou a ser literal.

- [ ] **Step 9: Typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run typecheck -w apps/web
```

Esperado: exit 0. (Se acusar `InstagramSyncMode` declarado e não usado em algum arquivo, confira que só a rota perdeu o import — `src/lib/instagram/types.ts:51,94` continua usando o tipo.)

- [ ] **Step 10: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/api/cron/instagram-sync/route.ts \
        apps/web/test/api/cron/instagram-sync.test.ts \
        apps/web/test/instagram/cron-route.test.ts
git commit -m "chore(instagram): drop manual mode from sync cron

A2 passou o Sync Now para uma chamada em processo (syncInstagramAccount
direto na server action) e o gate de heranca de maxDuration pos-A confirmou
que a page /cms/settings empresta seu maxDuration=120 para a action. Com
isso o cron nao precisa mais de transporte manual:

- /api/cron/instagram-sync perde os parametros mode e accountId (o accountId
  filtrava por id sem site_id — o vazamento que A1 mapeou e A2 fechou pelo
  lado da action);
- o lock deixa de ser instagram-sync-\${mode} e vira o literal
  instagram-sync, que e a mesma tag ja usada em cron_health;
- toda linha de instagram_sync_log escrita por esta rota nasce mode='daily'
  (a action continua escrevendo 'manual', e a CHECK da tabela segue
  aceitando os tres valores).

Testes: removido it('returns 400 for invalid mode'), reescrito o makeRequest
com ?mode= de cron-route.test.ts, e acrescentados os ratchets de lock literal,
ausencia de filtro por accountId e mode='daily' no log."
```

*(O executor acrescenta os trailers de atribuição do próprio harness.)*

---

### Task 2: Verificação completa, push e promoção do corpo 1

**Files:**
- Nenhum arquivo de código — esta task é o portão de qualidade e a promoção. Só produz commits novos se a verificação achar defeito.

**Interfaces:**
- Consumes: o commit `chore(instagram): drop manual mode from sync cron` da Task 1.
- Produces: `staging` verde na CI e `main` com A5 promovido — pré-requisito declarado do commit **B** no `README.md` dos planos ("CI verde antes do seguinte").

- [ ] **Step 1: Rodar a suíte inteira de `apps/web`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run
```

Esperado: **PASS**. Custo medido em 2026-09-03: ~1078 arquivos, ~13.780 testes, **160 s** — barato o bastante para rodar antes de um push (CLAUDE.md, "Regras anti-regressão de testes"). Qualquer vermelho aqui é regressão desta mudança até prova em contrário.

- [ ] **Step 2: Provar que o commit é revertível sozinho**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git revert --no-commit HEAD && npm run typecheck -w apps/web && git revert --abort
```

Esperado: o `typecheck` sai 0 com o revert aplicado na árvore (nada em A depende do que A5 removeu), e o `git revert --abort` devolve a árvore ao commit da Task 1. Se o `typecheck` falhar, o commit não é `git revert` puro — conserte antes de empurrar.

- [ ] **Step 3: Push para `staging`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git push origin staging
```

- [ ] **Step 4: Esperar a CI verde**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
gh run list --branch staging --limit 3
gh run watch
```

Esperado: `ci.yml` verde (typecheck, test, audit, secret-scan, ecosystem-pinning, seo-smoke) e o build da Vercel verde. Nada é promovido com CI vermelha.

- [ ] **Step 5: Promover `staging → main`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

- [ ] **Step 6: Provar o cron em produção**

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://bythiagofigueiredo.com/api/cron/instagram-sync
```

Esperado: `200` com `{"status":"ok","mode":"daily",…}` **ou** `{"status":"ok","message":"no accounts configured"}`. Depois, confira que o clique humano continua funcionando e que ele **não** carimba mais o cron: abra `/cms/settings?section=instagram`, dispare `Sync Now`, e rode

```sql
select cron_name, last_success_at, consecutive_failures
  from cron_health where cron_name = 'instagram-sync';
select mode, status, started_at from public.instagram_sync_log
  order by created_at desc limit 3;
```

Esperado: `cron_health.last_success_at` **inalterado** pelo clique (só o cron das 13:00 o move) e uma linha `mode='manual'` recém-criada pela server action.

---

## Grupo 2 — corpo `fix(instagram): restore HTTP transport for Sync Now` (executar **só** se `GATE = REPROVOU`)

### Task 3: `triggerInstagramSync` volta ao `fetch` autenticado; a rota mantém `mode`/`accountId`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts` — só a função `triggerInstagramSync` (âncora **por nome de função**, como manda a spec; no `51e78a31` ela começa em `:636`, e A2 reescreveu o corpo dela) e, se ficarem órfãos, os imports de `@/lib/instagram/sync` e `@/lib/instagram/sync-log`
- Test: `apps/web/test/instagram/actions.test.ts` (inverte a asserção de A "**0** chamadas a `global.fetch`" para **1**, e acrescenta os casos de escopo e de erro)
- Test: `apps/web/test/api/cron/instagram-sync.test.ts` (acrescenta o ratchet que fixa `mode`/`accountId` como contrato vivo — **sem remover** o `it('returns 400 for invalid mode')` de `:106-111`)
- **NÃO tocar:** `apps/web/src/app/api/cron/instagram-sync/route.ts` (a rota fica exatamente como A a deixou) e `apps/web/test/instagram/cron-route.test.ts` (o `?mode=` de `:30` fica como está)

**Interfaces:**
- Consumes: `requireEditAccess(): Promise<string>` (`actions.ts:18-27`, devolve `siteId`); `getSupabaseServiceClient()`; `zodError(err)`; `revalidatePath` de `next/cache`; `GET /api/cron/instagram-sync?mode=manual&accountId=<uuid>` protegida por `Authorization: Bearer <CRON_SECRET>`; o tipo local `SyncActionResult = { ok: true; partial?: boolean } | { ok: false; error: string }` declarado por A em `actions.ts`.
- Produces: `triggerInstagramSync(input: { accountId: string }): Promise<SyncActionResult>` — devolve `{ ok: true }` (sem `partial`), `{ ok: false, error: 'Account not found' }`, `{ ok: false, error: 'CRON_SECRET not configured' }`, `{ ok: false, error: 'Sync failed: <status>' }` ou `{ ok: false, error: <mensagem da exceção de rede> }`.
- **Custo declarado deste ramo (registrar no relatório da task, spec §0 linha A5):** (a) com o transporte HTTP de volta, um `Sync Now` volta a carimbar `cron_health['instagram-sync']` — `route.ts:27` passa `tag='instagram-sync'` a `withCronLock` independentemente do `mode` —, ou seja, a falsificação que A2 fechou volta a existir **só para o modo manual**; (b) `partial` deixa de ser observável pela action (o corpo da rota não carrega o campo), então o resultado de um run truncado pelo prazo chega à UI como `{ ok: true }` seco. Os dois ficam como dívida até a herança de `maxDuration` ser resolvida por outra via.

- [ ] **Step 1: Escrever os testes que falham em `test/instagram/actions.test.ts`**

O pragma `// @vitest-environment node` já foi acrescentado a este arquivo em A — confirme que ele é a **primeira linha**; se não for, acrescente. Garanta que estes mocks existem no topo (se A já declarou um mock idêntico para o mesmo módulo, **não** duplique):

```ts
const mockSyncInstagramAccount = vi.fn()
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: (...args: unknown[]) => mockSyncInstagramAccount(...args),
}))
```

Acrescente o helper de lookup e as constantes ao lado do `mockGetClient` já existente:

```ts
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'

/** Espelha o select('*').eq('id').eq('site_id').single() que A2 deixou na action. */
function accountLookup(row: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue(
    row ? { data: row, error: null } : { data: null, error: { message: 'No rows found' } },
  )
  const eqSite = vi.fn().mockReturnValue({ single })
  const eqId = vi.fn().mockReturnValue({ eq: eqSite })
  const select = vi.fn().mockReturnValue({ eq: eqId })
  return { client: { from: vi.fn().mockReturnValue({ select }) }, select, eqId, eqSite }
}
```

E acrescente o bloco de testes no fim do `describe('Instagram server actions')`:

```ts
  describe('triggerInstagramSync (HTTP transport)', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    it('calls the cron route over authenticated HTTP, never in-process', async () => {
      vi.stubEnv('CRON_SECRET', 'test-cron-secret')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test')
      const lookup = accountLookup({ id: ACCOUNT_ID, site_id: 'site-1', access_token: 'tok' })
      mockGetClient.mockReturnValue(lookup.client as never)
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))

      const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
      const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

      expect(result).toEqual({ ok: true })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]!
      expect(String(url)).toBe(
        `https://example.test/api/cron/instagram-sync?mode=manual&accountId=${ACCOUNT_ID}`,
      )
      expect((init?.headers as Record<string, string>).authorization).toBe(
        'Bearer test-cron-secret',
      )
      // O sync em processo de A2 sai de cena neste ramo.
      expect(mockSyncInstagramAccount).not.toHaveBeenCalled()
    })

    it('proves site scope BEFORE the HTTP hop: foreign account never reaches the cron', async () => {
      vi.stubEnv('CRON_SECRET', 'test-cron-secret')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test')
      const lookup = accountLookup(null) // conta de outro site ⇒ 0 linhas
      mockGetClient.mockReturnValue(lookup.client as never)
      // Com implementação: uma regressão que dispare o fetch falha a asserção,
      // nunca sai para a rede.
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('', { status: 200 }))

      const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
      const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

      expect(result).toEqual({ ok: false, error: 'Account not found' })
      expect(lookup.eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
      expect(lookup.eqSite).toHaveBeenCalledWith('site_id', 'site-1')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('surfaces a non-2xx cron response as an error', async () => {
      vi.stubEnv('CRON_SECRET', 'test-cron-secret')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test')
      const lookup = accountLookup({ id: ACCOUNT_ID, site_id: 'site-1', access_token: 'tok' })
      mockGetClient.mockReturnValue(lookup.client as never)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))

      const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
      const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

      expect(result).toEqual({ ok: false, error: 'Sync failed: 500' })
    })

    it('refuses to run without CRON_SECRET', async () => {
      vi.stubEnv('CRON_SECRET', '')
      const lookup = accountLookup({ id: ACCOUNT_ID, site_id: 'site-1', access_token: 'tok' })
      mockGetClient.mockReturnValue(lookup.client as never)
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('', { status: 200 }))

      const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
      const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

      expect(result).toEqual({ ok: false, error: 'CRON_SECRET not configured' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
```

Acrescente `afterEach` ao import de `vitest` do arquivo se ele ainda não estiver lá:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

**E remova o teste de A que exigia zero `fetch`** — ele é a asserção que este commit inverte. Ele foi escrito em A como (nome/forma podem variar; localize pelo `not.toHaveBeenCalled()` sobre o spy de `fetch` dentro de um teste de `triggerInstagramSync`):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
grep -n "triggerInstagramSync" -A 20 test/instagram/actions.test.ts | grep -n "fetch"
```

Apague **apenas** o teste cujo corpo assere `expect(fetchSpy).not.toHaveBeenCalled()` **junto com** `expect(mockSyncInstagramAccount).toHaveBeenCalled()` (o "em processo" de A). Os demais testes de A sobre `triggerInstagramSync` — em especial o de conta de outro site — ficam cobertos pelos novos.

- [ ] **Step 2: Rodar o arquivo e verificar que os testes novos falham**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
```

Esperado: **FAIL**. O primeiro teste falha com `expected fetch to have been called 1 time, but got 0` (a action de A chama `syncInstagramAccount` em processo). O terceiro e o quarto falham pelo mesmo motivo. O segundo (escopo) pode já passar — é a garantia de A2 que este commit **preserva**.

- [ ] **Step 3: Reescrever `triggerInstagramSync` em `src/app/cms/(authed)/settings/actions.ts`**

Substitua o corpo inteiro da função (mantendo tudo o mais do arquivo intacto):

```ts
export async function triggerInstagramSync(input: {
  accountId: string
}): Promise<SyncActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()

  // O escopo de site e provado AQUI, antes de qualquer salto HTTP: a rota do
  // cron nao tem sessao e filtra so por `id` (route.ts:33-35), entao este
  // select — o mesmo que A2 introduziu — e a unica coisa que impede um
  // "Sync Now" de tocar a conta de outro ring. Ele fica mesmo o transporte
  // sendo HTTP: `select('*')` porque e a forma que A2 fixou.
  const supabase = getSupabaseServiceClient()
  const { data: account, error: lookupError } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)
    .single()

  if (lookupError || !account) return { ok: false, error: 'Account not found' }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' }

  // Transporte HTTP restaurado em A5: o gate pos-A mediu que a server action
  // NAO herda o `maxDuration = 120` da page, entao um sync longo em processo
  // morreria no teto padrao de funcao (60 s). A rota do cron tem o proprio
  // `maxDuration` e roda o trabalho ate o fim.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/cron/instagram-sync?mode=manual&accountId=${encodeURIComponent(parsed.data.accountId)}`,
      { headers: { authorization: `Bearer ${cronSecret}` }, cache: 'no-store' },
    )
    if (!res.ok) return { ok: false, error: `Sync failed: ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync request failed' }
  }

  revalidatePath('/cms/settings')
  return { ok: true }
}
```

Notas de forma:
- `SyncActionResult` continua sendo o tipo de retorno (declarado por A neste mesmo arquivo). `partial` simplesmente nunca é setado neste ramo — é o custo declarado (b) das Interfaces. **Não** troque o tipo por `ActionResult`: isso quebraria o consumidor que A ajustou na UI.
- A action **não** abre nem fecha linha de `instagram_sync_log` — quem escreve a linha `mode='manual'` volta a ser a rota (`route.ts:48-53,63-72,76-82`). Duas linhas por clique seria regressão de observabilidade.
- A action **não** chama `revalidateTag('instagram-feed', …)`: quem revalida é a rota, ao fim do run (`route.ts:88-90`).
- `encodeURIComponent` no `accountId`: o Zod já garante UUID, mas a interpolação crua em URL é o padrão que o `audit` marca.

- [ ] **Step 4: Remover os imports que ficaram órfãos**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
grep -n "syncInstagramAccount\|openSyncRow\|closeSyncRow\|InstagramAccountRow" "src/app/cms/(authed)/settings/actions.ts"
```

Se as **únicas** ocorrências restantes forem as linhas de `import`, apague essas linhas de import (`@/lib/instagram/sync`, `@/lib/instagram/sync-log`, e o `import type` de `@/lib/instagram/types` se o row não for mais tipado em lugar nenhum do arquivo). Se qualquer outra função do arquivo ainda usa um desses símbolos, **mantenha** o import correspondente.

- [ ] **Step 5: Rodar os testes da action e verificar que passam**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
```

Esperado: **PASS**, incluindo os quatro testes novos.

- [ ] **Step 6: Escrever o ratchet que fixa `mode`/`accountId` como contrato vivo**

`test/api/cron/instagram-sync.test.ts` já tem o pragma `// @vitest-environment node` desde A — confirme que ele é a primeira linha. Acrescente o import do mock do lock, logo abaixo dos imports do route e de `next/cache`:

```ts
import { withCronLock } from '@/lib/logger'
```

Acrescente o helper gravador ao lado de `accountsQuery` (o `accountsQuery` atual é um Proxy que devolve um `vi.fn()` novo a cada acesso — não guarda os argumentos):

```ts
/** Query encadeável que GRAVA cada `.eq(col, val)` aplicado. */
function recordingAccountsQuery(data: unknown[]) {
  const eqCalls: Array<[string, unknown]> = []
  const result = Promise.resolve({ data, error: null })
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val])
      return chain
    },
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  }
  return { chain, eqCalls }
}
```

E acrescente o teste no fim do `describe` (**sem** remover `it('returns 400 for invalid mode')`):

```ts
  it('honours mode=manual and accountId — the Sync Now transport depends on both', async () => {
    const { chain, eqCalls } = recordingAccountsQuery([])
    mockFrom.mockImplementation((table: string) =>
      table === 'instagram_accounts' ? chain : {},
    )

    const res = await GET(makeRequest({ mode: 'manual', accountId: 'acc-2' }))

    expect(res.status).toBe(200)
    // A server action `triggerInstagramSync` chama exatamente esta URL (A5,
    // ramo reprovado do gate de maxDuration). Apagar qualquer um dos dois
    // parametros quebra o botao "Sync Now" em silencio.
    expect(eqCalls).toEqual([['sync_enabled', true], ['id', 'acc-2']])
    expect(vi.mocked(withCronLock).mock.calls[0]?.[1]).toBe('instagram-sync-manual')
  })
```

- [ ] **Step 7: Rodar o arquivo da rota e verificar que passa**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/api/cron/instagram-sync.test.ts
```

Esperado: **PASS**, com o `it('returns 400 for invalid mode')` ainda presente e verde (neste ramo ele **não** é removido — spec §0: "nenhuma das duas edições de §6 acontece").

- [ ] **Step 8: Provar que a rota e o `cron-route.test.ts` não foram tocados**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git diff --name-only
```

Esperado: exatamente três caminhos — `apps/web/src/app/cms/(authed)/settings/actions.ts`, `apps/web/test/instagram/actions.test.ts`, `apps/web/test/api/cron/instagram-sync.test.ts`. **Se `apps/web/src/app/api/cron/instagram-sync/route.ts` ou `apps/web/test/instagram/cron-route.test.ts` aparecerem, reverta essas duas alterações** (`git checkout -- <path>`): neste ramo a rota mantém `mode`/`accountId` e o lock atual, e o `?mode=` de `cron-route.test.ts:30` fica como está.

- [ ] **Step 9: Rodar as suítes vizinhas e o typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram test/api/cron/instagram-sync.test.ts \
  test/app/contact-settings-actions.test.ts test/unit/use-server-exports.test.ts
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web
```

Esperado: **PASS** em tudo e `typecheck` exit 0. `contact-settings-actions.test.ts` entra porque compartilha o arquivo `settings/actions.ts`; `use-server-exports.test.ts` é o ratchet Next 16 sobre exports de arquivos `'use server'` — `triggerInstagramSync` continua `export async function`, então tem de ficar verde.

- [ ] **Step 10: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/actions.ts" \
        apps/web/test/instagram/actions.test.ts \
        apps/web/test/api/cron/instagram-sync.test.ts
git commit -m "fix(instagram): restore HTTP transport for Sync Now

O gate de heranca de maxDuration pos-A mediu que a server action NAO herda o
export const maxDuration = 120 da page /cms/settings: o Sync Now em processo
que A2 entregou morre no teto padrao de funcao (60 s) na conta real. A5
restaura o transporte HTTP, sem reeditar A:

- triggerInstagramSync volta a chamar
  /api/cron/instagram-sync?mode=manual&accountId=<uuid> por fetch autenticado
  (Authorization: Bearer <CRON_SECRET>);
- o select('*').eq('id').eq('site_id', siteId).single() de A2 PERMANECE e
  passou a ser testado como o que ele e: a prova de escopo de site, feita
  ANTES do salto HTTP — a rota do cron nao tem sessao e filtra so por id;
- a rota mantem mode/accountId e o lock atual; nenhuma das duas edicoes de
  teste do ramo aprovado acontece.

Divida declarada (spec 0, linha A5): um Sync Now volta a carimbar
cron_health['instagram-sync'] (route.ts:27 passa a mesma tag para qualquer
mode), e o campo partial deixa de ser observavel pela action, porque o corpo
da rota nao o carrega. Ambos ficam ate a heranca de maxDuration ser resolvida
por outra via."
```

*(O executor acrescenta os trailers de atribuição do próprio harness.)*

---

### Task 4: Verificação completa, push e promoção do corpo 2

**Files:**
- Nenhum arquivo de código — esta task é o portão de qualidade e a promoção. Só produz commits novos se a verificação achar defeito.

**Interfaces:**
- Consumes: o commit `fix(instagram): restore HTTP transport for Sync Now` da Task 3.
- Produces: `staging` verde na CI e `main` com A5 promovido — pré-requisito declarado do commit **B** no `README.md` dos planos ("CI verde antes do seguinte"); e a dívida do carimbo de `cron_health` registrada.

- [ ] **Step 1: Rodar a suíte inteira de `apps/web`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run
```

Esperado: **PASS**. Custo medido em 2026-09-03: ~1078 arquivos, ~13.780 testes, **160 s** (CLAUDE.md). Qualquer vermelho é regressão desta mudança até prova em contrário.

- [ ] **Step 2: Provar que o commit é revertível sozinho**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git revert --no-commit HEAD && npm run typecheck -w apps/web && git revert --abort
```

Esperado: `typecheck` exit 0 com o revert aplicado (revertê-lo devolve a chamada em processo de A, que continua compilando porque A5 não tocou em `sync.ts`/`sync-log.ts`), e a árvore volta ao commit da Task 3.

- [ ] **Step 3: Push para `staging`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git push origin staging
```

- [ ] **Step 4: Esperar a CI verde**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
gh run list --branch staging --limit 3
gh run watch
```

Esperado: `ci.yml` verde e build da Vercel verde. Nada é promovido com CI vermelha.

- [ ] **Step 5: Promover `staging → main`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

- [ ] **Step 6: Provar o transporte restaurado em produção — e medir o custo declarado**

Abra `/cms/settings?section=instagram` e dispare `Sync Now` na conta real. Depois:

```sql
select mode, status, posts_inserted, started_at, completed_at
  from public.instagram_sync_log order by created_at desc limit 3;
select cron_name, last_success_at from cron_health where cron_name = 'instagram-sync';
```

Esperado: **uma** linha `mode='manual'` com `status='completed'` (não duas — a action não abre linha própria neste ramo) **e** `cron_health.last_success_at` movido pelo clique. Esse segundo fato é a **dívida declarada**, não um bug: registre-o.

- [ ] **Step 7: Registrar a dívida no ledger**

Anexe ao fim da seção de ledger de `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`:

```markdown
**Dívida aberta por A5 (ramo REPROVOU):** um `Sync Now` carimba
`cron_health['instagram-sync']` (`instagram-sync/route.ts:27` passa
`tag='instagram-sync'` a `withCronLock` para qualquer `mode`) — a falsificação
que A2 fechou volta a existir só no modo manual. E `partial` deixa de ser
observável pela server action, porque o corpo da rota não carrega o campo.
Ambas ficam até a herança de `maxDuration` ser resolvida por outra via.
Confirmado em produção em <YYYY-MM-DD>: `last_success_at` movido por clique
humano, 1 linha `mode='manual'` por clique.
```

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add docs/superpowers/plans/2026-09-06-instagram-oauth-README.md
git commit -m "docs(instagram): registrar divida do transporte HTTP do Sync Now"
git push origin staging
```

---

## Notas de execução (valem para os dois grupos)

- **Não existe "os dois corpos".** Se você já commitou um grupo e depois descobriu que o ledger dizia o contrário, `git revert` o commit errado e execute o grupo certo — não emende os dois num só.
- **Próximo commit da entrega:** **B** — `chore(oauth): extrair helpers para src/lib/oauth` (`docs/superpowers/plans/2026-09-06-instagram-oauth-b.md`), só depois da CI verde e da promoção desta task.
- **Rollback de A5** (ordem reversa obrigatória `C3 → C4 → C2 → C1 → B → A5 → A4 → A`): `git revert <A5>` puro nos dois corpos, sem passo de banco. No corpo 1 o revert devolve `mode`/`accountId` à rota (inócuo — ninguém os chama); no corpo 2 devolve a chamada em processo de A2, que passa a morrer em ~60 s no run pesado. Reverter A exige C3, C4, C2, C1, B **e** A5 revertidos antes.
