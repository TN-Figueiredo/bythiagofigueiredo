-- =============================================================================
-- MIGRATION: fase de manutenção (NAS e forja), etapa M1: podas de estado de execução
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02-desenho-e-contrato-de-dados.md, seção 10.3;
--       itens de aceite 3 e 4 (06, seção 18). Plano: docs/superpowers/plans/2026-10-14-manutencao-nas-m0-m1-medidas-e-podas.md
-- Aditiva. Roda duas vezes sem erro. Sem pg_cron (banco local, CI) os agendamentos não são criados.
--   1. purge_cron_runs: apaga public.cron_runs com ran_at mais velho que p_dias (90), em lotes.
--   2. yt_own_collection_attempts_purge: idem por attempt_day, MENOS até três linhas por chave (scope_type, scope_id, kind):
--      a primeira tentativa, a mais recente e a resposta mais recente ('ok' ou 'sem_dado_na_janela'). Sem isso, yt_own_retention_facts
--      e a tela da curva diriam "nunca tentado" de vídeo cuja última tentativa passou de 90 dias (desvio D-M1-1).
--   3. Dois agendamentos diários, fora de 05:00 a 06:00 UTC e dos minutos 0, 20 e 40.
-- =============================================================================
set lock_timeout = '5s';

create or replace function public.purge_cron_runs(
  p_dias integer default 90,
  p_lote integer default 5000,
  p_max_lotes integer default 20,
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_corte timestamptz;
  v_n integer;
  v_total integer := 0;
  v_i integer := 0;
begin
  if p_dias is null or p_dias < 90 then
    raise exception 'purge_cron_runs: p_dias % abaixo do piso de 90', p_dias using errcode = '22023';
  end if;
  if p_lote is null or p_lote < 1 or p_max_lotes is null or p_max_lotes < 1 or p_now is null then
    raise exception 'purge_cron_runs: argumento inválido' using errcode = '22023';
  end if;
  -- p_now no futuro não alarga a poda (Phil I-2); no passado, respeitado (Yannis M4b; a E10 chama com +24 meses)
  v_corte := least(p_now, now()) - make_interval(days => p_dias);
  loop
    exit when v_i >= p_max_lotes;
    delete from public.cron_runs
     where id in (select r.id from public.cron_runs r where r.ran_at < v_corte limit p_lote);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    v_i := v_i + 1;
    exit when v_n < p_lote;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.purge_cron_runs(integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.purge_cron_runs(integer, integer, integer, timestamptz) to service_role;

create or replace function public.cron_purge_cron_runs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_ini timestamptz := clock_timestamp();
begin
  select public.purge_cron_runs() into v_n;
  insert into public.cron_runs (job, ran_at, status, duration_ms, items_processed)
  values ('pg_cron:purge-cron-runs', now(), 'ok', (extract(epoch from clock_timestamp() - v_ini) * 1000)::int, v_n);
  raise log '[pg_cron] purge-cron-runs: % rows', v_n;
end;
$$;

revoke all on function public.cron_purge_cron_runs() from public, anon, authenticated;
grant execute on function public.cron_purge_cron_runs() to service_role;

create or replace function public.yt_own_collection_attempts_purge(
  p_dias integer default 90,
  p_lote integer default 5000,
  p_max_lotes integer default 20,
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_corte date;
  v_n integer;
  v_total integer := 0;
  v_i integer := 0;
begin
  if p_dias is null or p_dias < 90 then
    raise exception 'yt_own_collection_attempts_purge: p_dias % abaixo do piso de 90', p_dias using errcode = '22023';
  end if;
  if p_lote is null or p_lote < 1 or p_max_lotes is null or p_max_lotes < 1 or p_now is null then
    raise exception 'yt_own_collection_attempts_purge: argumento inválido' using errcode = '22023';
  end if;
  -- p_now no futuro não alarga a poda (Phil I-2); no passado, respeitado (Yannis M4b)
  v_corte := (least(p_now, now()) at time zone 'utc')::date - p_dias;
  loop
    exit when v_i >= p_max_lotes;
    delete from public.yt_own_collection_attempts t
     using (
       select x.scope_type, x.scope_id, x.kind, x.attempt_day
         from (
           select a.scope_type, a.scope_id, a.kind, a.attempt_day, a.outcome,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind
                                     order by a.attempt_day desc) as rn_tentativa,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind
                                     order by a.attempt_day asc) as rn_primeira,
                  row_number() over (partition by a.scope_type, a.scope_id, a.kind,
                                                  (a.outcome in ('ok', 'sem_dado_na_janela'))
                                     order by a.attempt_day desc) as rn_mesmo_tipo
             from public.yt_own_collection_attempts a
         ) x
        where x.attempt_day < v_corte
          and x.rn_tentativa > 1
          and x.rn_primeira > 1
          and not (x.outcome in ('ok', 'sem_dado_na_janela') and x.rn_mesmo_tipo = 1)
        limit p_lote
     ) alvo
     where t.scope_type = alvo.scope_type and t.scope_id = alvo.scope_id
       and t.kind = alvo.kind and t.attempt_day = alvo.attempt_day;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    v_i := v_i + 1;
    exit when v_n < p_lote;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.yt_own_collection_attempts_purge(integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.yt_own_collection_attempts_purge(integer, integer, integer, timestamptz) to service_role;

create or replace function public.cron_purge_yt_own_collection_attempts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_ini timestamptz := clock_timestamp();
begin
  select public.yt_own_collection_attempts_purge() into v_n;
  insert into public.cron_runs (job, ran_at, status, duration_ms, items_processed)
  values ('pg_cron:purge-yt-own-collection-attempts', now(), 'ok', (extract(epoch from clock_timestamp() - v_ini) * 1000)::int, v_n);
  raise log '[pg_cron] purge-yt-own-collection-attempts: % rows', v_n;
end;
$$;

revoke all on function public.cron_purge_yt_own_collection_attempts() from public, anon, authenticated;
grant execute on function public.cron_purge_yt_own_collection_attempts() to service_role;

do $guard$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: podas da M1 não agendadas (esperado fora de produção)';
    return;
  end if;
  perform cron.schedule('purge-cron-runs', '10 6 * * *', $$select public.cron_purge_cron_runs()$$);
  perform cron.schedule('purge-yt-own-collection-attempts', '50 6 * * *', $$select public.cron_purge_yt_own_collection_attempts()$$);
end
$guard$;
