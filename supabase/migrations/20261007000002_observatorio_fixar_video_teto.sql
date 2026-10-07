-- =============================================================================
-- MIGRATION: observatório — fixar vídeo com o teto garantido no banco
-- =============================================================================

-- Até aqui a ação contava os fixados do canal e depois gravava: duas chamadas simultâneas passavam do teto em 1, e o
-- update não conferia se alguma linha tinha sido gravada. Aqui fixar vira UMA chamada, dentro de uma transação, que
-- trava a linha do canal: quem chega depois espera, conta de novo e é recusado no teto.
-- O teto NÃO mora no banco: vem da aplicação (RULES.pinLimit), para o dono poder mudá-lo sem migration.
-- Idempotente: create or replace function + revoke/grant, create index if not exists. Depende de 20261007000001.

-- quem fixou: a FK para auth.users (on delete set null) precisa achar as linhas de um usuário apagado
create index if not exists idx_competitor_videos_pinned_by
  on public.competitor_videos (pinned_by) where pinned_by is not null;

-- Fixa um vídeo de competidor. Devolve:
--   {"status":"ok","already":bool}            fixado agora, ou já estava (idempotente: a data não é regravada)
--   {"status":"cap","name":text,"pinned":int} o canal já tem p_limit fixados; nada é gravado, ninguém é desafixado
--   {"status":"not_found"}                    o vídeo não existe, ou o canal dele não é deste site
create or replace function public.pin_competitor_video(p_site_id uuid, p_video_id uuid, p_user_id uuid, p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
  v_name text;
  v_pinned_at timestamptz;
  v_count integer;
begin
  if p_limit is null or p_limit < 0 then
    raise exception 'pin_competitor_video: p_limit inválido';
  end if;

  select v.competitor_channel_id into v_channel from public.competitor_videos v where v.id = p_video_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- a trava: toda fixação do mesmo canal passa por esta linha, uma de cada vez. O site é conferido aqui
  -- (competitor_videos não tem site_id): canal de outro site lê como not_found.
  select c.channel_name into v_name from public.competitor_channels c
  where c.id = v_channel and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- relido depois da trava: outra chamada pode ter fixado (ou apagado) este vídeo enquanto esta esperava
  select v.pinned_at into v_pinned_at from public.competitor_videos v
  where v.id = p_video_id and v.competitor_channel_id = v_channel for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_pinned_at is not null then
    return jsonb_build_object('status', 'ok', 'already', true);
  end if;

  select count(*) into v_count from public.competitor_videos v
  where v.competitor_channel_id = v_channel and v.pinned_at is not null;
  if v_count >= p_limit then
    return jsonb_build_object('status', 'cap', 'name', v_name, 'pinned', v_count);
  end if;

  update public.competitor_videos set pinned_at = now(), pinned_by = p_user_id where id = p_video_id;
  return jsonb_build_object('status', 'ok', 'already', false);
end $$;

-- SECURITY DEFINER e sem checagem de permissão por dentro: só o service role a chama, depois do guard da ação.
revoke all on function public.pin_competitor_video(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.pin_competitor_video(uuid, uuid, uuid, integer) to service_role;

comment on function public.pin_competitor_video(uuid, uuid, uuid, integer) is 'Fixa um vídeo de competidor travando a linha do canal: confere site, conta os fixados e recusa no teto (p_limit vem da aplicação). Devolve ok / cap / not_found.';
