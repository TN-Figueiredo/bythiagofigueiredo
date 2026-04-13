# tnf-scaffold

> Monorepo scaffold template for @tnf/* ecosystem apps — zero repeated decisions.

## Como usar este scaffold

### Opção 1: GitHub Template (recomendado)
1. Clique em **"Use this template"** no GitHub
2. Nomeie o novo repositório
3. Clone o novo repo e siga os passos abaixo

### Opção 2: Clone manual
```bash
git clone https://github.com/TN-Figueiredo/tnf-scaffold.git meu-novo-app
cd meu-novo-app
rm -rf .git && git init && git branch -M staging
```

---

## Checklist de Setup

### 1. Renomear o projeto
- [ ] Buscar e substituir `@app/` pelo seu nome (ex: `@meuapp/`)
- [ ] Buscar e substituir `TODO: [APP_NAME]` pelos valores reais
- [ ] Atualizar `package.json` root: `name`, `version`
- [ ] Atualizar `supabase/config.toml`: `project_id`

### 2. Supabase
- [ ] Criar projeto em [supabase.com](https://supabase.com)
- [ ] Copiar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configurar `.env` em `apps/api/` e `apps/web/`
- [ ] Rodar `supabase db push` para aplicar migrations

### 3. GitHub
- [ ] Criar repositório privado no GitHub
- [ ] Adicionar secret `NPM_TOKEN` (GitHub Packages token para @tn-figueiredo/*)
- [ ] Push inicial: `git push -u origin staging`

### 4. Vercel
- [ ] Importar projeto no [vercel.com](https://vercel.com)
- [ ] Criar dois projetos: `meuapp-api` e `meuapp-web`
- [ ] Configurar env vars em cada projeto
- [ ] Conectar domínio customizado

### 5. npm install
```bash
# Autenticar no GitHub Packages (necessário para @tn-figueiredo/*)
npm login --scope=@tn-figueiredo --registry=https://npm.pkg.github.com

npm install
```

---

## Estrutura do Monorepo

```
tnf-scaffold/
├── apps/
│   ├── api/          # Fastify 5 API (Node.js)
│   └── web/          # Next.js 15 (App Router)
├── packages/
│   └── shared/       # Tipos e utils compartilhados
├── supabase/
│   └── migrations/   # SQL migrations
└── .github/
    └── workflows/    # CI/CD (GitHub Actions)
```

### apps/api
- **Framework:** Fastify 5
- **Auth:** `@tn-figueiredo/auth-fastify`
- **DB:** Supabase via `@supabase/supabase-js`
- **Validação:** Zod
- **Deploy:** Vercel (Node.js runtime)

### apps/web
- **Framework:** Next.js 15 (App Router)
- **Auth:** `@tn-figueiredo/auth-nextjs`
- **UI:** Tailwind CSS + shadcn/ui
- **Admin:** `@tn-figueiredo/admin`
- **Deploy:** Vercel

---

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev:api          # API na porta 3333
npm run dev:web          # Web na porta 3001

# Build
npm run build:api
npm run build:web
npm run build:shared     # Buildar antes de dev/test

# Typecheck
npm run typecheck        # Monorepo inteiro

# Testes
npm test                 # API + Web
npm run test:api         # Só API (Vitest)
npm run test:web         # Só Web (Vitest)
```

---

## Ecosystem Packages (@tn-figueiredo/*)

Todos os pacotes do ecossistema estão pinados em versão exata (sem `^` ou `~`).

| Pacote | Versão | Usado em |
|--------|--------|----------|
| `@tn-figueiredo/shared` | 0.8.0 | api, web |
| `@tn-figueiredo/auth` | 1.3.0 | api |
| `@tn-figueiredo/auth-fastify` | 1.1.0 | api |
| `@tn-figueiredo/auth-supabase` | 1.1.0 | api |
| `@tn-figueiredo/auth-nextjs` | 2.0.0 | web |
| `@tn-figueiredo/admin` | 0.3.0 | web |
| `@tn-figueiredo/audit` | 0.1.0 | api |
| `@tn-figueiredo/lgpd` | 0.1.0 | api |
| `@tn-figueiredo/notifications` | 0.1.0 | web |
| `@tn-figueiredo/seo` | 0.1.0 | web |

Para atualizar: use `./scripts/upgrade-ecosystem.sh` (quando disponível) ou `npm install @tn-figueiredo/<pkg>@<version> --save-exact`.

---

## CI/CD

GitHub Actions roda em push/PR para `staging`:

| Job | Descrição |
|-----|-----------|
| `ecosystem-pinning` | Verifica que @tn-figueiredo/* estão pinados |
| `typecheck` | TypeScript em api e web (matrix) |
| `test-api` | Vitest no workspace api |
| `test-web` | Vitest no workspace web |
| `audit` | npm audit (non-blocking) |
| `secret-scan` | TruffleHog v3 secret detection |

**Secret necessário:** `NPM_TOKEN` — token de leitura para GitHub Packages.

---

*Template mantido por [@TN-Figueiredo](https://github.com/TN-Figueiredo)*
