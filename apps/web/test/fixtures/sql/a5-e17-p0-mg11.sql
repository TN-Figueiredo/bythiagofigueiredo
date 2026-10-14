-- MG11 · A5 · E17 passo 0 · o direito "ver desempenho privado"
-- Aditiva e idempotente. Sem concessão em site_private_viewers, can_view_private_site responde igual a can_edit_site.
set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Guardas: o que esta migration supõe que já existe.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.can_edit_site(uuid)') is null
     or to_regprocedure('public.can_view_site(uuid)') is null
     or to_regprocedure('public.can_admin_site_users(uuid)') is null then
    raise exception 'MG11 depende dos helpers de RBAC v3 (can_edit_site, can_view_site, can_admin_site_users)';
  end if;
  if to_regclass('public.pipeline_api_keys') is null or to_regclass('public.audit_log') is null
     or to_regclass('public.site_memberships') is null or to_regclass('public.organization_members') is null then
    raise exception 'MG11 depende de pipeline_api_keys, audit_log, site_memberships e organization_members';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quem tem o direito. Sem linha em vigor (revoked_at nulo), sem direito.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.site_private_viewers (
  site_id    uuid not null references public.sites(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,   -- nulo = quem concedeu foi apagado (LGPD)
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,                                         -- nulo = em vigor
  revoked_by uuid references auth.users(id) on delete set null,   -- (emenda 1: D-m2) quem retirou; nulo = em vigor, ou quem retirou foi apagado (LGPD)
  primary key (site_id, user_id),
  -- (emenda 2: D-m-g) quem retirou só existe numa linha retirada; reconceder limpa as duas colunas na mesma instrução
  constraint site_private_viewers_revoked_by_so_retirada check (revoked_by is null or revoked_at is not null)
);
create index if not exists idx_site_private_viewers_user on public.site_private_viewers (user_id);
create index if not exists idx_site_private_viewers_granted_by on public.site_private_viewers (granted_by) where granted_by is not null;
create index if not exists idx_site_private_viewers_revoked_by on public.site_private_viewers (revoked_by) where revoked_by is not null;   -- (emenda 1: D-m2)

alter table public.site_private_viewers enable row level security;
drop policy if exists "site_private_viewers_select" on public.site_private_viewers;
create policy "site_private_viewers_select" on public.site_private_viewers
  for select using (public.can_admin_site_users(site_id) or user_id = (select auth.uid()));
-- Nenhuma policy de escrita: conceder e retirar é do dono, pelo SQL do runbook (papel postgres) ou por service role.
revoke all on table public.site_private_viewers from anon;
revoke insert, update, delete, truncate, references, trigger on table public.site_private_viewers from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. As funções com o usuário por parâmetro (só service role) e a de sessão (a que as policies chamam).
--    Espelho das de sessão (is_super_admin, is_org_admin, can_view_site, can_edit_site), com p_user no lugar de auth.uid().
--    Nenhuma lê o GUC app.site_id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_super_admin_as(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = p_user and om.role = 'org_admin' and o.parent_org_id is null);
$$;

create or replace function public.is_org_admin_as(p_user uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.organization_members om
                 where om.user_id = p_user and om.org_id = p_org and om.role = 'org_admin');
$$;

create or replace function public.can_view_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.sites s where s.id = p_site and public.is_org_admin_as(p_user, s.org_id))
      or exists (select 1 from public.site_memberships m where m.site_id = p_site and m.user_id = p_user);
$$;

create or replace function public.can_edit_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.sites s where s.id = p_site and public.is_org_admin_as(p_user, s.org_id))
      or exists (select 1 from public.site_memberships m where m.site_id = p_site and m.user_id = p_user and m.role = 'editor');
$$;

-- Quem edita vê. Quem não edita vê só com as DUAS coisas: linha em vigor E vínculo com o site.
-- (Para quem não edita, "ver o site" é ter linha em site_memberships: administrador de organização e
--  super-administrador já passaram em can_edit_site_as. Por isso o vínculo é conferido direto na tabela,
--  sem repetir a cadeia de can_view_site_as: uma busca pela chave primária a mais, e só quando há concessão.)
create or replace function public.can_view_private_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_edit_site_as(p_user, p_site)
      or exists (select 1 from public.site_private_viewers v
                 where v.site_id = p_site and v.user_id = p_user and v.revoked_at is null
                   and exists (select 1 from public.site_memberships m where m.site_id = v.site_id and m.user_id = v.user_id));
$$;

-- A de sessão: uma linha, para não haver duas cópias da regra do direito.
create or replace function public.can_view_private_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view_private_site_as(auth.uid(), p_site_id);
$$;

revoke all on function public.is_super_admin_as(uuid) from public, anon, authenticated;
revoke all on function public.is_org_admin_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_site_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_edit_site_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_private_site_as(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_super_admin_as(uuid) to service_role;
grant execute on function public.is_org_admin_as(uuid, uuid) to service_role;
grant execute on function public.can_view_site_as(uuid, uuid) to service_role;
grant execute on function public.can_edit_site_as(uuid, uuid) to service_role;
grant execute on function public.can_view_private_site_as(uuid, uuid) to service_role;
-- A de sessão é chamada pelas policies com o papel de quem consulta: mesmos privilégios de can_edit_site.
revoke all on function public.can_view_private_site(uuid) from public;
grant execute on function public.can_view_private_site(uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A troca das policies de leitura: toda tabela da lista das doze QUE JÁ EXISTE passa ao direito.
--    As que ainda não existem nascem certas pelo bloco PL da migration delas (que acha a função criada acima).
--    drop e create no mesmo arquivo: não há instante sem policy.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_outras text;
begin
  foreach t in array array[
    'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
    'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
    'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks'
  ] loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_view_private_site(site_id))', t || '_select', t);
    select string_agg(p.policyname, ', ' order by p.policyname) into v_outras
      from pg_catalog.pg_policies p
     where p.schemaname = 'public' and p.tablename = t and p.policyname <> t || '_select';
    if v_outras is not null then
      raise exception 'MG11: a tabela % tem policy fora do padrão (%): classificar antes de aplicar', t, v_outras;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rastro de quem concedeu e retirou: uma linha em audit_log a cada insert e a cada update que escreve revoked_at.
--    (O gatilho genérico tg_audit_mutation lê NEW.id, que esta tabela não tem.)
--    (emenda 1: D-m1 e S-I5) "update OF revoked_at": o "on delete set null" de granted_by e de revoked_by é um update que
--    não cita revoked_at, então apagar quem concedeu ou quem retirou (LGPD) não grava linha nova com o id apagado.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_site_private_viewers_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.revoked_at is null then 'private_view_granted' else 'private_view_revoked' end;
  elsif old.revoked_at is null and new.revoked_at is not null then
    v_action := 'private_view_revoked';
  elsif old.revoked_at is not null and new.revoked_at is null then
    v_action := 'private_view_granted';
  else
    v_action := 'private_view_changed';
  end if;
  select s.org_id into v_org from public.sites s where s.id = new.site_id;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  values (auth.uid(), v_action, 'site_private_viewers', new.user_id, v_org, new.site_id,
          case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end $$;
revoke all on function public.tg_site_private_viewers_audit() from public, anon, authenticated;

drop trigger if exists audit_site_private_viewers on public.site_private_viewers;
create trigger audit_site_private_viewers
  after insert or update of revoked_at on public.site_private_viewers
  for each row execute function public.tg_site_private_viewers_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Do degrau 2, sem código que use ainda: a chave por pessoa, o registro de acesso de IA e o contador de taxa.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pipeline_api_keys add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.pipeline_api_keys add column if not exists expires_at timestamptz;
create index if not exists idx_pipeline_api_keys_user on public.pipeline_api_keys (user_id) where user_id is not null;
-- A permissão do perfil não se mistura com nenhuma outra (a chave do perfil só lê o Observatório).
alter table public.pipeline_api_keys drop constraint if exists pipeline_api_keys_observatorio_leitura_sozinha;
alter table public.pipeline_api_keys add constraint pipeline_api_keys_observatorio_leitura_sozinha
  check (not ('observatorio_leitura' = any (permissions)) or permissions = array['observatorio_leitura']::text[]);
-- (controlador 14/10: pedido do degrau 2, progress.md) validade sempre finita: 'infinity' em expires_at nunca venceria, e o código só compara datas finitas.
alter table public.pipeline_api_keys drop constraint if exists pipeline_api_keys_expires_at_finita;
alter table public.pipeline_api_keys add constraint pipeline_api_keys_expires_at_finita
  check (expires_at is null or isfinite(expires_at));
-- (controlador 14/10: M-2 do degrau 2) a chave do perfil exige validade. Não existe coluna de "perfil": o perfil é a permissão
-- 'observatorio_leitura' em permissions (lib/pipeline/chave.ts: PERFIL, ehDoPerfil). Não se pede o mesmo para user_id: o
-- "on delete set null" precisa poder anulá-lo no apagamento da pessoa (LGPD).
alter table public.pipeline_api_keys drop constraint if exists pipeline_api_keys_perfil_exige_validade;
alter table public.pipeline_api_keys add constraint pipeline_api_keys_perfil_exige_validade
  check (not ('observatorio_leitura' = any (permissions)) or expires_at is not null);

create table if not exists public.obs_ai_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,     -- quem pediu; nulo = a pessoa foi apagada (LGPD)
  key_id uuid references public.pipeline_api_keys(id) on delete set null,   -- nulo = origem 'botao'
  origin text not null check (origin in ('botao', 'mcp')),
  action text not null,
  params jsonb not null default '{}'::jsonb,                     -- ids, janela, formato. NUNCA a pergunta nem a resposta
  included_private boolean not null,
  output_chars integer,
  result text not null check (result in ('ok', 'recusado', 'limite'))
);
create index if not exists idx_oaal_key_at on public.obs_ai_access_log (key_id, at desc);
create index if not exists idx_oaal_user_at on public.obs_ai_access_log (user_id, at desc);
create index if not exists idx_oaal_site_at on public.obs_ai_access_log (site_id, at desc);
-- (controlador 14/10: I2 da revisão por commit do degrau 2) "a linha mais antiga" e o "delete … where at < corte" da poda
-- varreriam a tabela inteira sem um índice com at na frente.
create index if not exists idx_oaal_at on public.obs_ai_access_log (at);
alter table public.obs_ai_access_log enable row level security;
drop policy if exists "obs_ai_access_log_select" on public.obs_ai_access_log;
create policy "obs_ai_access_log_select" on public.obs_ai_access_log
  for select using (public.can_admin_site_users(site_id));
revoke all on table public.obs_ai_access_log from anon;
revoke insert, update, delete, truncate, references, trigger on table public.obs_ai_access_log from authenticated;

create table if not exists public.obs_ai_rate (
  key_id uuid not null references public.pipeline_api_keys(id) on delete cascade,
  grain text not null check (grain in ('minuto', 'dia')),
  bucket timestamptz not null,                                   -- início do minuto ou do dia, em UTC
  n integer not null default 0,
  primary key (key_id, grain, bucket)
);
alter table public.obs_ai_rate enable row level security;       -- sem policy nenhuma: só service role
revoke all on table public.obs_ai_rate from anon, authenticated;

create or replace function public.obs_ai_rate_hit(p_key uuid, p_now timestamptz)
returns table (no_minuto integer, no_dia integer)
language sql security invoker set search_path = '' as $$
  with m as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'minuto', date_trunc('minute', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n),
  d as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'dia', date_trunc('day', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n)
  select (select m.n from m), (select d.n from d);
$$;
revoke all on function public.obs_ai_rate_hit(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_rate_hit(uuid, timestamptz) to service_role;

comment on table public.site_private_viewers is 'A5 E17 passo 0: quem tem o direito "ver desempenho privado" do site. Sem linha com revoked_at nulo, sem direito.';
comment on function public.can_view_private_site(uuid) is 'A5 E17 passo 0: quem edita o site, ou quem tem vínculo com ele e linha em vigor em site_private_viewers. Não lê o GUC app.site_id.';
