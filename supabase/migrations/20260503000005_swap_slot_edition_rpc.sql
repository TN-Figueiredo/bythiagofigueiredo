-- Atomic swap: move old edition back to ready, schedule new edition in its slot.
-- Returns JSON: { "ok": true } or { "ok": false, "error": "..." }
create or replace function public.swap_slot_edition(
  p_new_edition_id uuid,
  p_slot_date date,
  p_type_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occupant_id uuid;
  v_occupant_status text;
  v_type_row record;
  v_site_row record;
  v_send_time text;
  v_timezone text;
  v_scheduled_at timestamptz;
begin
  -- Find current occupant
  select id, status into v_occupant_id, v_occupant_status
  from newsletter_editions
  where newsletter_type_id = p_type_id
    and edition_kind = 'cadence'
    and slot_date = p_slot_date
    and status not in ('cancelled', 'archived')
  for update;

  if v_occupant_id is null then
    return jsonb_build_object('ok', false, 'error', 'slot_not_occupied');
  end if;

  if v_occupant_status in ('sending', 'sent') then
    return jsonb_build_object('ok', false, 'error', 'occupant_locked');
  end if;

  -- Verify new edition is in 'ready' status
  perform 1 from newsletter_editions
  where id = p_new_edition_id and status = 'ready'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'edition_not_ready');
  end if;

  -- Get send time and timezone
  select preferred_send_time, site_id into v_type_row
  from newsletter_types where id = p_type_id;

  if v_type_row is null then
    return jsonb_build_object('ok', false, 'error', 'type_not_found');
  end if;

  select timezone into v_timezone
  from sites where id = v_type_row.site_id;

  v_send_time := coalesce(v_type_row.preferred_send_time::text, '09:00:00');
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  -- Compute scheduled_at from slot_date + send_time in site timezone
  v_scheduled_at := (p_slot_date::text || ' ' || v_send_time)::timestamp at time zone v_timezone;

  -- Step 1: Clear old edition's slot
  update newsletter_editions set
    status = 'ready',
    slot_date = null,
    scheduled_at = null,
    edition_kind = null,
    updated_at = now()
  where id = v_occupant_id;

  -- Step 2: Schedule new edition to the slot
  update newsletter_editions set
    status = 'scheduled',
    slot_date = p_slot_date,
    scheduled_at = v_scheduled_at,
    edition_kind = 'cadence',
    newsletter_type_id = p_type_id,
    updated_at = now()
  where id = p_new_edition_id;

  return jsonb_build_object('ok', true, 'displaced_edition_id', v_occupant_id);
end;
$$;
