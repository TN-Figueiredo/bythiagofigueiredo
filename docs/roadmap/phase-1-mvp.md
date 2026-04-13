← [Roadmap overview](README.md)

# Fase 1 — MVP [🟡 in-progress]

**Sprints:** 0–5 · **Horas:** 202h · **Semanas:** 9
**Estimativa de entrega:** ~início de Junho 2026 (9 semanas a partir de 2026-04-13, sujeito a velocidade real)
**Depende de:** nada (entry point)
**Bloqueia:** Fase 3 integralmente. Parcialmente Fase 2 (portfolio content pode começar antes se desejado).

**Goal:** Entregar `bythiagofigueiredo.com` ao vivo com blog bilíngue, admin, newsletter, LGPD, deploy em produção.

## Exit criteria (Fase 1 → DONE)

- [ ] `bythiagofigueiredo.com` resolvendo via DNS com SSL válido
- [ ] ≥4 blog posts publicados (mix PT+EN)
- [ ] Admin panel funcional: Thiago consegue criar/editar/publicar post end-to-end
- [ ] Newsletter signup → welcome email chegando (staging testado em produção)
- [ ] Contact form respondendo com reply via email
- [ ] `/privacy`, `/terms`, cookie banner, delete account flow ao vivo
- [ ] Lighthouse mobile ≥80, LCP <2.5s
- [ ] Sentry capturando erros em produção
- [ ] CI verde em `main` (typecheck + tests + audit + secret-scan)

---

## Sprint 0 — Infraestrutura [🟡 in-progress] (12h)

**Goal:** Monorepo, Supabase project, CI rodando.

**Epics** (soma = 12h):
- [x] Monorepo skeleton (tnf-scaffold) — apps/web + apps/api + packages/shared (6h)
- [x] GitHub Actions CI workflow — typecheck, test, audit, secret-scan (2h) ⚠️ *CI runs falhando por falta de `NPM_TOKEN` secret — ver blocker B1 no spec*
- [x] Supabase project remoto + `.env.local` + Vercel env vars + Sentry projects (4h) — *executado, spec escrito post-facto*

**Blockers pra flip a ✅:**
- [ ] 🔴 **B1:** adicionar `NPM_TOKEN` em GitHub Actions secrets (user action)
- [ ] 🟡 **B2:** confirmar DB password salvo em keychain (user action)
- [ ] 🟡 **B3:** rodar `npx supabase link --project-ref novkqtvcnsiwhkxihurk` (user action)

**Spec:** [`2026-04-13-sprint-0-supabase-setup-design.md`](../superpowers/specs/2026-04-13-sprint-0-supabase-setup-design.md)
**Plan:** — (Sprint 0 é setup manual, não implementação code — não passa por `writing-plans`)

---

## Sprint 1 — MVP Foundation [☐ not-started] (40h)

**Goal:** Auth ativa, schema inicial, homepage estática, API respondendo.
**Estimativa:** semanas 2–3
**Depende de:** Sprint 0

**Epics** (soma = 40h):
- [ ] Homepage hub polish (hero, bio, portfolio grid, social links, footer já existem via scaffold; falta copy final + integração com blog link) — 6h
- [ ] Blog schema no Supabase (`blog_posts`, `blog_translations`) + indexes — 4h
- [ ] Supabase RLS policies iniciais (public read, admin write) — 3h
- [ ] Admin auth middleware (@tnf/auth-nextjs) — 3h
- [ ] Fastify API setup (@tnf/auth-fastify + logging + `/health`) — 6h
- [ ] Campaign schema (`campaigns`, `campaign_submissions`) — 2h
- [ ] Campaign system adapt (Sanity → Supabase) — 12h
- [ ] Buffer / integração de copy — 4h

**Deliverables:**
- Homepage ao vivo em dev
- Tabelas blog + campaign no Supabase
- Admin redireciona para login se não autenticado
- `GET /health` respondendo

**Spec / Plan:** —

---

## Sprint 2 — CMS & Blog [☐ not-started] (42h)

**Goal:** `@tnf/cms` package criado, blog MVP renderizando, admin shell, início da migração Sanity.
**Estimativa:** semanas 4–5
**Depende de:** Sprint 1
**Risco alto:** R1 (Sanity migration, 60%) — começa aqui, termina em S3

**Epics** (soma = 42h):
- [ ] **@tnf/cms package (NEW)** — interfaces (IPostRepository, IDistributionService), base implementation — 24h
- [ ] Blog CRUD server actions (list, detail, publish/unpublish) + Zod — 8h
- [ ] MDX renderer (Shiki + KaTeX + TOC + reading time) — 4h
- [ ] Admin UI shell (@tnf/admin sidebar, dark mode) — 4h
- [ ] Sanity data export + schema mapping (início da migração) — 2h

**Deliverables:**
- `@tnf/cms@0.x` publicado (versão de design)
- `/blog` e `/blog/[slug]` renderizando posts MDX
- Script de export Sanity rodando localmente

**Cross-sprint:** Sanity migration completa em S3 (+20h).

**Spec / Plan:** —

---

## Sprint 3 — Admin & Forms [☐ not-started] (40h)

**Goal:** Migração Sanity completa, admin CRUD, newsletter/contact capturando leads.
**Estimativa:** semanas 6–7
**Depende de:** Sprint 2

**Epics** (soma = 40h):
- [ ] Sanity data import + asset migration (conclusão, carry de S2) — 12h
- [ ] Admin login page (email + senha + Turnstile) — 3h
- [ ] Blog editor admin (título, slug, MDX editor, tags, publish/draft) — 8h
- [ ] Campaign manager admin CRUD — 6h
- [ ] **@tnf/email setup (NEW)** — IEmailService + Brevo adapter + welcome email — 6h
- [ ] Newsletter subscribe form + confirm email — 3h
- [ ] Contact form + LGPD consent checkbox — 2h

**Deliverables:**
- Todos os posts Sanity migrados (ou >95% com lista de exceções)
- Thiago consegue publicar post via admin
- Subscribe em newsletter → welcome email chega
- Contact form → reply via email

**Spec / Plan:** —

---

## Sprint 4 — LGPD & Deployment [☐ not-started] (38h)

**Goal:** Compliance LGPD, SEO, testes, deploy em staging.
**Estimativa:** semanas 7–8
**Depende de:** Sprint 3

**Epics** (soma = 38h):
- [ ] Privacy policy + Terms of Service + cookie banner — 7h
- [ ] Delete account flow (@tnf/lgpd) — 4h
- [ ] Data export (GDPR/LGPD) — 3h
- [ ] SEO completo — metadata, sitemap, robots, JSON-LD (@tnf/seo) — 9h
- [ ] Testes — unit (API) + integration (DB/RLS) + E2E auth flow — 13h
- [ ] Vercel (web) + Railway/Render (api) deploy + secrets — 2h

**Deliverables:**
- `/privacy`, `/terms` ao vivo
- Delete account end-to-end testado
- Staging preview URL no Vercel funcionando
- Lighthouse mobile ≥80 em staging

**Spec / Plan:** —

---

## Sprint 5 — Burnout & MVP Launch [☐ not-started] (30h)

**Goal:** Polish final e go-live.
**Estimativa:** semana 9
**Depende de:** Sprint 4
**Tipo:** Burnout sprint

**Epics** (soma = 30h):
- [ ] Bug fixes — 15h
- [ ] Performance tuning (LCP <2.5s, CLS <0.1, bundle) — 10h
- [ ] Launch checklist (DNS, SSL, Brevo DNS, GTM, Search Console, launch comms) — 5h

**Deliverables:**
- `bythiagofigueiredo.com` ao vivo
- Newsletter enviada pros subs iniciais
- YouTube video de launch (EN + PT)

**Spec / Plan:** —

---

## 🎉 Phase 1 Complete

Ao fechar Sprint 5: MVP está no ar. Próximo marco é Fase 2 (N2H) com folga.

## Critical path (Fase 1)

Sequência mínima para chegar no MVP (do source doc, ~69h):

```
Sprint 0: Monorepo (6h) + Supabase project (4h)       [10h]
    ↓
Sprint 1: Auth middleware (3h) + Blog schema (4h)     [ 7h]
    ↓
Sprint 2: @tnf/cms (24h) + Blog CRUD (8h)             [32h]
    ↓
Sprint 3: Admin login/editor (11h)                    [11h]
    ↓
Sprint 4: Tests + deploy (15h)                        [15h]
    ↓
Sprint 5: Launch checklist (5h)                       [ 5h]
                                                  Total 80h
```

Demais 122h são paralelizáveis ou não-bloqueantes.

## Riscos específicos da fase

Referência aos IDs do source doc (Etapa 5):

- **R1 — Sanity → Supabase migration** (60% prob, 🔴 alto) — Sprint 2–3
- **R2 — @tnf/cms design first-time** (55%, 🟡 médio) — Sprint 2+
- **R3 — RLS policies complexity** (50%, 🟡 médio) — Sprint 1–2
- **R7 — Vercel deployment (monorepo)** (25%, 🟡 médio) — Sprint 4–5
- **R8 — Content calendar slips** (60%, 🟢 baixo) — posts podem ser menos que 4 no launch

Mitigações detalhadas em `03-roadmap-creator.md` Etapa 5.
