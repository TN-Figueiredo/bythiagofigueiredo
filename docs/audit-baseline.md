# Audit Baseline — bythiagofigueiredo

> Atualizado pelo `/audit`. Historico via `git log docs/audit-baseline.md`.
> Formato machine-parseable — NAO alterar headers ou formato das tabelas.

## Ultimo Audit
- **Data:** 2026-05-14
- **Escopo:** all
- **Foco:** all
- **Score Total:** 8/10
- **Ultimo Finding ID:** BTF-049

| Categoria | Criticos | Altos | Medios | Baixos | Score |
|-----------|----------|-------|--------|--------|-------|
| Cobertura Testes | 0 | 0 | 3 | 0 | 7/10 |
| TypeScript Safety | 0 | 0 | 0 | 0 | 8/10 |
| Seguranca | 0 | 0 | 0 | 0 | 8/10 |
| LGPD | 0 | 1 | 0 | 0 | 8/10 |
| Data Leaks | 0 | 0 | 0 | 0 | 9/10 |

## Findings Abertos
| ID | Severidade | Categoria | Descricao | Arquivo |
|----|-----------|-----------|-----------|---------|
| BTF-021 | ALTO | LGPD Art.7 | Social integrations sem consentimento granular | apps/web/src/app/api/social/oauth/[provider]/callback/route.ts |
| BTF-037 | MEDIO | Testes | 4 crons sem teste: purge-content-events, aggregate-content-metrics, media-cleanup, links-check-alerts | apps/web/src/app/api/cron/ |
| BTF-038 | MEDIO | Testes | Pipeline API routes ~30% coverage (12/40) | apps/web/src/app/api/pipeline/ |
| BTF-039 | MEDIO | Testes | Social package 0 testes (passWithNoTests: true) | packages/social/ |
| BTF-041 | MEDIO | Deps | 16 npm vulnerabilities (5 high: fast-uri, fast-xml-builder, next, undici) | package-lock.json |

## Findings Resolvidos
| ID | Resolvido em | Descricao | Como |
|----|-------------|-----------|------|
| BTF-001 | 2026-05-14 | PostgREST filter injection via topicSlug em .or() | sanitizeForFilter() aplicado antes de interpolação |
| BTF-002 | 2026-05-14 | PostgREST filter injection via cursor pagination em .or() | sanitizeForFilter() aplicado em cursor values |
| BTF-003 | 2026-05-14 | PostgREST filter injection via column/sort_value em .or() | sanitizeForFilter() aplicado em sort_value |
| BTF-004 | 2026-05-14 | Rate limit RPC best-effort — DB error nao diferenciado | Diferencia DB error vs rate limit, fail-open com console.warn |
| BTF-005 | 2026-05-14 | Google AdSense nao documentado na privacy policy | Adicionado como processador com cookies, base legal, opt-out |
| BTF-006 | 2026-05-14 | Meta (Facebook/Instagram OAuth) nao documentado | Adicionado como processador com SCCs |
| BTF-007 | 2026-05-14 | YouTube/Google OAuth nao documentado | Adicionado como processador com SCCs |
| BTF-008 | 2026-05-14 | Bluesky/ATP nao documentado | Adicionado como processador com SCCs |
| BTF-010 | 2026-05-14 | .select('*') em social_deliveries Realtime | Substituido por colunas explicitas, sem last_error |
| BTF-011 | 2026-05-14 | Error message bruta retornada ao cliente em OAuth callback | Mensagem generica, erro real logado server-side |
| BTF-012 | 2026-05-14 | dangerouslySetInnerHTML sem DOMPurify em blog editor preview | DOMPurify.sanitize() adicionado |
| BTF-013 | 2026-05-14 | dangerouslySetInnerHTML sem DOMPurify em newsletter archive | DOMPurify.sanitize() adicionado |
| BTF-014 | 2026-05-14 | dangerouslySetInnerHTML sem DOMPurify em email template | DOMPurify.sanitize() adicionado |
| BTF-015 | 2026-05-14 | SECURITY DEFINER sem SET search_path — update_pipeline_step() | Nova migration com SET search_path = '' |
| BTF-016 | 2026-05-14 | SECURITY DEFINER sem SET search_path (fix migration) | Mesma migration, function recriada |
| BTF-017 | 2026-05-14 | createCampaign() sem requireSiteScope() | requireSiteScope() adicionado antes do service client |
| BTF-018 | 2026-05-14 | Link resolver permite cross-origin harvesting via x-site-id | Resolve site via Host header, nao mais x-site-id |
| BTF-019 | 2026-05-14 | .select('*') em social_connections em workflows | Colunas explicitas, tokens mantidos intencionalmente (publish) |
| BTF-020 | 2026-05-14 | .select('*') em getConnections() | Colunas explicitas sem tokens, stripTokens() como defense-in-depth |
| BTF-022 | 2026-05-14 | ad_inquiries nao coberto pelo LGPD cleanup | Adicionado a phase1Cleanup() e collectUserData() |
| BTF-023 | 2026-05-14 | apps/web/ sem validacao Zod de env vars | Criado apps/web/src/lib/env.ts com schemas server+client |
| BTF-024 | 2026-05-14 | CSP unsafe-inline + unsafe-eval | unsafe-eval condicional — apenas em desenvolvimento |
| BTF-025 | 2026-05-14 | error.message retornado ao cliente em pipeline routes | Mensagem generica, erro logado server-side |
| BTF-026 | 2026-05-14 | In-memory rate limiter cold start reset | Documentado tradeoff — aceitavel para ad events |
| BTF-027 | 2026-05-14 | Turnstile CAPTCHA opcional (skipped se env var ausente) | console.warn em producao quando chave ausente |
| BTF-028 | 2026-05-14 | LGPD verify-cookie fallback para CRON_SECRET | HMAC key derivation independente via HKDF |
| BTF-029 | 2026-05-14 | Transferencia internacional nao documentada | Secao 5 da policy reescrita com tabela de 8 processadores |
| BTF-030 | 2026-05-14 | Newsletter tracking nao mencionado na policy | Disclosure adicionada com retencao 90d |
| BTF-031 | 2026-05-14 | Policy diz anonymizada imediatamente mas codigo diz 90 dias | Corrigido para 90 dias na policy |
| BTF-032 | 2026-05-14 | password_reset_attempts sem cron de cleanup | Adicionado ao lgpd-cleanup-sweep, purge 30 dias |
| BTF-033 | 2026-05-14 | unsubscribe_tokens sem cleanup periodico | Adicionado ao lgpd-cleanup-sweep, purge 90 dias |
| BTF-034 | 2026-05-14 | consents ip/ua nao anonymizados apos delecao | ip e user_agent setados null em phase1Cleanup() |
| BTF-035 | 2026-05-14 | error.message retornado ao client em social actions | 17 mensagens genericas, erros logados server-side |
| BTF-036 | 2026-05-14 | console.error loga DB errors com nomes de colunas | Sanitizado para logar apenas error codes |
| BTF-040 | 2026-05-14 | Shared package 7 test failures (ad-slots stale) | Fixtures atualizados para 10 slots com keys colon-delimited |
| BTF-042 | 2026-05-14 | SVG upload aceito sem DOMPurify no upload handler | Confirmado sanitizacao downstream via processImage/sanitizeSvg |
| BTF-043 | 2026-05-14 | sanitizeForFilter() regex fraco | Refatorado para allowlist: [^a-zA-Z0-9\s\-_/:@] |
| BTF-044 | 2026-05-14 | .mcp.json nao no .gitignore | Adicionado ao .gitignore |
| BTF-045 | 2026-05-14 | Ad inquiry rate limit select-insert race condition | Documentado — baixo risco, Turnstile-gated |
| BTF-046 | 2026-05-14 | SES webhook cert caching TTL 1h | Reduzido para 15min |
| BTF-047 | 2026-05-14 | Coverage thresholds apenas para LGPD | Thresholds globais 60% lines/functions adicionados |
| BTF-048 | 2026-05-14 | dangerouslySetInnerHTML em blog-article-html.tsx | DOMPurify.sanitize() adicionado |
| BTF-049 | 2026-05-14 | Policy referencia Brevo SAS mas projeto usa Resend | Substituido por Resend, Inc. em toda policy |

## Falsos Positivos Detectados
| ID | Descricao | Por que falso positivo |
|----|-----------|----------------------|
| BTF-009 | Google Fonts (next/font/google) como terceiro LGPD | next/font/google faz download em build time e serve self-hosted — zero PII transferido para Google em runtime |

## LGPD — Cobertura PII por Phase
| Tabela | Campo PII | Phase 1 | Phase 3 | Export | Status |
|--------|-----------|---------|---------|--------|--------|
| auth.users | email, phone | OK | OK | OK | COBERTO |
| newsletter_subscriptions | email, ip, ua | OK | OK | OK | COBERTO |
| contact_submissions | email, name, ip, ua | OK | OK | OK | COBERTO |
| consents | user_id, ip, ua | OK (ip/ua nulled) | OK | OK | COBERTO |
| audit_log | actor_user_id, ip, ua | OK | OK | OK | COBERTO |
| media_assets | uploaded_by | OK | OK | OK | COBERTO |
| content_events | visitor_id, ip, ua | Purge | Purge | N/A | PARCIAL |
| link_clicks | visitor_id, ip_hash | Anon | Anon | N/A | PARCIAL |
| sent_emails | to_email, subject | Purge | Purge | N/A | PARCIAL |
| invitations | email, invited_by | OK | OK | OK | COBERTO |
| ad_events | user_hash | Hash | Aggregate | N/A | PARCIAL |
| blog_posts | owner_user_id | Reatrib | OK | OK | COBERTO |
| campaigns | owner_user_id | Reatrib | OK | OK | COBERTO |
| authors | user_id, name, bio | OK | OK | OK | COBERTO |
| organization_members | user_id | FK | FK | OK | COBERTO |
| site_memberships | user_id | FK | FK | OK | COBERTO |
| lgpd_requests | user_id, token_hash | Retido | Retido | OK | COBERTO |
| ad_inquiries | email, name, ip, ua | OK (anonymized) | OK | OK | COBERTO |
| unsubscribe_tokens | email (hashed) | Purge 90d | - | - | COBERTO |
| password_reset_attempts | email, ip | Purge 30d | - | - | COBERTO |
| newsletter_sends | open_ip, open_ua | Anon 90d | Anon 90d | N/A | PARCIAL |
| tracked_links | source_id (FK) | FK | FK | N/A | COBERTO |
| social_connections | N/A | N/A | N/A | N/A | N/A (nao existe) |
| social_posts | N/A | N/A | N/A | N/A | N/A (nao existe) |
| cron_locks | - | - | - | - | N/A (no PII) |

## Rate Limiting — Endpoints Publicos
| Endpoint | Limite | Status |
|----------|--------|--------|
| Pipeline API (40+ routes) | 100/min in-memory Map | IMPLEMENTADO (cold start reset) |
| LGPD verify-password | Advisory lock DB | IMPLEMENTADO |
| LGPD data export | 1/30d per-user DB | IMPLEMENTADO |
| Admin/CMS login | Turnstile captcha | CONDICIONAL (env var) |
| Admin/CMS forgot-password | Turnstile captcha | CONDICIONAL (env var) |
| Newsletter subscribe | RPC DB check | IMPLEMENTADO (best-effort) |
| Contact form | RPC DB check | IMPLEMENTADO (fail-open com warning) |
| Ad events tracking | In-memory Map | IMPLEMENTADO (cold start reset) |
| Content tracking | In-memory Map | IMPLEMENTADO (cold start reset) |
| Link clicks (/go/) | Nenhum | SEM RATE LIMIT |
| Social OAuth initiate | Nenhum | SEM RATE LIMIT |
| Crons (21 endpoints) | CRON_SECRET Bearer | IMPLEMENTADO (21/21) |

## Contagem de Testes
| Workspace | Testes | Verificado em |
|-----------|--------|---------------|
| Web | 4747 (4558 passed, 189 skipped) | 2026-05-14 |
| API | 152 (13 passed, 139 skipped) | 2026-05-14 |
| Links | 189 (189 passed) | 2026-05-14 |
| LinksAdmin | 189 (189 passed) | 2026-05-14 |
| Shared | 11 (11 passed) | 2026-05-14 |
| Social | 0 (passWithNoTests) | 2026-05-14 |
| **Total** | **5288** | 2026-05-14 |

## Historico de Scores
| Data | Testes | Types | Seguranca | LGPD | Leaks | Total | Findings C/A/M/B | Net |
|------|--------|-------|-----------|------|-------|-------|-------------------|-----|
| 2026-05-14 | 6 | 6 | 4 | 4 | 5 | 5 | 10/10/17/6 | 43 |
| 2026-05-14 | 7 | 8 | 8 | 8 | 9 | 8 | 0/1/4/0 | 5 |

## Proximos Passos Recomendados
1. URGENTE: Consentimento granular para social integrations — BTF-021 (arquitetural, ~4h)
2. SPRINT: npm audit fix — BTF-041 (30min)
3. BACKLOG: Testes para 4 crons sem cobertura — BTF-037 (4h)
4. BACKLOG: Aumentar cobertura pipeline API routes — BTF-038 (8h)
5. BACKLOG: Testes para social package — BTF-039 (6h)
