-- A5, R9a (MG20): retrato público diário do canal próprio (inscritos, views e vídeos), para a tela Inscritos medir o canal próprio
-- pelo mesmo número público dos outros canais. Aditiva: uma tabela nova (vazia); nenhuma tabela existente é alterada; o código em
-- produção não lê nem grava nada daqui. Idempotente (pode ser aplicada duas vezes). Volta: drop table public.yt_own_channel_snapshots.
-- Dado público e agregado (contagem do canal), nenhum dado pessoal: sem retenção curta. ~1 linha por canal por dia, sem poda.

create table if not exists public.yt_own_channel_snapshots (
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  snapshot_date date not null,                       -- dia de São Paulo, a mesma regra de competitor_channel_snapshots
  subscriber_count bigint check (subscriber_count >= 0),   -- nulo = não informado ou oculto; nunca 0 por falta
  subscribers_hidden boolean not null default false,
  view_count bigint check (view_count >= 0),
  video_count integer check (video_count >= 0),
  taken_at timestamptz not null default now(),
  primary key (youtube_channel_id, snapshot_date),
  check (subscriber_count is not null or subscribers_hidden)   -- só grava linha que diz algo sobre inscritos
);

alter table public.yt_own_channel_snapshots enable row level security;
revoke all on public.yt_own_channel_snapshots from anon;   -- TRUNCATE não passa por RLS
revoke insert, update, delete, truncate, references, trigger on public.yt_own_channel_snapshots from authenticated;

drop policy if exists yt_own_channel_snapshots_select on public.yt_own_channel_snapshots;
create policy yt_own_channel_snapshots_select on public.yt_own_channel_snapshots for select
  using (exists (select 1 from public.youtube_channels yc where yc.id = youtube_channel_id and public.can_view_site(yc.site_id)));
-- sem policy de escrita: só o cliente de serviço grava
