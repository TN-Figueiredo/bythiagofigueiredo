# Sprint 4b — Package Extraction (cms + email) — Final Plan v3

**Data:** 2026-04-15 (kickoff)
**Sprint:** 4b (carry-over de Sprint 4 Epics 6+7)
**Horas estimadas (rough):** ~14h
**Depende de:** Sprint 4a ✅ (observability + LGPD shipped 2026-04-15, 263 web tests + 4 api tests green)
**Desbloqueia:** onboarding do 2º consumer do `@tn-figueiredo/cms` (candidato: `tonagarantia`), Sprint 5 (SEO + deploy hardening)

## Goal

Extrair `packages/cms/` e `packages/email/` do monorepo para repositórios próprios (`TN-Figueiredo/cms`, `TN-Figueiredo/email`) publicados em GitHub Packages como `@tn-figueiredo/cms@0.1.0` e `@tn-figueiredo/email@0.1.0`, com `apps/web` consumindo versões pinadas. Remover `transpilePackages` do `next.config.ts` e os workspaces correspondentes do monorepo, preservando a história via `git subtree split`.

Score target: **98+/100** vs. o plano Sprint 4 original (74/100) endereçando: LICENSE ausente, sem CHANGELOG/release automation, sem tarball dry-run, sem idempotência de publish, sem OIDC provenance, sem dependabot, `package.json` metadata incompleto (author/license/bugs/homepage/keywords/engines/sideEffects), peer-dep strictness não documentada, rollback vago, smoke test in-repo em vez de scratch externo, consumer swap atômico em commit único, branch protection explícita, `docs/ecosystem.md` para futuros consumers.

## Exit criteria

- [ ] `@tn-figueiredo/cms@0.1.0` publicado em GitHub Packages (após `0.1.0-beta.1` validado)
- [ ] `@tn-figueiredo/email@0.1.0` publicado em GitHub Packages (direto, sem beta)
- [ ] Ambos repos com branch protection em `main`: CI required, force-push bloqueado
- [ ] `apps/web` consome ambos pinados (`"@tn-figueiredo/cms": "0.1.0"`, `"@tn-figueiredo/email": "0.1.0"`), sem `transpilePackages`, sem entry de workspace
- [ ] Root `package.json` `workspaces` contém apenas `apps/*` + `packages/shared`
- [ ] `packages/cms/` e `packages/email/` removidos do monorepo (preservados na história dos repos extraídos via subtree)
- [ ] 263+ web tests green, 4 api tests green, `tsc --noEmit` clean em todos workspaces
- [ ] `docs/ecosystem.md` commitado no monorepo (guia para 2º consumer)
- [ ] `CHANGELOG.md` em cada repo extraído com entry `0.1.0`
- [ ] Pre-commit hook green (ecosystem-pinning valida que versões são exatas)

---

## Épicos

> Numeração dá continuidade ao Sprint 4a: **T46** começa onde o Sprint 4 parou (T45 foi o último shipped em 4a). Estimativas são rough.

### Epic 6 — `@tn-figueiredo/cms` extraction + publish (~8h)

Objetivo: mover `packages/cms/` para repo `TN-Figueiredo/cms` (já existe, empty), publicar `0.1.0-beta.1` → `0.1.0`, `apps/web` consome pinned.

**Tasks:**

- **T46** — `package.json` hygiene em `packages/cms/`:
  - `name: "@tn-figueiredo/cms"`, `version: "0.1.0-beta.1"`, remover `"private": true`
  - Adicionar: `license: "MIT"`, `author: "Thiago Figueiredo <tnfigueiredotv@gmail.com>"`, `homepage`, `bugs.url`, `repository.{type,url,directory?}`, `keywords: ["cms","mdx","nextjs","supabase"]`, `engines: { "node": ">=20" }`, `sideEffects: false`
  - Auditar `exports` map (root + `/code` lazy) e `files` (apenas `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`)
  - Peer deps: `react >=19`, `next >=15`, `@supabase/supabase-js >=2.103.0` — declarar `peerDependenciesMeta` para opcionais
- **T46a** — `LICENSE` (MIT, copyright Thiago Figueiredo 2026) + `README.md` (install, usage, exports table) + `CHANGELOG.md` (Keep-a-Changelog format, entry `0.1.0-beta.1` em Unreleased)
- **T46b** — `api-extractor` baseline: gerar snapshot inicial da public API (`dist/cms.api.md`) pra detectar breaking changes em PRs futuros (CI assert)
- **T47** — Subtree split + push:
  - `git subtree split --prefix=packages/cms -b cms-extract`
  - `git push git@github.com:TN-Figueiredo/cms.git cms-extract:main`
  - (branch `cms-extract` local descartada após push)
- **T48** — Workflow templates no repo extraído:
  - **T48a** — `.github/workflows/ci.yml`: matrix `node: [20, 22]`, `typecheck` + `test` + `build` + tarball size budget (`npm pack --dry-run` → assert `< 512KB`)
  - **T48b** — `.github/workflows/peer-compat.yml`: testa contra `@supabase/supabase-js` `[2.103.0, latest]` (garante peer-dep range honesto)
  - **T48c** — `.github/workflows/publish.yml`: trigger `push` de tag `v*`; job: setup-node com `registry-url: https://npm.pkg.github.com`, `npm ci`, `npm run build`, **idempotência** (`npm view @tn-figueiredo/cms@$VERSION > /dev/null 2>&1 || npm publish`), **OIDC provenance** (`--provenance` flag + `id-token: write` permission)
  - **T48d** — `.github/dependabot.yml`: weekly `npm` + `github-actions`, auto-PR
  - **T48e** — `.npmrc` no repo: `@tn-figueiredo:registry=https://npm.pkg.github.com` + `save-exact=true`
  - **T48f** — `.gitignore` (Node standard) + commit `package-lock.json` (reproducibilidade)
  - **T48g** — `test/consumer-smoke/` fixture: mini Next 15 app importa `PostEditor` + `SupabasePostRepository`, roda `next build` headless em CI (valida que `exports` map está correto e Edge runtime não quebra no middleware import)
  - **T48h** — Branch protection via `gh api` ou UI: `main` protegida, require CI checks (`ci`, `peer-compat`), 0 reviewers (solo dev), force-push bloqueado
- **T49** — Tag + publish dry run:
  - **T49a** — Gate: `cat .npmrc` no CWD do dev confirma `@tn-figueiredo:registry=https://npm.pkg.github.com` antes de qualquer `npm publish`. Se ausente, abortar.
  - **T49b** — Tag `v0.1.0-beta.1` → push → workflow publica → `npm view @tn-figueiredo/cms@0.1.0-beta.1` retorna metadata → smoke local `npm install @tn-figueiredo/cms@0.1.0-beta.1` num scratch dir externo (`/tmp/cms-smoke`)
- **T50** — Promover pra `0.1.0`:
  - Bump `version` → `0.1.0`, `CHANGELOG` move Unreleased → `0.1.0` com data
  - Tag `v0.1.0` → push → workflow publica → `npm view` confirma
- **T51** — _(movido para Phase 4, ver abaixo — swap atômico em commit dedicado)_
- **T51a** — Verificar que `next.config.ts` sem `transpilePackages` não quebra Edge runtime: rodar `next dev` local + request real em `/` (middleware executa `SupabaseRingContext`) antes do swap commit
- **T52** — _(movido para Phase 4)_

**Risco:** `transpilePackages` removal quebra Edge runtime no middleware. Mitigação: T51a gate obrigatório.

### Epic 7 — `@tn-figueiredo/email` extraction + publish (~5h)

Objetivo: mesmo pattern do Epic 6 para `packages/email/`. Direto para `0.1.0` (sem beta) — não tem Edge runtime surface, risco menor.

**Tasks:**

- **T53** — `package.json` hygiene em `packages/email/`: `version: "0.1.0"`, license MIT, author, homepage, bugs, repository, keywords (`["email","brevo","templates","lgpd"]`), engines `>=20`, `sideEffects: false`. Auditar `exports` (root + `/templates/*` subpath + `/helpers/unsubscribe-token`) e `files`. Peer deps: `@supabase/supabase-js`, nenhum React.
- **T53a** — LICENSE + README + CHANGELOG (mesmo shape do Epic 6)
- **T53b** — `api-extractor` baseline
- **T54** — `gh repo create TN-Figueiredo/email --private --description "Email adapter + templates for @tn-figueiredo ecosystem"` (repo **não existe** — precisa criar). Subtree split: `git subtree split --prefix=packages/email -b email-extract` → push para `main`.
- **T55** — Workflows (mirror Epic 6):
  - **T55a** — `ci.yml` (matrix, tarball size budget)
  - **T55b** — `peer-compat.yml` (supabase-js range)
  - **T55c** — `publish.yml` (OIDC provenance + idempotência `npm view`)
  - **T55d** — `dependabot.yml`
  - **T55e** — `.npmrc`, `.gitignore`, commit `package-lock.json`
  - **T55f** — `test/consumer-smoke/`: mini Node script importa `BrevoEmailAdapter` + 1 template, `tsx` executa
  - **T55g** — Branch protection em `main`
- **T56** — Gate `.npmrc` check (T49a mirror)
- **T57** — Tag `v0.1.0` → push → publish → `npm view @tn-figueiredo/email@0.1.0` confirma. Smoke em `/tmp/email-smoke`.
- **T58, T59** — _(movidos para Phase 4)_

**Dependências:** Paralelizável com Epic 6 até a hora do swap. O swap do consumer é atômico para ambos (Phase 4).

### Epic 7b — `docs/ecosystem.md` (~1h)

Objetivo: deixar guia escrito para onboarding do 2º consumer (e Claude em sessões futuras).

**T59b** — `docs/ecosystem.md` no monorepo:
- Como configurar `.npmrc` em novo consumer (NPM_TOKEN com `read:packages`)
- Versioning policy (semver, exact pin, pre-commit hook enforcement)
- Release flow (tag → workflow → `npm view` confirma)
- Peer-dep matrix dos packages publicados
- Como atualizar um package em todos consumers (bump + install + CI gate)
- Referência pros repos: `TN-Figueiredo/cms`, `TN-Figueiredo/email`

---

## Phases (execution order)

### Phase 1 — Local prep (paralelizável, não destrutiva) — ~5h

Tudo roda no branch local antes de qualquer coisa tocar GitHub remoto:

1. T46, T46a, T46b em `packages/cms/`
2. T53, T53a, T53b em `packages/email/`
3. Redigir workflow templates (T48a–f, T55a–e) como arquivos locais prontos pra commit no subtree
4. Redigir smoke fixtures (T48g, T55f) dentro de cada package (entram no subtree split)
5. T59b — `docs/ecosystem.md`
6. Este spec

Commit único em `staging`: `chore(sprint-4b): prep packages for extraction`.

### Phase 2 — Repo creation + subtree push (destrutiva, sequencial, requer confirmação) — ~2h

1. **Confirmação explícita do user** antes de prosseguir
2. `gh repo create TN-Figueiredo/email --private ...` (repo cms já existe)
3. `git subtree split --prefix=packages/cms -b cms-extract` → push → apagar branch local
4. `git subtree split --prefix=packages/email -b email-extract` → push → apagar branch local
5. Branch protection (T48h, T55g) em ambos via `gh api`

### Phase 3 — Tag + publish (destrutiva) — ~3h

1. No repo `cms`: tag `v0.1.0-beta.1` → workflow roda → `npm view` confirma → smoke externo em `/tmp/cms-smoke`
2. No repo `cms`: tag `v0.1.0` → workflow → `npm view` confirma
3. No repo `email`: tag `v0.1.0` → workflow → `npm view` confirma → smoke em `/tmp/email-smoke`
4. **Gate de avanço**: ambos `npm view @tn-figueiredo/{cms,email}@0.1.0` precisam resolver antes de Phase 4

### Phase 4 — Atomic consumer swap (destrutiva, 2 commits) — ~3h

No monorepo, branch `feat/sprint-4b-package-swap`:

**Commit A** — `chore(sprint-4b): remove extracted packages from monorepo`:
- `git rm -r packages/cms packages/email`
- Root `package.json` `workspaces`: remove `packages/cms`, `packages/email` (mantém `apps/*` + `packages/shared`)
- `npm install` (regenera `package-lock.json`)

**Commit B** — `feat(sprint-4b): consume @tn-figueiredo/{cms,email} pinned from GitHub Packages`:
- `apps/web/package.json`: `"@tn-figueiredo/cms": "0.1.0"`, `"@tn-figueiredo/email": "0.1.0"` (exato, sem `^`)
- `apps/web/next.config.ts`: remove `transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/email']` inteiro se só esses forem members
- `npm install` (resolve do GitHub Packages via root `.npmrc`)
- T51a gate: `next dev` + middleware request manual → OK
- `npm run typecheck`, `npm run test:web`, `npm run test:api` → all green

**Rollback:** `git revert HEAD~1..HEAD` reverte ambos commits (ordem correta: revert de B primeiro, depois A). Workspaces voltam, `transpilePackages` volta, versões voltam pra `*`.

PR para `staging` → CI green → merge → push prod.

---

## Key decisions (registered, final)

| Tópico | Decisão |
|---|---|
| License | MIT (revisable se external consumer pedir outra) |
| Beta tag | Apenas `cms` (`0.1.0-beta.1` → `0.1.0`); `email` direto `0.1.0` |
| `package-lock.json` nos repos extraídos | Yes, committed (reproducibilidade de CI) |
| OIDC provenance | Enabled via `--provenance` + `id-token: write` em `publish.yml` |
| Dependabot | Weekly `npm` + `github-actions` |
| Branch protection | `main` required CI, 0 reviewers (solo dev), force-push off |
| Root `.npmrc` gate | Check obrigatório antes de publish (T49a / T56) |
| Smoke test location | In-repo `test/consumer-smoke/` + external `/tmp/*-smoke` após publish |
| Rollback plan | 2 commits separados no swap → `git revert` atômico |
| Peer-dep matrix CI | `@supabase/supabase-js` `[2.103.0, latest]` em `peer-compat.yml` |
| Tarball size budget | `< 512KB` asserted em CI via `npm pack --dry-run` |
| API surface snapshot | `api-extractor` baseline committed (`dist/*.api.md`) |
| Repo naming | `TN-Figueiredo/cms`, `TN-Figueiredo/email` (match do `@tn-figueiredo` scope) |
| Publish channel | GitHub Packages (continuidade do ecossistema) |
| Sprint 4a `@tn-figueiredo/cms` workspace consumer | Removido inteiro no Commit A da Phase 4 |

---

## Out of scope (Sprint 5+)

- Extração de `packages/shared` (permanece workspace até 3º consumer)
- npmjs público mirror (rejeitado — private fica em GH Packages)
- Release automation via `changesets` ou `semantic-release` (manual tag em 4b; automation em 5+ se dor aparecer)
- Canary channel (`@next` dist-tag) — só `latest` por enquanto
- Storybook / Chromatic para CMS editor visual regression
- Benchmark suite (bundle size trend tracking além do gate `< 512KB`)

## Riscos

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| `transpilePackages` removal quebra Edge runtime no middleware | 25% | alto | T51a gate: `next dev` + request real antes do swap commit; rollback via `git revert` |
| `publish.yml` falha em produção (GH Packages perms / OIDC config) | 20% | médio | `0.1.0-beta.1` dry run em cms primeiro; `npm view` gate após cada publish |
| `publish.yml` não idempotente → tag re-push quebra workflow | 15% | médio | `npm view <pkg>@<v> \|\| npm publish` guard em T48c/T55c |
| Consumer swap commits landam antes de ambos publishes concluírem | 10% | alto | Phase 4 gateada em `npm view` success para ambos packages (Phase 3 exit gate) |
| `NPM_TOKEN` do CI do monorepo (scope `read:packages`) não resolve novos packages | 10% | médio | Sanity `npm view` do monorepo CI após swap; token já verificado com escopo correto |
| Subtree split perde history de arquivos renomeados | 15% | baixo | Aceitar — `--prefix` funciona em 99% dos casos; histórico pré-extração fica no monorepo também |
| `api-extractor` diverge da public API sem alerta | 10% | baixo | CI assert baseline match em PRs; bump baseline é PR deliberado |
| Tarball excede budget `< 512KB` (shiki pulls in big deps) | 20% | baixo | `shiki` já é opt-in lazy (`/code` export); budget assert captura regressão |
| Dependabot PR floods | 30% | baixo | Weekly cadence + auto-merge só pra patch bumps (futuro) |
| `email` sem beta expõe bug em produção rapidamente | 15% | médio | Smoke externo obrigatório em T57 antes de Phase 4; `email` tem menos superfície que `cms` |

## Dependency order (resumo)

```
Phase 1 (local prep, paralelo) ─► Phase 2 (push) ─► Phase 3 (publish) ─► Phase 4 (swap)
     │                              │                   │                    │
     └─ both packages                └─ sequential       └─ gate: npm view    └─ 2 commits
                                        per repo            both ok              atomic revert
```

Epic 7b (`docs/ecosystem.md`) commita junto com Phase 1.

---

## Status (2026-04-15)

Spec v3 locked — execution pending. Previous partial plan scored 74/100 (baseline); this spec targets 98+/100 per delta checklist na intro.

**Pre-reqs verificados:**
- `NPM_TOKEN` scope: `write:packages, delete:packages, repo, workflow` ✅
- Root `.npmrc`: `@tn-figueiredo:registry=https://npm.pkg.github.com` + `save-exact=true` ✅
- `TN-Figueiredo/cms` repo: exists (empty) ✅
- `TN-Figueiredo/email` repo: **não existe** — criar em T54
- Sprint 4a shipped ✅ (263 web + 4 api green)
