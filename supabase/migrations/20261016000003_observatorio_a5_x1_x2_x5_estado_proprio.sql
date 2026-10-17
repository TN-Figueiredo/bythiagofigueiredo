-- A5, X1 + X2 + X5 (parecer do Phil de 17/10, coleta antes de tela): o estado do vídeo e do canal próprios como SÉRIE com histórico de troca
-- (uma linha por estado distinto, a data da troca é o que a origem não devolve) e o contador público diário do vídeo próprio com mais de 14 dias.
-- Aditiva: três tabelas e duas funções novas (vazias); nada existente é alterado. Idempotente. Volta: drop das três tabelas e das duas funções.
-- Política: só o que é público ou do próprio dono. Fora do bruto: uploadStatus, failureReason, rejectionReason (nunca públicos), status.publishAt, status.selfDeclaredMadeForKids e contentDetails.hasCustomThumbnail (só o dono vê) e o que o
-- E18 já versiona (título, descrição, tags, miniaturas do vídeo). Sem dado pessoal de terceiros.

create table if not exists public.yt_own_video_state_raw (
  id bigint generated always as identity primary key,
  youtube_video_id text not null,          -- id de 11 caracteres do YouTube
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,
  -- quando esta leitura viu o estado novo (a troca aconteceu entre a leitura anterior e esta). A PRIMEIRA linha de cada vídeo/canal é
  -- "pelo menos desde": observed_at é o dia do deploy, não a data em que o estado começou.
  observed_at timestamptz not null default now()
);
create index if not exists idx_yt_own_video_state_raw_video on public.yt_own_video_state_raw (youtube_video_id, observed_at desc, id desc);

create table if not exists public.yt_own_channel_state_raw (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.youtube_channels(id) on delete cascade,   -- uuid de youtube_channels, não o UC... do YouTube
  site_id uuid not null references public.sites(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,
  observed_at timestamptz not null default now()
);
create index if not exists idx_yt_own_channel_state_raw_channel on public.yt_own_channel_state_raw (channel_id, observed_at desc, id desc);

-- Contador público do dia (dia de São Paulo). Nulo = a API não mandou (curtidas ocultas, comentários desligados); nunca 0 por falta.
create table if not exists public.yt_own_video_public_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  view_count bigint check (view_count >= 0),
  like_count bigint check (like_count >= 0),
  comment_count bigint check (comment_count >= 0),
  captured_at timestamptz not null default now(),
  primary key (youtube_video_id, day_pt),
  check (view_count is not null or like_count is not null or comment_count is not null)
);
create index if not exists idx_yt_own_video_public_daily_channel_day on public.yt_own_video_public_daily (channel_id, day_pt);

do $$
declare t text;
begin
  foreach t in array array['yt_own_video_state_raw', 'yt_own_channel_state_raw', 'yt_own_video_public_daily'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_select', t);
  end loop;
end $$;

-- Grava só o que mudou: compara com a última linha do mesmo vídeo. p_rows = [{youtube_video_id, site_id, channel_id, state_sha256, raw}].
-- Corrida (portão do Phil I-1): o lock consultivo por chave é tomado ANTES do insert, em ordem de chave (sem impasse entre lotes);
-- em plpgsql cada comando pega snapshot novo, então depois do lock o insert enxerga a linha que a outra transação commitou.
-- O mesmo vídeo duas vezes no lote conta uma vez (distinct on, a última do lote vale).
create or replace function public.yt_own_video_state_record(p_rows jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  k integer;
begin
  for r in
    select distinct on (x.youtube_video_id) x.youtube_video_id, x.site_id, x.channel_id, x.state_sha256, x.raw
      from jsonb_to_recordset(p_rows) as x(youtube_video_id text, site_id uuid, channel_id uuid, state_sha256 text, raw jsonb)
     order by x.youtube_video_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('yt_own_video_state:' || r.youtube_video_id, 0));
    insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw)
    select r.youtube_video_id, r.site_id, r.channel_id, r.state_sha256, r.raw
     where not exists (
       select 1 from public.yt_own_video_state_raw u
        where u.youtube_video_id = r.youtube_video_id
          and u.id = (select max(m.id) from public.yt_own_video_state_raw m where m.youtube_video_id = r.youtube_video_id)
          and u.state_sha256 = r.state_sha256);
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end;
$$;

create or replace function public.yt_own_channel_state_record(p_rows jsonb) returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  k integer;
begin
  for r in
    select distinct on (x.channel_id) x.channel_id, x.site_id, x.state_sha256, x.raw
      from jsonb_to_recordset(p_rows) as x(channel_id uuid, site_id uuid, state_sha256 text, raw jsonb)
     order by x.channel_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('yt_own_channel_state:' || r.channel_id::text, 0));
    insert into public.yt_own_channel_state_raw (channel_id, site_id, state_sha256, raw)
    select r.channel_id, r.site_id, r.state_sha256, r.raw
     where not exists (
       select 1 from public.yt_own_channel_state_raw u
        where u.channel_id = r.channel_id
          and u.id = (select max(m.id) from public.yt_own_channel_state_raw m where m.channel_id = r.channel_id)
          and u.state_sha256 = r.state_sha256);
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end;
$$;

revoke all on function public.yt_own_video_state_record(jsonb) from public, anon, authenticated;
revoke all on function public.yt_own_channel_state_record(jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_video_state_record(jsonb) to service_role;
grant execute on function public.yt_own_channel_state_record(jsonb) to service_role;
