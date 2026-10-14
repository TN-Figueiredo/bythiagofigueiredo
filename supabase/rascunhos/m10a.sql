-- M10a (fase de manutenção, emenda de 14/10): o vídeo antigo, o que não depende de ninguém.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.8; 05 §15.1 (M10a) e §17 (pedido 15); 06 §18, itens 135, 138 e 139.
-- Com ZERO vídeo marcado nada disto muda dado nem saída, salvo chaves novas que valem 0:
--   competitor_series_health.arquivados; competitor_channel_removal_impact.videos_leitura_mensal e .videos_no_arquivo;
--   apply_competitor_tier_plan.ignorados_congelados.
-- Ordem dura (02 §10.8, passos 1 e 2): esta migration ANTES do código que lê as colunas.
-- Depende só de ordem da M2 (arquivo posterior e push separado, depois da M2 conferida); não usa objeto dela.
-- Idempotente: add column/create table/create index if not exists, create or replace function, drop trigger if exists.
set lock_timeout = '3s';

-- 1. O toco (02 §10.8, "O toco e os três estados"). Contagem nula fica nula ("não medido"), nunca zero.
alter table public.competitor_videos
  add column if not exists archive_frozen_at timestamptz,
  add column if not exists archive_dropped_at timestamptz,
  add column if not exists archive_view_count bigint,
  add column if not exists archive_like_count bigint,
  add column if not exists archive_comment_count bigint,
  add column if not exists archive_stats_at timestamptz;
comment on column public.competitor_videos.archive_frozen_at is 'M10a: quando o vídeo passou à leitura mensal (estágio 1). Só volta a nulo (descongelar) antes da retirada. Nulo = ativo.';
comment on column public.competitor_videos.archive_dropped_at is 'M10a: quando as linhas do vídeo nas 8 tabelas da classe video_antigo saíram do online (estágio 2). Nulo = ainda online.';
comment on column public.competitor_videos.archive_stats_at is 'M10a: a last_checked_at do instante do congelamento: a data das três contagens "na passagem à leitura mensal".';

create or replace function public.competitor_videos_archive_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.archive_dropped_at is not null then
    if (new.archive_frozen_at, new.archive_dropped_at, new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
       is distinct from
       (old.archive_frozen_at, old.archive_dropped_at, old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
      raise exception 'ja_no_arquivo' using errcode = 'P0001', detail = old.id::text;
    end if;
    return new;
  end if;
  if new.archive_dropped_at is not null and new.archive_frozen_at is null then
    raise exception 'retirada_sem_congelamento' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is not null
     and new.archive_frozen_at <> old.archive_frozen_at then
    raise exception 'archive_frozen_imutavel' using errcode = 'P0001', detail = old.id::text;
  end if;
  if new.archive_frozen_at is not distinct from old.archive_frozen_at
     and (new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
         is distinct from (old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
    raise exception 'contagens_do_arquivo_imutaveis' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is null
     and (new.archive_view_count is not null or new.archive_like_count is not null
          or new.archive_comment_count is not null or new.archive_stats_at is not null) then
    raise exception 'descongelar_sem_limpar' using errcode = 'P0001', detail = old.id::text;
  end if;
  return new;
end $$;
revoke all on function public.competitor_videos_archive_guard() from public, anon, authenticated, service_role;
drop trigger if exists competitor_videos_archive_guard on public.competitor_videos;
create trigger competitor_videos_archive_guard
  before update of archive_frozen_at, archive_dropped_at, archive_view_count, archive_like_count, archive_comment_count, archive_stats_at
  on public.competitor_videos for each row execute function public.competitor_videos_archive_guard();

-- 2. A política (02 §10.8, "A política"). Muda só por migration: nenhuma ação de servidor troca H nem libera a classe.
create table if not exists public.obs_archive_video_policy (
  site_id uuid primary key references public.sites(id) on delete cascade,
  h_meses integer not null default 24 check (h_meses >= 12),
  released boolean not null default false,
  teto_unidade integer not null default 100 check (teto_unidade between 1 and 100),
  teto_auto_minimo integer not null default 25 check (teto_auto_minimo >= 0),
  teto_auto_fracao numeric(4,3) not null default 0.050 check (teto_auto_fracao >= 0 and teto_auto_fracao <= 1),
  updated_at timestamptz not null default now()
);
comment on table public.obs_archive_video_policy is 'M10a: a saída por idade do vídeo (classe video_antigo), uma linha por site. H em meses (D15: 24). released = a classe liberada (só por migration, no release das telas da peça 8). Site sem linha = classe fechada e nada elegível (politica_ausente), nunca 24 por omissão. Toda migration que alterar uma linha grava updated_at = now() no mesmo update.';
insert into public.obs_archive_video_policy (site_id) select s.id from public.sites s on conflict (site_id) do nothing;
alter table public.obs_archive_video_policy enable row level security;
revoke all on table public.obs_archive_video_policy from public, anon, authenticated, service_role;
grant select on table public.obs_archive_video_policy to service_role;

-- 3. A guarda de insert nas 8 tabelas da classe video_antigo (02 §10.8). Segunda linha: o predicado do código é a primeira.
create or replace function public.obs_video_antigo_guarda_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.video_id is null then
    return new;
  end if;
  perform 1 from public.competitor_videos v where v.id = new.video_id and v.archive_frozen_at is not null;
  if found then
    raise exception 'video_congelado' using errcode = 'P0001', detail = new.video_id::text, hint = tg_table_name;
  end if;
  return new;
end $$;
revoke all on function public.obs_video_antigo_guarda_insert() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['competitor_video_versions', 'competitor_field_versions', 'competitor_raw',
                           'competitor_video_tier_spans', 'competitor_video_comment_snaps', 'competitor_hour_fold_log',
                           'competitor_changes', 'competitor_readings']
  loop
    execute format('drop trigger if exists obs_video_antigo_guarda on public.%I', t);
    execute format('create trigger obs_video_antigo_guarda before insert on public.%I for each row execute function public.obs_video_antigo_guarda_insert()', t);
  end loop;
end $$;

-- 4. P36: a retirada e a remoção buscam leituras da forja por vídeo.
create index if not exists idx_competitor_readings_video on public.competitor_readings (video_id) where video_id is not null;
