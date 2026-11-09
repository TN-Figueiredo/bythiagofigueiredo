-- Fecha a leitura de ad_inquiries (nome, e-mail, IP, UA, mensagem de terceiros), ad_revenue_daily e ad_campaigns
-- para qualquer `authenticated` (policies `using (true)` do schema de maio). Com o cadastro da Auth aberto em prod
-- (disable_signup=false, 09/11), qualquer pessoa que crie conta leria tudo. Todo leitor no app usa service role
-- (admin/ads/_actions, anuncie/actions, cron adsense-sync), que ignora RLS. Achado: Phil, revisão de código da A2 (I1).
-- O INSERT anon/authenticated do formulário público (/anuncie) continua. Idempotente.
drop policy if exists ad_inquiries_select_auth on public.ad_inquiries;
drop policy if exists ad_revenue_daily_select_auth on public.ad_revenue_daily;
drop policy if exists ad_campaigns_select_auth on public.ad_campaigns;
