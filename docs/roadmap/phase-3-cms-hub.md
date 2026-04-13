← [Roadmap overview](README.md)

# Fase 3 — CMS Hub Distribution [☐ not-started]

**Sprints:** 10–11 · **Horas:** 70h · **Semanas:** 3
**Estimativa de entrega:** ~final de Julho 2026
**Depende de:** Fase 1 completa (`@tnf/cms` publicado). Fase 2 recomendada (`@tnf/email` facilita notificações cross-site, mas não bloqueia).
**Bloqueia:** integração de blog em outros sites do ecossistema (TNG, DevToolKit, etc.)

**Goal:** Transformar `bythiagofigueiredo` no hub "OneRing" que distribui posts para N sites. Admin único, N consumidores.

**Escopo — o que está incluído:**
- Schema + UI de distribuição no hub (este repo)
- API route `/api/v1/posts`
- **Um** site consumidor de referência (TNG) para validar o contrato

**Escopo — o que NÃO está incluído (fora deste roadmap):**
- Trabalho no repo do TNG para consumir a API — tracked no roadmap do TNG
- Onboarding de outros sites (DevToolKit, CreatorForge, etc.) — ~2h cada, sob demanda

## Exit criteria (Fase 3 → DONE)

- [ ] Tabelas `sites` e `post_sites` em produção com RLS verificada
- [ ] Admin editor mostra checkboxes de distribuição e overrides por site
- [ ] `GET /api/v1/posts?site={slug}` retornando JSON válido com cache
- [ ] E2E test cobrindo fluxo completo (create → distribute → consume)
- [ ] Docs permitindo outro dev integrar um novo site em <2h
- [ ] Contrato de API v1 publicado (semver discipline)

---

## Sprint 10 — CMS Hub Distribution [☐ not-started] (40h)

**Goal:** Sites registry + `post_sites` junction + API route + preparo de integração TNG.
**Estimativa:** semanas 17–18

**Epics** (soma = 40h):
- [ ] `sites` table CRUD no admin (slug, name, domain, primary_lang, config JSONB) — 4h
- [ ] `post_sites` junction — migration + checkboxes no post editor (featured, custom slug/excerpt) — 8h
- [ ] `blog_posts.is_hub_only` flag + UX no editor — 2h
- [ ] API route `GET /api/v1/posts?site={slug}&limit&offset` com cache 1h — 6h
- [ ] RLS policies para distribuição cross-site (por `site_id`) — 4h
- [ ] API docs + exemplos de consumo (3 opções: API route, Supabase direct, RSC) — 4h
- [ ] TNG integration handoff — docs + sample query + sanity check (handoff pro roadmap TNG) — 4h
- [ ] Tests — junction integrity, API contract, cache invalidation — 8h

**Deliverables:**
- Editor de post com checkboxes de distribuição funcionando
- `GET /api/v1/posts?site=bythiagofigueiredo` em produção retornando JSON
- Handoff doc pro TNG consumir (trabalho do TNG fica no roadmap dele)

**Spec / Plan:** —

---

## Sprint 11 — Burnout & Docs [☐ not-started] (30h)

**Goal:** E2E tests, docs completas, setup pronto para próximos consumers.
**Estimativa:** semana 19
**Tipo:** Burnout sprint

**Epics** (soma = 30h):
- [ ] E2E tests — create → distribute → verify em N sites (Playwright) — 8h
- [ ] CMS Hub documentation — README `@tnf/cms`, exemplos de integração, contrato API v1 — 8h
- [ ] DevToolKit consumer setup (registrar na tabela `sites`, smoke test) — 2h
- [ ] Performance tests — 100 concurrent requests, p95 <200ms — 4h
- [ ] Bug fixes + polish — 8h

**Deliverables:**
- E2E suite cobrindo distribuição
- Docs que permitem integrar novo site em <2h

**Spec / Plan:** —

---

## 🎉 Phase 3 Complete

bythiagofigueiredo é o CMS hub do ecossistema. **Total do projeto: 424h em 19 semanas.**

Próximos passos pós-Fase 3 (fora deste roadmap):
- Registrar cada novo site na tabela `sites` (~2h cada): CreatorForge, TravelCalc, CalcHub, MEISimples
- Features 🟢 Luxo e 🔵 Pós-Launch conforme demanda (ver `03-roadmap-creator.md` Etapa 3)

## Riscos específicos da fase

- **R4 — CMS Hub API adoption** (45%, 🟢 baixo) — TNG pode rejeitar o design. Mitigação: TNG eng review antes da S10; fallback direto via Supabase; iterate com feedback.
- **R3 — RLS policies cross-site** (50%, 🟡 médio) — loopholes com visibilidade. Mitigação: test suite dedicada por `site_id`; audit log por query.

## Notas

- Fase 3 é onde o ROI do `@tnf/cms` se concretiza. Cada site novo ~2h.
- Se Fase 3 atrasar, bythiagofigueiredo continua funcional standalone — não bloqueia nada crítico.
