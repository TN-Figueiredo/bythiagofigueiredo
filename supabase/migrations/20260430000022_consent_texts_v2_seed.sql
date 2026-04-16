-- Sprint 5a ops audit Fix 21 — consent_texts v2 seed.
--
-- The v1 seed (migration 012) produced short, shallow consent strings that
-- did not meet the LGPD Art. 8 bar for consent to be "livre, informada,
-- inequívoca e específica". A reviewer flagged that lines like
-- "Cookies de análise (Sentry Session Replay) para monitorar performance e
-- erros. Opcional." do not disclose:
--   - the categories of data collected
--   - the processor's identity, country, and legal basis for the transfer
--   - retention period
--   - how to withdraw consent
--
-- This migration inserts new v2 rows. We DO NOT touch v1 rows — those
-- remain as the accountability record for consents already collected under
-- the v1 wording. The app reads the latest non-superseded version per
-- (category, locale) via a sort on `effective_at DESC`.
--
-- This migration is idempotent (ON CONFLICT DO NOTHING), additive (no DDL),
-- and safe to re-apply.

-- Mark the v1 rows as superseded by v2 (for display in the audit history
-- view — it does NOT prevent reading v1 when evaluating an older consent).
UPDATE consent_texts
SET superseded_at = now()
WHERE version = '1.0' AND superseded_at IS NULL;

INSERT INTO consent_texts (id, category, locale, version, text_md) VALUES

-- ---------- cookie_functional (pt-BR) ----------
('cookie_functional_v2_pt-BR','cookie_functional','pt-BR','2.0',
$$**Cookies funcionais (sempre ativos)**

- **Dados coletados:** identificador de sessão, token CSRF, preferência de idioma (`preferred_locale`), id anônimo LGPD (`lgpd_anon_id`).
- **Finalidade:** autenticação, manutenção da sessão e prevenção de falsificação de requisições.
- **Processadores:** Supabase Inc. (Brasil, AWS sa-east-1 — LGPD Art. 33 I, dispensa transferência internacional).
- **Base legal:** LGPD Art. 7º V (execução de contrato) e Art. 7º IX (proteção do crédito + segurança) combinados com GDPR Art. 6(1)(b).
- **Retenção:** até 30 dias por cookie (`sb-access-token` = 1h; `sb-refresh-token` = 30d; `lgpd_anon_id` = 30d pré-login, 1 ano pós-login).
- **Como desativar:** esses cookies são indispensáveis; desativá-los via navegador fará com que o site não funcione corretamente. Você pode excluir sua conta em `/account/delete` para interromper definitivamente qualquer coleta.$$),

-- ---------- cookie_functional (en) ----------
('cookie_functional_v2_en','cookie_functional','en','2.0',
$$**Functional cookies (always active)**

- **Data collected:** session identifier, CSRF token, language preference (`preferred_locale`), anonymous LGPD id (`lgpd_anon_id`).
- **Purpose:** authentication, session maintenance, and CSRF prevention.
- **Processors:** Supabase Inc. (Brazil, AWS sa-east-1 — no international transfer under LGPD Art. 33 I).
- **Legal basis:** LGPD Art. 7 V (contract execution) and Art. 7 IX (security) combined with GDPR Art. 6(1)(b).
- **Retention:** up to 30 days per cookie (`sb-access-token` = 1h; `sb-refresh-token` = 30d; `lgpd_anon_id` = 30d pre-login, 1 year post-login).
- **How to disable:** these cookies are essential; disabling them in the browser will break the site. You may delete your account at `/account/delete` to stop all collection permanently.$$),

-- ---------- cookie_analytics (pt-BR) ----------
('cookie_analytics_v2_pt-BR','cookie_analytics','pt-BR','2.0',
$$**Cookies e telemetria de analytics (opcional — requer aceite)**

- **Dados coletados:** flag de consentimento em `localStorage` (`cookie_analytics_consent`, `lgpd_consent_v1.analytics`), tempos de carregamento de rota, amostra de performance de requisições, **gravação de sessão (Session Replay)** com caixas de entrada mascaradas (`maskAllInputs: true` — digitamos e senhas nunca são capturados).
- **Finalidade:** identificar lentidões, reproduzir bugs e melhorar a experiência.
- **Processadores:** Sentry (Functional Software Inc., Estados Unidos) sob Cláusulas Contratuais Padrão da Comissão Europeia (**SCCs GDPR Art. 46(2)(c)**) e DPA assinado. Transferência internacional para os EUA.
- **Base legal:** LGPD Art. 7º I (consentimento) e GDPR Art. 6(1)(a). **Sem este aceite, o Sentry roda no modo restrito de erros (legítimo interesse) descrito na Política de Privacidade §3, e nada de Tracing/Replay é enviado.**
- **Retenção:** 30 dias no Sentry; flag em `localStorage` durante 1 ano a partir do aceite.
- **Como revogar:** clique em "Gerenciar cookies" no rodapé, ou acesse `/account/settings/privacy`. A revogação interrompe o Session Replay em tempo real na mesma aba.$$),

-- ---------- cookie_analytics (en) ----------
('cookie_analytics_v2_en','cookie_analytics','en','2.0',
$$**Analytics cookies and telemetry (optional — requires consent)**

- **Data collected:** consent flag in `localStorage` (`cookie_analytics_consent`, `lgpd_consent_v1.analytics`), route load times, performance sampling of API requests, **Session Replay** with all input boxes masked (`maskAllInputs: true` — what you type and passwords are never recorded).
- **Purpose:** identify slow paths, reproduce bugs, and improve the experience.
- **Processors:** Sentry (Functional Software Inc., United States) under the European Commission's Standard Contractual Clauses (**SCCs GDPR Art. 46(2)(c)**) and a signed DPA. International transfer to the US.
- **Legal basis:** LGPD Art. 7 I (consent) and GDPR Art. 6(1)(a). **Without this consent, Sentry runs in the restricted errors-only mode under legitimate interest described in Privacy Policy §3, and no tracing/replay data is transmitted.**
- **Retention:** 30 days at Sentry; `localStorage` flag for 1 year from acceptance.
- **How to withdraw:** click "Manage cookies" in the footer, or open `/account/settings/privacy`. Withdrawal stops Session Replay at runtime in the same tab.$$),

-- ---------- cookie_marketing (pt-BR) ----------
('cookie_marketing_v2_pt-BR','cookie_marketing','pt-BR','2.0',
$$**Cookies de marketing (opcional — requer aceite)**

- **Dados coletados:** flag `lgpd_consent_v1.marketing` em `localStorage`. Nenhum pixel ou tag de terceiros é carregado hoje; a categoria existe apenas para acomodar parceiros futuros com consentimento granular — quando isso acontecer, esta descrição será atualizada e o consentimento v2 será reobtido.
- **Finalidade:** personalização de conteúdo e campanhas.
- **Processadores:** **nenhum no momento**. Ao contratarmos um parceiro (por exemplo, remarketing), atualizaremos esta descrição e solicitaremos novo consentimento.
- **Base legal:** LGPD Art. 7º I (consentimento) e GDPR Art. 6(1)(a).
- **Retenção:** flag em `localStorage` durante 1 ano a partir do aceite.
- **Como revogar:** clique em "Gerenciar cookies" no rodapé ou em `/account/settings/privacy`.$$),

-- ---------- cookie_marketing (en) ----------
('cookie_marketing_v2_en','cookie_marketing','en','2.0',
$$**Marketing cookies (optional — requires consent)**

- **Data collected:** the `lgpd_consent_v1.marketing` flag in `localStorage`. No third-party pixels or tags are loaded today; the category exists only to accommodate future partners with granular consent — when that happens, this description will be updated and v2 consent re-requested.
- **Purpose:** content and campaign personalization.
- **Processors:** **none at the moment**. When we onboard a partner (e.g. remarketing), we will update this description and request fresh consent.
- **Legal basis:** LGPD Art. 7 I (consent) and GDPR Art. 6(1)(a).
- **Retention:** the `localStorage` flag persists for 1 year from acceptance.
- **How to withdraw:** click "Manage cookies" in the footer or open `/account/settings/privacy`.$$),

-- ---------- privacy_policy (pt-BR) ----------
('privacy_policy_v2_pt-BR','privacy_policy','pt-BR','2.0',
$$**Política de Privacidade — v2 (informada, específica, inequívoca)**

- **Dados coletados:** conforme categorias descritas na [Política de Privacidade](/privacy) §2 (conta, newsletter, contato, conteúdo autoral, auditoria, cookies, telemetria de erros).
- **Processadores e países:** Supabase Inc. (BR), Brevo SAS (França — UE), Vercel Inc. (EUA), Sentry/Functional Software Inc. (EUA), Cloudflare Inc. (EUA) — transferências amparadas por SCCs (GDPR Art. 46(2)(c)) e DPAs, conforme detalhado na Política §4–5.
- **Base legal:** combinação de Art. 7º I (consentimento), Art. 7º V (contrato), Art. 7º VI (direitos), Art. 7º VIII (legítimo interesse, somente erros do Sentry) e Art. 7º IX (proteção do crédito/segurança) da LGPD. Base GDPR equivalente em Art. 6(1)(a–b, f).
- **Retenção:** conforme tabela §6 (auditoria = 5 anos; telemetria = 30 dias; newsletter = anonimizada no unsubscribe; exportações = 7 dias).
- **Como revogar:** você pode revogar o consentimento com base no Art. 7º I a qualquer momento — cancelando a assinatura da newsletter, retirando consentimentos no banner/settings, ou solicitando exclusão completa em `/account/delete`.

Ao clicar em "Aceitar" você confirma ter lido e entendido esta política (v2).$$),

-- ---------- privacy_policy (en) ----------
('privacy_policy_v2_en','privacy_policy','en','2.0',
$$**Privacy Policy — v2 (informed, specific, unambiguous)**

- **Data collected:** per the categories described in the [Privacy Policy](/privacy) §2 (account, newsletter, contact, authored content, audit, cookies, error telemetry).
- **Processors and countries:** Supabase Inc. (BR), Brevo SAS (France — EU), Vercel Inc. (US), Sentry/Functional Software Inc. (US), Cloudflare Inc. (US) — transfers covered by SCCs (GDPR Art. 46(2)(c)) and DPAs, as detailed in the policy §4–5.
- **Legal basis:** combination of Art. 7 I (consent), Art. 7 V (contract), Art. 7 VI (rights), Art. 7 VIII (legitimate interest, Sentry errors only) and Art. 7 IX (security) of the LGPD. Equivalent GDPR basis at Art. 6(1)(a–b, f).
- **Retention:** per the table in §6 (audit = 5 years; telemetry = 30 days; newsletter = anonymized on unsubscribe; exports = 7 days).
- **How to withdraw:** you may withdraw consent given under Art. 7 I at any time — by unsubscribing from the newsletter, revoking consents in the banner/settings, or requesting full deletion at `/account/delete`.

By clicking "Accept" you confirm you have read and understood this policy (v2).$$),

-- ---------- terms_of_service (pt-BR) ----------
('terms_of_service_v2_pt-BR','terms_of_service','pt-BR','2.0',
$$**Termos de Uso — v2**

- **O que você aceita:** as regras de uso do site bythiagofigueiredo.com descritas nos [Termos de Uso](/terms), incluindo foro (São Paulo/Brasil) e cap de responsabilidade (R$ 500).
- **Dados pessoais relacionados:** nenhum dado adicional é coletado pelo ato de aceitar os Termos; veja a Política de Privacidade §2 para a lista de dados já coletados pela conta.
- **Processadores:** os mesmos descritos na Política de Privacidade §4.
- **Base legal:** LGPD Art. 7º V (execução de contrato).
- **Retenção:** o registro do aceite é mantido por 5 anos após o encerramento da conta, para fins de accountability (LGPD Art. 37).
- **Como revogar:** você pode encerrar o contrato a qualquer momento solicitando a exclusão em `/account/delete`; o registro do aceite permanece pelo prazo de retenção acima.$$),

-- ---------- terms_of_service (en) ----------
('terms_of_service_v2_en','terms_of_service','en','2.0',
$$**Terms of Use — v2**

- **What you accept:** the rules of use of bythiagofigueiredo.com described in the [Terms of Use](/terms), including jurisdiction (São Paulo/Brazil) and liability cap (R$ 500).
- **Related personal data:** no additional data is collected by accepting the Terms; see the Privacy Policy §2 for data already collected by the account.
- **Processors:** the same described in the Privacy Policy §4.
- **Legal basis:** LGPD Art. 7 V (contract execution).
- **Retention:** the acceptance record is retained for 5 years after account closure for accountability (LGPD Art. 37).
- **How to withdraw:** you may terminate the contract at any time by requesting deletion at `/account/delete`; the acceptance record remains for the retention period above.$$),

-- ---------- newsletter (pt-BR) ----------
('newsletter_v2_pt-BR','newsletter','pt-BR','2.0',
$$**Newsletter bythiagofigueiredo — consentimento específico**

- **Dados coletados:** endereço de e-mail; IP e user-agent no momento da inscrição (LGPD Art. 9º — accountability do consentimento); versão do texto aceito.
- **Finalidade:** enviar e-mails com artigos, atualizações e comunicações relacionadas ao site. Sem remarketing, sem revenda, sem compartilhamento com anunciantes.
- **Processadores:** Supabase Inc. (armazenamento — BR) e Brevo SAS (envio de e-mails — França, UE, país adequado — GDPR Art. 45).
- **Base legal:** LGPD Art. 7º I (consentimento explícito opt-in) e GDPR Art. 6(1)(a).
- **Retenção:** enquanto você estiver inscrito. No unsubscribe, o e-mail é substituído pelo seu hash SHA-256 e IP/UA são removidos imediatamente (apenas o registro de consentimento + unsubscribe permanecem, por 5 anos, para accountability).
- **Como revogar:** clique em "Descadastrar" em qualquer e-mail, ou envie mensagem para privacidade@bythiagofigueiredo.com.$$),

-- ---------- newsletter (en) ----------
('newsletter_v2_en','newsletter','en','2.0',
$$**bythiagofigueiredo newsletter — specific consent**

- **Data collected:** email address; IP and user-agent at signup time (LGPD Art. 9 — consent accountability); version of the accepted text.
- **Purpose:** send emails with articles, updates, and site-related communications. No remarketing, no resale, no advertiser sharing.
- **Processors:** Supabase Inc. (storage — BR) and Brevo SAS (email delivery — France, EU, adequate country — GDPR Art. 45).
- **Legal basis:** LGPD Art. 7 I (explicit opt-in consent) and GDPR Art. 6(1)(a).
- **Retention:** for as long as you are subscribed. Upon unsubscribe, the email is replaced by its SHA-256 hash and IP/UA are removed immediately (only the consent + unsubscribe record remains, for 5 years, for accountability).
- **How to withdraw:** click "Unsubscribe" in any email, or write to privacidade@bythiagofigueiredo.com.$$)
ON CONFLICT (id) DO NOTHING;
