-- ab_native_observados (F1a-dado, T13, spec §5.8): "troca observada" nos concorrentes. Dado de aprendizado do nicho; NÃO é o teste do dono
-- e não entra em nenhuma guarda. Duas tabelas e uma poda, em migration SEPARADA da T1 (o risco de uma não segura a outra).
--   ab_native_observados  uma linha por (site, vídeo do YouTube, campo) com troca vista; sem troca nenhuma linha é gravada.
--   ab_native_obs_cursor  "já avaliei até a rodada N", gravado ao fim de toda avaliação (com ou sem troca).
--   ab_native_obs_poda    365 d após ultima_atualizacao_em / avaliado_em, em lote com limite.
-- A purga (registro do export + competitor_channel_remove_archived) vem na migration seguinte (..._registro): NÃO levar esta ao db:push:prod sem ela.
-- Idempotente. Volta: drop function ab_native_obs_poda; drop table ab_native_obs_cursor, ab_native_observados.
set lock_timeout = '5s';

do $$
begin
  if to_regclass('public.yt_watch_alvos') is null then
    raise exception 'T13 depende da S4 (yt_watch_alvos)';
  end if;
end $$;

create table if not exists public.ab_native_observados (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  campo text not null check (campo in ('titulo','miniatura')),
  tipo_troca text not null check (tipo_troca in ('sequencial','alternada')),
  veredito text not null,
  versao_regra smallint not null,
  trocas jsonb not null check (jsonb_typeof(trocas) = 'array' and jsonb_array_length(trocas) <= 20),
  n_versoes smallint not null check (n_versoes >= 2),
  ficou jsonb,
  ficou_estado text not null check (ficou_estado in ('estavel','em_andamento','sem_desfecho')),
  motivo text check (motivo is null or motivo ~ '^[a-z0-9_]{1,40}$'),
  primeira_troca_em timestamptz not null,
  ultima_atualizacao_em timestamptz not null default now(),
  check (ficou_estado <> 'sem_desfecho' or motivo is not null),
  unique (site_id, youtube_video_id, campo)
);
create index if not exists ab_native_observados_atualizacao on public.ab_native_observados (ultima_atualizacao_em);

create table if not exists public.ab_native_obs_cursor (
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  avaliado_ate_rodada integer not null,
  avaliado_em timestamptz not null,
  avaliado_motivo text not null check (avaliado_motivo in ('ok','sem_publicacao')),
  unique (site_id, youtube_video_id)
);
create index if not exists ab_native_obs_cursor_avaliado on public.ab_native_obs_cursor (avaliado_em);

-- RLS como as tabelas da sonda (yt_watch_*): leitura sensível por can_view_private_site (ou can_edit_site); escrita só por service role.
alter table public.ab_native_observados enable row level security;
alter table public.ab_native_obs_cursor enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['ab_native_observados', 'ab_native_obs_cursor'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- Poda em lote com limite (par de poda na lista fechada do E10). A linha não segura o bruto: reter_ate de concorrente não é estendido.
create or replace function public.ab_native_obs_poda(p_agora timestamptz, p_lote integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n1 integer; n2 integer;
begin
  if p_agora is null or p_lote is null or p_lote < 1 or p_lote > 5000 then
    raise exception 'p_lote invalido' using errcode = '22023';
  end if;
  delete from public.ab_native_observados
   where id in (select id from public.ab_native_observados
                 where ultima_atualizacao_em < p_agora - interval '365 days' order by ultima_atualizacao_em limit p_lote);
  get diagnostics n1 = row_count;
  delete from public.ab_native_obs_cursor
   where (site_id, youtube_video_id) in (select site_id, youtube_video_id from public.ab_native_obs_cursor
                 where avaliado_em < p_agora - interval '365 days' order by avaliado_em limit p_lote);
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;
revoke all on function public.ab_native_obs_poda(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.ab_native_obs_poda(timestamptz, integer) to service_role;

reset lock_timeout;
