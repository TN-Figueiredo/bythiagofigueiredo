-- Seed: waitlist launch-notification consent texts (both locales)
-- Idempotent: on conflict (id) do nothing

insert into public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at) values
  ('launch_notification:en:launch-notification-v1-2026-06', 'launch_notification', 'en', 'launch-notification-v1-2026-06',
   'Notify me by email when {name} launches. I can unsubscribe anytime.', now(), null),
  ('launch_notification:pt-BR:launch-notification-v1-2026-06', 'launch_notification', 'pt-BR', 'launch-notification-v1-2026-06',
   'Quero ser avisado(a) por email quando {name} for lançado. Posso cancelar quando quiser.', now(), null)
on conflict (id) do nothing;
