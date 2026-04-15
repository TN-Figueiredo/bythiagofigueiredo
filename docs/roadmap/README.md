# bythiagofigueiredo — Roadmap

> Hub Pessoal + CMS Engine ("OneRing") do ecossistema @tnf/*
> **Source of truth de execução:** este diretório.
> **Rationale de produto e scoring:** `~/Workspace/ideias/bythiagofigueiredo/` (docs 01–05, 2026-04-12).

**Versão:** 2026-04-13 · **Revisão:** 2 (numbers reconciled, exit criteria added)

## Visão macro

| Fase | Sprints | Horas | Semanas | Status | Arquivo |
|------|:-------:|:-----:|:-------:|:------:|---------|
| **1 — MVP** | 0–5 | 202h | 9 | 🟡 in-progress | [phase-1-mvp.md](phase-1-mvp.md) |
| **2 — Nice-to-Have** | 6–9 | 152h | 7 | ☐ not-started | [phase-2-nice-to-have.md](phase-2-nice-to-have.md) |
| **3 — CMS Hub Distribution** | 10–11 | 70h | 3 | ☐ not-started | [phase-3-cms-hub.md](phase-3-cms-hub.md) |
| **Total** | 11 | **424h** | **19** | | |

> **Nota sobre totais:** source doc (`03-roadmap-creator.md`) reporta agregado de **414h / 192h Fase 1**. Somando sprint-a-sprint (12+40+42+40+38+30) dá **202h** na Fase 1 / 424h total. Variação de 10h atribuída a arredondamento de calibração. **Este roadmap usa os valores per-sprint como autoridade de execução.**

**Estimativa de timeline:** 19 semanas a partir de 2026-04-13 (~final de Julho 2026, antes da viagem pra Ásia ~Agosto). Datas absolutas em cada fase são **estimativas**, sujeitas à velocidade real.

**Capacidade planejada:** 40h/week com burnout sprint (30h) a cada 4 sprints.

## Progresso global

```
▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~3% (12h / 424h — Sprint 0 ✅ done)
```

**Done até agora:**
- Sprint 0 ✅ — scaffold + CI + Supabase provisionado/linkado + Vercel/Sentry env vars + npm scripts de DB padrão TNG (~12h).
- Sprint 1a ✅ — blog schema, RLS, homepage, API setup, `site_visible` helper (2026-04-14).
- Sprint 1b ✅ — campaigns schema/RLS, Brevo+Turnstile libs, landing pages, cron, seed (2026-04-14, merged PR #3, 135 tests).
- Sprint 2 ✅ — `@tn-figueiredo/cms` package, multi-ring schema, blog MDX rendering, admin CRUD (2026-04-15, merged PR #4, 198 tests). T14 extraction deferred to Sprint 3.
- Sprint 3 ✅ — auth + invite flow, newsletter/contact forms + cron sync, campaign admin CRUD, PostEditor polish (autosave/meta SEO/cover/locale switcher/delete UI), rate limiting + cron locks. ~40 commits. Epic audit trajectory: Epic 3 82→98, Epic 4 62→99, Epic 5 82→99, sprint-wide 93→99. Package extraction (T14) + observability/LGPD carry-over ⇒ Sprint 4. Spec: [2026-04-16-sprint-3-design.md](../superpowers/specs/2026-04-16-sprint-3-design.md).

**Sprint ativo:** Sprint 4 (package extraction + observability + LGPD — ~40h) — 🟡 **in progress (partial ship — Epics 8+9+10 ready; 6+7 package extraction carry-over)**. Spec: [sprint-4.md](../superpowers/specs/sprint-4.md).

## Legenda de status

```
☐ not-started    🟡 in-progress    ✅ done    ⏸ blocked    ❌ cancelled
```

Aplicada em 3 níveis: fase, sprint, epic.

## Packages novos a nascer deste projeto

Entregáveis de ecossistema — reutilizáveis em outros apps @tnf/*:

| Package | Sprint | Horas | Fase | ROI estimado |
|---------|:------:|:-----:|:----:|:------------:|
| **@tnf/cms** (NEW) | S2 | 24h | 1 | ~60h poupadas em 5+ sites |
| **@tnf/email** (NEW — setup em S3, extract em S7) | S3 + S7 | 6h + 8h | 1+2 | ~48h em 6+ apps |
| **@tnf/storage** (NEW) | S8 | 10h | 2 | ~24h em 6+ apps |

## Como usar este roadmap (workflow superpowers)

Quando for hora de executar um sprint:

1. **Brainstorm** → `superpowers:brainstorming`
   - Gera spec em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
2. **Plan** → `superpowers:writing-plans`
   - Gera plano em `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md`
3. **Execute** → `superpowers:executing-plans` ou `superpowers:subagent-driven-development`
4. **Atualize o roadmap:**
   - Flip status do sprint/epic: ☐ → 🟡 → ✅
   - Adicione links `Spec:` e `Plan:` no campo do sprint
   - Commit: `docs(roadmap): close sprint N — <resumo>`

## Estrutura do diretório

```
docs/
├── roadmap/
│   ├── README.md              ← você está aqui
│   ├── phase-1-mvp.md
│   ├── phase-2-nice-to-have.md
│   └── phase-3-cms-hub.md
└── superpowers/
    ├── specs/                 ← design docs por milestone
    └── plans/                 ← implementation plans por milestone
```

## Context de produto (resumo)

**O que é:**
1. Site pessoal profissional (homepage, bio, portfolio, social)
2. Blog engine bilíngue (MDX + translations PT/EN)
3. Campaign & lead capture (newsletter, UTM tracking)
4. CMS Engine que distribui posts para N sites do ecossistema

**Stack:** Next.js 15, React 19, Tailwind 4, Fastify 5, Supabase, Brevo, Vercel, Turnstile, GTM.

**Reuso:** 9 de 13 packages @tnf/* aplicáveis (69%) + 3 packages novos (`@tnf/cms`, `@tnf/email`, `@tnf/storage`).

## Riscos globais (top 3 do source doc, Etapa 5)

| # | Risco | Prob | Impacto | Sprint | Mitigação |
|---|-------|:----:|:-------:|:------:|-----------|
| R1 | Sanity → Supabase migration complexity | 60% | 🔴 alto | S2–S3 | Script testado local; PortableText renderer como fallback; backup Sanity |
| R2 | @tnf/cms design first-time | 55% | 🟡 médio | S2+ | Interface-first; versionamento 0.x; TNG integration valida design |
| R5 | Thiago's availability (life events, YouTube) | 50% | 🔴 alto | transversal | Burnout sprint a cada 4; content batching; clear MVP finish line |

Lista completa de 9 riscos: `~/Workspace/ideias/bythiagofigueiredo/03-roadmap-creator.md` Etapa 5.

## Review cadence

- **Fim de cada sprint:** flip status, adicionar links Spec/Plan, commit `docs(roadmap): close sprint N`.
- **Fim de cada fase:** revalidar exit criteria, atualizar changelog abaixo, considerar se próxima fase precisa re-scoping.
- **Trimestral ou em mudança de contexto:** revisar riscos globais, confrontar estimativas vs realidade.

## Changelog

- **2026-04-13 rev2:** matemática de horas reconciliada, exit criteria por fase, rollup de packages, progresso corrigido, riscos linkados ao source.
- **2026-04-13 rev1:** versão inicial.

## Side-sprint update — 2026-04-13

- Package Ecosystem Migration iniciada
- Fase 0 (tnf-ecosystem hygiene): ✅ done
- Fase 1 (package migration): ✅ done — 23/24 packages em `@figueiredo-technology/*` (auth-expo mantido private)
- Spec: [2026-04-13-package-migration-to-figueiredo-technology-design.md](../superpowers/specs/2026-04-13-package-migration-to-figueiredo-technology-design.md)
- Fases restantes: 2 (bythiagofigueiredo) → 3 (TNG prod) → 3.5 (bright-tale) → 4 (kill NPM_TOKEN) → 5 (closeout)
