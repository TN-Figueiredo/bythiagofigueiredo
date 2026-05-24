# Audit Baseline — bythiagofigueiredo

> Atualizado pelo `/audit`. Historico via `git log docs/audit-baseline.md`.
> Formato machine-parseable — NAO alterar headers ou formato das tabelas.

## Ultimo Audit
- **Data:** 2026-05-24
- **Escopo:** all
- **Foco:** all
- **Score Total:** 9.5/10
- **Ultimo Finding ID:** BTF-074

| Categoria | Criticos | Altos | Medios | Baixos | Score |
|-----------|----------|-------|--------|--------|-------|
| Cobertura Testes | 0 | 0 | 0 | 0 | 9.5/10 |
| TypeScript Safety | 0 | 0 | 1 | 0 | 8/10 |
| Seguranca | 0 | 0 | 0 | 0 | 10/10 |
| LGPD | 0 | 0 | 0 | 0 | 10/10 |
| Data Leaks | 0 | 0 | 0 | 0 | 10/10 |

## Findings Abertos
| ID | Severidade | Categoria | Descricao | Arquivo |
|----|-----------|-----------|-----------|---------|
| BTF-041 | MEDIO | Deps | 13 npm vulnerabilities (breaking: next, @vercel/blob, vitest, @lhci/cli) | package-lock.json |
| BTF-059 | MEDIO | TypeScript | 89 `as unknown as` double casts (86 justified: 60 Supabase untyped, 6 SDK, 3 email contravariance, 1 LGPD null-obj) | apps/web/src/ |

## Findings Resolvidos
| ID | Resolvido em | Descricao | Como |
|----|-------------|-----------|------|
| BTF-001 | 2026-05-14 | PostgREST filter injection via topicSlug em .or() | sanitizeForFilter() aplicado antes de interpolacao |
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
| BTF-021 | 2026-05-24 | Social integrations sem consentimento granular | Migration social_consent_category: CHECK constraint expandido, consent_texts seeded, recordSocialConsent() no OAuth callback, auth guard no initiate |
| BTF-037 | 2026-05-24 | 4 crons sem teste | 21 testes: purge-content-events(4), aggregate-content-metrics(5), media-cleanup(6), links-check-alerts(6) |
| BTF-038 | 2026-05-24 | Pipeline API routes ~30% coverage | 97 testes adicionados em 12 files, coverage 48% (26/54 routes) |
| BTF-039 | 2026-05-24 | Social package 0 testes (passWithNoTests: true) | 3 test files adicionados: bluesky-auth, instagram-multi-slide, instagram-stories (15 tests) |
| BTF-040 | 2026-05-14 | Shared package 7 test failures (ad-slots stale) | Fixtures atualizados para 10 slots com keys colon-delimited |
| BTF-042 | 2026-05-14 | SVG upload aceito sem DOMPurify no upload handler | Confirmado sanitizacao downstream via processImage/sanitizeSvg |
| BTF-043 | 2026-05-14 | sanitizeForFilter() regex fraco | Refatorado para allowlist: [^a-zA-Z0-9\s\-_/:@] |
| BTF-044 | 2026-05-14 | .mcp.json nao no .gitignore | Adicionado ao .gitignore |
| BTF-045 | 2026-05-14 | Ad inquiry rate limit select-insert race condition | Documentado — baixo risco, Turnstile-gated |
| BTF-046 | 2026-05-14 | SES webhook cert caching TTL 1h | Reduzido para 15min |
| BTF-047 | 2026-05-14 | Coverage thresholds apenas para LGPD | Thresholds globais 60% lines/functions adicionados |
| BTF-048 | 2026-05-14 | dangerouslySetInnerHTML em blog-article-html.tsx | DOMPurify.sanitize() adicionado |
| BTF-049 | 2026-05-14 | Policy referencia Brevo SAS mas projeto usa Resend | Substituido por Resend, Inc. em toda policy |
| BTF-050 | 2026-05-24 | error.message retornado ao cliente em 8 routes (playlists, edges, broll, adsense, youtube) | Mensagens genericas em 8 routes, erros logados server-side via console.error |
| BTF-051 | 2026-05-24 | youtube/complete body sem Zod validation | Zod schema z.object({ videoId, postId? }) + safeParse |
| BTF-052 | 2026-05-24 | linktree_events IP/UA/location armazenados indefinidamente | Novo cron anonymize-linktree-events: 30d retention, 10k batch, nullifica ip/ua/referrer/city/region |
| BTF-054 | 2026-05-24 | social-metrics cron .select('*') expoe tokens criptografados | Colunas explicitas: id, page_token_enc, access_token_enc, metadata |
| BTF-055 | 2026-05-24 | broll-library .select('*') retorna 33+ colunas | 33 colunas explicitas no .select() |
| BTF-056 | 2026-05-24 | ad_events sem purge apos agregacao | DELETE step 90d adicionado ao ad-events-aggregate cron |
| BTF-057 | 2026-05-24 | social_posts e sent_emails ausentes do LGPD data export | Adicionados a collectUserData() com colunas explicitas |
| BTF-058 | 2026-05-24 | lgpd_phase3_prenullify_fks filtra invitations com accepted_at IS NULL | Migration recria funcao sem filtro — nullifica invited_by e accepted_by_user_id |
| BTF-060 | 2026-05-24 | on-signup hook loga userId (PII) em console.error | userId removido do log object |
| BTF-061 | 2026-05-24 | use-link-form test assertion errada (.toBe(302) vs .toBe(307)) | Corrigido para .toBe(307) — redirect_type default mudou |
| BTF-062 | 2026-05-24 | tracking_consent admin-only — admin nao precisa consent cookie | Nao corrigido — manter como debt tecnico, admin e authed |
| BTF-063 | 2026-05-24 | .select('*') em playlists POST e context/[key] GET | Colunas explicitas em ambas queries |
| BTF-064 | 2026-05-24 | Telegram webhook sem autenticacao (qualquer um envia payload) | X-Telegram-Bot-Api-Secret-Token + timingSafeEqual validation |
| BTF-065 | 2026-05-24 | hashtag-actions sem requireEditScope() — RBAC bypass | requireEditScope(siteId) adicionado em 3 funcoes |
| BTF-066 | 2026-05-24 | social_posts.created_by NOT NULL FK blocks phase3 deleteUser | Migration: DROP NOT NULL, FK ON DELETE SET NULL, prenullify RPC expanded |
| BTF-067 | 2026-05-24 | page_content.updated_by bare FK blocks phase3 deleteUser | Migration: FK replaced with ON DELETE SET NULL, prenullify RPC expanded |
| BTF-068 | 2026-05-24 | newsletter_sends PII not anonymized in phase1 | Phase1 RPC expanded: subscriber_email, open_ip, open_user_agent scrubbed |
| BTF-069 | 2026-05-24 | sent_emails PII not anonymized in phase1 | Phase1 RPC expanded: to_email, subject, metadata scrubbed |
| BTF-070 | 2026-05-24 | Missing data exports: newsletter_sends, password_reset_attempts | collectUserData() expanded with both tables |
| BTF-071 | 2026-05-24 | Auth cookies missing secure flag | secure: process.env.NODE_ENV === 'production' added to cms/admin login |
| BTF-072 | 2026-05-24 | Error message leaks in playlist/social routes | 6 routes: generic messages, no Supabase internals exposed |
| BTF-073 | 2026-05-24 | Sentry PII scrubber missing IPv4/IPv6 | IPV4_RE + IPV6_RE added to scrubPiiString(), 4 new tests |
| BTF-074 | 2026-05-24 | social/pipeline/run leaks err.message in response | Generic 'Internal error' message, Sentry captures full error |

## Falsos Positivos Detectados
| ID | Descricao | Por que falso positivo |
|----|-----------|----------------------|
| BTF-009 | Google Fonts (next/font/google) como terceiro LGPD | next/font/google faz download em build time e serve self-hosted — zero PII transferido para Google em runtime |
| BTF-053 | Sharp .withMetadata(false) para strip EXIF | Sharp JA strip metadata por default com .rotate().toBuffer() — .withMetadata(false) nao e API valida e na verdade preserva metadata |

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
| sent_emails | to_email, subject | OK (phase1 RPC) | OK | Export | COBERTO |
| invitations | email, invited_by | OK | OK (filter fix) | OK | COBERTO |
| ad_events | user_hash | Hash | Aggregate+Purge 90d | N/A | COBERTO |
| blog_posts | owner_user_id | Reatrib | OK | OK | COBERTO |
| campaigns | owner_user_id | Reatrib | OK | OK | COBERTO |
| authors | user_id, name, bio | OK | OK | OK | COBERTO |
| organization_members | user_id | FK | FK | OK | COBERTO |
| site_memberships | user_id | FK | FK | OK | COBERTO |
| lgpd_requests | user_id, token_hash | Retido | Retido | OK | COBERTO |
| ad_inquiries | email, name, ip, ua | OK (anonymized) | OK | OK | COBERTO |
| unsubscribe_tokens | email (hashed) | Purge 90d | - | - | COBERTO |
| password_reset_attempts | email, ip | Purge 30d | - | - | COBERTO |
| newsletter_sends | subscriber_email, open_ip, open_ua | OK (phase1 RPC) | OK | Export | COBERTO |
| tracked_links | source_id (FK) | FK | FK | N/A | COBERTO |
| linktree_events | ip, ua, referrer, city, region | Anon 30d | Anon 30d | N/A | COBERTO |
| social_posts | created_by | - | OK (prenullify) | Export | COBERTO |
| page_content | updated_by | - | OK (prenullify) | N/A | COBERTO |
| password_reset_attempts | email, ip, user_id | Purge 30d | - | Export | COBERTO |

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
| Telegram webhook | Secret token header | IMPLEMENTADO |
| Crons (22 endpoints) | CRON_SECRET Bearer | IMPLEMENTADO (22/22) |

## Contagem de Testes
| Workspace | Testes | Verificado em |
|-----------|--------|---------------|
| Web | 7645 (7436 passed, 209 skipped) | 2026-05-24 |
| API | 152 (13 passed, 139 skipped) | 2026-05-24 |
| Links | 292 (292 passed) | 2026-05-24 |
| LinksAdmin | 178 (178 passed) | 2026-05-24 |
| Shared | 11 (11 passed) | 2026-05-24 |
| Social | 15 (15 passed) | 2026-05-24 |
| **Total** | **8293** | 2026-05-24 |

## Historico de Scores
| Data | Testes | Types | Seguranca | LGPD | Leaks | Total | Findings C/A/M/B | Net |
|------|--------|-------|-----------|------|-------|-------|-------------------|-----|
| 2026-05-14 | 6 | 6 | 4 | 4 | 5 | 5 | 10/10/17/6 | 43 |
| 2026-05-14 | 7 | 8 | 8 | 8 | 9 | 8 | 0/1/4/0 | 5 |
| 2026-05-24 | 7 | 8 | 9 | 9 | 10 | 9 | 0/1/3/0 | 5→4 open |
| 2026-05-24 | 9 | 8 | 9 | 10 | 10 | 9.5 | 0/0/2/0 | 2 open |
| 2026-05-24 | 9 | 8 | 10 | 10 | 10 | 9.5 | 0/0/2/0 | 2 open (9 resolved) |
| 2026-05-24 | 9.5 | 8 | 10 | 10 | 10 | 9.5 | 0/0/2/0 | +211 tests (24 new files) |

## Proximos Passos Recomendados
1. BACKLOG: npm audit fix breaking changes — BTF-041 (next@16, @vercel/blob@3, vitest@4 — coordenar upgrade cycle)
2. BACKLOG: Gerar Supabase types (`supabase gen types`) para eliminar ~60 `as unknown as` — BTF-059
3. BACKLOG: Pipeline route test coverage 50% (27/54 routes), cron coverage 79% (27/34), overall API 78% (97/124)
