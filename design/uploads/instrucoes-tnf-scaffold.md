# Instruções para Claude Code: Criar tnf-scaffold Template Repo

> **Contexto:** Cola estas instruções no terminal do Claude Code para ele criar o template de monorepo do ecossistema @tnf/*.
> **Onde executar:** Na pasta onde você quer criar o repo (ex: `~/projects/`)
> **Pré-requisitos:** Git, Node 22+, npm

---

## Prompt para o Claude Code

```
Preciso que você crie um template de monorepo chamado `tnf-scaffold`. Este é o scaffold base para TODOS os apps do ecossistema @tnf/* (TôNaGarantia, bythiagofigueiredo, MEISimples, CreatorForge, TravelCalc, CalcHub, etc.). A ideia é: cada novo app clona/copia este scaffold e já tem tudo configurado — pre-commit hooks, CI, lint, testes, build, deploy. Zero decisão repetida.

### Estrutura a criar:

```
tnf-scaffold/
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .nvmrc                          # Node 22
├── .npmrc                          # Registry @tn-figueiredo → GitHub Packages
├── .husky/
│   └── pre-commit                  # Roda testes com --bail antes de commitar
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI: typecheck, testes, audit, secret-scan, ecosystem-pinning
├── apps/
│   ├── api/
│   │   ├── package.json            # Fastify 5 + @tnf/* packages
│   │   ├── tsconfig.json           # ES2022, NodeNext, strict
│   │   ├── tsconfig.build.json     # Exclui testes
│   │   ├── vitest.config.ts
│   │   ├── vercel.json             # API deploy config
│   │   ├── build.sh                # Custom build script
│   │   ├── .env.example
│   │   └── src/
│   │       ├── index.ts            # Fastify server entry point
│   │       ├── plugins/            # Fastify plugins (cors, helmet, etc.)
│   │       └── routes/             # Placeholder routes
│   └── web/
│       ├── package.json            # Next.js 15 + React 19 + @tnf/* packages
│       ├── tsconfig.json           # Bundler resolution, path alias @/*
│       ├── next.config.ts          # Com Sentry + headers HSTS/CSP
│       ├── tailwind.config.ts      # Tailwind CSS
│       ├── postcss.config.mjs
│       ├── components.json         # shadcn config (base-nova, lucide)
│       ├── vitest.config.ts
│       ├── vercel.json             # Web deploy config
│       ├── middleware.ts           # Auth middleware placeholder
│       ├── .env.example
│       └── src/
│           └── app/
│               ├── layout.tsx      # Root layout placeholder
│               ├── page.tsx        # Home page placeholder
│               └── admin/
│                   └── layout.tsx  # Admin layout usando @tnf/admin
├── packages/
│   └── shared/
│       ├── package.json            # @{APP_NAME}/shared, depende de @tn-figueiredo/shared
│       ├── tsconfig.json
│       └── src/
│           └── index.ts            # Re-exports + app-specific types
├── supabase/
│   ├── config.toml                 # Supabase local config
│   └── migrations/
│       └── .gitkeep
├── package.json                    # Root: workspaces, scripts, husky, lint-staged
└── tsconfig.json                   # Base TypeScript config
```

### Regras importantes:

1. **Pre-commit hook (.husky/pre-commit):**
   ```bash
   npm run test:api -- --bail
   npm run test:web -- --bail
   ```
   Deve bloquear o commit se qualquer teste falhar. Vercel gods happy.

2. **CI (.github/workflows/ci.yml):** Baseado no TNG:
   - Job `ecosystem-pinning`: verifica que @tn-figueiredo/* packages estão pinados (sem ^ ou ~)
   - Job `typecheck`: roda typecheck em api e web (matrix strategy)
   - Job `test-api`: vitest run no workspace api
   - Job `test-web`: vitest run no workspace web
   - Job `audit`: npm audit (non-blocking)
   - Job `secret-scan`: TruffleHog v3 secret scanning
   - Trigger: push to staging + PR to staging

3. **Root package.json scripts:**
   ```json
   {
     "dev:api": "npm run dev -w apps/api",
     "dev:web": "npm run dev -w apps/web",
     "build:api": "npm run build -w apps/api",
     "build:web": "npm run build -w apps/web",
     "build:shared": "npm run build -w packages/shared",
     "typecheck": "tsc --noEmit",
     "test": "npm run test:api && npm run test:web",
     "test:api": "npm run test -w apps/api",
     "test:web": "npm run test -w apps/web",
     "prepare": "husky"
   }
   ```
   Workspaces: `["apps/*", "packages/*"]`
   Engines: `{ "node": ">= 18.0.0" }`

4. **.npmrc:**
   ```
   @tn-figueiredo:registry=https://npm.pkg.github.com
   ```

5. **.nvmrc:** `22`

6. **apps/api/package.json** — dependencies mínimas:
   - fastify@5.8.1, @fastify/cors, @fastify/helmet
   - @supabase/supabase-js
   - zod
   - @tn-figueiredo/auth, @tn-figueiredo/auth-fastify, @tn-figueiredo/auth-supabase
   - @tn-figueiredo/audit, @tn-figueiredo/shared, @tn-figueiredo/lgpd
   - devDeps: typescript, vitest, tsx, @types/node

7. **apps/web/package.json** — dependencies mínimas:
   - next@15, react@19, react-dom@19
   - @supabase/ssr
   - tailwindcss, @tailwindcss/postcss
   - zod
   - @tn-figueiredo/admin, @tn-figueiredo/auth-nextjs, @tn-figueiredo/seo, @tn-figueiredo/shared
   - recharts, lucide-react (peerDeps do @tnf/admin)
   - devDeps: typescript, vitest, @types/node, @types/react

8. **apps/api/src/index.ts** — Fastify server boilerplate:
   ```typescript
   import Fastify from 'fastify'
   import cors from '@fastify/cors'
   import helmet from '@fastify/helmet'

   const app = Fastify({ logger: true })

   await app.register(cors, { origin: process.env.WEB_URL })
   await app.register(helmet)

   // TODO: registerAuthRoutes(app, config)
   // TODO: register app-specific routes

   app.get('/health', async () => ({ status: 'ok' }))

   const port = Number(process.env.PORT) || 3333
   await app.listen({ port, host: '0.0.0.0' })
   console.log(`🚀 API running on port ${port}`)
   ```

9. **apps/web/src/app/admin/layout.tsx** — Admin layout placeholder:
   ```typescript
   // TODO: import { createAdminLayout } from '@tn-figueiredo/admin'
   // TODO: configure AdminLayoutConfig with sidebar items
   export default function AdminLayout({ children }: { children: React.ReactNode }) {
     return <>{children}</>
   }
   ```

10. **TODO markers:** Colocar `// TODO: [APP_NAME]` em todos os lugares que precisam ser customizados por app (app name, Supabase keys, routes, sidebar items, etc.)

11. **.env.example** para api e web com TODAS as env vars que os packages @tnf/* precisam:
    ```
    # Supabase
    SUPABASE_URL=
    SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_KEY=

    # Auth
    AUTH_REDIRECT_URL=
    AUTH_COOKIE_DOMAIN=

    # Sentry
    SENTRY_DSN=
    SENTRY_AUTH_TOKEN=

    # API (api only)
    PORT=3333
    WEB_URL=http://localhost:3001

    # Web (web only)
    NEXT_PUBLIC_API_URL=http://localhost:3333
    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=
    ```

12. **NÃO incluir:**
    - apps/mobile/ (nem todo app tem mobile — adicionar manualmente quando necessário)
    - Stripe/billing (adicionar via @tnf/billing quando existir)
    - Conteúdo específico de negócio
    - node_modules, .env com valores reais

13. **README.md** no root com:
    - "Como usar este scaffold" (clonar, renomear, configurar)
    - Checklist de setup (Supabase project, Vercel, env vars, GitHub secrets)
    - Estrutura do monorepo
    - Scripts disponíveis

14. **TypeScript strict mode** em TODOS os tsconfig:
    ```json
    {
      "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true
      }
    }
    ```

Crie todos os arquivos. Inicialize o git repo. NÃO rode npm install (deixe pra quem clonar). Garanta que o scaffold está completo e funcional — qualquer dev que clonar deve conseguir configurar um novo app em menos de 30 minutos.
```

---

## Depois de criar

1. Revise os arquivos criados
2. Rode `git init && git add -A && git commit -m "feat: initial tnf-scaffold template"`
3. Crie o repo no GitHub: `gh repo create TN-Figueiredo/tnf-scaffold --private --source=. --push`
4. Configure como template repo no GitHub (Settings → Template repository ✓)

## Como usar para novo app

```bash
# Opção 1: GitHub template
# Clique "Use this template" no GitHub

# Opção 2: Clone manual
git clone https://github.com/TN-Figueiredo/tnf-scaffold.git meu-novo-app
cd meu-novo-app
rm -rf .git && git init

# Depois:
# 1. Buscar/Substituir "scaffold" pelo nome do app
# 2. Configurar .env files
# 3. Criar projeto Supabase
# 4. npm install
# 5. Configurar Vercel (api + web)
# 6. Pronto 🚀
```
