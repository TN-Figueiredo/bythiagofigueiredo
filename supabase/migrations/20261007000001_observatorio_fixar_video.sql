-- =============================================================================
-- MIGRATION: observatório — fixar vídeo de competidor (R118) e contagem do que a remoção de um canal apaga
-- =============================================================================

-- Um vídeo fixado continua observado (registro diário e conferência de título, descrição e thumbnail) depois de sair
-- dos video_limit mais recentes do canal. Fixar é manual; o teto por canal (RULES.pinLimit) é conferido pela ação.
-- Idempotente: add column if not exists, create index if not exists, create or replace function + revoke/grant.
-- Sem policy nova: competitor_videos só tem policy de leitura; a escrita é do service role, depois do guard da ação.

alter table public.competitor_videos
  add column if not exists pinned_at timestamptz null,
  add column if not exists pinned_by uuid null references auth.users(id) on delete set null;

comment on column public.competitor_videos.pinned_at is 'Quando o vídeo foi fixado (R118). Nulo = não fixado. Fixado é conferido em toda sincronização e tem registro diário mesmo fora dos video_limit mais recentes.';
comment on column public.competitor_videos.pinned_by is 'Quem fixou. Vira nulo se o usuário for apagado e quando o vídeo é desafixado.';

-- o sync lê os fixados de um canal a cada execução; a ação conta os fixados do canal antes de fixar outro
create index if not exists idx_competitor_videos_pinned
  on public.competitor_videos (competitor_channel_id) where pinned_at is not null;

-- O que a remoção de um canal concorrente apagaria (o delete do canal apaga tudo em cascata). Só leitura.
create or replace function public.competitor_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
begin
  select c.channel_name into v_name from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'videos', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id),
    'pinned', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id and v.pinned_at is not null),
    'versions', (select count(*) from public.competitor_video_versions x
                 join public.competitor_videos v on v.id = x.video_id where v.competitor_channel_id = p_channel_id),
    'daily_days', (select count(distinct d.snap_date) from public.competitor_video_daily d
                   join public.competitor_videos v on v.id = d.video_id where v.competitor_channel_id = p_channel_id),
    -- o arquivo de salvos de Mudanças: uma coluna só, para trocas antigas e para as baseadas em versão
    'bookmarks', (select count(*) from public.competitor_changes g
                  join public.competitor_videos v on v.id = g.video_id where v.competitor_channel_id = p_channel_id and g.bookmarked is true)
  );
end $$;

-- SECURITY DEFINER e sem checagem de permissão por dentro: só o service role a chama, depois do guard da ação.
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;

comment on function public.competitor_channel_removal_impact(uuid, uuid) is 'Conta o que a remoção de um canal concorrente apagaria: vídeos, fixados, versões, dias distintos de registro diário e trocas salvas. Só leitura; canal de outro site devolve not_found.';
