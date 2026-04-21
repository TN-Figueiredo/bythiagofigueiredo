---
name: Sprint 5c — E2E Suite Design
description: Spec completo da suite Playwright E2E cobrindo auth, CMS, Admin e public paths do projeto bythiagofigueiredo
type: project
---

# Sprint 5c — E2E Suite (Playwright)

**Data:** 2026-04-19  
**Scope:** auth + CMS + Admin + public paths  
**Total de testes:** 62 em 13 spec files  
**Runtime alvo:** ≤ 8 min em CI

---

## 1. Visão Geral e Objetivos

### Objetivo

Suite E2E de referência cobrindo auth + CMS + Admin + public paths. Não duplica coverage de Vitest — que já cobre RLS, RPCs e RBAC no DB via testes de integração com `HAS_LOCAL_DB=1`. O foco aqui é exclusivamente em fluxos de usuário reais via browser: o que um humano faria, o que um browser executa, o que um servidor responde.

### Escopo

~62 testes distribuídos em 13 spec files. Cobertura: happy paths + edge cases de auth + CRUD completo de CMS + Admin total + public paths + LGPD cookie banner.

### Stack

| Dependência | Versão | Papel |
|---|---|---|
| `@playwright/test` | `^1.44` | runner principal, fixtures, expects |
| `@axe-core/playwright` | `^4.9` | accessibility gate em 3 páginas críticas |
| Browsers | Chromium only | CI. Firefox/WebKit: dívida técnica consciente, Sprint 6+ |
| Visual regression | — | explicitamente **out of scope** Sprint 5c — manutenção alta, flaky em ambientes diferentes |

Instalado em `apps/web` como `devDependency`. Não afeta o bundle de produção.

### Localização

```
apps/web/e2e/              # raiz da suite E2E
apps/web/playwright.config.ts
```

### Estrutura de diretórios

```
apps/web/e2e/
├── fixtures/
│   ├── global-setup.ts       # seed master site/org, clear Inbucket, verificar Supabase
│   ├── global-teardown.ts    # cleanup de dados de teste
│   ├── auth.setup.ts         # gera 4x storageState por role
│   ├── index.ts              # extended test() com fixtures injetados
│   └── assets/
│       ├── test.pdf          # <100 KB, committed no repo
│       └── test-image.jpg    # <50 KB, committed no repo
├── pages/                    # Page Object Models
│   ├── LoginPage.ts
│   ├── CmsShellPage.ts
│   ├── BlogEditorPage.ts
│   ├── CampaignEditorPage.ts
│   ├── AdminShellPage.ts
│   └── PublicPage.ts
└── tests/
    ├── auth/
    │   ├── admin-login.spec.ts
    │   ├── cms-login.spec.ts
    │   └── invite-acceptance.spec.ts
    ├── cms/
    │   ├── blog.spec.ts
    │   ├── campaigns.spec.ts
    │   └── contacts.spec.ts
    ├── admin/
    │   ├── users.spec.ts
    │   ├── audit.spec.ts
    │   └── sites.spec.ts
    ├── public/
    │   ├── homepage.spec.ts
    │   ├── newsletter.spec.ts
    │   └── contact-form.spec.ts
    └── lgpd/
        └── cookie-banner.spec.ts
```

### Page Object Model — padrão

Cada POM encapsula seletores e ações. Testes nunca referenciam seletores diretamente — isso mantém specs legíveis e isoladas de mudanças de markup.

Exemplo canônico:

```ts
// apps/web/e2e/pages/BlogEditorPage.ts
import { type Page, expect } from '@playwright/test'

export class BlogEditorPage {
  constructor(private readonly page: Page) {}

  async fillTitle(title: string) {
    await this.page.getByLabel('Título').fill(title)
  }

  async fillContent(mdx: string) {
    await this.page.getByRole('textbox', { name: 'Conteúdo' }).fill(mdx)
  }

  async saveDraft() {
    await this.page.getByRole('button', { name: 'Salvar rascunho' }).click()
    await expect(this.page.getByText('Rascunho salvo')).toBeVisible()
  }

  async publish() {
    await this.page.getByRole('button', { name: 'Publicar' }).click()
    await expect(this.page.getByText('Publicado')).toBeVisible()
  }

  async unpublish() {
    await this.page.getByRole('button', { name: 'Despublicar' }).click()
    await expect(this.page.getByText('Rascunho')).toBeVisible()
  }

  async schedule(isoDate: string) {
    await this.page.getByRole('button', { name: 'Agendar' }).click()
    await this.page.getByLabel('Data de publicação').fill(isoDate)
    await this.page.getByRole('button', { name: 'Confirmar agendamento' }).click()
    await expect(this.page.getByText('Agendado')).toBeVisible()
  }

  async archive() {
    await this.page.getByRole('button', { name: 'Arquivar' }).click()
    await expect(this.page.getByText('Arquivado')).toBeVisible()
  }

  async delete() {
    await this.page.getByRole('button', { name: 'Excluir' }).click()
    await this.page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  }

  async switchLocale(locale: 'pt-BR' | 'en') {
    await this.page.getByRole('tab', { name: locale }).click()
  }

  async expectPublishBlocked() {
    await expect(this.page.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  }
}
```

### POM — interfaces completas

```ts
// LoginPage
login(email: string, password: string): Promise<void>
expectError(message: string): Promise<void>
clickForgotPassword(): Promise<void>
expectGoogleButtonVisible(): Promise<void>

// CmsShellPage
navigateToBlog(): Promise<void>
navigateToCampaigns(): Promise<void>
navigateToContacts(): Promise<void>
logout(): Promise<void>

// BlogEditorPage
fillTitle(title: string): Promise<void>
fillContent(mdx: string): Promise<void>
saveDraft(): Promise<void>
publish(): Promise<void>
unpublish(): Promise<void>
schedule(isoDate: string): Promise<void>
archive(): Promise<void>
delete(): Promise<void>
switchLocale(locale: 'pt-BR' | 'en'): Promise<void>
expectPublishBlocked(): Promise<void>

// CampaignEditorPage
fillTitle(title: string): Promise<void>
uploadPdf(filePath: string): Promise<void>
publish(): Promise<void>
unpublish(): Promise<void>
delete(): Promise<void>
expectPublishBlocked(): Promise<void>

// AdminShellPage
navigateToUsers(): Promise<void>
navigateToAudit(): Promise<void>
navigateToSites(): Promise<void>
inviteUser(email: string, role: string, siteId?: string): Promise<void>
revokeInvite(email: string): Promise<void>

// PublicPage
subscribeNewsletter(email: string): Promise<void>
submitContactForm(data: { name: string; email: string; message: string }): Promise<void>
expectCookieBannerVisible(): Promise<void>
acceptCookies(): Promise<void>
rejectCookies(): Promise<void>
```

---

## 2. Ambiente de Teste e Infraestrutura

### `playwright.config.ts`

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['github'],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/fixtures/auth.setup.ts',
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: '**/fixtures/global-teardown.ts',
    },
    {
      name: 'no-db',
      testMatch: '**/tests/public/homepage.spec.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: '**/tests/public/homepage.spec.ts',
    },
  ],
  globalSetup: './e2e/fixtures/global-setup.ts',
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      HAS_LOCAL_DB: '1',
      NODE_ENV: 'test',
    }, // propagado para o processo Next.js
  },
})
```

### Variáveis de ambiente — `.env.test`

`.env.test` é **gitignored**. `.env.test.example` é committed com todas as chaves documentadas.

```env
# URL base (variável nativa do Playwright — não renomear)
PLAYWRIGHT_BASE_URL=http://localhost:3001

# Supabase local (supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local default publicado pelo supabase start>
HAS_LOCAL_DB=1

# Turnstile — Cloudflare test keys (sempre passam, nunca bloqueiam)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Inbucket — servidor de email local do Supabase
INBUCKET_URL=http://127.0.0.1:54324

# Senhas dos usuários de teste (criados em global-setup.ts)
E2E_ADMIN_PASSWORD=E2e@Admin2026!
E2E_EDITOR_PASSWORD=E2e@Editor2026!
E2E_REPORTER_PASSWORD=E2e@Reporter2026!

# Feature flags ativos durante a suite
NEXT_PUBLIC_LGPD_BANNER_ENABLED=true
NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED=true
NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED=true
```

### Paralelismo e isolamento de dados

- **Workers:** CI=2, local=4.
- **Serial por arquivo:** specs DB-dependentes usam `test.describe.configure({ mode: 'serial' })` para evitar race conditions entre steps dentro do mesmo fluxo (ex: criar → editar → publicar → deletar).
- **UUID-scoped data:** cada `describe` gera um slug único para seus dados de teste:

```ts
import { randomUUID } from 'node:crypto'

test.describe('blog CRUD', () => {
  const slug = `test-blog-${randomUUID().slice(0, 8)}`
  // todos os posts criados neste describe usam esse slug como prefixo
})
```

Dois workers criando dados simultaneamente nunca colidem porque cada describe opera em seu próprio namespace de dados.

### `storageState` por role

`auth.setup.ts` executa uma única vez antes de toda a suite (projeto `setup` do Playwright). Cria 4 arquivos de estado autenticado:

```
apps/web/e2e/.auth/
├── admin.json       # super_admin autenticado
├── editor.json      # editor autenticado no site de teste
├── reporter.json    # reporter autenticado
└── public.json      # sem autenticação (objeto vazio)
```

`.auth/` está no `.gitignore`. Login real ocorre **uma vez por role por run** — os 62 testes não re-logam individualmente, o que mantém a suite dentro do budget de 8 min.

**Role switching para testes de boundary negativo dentro de um mesmo spec:**

```ts
test.describe('editor — happy path', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })

  test('editor consegue publicar post', async ({ page }) => {
    // ...
  })
})

test.describe('reporter — permission boundary', () => {
  test.use({ storageState: 'e2e/.auth/reporter.json' })

  test('reporter não consegue publicar post', async ({ page }) => {
    const editor = new BlogEditorPage(page)
    await editor.expectPublishBlocked()
  })
})
```

### Email via Inbucket

Supabase local expõe Inbucket em `http://127.0.0.1:54324`. Usado nos fluxos de confirmação de newsletter e invite acceptance:

```ts
// Extrair link de confirmação da inbox
const res = await fetch(`${process.env.INBUCKET_URL}/api/v1/mailbox/e2e-newsletter`)
const messages: Array<{ body: string }> = await res.json()
const confirmUrl = extractConfirmLink(messages[0].body)
await page.goto(confirmUrl)
```

`global-setup.ts` executa `DELETE /api/v1/mailbox/e2e-newsletter` antes da suite para garantir inbox limpa entre runs.

### Fixture `acceptedCookies`

O cookie banner bloqueia interação em páginas públicas caso o `localStorage` não contenha consentimento. A fixture injeta o estado de consentimento antes da navegação:

```ts
// apps/web/e2e/fixtures/index.ts
import { test as base } from '@playwright/test'

export const test = base.extend<{ acceptedCookies: void }>({
  acceptedCookies: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lgpd_consent',
        JSON.stringify({
          functional: true,
          analytics: true,
          marketing: true,
          version: '2.0',
        }),
      )
    })
    await use()
  },
})
```

**Regra de uso:** todos os testes em `tests/public/` e `tests/cms/` **devem** importar `test` de `e2e/fixtures/index.ts` e declarar `{ acceptedCookies }` na assinatura, exceto `tests/lgpd/cookie-banner.spec.ts`, que usa `page` puro (sem consentimento pré-injetado) para poder testar a exibição e interação com o banner.

### Scripts npm

```jsonc
// apps/web/package.json
{
  "scripts": {
    "test:e2e":        "playwright test",
    "test:e2e:ui":     "playwright test --ui",
    "test:e2e:debug":  "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

```jsonc
// package.json (raiz do monorepo)
{
  "scripts": {
    "test:e2e": "npm run test:e2e -w apps/web"
  }
}
```

### Budget de runtime

Suite completa: **≤ 8 min em CI** (2 workers, Chromium only).

- Testes `no-db` (`homepage.spec.ts`) rodam sem dependência do projeto `setup` — iniciam imediatamente, terminam antes dos demais.
- Retries em CI (`retries: 2`) cobrem flakiness de rede local; não mascaram falhas determinísticas.
- `reuseExistingServer: true` em desenvolvimento local elimina o custo de cold start do Next.js em runs sucessivos.

## 3. Estratégia de Dados

### Ciclo de vida dos dados

```
globalSetup
  └── seed: master org + master site + 4 usuários de teste
      └── auth.setup.ts: autentica cada role → salva storageState
          └── spec beforeAll: cria dados isolados (UUID-scoped)
              └── testes rodam
          └── spec afterAll: deleta dados criados nesse describe
globalTeardown
  └── deleta os 4 usuários de teste + conteúdo test-%
```

Sem `beforeEach` de DB — muito lento para 62 testes. Dados criados uma vez por `describe` block.

### Usuários de teste

| Role | Email | Usado em |
|------|-------|---------|
| `super_admin` | `e2e-admin@test.local` | `admin.json`, todos os specs de admin |
| `editor` | `e2e-editor@test.local` | `editor.json`, specs de CMS |
| `reporter` | `e2e-reporter@test.local` | `reporter.json`, paths negativos de publish |
| invite target | `e2e-invite@test.local` | `invite-acceptance.spec.ts` |

Todos criados via `supabase.auth.admin.createUser()` no `global-setup` — nunca via UI.

### Sequência do `global-setup.ts`

```ts
export default async function globalSetup(config: FullConfig) {
  // 1. Carregar .env.test
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

  // 2. Verificar Supabase está pronto
  await waitForSupabase(process.env.SUPABASE_URL!)

  // 3. Limpar Inbucket
  await fetch(`${process.env.INBUCKET_URL}/api/v1/mailbox/e2e-newsletter`, { method: 'DELETE' })

  // 4. Seed master org + site (idempotent)
  await seedSite()

  // 5. Criar usuários de teste (upsert — idempotente)
  await createTestUsers()
  // auth.setup.ts roda após globalSetup (via project 'setup')
}
```

### Senhas dos usuários de teste

```ts
export const E2E_PASSWORDS = {
  admin:    process.env.E2E_ADMIN_PASSWORD    ?? 'E2e@Admin2026!',
  editor:   process.env.E2E_EDITOR_PASSWORD   ?? 'E2e@Editor2026!',
  reporter: process.env.E2E_REPORTER_PASSWORD ?? 'E2e@Reporter2026!',
}
```

Defaults locais, overrideable via CI secrets. Documentados em `.env.test.example`.

### Reuso dos helpers existentes

`db-seed.ts` já tem `seedSite()`, `seedStaffUser()`, `seedCampaign()`. O `global-setup.ts` importa diretamente:

```ts
import { seedSite, seedStaffUser } from '../test/helpers/db-seed'
```

Sem duplicação de lógica — E2E reutiliza a mesma infraestrutura dos integration tests.

### Dados UUID-scoped por worker

```ts
export const test = base.extend<{ testId: string }>({
  testId: async ({}, use) => {
    await use(randomUUID().slice(0, 8))
  },
})
// uso:
const slug = `test-blog-${testId}` // nunca colide entre workers
```

### Assets de teste (committed no repo)

```
apps/web/e2e/fixtures/assets/
├── test.pdf        # PDF mínimo válido, <100KB
└── test-image.jpg  # JPEG 400x400, <50KB
```

Usados em: `campaigns.spec.ts` (PDF upload via `page.setInputFiles()`), `blog.spec.ts` (cover image).

### `global-teardown.ts` — cleanup completo

```ts
export default async function globalTeardown() {
  const client = getSupabaseServiceClient()

  // Conteúdo criado por testes (slug prefixed com "test-")
  await client.from('blog_posts').delete().like('slug', 'test-%')
  await client.from('campaigns').delete().like('slug', 'test-%')

  // Usuários de teste
  const { data } = await client.auth.admin.listUsers()
  for (const u of data.users.filter(u => u.email?.endsWith('@test.local'))) {
    await client.auth.admin.deleteUser(u.id)
  }
}
```

Usa service role para deletar **por pattern** — garante limpeza mesmo se `afterAll` não rodou por crash.

---

## 4. Cobertura de Auth (14 testes)

### `admin-login.spec.ts` (4 testes) — `storageState: public`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Login válido com email/senha | Redireciona para `/admin`, dashboard visível |
| 2 | Senha incorreta | Mensagem de erro inline, permanece em `/admin/login` |
| 3 | Logout | Redireciona para `/admin/login`, cookie limpo — nova tentativa de acesso a `/admin` redireciona de volta |
| 4 | Forgot password flow | Formulário aceita email, exibe confirmação de envio |

### `cms-login.spec.ts` (4 testes) — `storageState: public`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Login válido | Redireciona para `/cms`, shell CMS visível |
| 2 | Senha incorreta | Mensagem de erro, permanece em `/cms/login` |
| 3 | Redirect pós-login com `?next=` | Acesso a `/cms/blog` sem auth → login → volta para `/cms/blog` |
| 4 | Logout | Cookie limpo, acesso a `/cms` redireciona para `/cms/login` |

### `invite-acceptance.spec.ts` (6 testes) — mix de states

| # | Cenário | Role | Assertion |
|---|---------|------|-----------|
| 1 | Novo usuário aceita convite com senha | `public` | Cria conta, aceita, redireciona para `/cms/login` |
| 2 | Usuário existente aceita convite | `editor` | `accept_invitation_atomic` chamado, redireciona para `/cms` |
| 3 | Token expirado | `public` | Exibe erro `?error=expired` |
| 4 | Token já usado | `public` | Exibe erro `?error=already_used` |
| 5 | Email do convite ≠ usuário logado | `editor` | Exibe erro `?error=email_mismatch` |
| 6 | Cross-domain redirect | `public` | Intercepta redirect via `page.waitForRequest`, valida URL de destino |

Nota sobre `test.slow()`: todos os testes do `invite-acceptance.spec.ts` usam `test.slow()` no nível do `describe` — email flows são lentos por natureza, o que triplica o timeout default.

### Paths negativos de acesso (distribuídos em outros specs, listados aqui para referência)

| Cenário | Spec destino | Assertion |
|---------|-------------|-----------|
| Reporter tenta acessar `/admin` | `users.spec.ts` | Redirect para `/cms/login` |
| Unauthenticated tenta `/cms/blog` | `cms-login.spec.ts` (teste #3) | Redirect com `?next=` |
| `cms_enabled=false` no site | `sites.spec.ts` | Rewrite para `/cms/disabled` |
| Host desconhecido | `homepage.spec.ts` | Rewrite para `/site-not-configured` |

### Google OAuth — decisão explícita

Botão aparece na UI mas não é testado em E2E. Cada spec de login inclui uma assertion de que o botão está visível (garante UI não quebrou), mas não clica. Comentário obrigatório no código:

```ts
// Google OAuth não é testado em E2E — fluxo externo não-determinístico.
// Cobertura via unit test de /auth/callback route.
test('botão Google OAuth está visível', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
})
```

## 5. Cobertura CMS (22 testes)

Todos os specs desta seção usam `storageState: editor` por padrão. Testes de caminho negativo usam `test.describe` aninhado com `test.use({ storageState: 'e2e/.auth/reporter.json' })`.

### `blog.spec.ts` (10 testes)

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Lista de posts carrega | Tabela visível, coluna status presente |
| 2 | Criar draft | Formulário salvo, post aparece na lista com status `draft` |
| 3 | Editar draft | Alterações persistidas após reload |
| 4 | Publicar post | Status muda para `published`, URL pública acessível |
| 5 | Despublicar | Status volta para `draft`, URL pública retorna 404 |
| 6 | Agendar publicação | Status `scheduled`, campo `published_at` no futuro visível |
| 7 | Arquivar | Status `archived`, post some da lista pública |
| 8 | Deletar | Post removido da lista após confirmação |
| 9 | Reporter não consegue publicar | `storageState: reporter` — botão "Publicar" ausente ou desabilitado |
| 10 | Locale switching | Criar tradução `en` de um post `pt-BR`, ambas visíveis no editor |

Cleanup: `afterAll` deleta posts com slug prefixado `test-%` via service role client.

```ts
// blog.spec.ts — estrutura geral
import { test, expect } from '../fixtures'

test.describe('CMS / Blog', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })

  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin
      .from('blog_posts')
      .delete()
      .like('slug', 'test-%')
  })

  test('lista de posts carrega', async ({ page }) => {
    await page.goto('/cms/blog')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('status')).toBeVisible()
  })

  test('criar draft', async ({ page }) => {
    await page.goto('/cms/blog/new')
    await page.getByLabel('Título').fill('Test Post Draft')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('draft')).toBeVisible()
  })

  test('publicar post', async ({ page, supabaseAdmin }) => {
    // seed de post draft
    const { data: post } = await supabaseAdmin
      .from('blog_posts')
      .insert({ slug: 'test-publish', status: 'draft', site_id: SITE_ID })
      .select('id')
      .single()

    await page.goto(`/cms/blog/${post!.id}/edit`)
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('published')).toBeVisible()

    // URL pública acessível
    const publicPage = await page.context().newPage()
    await publicPage.goto(`/blog/pt-BR/test-publish`)
    await expect(publicPage).not.toHaveURL(/404/)
  })

  test.describe('reporter — restrições de publicação', () => {
    test.use({ storageState: 'e2e/.auth/reporter.json' })

    test('reporter não consegue publicar', async ({ page, supabaseAdmin }) => {
      const { data: post } = await supabaseAdmin
        .from('blog_posts')
        .insert({ slug: 'test-reporter-pub', status: 'draft', site_id: SITE_ID })
        .select('id')
        .single()

      await page.goto(`/cms/blog/${post!.id}/edit`)
      const publishBtn = page.getByRole('button', { name: 'Publicar' })
      // ausente OU desabilitado — qualquer um é válido
      const visible = await publishBtn.isVisible()
      if (visible) {
        await expect(publishBtn).toBeDisabled()
      }
    })
  })
})
```

### `campaigns.spec.ts` (8 testes)

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Lista de campanhas carrega | Tabela visível com colunas nome/status |
| 2 | Criar campanha | Salva com status `draft`, aparece na lista |
| 3 | Editar campanha | Alterações persistidas após reload |
| 4 | Upload de PDF | `page.setInputFiles('input[type=file]', 'e2e/fixtures/assets/test.pdf')`, URL do PDF visível após save |
| 5 | Publicar campanha | Status `published`, landing page acessível |
| 6 | Despublicar | Status volta para `draft` |
| 7 | Deletar | Removida da lista após confirmação |
| 8 | Reporter não consegue publicar | `storageState: reporter` — botão ausente/desabilitado |

```ts
// campaigns.spec.ts — trecho do teste de upload de PDF
test('upload de PDF', async ({ page }) => {
  await page.goto('/cms/campaigns/new')
  await page.getByLabel('Título').fill('Test Campaign PDF')
  await page.setInputFiles('input[type=file]', 'e2e/fixtures/assets/test.pdf')
  await page.getByRole('button', { name: 'Salvar' }).click()
  // URL do PDF deve aparecer após upload bem-sucedido
  await expect(page.getByTestId('pdf-url')).toContainText('https://')
})
```

O fixture `e2e/fixtures/assets/test.pdf` deve ser commitado no repositório — arquivo PDF válido mínimo (1 página, sem conteúdo sensível). Cleanup: `afterAll` deleta campanhas com slug `test-%` e respectivos blobs do Storage via `supabaseAdmin.storage.from('campaigns').remove([...])`.

### `contacts.spec.ts` (4 testes) — `storageState: editor`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Lista de submissões carrega | Tabela visível com colunas nome/email/data |
| 2 | Ver detalhe de submissão | Conteúdo da mensagem visível |
| 3 | Anonimizar submissão (LGPD) | Campos name/email substituídos por hash, `anonymized_at` visível |
| 4 | Responder submissão | Formulário de reply aceita texto e confirma envio |

Pré-condição: `beforeAll` insere uma submissão de contato diretamente no DB via service role para garantir estado previsível.

```ts
// contacts.spec.ts — seed + teste de anonimização
test.beforeAll(async ({ supabaseAdmin }) => {
  await supabaseAdmin.from('contact_submissions').insert({
    site_id: SITE_ID,
    name: 'Test Contact',
    email: 'contact@test.example',
    message: 'Mensagem de teste E2E',
  })
})

test('anonimizar submissão (LGPD)', async ({ page, supabaseAdmin }) => {
  await page.goto('/cms/contacts')
  await page.getByText('contact@test.example').click()
  await page.getByRole('button', { name: 'Anonimizar' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  // campos PII substituídos por hash sha256
  await expect(page.getByTestId('contact-email')).not.toContainText('@')
  await expect(page.getByTestId('anonymized-at')).toBeVisible()
})
```

---

## 6. Cobertura Admin (15 testes)

Todos os specs desta seção usam `storageState: admin` (`super_admin`), salvo where noted.

### `users.spec.ts` (8 testes)

| # | Cenário | Role usado | Assertion |
|---|---------|------------|-----------|
| 1 | Lista de usuários carrega | admin | Tabela com colunas role/email/status |
| 2 | Convidar usuário org-scoped | admin | Formulário aceita email, convite aparece na lista pendente |
| 3 | Convidar usuário site-scoped (editor) | admin | Role `editor` selecionado, site associado visível |
| 4 | Convidar usuário site-scoped (reporter) | admin | Role `reporter` selecionado |
| 5 | Revogar convite | admin | Convite some da lista |
| 6 | Editar role de usuário | admin | Role atualizado na tabela após save |
| 7 | Super admin vê todos os sites/orgs | admin | Dropdown de contexto lista todas as orgs |
| 8 | Reporter redirecionado ao tentar acessar `/admin` | reporter | Redirect para `/cms/login` |

O teste #8 usa `test.describe` aninhado com troca de `storageState`:

```ts
// users.spec.ts — teste de redirect de reporter
test.describe('reporter — acesso negado a /admin', () => {
  test.use({ storageState: 'e2e/.auth/reporter.json' })

  test('reporter redirecionado ao tentar acessar /admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/cms\/login/)
  })
})
```

Para os testes de convite (#2–#4), `afterAll` deve limpar convites com `email LIKE 'e2e-%@test.example'` via `supabaseAdmin.from('invitations').delete()`.

### `audit.spec.ts` (3 testes) — `storageState: admin`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Log de auditoria carrega | Tabela com colunas action/resource/actor/data |
| 2 | Filtrar por tipo de ação | Apenas rows com a ação selecionada visíveis |
| 3 | Filtrar por data | Rows fora do range somem |

Pré-condição: `beforeAll` executa uma ação auditada (ex: convidar usuário via `supabaseAdmin`) para garantir que o log não está vazio no momento do teste.

```ts
// audit.spec.ts — seed de ação auditada
test.beforeAll(async ({ supabaseAdmin }) => {
  // dispara trigger de audit_log ao inserir um convite
  await supabaseAdmin.from('invitations').insert({
    email: 'e2e-audit-seed@test.example',
    site_id: SITE_ID,
    role_scope: 'site',
    role: 'editor',
    token_hash: 'seed-audit-token-hash',
  })
})

test('log de auditoria carrega', async ({ page }) => {
  await page.goto('/admin/audit')
  await expect(page.getByRole('table')).toBeVisible()
  for (const col of ['action', 'resource', 'actor']) {
    await expect(page.getByText(col, { exact: false })).toBeVisible()
  }
})

test('filtrar por tipo de ação', async ({ page }) => {
  await page.goto('/admin/audit')
  await page.getByLabel('Ação').selectOption('invitation.created')
  await page.getByRole('button', { name: 'Filtrar' }).click()
  const rows = page.getByTestId('audit-row')
  await expect(rows.first()).toBeVisible()
  // nenhuma row deve ter ação diferente da filtrada
  const actions = await rows.evaluateAll(
    els => els.map(el => el.dataset.action)
  )
  expect(actions.every(a => a === 'invitation.created')).toBe(true)
})
```

### `sites.spec.ts` (4 testes) — `storageState: admin`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Visualizar configurações do site | Nome, domínio, logo visíveis |
| 2 | Atualizar branding | Logo URL e cor primária persistidos após reload |
| 3 | Atualizar SEO defaults | `seo_default_og_image` e `twitter_handle` salvos |
| 4 | Toggle `cms_enabled=false` | Ao desabilitar, `/cms` redireciona para `/cms/disabled`; `afterEach` re-habilita |

`afterEach` obrigatório para restaurar `cms_enabled` após o teste #4, evitando contaminação dos demais testes do suite:

```ts
// sites.spec.ts — afterEach guard
test.afterEach(async ({ supabaseAdmin }) => {
  await supabaseAdmin
    .from('sites')
    .update({ cms_enabled: true })
    .eq('slug', 'bythiagofigueiredo')
})

test('toggle cms_enabled=false redireciona /cms', async ({ page }) => {
  await page.goto('/admin/sites/bythiagofigueiredo')
  await page.getByRole('switch', { name: 'CMS habilitado' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()

  // navegar para /cms deve retornar a página de CMS desabilitado
  await page.goto('/cms')
  await expect(page).toHaveURL(/\/cms\/disabled/)
})
```

### Accessibility gate (axe-core) — 3 páginas

Implementado como `test.describe` adicional **dentro dos specs existentes** — não como arquivo separado. Falhas em violations de impacto `critical` ou `serious` bloqueiam CI.

```ts
// dentro de cms-login.spec.ts (e analogamente em blog.spec.ts e users.spec.ts)
import AxeBuilder from '@axe-core/playwright'

test.describe('a11y', () => {
  test('sem violations críticas em /cms/login', async ({ page }) => {
    await page.goto('/cms/login')
    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(
      critical,
      critical.map(v => `${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  })
})
```

Páginas cobertas: `/cms/login`, `/cms/blog/new`, `/admin`. A mensagem de falha inclui o `id` e `description` de cada violation para facilitar triagem no CI.

Dependência: `@axe-core/playwright` deve ser adicionada como `devDependency` em `apps/web/package.json`:

```bash
npm install -D @axe-core/playwright -w apps/web
```

## 7. Cobertura Public + LGPD (11 testes)

### `homepage.spec.ts` (4 testes) — `storageState: public` — sem DB dependency

Esses 4 rodam no projeto `no-db` — sem depender do `auth.setup.ts`. Os mais rápidos da suite.

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Homepage carrega sem erros | Status 200, `<main>` visível, zero console errors |
| 2 | Blog listing carrega | Lista de posts publicados visível (`<article>` ou role `list`) |
| 3 | Campaign listing carrega | Cards de campanha visíveis |
| 4 | Host desconhecido → `/site-not-configured` | Intercepta Host header via `page.route()`, assert URL `/site-not-configured` |

Nota: testes de homepage assertam em elementos estruturais (`<main>`, `<nav>`, `h1`) — **nunca** em texto de marketing ou conteúdo específico de componentes (garante resiliência a mudanças de UI como DualHero).

---

### `newsletter.spec.ts` (4 testes) — `storageState: public`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Subscribe com email válido | Mensagem de confirmação pendente exibida |
| 2 | Confirmar via Inbucket | Busca URL no Inbucket → `page.goto(url)` → status `confirmed` visível |
| 3 | Unsubscribe via token | URL de unsubscribe do email → status `unsubscribed`, email anonimizado |
| 4 | Double-subscribe rejeitado | Segundo subscribe com mesmo email retorna mensagem de erro adequada |

Todos os testes usam a fixture `acceptedCookies`. Testes #2 e #3 usam `test.slow()` (email flow via Inbucket).

Helper para busca de URLs no Inbucket:

```ts
async function getConfirmUrl(inbucketUrl: string, mailbox: string): Promise<string> {
  const res = await fetch(`${inbucketUrl}/api/v1/mailbox/${mailbox}`)
  const messages = await res.json()
  return extractConfirmLink(messages[0].body.text)
}
```

---

### `contact-form.spec.ts` (3 testes) — `storageState: public`

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Submissão válida | Mensagem de sucesso exibida; submissão aparece em `/cms/contacts` (verificado com `storageState` de editor) |
| 2 | Erros de validação | Campos obrigatórios em falta exibem mensagem de erro inline |
| 3 | Turnstile bypass | Com test key `1x00000000000000000000AA`, formulário submete sem bloqueio |

Todos usam a fixture `acceptedCookies`.

Configuração de Turnstile para E2E via variáveis de ambiente:

```ts
// playwright.config.ts
env: {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
}
```

---

### `cookie-banner.spec.ts` (4 testes) — `storageState: public` — usa `page` puro (sem `acceptedCookies`)

| # | Cenário | Assertion |
|---|---------|-----------|
| 1 | Banner aparece na primeira visita | Componente `<CookieBanner>` visível; aceitar e rejeitar têm mesma prominence (LGPD anti-dark-pattern) |
| 2 | Aceitar tudo | Banner some; `localStorage.lgpd_consent` contém `analytics: true, marketing: true` |
| 3 | Rejeitar tudo | Banner some; consent contém apenas `functional: true` |
| 4 | Re-prompt em version bump | Mock `X-Lgpd-Consent-Fingerprint` header → banner reexibido mesmo com consent existente |

Verificação de prominence igual (teste #1):

```ts
const acceptBtn = page.getByTestId('lgpd-cookie-banner-accept-button')
const rejectBtn = page.getByTestId('lgpd-cookie-banner-reject-button')

// Ambos visíveis e no mesmo nível de DOM (não um escondido em link)
await expect(acceptBtn).toBeVisible()
await expect(rejectBtn).toBeVisible()

const acceptTag = await acceptBtn.evaluate(el => el.tagName)
const rejectTag = await rejectBtn.evaluate(el => el.tagName)
expect(acceptTag).toBe(rejectTag) // ambos <button>, não <button> vs <a>
```

Verificação de localStorage após aceitar (teste #2):

```ts
const consent = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('lgpd_consent') ?? '{}')
)
expect(consent).toMatchObject({ functional: true, analytics: true, marketing: true })
```

---

## 8. CI Workflow (`e2e.yml`)

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [staging]
    paths:
      - 'apps/web/**'
      - 'packages/**'
      - 'supabase/migrations/**'

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Start Supabase local
        run: npx supabase start

      - name: Wait for Supabase ready
        run: |
          until curl -sf http://127.0.0.1:54321/rest/v1/ \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY_LOCAL }}" > /dev/null; do
            echo "Aguardando Supabase..." && sleep 3
          done
        timeout-minutes: 2

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
        working-directory: apps/web

      - name: Run E2E suite
        run: npm run test:e2e
        working-directory: apps/web
        env:
          CI: true
          HAS_LOCAL_DB: 1
          PLAYWRIGHT_BASE_URL: http://localhost:3001
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_LOCAL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_LOCAL }}
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA
          TURNSTILE_SECRET_KEY: 1x0000000000000000000000000000000AA
          INBUCKET_URL: http://127.0.0.1:54324
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
          E2E_EDITOR_PASSWORD: ${{ secrets.E2E_EDITOR_PASSWORD }}
          E2E_REPORTER_PASSWORD: ${{ secrets.E2E_REPORTER_PASSWORD }}
          NEXT_PUBLIC_LGPD_BANNER_ENABLED: true
          NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED: true

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ github.run_id }}
          path: apps/web/playwright-report/
          retention-days: 7
```

### Secrets necessários no repositório GitHub

| Secret | Descrição |
|--------|-----------|
| `NPM_TOKEN` | PAT com `read:packages` para `@tn-figueiredo/*` |
| `SUPABASE_ANON_KEY_LOCAL` | Anon key do Supabase local (valor padrão publicado na docs do supabase-cli) |
| `SUPABASE_SERVICE_ROLE_KEY_LOCAL` | Service role key do Supabase local (valor padrão publicado na docs do supabase-cli) |
| `E2E_ADMIN_PASSWORD` | Senha do usuário `e2e-admin@test.local` |
| `E2E_EDITOR_PASSWORD` | Senha do usuário `e2e-editor@test.local` |
| `E2E_REPORTER_PASSWORD` | Senha do usuário `e2e-reporter@test.local` |

As credenciais Supabase local têm valores default públicos e conhecidos — não contêm dados sensíveis de produção. Ainda assim, tratadas como secrets para consistência e para permitir override caso a configuração local mude.

### Reporters

- `html` — artifact retido 7 dias; baixar via Actions UI para debugging de falhas
- `github` — anotações inline no PR (linhas com falha aparecem no diff)
- `list` — output no terminal do CI para leitura direta nos logs

Configuração em `playwright.config.ts`:

```ts
reporter: process.env.CI
  ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']]
  : [['html', { open: 'on-failure' }], ['list']],
```

### Retries e flakiness

`retries: 2` em CI, `retries: 0` localmente. Evita falsos positivos de flakiness de rede sem mascarar falhas reais. Testes que falharem 3 vezes consecutivas no CI são tratados como falha real e bloqueiam o merge.

Flaky tests conhecidos em potencial:
- Testes de Inbucket dependem de entrega de email dentro do timeout de `test.slow()` (90s). Se o Supabase local estiver sobrecarregado no CI, aumentar `timeout-minutes` do job ou usar `test.setTimeout(120_000)` explícito.
- Testes de `storageState` dependem do `global.setup.ts` ter rodado com sucesso — job deve falhar fast se setup falhar.

### Paralelismo

Chromium único, workers conforme `playwright.config.ts`:

```ts
workers: process.env.CI ? 2 : undefined,
fullyParallel: true,
```

2 workers no CI balanceia custo de boot do Next.js contra throughput. Aumentar para 4 se o runner for `ubuntu-latest` com 4 vCPUs e os testes demorarem mais de 15 min.

---

## 9. Selector Strategy e Convenções

### Hierarquia de seletores (ordem obrigatória — regra de projeto)

1. `page.getByRole('button', { name: 'Publicar' })` — ARIA roles primeiro; mais resiliente a mudanças de markup
2. `page.getByLabel('Título do post')` — para inputs e form fields associados via `<label>`
3. `page.getByTestId('cms-blog-publish-button')` — quando ARIA role é insuficiente ou ambíguo (múltiplos botões com mesmo role)
4. **Nunca** seletores CSS por classe ou ID de estilo (`'.bg-blue-500'`, `'#submit-btn'`) — quebram com refactors de Tailwind e não expressam intenção

### Convenção `data-testid`

Formato: `[area]-[componente]-[ação]`

```
cms-blog-save-draft-button
cms-blog-publish-button
cms-blog-unpublish-button
cms-blog-archive-button
cms-blog-delete-button
cms-blog-title-input
cms-blog-locale-selector
cms-campaign-upload-pdf-input
cms-campaign-publish-button
admin-users-invite-button
admin-users-revoke-button
admin-sites-cms-enabled-toggle
admin-sites-save-button
public-newsletter-subscribe-input
public-newsletter-subscribe-button
public-contact-form-name-input
public-contact-form-email-input
public-contact-form-message-input
public-contact-form-submit-button
lgpd-cookie-banner-accept-button
lgpd-cookie-banner-reject-button
lgpd-account-delete-request-button
lgpd-account-delete-confirm-button
lgpd-account-export-request-button
```

### Passo de testid audit — obrigatório antes de escrever specs

Task #1 do plano de implementação: audit pass em todos os componentes em scope para adicionar `data-testid` onde `getByRole`/`getByLabel` não cobrem. Este passo é pré-requisito para qualquer spec — POMs escritos antes do audit ficam frágeis e dependem de seletores CSS que quebram.

Componentes que requerem audit imediato:
- `PostEditor` (exportado pelo `@tn-figueiredo/cms`) — botões de save/publish/archive
- `CookieBanner` — botões de aceitar/rejeitar
- `NewsletterForm` — input de email e botão de subscribe
- `ContactForm` — inputs e botão de submit
- Admin: tabelas de usuários (botões de revoke por row), toggle de cms_enabled

Para componentes em `packages/cms/` (pacote externo), testids podem ser injetados via props ou via wrapper em `apps/web` — preferir wrapper para não forçar breaking change no pacote.

### `waitForLoadState` strategy

```ts
// Navegações que disparam server component streaming ou RSC fetches pesados
await page.goto('/cms/blog/new')
await page.waitForLoadState('networkidle')

// Listagens e rotas estáticas — default 'load' é suficiente
await page.goto('/')
// sem waitForLoadState adicional

// Após submit de form que redireciona
await Promise.all([
  page.waitForURL('/cms/blog'),
  submitButton.click(),
])
// sem networkidle adicional — URL change já indica conclusão
```

Regra: usar `networkidle` apenas para páginas com múltiplos requests paralelos de RSC (editor, dashboard). Abusar de `networkidle` aumenta o tempo de suite sem ganho em estabilidade.

### `test.slow()` — quando usar

```ts
// Qualquer teste que depende de Inbucket (espera por email)
test('confirma newsletter via email', async ({ page }) => {
  test.slow() // triplica timeout: 30s → 90s
  // ...
})

// Em nível de describe para suites completas de email flow
test.describe('invite flows', () => {
  test.slow()

  test('admin convida editor', async ({ page }) => { /* ... */ })
  test('editor aceita convite', async ({ page }) => { /* ... */ })
})
```

Não usar `test.slow()` em testes que não dependem de recursos externos — mascara lentidão que deveria ser investigada.

### Naming convention para spec files e testes

- Um arquivo por área funcional: `blog.spec.ts`, não `blog-create.spec.ts` + `blog-edit.spec.ts`
- `describe` por flow, `test` por cenário
- Nome do teste em português, imperativo, sem "should": `'cria draft e salva'`, não `'should create draft and save'`
- Agrupamento por role quando relevante:

```ts
test.describe('blog — editor', () => {
  test('cria draft e salva', async ({ editorPage }) => { /* ... */ })
  test('publica post', async ({ editorPage }) => { /* ... */ })
})

test.describe('blog — reporter', () => {
  test('bloqueia publicação direta', async ({ reporterPage }) => { /* ... */ })
})
```

### Page Object Model — estrutura de arquivo

```ts
// tests/e2e/pages/cms-blog.page.ts
export class CmsBlogPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/cms/blog')
    await this.page.waitForLoadState('networkidle')
  }

  async clickNew() {
    await this.page.getByRole('link', { name: 'Novo post' }).click()
    await this.page.waitForLoadState('networkidle')
  }

  async fillTitle(title: string) {
    await this.page.getByLabel('Título').fill(title)
  }

  async saveDraft() {
    await this.page.getByTestId('cms-blog-save-draft-button').click()
    await this.page.waitForResponse(res =>
      res.url().includes('/api/') && res.status() === 200
    )
  }

  async publish() {
    await this.page.getByTestId('cms-blog-publish-button').click()
    await this.page.waitForURL(/\/cms\/blog/)
  }
}
```

Regra: POMs **nunca** fazem assertions — isso é responsabilidade dos specs. POMs só encapsulam navegação e interação.

### Out of scope — decisões conscientes

| Feature | Status | Justificativa |
|---------|--------|---------------|
| Visual regression (screenshot diff) | Sprint 6+ | Manutenção alta; flaky em ambientes com fontes ou DPI diferentes |
| Firefox / WebKit coverage | Sprint 6+ | Custo de CI (3× runners) vs ganho marginal para app sem CSS quirks críticos |
| Mobile viewport para CMS/Admin | Fora de escopo permanente | CMS é desktop-only by design; responsividade admin não é requirement |
| Mobile viewport para public pages | Sprint 6+ | Homepage responsive, mas E2E mobile adiciona ~30% de testes e requer viewport fixtures extras |
| Google OAuth E2E | Permanente | Fluxo externo não-determinístico; coberto por unit test de `/auth/callback` + manual smoke |
| Load/stress testing | Fora de escopo | Domínio de k6/Locust, não Playwright |
| API-only tests (sem UI) | Fora de escopo | Cobertos pela suite Vitest de integração (`HAS_LOCAL_DB=1`) |
