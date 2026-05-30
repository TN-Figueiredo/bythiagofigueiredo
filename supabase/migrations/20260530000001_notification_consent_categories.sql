-- BTF-NOTIF: Add notification_email and notification_push consent categories for LGPD Art. 7 compliance.
-- Email/push notification preferences require granular consent per delivery channel.

-- 1. Expand the CHECK constraint to include 'notification_email' and 'notification_push'
ALTER TABLE public.consents
  DROP CONSTRAINT IF EXISTS consents_category_check;

ALTER TABLE public.consents
  ADD CONSTRAINT consents_category_check CHECK (
    category = ANY (ARRAY[
      'cookie_functional'::text,
      'cookie_analytics'::text,
      'cookie_marketing'::text,
      'newsletter'::text,
      'newsletter_analytics'::text,
      'privacy_policy'::text,
      'terms_of_service'::text,
      'social_integration'::text,
      'notification_email'::text,
      'notification_push'::text
    ])
  );

-- 2. Seed consent texts for notification_email (pt-BR + en)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at)
VALUES
  (
    'notification_email_v1_pt-BR',
    'notification_email',
    'pt-BR',
    '1.0',
    '**Notificações por e-mail**

Ao ativar notificações por e-mail, você autoriza:

- **Envio de alertas** sobre eventos do CMS (pipeline, publicações, métricas)
- **Digest diário** com resumo de atividades

**Processador:** Resend Inc. (EUA, SCCs).
**Retenção:** Enquanto a preferência estiver ativa.
**Revogação:** Desative a qualquer momento nas configurações de notificação.',
    now(),
    NULL
  ),
  (
    'notification_email_v1_en',
    'notification_email',
    'en',
    '1.0',
    '**Email notifications**

By enabling email notifications, you authorize:

- **Sending alerts** about CMS events (pipeline, publications, metrics)
- **Daily digest** with activity summary

**Processor:** Resend Inc. (US, SCCs).
**Retention:** While the preference is active.
**Revocation:** Disable at any time in notification settings.',
    now(),
    NULL
  )
ON CONFLICT (category, locale, version) DO NOTHING;

-- 3. Seed consent texts for notification_push (pt-BR + en)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at)
VALUES
  (
    'notification_push_v1_pt-BR',
    'notification_push',
    'pt-BR',
    '1.0',
    '**Notificações push**

Ao ativar notificações push no navegador, você autoriza:

- **Envio de alertas em tempo real** sobre eventos do CMS (pipeline, publicações, métricas)
- **Armazenamento** do token de push subscription no servidor

**Processador:** Web Push Protocol (W3C standard) via servidor próprio.
**Retenção:** Token mantido enquanto a preferência estiver ativa. Removido imediatamente ao desativar.
**Revogação:** Desative a qualquer momento nas configurações de notificação ou nas permissões do navegador.',
    now(),
    NULL
  ),
  (
    'notification_push_v1_en',
    'notification_push',
    'en',
    '1.0',
    '**Push notifications**

By enabling browser push notifications, you authorize:

- **Sending real-time alerts** about CMS events (pipeline, publications, metrics)
- **Storage** of push subscription token on the server

**Processor:** Web Push Protocol (W3C standard) via own server.
**Retention:** Token kept while the preference is active. Removed immediately upon disabling.
**Revocation:** Disable at any time in notification settings or in browser permissions.',
    now(),
    NULL
  )
ON CONFLICT (category, locale, version) DO NOTHING;
