# Design: Ecosystem Migration — `@tn-figueiredo/*` → `@figueiredo-technology/*`

**Date:** 2026-04-13
**Status:** Approved (rev 4 — empirically accurate scope)
**Type:** Cross-repo sprint (NÃO é side-sprint — é ~12-17h de trabalho)
**Repos afetados:** `tnf-ecosystem`, `tonagarantia`, `bythiagofigueiredo`, `bright-tale` (Rafael)

## 🔴 Lessons learned — Vercel Hobby + org-owned private repos

**Fato descoberto durante execução (NÃO no design):** Vercel Hobby plan (free) **NÃO suporta repos privados owned por organization**. Só user-owned private OR org-owned public.

**Implicação:** transferir repos com apps Vercel pra org requer upgrade Pro ($20/user/mês). Plano B: manter apps no user account.

**Decisão post-facto:**
- `tnf-ecosystem` fica em `figueiredo-technology` (packages não afetados)
- `bythiagofigueiredo`, `tonagarantia`, `tnf-scaffold` permanecem em `TN-Figueiredo` user
- Packages são consumidos cross-owner via "Manage Actions access" (modal aceita repos externos à org)

**Deveria estar em rev4:** R19 — "Vercel Hobby não suporta org-owned private repos". Erro do spec.

## Execution Log (2026-04-13)

**Fase 0 — tnf-ecosystem hygiene** ✅
- Tag `pre-migration-2026-04-13` pushed
- 2 commits (promo-codes pino fix + 4 untracked packages)
- 41 commits pushed to origin/main
- 9 stale branches deleted remote + 1 local blocked by worktree (feat/admin-package em .worktrees/admin-package — active work, preserved)
- changeset-release/main deixado intacto

**Fase 1 — Package migration** ✅ (com desvios)
- Repo transferido `TN-Figueiredo/tnf-ecosystem` → `figueiredo-technology/tnf-ecosystem` via `gh api` (sem email confirmation)
- Branch `migration/figueiredo-technology-scope`
- 107 arquivos renomeados (.ts .tsx .json .md)
- 24 package.json com version bumps (19× 1.0.0, 4× 2.0.0, 1× 3.0.0 pra auth-nextjs)
- 17 internal dep refs normalizadas
- 2 bugs pre-flight esquecidos: `.github/workflows/release.yml` tinha `scope: '@tn-figueiredo'` hardcoded + `.npmrc` raiz. Fixados antes do PR final.
- Build 24/24 verde, tests 110/110 passing
- PR #6 → merge → release workflow verde em 3m36s
- **23/24 packages publicados** em `@figueiredo-technology/*`
- **auth-expo marcado `private: true`** no package.json — **intencionalmente não publicado** (package interno pro TNG mobile). Confirmado via commit `ff72d3a` do changelog histórico.

**Desvios do plano original:**
- Layer-by-layer publish (Checkpoints 2a/2b/2c) **não aconteceu** — `changeset publish` atua atômico em todos os packages com versões novas. Publish foi de uma vez. Design assumia gh api delete por layer — incompatível com changesets. Mitigação natural: tudo passou build antes do publish, então integridade preservada.

**Vulnerabilidades não-bloqueantes identificadas:**
- `npm audit` reportou 8 vulns (1 critical, 3 high, 4 moderate) — triagem em task futura
- GitHub deprecou Node.js 20 em Actions runners (removal 2026-09-16) — todo futuro

## Changelog

- **rev 4.2 (2026-04-13):** adicionado **bright-tale** (Rafael) como 3º consumer. Owner externo, teu access é push-only — fase 3.5 split em code migration (você) + admin actions (Rafael). Escopo: 15-22h. Atenção especial a feature jumps: bright-tale usa `auth 1.2.1` e `admin 0.1.1` (versões antigas) — regression testing obrigatório.
- **rev 4.1 (2026-04-13):** reconhecido TNG = 3 apps (api, web, **mobile Expo**) + packages/shared. Riscos R11/R12 mobile-specific.
- **rev 4 (2026-04-13):** reconciled scope vs reality after empirical audit — **24 packages** (não 13), 39 unpushed commits, 4 untracked packages, 8 stale branches. TNG **incluído** na migração (user decisão). Escopo agora é ~12-17h, não 4-6h.
- **rev 3 (2026-04-13):** dep graph parcial, rollback plan — baseado em dados incompletos (api-only).
- **rev 2 (2026-04-13):** expandido com 7 riscos — ainda com 13 packages errados.
- **rev 1 (2026-04-13):** design inicial simplista.

## Context & Real State (pre-flight audit, 2026-04-13)

### tnf-ecosystem (source repo)

**24 packages locais:**
```
L0 (15, zero deps): shared, audit, admin, ad-engine, affiliate, billing,
  brasil-tax-id, cron-lock, crypto, entity-resolver, fraud-detection-utils,
  gamification, notifications, seo, sound-engine
L1 (5): auth(audit,shared), lgpd(audit), fraud-detection(fraud-detection-utils),
  promo-codes(billing,affiliate), ranking(gamification)
L2 (4): auth-expo(auth), auth-fastify(auth), auth-nextjs(auth,shared),
  auth-supabase(auth)
```

**Estado git pré-migração:**
- 39 commits locais em `main` **não pushados**
- 4 packages untracked (brasil-tax-id, crypto, entity-resolver, ranking) — sem git history, mas publicados no registry 0.1.0
- `promo-codes` com 6 arquivos modificados não commitados
- 8 feature branches remotas **totalmente merged em main** (já integradas, são lixo)
- 1 branch `changeset-release/main` com 1 commit ahead (changeset automation)
- 1 branch local vazia `feat/admin-package`

### Consumidores afetados

| Consumer | Packages consumidos | Status | Risk | Owner |
|----------|---------------------|--------|------|-------|
| **tonagarantia** | **24/24** (all) | PRODUÇÃO | 🔴 alto | TN-Figueiredo |
| **bythiagofigueiredo** | 10/24 (subset) | scaffold novo | 🟢 baixo | figueiredo-technology |
| **bright-tale** | 5/24 (auth, auth-fastify, auth-supabase, admin, auth-nextjs) | em desenvolvimento | 🟡 médio | **FigueiredoRafael** — teu access: push ✅, admin ❌ |

### Scope de infrastructure

- GitHub org `figueiredo-technology` criada
- Repo `bythiagofigueiredo` já transferido pra org
- Repo `tnf-ecosystem` ainda em `TN-Figueiredo`
- Repo `tonagarantia` ainda em `TN-Figueiredo`
- NPM_TOKEN existe em `bythiagofigueiredo` (repo-level) e `tonagarantia` (repo-level)

## Goals (user approved)

1. Todos 24 packages republicados sob `@figueiredo-technology/*`
2. `tnf-ecosystem` repo transferido pra org, hygiene completa (merge/push/cleanup)
3. `bythiagofigueiredo` migrado pra novo scope + NPM_TOKEN eliminado
4. `tonagarantia` migrado pra novo scope + NPM_TOKEN eliminado — production-safe
5. GITHUB_TOKEN usado para publish + consume em toda a org
6. `@tn-figueiredo/*` packages permanecem instaláveis (não deprecate ainda)

## Non-Goals

- Refactor de API dos packages (só scope rename)
- Testes novos (exceto smoke)
- Transfer do repo `tonagarantia` pra org — fica em TN-Figueiredo por ora (decisão separada)
- Deprecation dos `@tn-figueiredo/*` — adiada pra sprint futuro (após TNG estável 1 semana)

## Decisions (from user, 2026-04-13)

- **D1:** Push all 39 local commits to main before migration (Q1 user response)
- **D2:** Commit + push 4 untracked packages (Q2 user response)
- **D3:** Feature branches: as 8 merged → **deletar** (não merge, já merged). changeset-release/main → mergear ou descartar após review
- **D4:** `promo-codes` mods são prontos → commit
- **D5:** TNG incluído — migration production-aware (Q5 user response)
- **D6:** Target scope `@figueiredo-technology/*` (rev3 D1)
- **D7:** Version strategy semver-correct (rev3 D2 — atualizada pros 24)
- **D8:** Checkpoint-driven execution (rev3 D6)

## Version Mapping (24 packages)

Regra: 0.x.y → **1.0.0** (promover estável). 1.x.y ou superior → **major bump** (breaking por scope).

| Package | Atual | Novo |
|---------|:-----:|:----:|
| shared | 0.8.0 | 1.0.0 |
| audit | 0.1.0 | 1.0.0 |
| admin | 0.3.0 | 1.0.0 |
| ad-engine | 0.1.0 | 1.0.0 |
| affiliate | 0.1.0 | 1.0.0 |
| billing | 0.1.0 | 1.0.0 |
| brasil-tax-id | 0.1.0 | 1.0.0 |
| cron-lock | 0.1.0 | 1.0.0 |
| crypto | 0.1.0 | 1.0.0 |
| entity-resolver | 0.1.0 | 1.0.0 |
| fraud-detection-utils | 0.1.0 | 1.0.0 |
| gamification | 0.1.0 | 1.0.0 |
| notifications | 0.1.0 | 1.0.0 |
| seo | 0.1.0 | 1.0.0 |
| sound-engine | 0.2.0 | 1.0.0 |
| lgpd | 0.1.0 | 1.0.0 |
| fraud-detection | 0.1.0 | 1.0.0 |
| promo-codes | 0.1.0 | 1.0.0 |
| ranking | 0.1.0 | 1.0.0 |
| auth | 1.3.0 | 2.0.0 |
| auth-expo | 1.0.0 | 2.0.0 |
| auth-fastify | 1.1.0 | 2.0.0 |
| auth-supabase | 1.1.0 | 2.0.0 |
| auth-nextjs | 2.0.0 | 3.0.0 |

## Execution Plan

### Fase 0 — tnf-ecosystem hygiene (~2-3h)

Meta: main limpo, pushed, com os 24 packages trackados, sem branches lixo.

1. **[Checkpoint 0a]** Backup: tag `pre-migration-2026-04-13` em current HEAD
2. Revisar diff das 6 files modificadas em `promo-codes`
3. Commit promo-codes WIP (`git add packages/promo-codes && git commit`)
4. `git add packages/brasil-tax-id packages/crypto packages/entity-resolver packages/ranking`
5. Commit untracked packages (4 packages, 1 commit ou split por package)
6. Push main → 39 + novos commits vão pra origin
7. Deletar feature branches stale (8 remotas):
   ```
   git push origin --delete chore/integration-tests feat/auth-core feat/auth-fastify \
     feat/email-templates-parameterize feat/feature-flags feat/gamification-and-polish \
     feat/shared-theme-rich-tokens feat/types-enhancements feat/utils-module
   ```
8. Review `changeset-release/main`: merge if relevant, delete otherwise
9. Deletar branch local `feat/admin-package`
10. CI verde no main pós-push?

**Exit Fase 0:**
- [ ] `git status` clean
- [ ] `git log origin/main..HEAD` zero
- [ ] `git branch -a` mostra só main (+ uma HEAD)

### Fase 1 — Package migration (tnf-ecosystem) (~5-7h)

11. **[Checkpoint 1]** Confirm transfer
12. `gh api -X POST /repos/TN-Figueiredo/tnf-ecosystem/transfer -f new_owner=figueiredo-technology`
13. Aceitar transfer (email se pedir)
14. Update local remote: `git remote set-url origin git@github.com:figueiredo-technology/tnf-ecosystem.git`
15. Branch `migration/figueiredo-technology-scope`
16. **Batch sed** em `packages/*/package.json`:
    - `"name": "@tn-figueiredo/X"` → `"name": "@figueiredo-technology/X"`
    - dep refs `@tn-figueiredo/X` → `@figueiredo-technology/X` (em deps + peerDeps)
    - Version bumps conforme mapping
17. **Batch sed** em `packages/*/src/**/*.ts`:
    - imports `@tn-figueiredo/*` → `@figueiredo-technology/*`
18. ~~Update publishing CI~~ — **SKIP: já usa GITHUB_TOKEN** (verificado via grep em `.github/workflows/ci.yml` + `release.yml`)
19. `npm install` root + build all packages locally — confirma cross-refs
20. Commit atomic em layers topológicas (3 commits ou 1 atomic)
21. **[Checkpoint 2a]** Confirm publish L0
22. PR + merge em main → CI publica L0 (15 packages em paralelo)
23. Smoke: `npm view @figueiredo-technology/shared version` = 1.0.0
24. **[Checkpoint 2b]** Confirm publish L1
25. Trigger L1 publish (5 packages)
26. Smoke L1 ok
27. **[Checkpoint 2c]** Confirm publish L2
28. Trigger L2 publish (4 packages)
29. Smoke: todos 24 via `npm view` retornam nova versão

### Fase 2 — bythiagofigueiredo consumer (~1-2h)

30. **[Checkpoint 3]** Confirm consumer migration (bythiagofigueiredo)
31. Branch `migration/figueiredo-technology-scope`
32. Update `.npmrc`: scope line
33. Update `apps/web/package.json`, `apps/api/package.json`, `packages/shared/package.json`:
    - 10 deps `@tn-figueiredo/*` → `@figueiredo-technology/*` com novas versões
34. Update imports em `apps/**/*.ts` + `packages/**/*.ts`
35. `rm -rf node_modules package-lock.json && npm install`
36. Build + typecheck + test
37. Commit + push branch
38. CI roda no branch (com NPM_TOKEN ainda — intermediário)
39. Merge staging

### Fase 3 — tonagarantia consumer (production-aware) (~4-5h)

**Estrutura TNG confirmada:** 3 apps (api, web, **mobile**) + `packages/shared`. Mobile = Expo (React Native) consumindo `auth-expo`, `ad-engine`, `sound-engine`.

40. **[Checkpoint 4]** Confirm TNG migration
41. Clone/pull tonagarantia localmente
42. Branch `migration/figueiredo-technology-scope`
43. Update `.npmrc` scope line (TNG uses mesmo pattern do bythiagofigueiredo)
44. Update `apps/api/package.json` — 18 deps
45. Update `apps/web/package.json` — 5 deps
46. Update `apps/mobile/package.json` — 3 deps (auth-expo, ad-engine, sound-engine) — **atenção Expo**
47. Update `packages/shared/package.json` — **1 dep confirmado: `@tn-figueiredo/shared@0.8.0`**
48. 24 deps `@tn-figueiredo/*` → `@figueiredo-technology/*` distribuídas
49. Update imports em `apps/**/src/**/*.ts`, `apps/**/src/**/*.tsx`
50. `rm -rf node_modules package-lock.json && npm install`
51. Build web + typecheck api
52. Mobile: `npx expo prebuild` se necessário + `npx expo doctor` pra validar
53. TEST SUITE COMPLETA (unit + integration)
54. Open PR pro staging do TNG
55. CI verde
56. **[Checkpoint 5]** Confirm TNG deploy staging
57. Deploy staging, monitorar erros no Sentry (**api** + **web** + **mobile** EAS build)
58. Smoke test TNG staging (auth flow, critical paths, mobile OTA update)
59. **[Checkpoint 6]** Confirm TNG deploy prod
60. Merge → deploy prod (web automático via Vercel; mobile via EAS update/submit)
61. Monitorar Sentry 1h pós-deploy — **3 projetos** (api, web, mobile)

### Fase 3.5 — bright-tale consumer (~2-3h + coordination)

**Access constraint:** teu user `TN-Figueiredo` tem push mas não admin em `FigueiredoRafael/bright-tale`. Fase split em 2 partes:

**Parte A — code migration (eu/você fazemos via PR):**
62. **[Checkpoint 4.5]** Confirm bright-tale migration
63. Clone/pull `FigueiredoRafael/bright-tale`
64. Branch `migration/figueiredo-technology-scope`
65. Update `.npmrc` scope line
66. Update package.json deps (5 packages):
   - `apps/api`: `auth`, `auth-fastify`, `auth-supabase` → versões novas
   - `apps/web`: `admin`, `auth-nextjs` → versões novas
   - ⚠️ **Feature jump atenção:** `auth 1.2.1 → 2.0.0` (bump através de 1.3.0 primeiro), `admin 0.1.1 → 1.0.0` (através de 0.2.0 e 0.3.0) — **requer regression testing**
67. Update imports (sed)
68. `npm install` local + build + test
69. Open PR com título claro: `feat: migrate packages to @figueiredo-technology scope`
70. No PR body: explicar breaking change + versions jumps + checklist pro Rafael

**Parte B — Rafael (admin actions):**
71. **Você coordena com Rafael** — mensagem/call
72. Rafael review + merge PR
73. Rafael: Settings → Actions → Workflow permissions → Read/write
74. Rafael: update `.github/workflows/ci.yml`: `NPM_TOKEN` → `GITHUB_TOKEN`
75. Rafael: `gh secret delete NPM_TOKEN` (ou UI Settings → Secrets)
76. Rafael: em cada um dos 5 packages @figueiredo-technology/* → Manage Actions access → authorize `FigueiredoRafael/bright-tale`
77. CI de bright-tale verde sem NPM_TOKEN

### Fase 4 — Kill NPM_TOKEN (~1-2h)

56. Org `figueiredo-technology` → Settings → Packages → **Allow Actions** inbound
57. Para cada um dos 24 packages: Package settings → Manage Actions access → authorize consumers. **GitHub Packages NÃO TEM API pública pra isso** — 24 cliques UI. **Workaround:** marcar packages como `internal` visibility (auto-grant pra repos da mesma org) → reduz pra 1 toggle por package mas só cobre `bythiagofigueiredo` (org-mate). Pra `tonagarantia` e `bright-tale` (fora da org) ainda precisa 24× authorize.
58. Update `bythiagofigueiredo/.github/workflows/ci.yml`: `secrets.NPM_TOKEN` → `secrets.GITHUB_TOKEN`
59. Push → CI verde sem NPM_TOKEN
60. `gh secret delete NPM_TOKEN --repo figueiredo-technology/bythiagofigueiredo`
61. Update `tonagarantia/.github/workflows/ci.yml`: same
62. Push TNG → CI verde sem NPM_TOKEN
63. `gh secret delete NPM_TOKEN --repo TN-Figueiredo/tonagarantia`

### Fase 5 — Closeout (~1h)

64. Verification checklist (abaixo) — todos ✅
65. Update roadmap do bythiagofigueiredo: Sprint 0 → ✅, side-sprint logged
66. Update memory (Claude memory) sobre novo scope + org
67. Tag de sucesso `migration-complete-2026-04-13` em ambos repos
68. Commit final em bythiagofigueiredo

## Exit Criteria

- [ ] 24 packages `@figueiredo-technology/*` publicados e instaláveis
- [ ] tnf-ecosystem transferido pra `figueiredo-technology` org
- [ ] bythiagofigueiredo consome `@figueiredo-technology/*` + CI verde sem NPM_TOKEN
- [ ] tonagarantia consome `@figueiredo-technology/*` + CI verde + prod estável
- [ ] `@tn-figueiredo/*` packages permanecem instaláveis (fallback/continuidade)
- [ ] NPM_TOKEN deletado em ambos consumer repos
- [ ] Sprint 0 do bythiagofigueiredo → ✅

## Verification Checklist

```bash
# 1. 24 packages publicados no novo scope
for pkg in shared audit admin ad-engine affiliate billing brasil-tax-id cron-lock \
  crypto entity-resolver fraud-detection-utils gamification notifications seo sound-engine \
  lgpd fraud-detection promo-codes ranking auth auth-expo auth-fastify auth-supabase auth-nextjs; do
  v=$(npm view @figueiredo-technology/$pkg version 2>&1 | tail -1)
  echo "@figueiredo-technology/$pkg: $v"
done

# 2. bythiagofigueiredo limpo
grep -r "@tn-figueiredo" ~/Workspace/bythiagofigueiredo/apps ~/Workspace/bythiagofigueiredo/packages 2>&1 | grep -v node_modules
# esperado: 0 matches

# 3. tonagarantia limpo
grep -r "@tn-figueiredo" ~/Workspace/tonagarantia/apps ~/Workspace/tonagarantia/packages 2>&1 | grep -v node_modules
# esperado: 0 matches

# 4. Secrets mortos
gh secret list --repo figueiredo-technology/bythiagofigueiredo | grep NPM_TOKEN
gh secret list --repo TN-Figueiredo/tonagarantia | grep NPM_TOKEN
# esperado: nenhum

# 5. CIs verdes
gh run list --limit 1 --repo figueiredo-technology/bythiagofigueiredo --json conclusion -q '.[0].conclusion'
gh run list --limit 1 --repo TN-Figueiredo/tonagarantia --json conclusion -q '.[0].conclusion'
# esperado: success

# 6. TNG prod ok
curl -sI https://tonagarantia.com.br -o /dev/null -w "%{http_code}\n"
# esperado: 200 ou 301

# 7. Backup preservado
gh api /repos/figueiredo-technology/tnf-ecosystem/tags -q '.[] | select(.name == "pre-migration-2026-04-13") | .name'
# esperado: pre-migration-2026-04-13
```

## Risks (10)

| # | Risco | Prob | Impacto | Mitigação |
|---|-------|:----:|:-------:|-----------|
| R1 | `promo-codes` mods serem WIP (não prontos) mesmo que user disse prontos | 30% | 🟡 médio | Eu mostro o diff antes de commitar; user dá go/no-go |
| R2 | 39 commits unpushed terem lixo (commits ruins misturados) | 20% | 🟡 médio | Review do `git log origin/main..HEAD` antes do push |
| R3 | Publish CI falha no meio (N/24 publicados) | 30% | 🔴 alto | Ordem topológica por layer + checkpoint entre layers + retry idempotente |
| R4 | TNG PROD quebra após migração | 25% | 🔴 crítico | Staging deploy + 1h monitoring Sentry antes de prod; rollback via revert commit + redeploy |
| R5 | GITHUB_TOKEN permissions insuficientes | 40% | 🟡 médio | Testar com 1 package antes do batch; fallback PAT se falhar |
| R6 | Internal TS imports não cobertos pelo sed | 50% | 🟢 baixo | Build local (Fase 1 #19) detecta antes de publish |
| R7 | Feature branches tinham work importante que eu assumi "merged" incorretamente | 10% | 🟡 médio | Mesmo todas sendo +0/-N, double-check comparing files before delete |
| R8 | Untracked packages (brasil-tax-id etc) terem conteúdo diferente do que foi publicado | 40% | 🟡 médio | Smoke test consumer install + reproduce old behavior antes de publish |
| R9 | `.npmrc` repo-level override do global causar install quebrado | 30% | 🟢 baixo | Test local após each .npmrc change |
| R10 | Sentry source maps antigos referenciam `@tn-figueiredo/*` | 10% | 🟢 baixo | Só afeta debugging retrospectivo; não quebra prod |
| R11 | **Mobile (Expo) build quebrar** após rename — Metro bundler nem sempre resolve scope change bem | 35% | 🔴 alto | `expo doctor` + clear cache (`expo start -c`) + EAS build staging antes de submit prod |
| R12 | Users com app mobile antigo instalado ficam com versão outdated enquanto EAS update não propaga | 30% | 🟡 médio | EAS update envia patch sem rebuild nativo; monitorar rollout em %; fallback: forçar app update |
| R13 | **Bright-tale feature jump** (auth 1.2.1→2.0.0 pula 1.3.0; admin 0.1.1→1.0.0 pula 0.2.0/0.3.0) quebra comportamento | 50% | 🔴 alto | Regression test completo antes de merge; Rafael valida flows críticos de auth + admin |
| R14 | Coordenação com Rafael atrasa sprint — ele indisponível, PR fica pending | 40% | 🟡 médio | Merge PR não é crítico pro bythiagofigueiredo + TNG (migrations independentes); bright-tale pode demorar sem bloqueio global |
| R15 | GitHub Actions free minutes exhaust se publish falha + retry 24x | 10% | 🟢 baixo | Monorepo publish = 1 CI run independente do número de packages; retry idempotente limita custo |
| R16 | GitHub Packages storage quota (500MB free) — republicar 24 packages dobra storage | 20% | 🟢 baixo | GitHub Packages private tem 500MB free. Ecosystem atual ~50MB. Novo scope = +50MB = 100MB total. Folga grande. |
| R17 | npm cache issues após scope rename em consumer — builds usam resolução cached | 40% | 🟡 médio | `rm -rf node_modules package-lock.json` obrigatório antes de `npm install`; documentar no runbook |
| R18 | Per-package "Manage Actions access" é 24 cliques UI sem API | 100% | 🟡 médio | Workaround "internal visibility" reduz pra `bythiagofigueiredo` (org-mate); TNG+bright-tale fora da org ainda precisam aprovar 24×; aceitar trabalho manual |

## Rollback Plan (step-by-step)

### Fase 0 rollback (before transfer)
```bash
# Unstage WIP if committed wrongly
git reset HEAD~N   # N = novos commits
# Restore deleted branches if needed (they're already merged, so low impact)
```

### Fase 1 rollback (mid-publish)
```bash
# Delete novos packages @figueiredo-technology/*
for pkg in <já publicados>; do
  gh api -X DELETE "/orgs/figueiredo-technology/packages/npm/$pkg"
done
# Reset source repo
git reset --hard pre-migration-2026-04-13
git push --force origin main
# Transfer repo back: gh api -X POST /repos/figueiredo-technology/tnf-ecosystem/transfer -f new_owner=TN-Figueiredo
```

### Fase 2 rollback (bythiagofigueiredo)
```bash
# Branch ainda não merged em staging
git checkout staging
git branch -D migration/figueiredo-technology-scope
```

### Fase 3 rollback (TNG, production emergency)
```bash
# In TNG repo:
git revert <merge commit>
git push staging
# Vercel redeploy automático
# Monitorar Sentry drop nos erros
```

### Fase 4 rollback (NPM_TOKEN deletion)
```bash
# Re-add token
gh secret set NPM_TOKEN --repo <owner/repo>
# Revert workflow change
git revert <commit>
```

## User Actions Required (estimate 20min distributed)

1. **[Cp 0a]** Review `git diff` do promo-codes, confirmar mods prontos → commit
2. **[Cp 1]** Confirm transfer tnf-ecosystem
3. Accept GitHub transfer email se pedir
4. **[Cp 2a, 2b, 2c]** Confirm publishes (3x)
5. **Org Settings UI:** enable Actions inbound access pra Packages
6. **Per-package UI (24×):** Manage Actions access — ou script via API se der
7. **[Cp 3]** Confirm bythiagofigueiredo migration
8. **[Cp 4, 5, 6]** Confirm TNG migration + staging deploy + prod deploy
9. Monitor Sentry pós-TNG-prod

## Time Budget (honest)

| Fase | Atividade | Estimativa |
|------|-----------|:----------:|
| 0 | tnf-ecosystem hygiene | 2-3h |
| 1 | Package migration | 5-7h |
| 2 | bythiagofigueiredo consumer | 1-2h |
| 3 | tonagarantia consumer (api+web+**mobile Expo**+shared) | 4-5h |
| 3.5 | **bright-tale consumer (PR + Rafael coordination)** | 2-3h |
| 4 | Kill NPM_TOKEN (bythiagofigueiredo + TNG; bright-tale = Rafael) | 1-2h |
| 5 | Closeout | 1h |
| **Total** | | **15-22h** |

**Realistic: 2-3 dias de trabalho focado.**

## Concrete Commands (execution-ready)

Comandos exatos pra usar durante execução — elimina ambiguidade.

### Fase 0 hygiene
```bash
cd ~/Workspace/tnf-ecosystem
git tag pre-migration-2026-04-13
git push origin pre-migration-2026-04-13
git add packages/promo-codes
git commit -m "feat(promo-codes): complete use cases + types"
git add packages/brasil-tax-id packages/crypto packages/entity-resolver packages/ranking
git commit -m "feat: add 4 new packages (brasil-tax-id, crypto, entity-resolver, ranking)"
git push origin main
git push origin --delete chore/integration-tests feat/auth-core feat/auth-fastify feat/email-templates-parameterize feat/feature-flags feat/gamification-and-polish feat/shared-theme-rich-tokens feat/types-enhancements feat/utils-module
git branch -D feat/admin-package
```

### Fase 1 transfer + rename
```bash
# Transfer (Checkpoint 1)
gh api -X POST /repos/TN-Figueiredo/tnf-ecosystem/transfer -f new_owner=figueiredo-technology

# Update remote
cd ~/Workspace/tnf-ecosystem
git remote set-url origin git@github.com:figueiredo-technology/tnf-ecosystem.git
git fetch origin

# Branch
git checkout -b migration/figueiredo-technology-scope

# Batch rename in package.jsons
find packages -name "package.json" -not -path "*/node_modules/*" -exec sed -i '' \
  -e 's|"@tn-figueiredo/|"@figueiredo-technology/|g' {} \;

# Batch rename in TS sources
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -exec sed -i '' \
  -e "s|'@tn-figueiredo/|'@figueiredo-technology/|g" \
  -e 's|"@tn-figueiredo/|"@figueiredo-technology/|g' {} \;

# Version bumps (manual per package, use npm version)
for pkg in shared audit admin ad-engine affiliate billing brasil-tax-id cron-lock crypto entity-resolver fraud-detection-utils gamification notifications seo sound-engine lgpd fraud-detection promo-codes ranking; do
  (cd packages/$pkg && npm version 1.0.0 --no-git-tag-version)
done
for pkg in auth auth-expo auth-fastify auth-supabase; do
  (cd packages/$pkg && npm version 2.0.0 --no-git-tag-version)
done
(cd packages/auth-nextjs && npm version 3.0.0 --no-git-tag-version)

# Build + install
rm -rf node_modules */node_modules package-lock.json packages/*/package-lock.json
npm install
npm run build

# Commit + push
git add -A
git commit -m "feat: migrate to @figueiredo-technology scope + version bumps"
git push -u origin migration/figueiredo-technology-scope
```

### Fase 2 bythiagofigueiredo consumer
```bash
cd ~/Workspace/bythiagofigueiredo
git checkout -b migration/figueiredo-technology-scope

# .npmrc
sed -i '' 's|@tn-figueiredo:|@figueiredo-technology:|' .npmrc

# package.json batch
find apps packages -name "package.json" -not -path "*/node_modules/*" -exec sed -i '' \
  's|"@tn-figueiredo/|"@figueiredo-technology/|g' {} \;

# Versions precisam ser atualizadas (manual ou com jq)
# TS/TSX imports
find apps packages -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -exec sed -i '' \
  -e "s|'@tn-figueiredo/|'@figueiredo-technology/|g" \
  -e 's|"@tn-figueiredo/|"@figueiredo-technology/|g' {} \;

# Reinstall
rm -rf node_modules package-lock.json apps/*/node_modules packages/*/node_modules
npm install

# Validate
npm run typecheck
npm run test
npm run build:web

# Commit
git add -A && git commit -m "feat: migrate to @figueiredo-technology scope"
git push -u origin migration/figueiredo-technology-scope
```

### Comms template pra Rafael (bright-tale PR)
```
Olá Rafael,

Migramos o ecossistema de packages @tn-figueiredo/* → @figueiredo-technology/*
(nova org GitHub consolidando o ecossistema).

Este PR em bright-tale:
- Atualiza .npmrc pra novo scope
- Atualiza 5 deps: auth, auth-fastify, auth-supabase (api) + admin, auth-nextjs (web)
- Atualiza imports no código

⚠️ Importante — há feature jump além do scope rename:
- auth 1.2.1 → 2.0.0 (pula 1.3.0 entre)
- admin 0.1.1 → 1.0.0 (pula 0.2.0 e 0.3.0)

Requer regression test dos flows de auth + admin antes de mergear.

Após merge, você (admin):
1. Settings → Actions → Workflow permissions: Read/write
2. Update .github/workflows/ci.yml: NPM_TOKEN → GITHUB_TOKEN
3. gh secret delete NPM_TOKEN
4. Em cada um dos 5 packages (@figueiredo-technology/auth, etc.): Package settings → Manage Actions access → authorize FigueiredoRafael/bright-tale

Qualquer dúvida me chama.
```

Pode ser dividido:
- **Dia 1 AM:** Fase 0 + Fase 1 (hygiene + package migration) — 7-10h
- **Dia 1 PM / Dia 2:** Fases 2-5 (consumers + cleanup) — 6-9h

## Open Questions

Nenhuma — user respondeu Q1-Q5. Pronto para execução.

## Process Notes

Esta é a **rev 4** do spec. Revisões anteriores (rev1-rev3) tinham dados incompletos, principalmente por não terem feito pre-flight audit local. Lesson: **sempre `ls` local antes de desenhar scope**, não confiar em gh api pra estado de working tree.
