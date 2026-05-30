-- =============================================================================
-- 0003_seed.sql — Structural/config seed data.
-- Only runs on LOCAL db reset. Marked as "applied" on remote via migration repair.
-- Insert order respects FK dependencies.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. organizations (master org — parent_org_id IS NULL)
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, slug, parent_org_id, created_at, updated_at, adsense_publisher_id, adsense_refresh_token_enc, adsense_connected_at, adsense_last_sync_at, adsense_sync_status)
VALUES (
  '927a240f-06d8-4602-9a84-b7482da44ee2',
  'Figueiredo Technology',
  'figueiredo-tech',
  NULL,
  '2026-04-17 03:51:08.816185+00',
  '2026-04-17 21:06:54.734082+00',
  NULL, NULL, NULL, NULL,
  'disconnected'
) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. sites (bythiagofigueiredo — references org)
-- ---------------------------------------------------------------------------
INSERT INTO public.sites (id, org_id, name, slug, domains, default_locale, supported_locales, created_at, updated_at, contact_notification_email, primary_domain, cms_enabled, logo_url, primary_color, identity_type, twitter_handle, seo_default_og_image, timezone, short_domain)
VALUES (
  '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c',
  '927a240f-06d8-4602-9a84-b7482da44ee2',
  'Thiago Figueiredo',
  'bythiagofigueiredo',
  '{bythiagofigueiredo.com,www.bythiagofigueiredo.com}',
  'pt-BR',
  '{pt-BR,en}',
  '2026-04-17 03:51:08.816185+00',
  '2026-05-06 13:27:53.904037+00',
  'thiago@bythiagofigueiredo.com',
  'bythiagofigueiredo.com',
  true,
  NULL, NULL,
  'person',
  'tnFigueiredo',
  NULL,
  'America/Sao_Paulo',
  'go.bythiagofigueiredo.com'
) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. authors (default author — is_default=true, references site)
-- ---------------------------------------------------------------------------
INSERT INTO public.authors (id, user_id, name, slug, bio_md, avatar_url, created_at, updated_at, site_id, display_name, bio, social_links, avatar_color, sort_order, is_default, about_photo_url)
VALUES (
  'd8d4cbb9-8883-4344-b8a7-8b9bb72d087b',
  NULL,
  'Thiago Figueiredo',
  'thiago-figueiredo',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  'https://novkqtvcnsiwhkxihurk.supabase.co/storage/v1/object/public/author-avatars/d8d4cbb9-8883-4344-b8a7-8b9bb72d087b/avatar.webp?v=1777914849087',
  '2026-05-03 23:16:22.121302+00',
  '2026-05-04 17:53:12.43231+00',
  '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c',
  'Thiago Figueiredo',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  '{"instagram": "https://www.instagram.com/thiagonfigueiredo"}',
  '#6366f1',
  0,
  true,
  'https://novkqtvcnsiwhkxihurk.supabase.co/storage/v1/object/public/author-avatars/d8d4cbb9-8883-4344-b8a7-8b9bb72d087b/about.png?v=1777914640328'
) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. newsletter_types (main-pt only — references site + author)
-- ---------------------------------------------------------------------------
INSERT INTO public.newsletter_types (id, locale, name, tagline, color, active, sort_order, created_at, cadence_days, preferred_send_time, cadence_start_date, cadence_paused, last_sent_at, sender_name, sender_email, reply_to, max_bounce_rate_pct, site_id, slug, description, og_image_url, updated_at, color_dark, badge, cadence_label, landing_content, cadence_pattern, author_id, linked_tag_id)
VALUES (
  'main-pt',
  'pt-BR',
  'Diário do bythiago',
  'Pensamentos da beira do teclado',
  '#C14513',
  true,
  1,
  '2026-04-19 17:17:01.044558+00',
  7,
  '09:00:00',
  NULL,
  false,
  NULL,
  'Thiago Figueiredo',
  'newsletter@bythiagofigueiredo.com',
  NULL,
  5,
  '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c',
  'diario-do-bythiago',
  'Toda sexta, eu paro e escrevo o que aconteceu na semana — o post novo do blog, o vídeo do canal, o bug que me derrubou, o livro que tô lendo. É a newsletter principal, a que junta tudo num lugar só. Não é resumo formal: é mais carta pra um amigo que tá longe.',
  NULL,
  '2026-05-03 23:16:22.121302+00',
  '#FF8240',
  'principal',
  '1× por semana, sextas',
  '{"promise": ["o post mais recente, com nota pessoal de bastidor", "o vídeo da semana, com o que eu cortei e por quê", "3–5 links que eu salvei pra ler depois", "uma coisa pequena que aprendi (ou quebrei)"]}',
  '{"type": "every_n_days", "interval": 7}',
  'd8d4cbb9-8883-4344-b8a7-8b9bb72d087b',
  NULL
) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. consent_texts (ALL rows — LGPD accountability, multiple versions)
-- ---------------------------------------------------------------------------

-- v1 rows (superseded)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) VALUES
  ('cookie_functional_v1_pt-BR', 'cookie_functional', 'pt-BR', '1.0', 'Cookies necessários para o funcionamento básico do site (sessão, segurança). Sempre ativos.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('cookie_functional_v1_en', 'cookie_functional', 'en', '1.0', 'Cookies necessary for basic site operation (session, security). Always active.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('cookie_analytics_v1_pt-BR', 'cookie_analytics', 'pt-BR', '1.0', 'Cookies de análise (Sentry Session Replay) para monitorar performance e erros. Opcional.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('cookie_analytics_v1_en', 'cookie_analytics', 'en', '1.0', 'Analytics cookies (Sentry Session Replay) to monitor performance and errors. Optional.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('cookie_marketing_v1_pt-BR', 'cookie_marketing', 'pt-BR', '1.0', 'Cookies de marketing para personalização de conteúdo. Opcional.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('cookie_marketing_v1_en', 'cookie_marketing', 'en', '1.0', 'Marketing cookies for content personalization. Optional.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('privacy_policy_v1_pt-BR', 'privacy_policy', 'pt-BR', '1.0', 'Ao continuar, você concorda com nossa Política de Privacidade.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('privacy_policy_v1_en', 'privacy_policy', 'en', '1.0', 'By continuing, you agree to our Privacy Policy.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('terms_of_service_v1_pt-BR', 'terms_of_service', 'pt-BR', '1.0', 'Ao continuar, você concorda com nossos Termos de Uso.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('terms_of_service_v1_en', 'terms_of_service', 'en', '1.0', 'By continuing, you agree to our Terms of Use.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('newsletter_v1_pt-BR', 'newsletter', 'pt-BR', '1.0', 'Ao assinar, você concorda em receber emails do bythiagofigueiredo. Descadastre-se a qualquer momento.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00'),
  ('newsletter_v1_en', 'newsletter', 'en', '1.0', 'By subscribing, you agree to receive emails from bythiagofigueiredo. Unsubscribe anytime.', '2026-04-16 22:59:46.568258+00', '2026-04-16 23:51:24.837288+00')
ON CONFLICT DO NOTHING;

-- v2 rows
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) VALUES
  ('cookie_functional_v2_pt-BR', 'cookie_functional', 'pt-BR', '2.0', '**Cookies funcionais (sempre ativos)**

- **Dados coletados:** identificador de sessão, token CSRF, preferência de idioma (`preferred_locale`), id anônimo LGPD (`lgpd_anon_id`).
- **Finalidade:** autenticação, manutenção da sessão e prevenção de falsificação de requisições.
- **Processadores:** Supabase Inc. (Brasil, AWS sa-east-1 — LGPD Art. 33 I, dispensa transferência internacional).
- **Base legal:** LGPD Art. 7º V (execução de contrato) e Art. 7º IX (proteção do crédito + segurança) combinados com GDPR Art. 6(1)(b).
- **Retenção:** até 30 dias por cookie (`sb-access-token` = 1h; `sb-refresh-token` = 30d; `lgpd_anon_id` = 30d pré-login, 1 ano pós-login).
- **Como desativar:** esses cookies são indispensáveis; desativá-los via navegador fará com que o site não funcione corretamente. Você pode excluir sua conta em `/account/delete` para interromper definitivamente qualquer coleta.', '2026-04-16 23:51:24.837288+00', NULL),
  ('cookie_functional_v2_en', 'cookie_functional', 'en', '2.0', '**Functional cookies (always active)**

- **Data collected:** session identifier, CSRF token, language preference (`preferred_locale`), anonymous LGPD id (`lgpd_anon_id`).
- **Purpose:** authentication, session maintenance, and CSRF prevention.
- **Processors:** Supabase Inc. (Brazil, AWS sa-east-1 — no international transfer under LGPD Art. 33 I).
- **Legal basis:** LGPD Art. 7 V (contract execution) and Art. 7 IX (security) combined with GDPR Art. 6(1)(b).
- **Retention:** up to 30 days per cookie (`sb-access-token` = 1h; `sb-refresh-token` = 30d; `lgpd_anon_id` = 30d pre-login, 1 year post-login).
- **How to disable:** these cookies are essential; disabling them in the browser will break the site. You may delete your account at `/account/delete` to stop all collection permanently.', '2026-04-16 23:51:24.837288+00', NULL),
  ('cookie_analytics_v2_pt-BR', 'cookie_analytics', 'pt-BR', '2.0', '**Cookies e telemetria de analytics (opcional — requer aceite)**

- **Dados coletados:** flag de consentimento em `localStorage` (`cookie_analytics_consent`, `lgpd_consent_v1.analytics`), tempos de carregamento de rota, amostra de performance de requisições, **gravação de sessão (Session Replay)** com caixas de entrada mascaradas (`maskAllInputs: true` — digitamos e senhas nunca são capturados).
- **Finalidade:** identificar lentidões, reproduzir bugs e melhorar a experiência.
- **Processadores:** Sentry (Functional Software Inc., Estados Unidos) sob Cláusulas Contratuais Padrão da Comissão Europeia (**SCCs GDPR Art. 46(2)(c)**) e DPA assinado. Transferência internacional para os EUA.
- **Base legal:** LGPD Art. 7º I (consentimento) e GDPR Art. 6(1)(a). **Sem este aceite, o Sentry roda no modo restrito de erros (legítimo interesse) descrito na Política de Privacidade §3, e nada de Tracing/Replay é enviado.**
- **Retenção:** 30 dias no Sentry; flag em `localStorage` durante 1 ano a partir do aceite.
- **Como revogar:** clique em "Gerenciar cookies" no rodapé, ou acesse `/account/settings/privacy`. A revogação interrompe o Session Replay em tempo real na mesma aba.', '2026-04-16 23:51:24.837288+00', NULL),
  ('cookie_analytics_v2_en', 'cookie_analytics', 'en', '2.0', '**Analytics cookies and telemetry (optional — requires consent)**

- **Data collected:** consent flag in `localStorage` (`cookie_analytics_consent`, `lgpd_consent_v1.analytics`), route load times, performance sampling of API requests, **Session Replay** with all input boxes masked (`maskAllInputs: true` — what you type and passwords are never recorded).
- **Purpose:** identify slow paths, reproduce bugs, and improve the experience.
- **Processors:** Sentry (Functional Software Inc., United States) under the European Commission''s Standard Contractual Clauses (**SCCs GDPR Art. 46(2)(c)**) and a signed DPA. International transfer to the US.
- **Legal basis:** LGPD Art. 7 I (consent) and GDPR Art. 6(1)(a). **Without this consent, Sentry runs in the restricted errors-only mode under legitimate interest described in Privacy Policy §3, and no tracing/replay data is transmitted.**
- **Retention:** 30 days at Sentry; `localStorage` flag for 1 year from acceptance.
- **How to withdraw:** click "Manage cookies" in the footer, or open `/account/settings/privacy`. Withdrawal stops Session Replay at runtime in the same tab.', '2026-04-16 23:51:24.837288+00', NULL),
  ('privacy_policy_v2_pt-BR', 'privacy_policy', 'pt-BR', '2.0', '**Política de Privacidade — v2 (informada, específica, inequívoca)**

- **Dados coletados:** conforme categorias descritas na [Política de Privacidade](/privacy) §2 (conta, newsletter, contato, conteúdo autoral, auditoria, cookies, telemetria de erros).
- **Processadores e países:** Supabase Inc. (BR), Brevo SAS (França — UE), Vercel Inc. (EUA), Sentry/Functional Software Inc. (EUA), Cloudflare Inc. (EUA) — transferências amparadas por SCCs (GDPR Art. 46(2)(c)) e DPAs, conforme detalhado na Política §4–5.
- **Base legal:** combinação de Art. 7º I (consentimento), Art. 7º V (contrato), Art. 7º VI (direitos), Art. 7º VIII (legítimo interesse, somente erros do Sentry) e Art. 7º IX (proteção do crédito/segurança) da LGPD. Base GDPR equivalente em Art. 6(1)(a–b, f).
- **Retenção:** conforme tabela §6 (auditoria = 5 anos; telemetria = 30 dias; newsletter = anonimizada no unsubscribe; exportações = 7 dias).
- **Como revogar:** você pode revogar o consentimento com base no Art. 7º I a qualquer momento — cancelando a assinatura da newsletter, retirando consentimentos no banner/settings, ou solicitando exclusão completa em `/account/delete`.

Ao clicar em "Aceitar" você confirma ter lido e entendido esta política (v2).', '2026-04-16 23:51:24.837288+00', NULL),
  ('privacy_policy_v2_en', 'privacy_policy', 'en', '2.0', '**Privacy Policy — v2 (informed, specific, unambiguous)**

- **Data collected:** per the categories described in the [Privacy Policy](/privacy) §2 (account, newsletter, contact, authored content, audit, cookies, error telemetry).
- **Processors and countries:** Supabase Inc. (BR), Brevo SAS (France — EU), Vercel Inc. (US), Sentry/Functional Software Inc. (US), Cloudflare Inc. (US) — transfers covered by SCCs (GDPR Art. 46(2)(c)) and DPAs, as detailed in the policy §4–5.
- **Legal basis:** combination of Art. 7 I (consent), Art. 7 V (contract), Art. 7 VI (rights), Art. 7 VIII (legitimate interest, Sentry errors only) and Art. 7 IX (security) of the LGPD. Equivalent GDPR basis at Art. 6(1)(a–b, f).
- **Retention:** per the table in §6 (audit = 5 years; telemetry = 30 days; newsletter = anonymized on unsubscribe; exports = 7 days).
- **How to withdraw:** you may withdraw consent given under Art. 7 I at any time — by unsubscribing from the newsletter, revoking consents in the banner/settings, or requesting full deletion at `/account/delete`.

By clicking "Accept" you confirm you have read and understood this policy (v2).', '2026-04-16 23:51:24.837288+00', NULL),
  ('terms_of_service_v2_pt-BR', 'terms_of_service', 'pt-BR', '2.0', '**Termos de Uso — v2**

- **O que você aceita:** as regras de uso do site bythiagofigueiredo.com descritas nos [Termos de Uso](/terms), incluindo foro (São Paulo/Brasil) e cap de responsabilidade (R$ 500).
- **Dados pessoais relacionados:** nenhum dado adicional é coletado pelo ato de aceitar os Termos; veja a Política de Privacidade §2 para a lista de dados já coletados pela conta.
- **Processadores:** os mesmos descritos na Política de Privacidade §4.
- **Base legal:** LGPD Art. 7º V (execução de contrato).
- **Retenção:** o registro do aceite é mantido por 5 anos após o encerramento da conta, para fins de accountability (LGPD Art. 37).
- **Como revogar:** você pode encerrar o contrato a qualquer momento solicitando a exclusão em `/account/delete`; o registro do aceite permanece pelo prazo de retenção acima.', '2026-04-16 23:51:24.837288+00', NULL),
  ('terms_of_service_v2_en', 'terms_of_service', 'en', '2.0', '**Terms of Use — v2**

- **What you accept:** the rules of use of bythiagofigueiredo.com described in the [Terms of Use](/terms), including jurisdiction (São Paulo/Brazil) and liability cap (R$ 500).
- **Related personal data:** no additional data is collected by accepting the Terms; see the Privacy Policy §2 for data already collected by the account.
- **Processors:** the same described in the Privacy Policy §4.
- **Legal basis:** LGPD Art. 7 V (contract execution).
- **Retention:** the acceptance record is retained for 5 years after account closure for accountability (LGPD Art. 37).
- **How to withdraw:** you may terminate the contract at any time by requesting deletion at `/account/delete`; the acceptance record remains for the retention period above.', '2026-04-16 23:51:24.837288+00', NULL),
  ('newsletter_v2_pt-BR', 'newsletter', 'pt-BR', '2.0', '**Newsletter bythiagofigueiredo — consentimento específico**

- **Dados coletados:** endereço de e-mail; IP e user-agent no momento da inscrição (LGPD Art. 9º — accountability do consentimento); versão do texto aceito.
- **Finalidade:** enviar e-mails com artigos, atualizações e comunicações relacionadas ao site. Sem remarketing, sem revenda, sem compartilhamento com anunciantes.
- **Processadores:** Supabase Inc. (armazenamento — BR) e Brevo SAS (envio de e-mails — França, UE, país adequado — GDPR Art. 45).
- **Base legal:** LGPD Art. 7º I (consentimento explícito opt-in) e GDPR Art. 6(1)(a).
- **Retenção:** enquanto você estiver inscrito. No unsubscribe, o e-mail é substituído pelo seu hash SHA-256 e IP/UA são removidos imediatamente (apenas o registro de consentimento + unsubscribe permanecem, por 5 anos, para accountability).
- **Como revogar:** clique em "Descadastrar" em qualquer e-mail, ou envie mensagem para privacidade@bythiagofigueiredo.com.', '2026-04-16 23:51:24.837288+00', NULL),
  ('newsletter_v2_en', 'newsletter', 'en', '2.0', '**bythiagofigueiredo newsletter — specific consent**

- **Data collected:** email address; IP and user-agent at signup time (LGPD Art. 9 — consent accountability); version of the accepted text.
- **Purpose:** send emails with articles, updates, and site-related communications. No remarketing, no resale, no advertiser sharing.
- **Processors:** Supabase Inc. (storage — BR) and Brevo SAS (email delivery — France, EU, adequate country — GDPR Art. 45).
- **Legal basis:** LGPD Art. 7 I (explicit opt-in consent) and GDPR Art. 6(1)(a).
- **Retention:** for as long as you are subscribed. Upon unsubscribe, the email is replaced by its SHA-256 hash and IP/UA are removed immediately (only the consent + unsubscribe record remains, for 5 years, for accountability).
- **How to withdraw:** click "Unsubscribe" in any email, or write to privacidade@bythiagofigueiredo.com.', '2026-04-16 23:51:24.837288+00', NULL)
ON CONFLICT DO NOTHING;

-- newsletter_analytics v1
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) VALUES
  ('newsletter_analytics_v1_pt-BR', 'newsletter_analytics', 'pt-BR', '1.0', 'Ao se inscrever, você concorda com o rastreamento de aberturas e cliques para melhorar nosso conteúdo. Processadores: Resend (EUA, SCCs). Retenção: 90 dias para IP/user-agent, agregados indefinidamente. Revogação: desative via preferências de assinatura ou solicite via tnfigueiredotv@gmail.com.', '2026-04-22 14:57:42.663818+00', NULL),
  ('newsletter_analytics_v1_en', 'newsletter_analytics', 'en', '1.0', 'By subscribing, you agree to open and click tracking to improve our content. Processors: Resend (US, SCCs). Retention: 90 days for IP/user-agent, aggregates kept indefinitely. Revocation: disable via subscription preferences or request via tnfigueiredotv@gmail.com.', '2026-04-22 14:57:42.663818+00', NULL)
ON CONFLICT DO NOTHING;

-- cookie_marketing v2 (superseded by v3)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) VALUES
  ('cookie_marketing_v2_en', 'cookie_marketing', 'en', '2.0', '**Marketing cookies (optional — requires consent)**

- **Data collected:** the `lgpd_consent_v1.marketing` flag in `localStorage`. No third-party pixels or tags are loaded today; the category exists only to accommodate future partners with granular consent — when that happens, this description will be updated and v2 consent re-requested.
- **Purpose:** content and campaign personalization.
- **Processors:** **none at the moment**. When we onboard a partner (e.g. remarketing), we will update this description and request fresh consent.
- **Legal basis:** LGPD Art. 7 I (consent) and GDPR Art. 6(1)(a).
- **Retention:** the `localStorage` flag persists for 1 year from acceptance.
- **How to withdraw:** click "Manage cookies" in the footer or open `/account/settings/privacy`.', '2026-04-16 23:51:24.837288+00', '2026-04-26 23:51:36.089793+00'),
  ('cookie_marketing_v2_pt-BR', 'cookie_marketing', 'pt-BR', '2.0', '**Cookies de marketing (opcional — requer aceite)**

- **Dados coletados:** flag `lgpd_consent_v1.marketing` em `localStorage`. Nenhum pixel ou tag de terceiros é carregado hoje; a categoria existe apenas para acomodar parceiros futuros com consentimento granular — quando isso acontecer, esta descrição será atualizada e o consentimento v2 será reobtido.
- **Finalidade:** personalização de conteúdo e campanhas.
- **Processadores:** **nenhum no momento**. Ao contratarmos um parceiro (por exemplo, remarketing), atualizaremos esta descrição e solicitaremos novo consentimento.
- **Base legal:** LGPD Art. 7º I (consentimento) e GDPR Art. 6(1)(a).
- **Retenção:** flag em `localStorage` durante 1 ano a partir do aceite.
- **Como revogar:** clique em "Gerenciar cookies" no rodapé ou em `/account/settings/privacy`.', '2026-04-16 23:51:24.837288+00', '2026-04-26 23:51:36.089793+00')
ON CONFLICT DO NOTHING;

-- cookie_marketing_ads v3 (current)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) VALUES
  ('cookie_marketing_ads_v3_pt-BR', 'cookie_marketing', 'pt-BR', '3.0', '**Cookies de marketing e publicidade**

Utilizamos serviços de publicidade de terceiros (Google AdSense) que podem armazenar cookies no seu navegador para exibir anúncios personalizados.

- **Dados coletados:** cookies `__gads`, `__gpi`, identificadores de dispositivo para segmentação publicitária.
- **Processadores:** Google Ireland Ltd (UE) + Google LLC (EUA) via SCCs.
- **Retenção:** controlada pelo Google, tipicamente 13 meses.
- **Revogação:** a qualquer momento via banner de cookies ou página de privacidade. Anúncios de terceiros serão substituídos por conteúdo editorial.', '2026-04-26 23:51:36.089793+00', NULL),
  ('cookie_marketing_ads_v3_en', 'cookie_marketing', 'en', '3.0', '**Marketing and advertising cookies**

We use third-party advertising services (Google AdSense) that may store cookies on your browser to display personalized ads.

- **Data collected:** `__gads`, `__gpi` cookies, device identifiers for ad targeting.
- **Processors:** Google Ireland Ltd (EU) + Google LLC (USA) via SCCs.
- **Retention:** controlled by Google, typically 13 months.
- **Revocation:** at any time via cookie banner or privacy page. Third-party ads will be replaced with editorial content.', '2026-04-26 23:51:36.089793+00', NULL)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. cron_config (all rows)
-- ---------------------------------------------------------------------------
INSERT INTO public.cron_config (key, value, updated_at) VALUES
  ('web_url', 'https://bythiagofigueiredo.com', '2026-04-17 01:08:34.205689+00'),
  ('cron_secret', 'ad0b8ea7eaeae5207af8c468e92f2d88708b22d075a89ca44adae7b4f51ce81b', '2026-04-17 01:09:26.301753+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. kill_switches (all rows)
-- ---------------------------------------------------------------------------
INSERT INTO public.kill_switches (id, enabled, reason, created_at, updated_at) VALUES
  ('kill_ads', true, 'Master switch for ad engine', '2026-04-26 01:22:26.735137+00', '2026-04-26 01:22:26.735137+00'),
  ('ads_house_enabled', true, 'House ads (cross-promotion)', '2026-04-26 01:22:26.735137+00', '2026-04-26 01:22:26.735137+00'),
  ('ads_cpa_enabled', false, 'CPA/paid ads (not yet launched)', '2026-04-26 01:22:26.735137+00', '2026-04-26 01:22:26.735137+00'),
  ('ads_placeholder_enabled', true, 'Placeholder ads (empty slot fillers)', '2026-04-26 01:22:26.735137+00', '2026-04-26 01:22:26.735137+00'),
  ('ads_google_enabled', false, 'Google AdSense integration — enable after configuring publisher ID', '2026-04-26 23:46:08.809601+00', '2026-04-26 23:46:08.809601+00'),
  ('ads_network_enabled', false, 'Master switch for third-party ad networks (AdSense, future: Amazon, Ezoic)', '2026-04-26 23:46:08.809601+00', '2026-04-26 23:46:08.809601+00'),
  ('ads_slot_post_top_banner', true, 'post:top:banner', '2026-04-26 01:22:26.88626+00', '2026-04-26 01:22:26.88626+00'),
  ('ads_slot_post_rail_anchor_left', true, 'post:rail:anchor-left', '2026-04-26 01:22:26.88626+00', '2026-04-26 01:22:26.88626+00'),
  ('ads_slot_post_rail_anchor', true, 'post:rail:anchor', '2026-04-26 01:22:26.88626+00', '2026-04-26 01:22:26.88626+00'),
  ('ads_slot_post_body_bookmark', true, 'post:body:bookmark', '2026-04-26 01:22:26.88626+00', '2026-04-26 01:22:26.88626+00'),
  ('ads_slot_post_footer_coda', true, 'post:footer:coda', '2026-04-26 01:22:26.88626+00', '2026-04-26 01:22:26.88626+00'),
  ('ads_slot_archive_top_doorman', true, 'archive:top:doorman', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('ads_slot_archive_break_anchor', true, 'archive:break:anchor', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('ads_slot_archive_grid_bookmark', true, 'archive:grid:bookmark', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('ads_slot_archive_footer_marginalia', true, 'archive:footer:marginalia', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('ads_slot_archive_footer_bowtie', true, 'archive:footer:bowtie', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. ad_placeholders (all rows)
-- ---------------------------------------------------------------------------
INSERT INTO public.ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, updated_at, app_id, brand_color, logo_url) VALUES
  ('post:body:bookmark', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.257979+00', 'bythiagofigueiredo', '#6B7280', NULL),
  ('post:rail:anchor', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.257979+00', 'bythiagofigueiredo', '#6B7280', NULL),
  ('post:footer:coda', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.257979+00', 'bythiagofigueiredo', '#6B7280', NULL),
  ('archive:top:doorman', false, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.364963+00', 'bythiagofigueiredo', '#f97316', NULL),
  ('archive:break:anchor', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.364963+00', 'bythiagofigueiredo', '#f97316', NULL),
  ('archive:grid:bookmark', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.364963+00', 'bythiagofigueiredo', '#f97316', NULL),
  ('archive:footer:marginalia', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.364963+00', 'bythiagofigueiredo', '#f97316', NULL),
  ('archive:footer:bowtie', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', NULL, 0, '2026-05-05 01:53:50.364963+00', 'bythiagofigueiredo', '#FF8240', NULL),
  ('post:top:banner', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '', 0, '2026-05-05 23:34:30.005+00', 'bythiagofigueiredo', '#6B7280', ''),
  ('post:rail:anchor-left', true, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '', 0, '2026-05-05 23:34:47.982+00', 'bythiagofigueiredo', '#6B7280', '')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. ad_slot_config (all rows — references site)
-- ---------------------------------------------------------------------------
INSERT INTO public.ad_slot_config (site_id, slot_key, house_enabled, cpa_enabled, google_enabled, template_enabled, network_adapters_order, network_config, aspect_ratio, iab_size, mobile_behavior, max_per_session, max_per_day, cooldown_ms, label, zone, accepted_types, created_at, updated_at) VALUES
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'post:top:banner', true, true, false, true, '{adsense}', '{}', '8:1', '728x90', 'keep', 1, 3, 3600000, 'Banner — Topo', 'banner', '{house,cpa}', '2026-04-26 23:51:35.919223+00', '2026-05-05 01:53:50.257979+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'post:rail:anchor-left', true, false, false, true, '{adsense}', '{}', '1:4', '160x600', 'hide', 1, 3, 3600000, 'Rail esquerdo', 'rail', '{house}', '2026-04-26 23:51:35.919223+00', '2026-05-05 01:53:50.257979+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'post:rail:anchor', false, true, false, true, '{adsense}', '{}', '6:5', '300x250', 'stack', 3, 6, 900000, 'Rail direito', 'rail', '{cpa}', '2026-04-26 23:51:35.919223+00', '2026-05-05 01:53:50.257979+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'post:body:bookmark', false, true, false, true, '{adsense}', '{}', '6:5', '300x250', 'keep', 2, 4, 1800000, 'Inline — Meio', 'inline', '{cpa}', '2026-04-26 23:51:35.919223+00', '2026-05-05 01:53:50.257979+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'post:footer:coda', true, true, false, true, '{adsense}', '{}', '4:1', '970x250', 'keep', 1, 2, 7200000, 'Block — Inferior', 'block', '{house,cpa}', '2026-04-26 23:51:35.919223+00', '2026-05-05 01:53:50.257979+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'archive:top:doorman', true, true, false, true, '{adsense}', '{}', '8:1', '728x90', 'hide', 1, 3, 3600000, 'Banner — Topo Archive', 'banner', '{house,cpa}', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'archive:break:anchor', false, true, false, true, '{adsense}', '{}', '16:3', NULL, 'stack', 2, 4, 1800000, 'Âncora Horizontal', 'inline', '{cpa}', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'archive:grid:bookmark', true, true, false, true, '{adsense}', '{}', '3:4', NULL, 'keep', 3, 6, 900000, 'Card no Grid', 'inline', '{house,cpa}', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'archive:footer:marginalia', true, true, false, true, '{adsense}', '{}', '16:3', NULL, 'keep', 1, 2, 3600000, 'Marginalia — Rodapé', 'block', '{house,cpa}', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00'),
  ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'archive:footer:bowtie', true, false, false, true, '{adsense}', '{}', '16:3', NULL, 'keep', 1, 1, 7200000, 'Newsletter CTA', 'block', '{house}', '2026-05-05 01:53:50.364963+00', '2026-05-05 01:53:50.364963+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. link_aggregation_watermark (singleton config row)
-- ---------------------------------------------------------------------------
INSERT INTO public.link_aggregation_watermark (id, last_processed_at) VALUES
  ('singleton', '2000-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;

COMMIT;
