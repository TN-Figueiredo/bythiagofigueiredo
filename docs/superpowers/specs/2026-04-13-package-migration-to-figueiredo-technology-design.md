# Design: Package Ecosystem Migration — `@tn-figueiredo/*` → `@figueiredo-technology/*`

**Date:** 2026-04-13
**Status:** Approved (rev 3)
**Type:** Side-sprint (entre Sprint 0 e Sprint 1 do roadmap bythiagofigueiredo)
**Estimated effort:** 4–6h

## Changelog

- **rev 3 (2026-04-13):** gap analysis — adicionado dep graph empírico (gh api), rollback step-by-step, decisão sobre relação com Sprint 0 (bloqueia fechamento até CI verde sem NPM_TOKEN).
- **rev 2 (2026-04-13):** expandido após crítica — 7 riscos, exit criteria, verification checklist, version strategy corrigida, ordem topológica explícita.
- **rev 1 (2026-04-13):** design inicial — poucos riscos, sem exit criteria.

## Context

Durante Sprint 0 do bythiagofigueiredo, user decidiu migrar os packages do ecossistema do user account `TN-Figueiredo` para a nova org `figueiredo-technology`, com objetivo de:
1. Consolidar identidade: ecossistema inteiro sob uma org
2. **Eliminar `NPM_TOKEN`** no CI trocando por `GITHUB_TOKEN` automático
3. Habilitar Organization-level governance (audit, permissions, secrets)

Todos os 13 packages vivem num único monorepo `TN-Figueiredo/tnf-ecosystem`.

## Goals

1. Transferir `tnf-ecosystem` → `figueiredo-technology/tnf-ecosystem`
2. Republicar todos os 13 packages sob scope `@figueiredo-technology/*`
3. Migrar consumer `bythiagofigueiredo` para o novo scope
4. Configurar `GITHUB_TOKEN` read access para packages do org
5. Deletar `NPM_TOKEN` secret em `bythiagofigueiredo`
6. Fechar Sprint 0 do bythiagofigueiredo junto com este sprint

## Non-Goals

- Migração do **tonagarantia** (em produção — risco alto, sprint próprio)
- Deprecation dos `@tn-figueiredo/*` antigos (fora deste sprint; fazer após bythiagofigueiredo estável por 1 semana)
- Alterar comportamento ou API dos packages (só rename de scope)

## Decisions

### D1 — Scope target: `@figueiredo-technology/*`

**Chosen:** matches org name exatamente.
**Alternatives rejeitadas:**
- `@tnf/*` — `tnf` username GitHub já tomado
- `@tn-figueiredo/*` + transfer só source — GITHUB_TOKEN do org repo não publica no namespace user

### D2 — Version strategy por mapping

Bump reflete semver correto considerando estado atual de cada package:

| Package | Atual | Novo | Tipo |
|---------|:-----:|:----:|------|
| shared | 0.8.0 | 1.0.0 | promover estável |
| audit | 0.1.0 | 1.0.0 | promover estável |
| admin | 0.2.0 (ou 0.3.0 se published) | 1.0.0 | promover estável |
| ad-engine | 0.1.0 | 1.0.0 | promover estável |
| notifications | 0.1.0 | 1.0.0 | promover estável |
| seo | 0.1.0 | 1.0.0 | promover estável |
| sound-engine | 0.2.0 | 1.0.0 | promover estável |
| lgpd | 0.1.0 | 1.0.0 | promover estável |
| auth | 1.3.0 | 2.0.0 | major (breaking scope) |
| auth-fastify | 1.1.0 | 2.0.0 | major (breaking scope) |
| auth-supabase | 1.1.0 | 2.0.0 | major (breaking scope) |
| auth-expo | 1.0.0 | 2.0.0 | major (breaking scope) |
| auth-nextjs | 2.0.0 | 3.0.0 | major (breaking scope) |

**Pré-migração:** verificar versão publicada atual em GitHub Packages (pode diferir do source main).

### D3 — Internal refs: bump all together (atomic)

Package A (dep) + Package B (depends on A) migram no mesmo commit. Internal refs em `dependencies`/`peerDependencies` atualizam para o novo scope + nova versão.

### D4 — Execution order: transfer → rename → publish topológico → migrate consumer → kill NPM_TOKEN

Ver seção "Execution Plan" abaixo.

### D5 — Include all 13 packages (including `auth-expo` e `sound-engine`)

Mesmo que `bythiagofigueiredo` não consuma os 13, migrar parcialmente deixa o monorepo em estado inconsistente. Custo marginal zero (mesmo sed batch).

### D6 — Checkpoint-driven execution

4 checkpoints humanos:
1. Antes de transferir repo
2. Antes de publish Layer 0
3. Antes de migrar consumer
4. Antes de deletar NPM_TOKEN

Reduz blast radius de erros irreversíveis.

### D7 — Sprint 0 fica 🟡 até este sprint fechar

Sprint 0 do bythiagofigueiredo tem blocker "NPM_TOKEN no GitHub Actions". Como vamos eliminar NPM_TOKEN, adicionar + deletar em 4h seria retrabalho. Melhor: side-sprint fecha o Sprint 0 ao terminar.

## Dependency Graph (empírico via `gh api`)

```
Layer 0 (zero @tn-figueiredo deps — publica em paralelo):
  shared         (0.8.0)
  audit          (0.1.0)
  admin          (0.2.0)
  ad-engine      (0.1.0)
  notifications  (0.1.0)
  seo            (0.1.0)
  sound-engine   (0.2.0)

Layer 1 (depende de L0):
  auth           (1.3.0)  → audit + shared
  lgpd           (0.1.0)  → audit

Layer 2 (depende de L1):
  auth-expo      (1.0.0)  → auth
  auth-fastify   (1.1.0)  → auth
  auth-nextjs    (2.0.0)  → auth + shared
  auth-supabase  (1.1.0)  → auth
```

Publish em ordem de layer. Dentro de cada layer, paralelização OK.

## Execution Plan

### Fase 1 — Transfer + Rename (~30min)

1. Tag `pre-migration-2026-04-13` em `TN-Figueiredo/tnf-ecosystem` (backup)
2. **[Checkpoint 1]** Confirm transfer
3. `gh api -X POST repos/TN-Figueiredo/tnf-ecosystem/transfer -f new_owner=figueiredo-technology`
4. Aceitar transfer se pedir confirmação email
5. Update local clone remote: `git remote set-url origin git@github.com:figueiredo-technology/tnf-ecosystem.git`
6. Branch `migration/figueiredo-technology-scope`
7. Batch sed em `packages/*/package.json`:
   - `"name": "@tn-figueiredo/X"` → `"name": "@figueiredo-technology/X"`
   - dependency refs `@tn-figueiredo/X` → `@figueiredo-technology/X`
   - Version bumps conforme D2 mapping
8. Batch sed em `packages/*/src/**/*.ts`:
   - `from '@tn-figueiredo/X'` → `from '@figueiredo-technology/X'`
9. Atualizar CI workflow (`.github/workflows/publish.yml`): NPM_TOKEN → GITHUB_TOKEN
10. `npm install` local + `npm run build` para confirmar que cross-refs resolvem
11. Commit em layers (7 commits de Layer 0, 2 de Layer 1, 4 de Layer 2) — ou 1 commit atomic

### Fase 2 — Publish topológico (~45min)

12. **[Checkpoint 2]** Confirm publish
13. Push branch → abre PR ou merge direto em main
14. CI de publish dispara — publica Layer 0 em paralelo (7 packages)
15. Smoke: `npm view @figueiredo-technology/shared version` retorna 1.0.0
16. Se L0 ok, trigger manual/auto para Layer 1 (auth, lgpd)
17. Smoke L1 ok → Layer 2 (auth-expo, auth-fastify, auth-nextjs, auth-supabase)
18. Final smoke: todos 13 retornam via `npm view`

### Fase 3 — Migrate consumer (bythiagofigueiredo) (~1h)

19. **[Checkpoint 3]** Confirm consumer migration
20. Branch `migration/figueiredo-technology-scope` em `bythiagofigueiredo`
21. `.npmrc`:
    - `@tn-figueiredo:registry=...` → `@figueiredo-technology:registry=https://npm.pkg.github.com`
    - `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` → mantém (local dev precisa)
22. `apps/web/package.json` + `apps/api/package.json` + `packages/shared/package.json`:
    - Renomear todas `@tn-figueiredo/*` → `@figueiredo-technology/*` com novas versões
23. Sed em `apps/*/src/**/*.ts` + `packages/*/src/**/*.ts`:
    - Imports `@tn-figueiredo/*` → `@figueiredo-technology/*`
24. `rm -rf node_modules package-lock.json`
25. `npm install`
26. Build: `npm run build:web` + `npm run typecheck -w apps/api`
27. Smoke: `npm run test`
28. Commit + push branch → CI roda com NPM_TOKEN temporariamente

### Fase 4 — Kill NPM_TOKEN (~30min)

29. **[Checkpoint 4]** Confirm kill
30. Configurar Org Settings → Packages → Allow Actions inbound
31. Per-package "Manage Actions access": autorizar `figueiredo-technology/bythiagofigueiredo` para todos 13 packages
32. Update `.github/workflows/ci.yml` do bythiagofigueiredo: trocar `secrets.NPM_TOKEN` por `secrets.GITHUB_TOKEN`
33. Push → CI re-roda
34. Verificar CI verde sem NPM_TOKEN
35. `gh secret delete NPM_TOKEN --repo figueiredo-technology/bythiagofigueiredo`
36. Merge branch em staging
37. Verify final CI verde na staging

### Fase 5 — Closeout

38. Atualizar roadmap: Sprint 0 → ✅, side-sprint logged
39. Update spec com outcomes
40. Update memory se aplicável
41. Commit "sprint-0 + package migration closed"

## Exit Criteria

- [ ] 13 packages `@figueiredo-technology/*` publicados, acessíveis via `npm view`
- [ ] bythiagofigueiredo `.npmrc`, `package.json` (3 arquivos) e TS imports referenciam novo scope
- [ ] `grep -r "@tn-figueiredo" apps/ packages/` retorna 0 matches
- [ ] CI do bythiagofigueiredo verde sem `NPM_TOKEN` no workflow
- [ ] `gh secret list` em bythiagofigueiredo não retorna `NPM_TOKEN`
- [ ] `@tn-figueiredo/*` packages continuam instaláveis (TNG não quebra)
- [ ] Sprint 0 do roadmap bythiagofigueiredo flipado para ✅

## Verification Checklist

```bash
# 1. Todos 13 packages publicados em @figueiredo-technology/*?
for pkg in shared audit admin ad-engine notifications seo sound-engine lgpd auth auth-expo auth-fastify auth-nextjs auth-supabase; do
  echo -n "@figueiredo-technology/$pkg: "
  npm view @figueiredo-technology/$pkg version 2>&1 | head -1
done

# 2. bythiagofigueiredo sem refs antigas
grep -r "@tn-figueiredo" /Users/figueiredo/Workspace/bythiagofigueiredo/apps /Users/figueiredo/Workspace/bythiagofigueiredo/packages 2>&1 | grep -v node_modules | grep -v .git
# esperado: nenhum match

# 3. CI verde?
cd /Users/figueiredo/Workspace/bythiagofigueiredo
gh run list --limit 1 --json conclusion -q '.[0].conclusion'
# esperado: success

# 4. NPM_TOKEN eliminado?
gh secret list --repo figueiredo-technology/bythiagofigueiredo | grep NPM_TOKEN
# esperado: nenhum match

grep -r "NPM_TOKEN" /Users/figueiredo/Workspace/bythiagofigueiredo/.github/
# esperado: nenhum match (ou só referências histórias comentadas)

# 5. TNG ainda vivo?
curl -sI https://tonagarantia.com.br -o /dev/null -w "%{http_code}"
# esperado: 200 ou 301

# 6. @tn-figueiredo/* ainda instalável (TNG continuity)?
npm view @tn-figueiredo/auth version
# esperado: algum numero (prova que GitHub redirect funciona)
```

Todos ✅ = side-sprint + Sprint 0 do bythiagofigueiredo = DONE.

## Risks (7)

| # | Risco | Prob | Impacto | Mitigação |
|---|-------|:----:|:-------:|-----------|
| R1 | Publish CI falha deixando N/13 publicados | 30% | 🔴 alto | ordem topológica + retry idempotente + checkpoint humano antes de L0 |
| R2 | TNG quebra durante janela | 20% | 🔴 alto | não tocar em TNG; `@tn-figueiredo/*` mantém via redirect do GitHub |
| R3 | bythiagofigueiredo Vercel auto-deploy durante migração | 30% | 🟡 médio | trabalhar em branch feature; não merge até Fase 4 completa |
| R4 | GITHUB_TOKEN permissions insuficientes pra ler packages | 40% | 🟡 médio | testar com 1 package (shared) antes do batch; fallback para PAT se necessário |
| R5 | Internal TS imports não cobertos pelo sed | 50% | 🟢 baixo | build local (Fase 1 passo 10) detecta antes de publish |
| R6 | `.npmrc` repo-level override do global | 30% | 🟢 baixo | testar `npm install` local após rename |
| R7 | Sentry source maps antigos referenciam `@tn-figueiredo/*` | 10% | 🟢 baixo | só afeta debugging retrospectivo; não quebra prod |

## Rollback Plan (step-by-step)

### Rollback durante Fase 1 (pre-publish)
```bash
git checkout main
git branch -D migration/figueiredo-technology-scope
# se quiser reverter transfer: gh api -X POST repos/figueiredo-technology/tnf-ecosystem/transfer -f new_owner=TN-Figueiredo
```

### Rollback durante Fase 2 (mid-publish, N/13 publicados)
```bash
# Opção A: completar mesmo assim (publicações antigas @tn-figueiredo continuam válidas)
# Opção B: deletar publicações parciais
for pkg in <lista dos publicados>; do
  gh api -X DELETE /orgs/figueiredo-technology/packages/npm/$pkg
done
# Reset monorepo
git reset --hard pre-migration-2026-04-13
git push --force origin main
```

### Rollback durante Fase 3 (consumer migration)
```bash
# bythiagofigueiredo branch ainda não mergeada
git checkout staging
git branch -D migration/figueiredo-technology-scope
# packages novos ficam publicados mas não consumidos — ok, não bloqueia nada
```

### Rollback durante Fase 4 (kill NPM_TOKEN)
```bash
# re-adicionar NPM_TOKEN
gh secret set NPM_TOKEN --repo figueiredo-technology/bythiagofigueiredo
# reverter workflow
git revert <commit do workflow change>
```

### Nuclear rollback (nada funciona)
- Transfer repo back: `gh api -X POST repos/figueiredo-technology/tnf-ecosystem/transfer -f new_owner=TN-Figueiredo`
- Deprecate `@figueiredo-technology/*` publicados (via `gh api` delete)
- bythiagofigueiredo reverter para commit pre-migração
- Sprint 0 segue com NPM_TOKEN tradicional

## User Actions Required

1. **[Checkpoint 1]** Confirm transfer no chat
2. Aceitar email de transfer do GitHub se vier (pode não vir se teu token tem scope admin:org)
3. **[Checkpoint 2]** Confirm publish
4. **Org Settings → Packages → Allow Actions inbound** (UI)
5. **Per-package Manage Actions access** — 13 toggles (UI); alternativamente script via API
6. **[Checkpoint 3]** Confirm consumer migration
7. **[Checkpoint 4]** Confirm NPM_TOKEN delete

**Total user time estimado:** ~10min distribuídos em 4 momentos.

## Generated Artifacts

Ao final:
- Este spec em `docs/superpowers/specs/`
- Plan em `docs/superpowers/plans/` (gerado via `writing-plans`)
- Commits estruturados em 2 repos (tnf-ecosystem + bythiagofigueiredo)
- Roadmap atualizado refletindo side-sprint

## Lessons Learned (a validar pós-execução)

- Monorepo facilita migração vs N repos separados
- Scope change = breaking change sempre; version major obrigatório
- Checkpoint-driven execution reduz rework em falhas
- GITHUB_TOKEN > PAT quando tudo vive na mesma org
