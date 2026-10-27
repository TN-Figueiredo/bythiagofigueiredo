-- A5 X3: lista de playlists com ocultas (a chave não vê as privadas) fecha a volta; saída em duas leituras.
alter table public.competitor_playlist_reads add column if not exists list_total_results integer check (list_total_results >= 0);
alter table public.competitor_playlist_reads add column if not exists list_read_n integer check (list_read_n >= 0);
alter table public.competitor_playlists add column if not exists absent_day date;  -- 1º dia (SP) em que faltou numa lista com ocultas

drop function if exists public.competitor_x3_playlists_record(uuid, uuid, timestamptz, jsonb, boolean);
create or replace function public.competitor_x3_playlists_record(
  p_site uuid, p_channel uuid, p_now timestamptz, p_rows jsonb, p_complete boolean, p_ocultas boolean default false
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_ids jsonb;
  v_versoes integer;
  v_sumidas integer := 0;
  v_prev jsonb;
  v_max timestamptz;
  v_hoje date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_a_confirmar integer := 0;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or jsonb_typeof(p_rows) <> 'array' or p_complete is null or p_ocultas is null or (p_complete and p_ocultas) then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- J2, N5: portão monotônico no topo; execução abandonada com p_now velho não marca sumidas nem grava versão
  select max(q.last_seen_at) into v_max from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  if v_max is not null and p_now < v_max then
    return jsonb_build_object('atrasada', true, 'ids', '{}'::jsonb, 'versoes', 0, 'sumidas', 0, 'a_confirmar', 0);
  end if;
  -- Phil I-6: o último "visto" de cada playlist, lido ANTES do upsert que o sobrescreve
  select coalesce(jsonb_object_agg(q.playlist_id, q.last_seen_at), '{}'::jsonb) into v_prev
    from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  with lido as (
    select distinct on (x.playlist_id) x.*
      from jsonb_to_recordset(p_rows) as x(playlist_id text, title text, published_at timestamptz, item_count integer,
                                           privacy text, state_sha256 text, raw jsonb)
     order by x.playlist_id
  ), up as (
    insert into public.competitor_playlists as p
      (site_id, competitor_channel_id, playlist_id, title, published_at, item_count, privacy, state_sha256, first_seen_at, last_seen_at)
    select p_site, p_channel, l.playlist_id, l.title, l.published_at, l.item_count, l.privacy, l.state_sha256, p_now, p_now from lido l
    on conflict (competitor_channel_id, playlist_id) do update
      set title = excluded.title, published_at = excluded.published_at, item_count = excluded.item_count,
          privacy = excluded.privacy, state_sha256 = excluded.state_sha256, last_seen_at = excluded.last_seen_at,
          missing_since = null, absent_day = null
    returning p.id, p.playlist_id
  )
  select coalesce(jsonb_object_agg(up.playlist_id, up.id), '{}'::jsonb) into v_ids from up;

  -- versão nova só quando o hash difere do último gravado da playlist
  -- Yannis M-6: o "último" casa com o índice (observed_at desc, id desc), igual à X1
  insert into public.competitor_playlist_versions (playlist_ref, site_id, state_sha256, raw, prev_seen_at, observed_at)
  select distinct on (l.playlist_id) (v_ids ->> l.playlist_id)::uuid, p_site, l.state_sha256, l.raw, (v_prev ->> l.playlist_id)::timestamptz, p_now   -- Yannis: distinct on
    from jsonb_to_recordset(p_rows) as l(playlist_id text, state_sha256 text, raw jsonb)
   where l.state_sha256 is distinct from (
     select m.state_sha256 from public.competitor_playlist_versions m
      where m.playlist_ref = (v_ids ->> l.playlist_id)::uuid
      order by m.observed_at desc, m.id desc limit 1);
  get diagnostics v_versoes = row_count;

  if p_complete then
    update public.competitor_playlists p
       set missing_since = v_hoje, absent_day = null
     where p.competitor_channel_id = p_channel and p.missing_since is null
       and not (v_ids ? p.playlist_id);
    get diagnostics v_sumidas = row_count;
  elsif p_ocultas then
    -- lista com ocultas: a saída só vale com duas leituras em dias diferentes sem a playlist
    update public.competitor_playlists p
       set missing_since = v_hoje, absent_day = null
     where p.competitor_channel_id = p_channel and p.missing_since is null
       and p.absent_day is not null and p.absent_day < v_hoje
       and not (v_ids ? p.playlist_id);
    get diagnostics v_sumidas = row_count;
    update public.competitor_playlists p
       set absent_day = v_hoje
     where p.competitor_channel_id = p_channel and p.missing_since is null and p.absent_day is null
       and not (v_ids ? p.playlist_id);
    get diagnostics v_a_confirmar = row_count;
  end if;
  return jsonb_build_object('ids', v_ids, 'versoes', v_versoes, 'sumidas', v_sumidas, 'a_confirmar', v_a_confirmar);
end $$;

drop function if exists public.competitor_x3_visit_close(uuid, uuid, timestamptz, text, text, integer, integer, boolean, boolean, boolean);
create or replace function public.competitor_x3_visit_close(
  p_site uuid, p_channel uuid, p_now timestamptz, p_status text, p_reason text, p_units integer, p_left integer,
  p_lista_vazia boolean, p_secoes_vazias boolean, p_ciclo boolean,
  p_list_total integer default null, p_list_read integer default null
) returns void language plpgsql set search_path = '' as $$
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or p_status not in ('ok', 'parcial', 'erro') or p_units is null or p_units < 0 then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  insert into public.competitor_playlist_reads as r
    (competitor_channel_id, site_id, first_visit_at, last_visit_at, last_visit_day, last_status, last_reason, last_units, playlists_left,
     last_complete_at, last_cycle_at, empty_streak, sections_empty_streak, list_total_results, list_read_n)
  values (p_channel, p_site, p_now, p_now, (p_now at time zone 'America/Sao_Paulo')::date, p_status, p_reason, p_units, p_left,
          case when p_status = 'ok' then p_now end,
          case when p_status = 'ok' or coalesce(p_ciclo, false) then p_now end,
          case when coalesce(p_lista_vazia, false) then 1 else 0 end,
          case when coalesce(p_secoes_vazias, false) then 1 else 0 end,
          p_list_total, p_list_read)
  on conflict (competitor_channel_id) do update
    set last_visit_at = excluded.last_visit_at, last_visit_day = excluded.last_visit_day, last_status = excluded.last_status,
        last_reason = excluded.last_reason, list_total_results = excluded.list_total_results, list_read_n = excluded.list_read_n, last_units = excluded.last_units, playlists_left = excluded.playlists_left,
        last_complete_at = coalesce(excluded.last_complete_at, r.last_complete_at),
        last_cycle_at = coalesce(excluded.last_cycle_at, r.last_cycle_at),
        -- tri-state (Yannis): nulo preserva, false zera, true soma; first_visit_at nunca é atualizado (J4)
        empty_streak = case when p_lista_vazia is null then r.empty_streak when p_lista_vazia then least(r.empty_streak + 1, 100) else 0 end,
        sections_empty_streak = case when p_secoes_vazias is null then r.sections_empty_streak when p_secoes_vazias then least(r.sections_empty_streak + 1, 100) else 0 end
    -- Yannis M-1: gravação atrasada de uma execução abandonada nunca sobrescreve a visita mais nova
    where r.last_visit_at <= excluded.last_visit_at;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.competitor_x3_playlists_record(uuid, uuid, timestamptz, jsonb, boolean, boolean)',
    'public.competitor_x3_visit_close(uuid, uuid, timestamptz, text, text, integer, integer, boolean, boolean, boolean, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
