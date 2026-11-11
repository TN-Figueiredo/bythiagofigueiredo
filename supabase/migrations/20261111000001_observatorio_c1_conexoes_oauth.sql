-- =============================================================================
-- MIGRATION: observatorio_c1_conexoes_oauth
-- C1: login OAuth próprio para o conector do Observatório (spec c1, seções 4.7 e 7).
--
-- REGRA (4.7): a linha em `pipeline_api_keys` é a única que a porta lê; os demais estados (liberação, conexão, tokens)
-- propagam para ela por gatilho, na mesma transação. Os gatilhos só propagam REVOGAÇÃO (old.revoked_at is null e
-- new.revoked_at is not null), só para linhas com revoked_at is null, e nunca copiam null: reabrir é ato explícito por linha.
-- `expires_at` propaga por igualdade, só para linhas abertas.
--
-- Seções (uma migration só, idempotente): 1 tabelas/check de origin/RLS/privilégios · 2 a 6 (tarefas T2 a T6).
-- =============================================================================

-- ===== Seção 1: tabelas, check de origin, RLS e privilégios =====

create table if not exists public.obs_ai_liberacoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revogada_por text,
  bloqueios text[] not null default '{}'::text[],
  constraint obs_ai_liberacoes_id_site_unico unique (id, site_id),
  constraint obs_ai_liberacoes_revogada_por_valor check (revogada_por in ('dono', 'lgpd', 'vencida')),
  constraint obs_ai_liberacoes_revogada_par check ((revoked_at is null) = (revogada_por is null)),
  constraint obs_ai_liberacoes_expira_finita check (isfinite(expires_at))
);
create unique index if not exists obs_ai_liberacoes_uma_aberta
  on public.obs_ai_liberacoes (site_id, user_id) where revoked_at is null;

create table if not exists public.obs_ai_conexoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  liberacao_id uuid not null,
  cliente text not null,
  key_id uuid not null references public.pipeline_api_keys(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revogada_por text,
  constraint obs_ai_conexoes_key_unica unique (key_id),
  constraint obs_ai_conexoes_cliente_valor check (cliente in ('claude', 'chatgpt', 'gemini')),
  constraint obs_ai_conexoes_revogada_por_valor check (revogada_por in ('dono_cliente', 'dono_pessoa', 'vencida', 'lgpd')),
  constraint obs_ai_conexoes_revogada_par check ((revoked_at is null) = (revogada_por is null)),
  constraint obs_ai_conexoes_liberacao_fk foreign key (liberacao_id, site_id)
    references public.obs_ai_liberacoes (id, site_id) on delete cascade
);
create unique index if not exists obs_ai_conexoes_uma_aberta
  on public.obs_ai_conexoes (site_id, user_id, cliente) where revoked_at is null;
create index if not exists idx_obs_ai_conexoes_liberacao on public.obs_ai_conexoes (liberacao_id);

create table if not exists public.obs_ai_oauth_clientes (
  client_id text primary key,
  redirect_uris text[] not null,
  cliente text,
  created_at timestamptz not null default now(),
  aprovado_em timestamptz
);
create index if not exists idx_obs_ai_clientes_created on public.obs_ai_oauth_clientes (created_at);

create table if not exists public.obs_ai_oauth_pedidos (
  hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  state text,
  scope text not null,
  resource text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  expires_at timestamptz not null,
  consumido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_obs_ai_pedidos_expires on public.obs_ai_oauth_pedidos (expires_at);

create table if not exists public.obs_ai_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  hash text not null,
  tipo text not null,
  conexao_id uuid not null references public.obs_ai_conexoes(id) on delete cascade,
  client_id text not null,
  code_challenge text,
  redirect_uri text,
  familia uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint obs_ai_oauth_tokens_hash_unico unique (hash),
  constraint obs_ai_oauth_tokens_tipo_valor check (tipo in ('acesso', 'renovacao', 'codigo'))
);
create index if not exists idx_obs_ai_tokens_familia on public.obs_ai_oauth_tokens (familia);
create index if not exists idx_obs_ai_tokens_conexao on public.obs_ai_oauth_tokens (conexao_id);
create index if not exists idx_obs_ai_tokens_expires on public.obs_ai_oauth_tokens (expires_at);
create index if not exists idx_obs_ai_tokens_client on public.obs_ai_oauth_tokens (client_id);

create table if not exists public.obs_ai_rate_ip (
  grain text not null,
  ip_hash text not null,
  bucket timestamptz not null,
  n integer not null default 0,
  primary key (grain, ip_hash, bucket)
);

create table if not exists public.obs_ai_rate_pessoa (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  n integer not null default 0,
  primary key (user_id, bucket)
);

-- RLS ligada nas 7; só liberações e conexões têm leitura (quem administra o site); o resto só o serviço.
alter table public.obs_ai_liberacoes enable row level security;
alter table public.obs_ai_conexoes enable row level security;
alter table public.obs_ai_oauth_clientes enable row level security;
alter table public.obs_ai_oauth_pedidos enable row level security;
alter table public.obs_ai_oauth_tokens enable row level security;
alter table public.obs_ai_rate_ip enable row level security;
alter table public.obs_ai_rate_pessoa enable row level security;

revoke all on table public.obs_ai_liberacoes, public.obs_ai_conexoes, public.obs_ai_oauth_clientes,
  public.obs_ai_oauth_pedidos, public.obs_ai_oauth_tokens, public.obs_ai_rate_ip, public.obs_ai_rate_pessoa
  from anon, authenticated;
grant select on table public.obs_ai_liberacoes, public.obs_ai_conexoes to authenticated;

drop policy if exists "obs_ai_liberacoes_select" on public.obs_ai_liberacoes;
create policy "obs_ai_liberacoes_select" on public.obs_ai_liberacoes
  for select using (public.can_admin_site_users(site_id));
drop policy if exists "obs_ai_conexoes_select" on public.obs_ai_conexoes;
create policy "obs_ai_conexoes_select" on public.obs_ai_conexoes
  for select using (public.can_admin_site_users(site_id));

-- origin do registro de acesso (Phil I3): derruba TODO check que cita origin, qualquer que seja o nome, e recria o novo.
-- Nunca `drop constraint if exists <nome>`: nome errado deixaria dois checks vivos e toda aprovação viraria 503.
-- >>> origin
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.obs_ai_access_log'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%origin%'
  loop
    execute format('alter table public.obs_ai_access_log drop constraint %I', r.conname);
  end loop;
  alter table public.obs_ai_access_log
    add constraint obs_ai_access_log_origin_check check (origin in ('botao', 'mcp', 'oauth'));
end $$;
-- <<< origin

-- ===== Seção 2: elegibilidade, teto e taxas =====

-- Elegibilidade (K13): null = elegível. Pessoa ausente é pessoa apagada. Apagamento = pedido confirmado (fase 1) e não cancelado.
create or replace function public.obs_ai_motivo_inelegivel(p_user uuid, p_site uuid, p_agora timestamptz)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_existe boolean;
  v_ban timestamptz;
begin
  select true, u.banned_until into v_existe, v_ban from auth.users u where u.id = p_user;
  if v_existe is not true then return 'apagamento'; end if;
  if exists (select 1 from public.lgpd_requests l
             where l.user_id = p_user and l.type = 'account_deletion'
               and l.phase_1_completed_at is not null and l.cancelled_at is null) then
    return 'apagamento';
  end if;
  if v_ban is not null and v_ban > p_agora then return 'banida'; end if;
  if public.can_view_site_as(p_user, p_site) is not true then return 'sem_vinculo'; end if;
  return null;
end $$;
revoke all on function public.obs_ai_motivo_inelegivel(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_motivo_inelegivel(uuid, uuid, timestamptz) to service_role;

-- Teto de 2 pessoas por site: liberações ativas ∪ chaves do perfil ativas (com pessoa) ∪ {p_user}.
create or replace function public.obs_ai_conferir_teto(p_site uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('obs_ai_teto:' || p_site::text));
  select count(distinct x.u) into v_n from (
    select l.user_id as u from public.obs_ai_liberacoes l
      where l.site_id = p_site and l.revoked_at is null and l.expires_at > now()
    union
    select k.user_id from public.pipeline_api_keys k
      where k.site_id = p_site and k.revoked_at is null and k.expires_at > now()
        and 'observatorio_leitura' = any(k.permissions) and k.user_id is not null
    union
    select p_user
  ) x where x.u is not null;
  if v_n > 2 then
    raise exception 'obs_ai_teto' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.obs_ai_conferir_teto(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_ai_conferir_teto(uuid, uuid) to service_role;

-- Gatilho: encurtar nunca soma pessoa; só conta se a linha resultante é ativa.
create or replace function public.obs_ai_tg_teto()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is null then return new; end if;
  if not (new.revoked_at is null and new.expires_at is not null and new.expires_at > now()) then return new; end if;
  if tg_op = 'UPDATE'
     and old.revoked_at is null and old.expires_at is not null and old.expires_at > now()
     and old.user_id is not distinct from new.user_id
     and new.expires_at <= old.expires_at then
    return new;
  end if;
  perform public.obs_ai_conferir_teto(new.site_id, new.user_id);
  return new;
end $$;
revoke all on function public.obs_ai_tg_teto() from public, anon, authenticated;
grant execute on function public.obs_ai_tg_teto() to service_role;

drop trigger if exists obs_ai_teto_liberacoes on public.obs_ai_liberacoes;
create trigger obs_ai_teto_liberacoes
  before insert or update of revoked_at, expires_at on public.obs_ai_liberacoes
  for each row when (new.revoked_at is null)
  execute function public.obs_ai_tg_teto();

drop trigger if exists obs_ai_teto_chaves on public.pipeline_api_keys;
create trigger obs_ai_teto_chaves
  before insert or update of revoked_at, expires_at on public.pipeline_api_keys
  for each row when (new.revoked_at is null and 'observatorio_leitura' = any(new.permissions))
  execute function public.obs_ai_tg_teto();

-- Taxa v2: minuto e dia por chave, dia por PESSOA. O dia vira à meia-noite UTC (21:00 BRT), como a v1. A v1 não é tocada (D-4).
create or replace function public.obs_ai_rate_hit_v2(p_key uuid, p_user uuid, p_now timestamptz)
returns table (no_minuto integer, no_dia integer, no_dia_pessoa integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then raise exception 'obs_ai_rate_hit_v2: p_user nulo'; end if;
  return query
  with m as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'minuto', date_trunc('minute', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n),
  d as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'dia', date_trunc('day', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n),
  p as (
    insert into public.obs_ai_rate_pessoa as r (user_id, bucket, n)
    values (p_user, date_trunc('day', p_now, 'UTC'), 1)
    on conflict (user_id, bucket) do update set n = r.n + 1 returning r.n)
  select (select m.n from m), (select d.n from d), (select p.n from p);
end $$;
revoke all on function public.obs_ai_rate_hit_v2(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_rate_hit_v2(uuid, uuid, timestamptz) to service_role;

-- Baldes por IP (DCR 'register' e '/authorize'): balde da hora por hash; globais do dia só somam o pedido ACEITO (Phil I1);
-- 5.000 baldes novos por dia: acima disso não insere e devolve estourou (n = p_limite + 1, para o app recusar também por n).
create or replace function public.obs_ai_rate_ip_hit(p_grain text, p_hash text, p_now timestamptz, p_limite integer, p_teto_dia integer)
returns table (n integer, n_dia integer, estourou boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_hora timestamptz := date_trunc('hour', p_now, 'UTC');
  v_dia timestamptz := date_trunc('day', p_now, 'UTC');
  v_n integer;
  v_novo boolean := false;
  v_dia_n integer;
  v_baldes integer;
  v_estourou boolean := false;
begin
  if p_grain is null or p_grain not in ('register', 'authorize') then
    raise exception 'obs_ai_rate_ip_hit: grain invalido';
  end if;
  select coalesce((select b.n from public.obs_ai_rate_ip b where b.grain = 'baldes_dia' and b.ip_hash = 'global' and b.bucket = v_dia), 0)
    into v_baldes;
  if v_baldes >= 5000 and not exists (
       select 1 from public.obs_ai_rate_ip b where b.grain = p_grain || '_hora' and b.ip_hash = p_hash and b.bucket = v_hora) then
    v_estourou := true;
    v_n := p_limite + 1;
  else
    insert into public.obs_ai_rate_ip as r (grain, ip_hash, bucket, n)
    values (p_grain || '_hora', p_hash, v_hora, 1)
    on conflict (grain, ip_hash, bucket) do update set n = least(r.n + 1, p_limite + 1)
    returning r.n, (r.xmax::text = '0') into v_n, v_novo;
  end if;
  if not v_estourou and v_n <= p_limite then
    insert into public.obs_ai_rate_ip as r (grain, ip_hash, bucket, n)
    values (p_grain || '_dia', 'global', v_dia, 1)
    on conflict (grain, ip_hash, bucket) do update set n = least(r.n + 1, p_teto_dia + 1)
    returning r.n into v_dia_n;
    if v_novo then
      insert into public.obs_ai_rate_ip as r (grain, ip_hash, bucket, n)
      values ('baldes_dia', 'global', v_dia, 1)
      on conflict (grain, ip_hash, bucket) do update set n = least(r.n + 1, 5001);
    end if;
  else
    select coalesce((select g.n from public.obs_ai_rate_ip g where g.grain = p_grain || '_dia' and g.ip_hash = 'global' and g.bucket = v_dia), 0)
      into v_dia_n;
  end if;
  return query select v_n, v_dia_n, v_estourou;
end $$;
revoke all on function public.obs_ai_rate_ip_hit(text, text, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.obs_ai_rate_ip_hit(text, text, timestamptz, integer, integer) to service_role;

-- ===== Seção 3: propagação de revogação, resolvedor de token =====

-- Liberação → conexões e chaves (4.7). Só REVOGAÇÃO propaga (nunca null), só para linhas abertas; expires_at por igualdade, só chaves abertas.
-- Ordem de locks (liberação → conexão → tokens): a liberação já está travada pelo UPDATE; a conexão cascateia para chave e tokens.
create or replace function public.obs_ai_tg_liberacao_propaga()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.obs_ai_conexoes c
       set revoked_at = new.revoked_at,
           revogada_por = case new.revogada_por when 'dono' then 'dono_pessoa' when 'lgpd' then 'lgpd' else 'vencida' end
     where c.liberacao_id = new.id and c.revoked_at is null;
    update public.pipeline_api_keys k set revoked_at = new.revoked_at
     where k.revoked_at is null
       and k.id in (select c.key_id from public.obs_ai_conexoes c where c.liberacao_id = new.id);
  end if;
  if new.expires_at is distinct from old.expires_at then
    update public.pipeline_api_keys k set expires_at = new.expires_at
     where k.revoked_at is null and k.expires_at is distinct from new.expires_at
       and k.id in (select c.key_id from public.obs_ai_conexoes c where c.liberacao_id = new.id);
  end if;
  return new;
end $$;
revoke all on function public.obs_ai_tg_liberacao_propaga() from public, anon, authenticated;
grant execute on function public.obs_ai_tg_liberacao_propaga() to service_role;

drop trigger if exists obs_ai_liberacao_propaga on public.obs_ai_liberacoes;
create trigger obs_ai_liberacao_propaga
  after update of revoked_at, expires_at on public.obs_ai_liberacoes
  for each row execute function public.obs_ai_tg_liberacao_propaga();

-- Conexão → linha da chave e tokens abertos (inclui o código, que ainda não foi trocado).
create or replace function public.obs_ai_tg_conexao_propaga()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.pipeline_api_keys k set revoked_at = new.revoked_at
     where k.id = new.key_id and k.revoked_at is null;
    update public.obs_ai_oauth_tokens t set revoked_at = new.revoked_at
     where t.conexao_id = new.id and t.revoked_at is null;
  end if;
  return new;
end $$;
revoke all on function public.obs_ai_tg_conexao_propaga() from public, anon, authenticated;
grant execute on function public.obs_ai_tg_conexao_propaga() to service_role;

drop trigger if exists obs_ai_conexao_propaga on public.obs_ai_conexoes;
create trigger obs_ai_conexao_propaga
  after update of revoked_at on public.obs_ai_conexoes
  for each row execute function public.obs_ai_tg_conexao_propaga();

-- Resolvedor único: token → conexão → liberação → chave numa consulta. Linha só se os quatro têm revoked_at nulo e token,
-- liberação e chave têm validade > p_agora. Ignora used_at (quem consome decide).
create or replace function public.obs_ai_resolver_token(p_hash text, p_tipo text, p_agora timestamptz)
returns table (token_id uuid, conexao_id uuid, key_id uuid, user_id uuid, site_id uuid, cliente text, client_id text,
               familia uuid, used_at timestamptz, token_expira timestamptz, liberacao_expira timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, c.id, k.id, c.user_id, c.site_id, c.cliente, t.client_id, t.familia, t.used_at, t.expires_at, b.expires_at
    from public.obs_ai_oauth_tokens t
    join public.obs_ai_conexoes c on c.id = t.conexao_id
    join public.obs_ai_liberacoes b on b.id = c.liberacao_id
    join public.pipeline_api_keys k on k.id = c.key_id
   where t.hash = p_hash and t.tipo = p_tipo
     and t.revoked_at is null and c.revoked_at is null and b.revoked_at is null and k.revoked_at is null
     and t.expires_at > p_agora and b.expires_at > p_agora and k.expires_at > p_agora
$$;
revoke all on function public.obs_ai_resolver_token(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_resolver_token(text, text, timestamptz) to service_role;

-- ===== Seção 4: funções do dono =====
-- Todas pegam o lock da pessoa primeiro e depois a liberação (for update); ordem fixa liberação → conexão → tokens.
-- Negativa de regra = return com motivo; erro de infraestrutura = raise.

create or replace function public.obs_ai_liberar(p_user uuid, p_site uuid, p_dias integer, p_agora timestamptz)
returns table (motivo text, liberacao_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_aberta public.obs_ai_liberacoes%rowtype;
  v_bloq text[] := '{}'::text[];
  v_motivo text;
  v_id uuid;
  v_exp timestamptz;
begin
  if p_dias is null or p_dias < 1 or p_dias > 366 then
    return query select 'dias'::text, null::uuid, null::timestamptz; return;
  end if;
  perform pg_advisory_xact_lock(hashtext('obs_ai:' || p_user::text));
  select * into v_aberta from public.obs_ai_liberacoes l
   where l.site_id = p_site and l.user_id = p_user and l.revoked_at is null for update;
  if found then
    if v_aberta.expires_at > p_agora then
      return query select 'ja_liberada'::text, v_aberta.id, v_aberta.expires_at; return;
    end if;
    -- vencida e não revogada: encerra (o gatilho propaga às conexões, chaves e tokens) e herda os bloqueios
    update public.obs_ai_liberacoes l set revoked_at = p_agora, revogada_por = 'vencida' where l.id = v_aberta.id;
    v_bloq := v_aberta.bloqueios;
  end if;
  v_motivo := public.obs_ai_motivo_inelegivel(p_user, p_site, p_agora);
  if v_motivo is not null then
    return query select v_motivo, null::uuid, null::timestamptz; return;
  end if;
  v_exp := p_agora + make_interval(days => p_dias);
  begin
    insert into public.obs_ai_liberacoes (site_id, user_id, expires_at, bloqueios)
      values (p_site, p_user, v_exp, v_bloq) returning id into v_id;
  exception when raise_exception then
    if sqlerrm = 'obs_ai_teto' then
      return query select 'teto'::text, null::uuid, null::timestamptz; return;
    end if;
    raise;
  end;
  return query select null::text, v_id, v_exp;
end $$;
revoke all on function public.obs_ai_liberar(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_liberar(uuid, uuid, integer, timestamptz) to service_role;

create or replace function public.obs_ai_liberar_cliente(p_user uuid, p_site uuid, p_cliente text)
returns table (motivo text, bloqueios text[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_bloq text[];
begin
  perform pg_advisory_xact_lock(hashtext('obs_ai:' || p_user::text));
  select l.id into v_id from public.obs_ai_liberacoes l
   where l.site_id = p_site and l.user_id = p_user and l.revoked_at is null for update;
  if v_id is null then
    return query select 'sem_liberacao'::text, null::text[]; return;
  end if;
  update public.obs_ai_liberacoes l set bloqueios = array_remove(l.bloqueios, p_cliente)
   where l.id = v_id returning l.bloqueios into v_bloq;
  return query select null::text, v_bloq;
end $$;
revoke all on function public.obs_ai_liberar_cliente(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.obs_ai_liberar_cliente(uuid, uuid, text) to service_role;

create or replace function public.obs_ai_estender_liberacao(p_liberacao uuid, p_dias integer, p_agora timestamptz)
returns table (motivo text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid;
  v_lib public.obs_ai_liberacoes%rowtype;
  v_exp timestamptz;
begin
  if p_dias is null or p_dias < 1 or p_dias > 366 then
    return query select 'dias'::text, null::timestamptz; return;
  end if;
  select l.user_id into v_user from public.obs_ai_liberacoes l where l.id = p_liberacao;
  if v_user is null then
    return query select 'nao_encontrada'::text, null::timestamptz; return;
  end if;
  perform pg_advisory_xact_lock(hashtext('obs_ai:' || v_user::text));
  select * into v_lib from public.obs_ai_liberacoes l where l.id = p_liberacao for update;
  if not found then
    return query select 'nao_encontrada'::text, null::timestamptz; return;
  end if;
  if v_lib.revoked_at is not null then
    return query select 'revogada'::text, v_lib.expires_at; return;
  end if;
  v_exp := p_agora + make_interval(days => p_dias);
  begin
    update public.obs_ai_liberacoes l set expires_at = v_exp where l.id = p_liberacao;
  exception when raise_exception then
    if sqlerrm = 'obs_ai_teto' then
      return query select 'teto'::text, v_lib.expires_at; return;
    end if;
    raise;
  end;
  return query select null::text, v_exp;
end $$;
revoke all on function public.obs_ai_estender_liberacao(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_estender_liberacao(uuid, integer, timestamptz) to service_role;

create or replace function public.obs_ai_cortar(p_user uuid, p_site uuid, p_cliente text, p_agora timestamptz)
returns table (tabela text, id uuid, motivo text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_lib_id uuid;
  v_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtext('obs_ai:' || p_user::text));
  -- 1º a liberação (aberta, ativa ou vencida), depois conexão e tokens
  select l.id into v_lib_id from public.obs_ai_liberacoes l
   where l.site_id = p_site and l.user_id = p_user and l.revoked_at is null for update;
  if v_lib_id is null then
    return query select null::text, null::uuid, 'sem_liberacao'::text; return;
  end if;
  if p_cliente is not null then
    update public.obs_ai_liberacoes l set bloqueios = array_append(l.bloqueios, p_cliente)
     where l.id = v_lib_id and not (p_cliente = any(l.bloqueios));
    return query select 'obs_ai_liberacoes'::text, v_lib_id, null::text;
    return query
      with u as (
        update public.obs_ai_conexoes c set revoked_at = p_agora, revogada_por = 'dono_cliente'
         where c.liberacao_id = v_lib_id and c.cliente = p_cliente and c.revoked_at is null returning c.id)
      select 'obs_ai_conexoes'::text, u.id, null::text from u;
  else
    select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids from public.obs_ai_conexoes c
     where c.liberacao_id = v_lib_id and c.revoked_at is null;
    update public.obs_ai_liberacoes l set revoked_at = p_agora, revogada_por = 'dono' where l.id = v_lib_id;
    return query select 'obs_ai_liberacoes'::text, v_lib_id, null::text;
    return query select 'obs_ai_conexoes'::text, x, null::text from unnest(v_ids) x;
    return query
      with u as (
        update public.pipeline_api_keys k set revoked_at = p_agora
         where k.site_id = p_site and k.user_id = p_user and k.revoked_at is null
           and 'observatorio_leitura' = any(k.permissions) returning k.id)
      select 'pipeline_api_keys'::text, u.id, null::text from u;
  end if;
end $$;
revoke all on function public.obs_ai_cortar(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_cortar(uuid, uuid, text, timestamptz) to service_role;

create or replace function public.obs_ai_revogar_lgpd(p_user uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('obs_ai:' || p_user::text));
  with l as (
    select b.id from public.obs_ai_liberacoes b where b.user_id = p_user and b.revoked_at is null for update)
  update public.obs_ai_liberacoes b set revoked_at = now(), revogada_por = 'lgpd'
   from l where b.id = l.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.obs_ai_revogar_lgpd(uuid) from public, anon, authenticated;
grant execute on function public.obs_ai_revogar_lgpd(uuid) to service_role;
