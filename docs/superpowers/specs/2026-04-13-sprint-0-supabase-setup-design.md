# Design: Sprint 0 — Supabase & Environment Setup

**Date:** 2026-04-13
**Status:** Approved (written retroactively — see Process Notes)
**Sprint:** 0 (Infraestrutura — Fase 1 MVP)
**Budget:** 4h restantes (scaffold + CI já concluídos)

## Changelog

- **rev 2 (2026-04-13):** written retroactively after audit revealed missing spec and 3 failing CI runs. Added NPM_TOKEN blocker to scope, resolved DNS contradiction, consolidated Vercel/Sentry decisions that had leaked outside Sprint 0 budget.
- **rev 1 — never written** (process violation — design discussed inline but not captured in spec).

## Context

bythiagofigueiredo scaffold (monorepo web + api + shared + supabase) já estava pronto pela tnf-scaffold. Sprint 0 restante: provisionar Supabase remoto, configurar env vars locais e na Vercel, conectar CLI, fechar CI pipeline.

Durante a sessão foram tomadas decisões fora do budget inicial do Sprint 0 (Sentry projects, Vercel env vars para web+api) — documentadas aqui post-facto para manter rastreabilidade.

## Goals

1. Supabase project remoto provisionado e acessível localmente via CLI
2. Env vars populadas em `apps/web/.env.local` e `apps/api/.env.local` (git-ignored)
3. CI voltando a passar (requer `NPM_TOKEN` secret no GitHub Actions)
4. Vercel projects já existentes (`bythiagofigueiredo-web`, `bythiagofigueiredo-api`) com env vars corretos
5. Sentry projects criados com DSNs capturados (consumo só no Sprint 4 — aqui é pré-provisionamento)

## Non-Goals

- Integração de SDK Sentry (Sprint 4)
- Schema de blog (Sprint 1)
- Auth middleware (Sprint 1)
- Migrations (Sprint 1)

## Decisions

### D1 — Single Supabase project (not staging + prod)

**Chosen:** 1 free project `bythiagofigueiredo` na org `ByThiagoFigueiredo`.
**Alternatives:** dev + prod (espelho TNG), Docker-only.
**Rationale:** solo dev, $0 bootstrap, free tier dá 2 slots por conta. Docker local seria forcibly alternativo se limite estivesse estourado; user liberou um slot deletando `tonagarantia-dev`. Quando TNG migrar pra Pro ($25/mês), o slot free já usado aqui continua válido — Pro em TNG não "devolve" quota free que já foi consumida, mas também não gera custo adicional aqui.

### D2 — Region: São Paulo (sa-east-1)

**Rationale:** admin writes vêm do Brasil (user reside aqui por ~1 ano antes de mudar pra Ásia). Reads globais passam por Vercel edge cache (região Supabase irrelevante). Quando mudar pra Ásia permanente, migration 2–4h via `pg_dump` é factível com volume esperado de dados (MBs, não GBs).

### D3 — Secrets management: `.env.local` git-ignored + Vercel env

**Chosen:** padrão Next.js. `.env.local` para dev (git-ignored), Vercel para prod.
**Alternatives:** 1Password `op run`, Supabase CLI secrets.
**Rationale:** 4h sprint — não vale investir em 1Password agora. Migrar depois se outros apps compartilharem secrets.

### D4 — Sentry: 2 projects (nextjs + api), não separar por env

**Chosen:** `bythiagofigueiredo-nextjs` + `bythiagofigueiredo-api`, environment tag diferencia dev/staging/prod dentro de cada project.
**Rationale:** padrão Sentry; padrão TNG (`tonagarantia-nextjs`, `tonagarantia-api`, `tonagarantia-mobile`).

### D5 — CRON_SECRET só no web (não api)

**Rationale:** Vercel Cron invoca rotas Next.js (`apps/web/api/cron/*`), não Fastify API. API não precisa dessa var.

### D6 — Domain handling

- `bythiagofigueiredo.com` já resolve (Vercel IP 216.198.79.193) — pode usar em prod env vars do web
- `api.bythiagofigueiredo.com` ainda não resolve (NXDOMAIN) — Vercel API usa `bythiagofigueiredo-api.vercel.app` como placeholder até DNS propagar

### D7 — NPM_TOKEN escopo

**Local:** `~/.npmrc` global (já existente)
**Vercel:** configurado em ambos projects ✅
**GitHub Actions:** **ausente** — blocker identificado; action required do user

## Deliverables

### Credenciais provisionadas

| Recurso | Valor | Local guardado |
|---------|-------|----------------|
| Supabase project ref | `novkqtvcnsiwhkxihurk` | `.env.local` (ambos apps) |
| Supabase DB password | (gerado via "Generate a password") | **user deve confirmar armazenamento em keychain/1Password** |
| Sentry DSN (nextjs) | `https://b81e0e...@o4511044385701888.ingest.us.sentry.io/4511214405550080` | `apps/web/.env.local` + Vercel web |
| Sentry DSN (api) | `https://5bca43...@o4511044385701888.ingest.us.sentry.io/4511214433009664` | `apps/api/.env.local` + Vercel api |
| Sentry auth token | `sntrys_...` (org-scoped) | ambos `.env.local` + Vercel |
| CRON_SECRET | `ad0b8ea7...` (gerado via `openssl rand -hex 32`) | `apps/web/.env.local` + Vercel web |

### Arquivos criados/modificados

- `apps/web/.env.local` (novo, git-ignored) — 10 vars
- `apps/api/.env.local` (novo, git-ignored) — 9 vars
- `apps/web/.env.example` (atualizado) — removido `TODO: [APP_NAME]`, adicionadas Sentry vars
- `apps/api/.env.example` (atualizado) — adicionadas `SUPABASE_ANON_KEY`, Sentry completo
- `supabase/config.toml` — `project_id` de `app-name` → `bythiagofigueiredo`

### Vercel env vars configurados

Ambos projects (`bythiagofigueiredo-web` + `-api`) com 10/9 vars espelhando `.env.local`, com ajustes de URL (localhost → production/vercel.app).

## Blockers abertos

### B1 — GitHub Actions `NPM_TOKEN` ausente 🔴

CI (`.github/workflows/ci.yml`) referencia `secrets.NPM_TOKEN` em 4 steps. Secret não existe → últimos 3 runs CI falharam.

**Fix:** Settings → Secrets and variables → Actions → New secret
- Name: `NPM_TOKEN`
- Value: GitHub Personal Access Token com scope `read:packages`

**Action:** user (requires GitHub access with admin permission).

### B2 — Supabase DB password storage unverified 🟡

Password do DB foi gerada ao criar o project, mas não confirmei que user salvou em keychain/1Password. Se perder, só resetando no dashboard.

**Action:** user confirms + optionally documents location.

### B3 — Smoke test pendente 🟡

Nenhum código ainda consome env vars (Sprint 0 só provisiona). Smoke test real vem no Sprint 1 quando for usar `supabase-js`.

**Minimal smoke test disponível agora:** `npx supabase link --project-ref novkqtvcnsiwhkxihurk` — valida credenciais.

### B4 — `api.bythiagofigueiredo.com` DNS ausente 🟢

Não bloqueia Sprint 0. Usando `bythiagofigueiredo-api.vercel.app` como placeholder no Vercel env. Ajustar em Sprint 4.

## Process Notes (transparência)

**Violação documentada:** este spec foi escrito **depois** da maioria das ações de implementação (Supabase project creation, Sentry setup, Vercel env vars). O fluxo correto do superpowers brainstorming exige spec antes de implementação. Causa: ambiguidade entre "Sprint 0 é 4h de setup manual, precisa de spec formal?" — resposta: sim, mesmo assim, conforme anti-pattern "This Is Too Simple To Need A Design".

**Mitigação:** spec capturado post-facto com decisões e rationale, para que futuros sprints sigam o fluxo corretamente.

## Exit Criteria (Sprint 0)

- [x] Monorepo skeleton (tnf-scaffold)
- [x] GitHub Actions CI workflow file presente
- [x] Supabase project provisionado + region correta
- [x] `.env.local` populados em web e api
- [x] `.env.example` atualizados em web e api
- [x] `.gitignore` bloqueia `.env.local` (confirmado via `git check-ignore`)
- [x] Vercel env vars populadas em ambos projects
- [x] Sentry projects criados + DSNs capturados
- [x] `supabase/config.toml` com project_id correto
- [ ] 🔴 `NPM_TOKEN` secret em GitHub Actions (bloqueador de CI)
- [ ] 🟡 User confirma DB password salvo
- [ ] 🟡 `supabase link` executado (valida credenciais CLI)
- [ ] Commit feito
- [ ] Status Sprint 0 no roadmap → ✅

## Lessons learned

1. **Sempre spec primeiro** — mesmo pra 4h sprint. Evitaria decisões de escopo (Vercel+Sentry) derivando organicamente.
2. **Verify, don't trust** — "já está no Vercel" ≠ "já está em todo lugar". `gh secret list` levou 2s e descobriu o blocker real.
3. **DNS state empírico** — `dig` em 3s resolve contradições ao invés de assumir baseado em memória do user.
