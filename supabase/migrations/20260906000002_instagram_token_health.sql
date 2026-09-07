-- =============================================================================
-- MIGRATION: instagram_token_health — M1 (commit C1)
-- Spec: docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md §3.2
-- =============================================================================
-- EXPAND puro. Acrescenta:
--   1. as 9 colunas de saúde do token em instagram_accounts (+ grants para
--      authenticated; anon NÃO recebe nenhuma delas) e a RPC de episódio;
--   2. ops_alert_state + ops_alert_claim (rate limiter), a chave composta de
--      instagram_posts que COEXISTE com a unique global até C4, o índice de
--      instagram_sync_log, a CHECK de mode ampliada, a CHECK de consents e o
--      seed de consent_texts para social_feed_read;
--   3. instagram_deletion_requests, o fechamento de DML para anon/authenticated
--      e a queda das três policies *_staff_write.
--
-- Idempotente: add column if not exists, drop constraint/policy/function if
-- exists antes de create, create table if not exists, on conflict do nothing.
-- Único passo irreversível: o lower(handle) do bloco 1 (§7).
-- =============================================================================

-- ── 1. Colunas de saúde do token ────────────────────────────────────────────

alter table public.instagram_accounts
  add column if not exists token_refreshed_at     timestamptz,
  add column if not exists token_error            text,
  add column if not exists token_error_at         timestamptz,
  add column if not exists token_error_mode       text,
  add column if not exists token_alert_sent_at    timestamptz,
  add column if not exists token_alert_attempt_at timestamptz,
  add column if not exists token_reprobe_at       timestamptz,
  add column if not exists ig_professional_id     text,
  add column if not exists ig_user_id_source      text not null default 'legacy';

-- CHECKs nomeadas (e não inline no ADD COLUMN) para que a migration seja
-- idempotente: `add column if not exists … check (…)` pula a CHECK junto da
-- coluna numa segunda execução e deixa a constraint com nome gerado.
alter table public.instagram_accounts
  drop constraint if exists instagram_accounts_token_error_mode_check;
alter table public.instagram_accounts
  add constraint instagram_accounts_token_error_mode_check
  check (token_error_mode is null or token_error_mode in ('daily', 'token_refresh'));

alter table public.instagram_accounts
  drop constraint if exists instagram_accounts_ig_user_id_source_check;
alter table public.instagram_accounts
  add constraint instagram_accounts_ig_user_id_source_check
  check (ig_user_id_source in ('oauth', 'legacy'));

-- authenticated está em allow-list de COLUNAS desde A3: toda coluna nova MUST
-- ser re-concedida (ratchet DB-gated em §6). A anon NÃO se concede nada — a
-- allow-list de anon permanece exatamente {id, site_id}.
grant select (token_refreshed_at, token_error, token_error_at, token_error_mode,
              token_alert_sent_at, token_alert_attempt_at, token_reprobe_at,
              ig_professional_id, ig_user_id_source)
  on public.instagram_accounts to authenticated;

-- Irreversível (§7): sweepTokenAlerts agrupa por 'h:' + lower(handle) e
-- normalizeHandle passa a minusculizar em C3.
update public.instagram_accounts set handle = lower(handle) where handle <> lower(handle);

-- ── RPC de episódio ─────────────────────────────────────────────────────────
-- Estilo de 20260703000003:30-36 (security definer + search_path = '').  BTF-097.

create or replace function public.instagram_mark_token_invalid(
  p_account uuid, p_site uuid, p_reason text, p_fatal boolean,
  p_force_reason boolean default false, p_mode text default null
) returns table (out_token_error_at timestamptz)
  language plpgsql security definer set search_path = ''
as $$ begin
  if not p_fatal then
    return query update public.instagram_accounts
      set token_error_at = now(), token_error_mode = p_mode,
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error_at is null
      returning token_error_at;
  elsif p_force_reason then
    return query update public.instagram_accounts
      set token_error = left(p_reason,500), token_error_at = coalesce(token_error_at, now()),
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error is distinct from left(p_reason,500)
      returning token_error_at;
  else
    return query update public.instagram_accounts
      set token_error = left(p_reason,500), token_error_at = coalesce(token_error_at, now()),
          token_alert_sent_at = null, token_alert_attempt_at = null, token_reprobe_at = null
      where id = p_account and site_id = p_site and token_error is null
      returning token_error_at;
  end if;
end $$;

revoke all on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text)
  from public, anon, authenticated;
grant execute on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text)
  to service_role;

comment on function public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text) is
  'Abre/atualiza o episódio de token de uma conta do Instagram. fatal:false abre o episódio com o mode; fatal:true grava o motivo sem sobrescrever; force_reason:true (Meta) sobrescreve e re-arma. Devolve 0 ou 1 linha. service_role only.';

-- ── 2. Rate limiter de alertas de operação ──────────────────────────────────
-- Claim atômico com janela: RATE LIMITER (comparação ESTRITA), nunca contador
-- de sequência. Variável de módulo em TS é proibida como contador (reseta em
-- todo cold start); a fonte da verdade é esta tabela.

create table if not exists public.ops_alert_state (
  key     text primary key,
  last_at timestamptz not null
);

alter table public.ops_alert_state enable row level security;
-- sem policies: só service_role (rolbypassrls; grant em schema.sql:7464)
revoke all on public.ops_alert_state from anon, authenticated;

create or replace function public.ops_alert_claim(
  p_key text, p_min_interval interval default interval '1 day'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  insert into public.ops_alert_state (key, last_at) values (p_key, now())
    on conflict (key) do update set last_at = now()
    where public.ops_alert_state.last_at < now() - p_min_interval
    returning key into v_key;
  return v_key is not null;
end $$;

revoke all on function public.ops_alert_claim(text, interval) from public, anon, authenticated;
grant execute on function public.ops_alert_claim(text, interval) to service_role;

comment on function public.ops_alert_claim(text, interval) is
  'Rate limiter de alertas: devolve true só quando a chave não foi carimbada dentro de p_min_interval (comparação < estrita). Nunca é contador de sequência. service_role only.';

-- ── 2b. instagram_posts: chave composta que COEXISTE com a global até C4 ────
-- EXPAND: instagram_posts_ig_media_id_key (20260507190000:49-50) permanece; M2
-- (commit C4) a derruba dias depois, após o primeiro ciclo das 13:00 com C2.

alter table public.instagram_posts drop constraint if exists instagram_posts_account_media_key;
alter table public.instagram_posts add constraint instagram_posts_account_media_key
  unique (account_id, ig_media_id);

-- ── 2c. instagram_sync_log: índice das janelas + modos novos ────────────────

create index if not exists idx_instagram_sync_log_account_mode
  on public.instagram_sync_log (account_id, mode, started_at desc);

alter table public.instagram_sync_log drop constraint if exists instagram_sync_log_mode_check;
alter table public.instagram_sync_log add constraint instagram_sync_log_mode_check
  check (mode in ('daily','manual','token_refresh','deauthorize','data_deletion','rebind'));
-- A CHECK de status ('started','completed','failed') de 20260507190000:87-88 FICA
-- — nenhum valor novo de status é gravado por esta entrega.

-- ── 2d. Consentimento social_feed_read (LGPD Art. 7) ────────────────────────
-- CHECK em vigor antes daqui: 20260530000001:5-22 (10 valores).

alter table public.consents drop constraint if exists consents_category_check;
alter table public.consents add constraint consents_category_check check (
  category = any (array['cookie_functional','cookie_analytics','cookie_marketing','newsletter',
    'newsletter_analytics','privacy_policy','terms_of_service','social_integration',
    'notification_email','notification_push','social_feed_read']::text[]));

insert into public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at)
values (
  'social_feed_read_v1_pt-BR', 'social_feed_read', 'pt-BR', '1.0',
  $pt$Autorizo este site a ler os posts públicos, o nome de usuário e as imagens da conta profissional do Instagram que conectei, para exibi-los na página inicial. Os dados são obtidos da Meta Platforms, Inc. (EUA, sob cláusulas contratuais-padrão) e as imagens ficam copiadas na Vercel enquanto a conta estiver conectada. Para revogar, use *Disconnect* nas configurações do CMS (apaga a cópia local do token) e remova o app em Instagram → Configurações → Apps e sites (a Meta não oferece revogação pelo servidor; o token permanece válido lá por até 60 dias). Um pedido de exclusão de dados feito pela Meta apaga tudo imediatamente; o registro do pedido é mantido por 180 dias como prova.$pt$,
  now(), null
), (
  'social_feed_read_v1_en', 'social_feed_read', 'en', '1.0',
  $en$I authorize this site to read the public posts, the username and the images of the Instagram professional account I connected, in order to display them on the home page. The data is obtained from Meta Platforms, Inc. (USA, under standard contractual clauses) and the images are kept copied on Vercel for as long as the account stays connected. To revoke, use *Disconnect* in the CMS settings (this deletes the local copy of the token) and remove the app under Instagram → Settings → Apps and websites (Meta does not offer server-side revocation; the token remains valid there for up to 60 days). A data deletion request made by Meta erases everything immediately; the record of the request is kept for 180 days as proof.$en$,
  now(), null
)
on conflict (category, locale, version) do nothing;   -- formato 20260524000002:23-63

-- ── 3. Registro de pedidos de exclusão vindos da Meta ───────────────────────
-- O registro do pedido é mantido por 180 dias como prova (texto social_feed_read).
-- site_id ON DELETE SET NULL: o registro sobrevive à remoção do site.

create table if not exists public.instagram_deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  ig_user_id        text not null,
  site_id           uuid references public.sites(id) on delete set null,
  requested_at      timestamptz not null default now(),
  completed_at      timestamptz
);

alter table public.instagram_deletion_requests enable row level security;
revoke all on public.instagram_deletion_requests from anon, authenticated;

-- ── 3b. Escrita exclusivamente por service client ───────────────────────────
-- Desde A3 anon e authenticated estão em allow-list de COLUNAS para SELECT
-- (anon = exatamente {id, site_id}, o que o EXISTS das policies *_public_read
-- dereferencia; authenticated = tudo menos access_token). Aqui some o DML.
-- Todas as actions de escrita já usam getSupabaseServiceClient()
-- (src/app/cms/(authed)/settings/actions.ts).

revoke insert, update, delete
  on public.instagram_accounts, public.instagram_posts, public.instagram_feed_slots
  from anon, authenticated;

-- Seguro: as duas policies *_public_read (20260507190000:111-119 e :139-147) não
-- têm cláusula TO ⇒ valem para PUBLIC, então derrubar as três *_staff_write não
-- remove o SELECT de authenticated sobre posts/slots.
drop policy if exists instagram_accounts_staff_write   on public.instagram_accounts;
drop policy if exists instagram_posts_staff_write      on public.instagram_posts;
drop policy if exists instagram_feed_slots_staff_write on public.instagram_feed_slots;

-- View: security_invoker + revoke + allow-list de colunas já foram feitos em A3
-- (migration instagram_public_view_lockdown). NÃO se repetem aqui — mas MUST ser
-- repetidos em qualquer recriação futura por DROP VIEW, porque o
-- ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon/authenticated de
-- 20260507000001_schema.sql:7460,7462 re-concede tudo à view recriada.

-- ── Recarga do cache do PostgREST (MUST ser a última linha do arquivo) ──────
notify pgrst, 'reload schema';
