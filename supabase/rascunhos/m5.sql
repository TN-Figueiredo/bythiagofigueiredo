-- Manutenção M5: as telas (spec 2026-10-13-fase-manutencao-nas, 04 §14; 02 §10.4). RASCUNHO até a Tarefa 13 do plano M5 (TRAVA M5-1):
-- não mover para supabase/migrations à mão; o arquivo nasce por `npm run db:new manutencao_m5_telas`. Depende da M2, da M10a e da M3b em produção.

-- M5 PARTE 1: online desde (02 §10.4)
-- Por tabela de série (horária e série; o texto e o vídeo antigo não têm data de série): o 1º dia do mês seguinte ao último mês com detached_at OU
-- dropped_at. Nada saiu: nulo ("tudo online desde o começo da série"), nunca "sem dado". O mês destacado já conta como fora (a tabela-mãe não o lê).
-- A saída é da TABELA inteira (obs_partitions_ensure não tem site_id): os meses fora são lidos sem filtro de site. `divergencia`: o registro diz "nada
-- saiu" mas a partição mais antiga presente começa depois do 1º mês da classe (obs_archive_switch.first_month): a tela trata como NÃO LIDO.
create or replace function public.obs_archive_online_since(p_site uuid)
returns table (class text, table_name text, online_since date, divergencia boolean)
language plpgsql stable security definer set search_path = '' as $$
declare t record; v_rel regclass; v_min date; v_fm date;
begin
  for t in select distinct x.class as cl, x.table_name as tb from public.obs_archive_policy() x where x.class in ('horaria', 'serie') order by 1, 2 loop
    class := t.cl; table_name := t.tb; divergencia := false;
    select (max(m.month) + interval '1 month')::date into online_since from public.obs_archive_months m
     where m.class = t.cl and m.table_name = t.tb and (m.detached_at is not null or m.dropped_at is not null);
    if online_since is null then
      v_rel := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.tb));
      select s.first_month into v_fm from public.obs_archive_switch s where s.site_id = p_site and s.class = t.cl;
      if v_rel is not null and v_fm is not null and (select c.relkind from pg_catalog.pg_class c where c.oid = v_rel) = 'p' then
        select min(pg_catalog.to_date(pg_catalog.right(f.relname, 6), 'YYYYMM')) into v_min
          from pg_catalog.pg_inherits h join pg_catalog.pg_class f on f.oid = h.inhrelid join pg_catalog.pg_namespace n on n.oid = f.relnamespace
         where h.inhparent = v_rel and n.nspname = 'obs_part';
        divergencia := v_min is not null and v_min > v_fm;
      end if;
    end if;
    return next;
  end loop;
end $$;
revoke all on function public.obs_archive_online_since(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_online_since(uuid) to service_role;
