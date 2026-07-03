# Audit Baseline — bythiagofigueiredo

> Atualizado pelo `/audit`. Historico via `git log docs/audit-baseline.md`.
> Formato machine-parseable — NAO alterar headers ou formato das tabelas.

## Ultimo Audit
- **Data:** 2026-07-03 (audit all/all — 9 agentes; remediacao all/all — 9 agentes worktree, integrada)
- **Escopo:** all
- **Foco:** all
- **Score Total:** 9.2/10 pos-remediacao (era 7.4 no diagnostico; BTF-095..104 resolvidos no mesmo ciclo)
- **Ultimo Finding ID:** BTF-104

| Categoria | Criticos | Altos | Medios | Baixos | Score |
|-----------|----------|-------|--------|--------|-------|
| Cobertura Testes | 0 | 0 | 0 | 1 | 9/10 |
| TypeScript Safety | 0 | 0 | 0 | 1 | 9/10 |
| Seguranca | 0 | 0 | 0 | 1 | 9.5/10 |
| LGPD | 0 | 0 | 0 | 2 | 9/10 |
| Data Leaks | 0 | 0 | 0 | 1 | 9.5/10 |

## Findings Abertos
| ID | Severidade | Categoria | Descricao | Arquivo |
|----|-----------|-----------|-----------|---------|
| BTF-059 | BAIXO | TypeScript | `as unknown as` = 149 prod (Fase 0/1 gen types feita: database.types.ts + fabricas tipadas; 9 any/as-any eliminados 2026-07-03). Restante = migracao por dominio (Fase 2, deferida). | apps/web/src/ |
| BTF-083 | RESOLVIDO 2026-07-03 | TypeScript | Ratchet `check-type-debt.sh` agora cobre web/src+web/lib+api/src+packages/src (exclui testes), baseline 149, no job ecosystem-pinning. | scripts/check-type-debt.sh |
| BTF-086b | MEDIO | CI | Restante do BTF-086 (audit gate ja bloqueante): type-debt ratchet + teste-guardiao de inventario PII. Mantido MEDIO: o guardian PII e LGPD-adjacente (inventario ja teve drift real) — so o audit gate foi resolvido. | .github/workflows/ci.yml |
| BTF-094 | BAIXO | Deps | MITIGADO 2026-07-03: override virou floor range `^3.4.11` (advisory bumps fluem; canary + suites de sanitizer guardam comportamento). Restante: pin exato retinha o fix do proximo advisory (mesma classe do pin 3.4.2 que anulou o fix em 2026-07-03). Fix estrutural: bump isomorphic-dompurify 2.x -> 3.x (pareia dompurify ^3.4.11 + jsdom ^29 — major de jsdom em dep de PRODUCAO, exige sessao com build+testes), declarar dompurify como dep direta e remover o override. | package.json |
| — | — | Cobertura | DEFERIDO: testes de providers social (youtube/meta) — exigem mocking de SDK (~4h). Threshold de coverage no social bloqueado por version mismatch vitest 2.1.9 vs coverage-v8 3.2.4. | packages/social/ |
| — | — | TypeScript | DEFERIDO: migracao de ~38 rotas mutativas para helper Zod unico (parseBodyWith). | apps/web/src/app/api/ |

## Findings Resolvidos
| ID | Resolvido em | Descricao | Como |
|----|-------------|-----------|------|
| BTF-095 | 2026-07-03 | VIOLACAO Art.7 I — content_events (analytics) coletado sem opt-in de consent | Gate de consent no hook (use-content-tracking.ts, early-return se !analytics) + defense-in-depth no servidor (track/content: 204 sem insert se !hasConsent). +12 testes |
| BTF-096 | 2026-07-03 | Cookie sessao httpOnly:false com refresh_token 400d | Investigado: e o padrao @supabase/ssr (browser client precisa ler; lib reescreve no refresh). Documentado como trade-off; mitigacao real = CSP nonce enforced em prod (verificado) |
| BTF-097 | 2026-07-03 | 9 funcoes SECURITY DEFINER sem search_path | Migration 20260703000001: ALTER FUNCTION SET search_path='public' (corpos usam tabelas nao-qualificadas). update_pipeline_step ja estava OK |
| BTF-098 | 2026-07-03 | (falso positivo) error.message Supabase vazado em LGPD deletion | Verificado: os error.message estao dentro de getLogger().warn (server-side), nunca na resposta HTTP. Sem mudanca |
| BTF-099 | 2026-07-03 | Oracle de enumeracao no waitlist signup (flag duplicate) | Resposta constante {success:true}; flag duplicate removido do HTTP (so no breadcrumb Sentry); form UX neutralizada |
| BTF-100 | 2026-07-03 | Policy §6 descrevia mecanismo errado (hash via cron) de anonimizacao de email | Corrigida (pt+en v1.3): o hash e SINCRONO no unsubscribe_via_token, cron 90d so nula ip/ua do tracking |
| BTF-101 | 2026-07-03 | Waitlists ausente da policy §2/§3/§6 | Adicionado (pt+en): dados coletados, base legal Art.7 I, retencao (waitlist-retention-sweep) |
| BTF-102 | 2026-07-03 | Sentry Replay maskAllText:false/blockAllMedia:false gravava PII on-screen | Ambos -> true; gate de consent Tier2 preservado; policy §3 alinhada |
| BTF-104 | 2026-07-03 | waitlist_dsar_tokens/password_reset_attempts guardavam email plaintext sem purga/anon | Migration 20260703000002 (phase1 anon password_reset) + 20260703000003 (purge_used_dsar_tokens) + wiring no lgpd-cleanup-sweep. unsubscribe_tokens ja era purgado (BTF-033) |
| BTF-089b | 2026-07-03 | CSP nonce-based migration | Implementada + enforced em prod (verificado curl: nonce no header, 66 scripts nonced). Rollout report-only->enforce feito |
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
| BTF-075 | 2026-06-07 | 5 testes Donut/Delta falhando (background ring + delta 0/0) | Seletor `circle[stroke-dasharray]` para segmentos; delta 0/0 assert renderiza nada |
| BTF-076 | 2026-06-07 | Zod ausente em social/youtube/upload-session POST | UploadSessionSchema + safeParse → 400 (outras 3 rotas ja validavam na camada service) |
| BTF-077 | 2026-06-07 | Export LGPD nao cobre playlists/youtube_notes/content_pipeline (Art. 18) | collectUserData expandido (+5 slices, youtube_notes.text redacted); phase1 scrub author_name; +2 testes |
| BTF-078 | 2026-06-07 | Policy nao documenta YouTube Intelligence + Research (Art. 5) | privacy.pt-BR.mdx v1.2: §2/§3/§4/§5/§6/§13 atualizados |
| BTF-079 | 2026-06-07 | social ~6% coverage, token-vault sem teste | 43 testes core/ (token-vault/content-adapter/media-validator/quota-manager); GCM authTagLength=16; passWithNoTests removido |
| BTF-081 | 2026-06-07 | dangerouslySetInnerHTML sem DOMPurify em tiptap-editor | sanitizeContentHtml() aplicado |
| BTF-082 | 2026-06-07 | linktree tracking sem gate de consentimento | Anonimiza ip/ua/referrer server-side sem consent (padrao content_events); visitor_id/geo preservados |
| BTF-084 | 2026-06-07 | 3 SECURITY DEFINER sem search_path (cron_try_lock, cron_unlock, unsubscribe_via_token) | Migration 20260607000001: ALTER FUNCTION SET search_path='' (pending push prod) |
| BTF-085 | 2026-06-07 | AWS SES em uso, nao documentado na policy | privacy.pt-BR.mdx v1.2 §4: AWS SES sa-east-1 (nacional, sem transferencia intl) |
| BTF-087 | 2026-06-19 | privacy.en.mdx defasada v1.0 (Brevo, sem SES/redes/AdSense/Waitlists) | Reescrita como traducao fiel da pt-BR v1.2: Brevo removido, +SES/Resend/YouTube Intelligence/Research/Waitlists/Sentry-tiers/cookies AdSense; nota "pt-BR prevails"; legal-shell test verde |
| BTF-088 | 2026-06-19 | /api/consents/anonymous sem rate limit (spam de consents) | In-memory Map 50/min por IP (padrao ads/events + track/content), 429 antes do insert, +3 testes |
| BTF-089 | 2026-06-19 | CSP unsafe-inline em script-src producao | Hardening: +object-src 'none' (base-uri/frame-ancestors/form-action ja presentes); unsafe-inline documentado como debt (migracao nonce = BTF-089b, exige build verification) |
| BTF-090 | 2026-06-19 | email-sanitizer XSS-stripping por regex fragil | Substituido por isomorphic-dompurify (allowlist) no input antes do juice/MSO; goldens inalterados; 18 testes verdes |
| BTF-091 | 2026-06-19 | 17 select('*') em social actions (posts.ts 10x, templates.ts 7x) | Projecoes explicitas (POST_COLS/DELIVERY_COLS/CONNECTION_COLS/TEMPLATE_COLS); bluesky_*_enc/circuit/rate cols excluidas; typecheck + 412 testes verdes |
| BTF-092 | 2026-06-19 | teste flaky em links-admin (1-em-N, wall-clock race) | Causa raiz: MockEventSource setTimeout(0) vs sleep(10) do teste; fix com vi.useFakeTimers + advanceTimersByTimeAsync; 5 runs consecutivos verdes |
| BTF-093 | 2026-06-19 | 42/44 crons sem teste dedicado (delecao irreversivel) | +20 testes pure-mock em ab-draft-cleanup(7)/snapshot-cleanup(6)/notification-cleanup(7): auth 401, cutoff, delete-by-id (anti-wipe), GET/POST real. 4 dos 5 alvos sugeridos ja tinham teste |
| BTF-080 | 2026-07-03 | undici HIGH via @vercel/blob 1.1.1 (Set-Cookie downgrade + 5 CVEs novos) | @vercel/blob 1.1.1→2.5.0 (undici 6.27.0, dedup com cheerio); engines node >=20; override morto `@vercel/blob>undici` removido (nao aplicava — blob 1.x resolvia undici 5.29.0); breaking 2.x (callbackUrl client-upload) sem impacto: onUploadCompleted e no-op. + npm audit fix: form-data HIGH (CRLF), js-yaml, esbuild; override dompurify 3.4.2→3.4.11 (pin antigo anulava o fix e quebraria npm ci). Prod deps: 0 high (6 moderate nao-acionaveis: otel via Sentry, postcss via Next). Verificado: typecheck, 24 testes blob-related, next build local |
| BTF-086 | 2026-07-03 | Audit job soft (continue-on-error) — vulns HIGH passavam sem bloquear | continue-on-error removido do job audit (ci.yml); gate `npm audit --omit=dev --audit-level=high` agora bloqueante (exit 0 pos BTF-080). Restante (ratchet + PII guardian) reclassificado BTF-086b |

## Falsos Positivos Detectados
| ID | Descricao | Por que falso positivo |
|----|-----------|----------------------|
| BTF-009 | Google Fonts (next/font/google) como terceiro LGPD | next/font/google faz download em build time e serve self-hosted — zero PII transferido para Google em runtime |
| BTF-053 | Sharp .withMetadata(false) para strip EXIF | Sharp JA strip metadata por default com .rotate().toBuffer() — .withMetadata(false) nao e API valida e na verdade preserva metadata |
| FP-2026-06-19a | "CRITICO: oauth callback console.error(provider, err) vaza tokens OAuth" (callback/route.ts:416) | `err` e um Error (message+stack), nao variaveis de closure; os throw no bloco sao mensagens de DB, nao tokens. Log server-side (Vercel) + scrubber Sentry. Tokens ficam em locals, nao em stack traces JS. |
| FP-2026-06-19b | "snapshot-cleanup/notification-cleanup POST-only sao crons Vercel mortos (split-brain)" | NAO estao em apps/web/vercel.json — sao pg_cron-driven (POST) por design. ab-draft-cleanup (Vercel cron) e corretamente GET-only. Arquitetura consistente. |

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
| Consents anonymous | In-memory Map 50/min | IMPLEMENTADO (BTF-088, cold start reset) |
| Ad events tracking | In-memory Map | IMPLEMENTADO (cold start reset) |
| Content tracking | In-memory Map | IMPLEMENTADO (cold start reset) |
| Link clicks (/go/) | Nenhum | SEM RATE LIMIT |
| Social OAuth initiate | Nenhum | SEM RATE LIMIT |
| Telegram webhook | Secret token header | IMPLEMENTADO |
| Crons (22 endpoints) | CRON_SECRET Bearer | IMPLEMENTADO (22/22) |

## Contagem de Testes
| Workspace | Testes | Verificado em |
|-----------|--------|---------------|
| Web | 13391 (13002 passed, 382 skipped, 7 todo) — +5.7k vs 06-07 | 2026-06-19 |
| API | 152 (13 passed, 139 skipped HAS_LOCAL_DB) | 2026-06-19 |
| Links | 442 (442 passed) | 2026-06-19 |
| LinksAdmin | 439 (439 passed — flaky BTF-092 corrigido, 5 runs verdes) | 2026-06-19 |
| Shared | 11 (11 passed) | 2026-06-19 |
| Social | 58 (58 passed) | 2026-06-19 |
| **Packages total** | **950** (todos verdes, gate test-packages no CI) | 2026-06-19 |

> Nota: codebase cresceu — 176 route handlers (era ~90), 44 cron routes (era 21).

## Historico de Scores
| Data | Testes | Types | Seguranca | LGPD | Leaks | Total | Findings C/A/M/B | Net |
|------|--------|-------|-----------|------|-------|-------|-------------------|-----|
| 2026-05-14 | 6 | 6 | 4 | 4 | 5 | 5 | 10/10/17/6 | 43 |
| 2026-05-14 | 7 | 8 | 8 | 8 | 9 | 8 | 0/1/4/0 | 5 |
| 2026-05-24 | 7 | 8 | 9 | 9 | 10 | 9 | 0/1/3/0 | 5→4 open |
| 2026-05-24 | 9 | 8 | 9 | 10 | 10 | 9.5 | 0/0/2/0 | 2 open |
| 2026-05-24 | 9 | 8 | 10 | 10 | 10 | 9.5 | 0/0/2/0 | 2 open (9 resolved) |
| 2026-05-24 | 9.5 | 8 | 10 | 10 | 10 | 9.5 | 0/0/2/0 | +211 tests (24 new files) |
| 2026-06-07 | 8 | 8 | 9 | 9 | 9.5 | 8.7 | 0/1/7/4 | codebase cresceu (youtube/playlists/notifications) — gaps reabertos |
| 2026-06-07 | 9 | 8 | 9 | 9.5 | 9.5 | 9 | 0/0/5/1 | Ondas 1-3 + CI parcial: 7 commits, BTF-075/076/077/078/079/081/082/084/085 resolvidos |
| 2026-06-19 | 9 | 8 | 9.5 | 9.5 | 9.5 | 9.4 | 0/0/2/1 | Remediacao 6 sub-agentes (commit f96fc806, sem push): BTF-087/088/089/090/091/092/093 resolvidos; design 102/110 |
| 2026-07-03 | 9 | 8 | 9.5 | 9.5 | 9.5 | 9.4 | 0/0/3/2 | Freeze encerrado + push prod. BTF-080/086 resolvidos (blob 2.5.0, undici/form-data HIGH eliminados, audit gate bloqueante); BTF-094 aberto (dompurify override rot) |

## Proximos Passos Recomendados
1. PENDING (carry-over): verificar se a migration 20260607000001 (search_path fix — BTF-084) esta aplicada em prod — `npx supabase migration list --linked` (exige SUPABASE_DB_PASSWORD; CLI retorna 403 sem ela). Inferencia forte de que sim: as migrations 20260616+ de waitlists foram aplicadas em ordem em 2026-06-18.
2. DEFERIDO (BTF-094): isomorphic-dompurify 2.22.0 -> 3.x + dompurify dep direta + remover override do raiz. Gate de regressao: canary em test/unit/newsletter/archive-sanitizer.test.ts + suites de sanitizer (env node).
3. DEFERIDO (sessao dedicada, exige build): `supabase gen types` → tipar clients → eliminar `as unknown as` (143, BTF-059/083). Risco alto: pode quebrar typecheck em massa.
4. DEFERIDO (exige `next build` + verificacao de hidratacao no browser): CSP nonce-based migration (BTF-089b) — middleware tem ~13 saidas NextResponse.
5. DEFERIDO: helper Zod unico (parseBodyWith) nas ~38 rotas mutativas; type-debt ratchet + teste-guardiao de inventario PII no CI (BTF-086b).
6. DEFERIDO: testes de providers social (youtube/meta) com mocks + alinhar vitest/coverage-v8 no social.

> 2026-07-03: deploy freeze encerrado. f96fc806 + docs pushed (staging); BTF-080/086 resolvidos nesta rodada (blob 2.5.0, audit gate bloqueante, form-data/dompurify/js-yaml corrigidos). Prod deps 0 high.
