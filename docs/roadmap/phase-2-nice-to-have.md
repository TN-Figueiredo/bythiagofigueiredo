← [Roadmap overview](README.md)

# Fase 2 — Nice-to-Have [☐ not-started]

**Sprints:** 6–9 · **Horas:** 152h · **Semanas:** 7
**Estimativa de entrega:** ~final de Junho 2026
**Depende de:** Fase 1 principalmente. Portfolio content (Sprint 6) pode ser drafted em paralelo com Fase 1 sem bloquear MVP.
**Bloqueia:** parcialmente Fase 3 — `@tnf/email` (S7) é recomendado antes da distribuição cross-site, mas não obrigatório.

**Goal:** Enriquecer o site com portfolio, YouTube hub, AI translations, analytics. Extrair `@tnf/email` e `@tnf/storage` como packages do ecossistema.

## Exit criteria (Fase 2 → DONE)

- [ ] `/portfolio` e `/youtube` ao vivo com case studies e embeds
- [ ] AI translations ativas — post PT gera draft EN (review humano antes de publish)
- [ ] `@tnf/email@1.0` publicado e consumido pelo bythiagofigueiredo
- [ ] `@tnf/storage@1.0` publicado
- [ ] Analytics dashboard funcional no admin
- [ ] RSS feed `/feed.xml` válido
- [ ] p95 <200ms em blog list (com caching)

---

## Sprint 6 — Portfolio & YouTube Hub [☐ not-started] (40h)

**Goal:** Portfolio, YouTube hub, transcripts pesquisáveis.
**Estimativa:** semanas 10–11

**Epics** (soma = 40h):
- [ ] Portfolio page (`/portfolio`) + project showcases (3–5 apps) — 16h
- [ ] YouTube hub (`/youtube`) — playlist embeds EN+PT + latest + CTA — 6h
- [ ] Video transcripts — fetch YouTube API, store Supabase, full-text search — 12h
- [ ] RSS feed (`/feed.xml`, Atom 1.0) — 4h
- [ ] Twitter/X share widget — 2h

**Spec / Plan:** —

---

## Sprint 7 — Translations & Email [☐ not-started] (42h)

**Goal:** AI translations, `@tnf/email` extraído, newsletter segmentada.
**Estimativa:** semanas 12–13

**Epics** (soma = 42h):
- [ ] AI-assisted translations (Claude API / DeepL) — auto-draft on publish — 16h
- [ ] **@tnf/email package (NEW — extract)** — generalizar Brevo integration, interface + adapter, publicar — 8h
- [ ] Advanced newsletter segmentation (EN/PT, tags comportamentais) — 6h
- [ ] Email template variants + A/B testing (Brevo native) — 6h
- [ ] Email-to-RSS sync (subs escolhem formato) — 4h
- [ ] Telegram channel integration (bot) — 2h

**Spec / Plan:** —

---

## Sprint 8 — Analytics & Storage [☐ not-started] (40h)

**Goal:** Analytics dashboard, `@tnf/storage`, image optimization, media manager.
**Estimativa:** semanas 14–15

**Epics** (soma = 40h):
- [ ] **@tnf/storage package (NEW)** — Supabase Storage wrapper (upload, getPublicUrl, getSignedUrl, delete, optimização) — 10h
- [ ] Media manager admin UI (upload, browse, delete) — 8h
- [ ] Subscriber dashboard (list, segmentação, export CSV) — 6h
- [ ] Analytics dashboard (@tnf/admin + Recharts) — 10h
- [ ] Image optimization (Next Image + WebP + lazy) — 6h

**Spec / Plan:** —

---

## Sprint 8.5 — Feature Flag Consolidation [☐ not-started] (~12h)

**Goal:** Migrar env-var-based feature flags pra sistema DB-driven consistente com padrão de kill switches usado em outros projetos (ex: tonagarantia). Permite flip instantâneo (sem 60s de Vercel redeploy) pra flags emergenciais + scope per-site quando multi-ring.

**Motivação:** Sprint 5a (LGPD) e Sprint 5b (SEO) shipou 9 feature flags como env vars (`NEXT_PUBLIC_LGPD_BANNER_ENABLED`, `NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED`, `NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED`, `LGPD_CRON_SWEEP_ENABLED`, `NEXT_PUBLIC_SEO_JSONLD_ENABLED`, `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED`, `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED`, `SEO_SITEMAP_KILLED`, `SEO_AI_CRAWLERS_BLOCKED`). Flags emergenciais (`SEO_SITEMAP_KILLED`, `LGPD_CRON_SWEEP_ENABLED`) sofrem com TTR de 60s em incidente. Multi-ring futuro quer scope per-site.

**Pre-study (required before sprint execution):**
- [ ] Auditar flags existentes em tonagarantia: tabela schema, admin UI pattern, cache strategy, audit log
- [ ] Decidir entre rolling de zero vs package reutilizável (`@tn-figueiredo/feature-flags` extraction candidate)
- [ ] Definir SLA de flag invalidação (Next cache revalidate vs Redis vs direct query)
- [ ] Decidir admin UI location (`/admin/feature-flags`) + RBAC (só super_admin, ou org_admin pode flipar site-scoped?)

**Epics (soma = 12h, ajustar após pre-study):**
- [ ] Schema + migrations (`feature_flags` table: key/enabled/scope/site_id/description/updated_at/updated_by + audit trigger) — 2h
- [ ] Core lib `@tn-figueiredo/feature-flags` OR local `apps/web/lib/feature-flags/` (TBD by pre-study) — 4h
- [ ] Migrar 9 flags de env → DB (mantém env var como fallback pra cold-start resilience) — 3h
- [ ] Admin UI `/admin/feature-flags` (list, toggle, scope selector, audit view) — 2h
- [ ] Runbook update: flip instructions via SQL + via admin UI — 1h

**Trade-offs conhecidos:**
- +1 DB round-trip por page render (mitigado por `unstable_cache` + tag invalidation 30-60s)
- Sobrevive a DB outage? Adicionar fallback read from env var quando DB inacessível
- Preview deploys: flip pra true/false em preview sem tocar prod? Scope `environment` ou branch matching

**Deliverables:**
- Todos 9 flags flipáveis via SQL ou admin UI sem redeploy
- Audit log de todos os flips (who + when + from→to)
- Runbook documenta dois caminhos: env-var (legacy, cold-start fallback) + DB (primary, instant flip)

**Spec / Plan:** pendente — abrir brainstorming antes do sprint.

---

## Sprint 9 — Burnout & CMS Hub Prep [☐ not-started] (30h)

**Goal:** Polish da Fase 2 + preparar terreno pra Fase 3.
**Estimativa:** semana 16
**Tipo:** Burnout sprint

**Epics** (soma = 30h):
- [ ] Bug fixes + performance — 12h
- [ ] Caching strategy (stale-while-revalidate + Redis em `/api/posts`) — 6h
- [ ] Bundle analysis + cleanup — 2h
- [ ] Content calendar + bulk publish admin — 7h
- [ ] CMS Hub design review (contract `/api/v1/posts`, `post_sites` interface) — 3h

**Deliverables extras:**
- Draft do contrato de API pronto pra review pelo TNG
- p95 <200ms em blog list

**Spec / Plan:** —

---

## 🎉 Phase 2 Complete

Site enriquecido, 3 packages novos publicados (`@tnf/cms`, `@tnf/email`, `@tnf/storage`). Pronto pra distribuir conteúdo cross-site.

## Riscos específicos da fase

- **R6 — Brevo service reliability** (20%, 🟡 médio) — Sprint 7. Mitigação: `@tnf/email` abstração permite swap; retry + circuit breaker.
- **AI translations quality** (não listado no source) — ruim trava SEO. Mitigação: sempre humano-review antes de publicar.

## Notas

- Todas as features são opcionais — atrasos não bloqueiam Fase 3 nem impactam MVP ao vivo.
- Content calendar (S9) é chave para o período da viagem pra Ásia (batching de posts).
