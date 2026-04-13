# Design: Ecosystem Migration — `@tn-figueiredo/*` → `@figueiredo-technology/*`

**Date:** 2026-04-13
**Status:** Approved (rev 4 — empirically accurate scope)
**Type:** Cross-repo sprint (NÃO é side-sprint — é ~12-17h de trabalho)
**Repos afetados:** `tnf-ecosystem`, `tonagarantia`, `bythiagofigueiredo`

## Changelog

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

| Consumer | Packages consumidos | Status | Risk |
|----------|---------------------|--------|------|
| **tonagarantia** | **24/24** (all) | PRODUÇÃO | 🔴 alto |
| **bythiagofigueiredo** | 10/24 (subset) | scaffold novo | 🟢 baixo |

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
18. Update publishing CI (`.github/workflows/publish*.yml`): NPM_TOKEN → GITHUB_TOKEN
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

### Fase 3 — tonagarantia consumer (production-aware) (~3-4h)

40. **[Checkpoint 4]** Confirm TNG migration
41. Clone/pull tonagarantia localmente
42. Branch `migration/figueiredo-technology-scope`
43. Update `.npmrc` + package.json de todos workspaces (apps/api, apps/web, apps/mobile se existir, packages/*)
44. 24 deps `@tn-figueiredo/*` → `@figueiredo-technology/*`
45. Update imports (mesma sed de Fase 2, escalado)
46. `rm -rf node_modules package-lock.json && npm install`
47. Build + typecheck + TEST SUITE COMPLETA
48. Open PR pro staging do TNG
49. CI verde
50. **[Checkpoint 5]** Confirm TNG deploy staging
51. Deploy staging, monitorar erros no Sentry
52. Smoke test TNG staging (auth flow, critical paths)
53. **[Checkpoint 6]** Confirm TNG deploy prod
54. Merge → deploy prod
55. Monitorar Sentry 1h pós-deploy

### Fase 4 — Kill NPM_TOKEN (~1-2h)

56. Org `figueiredo-technology` → Settings → Packages → **Allow Actions** inbound
57. Para cada um dos 24 packages: Package settings → Manage Actions access → authorize `figueiredo-technology/bythiagofigueiredo` + `TN-Figueiredo/tonagarantia` (scriptar via API se possível)
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
| 3 | tonagarantia consumer (prod) | 3-4h |
| 4 | Kill NPM_TOKEN | 1-2h |
| 5 | Closeout | 1h |
| **Total** | | **13-19h** |

**Realistic: 2 dias de trabalho focado.**

Pode ser dividido:
- **Dia 1 AM:** Fase 0 + Fase 1 (hygiene + package migration) — 7-10h
- **Dia 1 PM / Dia 2:** Fases 2-5 (consumers + cleanup) — 6-9h

## Open Questions

Nenhuma — user respondeu Q1-Q5. Pronto para execução.

## Process Notes

Esta é a **rev 4** do spec. Revisões anteriores (rev1-rev3) tinham dados incompletos, principalmente por não terem feito pre-flight audit local. Lesson: **sempre `ls` local antes de desenhar scope**, não confiar em gh api pra estado de working tree.
