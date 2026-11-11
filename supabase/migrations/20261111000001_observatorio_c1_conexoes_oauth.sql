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
