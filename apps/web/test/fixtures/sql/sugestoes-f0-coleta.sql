-- F0 das sugestões do nicho (coleta dos canais próprios): aditiva e idempotente.
--   1. yt_own_collection_attempts.outcome aceita 'sem_videos' (canal sem vídeo no dia: não é falha, atraso nem orçamento).
--   2. yt_own_collection_runs.escopo ('completo' | 'parcial'): a execução parcial do cron ganha veredito próprio.
--   3. Visão yt_own_search_terms (F0-e): termos de pesquisa; zero job.
-- Volta: drop view public.yt_own_search_terms; alter table public.yt_own_collection_runs drop column escopo;
--        o CHECK de outcome volta à lista sem 'sem_videos' (só se nenhuma linha usar o valor).

-- Guarda: um drop ... if exists por palpite não faz nada se o nome for outro (lição do check3).
do $$
declare v text;
begin
  select string_agg(conname, ',' order by conname) into v from pg_constraint
   where conrelid = 'public.yt_own_collection_attempts'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%outcome%';
  if v is distinct from 'yt_own_collection_attempts_outcome_check' then
    raise exception 'F0: CHECK de outcome inesperado (%)', v;
  end if;
end $$;

alter table public.yt_own_collection_attempts drop constraint yt_own_collection_attempts_outcome_check;
alter table public.yt_own_collection_attempts add constraint yt_own_collection_attempts_outcome_check
  check (outcome in ('ok','sem_dado_na_janela','video_novo','sem_conexao','sem_autorizacao','erro_http',
                     'nao_alcancado_orcamento','schema_ausente','sem_videos'));

alter table public.yt_own_collection_runs
  add column if not exists escopo text not null default 'completo';
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.yt_own_collection_runs'::regclass
                    and conname = 'yt_own_collection_runs_escopo_check') then
    alter table public.yt_own_collection_runs add constraint yt_own_collection_runs_escopo_check
      check (escopo in ('completo','parcial'));
  end if;
end $$;

-- Termos de pesquisa (F0-e); zero job. source_type '5' = ORIGEM_DE_BUSCA (apps/web/src/lib/youtube/reporting/codigos.ts).
-- detail = '' é "sem termo" (abaixo do limiar do YouTube), nunca um termo vazio. Vazia enquanto a F0-a não andar não é defeito.
create or replace view public.yt_own_search_terms with (security_invoker = true) as
select site_id, channel_id, video_id, youtube_video_id, day_pt,
       detail as termo,
       (detail = '') as sem_termo,
       views, watch_time_minutes
  from public.yt_own_video_traffic_detail_daily
 where source_type = '5';
comment on view public.yt_own_search_terms is 'termos de pesquisa (F0-e); zero job';

-- O padrão do Supabase dá insert/update/delete a objeto novo, e uma visão de uma tabela é atualizável.
revoke all on public.yt_own_search_terms from public, anon, authenticated;
grant select on public.yt_own_search_terms to authenticated;
