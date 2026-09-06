# A4 — `fix(middleware): strip trusted headers`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task, **in the order below**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nenhum header de confiança sobrevive à borda. O middleware apaga os **8** headers nomeados da cópia de request antes de escrever os seus, e `GET /go` deixa de montar o destino do redirect a partir de `x-short-domain` — o **open redirect vivo** de §1(d) (`x-short-domain: go.evil.com` ⇒ `https://evil.com`) fecha.

**Architecture:** Segundo dos oito commits sequenciais em `staging` (ordem **A → A4 → A5 → B → C1 → C2 → C4 → C3**). A4 não depende de A e é revertível por `git revert` puro (blast radius = site inteiro, por isso vai sozinho). Três arquivos: `apps/web/src/middleware.ts` (um `for` de `delete` + uma const de módulo), `apps/web/src/app/go/route.ts` (destino vem do site resolvido) e o teste novo `apps/web/test/middleware/forged-site-headers.test.ts`. **Um único commit** ao final da Task 3.

**Tech Stack:** Next.js 16.3.4 (middleware Edge, `NextResponse.next({ request: { headers } })`), TypeScript 5 strict, Vitest (projeto `dom` cobre `test/**`; este arquivo opta por `// @vitest-environment node` via pragma).

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **A4**, §1(c)/(d), §4 "Middleware (A4)", §6 "Commit A/A3/A4", §7 (promoção).

**Global Constraints:** valem as do índice — `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`, seção *Global Constraints*. Não repetir aqui; ler antes de começar.

**Commit-specific constraints (verbatim do spec):**

- "`requestHeaders.delete()` dos **8** headers — `x-site-id`, `x-org-id`, `x-default-locale`, `x-site-timezone`, `x-locale` (escritos em `src/middleware.ts:367,463-466,506-510`), **`x-primary-domain`** (lido em `lib/cms/site-context.ts:36`, nunca escrito; monta `siteOrigin` em `cms/(authed)/page.tsx:94`, `analytics/page.tsx:117`) e **`x-short-domain`** (lido em **`src/app/go/route.ts:4`** e **`src/app/go/linktree/layout.tsx:14,25`**; o ramo `go.*` o escreve só na **resposta**, `:248,273,284,299`) e **`content-security-policy`** (o Next lê esse header **do request** para decidir se e com qual nonce marca os próprios scripts inline; `src/middleware.ts:174` só o sobrescreve quando `getCspMode() !== 'legacy'` — `src/lib/security/csp.ts:52-56`, e `legacy` é o **default** —, então no modo atual um valor forjado pelo cliente sobrevive à cópia de `:168` e chega ao framework) — **após `:168` e antes do `:169`**, portanto antes do `set` condicional de `:174`."
- "A tese de A4 é 'nenhum header de confiança sobrevive à borda'; este é lido pelo framework, está desguarnecido no modo padrão e custa uma linha. Fecha o **open redirect vivo** de §1(d)."
- "+ `test/middleware/forged-site-headers.test.ts` (8 nomes, incl. `content-security-policy` **com `CSP_NONCE_ENABLED` ausente** (modo `legacy`, onde não há `set` para mascarar); caminhos `skipSiteResolution` `:309-315` e host desconhecido `:440-450`; **`GET /go` com `x-short-domain: go.evil.com` ⇒ `Location: https://bythiagofigueiredo.com`**; `test/middleware/go-subdomain.test.ts:62` continua verde)."
- §4: "Middleware (A4): 8 headers nomeados (incl. `content-security-policy`, que o Next lê do request e que o middleware só sobrescreve fora do modo `legacy`); open redirect de `/go` fechado."
- §7: "**A4** → CI → promoção → headers, `/go`." / "`/go` com header forjado ⇒ apex".

**Fora de escopo (declarado, não é dívida nova):** `src/app/go/linktree/layout.tsx:14,25` lê `x-short-domain` de `headers()`, mas o ramo `go.*` só o escreve na **resposta** (`:248,273,284,299`) — nunca em `ctx.requestHeaders` —, logo o layout já cai hoje no fallback `'go.bythiagofigueiredo.com'`. A4 apaga o valor **forjado** e não muda esse comportamento; escrever `x-short-domain` no request é mudança de produto, não de segurança, e não entra aqui.

---

### Task 1: teste vermelho — os 8 headers forjados no caminho `skipSiteResolution` e no host desconhecido

**Files:**
- Cria: `apps/web/test/middleware/forged-site-headers.test.ts`

**Interfaces:**
- `middleware(request: NextRequest): Promise<NextResponse>` — export nomeado **e** default de `apps/web/src/middleware.ts`.
- Contrato do Next lido pelo teste (`node_modules/next/dist/server/web/spec-extension/response.js`, `handleMiddlewareField`): `NextResponse.next({ request: { headers } })` / `.rewrite(url, { request: { headers } })` emitem `x-middleware-override-headers: <lista de chaves separada por vírgula>` e um `x-middleware-request-<chave>: <valor>` por chave. **Um header apagado de `requestHeaders` não aparece na lista e portanto não chega ao route handler / server component.** É essa lista que o teste inspeciona.

**Steps:**

- [ ] Criar `apps/web/test/middleware/forged-site-headers.test.ts` com exatamente este conteúdo:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * A4 — "nenhum header de confiança sobrevive à borda".
 *
 * Os 8 nomes abaixo são tratados como confiáveis por algum consumidor:
 *   - x-site-id / x-org-id / x-default-locale / x-site-timezone / x-locale
 *     são escritos pelo próprio middleware (src/middleware.ts:367,463-466,
 *     506-510) e lidos por lib/cms/site-context.ts;
 *   - x-primary-domain é lido em lib/cms/site-context.ts:36 e nunca escrito;
 *   - x-short-domain é lido em src/app/go/route.ts e
 *     src/app/go/linktree/layout.tsx e só é escrito na *resposta* do ramo go.*;
 *   - content-security-policy é lido pelo PRÓPRIO Next a partir do request
 *     para decidir com que nonce marcar os scripts inline, e o middleware só o
 *     sobrescreve fora do modo `legacy` (src/lib/security/csp.ts:52-56) — que
 *     é o default. Este arquivo roda deliberadamente em modo `legacy`, onde
 *     não existe `set` para mascarar a falha.
 *
 * O teste lê a lista `x-middleware-override-headers` que o Next emite quando o
 * middleware cria a resposta com `{ request: { headers } }`: essa lista É o
 * conjunto de headers que o route handler / server component vai enxergar.
 */

const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TRUSTED_HEADERS = [
  'x-site-id',
  'x-org-id',
  'x-default-locale',
  'x-site-timezone',
  'x-locale',
  'x-primary-domain',
  'x-short-domain',
  'content-security-policy',
] as const

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  },
}))

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_client: unknown) {}
    getSiteByDomain(domain: string) {
      if (domain === 'bythiagofigueiredo.com') {
        return Promise.resolve({
          id: 'site-1',
          org_id: 'org-1',
          default_locale: 'pt-BR',
          domains: ['bythiagofigueiredo.com'],
          supported_locales: ['pt-BR', 'en'],
          name: 'ByThiagoFigueiredo',
          slug: 'bythiagofigueiredo',
          created_at: '',
          updated_at: '',
          cms_enabled: true,
        })
      }
      return Promise.resolve(null)
    }
  },
}))

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
  // Modo `legacy` explícito: é nele que o `set` condicional de
  // src/middleware.ts:174 NÃO acontece e um CSP forjado chegaria ao framework.
  vi.stubEnv('CSP_NONCE_ENABLED', '')
  vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

/** Requisição com os 8 headers forjados, cada um com um valor reconhecível. */
function forgedRequest(path: string, host: string): NextRequest {
  const headers = new Headers({ host })
  for (const name of TRUSTED_HEADERS) headers.set(name, `forged-${name}`)
  return new NextRequest(new URL(`https://${host}${path}`), { headers })
}

/** Headers que o Next vai entregar a jusante, extraídos da resposta. */
function forwardedRequestHeaders(res: Response): Map<string, string> {
  const list = res.headers.get('x-middleware-override-headers') ?? ''
  const out = new Map<string, string>()
  for (const key of list.split(',').map((k) => k.trim()).filter(Boolean)) {
    out.set(key.toLowerCase(), res.headers.get(`x-middleware-request-${key}`) ?? '')
  }
  return out
}

describe('middleware: forged trusted headers are stripped at the edge', () => {
  it('drops all 8 on the skipSiteResolution path (/api/cron/*)', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(
      forgedRequest('/api/cron/instagram-sync', 'bythiagofigueiredo.com'),
    )
    const forwarded = forwardedRequestHeaders(res)
    // Sanidade: a lista existe e o middleware realmente escreveu nela.
    expect(forwarded.get('x-nonce')).toBeTruthy()
    for (const name of TRUSTED_HEADERS) {
      expect(forwarded.has(name), `${name} must not reach the route handler`).toBe(false)
    }
  })

  it('drops all 8 on the unknown-host path, keeping only the locale it writes itself', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/blog', 'unknown.test'))
    const forwarded = forwardedRequestHeaders(res)
    // /blog não está em skipLocale, então o middleware escreve x-locale ele
    // mesmo (src/middleware.ts:367) — o valor tem de ser o dele, não o forjado.
    expect(forwarded.get('x-locale')).toBe('en')
    for (const name of TRUSTED_HEADERS) {
      if (name === 'x-locale') continue
      expect(forwarded.has(name), `${name} must not survive an unknown host`).toBe(false)
    }
  })

  it('replaces the forged values with the resolved ones on a known host', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/blog', 'bythiagofigueiredo.com'))
    const forwarded = forwardedRequestHeaders(res)
    expect(forwarded.get('x-site-id')).toBe('site-1')
    expect(forwarded.get('x-org-id')).toBe('org-1')
    expect(forwarded.get('x-default-locale')).toBe('pt-BR')
    expect(forwarded.get('x-site-timezone')).toBe('America/Sao_Paulo')
    expect(forwarded.get('x-locale')).toBe('en')
    expect(forwarded.has('x-primary-domain')).toBe(false)
    expect(forwarded.has('x-short-domain')).toBe(false)
    expect(forwarded.has('content-security-policy')).toBe(false)
  })

  it('keeps the go.* branch writing the real x-short-domain on the response', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/abc', 'go.bythiagofigueiredo.com'))
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go/abc')
    expect(res.headers.get('x-short-domain')).toBe('go.bythiagofigueiredo.com')
    expect(forwardedRequestHeaders(res).has('x-short-domain')).toBe(false)
  })
})
```

- [ ] Rodar `cd apps/web && npx vitest run test/middleware/forged-site-headers.test.ts`
- [ ] **Falha esperada (RED):** os 4 casos falham com `expected true to be false` — os 8 nomes forjados aparecem em `x-middleware-override-headers` porque `new Headers(request.headers)` (`src/middleware.ts:168`) copia tudo. Detalhe por caso: (1) os 8 sobrevivem; (2) os 7 além de `x-locale` sobrevivem — `x-locale` já passa hoje, porque `/blog` não está em `skipLocale` e `:367` sobrescreve o valor forjado (é exatamente por isso que o caminho `skipSiteResolution` do caso 1 é o que expõe o buraco de `x-locale`); (3) `x-primary-domain`, `x-short-domain` e `content-security-policy` sobrevivem (os cinco escritos por `resolveSite` já passam); (4) a última asserção falha — o `x-short-domain` forjado atravessa o ramo `go.*`.

### Task 2: implementação — `requestHeaders.delete()` dos 8 headers

**Files:**
- Edita: `apps/web/src/middleware.ts`

**Interfaces:**
- `const STRIPPED_REQUEST_HEADERS: readonly string[]` — const de módulo, não exportada (nada mais precisa dela; exportar convidaria consumidores a duplicar a lista).

**Steps:**

- [ ] Em `apps/web/src/middleware.ts`, inserir a const **logo depois** do bloco `getSiteByDomainCached` (isto é, entre o fecho dessa função em `:134` e o comentário de `RequestContext` em `:136`):

```ts
/**
 * BTF/A4 — headers que o app trata como escritos pela borda e que, por isso,
 * MUST NOT chegar do cliente:
 *   - `x-site-id`, `x-org-id`, `x-default-locale`, `x-site-timezone`,
 *     `x-locale`: escritos por este middleware (resolveSite / mergeSiteHeaders
 *     / detecção de locale) e lidos por `lib/cms/site-context.ts`;
 *   - `x-primary-domain`: lido em `lib/cms/site-context.ts` e NUNCA escrito —
 *     um valor forjado passaria direto a `siteOrigin`;
 *   - `x-short-domain`: lido em `src/app/go/route.ts` e
 *     `src/app/go/linktree/layout.tsx`; o ramo `go.*` só o escreve na
 *     *resposta*, então tudo que aparece no request veio do cliente;
 *   - `content-security-policy`: o próprio Next lê ESTE header do request para
 *     decidir se (e com qual nonce) marca seus scripts inline. O `set` de
 *     `buildCsp` abaixo só acontece fora do modo `legacy` — que é o default
 *     (`src/lib/security/csp.ts`) —, logo no modo atual um valor do cliente
 *     chegaria ao framework intacto.
 *
 * A deleção acontece na cópia recém-criada, ANTES de qualquer `set` do
 * middleware, para que nenhum caminho (incluindo os que dão short-circuit
 * antes da resolução de site) fique de fora.
 */
const STRIPPED_REQUEST_HEADERS = [
  'x-site-id',
  'x-org-id',
  'x-default-locale',
  'x-site-timezone',
  'x-locale',
  'x-primary-domain',
  'x-short-domain',
  'content-security-policy',
] as const
```

- [ ] Substituir, dentro de `export async function middleware`, o trecho

```ts
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
```

por

```ts
  const requestHeaders = new Headers(request.headers)
  // A4: nenhum header de confiança sobrevive à borda. Vem antes do `set` de
  // `x-nonce` e do `set` condicional de `content-security-policy` abaixo.
  for (const name of STRIPPED_REQUEST_HEADERS) requestHeaders.delete(name)
  requestHeaders.set('x-nonce', nonce)
```

- [ ] Rodar `cd apps/web && npx vitest run test/middleware/forged-site-headers.test.ts`
- [ ] **Esperado (GREEN):** 4 testes passando.
- [ ] Rodar a regressão dos vizinhos: `cd apps/web && npx vitest run test/middleware/ test/middleware-csp.test.ts`
- [ ] **Esperado:** todos verdes — em especial `test/middleware/go-subdomain.test.ts` (as 4 asserções de resposta continuam valendo: o strip só toca a cópia de request) e `test/middleware-csp.test.ts` (os requests que ele monta não trazem CSP de entrada, então `x-middleware-request-content-security-policy` continua sendo só o do `buildCsp`).

### Task 3: teste vermelho + fix do open redirect em `GET /go`, e o commit

**Files:**
- Edita: `apps/web/test/middleware/forged-site-headers.test.ts`
- Edita: `apps/web/src/app/go/route.ts`

**Interfaces:**
- `GET(): Promise<Response>` — a rota deixa de receber `request` (não lê mais header nenhum diretamente).
- `tryGetSiteContext(): Promise<SiteContext | null>` de `@/lib/cms/site-context` (→ `apps/web/lib/cms/site-context.ts`; alias já mapeado em `tsconfig.json` e em `vitest.config.ts`). Devolve `null` quando o middleware não resolveu site. `SiteContext.primaryDomain?: string` vem de `x-primary-domain ?? host` — com A4 o primeiro está apagado, então na prática é o `host` validado pela plataforma, nunca um header escolhido pelo atacante.

**Steps:**

- [ ] No topo de `apps/web/test/middleware/forged-site-headers.test.ts`, logo abaixo do `import { NextRequest } from 'next/server'`, acrescentar o mock de `next/headers`:

```ts
const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }))
vi.mock('next/headers', () => ({ headers: () => headersMock() }))
```

- [ ] Acrescentar, ao final do mesmo arquivo, o bloco:

```ts
describe('GET /go: the redirect destination never comes from a request header', () => {
  it('ignores a forged x-short-domain and lands on the resolved site', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: 'bythiagofigueiredo.com',
        'x-site-id': 'site-1',
        'x-org-id': 'org-1',
        'x-default-locale': 'pt-BR',
        // Forjado: hoje `src/app/go/route.ts:4` o lê e redireciona a evil.com.
        'x-short-domain': 'go.evil.com',
      }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })

  it('falls back to the canonical host when no site was resolved', async () => {
    headersMock.mockResolvedValue(
      new Headers({ host: 'evil.com', 'x-short-domain': 'go.evil.com' }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })

  it('falls back to the canonical host on a local dev host', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: 'dev.localhost:3001',
        'x-site-id': 'site-1',
        'x-org-id': 'org-1',
      }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })
})
```

- [ ] Rodar `cd apps/web && npx vitest run test/middleware/forged-site-headers.test.ts`
- [ ] **Falha esperada (RED):** os **três** casos novos falham com `TypeError: Cannot read properties of undefined (reading 'headers')` — a assinatura atual é `GET(request: Request)` e os testes chamam `GET()`, que é a assinatura de destino (a rota não lê mais header nenhum por conta própria). O open redirect em si é observável na versão atual por `node -e` ou pelo `curl` do passo 1 da Task 4 antes da promoção; o RED aqui é de assinatura, não de destino.
- [ ] Substituir **todo** o conteúdo de `apps/web/src/app/go/route.ts` por:

```ts
import { NextResponse } from 'next/server'
import { tryGetSiteContext } from '@/lib/cms/site-context'

/**
 * Destino de último recurso: usado quando o middleware não resolveu site
 * (host desconhecido, erro de resolução) ou quando o host resolvido não é um
 * domínio público (dev/local). Constante — nunca derivado de header.
 */
const CANONICAL_HOST = 'bythiagofigueiredo.com'

/** `localhost`, `dev.localhost`, `127.0.0.1` e afins não são destino público. */
function isPublicDomain(domain: string | undefined): domain is string {
  if (!domain) return false
  if (domain === '127.0.0.1') return false
  if (domain === 'localhost' || domain.endsWith('.localhost')) return false
  return domain.includes('.')
}

/**
 * `/go` no domínio principal devolve o visitante à home do site.
 *
 * A4 — o destino vem do site que o middleware resolveu (`getSiteContext`),
 * nunca de `x-short-domain`: esse header só é escrito na *resposta* do ramo
 * `go.*` (`src/middleware.ts`), então qualquer valor legível aqui veio do
 * cliente. A versão anterior o usava para montar o `NextResponse.redirect` e
 * `x-short-domain: go.evil.com` redirecionava para `https://evil.com`.
 */
export async function GET(): Promise<Response> {
  const site = await tryGetSiteContext()
  const domain =
    site && isPublicDomain(site.primaryDomain) ? site.primaryDomain : CANONICAL_HOST
  return NextResponse.redirect(`https://${domain}`, 302)
}
```

- [ ] Rodar `cd apps/web && npx vitest run test/middleware/forged-site-headers.test.ts`
- [ ] **Esperado (GREEN):** 7 testes passando.
- [ ] Rodar `cd apps/web && npm run typecheck`
- [ ] **Esperado:** sem saída de erro, exit 0. (Se `isPublicDomain(site?.primaryDomain) ? site.primaryDomain : …` reclamar de `site` possivelmente `null`, o type guard já garante `domain is string` mas não estreita `site`: trocar por `const domain = site && isPublicDomain(site.primaryDomain) ? site.primaryDomain : CANONICAL_HOST`.)
- [ ] Rodar a suíte inteira: `cd apps/web && npx vitest run`
- [ ] **Esperado:** verde (~160 s; a suíte não trava — medido em 2026-09-03). Nenhum arquivo além do novo deve mudar de resultado.
- [ ] Commit:

```bash
git add apps/web/src/middleware.ts apps/web/src/app/go/route.ts apps/web/test/middleware/forged-site-headers.test.ts
git commit -m "fix(middleware): strip trusted headers"
```

- [ ] `git push` (staging). Aguardar CI verde antes de promover `staging → main`.

### Task 4: checks pós-promoção (§7 — "A4 → CI → promoção → headers, `/go`")

**Files:** nenhum (verificação em produção, depois da promoção `staging → main`).

**Interfaces:** superfície pública de `https://bythiagofigueiredo.com` e `https://go.bythiagofigueiredo.com`.

**Steps:**

- [ ] **1. `/go` com header forjado ⇒ apex** (o check nomeado em §7):

```bash
curl -sI -H 'x-short-domain: go.evil.com' https://bythiagofigueiredo.com/go | grep -i '^location:'
```

Saída esperada:

```
location: https://bythiagofigueiredo.com/
```

(Antes de A4 esta linha era `location: https://evil.com/`. A barra final é o serializador de URL do Next — `String(new URL(...))` em `validateURL`, `next/dist/server/web/utils.js:127` —, não uma divergência do spec.)

- [ ] **2. `x-site-id` forjado não vira o site servido:**

```bash
curl -sI -H 'x-site-id: 00000000-0000-0000-0000-000000000000' -H 'x-org-id: forged' -H 'x-default-locale: xx' -H 'x-site-timezone: UTC' https://bythiagofigueiredo.com/ | grep -iE '^(x-site-id|x-org-id|x-default-locale|x-site-timezone):'
```

Saída esperada: os quatro headers com os valores **reais** do site (UUID real em `x-site-id`, UUID real em `x-org-id`, `x-default-locale: pt-BR`, `x-site-timezone: America/Sao_Paulo`) — nenhum deles ecoando `forged`/`00000000-…`/`xx`/`UTC`.

- [ ] **3. `x-short-domain` e `x-primary-domain` forjados não são refletidos no apex:**

```bash
curl -sI -H 'x-short-domain: go.evil.com' -H 'x-primary-domain: evil.com' https://bythiagofigueiredo.com/ | grep -icE '^(x-short-domain|x-primary-domain):'
```

Saída esperada:

```
0
```

- [ ] **4. `content-security-policy` forjado não faz o Next marcar scripts (modo `legacy`)** — único check de corpo, não de header:

```bash
curl -s -H "content-security-policy: script-src 'nonce-attacker'" https://bythiagofigueiredo.com/ | grep -c 'nonce='
```

Saída esperada:

```
0
```

(Se `getCspMode()` já estiver em `enforced` em produção — registrado no gate pré-A —, este comando devolve um número **> 0** e o check muda: o nonce presente no HTML MUST casar o do header de resposta, e MUST NOT ser `attacker`. Conferir com `curl -sI https://bythiagofigueiredo.com/ | grep -i '^content-security-policy:'` e comparar o token `nonce-…`.)

- [ ] **5. Header de resposta do CSP é o do middleware, não o do cliente:**

```bash
curl -sI -H "content-security-policy: default-src *" https://bythiagofigueiredo.com/ | grep -i '^content-security-policy:'
```

Saída esperada: uma única linha começando em `content-security-policy: default-src 'self';` (a política legada montada por `buildLegacyCsp`), **nunca** `default-src *`.

- [ ] **6. Regressão do subdomínio `go.*`** (o ramo que escreve `x-short-domain` na resposta continua vivo):

```bash
curl -sI https://go.bythiagofigueiredo.com/ | grep -iE '^(HTTP/|x-short-domain:|x-site-id:)'
```

Saída esperada: `HTTP/2 200`, `x-short-domain: go.bythiagofigueiredo.com` e um `x-site-id` com o UUID real do site.

- [ ] Registrar as seis saídas no runbook de promoção antes de seguir para **A5**.
