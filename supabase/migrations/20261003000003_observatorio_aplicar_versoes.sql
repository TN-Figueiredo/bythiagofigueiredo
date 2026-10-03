-- =============================================================================
-- MIGRATION: observatorio_aplicar_versoes
-- =============================================================================
-- Observatório v2 — aplica o plano de versões de UM vídeo numa única transação:
-- fecha as versões antigas, abre as novas e grava as linhas de competitor_changes.
-- Se qualquer passo falhar (constraint, timeout), nada fica pela metade.
--
-- Idempotência: `create or replace function` (re-executar é seguro); revoke/grant
-- são idempotentes. Não cria tabelas, não altera dados, não apaga nada.
-- Segurança: security invoker + search_path fixo; execute só para service_role
-- (o sync roda com a service key).

create or replace function public.apply_competitor_version_plan(
  p_video_id uuid,
  p_close uuid[],
  p_open jsonb,
  p_changes jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_opened jsonb := '{}'::jsonb;
  v_changes integer := 0;
  r record;
  c record;
  v_id uuid;
begin
  update competitor_video_versions
     set is_current = false
   where id = any(coalesce(p_close, '{}'::uuid[]))
     and video_id = p_video_id
     and is_current;

  for r in
    select * from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as x(
      field text, value_text text, value_hash text, has_text boolean,
      thumb_etag text, thumb_dhash text, thumb_blob_url text, thumb_last_modified timestamptz,
      first_seen_at timestamptz, last_seen_at timestamptz, window_start timestamptz, precision text
    )
  loop
    insert into competitor_video_versions (
      video_id, field, value_text, value_hash, has_text, thumb_etag, thumb_dhash, thumb_blob_url,
      thumb_last_modified, first_seen_at, last_seen_at, window_start, precision, is_current
    ) values (
      p_video_id, r.field, r.value_text, r.value_hash, coalesce(r.has_text, true), r.thumb_etag, r.thumb_dhash,
      r.thumb_blob_url, r.thumb_last_modified, r.first_seen_at, r.last_seen_at, r.window_start, r.precision, true
    )
    returning id into v_id;
    v_opened := v_opened || jsonb_build_object(r.field, v_id);
  end loop;

  for c in
    select * from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as y(
      field text, site_id uuid, change_type text, old_title text, new_title text,
      old_thumbnail_url text, new_thumbnail_url text, view_count_at_change bigint,
      from_version_id uuid, window_start timestamptz, window_end timestamptz, precision text, detected_at timestamptz
    )
  loop
    insert into competitor_changes (
      video_id, site_id, change_type, old_title, new_title, old_thumbnail_url, new_thumbnail_url,
      view_count_at_change, from_version_id, to_version_id, window_start, window_end, precision, detected_at
    ) values (
      p_video_id, c.site_id, c.change_type, c.old_title, c.new_title, c.old_thumbnail_url, c.new_thumbnail_url,
      c.view_count_at_change, c.from_version_id, nullif(v_opened ->> c.field, '')::uuid,
      c.window_start, c.window_end, c.precision, coalesce(c.detected_at, now())
    );
    v_changes := v_changes + 1;
  end loop;

  return jsonb_build_object('opened', v_opened, 'changes', v_changes);
end;
$$;

revoke all on function public.apply_competitor_version_plan(uuid, uuid[], jsonb, jsonb) from public;
revoke all on function public.apply_competitor_version_plan(uuid, uuid[], jsonb, jsonb) from anon;
revoke all on function public.apply_competitor_version_plan(uuid, uuid[], jsonb, jsonb) from authenticated;
grant execute on function public.apply_competitor_version_plan(uuid, uuid[], jsonb, jsonb) to service_role;
