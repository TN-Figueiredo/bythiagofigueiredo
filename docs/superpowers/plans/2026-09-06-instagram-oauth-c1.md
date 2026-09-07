# Instagram OAuth — Commit C1: `feat(instagram): schema de saúde do token (expand)` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a migration M1 (expand puro) que dá a `instagram_accounts` as 9 colunas de saúde do token, cria as RPCs `instagram_mark_token_invalid` e `ops_alert_claim` (+ `ops_alert_state`), a chave composta de `instagram_posts` que coexiste com a unique global até C4, `instagram_deletion_requests`, a categoria de consentimento `social_feed_read` e o fechamento de DML para `anon`/`authenticated` — com `db:types` regenerado, `types.ts` atualizado e três suítes DB-gated que travam cada garantia.

**Architecture:** Uma única migration criada por `npm run db:new instagram_token_health`, escrita em três blocos (um por task, cada bloco inserido **antes** da linha `notify pgrst` final), cada bloco precedido pela suíte DB-gated que ele faz passar. Nenhum código de aplicação escreve as colunas novas neste commit — C2 é quem passa a escrevê-las. Por isso as 9 colunas entram **opcionais** em `InstagramAccountRow`: os literais de `InstagramAccountRow` que já existem em `test/instagram/{sync,cron-route,token-refresh}.test.ts` precisam continuar compilando um commit inteiro antes de qualquer escritor existir.

**Tech Stack:** Supabase (PostgreSQL 17, PostgREST, RLS, `SECURITY DEFINER`), Supabase CLI 2.98.2, TypeScript 5 strict, Vitest (`pg` + `@supabase/supabase-js` nas suítes DB-gated), Next.js 16.3.4.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **C1**, §3.2 ("Migration M1 (C1)", as duas RPCs, `ops_alert_state`, `instagram_deletion_requests`, a DDL de `consents`, o seed de `consent_texts`, as mudanças de `types.ts`), §6 "DB-gated", §7 "Gates antes de C1" e passo 2.

**Índice dos oito commits:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`. Ordem: A → A4 → A5 → B → **C1** → C2 → C4 → C3.

## Global Constraints

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` e `apps/web/src/lib/` (`src/lib/instagram/*` mora no segundo). Há dois `queries.ts` — sempre qualificar.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `@/lib/<domínio>/*` mapeia para `apps/web/lib/` só para 16 prefixos; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`.
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` no topo; `getSupabaseServiceClient()` só após guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; fix de teste vai no mesmo commit.
- Migrations: **sempre** `npm run db:new <nome>`; idempotentes (`drop … if exists` antes de `create`); `db:reset` → `db:types` → commit → `db:push:prod`. Banco local tem resíduo de rodadas de revisão: `npm run db:reset` antes de validar M1.
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só após verificação local completa** (cada push dispara builds na Vercel).
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto.
- Definições nomeadas do spec valem por nome: `CAMPOS_DE_EPISÓDIO` (`token_error`, `token_error_at`, `token_error_mode`, `token_alert_sent_at`, `token_alert_attempt_at`), horários `"0 11 * * *"` / `"0 13 * * *"`, `REGRA-PII-NTFY`.
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do dono: `America/Sao_Paulo`.
- **Específico de C1:** os três arquivos DB-gated **MUST** ficar em `apps/web/test/integration/` — a CI seleciona DB-gated **por path** (`.github/workflows/ci.yml:137` roda `HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/`). Fora desse diretório o arquivo roda no job comum, sem `HAS_LOCAL_DB`, e `describe.skipIf(skipIfNoLocalDb())` pula a suíte inteira em silêncio com CI verde.
- **Específico de C1:** `vercel.json` **não** é tocado. Nenhum código de aplicação escreve as colunas novas.

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/<TS>_instagram_token_health.sql` (**criar** via `npm run db:new`) | M1 inteira, em três blocos numerados + `notify pgrst` no fim | 2, 3, 4 |
| `apps/web/test/integration/instagram-token-rpc.test.ts` (**criar**) | 9 colunas, CHECKs novas, backfill de `handle`, `instagram_mark_token_invalid` (3 ramos, `p_mode`, truncação, escopo de site, concorrência, `out_`, `search_path`, 42501) | 2, 5 |
| `apps/web/test/integration/ops-alert-claim.test.ts` (**criar**) | `ops_alert_state` + `ops_alert_claim` (50 concorrentes, −25 h, comparação estrita, `interval '0'`, `'23 hours'` diário, 42501, `select`/`delete` diretos), CHECK de `consents`, seed de `consent_texts`, coexistência das duas uniques de `instagram_posts` | 3 |
| `apps/web/test/integration/instagram-accounts-public-view.test.ts` (**estender** — criado no commit A/A3) | ratchet duplo de `column_privileges` pós-M1, DML fechado, `*_staff_write` ausentes, tabelas de ops inacessíveis, CHECKs de `instagram_sync_log`, índice novo | 4 |
| `apps/web/src/lib/instagram/types.ts` (**modificar**) | `InstagramAccountRow` += 9 opcionais; `InstagramAccountPublic` = `Omit<…, 'access_token' \| as 9>`; `InstagramSyncMode` += 3 | 5 |
| `apps/web/src/types/database.types.ts` (**regenerar**) | saída de `npm run db:types` — nunca editar à mão | 5 |

---

### Task 1: Pre-flight — Gates antes de C1 (§7)

Nenhum arquivo é criado ou modificado nesta task. Ela termina com as saídas coladas no corpo do commit da Task 2 (o runbook `docs/ops/instagram-token-alert-runbook.md` só nasce em C3 — até lá o corpo do commit é o registro durável).

**Files:**
- Nenhum. Somente leitura e verificação.

**Interfaces:**
- Consumes: commits **A**, **A4**, **A5** e **B** já em `staging` e promovidos (§0 ordem obrigatória).
- Produces: a decisão binária sobre o parágrafo de revogação do texto `social_feed_read` (Task 3, Step 3) e a confirmação de que o banco local está limpo para validar M1.

- [ ] **Step 1: Confirmar que A/A4/A5/B estão na árvore**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git log --oneline -20 | grep -E 'fechar vazamentos vivos|strip trusted headers|(drop manual mode from sync cron|restore HTTP transport for Sync Now)|extrair helpers para src/lib/oauth'
ls supabase/migrations | grep instagram_public_view_lockdown
test -f apps/web/test/integration/instagram-accounts-public-view.test.ts && echo 'A3 OK'
```

Esperado: as quatro linhas de commit, a migration de A3 e `A3 OK`. **Se `instagram-accounts-public-view.test.ts` não existir, PARE** — o commit A não está na árvore e C1 está fora de ordem; a allow-list de colunas que M1 estende não existe ainda.

- [ ] **Step 2: Migrations pendentes aplicadas + banco local limpo**

```bash
npm run db:which
npx supabase@2.98.2 migration list
npm run db:start
npm run db:reset
```

Esperado: `migration list` sem pendentes em prod (incl. `20260905000003`); `db:reset` completa sem erro. O `db:reset` é obrigatório antes de validar M1 — rodadas de revisão criaram `ops_alert_state`/`ops_alert_claim`/`instagram_mark_token_invalid` fora de migration no banco local (spec, preâmbulo).

- [ ] **Step 3: Gate bloqueante do texto de consentimento — revogação pelo servidor**

```bash
curl -sS -X DELETE "https://graph.instagram.com/<ig-user-id>/permissions?access_token=<token de teste>" -w '\nHTTP %{http_code}\n'
```

Registre a saída literal. **Se a chamada revogar de fato** (2xx + a conta de teste perde o app), o texto `social_feed_read` MUST ser corrigido **antes** do seed de M1: em pt-BR, trocar `(a Meta não oferece revogação pelo servidor; o token permanece válido lá por até 60 dias)` por `(a revogação é feita imediatamente no servidor da Meta)`; em en, trocar `(Meta does not offer server-side revocation; the token remains valid there for up to 60 days)` por `(revocation is performed immediately on Meta's server)` — e anotar no corpo do commit que `disconnectInstagramAccount` (C3) passa a chamar o endpoint. **Se não revogar** (4xx/erro de rota), o texto fica como está na Task 3 e a frase entra em §8 como inferência (M15).

- [ ] **Step 4: App Business, chaves e canais**

```bash
# App Dashboard: confirmar tipo do app = Business; anotar a versão do card
# "Settings > Advanced" e a data de expiração da versão da API.
vercel env ls | grep -E 'SOCIAL_MASTER_KEY|NTFY_URL|AWS_SES'
curl -sS -d 'gate C1: ntfy alive' "$NTFY_URL" -w '\nHTTP %{http_code}\n'
```

Esperado: `SOCIAL_MASTER_KEY` presente em production/preview (e no CI) e com **64 hex**; `NTFY_URL` presente; o push chega no aparelho com o `Click` funcionando; `AWS_SES_*` presentes e um e-mail de teste entregue.

- [ ] **Step 5: Watchdog vivo e provado (bloqueante)**

```bash
curl -sS https://bythiagofigueiredo.com/api/health | head -c 400   # agregado MUST ser "ok" ANTES de forçar
```

Depois, no SQL editor de produção:

```sql
update public.cron_health set consecutive_failures = 1 where cron_name = 'instagram-token-refresh';
-- Se afetar 0 linhas:
-- insert into public.cron_health (cron_name, consecutive_failures) values ('instagram-token-refresh', 1)
--   on conflict (cron_name) do update set consecutive_failures = 1;
```

Esperado: **1 linha afetada**, push recebido no celular pelo watchdog. Depois reverter:

```sql
update public.cron_health set consecutive_failures = 0 where cron_name = 'instagram-token-refresh';
```

- [ ] **Step 6: Segundo canal (e-mail) tem destinatário — bloqueante**

No SQL editor de produção:

```sql
select user_id, category, channel_email
  from public.notification_preferences
 where site_id = '<site do dono>' and user_id = '<user id do dono>';

select s.id, s.slug,
       (select count(distinct m.user_id)
          from public.organization_members m
         where m.role = 'org_admin'
           and (m.org_id = s.org_id
                or m.org_id in (select o.id from public.organizations o where o.parent_org_id is null))
       ) as admin_count
  from public.sites s
 where exists (select 1 from public.instagram_accounts ia where ia.site_id = s.id);
```

Esperado: primeira query = **0 linhas** (o default de `defaultChannels` vale) **ou** `channel_email = true`. Segunda query: `admin_count >= 1` para **toda** linha — é bloqueante (`src/lib/notifications/get-site-admin-users.ts:19` devolve `[]` em silêncio quando o lookup falha, e sem admin o segundo canal não entrega nada).

- [ ] **Step 7: Janela C2→C4 conhecida**

```sql
select id, locale, ig_user_id from public.instagram_accounts order by ig_user_id, locale;
```

Mais de uma linha com o **mesmo** `ig_user_id` ⇒ a janela em que as duas uniques de `instagram_posts` coexistem será exercitada de verdade (esperado: as linhas de locale do site). Anote a contagem.

- [ ] **Step 8: Consolidar as saídas**

Guarde num rascunho local (fora do repo) as saídas dos Steps 3–7. Elas entram no corpo do commit da Task 2 e migram para `docs/ops/instagram-token-alert-runbook.md` em C3.

---

### Task 2: M1 bloco 1 — as 9 colunas + `instagram_mark_token_invalid`

**Files:**
- Create: `supabase/migrations/<TS>_instagram_token_health.sql` (via `npm run db:new instagram_token_health`)
- Create: `apps/web/test/integration/instagram-token-rpc.test.ts`

**Interfaces:**
- Consumes: allow-list de colunas de `authenticated` sobre `public.instagram_accounts` criada em A3 (`revoke select on … from authenticated` + `grant select (<16 colunas>)`); allow-list de `anon` = `{id, site_id}`; helpers `skipIfNoLocalDb()` (`test/helpers/db-skip.ts`), `SUPABASE_URL`/`SERVICE_KEY`/`seedSite` (`test/helpers/db-seed.ts`).
- Produces (consumido por C2 e C3):
  - `public.instagram_mark_token_invalid(p_account uuid, p_site uuid, p_reason text, p_fatal boolean, p_force_reason boolean default false, p_mode text default null) returns table (out_token_error_at timestamptz)` — `security definer`, `set search_path = ''`, `execute` só para `service_role`. Envelopado em C2 por `markTokenInvalid(supabase, account, reason, { fatal, forceReason?, mode? })` (`src/lib/instagram/token.ts`).
  - Colunas novas em `public.instagram_accounts`: `token_refreshed_at timestamptz`, `token_error text`, `token_error_at timestamptz`, `token_error_mode text` (CHECK `('daily','token_refresh')`), `token_alert_sent_at timestamptz`, `token_alert_attempt_at timestamptz`, `token_reprobe_at timestamptz`, `ig_professional_id text`, `ig_user_id_source text not null default 'legacy'` (CHECK `('oauth','legacy')`) — todas legíveis por `authenticated`, nenhuma por `anon`.

- [ ] **Step 1: Escrever a suíte que falha**

Create `apps/web/test/integration/instagram-token-rpc.test.ts`:

```ts
// @vitest-environment node
/**
 * DB-gated integration tests para M1 (commit C1) — bloco 1:
 * as 9 colunas de saúde do token em public.instagram_accounts e a RPC
 * public.instagram_mark_token_invalid.
 *
 * Rodar com:
 *   npm run db:start && npm run db:reset
 *   cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-token-rpc.test.ts
 *
 * MUST viver em test/integration/ — a CI seleciona DB-gated por path
 * (.github/workflows/ci.yml:137). Fora daqui o skipIf pula tudo em silêncio.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const NEW_COLUMNS = [
  'token_refreshed_at',
  'token_error',
  'token_error_at',
  'token_error_mode',
  'token_alert_sent_at',
  'token_alert_attempt_at',
  'token_reprobe_at',
  'ig_professional_id',
  'ig_user_id_source',
] as const

const RPC_SIG =
  'select * from public.instagram_mark_token_invalid($1::uuid, $2::uuid, $3::text, $4::boolean, $5::boolean, $6::text)'

describe.skipIf(skipIfNoLocalDb())('M1 — instagram token health columns + instagram_mark_token_invalid', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  let pg: Client
  const siteIds: string[] = []

  /** Cria um site novo + uma conta de instagram nele. Site novo por conta porque
   *  instagram_accounts tem UNIQUE (site_id, locale). */
  async function freshAccount(handle = 'gate.handle'): Promise<{ siteId: string; accountId: string }> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    const { data, error } = await svc
      .from('instagram_accounts')
      .insert({ site_id: siteId, locale: 'pt', handle, access_token: 'plain-token' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('freshAccount: insert failed')
    return { siteId, accountId: data.id as string }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })

  afterAll(async () => {
    if (siteIds.length) {
      await svc.from('instagram_accounts').delete().in('site_id', siteIds)
      await svc.from('sites').delete().in('id', siteIds)
    }
    await pg.end()
  })

  // ── Colunas ────────────────────────────────────────────────────────────────

  it('adds the 9 token-health columns: 8 nullable + ig_user_id_source NOT NULL DEFAULT legacy', async () => {
    const { rows } = await pg.query<{
      column_name: string
      is_nullable: string
      column_default: string | null
      data_type: string
    }>(
      `select column_name, is_nullable, column_default, data_type
         from information_schema.columns
        where table_schema = 'public' and table_name = 'instagram_accounts'
          and column_name = any($1::text[])
        order by column_name`,
      [[...NEW_COLUMNS]],
    )

    expect(rows.map(r => r.column_name).sort()).toEqual([...NEW_COLUMNS].sort())

    const source = rows.find(r => r.column_name === 'ig_user_id_source')
    expect(source?.is_nullable).toBe('NO')
    expect(source?.column_default ?? '').toContain("'legacy'")
    expect(source?.data_type).toBe('text')

    for (const r of rows.filter(r => r.column_name !== 'ig_user_id_source')) {
      expect(r.is_nullable).toBe('YES')
      expect(r.column_default).toBeNull()
    }
    expect(rows.find(r => r.column_name === 'token_refreshed_at')?.data_type)
      .toBe('timestamp with time zone')
    expect(rows.find(r => r.column_name === 'ig_professional_id')?.data_type).toBe('text')
  })

  it('defaults ig_user_id_source to legacy on a freshly inserted row', async () => {
    const { accountId } = await freshAccount()
    const { data } = await svc
      .from('instagram_accounts')
      .select('ig_user_id_source, token_error, token_error_at, ig_professional_id')
      .eq('id', accountId)
      .single()
    expect(data?.ig_user_id_source).toBe('legacy')
    expect(data?.token_error).toBeNull()
    expect(data?.token_error_at).toBeNull()
    expect(data?.ig_professional_id).toBeNull()
  })

  it('rejects unknown token_error_mode and unknown ig_user_id_source with 23514', async () => {
    const { accountId } = await freshAccount()
    const badMode = await svc
      .from('instagram_accounts')
      .update({ token_error_mode: 'manual' })
      .eq('id', accountId)
    expect(badMode.error?.code).toBe('23514')

    const badSource = await svc
      .from('instagram_accounts')
      .update({ ig_user_id_source: 'meta' })
      .eq('id', accountId)
    expect(badSource.error?.code).toBe('23514')

    const okMode = await svc
      .from('instagram_accounts')
      .update({ token_error_mode: 'daily' })
      .eq('id', accountId)
    expect(okMode.error).toBeNull()
  })

  it('the handle backfill statement lowercases and is idempotent', async () => {
    const { accountId } = await freshAccount()
    await pg.query('update public.instagram_accounts set handle = $1 where id = $2', [
      'MixedCase.Handle',
      accountId,
    ])

    const first = await pg.query(
      'update public.instagram_accounts set handle = lower(handle) where handle <> lower(handle)',
    )
    expect(first.rowCount).toBe(1)

    const second = await pg.query(
      'update public.instagram_accounts set handle = lower(handle) where handle <> lower(handle)',
    )
    expect(second.rowCount).toBe(0)

    const { rows } = await pg.query<{ handle: string }>(
      'select handle from public.instagram_accounts where id = $1',
      [accountId],
    )
    expect(rows[0]?.handle).toBe('mixedcase.handle')
  })

  // ── RPC: ramo 1 (fatal:false) ──────────────────────────────────────────────

  it('fatal:false opens an episode with p_mode, clears the pacemakers and never writes the reason', async () => {
    const { siteId, accountId } = await freshAccount()
    await pg.query(
      `update public.instagram_accounts
          set token_reprobe_at = now(), token_alert_sent_at = now(), token_alert_attempt_at = now()
        where id = $1`,
      [accountId],
    )

    const { data, error } = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId,
      p_site: siteId,
      p_reason: 'transient',
      p_fatal: false,
      p_force_reason: false,
      p_mode: 'token_refresh',
    })
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    // O OUT param é `out_token_error_at`, não `token_error_at`: o nome desambigua
    // a coluna dentro do plpgsql (sem ele, `returning token_error_at` colide com
    // o parâmetro de saída). C2 não lê o valor — `markTokenInvalid` só inspeciona
    // `error` —, mas o contrato de 0-ou-1 linha é o que esta suíte trava.
    expect((data as Array<{ out_token_error_at: string | null }>)[0]?.out_token_error_at)
      .not.toBeNull()

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBeNull()
    expect(row?.token_error_at).not.toBeNull()
    expect(row?.token_error_mode).toBe('token_refresh')
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()
  })

  it('fatal:false is a no-op once the episode is open (guard token_error_at is null)', async () => {
    const { siteId, accountId } = await freshAccount()
    const args = {
      p_account: accountId,
      p_site: siteId,
      p_reason: 'transient',
      p_fatal: false,
      p_force_reason: false,
      p_mode: 'daily',
    }
    const first = await svc.rpc('instagram_mark_token_invalid', args)
    expect(first.data).toHaveLength(1)

    const second = await svc.rpc('instagram_mark_token_invalid', {
      ...args,
      p_mode: 'token_refresh',
    })
    expect(second.error).toBeNull()
    expect(second.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error_mode')
      .eq('id', accountId)
      .single()
    expect(row?.token_error_mode).toBe('daily') // o segundo p_mode NÃO sobrescreve
  })

  // ── RPC: ramo 3 (fatal:true, force:false) ─────────────────────────────────

  it('fatal:true writes the reason, preserves the original token_error_at and re-arms the pacemakers', async () => {
    const { siteId, accountId } = await freshAccount()
    const opened = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'transient',
      p_fatal: false, p_force_reason: false, p_mode: 'daily',
    })
    const openedAt = (opened.data as Array<{ out_token_error_at: string }>)[0]?.out_token_error_at
    expect(openedAt).toBeTruthy()

    await pg.query(
      `update public.instagram_accounts
          set token_alert_sent_at = now(), token_alert_attempt_at = now(), token_reprobe_at = now()
        where id = $1`,
      [accountId],
    )

    const marked = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'decrypt_failed',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(marked.error).toBeNull()
    expect(marked.data).toHaveLength(1)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_error_at, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBe('decrypt_failed')
    expect(new Date(row!.token_error_at as string).toISOString())
      .toBe(new Date(openedAt as string).toISOString()) // coalesce preservou
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()
  })

  it('fatal:true without force does NOT overwrite an existing reason', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    const second = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(second.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts').select('token_error').eq('id', accountId).single()
    expect(row?.token_error).toBe('expired')
  })

  // ── RPC: ramo 2 (force_reason:true) ───────────────────────────────────────

  it('force_reason:true overwrites a DISTINCT reason and re-arms; the same reason is a no-op', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    await pg.query(
      `update public.instagram_accounts
          set token_alert_sent_at = now(), token_alert_attempt_at = now(), token_reprobe_at = now()
        where id = $1`,
      [accountId],
    )

    const forced = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: true, p_mode: null,
    })
    expect(forced.data).toHaveLength(1)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBe('deauthorized')
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()

    const again = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: true, p_mode: null,
    })
    expect(again.data).toHaveLength(0) // `is distinct from left(p_reason,500)`
  })

  it('truncates p_reason to 500 characters', async () => {
    const { siteId, accountId } = await freshAccount()
    const long = 'x'.repeat(600)
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: long,
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    const { rows } = await pg.query<{ len: number }>(
      'select length(token_error) as len from public.instagram_accounts where id = $1',
      [accountId],
    )
    expect(rows[0]?.len).toBe(500)
  })

  it('is scoped by p_site: a wrong site matches 0 rows and writes nothing', async () => {
    const { accountId } = await freshAccount()
    const { siteId: otherSiteId } = await seedSite(svc)
    siteIds.push(otherSiteId)

    const res = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: otherSiteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts').select('token_error, token_error_at').eq('id', accountId).single()
    expect(row?.token_error).toBeNull()
    expect(row?.token_error_at).toBeNull()
  })

  it('under concurrency exactly one of two sessions opens the episode', async () => {
    const { siteId, accountId } = await freshAccount()
    const c1 = new Client({ connectionString: PG_URL })
    const c2 = new Client({ connectionString: PG_URL })
    await c1.connect()
    await c2.connect()
    try {
      const params = [accountId, siteId, 'transient', false, false, 'daily']
      const [a, b] = await Promise.all([c1.query(RPC_SIG, params), c2.query(RPC_SIG, params)])
      expect((a.rowCount ?? 0) + (b.rowCount ?? 0)).toBe(1)
    } finally {
      await c1.end()
      await c2.end()
    }
  })

  // ── Segurança da função ───────────────────────────────────────────────────

  it('is SECURITY DEFINER with an empty search_path', async () => {
    const { rows } = await pg.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'instagram_mark_token_invalid'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.prosecdef).toBe(true)
    expect(rows[0]?.proconfig ?? []).toContain('search_path=')
  })

  it('denies EXECUTE to anon and authenticated (42501) and allows service_role', async () => {
    const { siteId, accountId } = await freshAccount()
    const params = [accountId, siteId, 'expired', true, false, null]

    for (const role of ['anon', 'authenticated'] as const) {
      const c = new Client({ connectionString: PG_URL })
      await c.connect()
      try {
        await c.query(`set role ${role}`)
        await expect(c.query(RPC_SIG, params)).rejects.toMatchObject({ code: '42501' })
      } finally {
        await c.end()
      }
    }

    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      await c.query('set role service_role')
      const res = await c.query(RPC_SIG, params)
      expect(res.rowCount).toBe(1)
    } finally {
      await c.end()
    }
  })
})
```

- [ ] **Step 2: Rodar a suíte e ver falhar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-token-rpc.test.ts --reporter=verbose
```

Esperado: FAIL. As asserções de coluna vêm vazias (`[]` vs os 9 nomes) e as chamadas de RPC devolvem `PGRST202` / `42883` (`function public.instagram_mark_token_invalid does not exist`). **Nenhum teste pode aparecer como `skipped`** — se aparecer, `HAS_LOCAL_DB` não chegou ao processo.

- [ ] **Step 3: Criar a migration com o bloco 1**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:new instagram_token_health
```

O script imprime `Created: supabase/migrations/<TS>_instagram_token_health.sql`. Use **esse** caminho literal em todos os passos seguintes (com A3 já mergeado hoje, o timestamp será `20260906000002`; a última migration antes desta feature é `20260905000003_drop_cron_http_post_web_orfa.sql`). **Nunca** criar o arquivo à mão nem usar `npx supabase migration new`.

Substitua o conteúdo inteiro do arquivo por:

```sql
-- =============================================================================
-- MIGRATION: instagram_token_health — M1 (commit C1)
-- Spec: docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md §3.2
-- =============================================================================
-- EXPAND puro. Acrescenta:
--   1. as 9 colunas de saúde do token em instagram_accounts (+ grants para
--      authenticated; anon NÃO recebe nenhuma delas) e a RPC de episódio;
--   2. ops_alert_state + ops_alert_claim (rate limiter), a chave composta de
--      instagram_posts que COEXISTE com a unique global até C4, o índice de
--      instagram_sync_log, a CHECK de mode ampliada, a CHECK de consents e o
--      seed de consent_texts para social_feed_read;
--   3. instagram_deletion_requests, o fechamento de DML para anon/authenticated
--      e a queda das três policies *_staff_write.
--
-- Idempotente: add column if not exists, drop constraint/policy/function if
-- exists antes de create, create table if not exists, on conflict do nothing.
-- Único passo irreversível: o lower(handle) do bloco 1 (§7).
-- =============================================================================

-- ── 1. Colunas de saúde do token ────────────────────────────────────────────

alter table public.instagram_accounts
  add column if not exists token_refreshed_at     timestamptz,
  add column if not exists token_error            text,
  add column if not exists token_error_at         timestamptz,
  add column if not exists token_error_mode       text,
  add column if not exists token_alert_sent_at    timestamptz,
  add column if not exists token_alert_attempt_at timestamptz,
  add column if not exists token_reprobe_at       timestamptz,
  add column if not exists ig_professional_id     text,
  add column if not exists ig_user_id_source      text not null default 'legacy';

-- CHECKs nomeadas (e não inline no ADD COLUMN) para que a migration seja
-- idempotente: `add column if not exists … check (…)` pula a CHECK junto da
-- coluna numa segunda execução e deixa a constraint com nome gerado.
alter table public.instagram_accounts
  drop constraint if exists instagram_accounts_token_error_mode_check;
alter table public.instagram_accounts
  add constraint instagram_accounts_token_error_mode_check
  check (token_error_mode is null or token_error_mode in ('daily', 'token_refresh'));

alter table public.instagram_accounts
  drop constraint if exists instagram_accounts_ig_user_id_source_check;
alter table public.instagram_accounts
  add constraint instagram_accounts_ig_user_id_source_check
  check (ig_user_id_source in ('oauth', 'legacy'));

-- authenticated está em allow-list de COLUNAS desde A3: toda coluna nova MUST
-- ser re-concedida (ratchet DB-gated em §6). A anon NÃO se concede nada — a
-- allow-list de anon permanece exatamente {id, site_id}.
grant select (token_refreshed_at, token_error, token_error_at, token_error_mode,
              token_alert_sent_at, token_alert_attempt_at, token_reprobe_at,
              ig_professional_id, ig_user_id_source)
  on public.instagram_accounts to authenticated;

-- Irreversível (§7): sweepTokenAlerts agrupa por 'h:' + lower(handle) e
-- normalizeHandle passa a minusculizar em C3.
update public.instagram_accounts set handle = lower(handle) where handle <> lower(handle);

-- ── RPC de episódio ─────────────────────────────────────────────────────────
-- Estilo de 20260703000003:30-36 (security definer + search_path = '').  BTF-097.

create or replace function public.instagram_mark_token_invalid(
  p_account uuid, p_site uuid, p_reason text, p_fatal boolean,
  p_force_reason boolean default false, p_mode text default null
) returns table (out_token_error_at timestamptz)
  language plpgsql security definer set search_path = ''
as $$ begin
  if not p_fatal then
    return query update public.instagram_accounts
      set token_error_at = now(), token_error_mode = p_mode,
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error_at is null
      returning token_error_at;
  elsif p_force_reason then
    return query update public.instagram_accounts
      set token_error = left(p_reason,500), token_error_at = coalesce(token_error_at, now()),
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error is distinct from left(p_reason,500)
      returning token_error_at;
  else
    return query update public.instagram_accounts
      set token_error = left(p_reason,500), token_error_at = coalesce(token_error_at, now()),
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error is null
      returning token_error_at;
  end if;
end $$;

revoke all on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text)
  from public, anon, authenticated;
grant execute on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text)
  to service_role;

comment on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text) is
  'Abre/atualiza o episódio de token de uma conta do Instagram. fatal:false abre o episódio com o mode; fatal:true grava o motivo sem sobrescrever; force_reason:true (Meta) sobrescreve e re-arma. Devolve 0 ou 1 linha. service_role only.';

-- ── Recarga do cache do PostgREST (MUST ser a última linha do arquivo) ──────
notify pgrst, 'reload schema';
```

- [ ] **Step 4: Aplicar e rodar a suíte até passar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:reset
cd apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-token-rpc.test.ts --reporter=verbose
```

Esperado: PASS em todos os testes do arquivo, `skipped: 0`.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add supabase/migrations/<TS>_instagram_token_health.sql apps/web/test/integration/instagram-token-rpc.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): colunas de saúde do token + instagram_mark_token_invalid (M1 bloco 1)

Gates antes de C1 (§7) — saídas registradas:
- app Business: <sim/não>
- DELETE /{ig-user-id}/permissions: <HTTP + corpo>  → texto social_feed_read <mantido/corrigido>
- SOCIAL_MASTER_KEY 64 hex em prod/preview/CI: <ok>
- NTFY_URL + curl -d test + Click recebido: <ok>
- watchdog: consecutive_failures=1 afetou 1 linha, push recebido, revertido: <ok>
- /api/health agregado antes de forçar: <ok>
- AWS_SES_* + e-mail de teste: <ok>
- notification_preferences do dono: <0 linhas | channel_email=true>
- getSiteAdminUserIds >= 1 para todo site com instagram_accounts: <ok>
- instagram_accounts por ig_user_id: <contagem>
- versão do card Settings > Advanced / expiração: <valor>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 3: M1 bloco 2 — `ops_alert_state` + `ops_alert_claim`, constraints, `consents` e `consent_texts`

**Files:**
- Modify: `supabase/migrations/<TS>_instagram_token_health.sql` (inserir o bloco 2 **imediatamente antes** da linha `-- ── Recarga do cache do PostgREST`)
- Create: `apps/web/test/integration/ops-alert-claim.test.ts`

**Interfaces:**
- Consumes: `public.consent_texts` (`UNIQUE (category, locale, version)`, `20260507000001_schema.sql:2124`), `public.consents.consents_category_check` (10 valores hoje, `20260530000001:5-22`), `public.instagram_posts.instagram_posts_ig_media_id_key` (`20260507190000:49-50`), `public.instagram_sync_log.instagram_sync_log_mode_check` (`20260507190000:85-86`).
- Produces (consumido por C2, C3 e C4):
  - `public.ops_alert_state (key text primary key, last_at timestamptz not null)` — RLS ligada, sem policies, `revoke all` de `anon`/`authenticated`; leitura e liberação por `select`/`delete` diretos do service client.
  - `public.ops_alert_claim(p_key text, p_min_interval interval default interval '1 day') returns boolean` — `security definer`, `set search_path = ''`, `execute` só para `service_role`. **Rate limiter, nunca contador de sequência**; comparação `<` **estrita**.
  - `public.instagram_posts.instagram_posts_account_media_key UNIQUE (account_id, ig_media_id)` — alvo do `onConflict: 'account_id,ig_media_id'` de C2; coexiste com a unique global até C4 (M2 derruba `instagram_posts_ig_media_id_key`).
  - `idx_instagram_sync_log_account_mode (account_id, mode, started_at desc)` — o índice que a derivação de `mediaFailed` de C2 usa (`order by started_at desc limit 3`).
  - `instagram_sync_log_mode_check` com 6 valores: `daily`, `manual`, `token_refresh`, `deauthorize`, `data_deletion`, `rebind`.
  - Categoria de consentimento `social_feed_read` + `consent_texts` `social_feed_read_v1_pt-BR` / `social_feed_read_v1_en`, versão `1.0` — consumidos por `recordSocialConsent` em C3.

- [ ] **Step 1: Escrever a suíte que falha**

Create `apps/web/test/integration/ops-alert-claim.test.ts`:

```ts
// @vitest-environment node
/**
 * DB-gated integration tests para M1 (commit C1) — bloco 2:
 * public.ops_alert_state / public.ops_alert_claim (rate limiter, comparação
 * estrita), a CHECK de consents com social_feed_read, o seed de consent_texts e
 * a coexistência das duas UNIQUE de instagram_posts até C4.
 *
 * Rodar com:
 *   npm run db:start && npm run db:reset
 *   cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/ops-alert-claim.test.ts
 *
 * MUST viver em test/integration/ (a CI seleciona DB-gated por path).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client, Pool } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** anonymous_id MUST casar consents_anonymous_id_check (uuid v4). */
const ANON_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe.skipIf(skipIfNoLocalDb())('M1 — ops_alert_claim, consents e as uniques de instagram_posts', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  let pg: Client
  const keys: string[] = []
  const siteIds: string[] = []
  const accountIds: string[] = []
  const consentIds: string[] = []

  function freshKey(label: string): string {
    const key = `test:${label}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    keys.push(key)
    return key
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })

  afterAll(async () => {
    if (keys.length) await svc.from('ops_alert_state').delete().in('key', keys)
    if (consentIds.length) await svc.from('consents').delete().in('id', consentIds)
    if (siteIds.length) {
      await svc.from('instagram_posts').delete().in('account_id', accountIds)
      await svc.from('instagram_accounts').delete().in('site_id', siteIds)
      await svc.from('sites').delete().in('id', siteIds)
    }
    await pg.end()
  })

  async function freshAccount(locale: 'pt' | 'en' = 'pt'): Promise<string> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    const { data, error } = await svc
      .from('instagram_accounts')
      .insert({ site_id: siteId, locale, handle: 'ops.gate' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('freshAccount: insert failed')
    accountIds.push(data.id as string)
    return data.id as string
  }

  // ── Tabela ────────────────────────────────────────────────────────────────

  it('ops_alert_state has RLS enabled and ZERO policies (service_role only)', async () => {
    const { rows: cls } = await pg.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
        where oid = 'public.ops_alert_state'::regclass`,
    )
    expect(cls[0]?.relrowsecurity).toBe(true)

    const { rows: pol } = await pg.query(
      `select policyname from pg_policies
        where schemaname = 'public' and tablename = 'ops_alert_state'`,
    )
    expect(pol).toEqual([])
  })

  it('denies anon and authenticated every privilege on ops_alert_state', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
        const { rows } = await pg.query<{ ok: boolean }>(
          `select has_table_privilege($1, 'public.ops_alert_state', $2) as ok`,
          [role, priv],
        )
        expect({ role, priv, ok: rows[0]?.ok }).toEqual({ role, priv, ok: false })
      }
    }
  })

  // ── ops_alert_claim ───────────────────────────────────────────────────────

  it('50 concurrent claims on a fresh key produce exactly ONE true', async () => {
    const key = freshKey('concurrency')
    const pool = new Pool({ connectionString: PG_URL, max: 50 })
    try {
      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          pool.query<{ claimed: boolean }>(
            `select public.ops_alert_claim($1, interval '1 day') as claimed`,
            [key],
          ),
        ),
      )
      expect(results).toHaveLength(50)
      expect(results.filter(r => r.rows[0]?.claimed === true)).toHaveLength(1)
      expect(results.filter(r => r.rows[0]?.claimed === false)).toHaveLength(49)
    } finally {
      await pool.end()
    }
  })

  it('claims again after 25h with the default 1 day interval (via PostgREST/service_role)', async () => {
    const key = freshKey('default-interval')
    const first = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)

    const second = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(second.data).toBe(false)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '25 hours' where key = $1`,
      [key],
    )
    const third = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(third.data).toBe(true)
  })

  it("a '23 hours' key fires on a daily cron (24h ago ⇒ true, 22h ago ⇒ false)", async () => {
    const key = freshKey('daily-23h')
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(true)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '24 hours' where key = $1`,
      [key],
    )
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(true)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '22 hours' where key = $1`,
      [key],
    )
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(false)
  })

  it('uses a STRICT `<`: last_at exactly now() - p_min_interval does NOT claim', async () => {
    // Numa única transação now() é congelado, então last_at fica EXATAMENTE em
    // now() - 23h e a comparação estrita é o que decide.
    const key = freshKey('strict')
    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      await c.query('begin')
      await c.query(
        `insert into public.ops_alert_state (key, last_at)
         values ($1, now() - interval '23 hours')
         on conflict (key) do update set last_at = excluded.last_at`,
        [key],
      )
      const res = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '23 hours') as claimed`,
        [key],
      )
      expect(res.rows[0]?.claimed).toBe(false)
      await c.query('rollback')
    } finally {
      await c.end()
    }
  })

  it("interval '0' always claims BETWEEN transactions but never twice INSIDE one", async () => {
    const keyAuto = freshKey('zero-autocommit')
    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      // autocommit: cada statement é sua própria transação ⇒ now() avança
      const a = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyAuto])
      const b = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyAuto])
      expect(a.rows[0]?.claimed).toBe(true)
      expect(b.rows[0]?.claimed).toBe(true)

      // dentro de UMA transação now() é congelado ⇒ o segundo claim é false
      const keyTx = freshKey('zero-in-tx')
      await c.query('begin')
      const c1 = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyTx])
      const c2 = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyTx])
      expect(c1.rows[0]?.claimed).toBe(true)
      expect(c2.rows[0]?.claimed).toBe(false)
      await c.query('commit')
    } finally {
      await c.end()
    }
  })

  it('exposes read and release as plain select/delete for the service client', async () => {
    const key = freshKey('read-release')
    await svc.rpc('ops_alert_claim', { p_key: key })

    const { data: rows, error } = await svc
      .from('ops_alert_state').select('key, last_at').eq('key', key)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows?.[0]?.last_at).toBeTruthy()

    const del = await svc.from('ops_alert_state').delete().eq('key', key)
    expect(del.error).toBeNull()

    const { data: after } = await svc.from('ops_alert_state').select('key').eq('key', key)
    expect(after).toHaveLength(0)

    // liberado ⇒ o próximo claim volta a ser o primeiro do episódio
    expect((await svc.rpc('ops_alert_claim', { p_key: key })).data).toBe(true)
  })

  it('is SECURITY DEFINER with empty search_path and denies EXECUTE to anon/authenticated', async () => {
    const { rows } = await pg.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'ops_alert_claim'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.prosecdef).toBe(true)
    expect(rows[0]?.proconfig ?? []).toContain('search_path=')

    for (const role of ['anon', 'authenticated'] as const) {
      const c = new Client({ connectionString: PG_URL })
      await c.connect()
      try {
        await c.query(`set role ${role}`)
        await expect(
          c.query(`select public.ops_alert_claim($1, interval '1 day')`, [freshKey('denied')]),
        ).rejects.toMatchObject({ code: '42501' })
      } finally {
        await c.end()
      }
    }
  })

  // ── consents / consent_texts ──────────────────────────────────────────────

  it('seeds exactly two consent_texts rows for social_feed_read (pt-BR + en, v1.0)', async () => {
    const { data, error } = await svc
      .from('consent_texts')
      .select('id, locale, version, text_md, superseded_at')
      .eq('category', 'social_feed_read')
      .order('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data?.map(r => r.id)).toEqual(['social_feed_read_v1_en', 'social_feed_read_v1_pt-BR'])
    expect(data?.map(r => r.locale)).toEqual(['en', 'pt-BR'])
    expect(data?.every(r => r.version === '1.0')).toBe(true)
    expect(data?.every(r => r.superseded_at === null)).toBe(true)

    const pt = data?.find(r => r.id === 'social_feed_read_v1_pt-BR')
    expect(pt?.text_md).toContain('Meta Platforms, Inc.')
    expect(pt?.text_md).toContain('cláusulas contratuais-padrão')
    expect(pt?.text_md).toContain('180 dias')
    expect(pt?.text_md).toContain('*Disconnect*')

    const en = data?.find(r => r.id === 'social_feed_read_v1_en')
    expect(en?.text_md).toContain('Meta Platforms, Inc.')
    expect(en?.text_md).toContain('standard contractual clauses')
    expect(en?.text_md).toContain('180 days')
    expect(en?.text_md).toContain('*Disconnect*')
  })

  it('accepts a consents row with category social_feed_read and keeps the older categories', async () => {
    const ok = await svc
      .from('consents')
      .insert({
        anonymous_id: ANON_UUID,
        category: 'social_feed_read',
        consent_text_id: 'social_feed_read_v1_pt-BR',
        granted: true,
      })
      .select('id')
      .single()
    expect(ok.error).toBeNull()
    if (ok.data) consentIds.push(ok.data.id as string)

    // a DDL reescreve a CHECK inteira — este é o ratchet contra perder um valor
    const legacy = await svc
      .from('consents')
      .insert({
        anonymous_id: ANON_UUID,
        category: 'social_integration',
        consent_text_id: 'social_integration_v1_pt-BR',
        granted: true,
      })
      .select('id')
      .single()
    expect(legacy.error).toBeNull()
    if (legacy.data) consentIds.push(legacy.data.id as string)

    const bad = await svc.from('consents').insert({
      anonymous_id: ANON_UUID,
      category: 'instagram_feed',
      consent_text_id: 'social_feed_read_v1_pt-BR',
      granted: true,
    })
    expect(bad.error?.code).toBe('23514')
  })

  // ── instagram_posts: as duas uniques coexistem até C4 ─────────────────────

  it('keeps BOTH unique constraints on instagram_posts after M1 (C4/M2 drops the global one)', async () => {
    const { rows } = await pg.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.instagram_posts'::regclass and contype = 'u'
        order by conname`,
    )
    expect(rows.map(r => r.conname)).toEqual([
      'instagram_posts_account_media_key',
      'instagram_posts_ig_media_id_key',
    ])
  })

  it('the composite key allows a second row on the SAME account only for a new ig_media_id, and the global key still blocks two accounts sharing one ig_media_id (until C4)', async () => {
    const accountA = await freshAccount('pt')
    const accountB = await freshAccount('pt')
    const mediaId = `m-${Date.now()}`
    const base = {
      media_type: 'IMAGE' as const,
      permalink: 'https://instagram.com/p/x',
      ig_timestamp: new Date().toISOString(),
    }

    const first = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: mediaId })
    expect(first.error).toBeNull()

    const sameAccountSameMedia = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: mediaId })
    expect(sameAccountSameMedia.error?.code).toBe('23505')

    const sameAccountNewMedia = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: `${mediaId}-b` })
    expect(sameAccountNewMedia.error).toBeNull()

    // C4 (M2) derruba instagram_posts_ig_media_id_key e ESTA asserção vira `toBeNull()`.
    const crossAccount = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountB, ig_media_id: mediaId })
    expect(crossAccount.error?.code).toBe('23505')
  })
})
```

- [ ] **Step 2: Rodar a suíte e ver falhar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/ops-alert-claim.test.ts --reporter=verbose
```

Esperado: FAIL. `'public.ops_alert_state'::regclass` lança `42P01` (relation does not exist), `ops_alert_claim` devolve `PGRST202`, `consent_texts` volta com 0 linhas e `pg_constraint` traz só `instagram_posts_ig_media_id_key`. `skipped: 0`.

- [ ] **Step 3: Inserir o bloco 2 na migration**

Abra `supabase/migrations/<TS>_instagram_token_health.sql` e insira o SQL abaixo **imediatamente antes** da linha `-- ── Recarga do cache do PostgREST (MUST ser a última linha do arquivo) ──────`.

> **Antes de colar:** se o gate do Step 3 da Task 1 provou que a Meta **revoga** pelo servidor, troque os dois parênteses conforme instruído lá (pt-BR: `(a revogação é feita imediatamente no servidor da Meta)`; en: `(revocation is performed immediately on Meta's server)`). Caso contrário, cole verbatim.

```sql
-- ── 2. Rate limiter de alertas de operação ──────────────────────────────────
-- Claim atômico com janela: RATE LIMITER (comparação ESTRITA), nunca contador
-- de sequência. Variável de módulo em TS é proibida como contador (reseta em
-- todo cold start); a fonte da verdade é esta tabela.

create table if not exists public.ops_alert_state (
  key     text primary key,
  last_at timestamptz not null
);

alter table public.ops_alert_state enable row level security;
-- sem policies: só service_role (rolbypassrls; grant em schema.sql:7464)
revoke all on public.ops_alert_state from anon, authenticated;

create or replace function public.ops_alert_claim(
  p_key text, p_min_interval interval default interval '1 day'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  insert into public.ops_alert_state (key, last_at) values (p_key, now())
    on conflict (key) do update set last_at = now()
    where public.ops_alert_state.last_at < now() - p_min_interval
    returning key into v_key;
  return v_key is not null;
end $$;

revoke all on function public.ops_alert_claim(text, interval) from public, anon, authenticated;
grant execute on function public.ops_alert_claim(text, interval) to service_role;

comment on function public.ops_alert_claim(text, interval) is
  'Rate limiter de alertas: devolve true só quando a chave não foi carimbada dentro de p_min_interval (comparação < estrita). Nunca é contador de sequência. service_role only.';

-- ── 2b. instagram_posts: chave composta que COEXISTE com a global até C4 ────
-- EXPAND: instagram_posts_ig_media_id_key (20260507190000:49-50) permanece; M2
-- (commit C4) a derruba dias depois, após o primeiro ciclo das 13:00 com C2.

alter table public.instagram_posts drop constraint if exists instagram_posts_account_media_key;
alter table public.instagram_posts add constraint instagram_posts_account_media_key
  unique (account_id, ig_media_id);

-- ── 2c. instagram_sync_log: índice das janelas + modos novos ────────────────

create index if not exists idx_instagram_sync_log_account_mode
  on public.instagram_sync_log (account_id, mode, started_at desc);

alter table public.instagram_sync_log drop constraint if exists instagram_sync_log_mode_check;
alter table public.instagram_sync_log add constraint instagram_sync_log_mode_check
  check (mode in ('daily','manual','token_refresh','deauthorize','data_deletion','rebind'));
-- A CHECK de status ('started','completed','failed') de 20260507190000:87-88 FICA
-- — nenhum valor novo de status é gravado por esta entrega.

-- ── 2d. Consentimento social_feed_read (LGPD Art. 7) ────────────────────────
-- CHECK em vigor antes daqui: 20260530000001:5-22 (10 valores).

alter table public.consents drop constraint if exists consents_category_check;
alter table public.consents add constraint consents_category_check check (
  category = any (array['cookie_functional','cookie_analytics','cookie_marketing','newsletter',
    'newsletter_analytics','privacy_policy','terms_of_service','social_integration',
    'notification_email','notification_push','social_feed_read']::text[]));

insert into public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at)
values (
  'social_feed_read_v1_pt-BR', 'social_feed_read', 'pt-BR', '1.0',
  $pt$Autorizo este site a ler os posts públicos, o nome de usuário e as imagens da conta profissional do Instagram que conectei, para exibi-los na página inicial. Os dados são obtidos da Meta Platforms, Inc. (EUA, sob cláusulas contratuais-padrão) e as imagens ficam copiadas na Vercel enquanto a conta estiver conectada. Para revogar, use *Disconnect* nas configurações do CMS (apaga a cópia local do token) e remova o app em Instagram → Configurações → Apps e sites (a Meta não oferece revogação pelo servidor; o token permanece válido lá por até 60 dias). Um pedido de exclusão de dados feito pela Meta apaga tudo imediatamente; o registro do pedido é mantido por 180 dias como prova.$pt$,
  now(), null
), (
  'social_feed_read_v1_en', 'social_feed_read', 'en', '1.0',
  $en$I authorize this site to read the public posts, the username and the images of the Instagram professional account I connected, in order to display them on the home page. The data is obtained from Meta Platforms, Inc. (USA, under standard contractual clauses) and the images are kept copied on Vercel for as long as the account stays connected. To revoke, use *Disconnect* in the CMS settings (this deletes the local copy of the token) and remove the app under Instagram → Settings → Apps and websites (Meta does not offer server-side revocation; the token remains valid there for up to 60 days). A data deletion request made by Meta erases everything immediately; the record of the request is kept for 180 days as proof.$en$,
  now(), null
)
on conflict (category, locale, version) do nothing;   -- formato 20260524000002:23-63
```

- [ ] **Step 4: Aplicar e rodar as duas suítes até passarem**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:reset
cd apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/ops-alert-claim.test.ts test/integration/instagram-token-rpc.test.ts --reporter=verbose
```

Esperado: PASS nos dois arquivos, `skipped: 0`. (A suíte da Task 2 roda junto para provar que o bloco 2 não regrediu o bloco 1.)

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add supabase/migrations/<TS>_instagram_token_health.sql apps/web/test/integration/ops-alert-claim.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): ops_alert_claim, chave composta e consentimento social_feed_read (M1 bloco 2)

ops_alert_state + ops_alert_claim (rate limiter, comparação estrita, service_role
only), instagram_posts_account_media_key coexistindo com a unique global até C4,
idx_instagram_sync_log_account_mode, os 3 modos novos de instagram_sync_log, a
categoria de consentimento social_feed_read e os dois textos (pt-BR + en, v1.0).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 4: M1 bloco 3 — `instagram_deletion_requests`, DML fechado e as `*_staff_write` derrubadas

**Files:**
- Modify: `supabase/migrations/<TS>_instagram_token_health.sql` (inserir o bloco 3 **imediatamente antes** da linha `-- ── Recarga do cache do PostgREST`)
- Modify: `apps/web/test/integration/instagram-accounts-public-view.test.ts` (criado no commit A/A3 — **acrescentar** um `describe` novo no fim; não apagar o bloco de A)

**Interfaces:**
- Consumes: as duas allow-lists de coluna criadas em A3 e estendidas pelo bloco 1 (Task 2); as policies `instagram_posts_public_read` (`20260507190000:111-119`) e `instagram_feed_slots_public_read` (`:139-147`), que **não têm cláusula `TO`** e por isso valem para `PUBLIC` — derrubar as três `*_staff_write` não remove o SELECT de `authenticated` sobre posts/slots.
- Produces (consumido por C3):
  - `public.instagram_deletion_requests (id uuid pk default gen_random_uuid(), confirmation_code text not null unique, ig_user_id text not null, site_id uuid references public.sites(id) on delete set null, requested_at timestamptz not null default now(), completed_at timestamptz)` — RLS ligada, sem policies, `revoke all` de `anon`/`authenticated`. É a tabela que `POST /api/instagram/data-deletion` e `GET /data-deletion?code=…` usam em C3; retenção de 180 dias do registro é o que o texto `social_feed_read` promete.
  - Superfície de escrita fechada: `anon` e `authenticated` sem `INSERT`/`UPDATE`/`DELETE` em `instagram_accounts`, `instagram_posts` e `instagram_feed_slots`; toda escrita passa a ser exclusivamente do service client (todas as actions em `src/app/cms/(authed)/settings/actions.ts` já usam `getSupabaseServiceClient()`).

- [ ] **Step 1: Escrever as asserções que falham**

Acrescente ao **fim** de `apps/web/test/integration/instagram-accounts-public-view.test.ts` (mantendo os imports existentes do arquivo; adicione `Client` de `pg`, `seedSite`, `createClient`, `SUPABASE_URL` e `SERVICE_KEY` ao bloco de imports do topo caso ainda não estejam lá):

```ts
// ─────────────────────────────────────────────────────────────────────────────
// M1 (commit C1) — o que a migration instagram_token_health acrescenta ao
// lockdown de A3. Bloco NOVO: o describe de A3 acima continua valendo.
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoLocalDb())('M1 (C1) — allow-lists, DML fechado e schema novo', () => {
  const svcC1: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const PG_URL_C1 =
    process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  let pgC1: Client
  const siteIdsC1: string[] = []

  /** has_column_privilege é a fonte exata: ele já leva em conta grant de tabela
   *  E grant de coluna, então descreve o privilégio efetivo do papel. */
  async function selectableColumns(role: 'anon' | 'authenticated'): Promise<string[]> {
    const { rows } = await pgC1.query<{ attname: string; allowed: boolean }>(
      `select a.attname,
              has_column_privilege($1, 'public.instagram_accounts', a.attname, 'SELECT') as allowed
         from pg_attribute a
        where a.attrelid = 'public.instagram_accounts'::regclass
          and a.attnum > 0 and not a.attisdropped
        order by a.attname`,
      [role],
    )
    return rows.filter(r => r.allowed).map(r => r.attname)
  }

  async function allColumns(): Promise<string[]> {
    const { rows } = await pgC1.query<{ attname: string }>(
      `select a.attname from pg_attribute a
        where a.attrelid = 'public.instagram_accounts'::regclass
          and a.attnum > 0 and not a.attisdropped
        order by a.attname`,
    )
    return rows.map(r => r.attname)
  }

  beforeAll(async () => {
    pgC1 = new Client({ connectionString: PG_URL_C1 })
    await pgC1.connect()
  })

  afterAll(async () => {
    if (siteIdsC1.length) {
      await svcC1.from('instagram_sync_log').delete().in('site_id', siteIdsC1)
      await svcC1.from('instagram_accounts').delete().in('site_id', siteIdsC1)
      await svcC1.from('sites').delete().in('id', siteIdsC1)
    }
    await pgC1.end()
  })

  // ── Ratchet duplo de column privileges ───────────────────────────────────

  it('ratchet (i): authenticated may SELECT every instagram_accounts column EXCEPT access_token', async () => {
    const all = await allColumns()
    const allowed = await selectableColumns('authenticated')
    const denied = all.filter(c => !allowed.includes(c))
    expect(denied).toEqual(['access_token'])
    // as 9 colunas de M1 têm de estar entre as permitidas — este é o ponto em
    // que um `add column` sem `grant` futuro quebra a suíte.
    for (const col of [
      'token_refreshed_at', 'token_error', 'token_error_at', 'token_error_mode',
      'token_alert_sent_at', 'token_alert_attempt_at', 'token_reprobe_at',
      'ig_professional_id', 'ig_user_id_source',
    ]) {
      expect(allowed).toContain(col)
    }
  })

  it('ratchet (ii): anon may SELECT EXACTLY {id, site_id} — no M1 column reopens it', async () => {
    expect(await selectableColumns('anon')).toEqual(['id', 'site_id'])
  })

  // ── DML fechado ───────────────────────────────────────────────────────────

  it('anon and authenticated have no INSERT/UPDATE/DELETE on the three instagram tables', async () => {
    for (const table of [
      'public.instagram_accounts',
      'public.instagram_posts',
      'public.instagram_feed_slots',
    ]) {
      for (const role of ['anon', 'authenticated'] as const) {
        for (const priv of ['INSERT', 'UPDATE', 'DELETE'] as const) {
          const { rows } = await pgC1.query<{ ok: boolean }>(
            `select has_table_privilege($1, $2, $3) as ok`,
            [role, table, priv],
          )
          expect({ table, role, priv, ok: rows[0]?.ok }).toEqual({ table, role, priv, ok: false })
        }
      }
    }
  })

  it('drops the three *_staff_write policies and keeps the read ones', async () => {
    const { rows } = await pgC1.query<{ policyname: string }>(
      `select policyname from pg_policies
        where schemaname = 'public'
          and tablename in ('instagram_accounts','instagram_posts','instagram_feed_slots')
        order by policyname`,
    )
    expect(rows.map(r => r.policyname)).toEqual([
      'instagram_accounts_staff_read',
      'instagram_feed_slots_public_read',
      'instagram_posts_public_read',
    ])
  })

  // ── instagram_deletion_requests ───────────────────────────────────────────

  it('creates instagram_deletion_requests with RLS on, zero policies and no anon/authenticated access', async () => {
    const { rows: cls } = await pgC1.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where oid = 'public.instagram_deletion_requests'::regclass`,
    )
    expect(cls[0]?.relrowsecurity).toBe(true)

    const { rows: pol } = await pgC1.query(
      `select policyname from pg_policies
        where schemaname = 'public' and tablename = 'instagram_deletion_requests'`,
    )
    expect(pol).toEqual([])

    for (const role of ['anon', 'authenticated'] as const) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
        const { rows } = await pgC1.query<{ ok: boolean }>(
          `select has_table_privilege($1, 'public.instagram_deletion_requests', $2) as ok`,
          [role, priv],
        )
        expect({ role, priv, ok: rows[0]?.ok }).toEqual({ role, priv, ok: false })
      }
    }
  })

  it('enforces a UNIQUE confirmation_code and nulls site_id when the site goes away', async () => {
    const { siteId } = await seedSite(svcC1)
    siteIdsC1.push(siteId)
    const code = `code-${Date.now()}`

    const first = await svcC1.from('instagram_deletion_requests')
      .insert({ confirmation_code: code, ig_user_id: '17841400000000000', site_id: siteId })
      .select('id, requested_at, completed_at')
      .single()
    expect(first.error).toBeNull()
    expect(first.data?.requested_at).toBeTruthy()
    expect(first.data?.completed_at).toBeNull()

    const dup = await svcC1.from('instagram_deletion_requests')
      .insert({ confirmation_code: code, ig_user_id: '17841400000000001', site_id: siteId })
    expect(dup.error?.code).toBe('23505')

    await svcC1.from('sites').delete().eq('id', siteId)
    const { data: after } = await svcC1.from('instagram_deletion_requests')
      .select('site_id').eq('confirmation_code', code).single()
    expect(after?.site_id).toBeNull()   // on delete set null: o registro sobrevive 180 dias

    await svcC1.from('instagram_deletion_requests').delete().eq('confirmation_code', code)
    siteIdsC1.splice(siteIdsC1.indexOf(siteId), 1)
  })

  // ── instagram_sync_log ────────────────────────────────────────────────────

  it('accepts the six sync modes, rejects an unknown one and leaves the status CHECK untouched', async () => {
    const { siteId } = await seedSite(svcC1)
    siteIdsC1.push(siteId)

    for (const mode of [
      'daily', 'manual', 'token_refresh', 'deauthorize', 'data_deletion', 'rebind',
    ]) {
      const res = await svcC1.from('instagram_sync_log')
        .insert({ site_id: siteId, mode, status: 'started' })
      expect({ mode, code: res.error?.code ?? null }).toEqual({ mode, code: null })
    }

    const badMode = await svcC1.from('instagram_sync_log')
      .insert({ site_id: siteId, mode: 'oauth', status: 'started' })
    expect(badMode.error?.code).toBe('23514')

    const badStatus = await svcC1.from('instagram_sync_log')
      .insert({ site_id: siteId, mode: 'daily', status: 'token_invalid' })
    expect(badStatus.error?.code).toBe('23514')
  })

  it('creates idx_instagram_sync_log_account_mode over (account_id, mode, started_at desc)', async () => {
    const { rows } = await pgC1.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'idx_instagram_sync_log_account_mode'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('(account_id, mode, started_at DESC)')
  })
})
```

- [ ] **Step 2: Rodar o arquivo e ver falhar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-accounts-public-view.test.ts --reporter=verbose
```

Esperado: o `describe` novo FALHA (`'public.instagram_deletion_requests'::regclass` ⇒ `42P01`; as três `*_staff_write` ainda listadas; `has_table_privilege(…, 'INSERT')` ⇒ `true`).

**O ratchet de A3 JÁ ESTÁ na forma normativa — não o reescreva.** Quando o plano C1 foi escrito,
supunha-se que A3 fixaria `AUTHENTICATED_ALLOW_LIST` com 16 nomes literais comparados por `toEqual`
sobre `information_schema.column_privileges`. **Isso não foi o que A3 entregou.** O commit A3
(`7d5e2a64`, `apps/web/test/integration/instagram-accounts-public-view.test.ts`) já assere a REGRA,
via `has_column_privilege(...)` coluna a coluna: "toda coluna **exceto** `access_token`" para
`authenticated` e "exatamente `{id, site_id}`" para `anon`. Não existe constante
`AUTHENTICATED_ALLOW_LIST` no arquivo.

Consequências, verificadas pelo revisor de A3 contra o banco local:

- **Não apague nada** e **não reescreva** o ratchet: o `grant select (<as 9 colunas novas>)` do bloco 1
  mantém a regra verdadeira sozinho, porque as 9 entram para `authenticated` e nenhuma entra para `anon`.
- **Não acrescente um ratchet duplicado** neste commit. Se você escrever um segundo `it` com lista
  literal, reintroduz exatamente a fragilidade que A3 evitou de propósito — e ela quebra sozinha no
  próximo commit que adicionar coluna.
- O que C1 DEVE acrescentar ao arquivo é só o que é novo em M1: a existência de
  `public.instagram_deletion_requests`, a ausência das três policies `*_staff_write`, e
  `has_table_privilege(..., 'INSERT') = false` para `anon`/`authenticated` nas três tabelas.

Rode o arquivo depois do bloco 1 e confirme que os dois `it` de privilégio **continuam verdes** sem edição:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-accounts-public-view.test.ts --reporter=verbose
```

Esperado: os `it` de privilégio de A3 passam sem mudança; o `describe` novo de C1 falha enquanto o
bloco 3 não existir (`'public.instagram_deletion_requests'::regclass` ⇒ `42P01`).

- [ ] **Step 3: Inserir o bloco 3 na migration**

Insira **imediatamente antes** da linha `-- ── Recarga do cache do PostgREST (MUST ser a última linha do arquivo) ──────`:

```sql
-- ── 3. Registro de pedidos de exclusão vindos da Meta ───────────────────────
-- O registro do pedido é mantido por 180 dias como prova (texto social_feed_read).
-- site_id ON DELETE SET NULL: o registro sobrevive à remoção do site.

create table if not exists public.instagram_deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  ig_user_id        text not null,
  site_id           uuid references public.sites(id) on delete set null,
  requested_at      timestamptz not null default now(),
  completed_at      timestamptz
);

alter table public.instagram_deletion_requests enable row level security;
revoke all on public.instagram_deletion_requests from anon, authenticated;

-- ── 3b. Escrita exclusivamente por service client ───────────────────────────
-- Desde A3 anon e authenticated estão em allow-list de COLUNAS para SELECT
-- (anon = exatamente {id, site_id}, o que o EXISTS das policies *_public_read
-- dereferencia; authenticated = tudo menos access_token). Aqui some o DML.
-- Todas as actions de escrita já usam getSupabaseServiceClient()
-- (src/app/cms/(authed)/settings/actions.ts).

revoke insert, update, delete
  on public.instagram_accounts, public.instagram_posts, public.instagram_feed_slots
  from anon, authenticated;

-- Seguro: as duas policies *_public_read (20260507190000:111-119 e :139-147) não
-- têm cláusula TO ⇒ valem para PUBLIC, então derrubar as três *_staff_write não
-- remove o SELECT de authenticated sobre posts/slots.
drop policy if exists instagram_accounts_staff_write   on public.instagram_accounts;
drop policy if exists instagram_posts_staff_write      on public.instagram_posts;
drop policy if exists instagram_feed_slots_staff_write on public.instagram_feed_slots;

-- View: security_invoker + revoke + allow-list de colunas já foram feitos em A3
-- (migration instagram_public_view_lockdown). NÃO se repetem aqui — mas MUST ser
-- repetidos em qualquer recriação futura por DROP VIEW, porque o
-- ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon/authenticated de
-- 20260507000001_schema.sql:7460,7462 re-concede tudo à view recriada.
```

- [ ] **Step 4: Aplicar e rodar os três arquivos até passarem**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:reset
cd apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/ --reporter=verbose
```

Esperado: a pasta inteira verde, `skipped: 0` para `instagram-token-rpc`, `ops-alert-claim` e `instagram-accounts-public-view`. Rodar a pasta toda (e não só os três arquivos) é o que prova que o `revoke insert/update/delete` e a queda das `*_staff_write` não quebraram nenhuma outra suíte DB-gated.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add supabase/migrations/<TS>_instagram_token_health.sql apps/web/test/integration/instagram-accounts-public-view.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): instagram_deletion_requests + DML fechado para anon/authenticated (M1 bloco 3)

Fecha INSERT/UPDATE/DELETE de anon e authenticated nas três tabelas do feed
(toda escrita já era por service client) e derruba as três policies
*_staff_write. As duas *_public_read não têm cláusula TO e continuam valendo.
Ratchet duplo de column privileges estendido para as 9 colunas de M1.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 5: `db:types` + `types.ts`

**Files:**
- Modify: `apps/web/src/types/database.types.ts` (regenerado por `npm run db:types` — **nunca** editar à mão)
- Modify: `apps/web/src/lib/instagram/types.ts`
- Modify: `apps/web/test/integration/instagram-token-rpc.test.ts` (uma asserção nova que amarra schema ↔ tipo)

**Interfaces:**
- Consumes: as 9 colunas e as duas RPCs entregues pelas Tasks 2–4.
- Produces (consumido por C2 e C3):
  - `InstagramAccountRow` += `token_refreshed_at?: string | null`, `token_error?: string | null`, `token_error_at?: string | null`, `token_error_mode?: 'daily' | 'token_refresh' | null`, `token_alert_sent_at?: string | null`, `token_alert_attempt_at?: string | null`, `token_reprobe_at?: string | null`, `ig_professional_id?: string | null`, `ig_user_id_source?: 'oauth' | 'legacy'`. **Todas opcionais em C1** para que os literais de `InstagramAccountRow` já existentes em `test/instagram/{sync,cron-route,token-refresh}.test.ts` continuem compilando um commit antes de qualquer escritor. **C2 remove o `?` de `ig_user_id_source`.**
  - `InstagramAccountPublic = Omit<InstagramAccountRow, 'access_token' | <as 9>>` — 16 colunas, idênticas às da view `instagram_accounts_public` (`20260507220000:41-49`).
  - `InstagramSyncMode = 'daily' | 'manual' | 'token_refresh' | 'deauthorize' | 'data_deletion' | 'rebind'`.
  - `SyncResult` **não muda em C1** — `partial: boolean` e `mediaFailed: number` já entraram no commit A.

- [ ] **Step 1: Escrever a asserção que amarra schema ↔ tipo (falha)**

Acrescente ao fim do `describe` de `apps/web/test/integration/instagram-token-rpc.test.ts` (dentro dele, antes do `})` final) e adicione o import de tipo no topo do arquivo:

```ts
// topo do arquivo, junto dos outros imports:
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'
```

```ts
  it('every M1 column is readable through the InstagramAccountRow shape C2 will consume', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    await pg.query(
      `update public.instagram_accounts
          set token_refreshed_at = now(), token_reprobe_at = now(),
              ig_professional_id = '17841400000000000', ig_user_id_source = 'oauth'
        where id = $1`,
      [accountId],
    )

    const { data, error } = await svc
      .from('instagram_accounts').select('*').eq('id', accountId).single()
    expect(error).toBeNull()

    const row = data as unknown as InstagramAccountRow
    expect(row.token_error).toBe('expired')
    expect(row.token_error_at).not.toBeNull()
    expect(row.token_refreshed_at).not.toBeNull()
    expect(row.token_reprobe_at).not.toBeNull()
    expect(row.token_alert_sent_at).toBeNull()
    expect(row.token_alert_attempt_at).toBeNull()
    expect(row.token_error_mode).toBeNull()
    expect(row.ig_professional_id).toBe('17841400000000000')
    expect(row.ig_user_id_source).toBe('oauth')

    // InstagramSyncMode ganhou os três modos que M1 acrescentou à CHECK.
    const modes: InstagramSyncMode[] = [
      'daily', 'manual', 'token_refresh', 'deauthorize', 'data_deletion', 'rebind',
    ]
    expect(modes).toHaveLength(6)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-token-rpc.test.ts --reporter=verbose
npm run typecheck --workspace=apps/web
```

Esperado: o novo `it` falha (as propriedades vêm `undefined` no shape antigo — `expect(row.token_error).toBe('expired')` recebe `undefined`) e, se o editor/tsc alcançasse o arquivo, `Property 'token_error' does not exist on type 'InstagramAccountRow'`. **Nota:** `tsconfig.json` exclui `**/*.test.ts`, então `npm run typecheck` **não** cobre arquivos de teste — quem trava esta task é a asserção em runtime acima somada ao typecheck de `src/`.

- [ ] **Step 3: Regenerar os tipos gerados**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:types
grep -c 'token_error_mode' apps/web/src/types/database.types.ts
grep -E 'instagram_mark_token_invalid|ops_alert_claim' apps/web/src/types/database.types.ts | head
grep -n 'instagram_deletion_requests\|ops_alert_state' apps/web/src/types/database.types.ts | head
```

Esperado: `token_error_mode` aparece (Row/Insert/Update de `instagram_accounts`); as duas funções aparecem no bloco `Functions`; as duas tabelas novas aparecem em `Tables`.

- [ ] **Step 4: Editar `src/lib/instagram/types.ts`**

Em `apps/web/src/lib/instagram/types.ts`, substitua o fim de `InstagramAccountRow`, `InstagramAccountPublic` e `InstagramSyncMode` por:

```ts
export interface InstagramAccountRow {
  id: string
  site_id: string
  locale: 'pt' | 'en' | 'all'
  handle: string
  ig_user_id: string | null
  access_token: string | null
  token_expires_at: string | null
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  section_title_pt: string | null
  section_title_en: string | null
  section_subtitle_pt: string | null
  section_subtitle_en: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
  // ── M1 (commit C1): saúde do token ──────────────────────────────────────
  // No schema as 9 são nullable, exceto ig_user_id_source (not null default
  // 'legacy'). No tipo entram OPCIONAIS em C1 para que os literais de
  // InstagramAccountRow já existentes em test/instagram/{sync,cron-route,
  // token-refresh}.test.ts continuem compilando um commit antes de qualquer
  // código que as escreva. C2, que passa a escrevê-las, remove o `?` de
  // ig_user_id_source.
  token_refreshed_at?: string | null
  token_error?: string | null
  token_error_at?: string | null
  token_error_mode?: 'daily' | 'token_refresh' | null
  token_alert_sent_at?: string | null
  token_alert_attempt_at?: string | null
  token_reprobe_at?: string | null
  ig_professional_id?: string | null
  ig_user_id_source?: 'oauth' | 'legacy'
}
```

```ts
/** As 16 colunas da view public.instagram_accounts_public (20260507220000:41-49).
 *  Nem access_token nem nenhuma das 9 colunas de saúde do token saem daqui. */
export type InstagramAccountPublic = Omit<
  InstagramAccountRow,
  | 'access_token'
  | 'token_refreshed_at'
  | 'token_error'
  | 'token_error_at'
  | 'token_error_mode'
  | 'token_alert_sent_at'
  | 'token_alert_attempt_at'
  | 'token_reprobe_at'
  | 'ig_professional_id'
  | 'ig_user_id_source'
>
```

```ts
/** Espelha instagram_sync_log_mode_check depois de M1 (6 valores). */
export type InstagramSyncMode =
  | 'daily'
  | 'manual'
  | 'token_refresh'
  | 'deauthorize'
  | 'data_deletion'
  | 'rebind'
```

`SyncResult` **não é tocado** nesta task — `partial: boolean` e `mediaFailed: number` já entraram no commit A.

- [ ] **Step 5: Rodar tudo até passar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run build:packages
npm run typecheck --workspace=apps/web
cd apps/web
npx vitest run test/instagram/ test/api/cron/instagram-sync.test.ts test/api/cron/instagram-token-refresh.test.ts --reporter=verbose
HAS_LOCAL_DB=1 npx vitest run test/integration/ --reporter=verbose
```

Esperado: typecheck limpo; as suítes de `test/instagram/` e dos dois crons verdes (os literais de `InstagramAccountRow` continuam válidos porque as 9 colunas são opcionais); a pasta `test/integration/` verde com `skipped: 0` nos três arquivos DB-gated.

- [ ] **Step 6: Suíte completa antes do push**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run
```

Esperado: verde. A suíte inteira custa ~160 s (medido 2026-09-03: 1078 arquivos, 13.780 testes) — é barata e vale mais que qualquer recorte antes de um push que muda `types.ts`.

- [ ] **Step 7: Commit e push**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/types/database.types.ts apps/web/src/lib/instagram/types.ts apps/web/test/integration/instagram-token-rpc.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): db:types + InstagramAccountRow com as 9 colunas de M1

As 9 entram opcionais em C1 para que os literais de InstagramAccountRow já
existentes nos testes continuem compilando um commit antes de qualquer escritor;
C2 remove o `?` de ig_user_id_source. InstagramAccountPublic volta a ser
exatamente as 16 colunas da view. InstagramSyncMode += deauthorize, data_deletion,
rebind. SyncResult inalterado (mudou em A).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
git push origin staging
```

Aguarde a CI de `staging` ficar verde — em especial o job **Integration (DB-gated)**. Confirme no log (`--reporter=verbose`) que `instagram-token-rpc`, `ops-alert-claim` e `instagram-accounts-public-view` aparecem com testes **passados e `skipped: 0`**. Suíte pulada com exit 0 **não** cumpre o gate.

---

### Task 6: Promoção e `db:push:prod` (§7 passo 2)

**Files:**
- Nenhum arquivo do repositório é modificado. Esta task promove `staging → main` e aplica M1 em produção.

**Interfaces:**
- Consumes: os quatro commits das Tasks 2–5 em `staging`, CI verde.
- Produces: M1 aplicada em produção — pré-requisito **bloqueante** de C2 (§7 "Gates antes de C2" checa exatamente as três coisas do Step 4 abaixo antes de promover C2).

- [ ] **Step 1: Promover `staging → main`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git checkout main
git pull origin main
git merge --ff-only staging
git push origin main
git checkout staging
```

Aguarde o build da Vercel em produção ficar verde. C1 não muda comportamento de runtime (nenhum código escreve as colunas novas), então o build é a única prova necessária aqui.

- [ ] **Step 2: Aplicar a migration em produção**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:which           # MUST mostrar novkqtvcnsiwhkxihurk
npx supabase@2.98.2 migration list
npm run db:push:prod       # exige confirmação YES
```

Esperado: `migration list` mostra `<TS>_instagram_token_health` como pendente antes e aplicada depois. O `notify pgrst, 'reload schema'` no fim do arquivo recarrega o cache do PostgREST em prod.

- [ ] **Step 3: Verificação de §7 passo 2 — colunas (9) e grants, RPCs, as duas constraints, `consent_texts` = 2, as duas CHECKs de `instagram_sync_log`**

Cole no SQL editor de **produção**:

```sql
-- (a) as 9 colunas
select column_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'instagram_accounts'
   and column_name in ('token_refreshed_at','token_error','token_error_at','token_error_mode',
                       'token_alert_sent_at','token_alert_attempt_at','token_reprobe_at',
                       'ig_professional_id','ig_user_id_source')
 order by column_name;
-- ESPERADO: 9 linhas; ig_user_id_source is_nullable=NO e default 'legacy'::text; as outras 8 YES/null.

-- (b) grants: authenticated lê tudo menos access_token; anon lê exatamente {id, site_id}
select a.attname,
       has_column_privilege('authenticated','public.instagram_accounts',a.attname,'SELECT') as auth_ok,
       has_column_privilege('anon','public.instagram_accounts',a.attname,'SELECT')          as anon_ok
  from pg_attribute a
 where a.attrelid = 'public.instagram_accounts'::regclass and a.attnum > 0 and not a.attisdropped
 order by a.attname;
-- ESPERADO: auth_ok=false SÓ em access_token; anon_ok=true SÓ em id e site_id.

-- (c) as duas RPCs
select p.proname, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('instagram_mark_token_invalid','ops_alert_claim')
 order by p.proname;
-- ESPERADO: 2 linhas, prosecdef=true, proconfig={search_path=} nas duas.

select public.ops_alert_claim('gate:c1', interval '0');   -- ESPERADO: true
delete from public.ops_alert_state where key = 'gate:c1';

-- (d) as duas UNIQUE de instagram_posts coexistindo (C4/M2 derruba a global)
select conname from pg_constraint
 where conrelid = 'public.instagram_posts'::regclass and contype = 'u' order by conname;
-- ESPERADO: instagram_posts_account_media_key, instagram_posts_ig_media_id_key

-- (e) consent_texts social_feed_read = 2
select id, locale, version from public.consent_texts
 where category = 'social_feed_read' order by id;
-- ESPERADO: social_feed_read_v1_en (en, 1.0) e social_feed_read_v1_pt-BR (pt-BR, 1.0)

-- (f) as duas CHECKs de instagram_sync_log
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.instagram_sync_log'::regclass and contype = 'c' order by conname;
-- ESPERADO: instagram_sync_log_mode_check com os 6 modos (daily, manual, token_refresh,
--           deauthorize, data_deletion, rebind) e instagram_sync_log_status_check
--           inalterada com started/completed/failed.

-- (g) DML fechado + policies de escrita derrubadas
select policyname from pg_policies
 where schemaname = 'public'
   and tablename in ('instagram_accounts','instagram_posts','instagram_feed_slots')
 order by policyname;
-- ESPERADO: instagram_accounts_staff_read, instagram_feed_slots_public_read, instagram_posts_public_read

-- (h) handles minusculizados (irreversível)
select id, handle from public.instagram_accounts where handle <> lower(handle);
-- ESPERADO: 0 linhas
```

- [ ] **Step 4: Deixar os três `select` bloqueantes de C2 já verdes**

Ainda em produção — são exatamente os que §7 "Gates antes de C2" repete antes de promover C2:

```sql
select 1 from information_schema.columns
 where table_name = 'instagram_accounts' and column_name = 'token_error_mode';   -- ESPERADO: 1 linha
select public.ops_alert_claim('gate:c2', interval '0');                          -- ESPERADO: true
select 1 from pg_proc where proname = 'instagram_mark_token_invalid';            -- ESPERADO: 1 linha
delete from public.ops_alert_state where key = 'gate:c2';
```

- [ ] **Step 5: Smoke do feed público (nenhuma regressão de leitura)**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/
curl -sS https://bythiagofigueiredo.com/api/health | head -c 400
```

Esperado: `200` na home (o feed do Instagram continua renderizando — as leituras públicas passam pela view por service client, imunes aos revokes) e agregado `ok`. Se a home cair, o suspeito é a queda das `*_staff_write` combinada com alguma leitura por client autenticado: as duas `*_public_read` não têm cláusula `TO` e valem para `PUBLIC`, então o caminho de leitura não deveria ter mudado — investigue antes de qualquer rollback.

- [ ] **Step 6: Registrar a conclusão**

C1 está entregue. **Rollback:** nada a reverter — expand puro; colunas, RPCs, revokes e tabelas ficam mesmo num `git revert` do código (§0). O único passo irreversível é `handle = lower(handle)`, inócuo.

Próximo commit da entrega: **C2 — `feat(instagram): renovação observável (backend)`**, que depende de A e de C1 e cujos gates bloqueantes começam pelos três `select` do Step 4.
