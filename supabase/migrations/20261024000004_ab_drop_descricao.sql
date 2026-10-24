-- ab_drop_descricao (A/B Lab, Migration B). IRREVERSÍVEL. Plano: docs/superpowers/plans/2026-10-21-ab-lab-migration-b-plan.md
-- Apaga ab_tests.original_description, ab_test_variants.description_text, a tabela ab_test_tracked_links e a
-- função create_playoff_test (sem chamador desde a P2; emenda 35 do spec). Antes: pg_dump das três tabelas, pelo dono.
-- Aborta sem mudar nada se houver teste active/paused, playoff vivo, link rastreado de A/B, variante com descrição
-- ou original_description gravado depois da P3. Mensagens listam até 20 ids e a contagem total.
-- Idempotente. Atômica por construção: guardas, drops e alters num único DO.
set lock_timeout = '5s';

do $$
declare
  v_ids  text;
  v_n    bigint;
  v_tot  bigint;
  v_tem_links boolean := to_regclass('public.ab_test_tracked_links') is not null;
  v_tem_desc  boolean := exists (select 1 from pg_attribute where attrelid = 'public.ab_test_variants'::regclass
                                   and attname = 'description_text' and not attisdropped);
  v_tem_orig  boolean := exists (select 1 from pg_attribute where attrelid = 'public.ab_tests'::regclass
                                   and attname = 'original_description' and not attisdropped);
begin
  lock table public.ab_tests, public.ab_test_variants, public.tracked_links in access exclusive mode;
  if v_tem_links then
    lock table public.ab_test_tracked_links in access exclusive mode;
  end if;

  select count(*), string_agg(id::text || ' (' || status || ')', '; ') into v_tot, v_ids
    from (select id, status from public.ab_tests where status in ('active', 'paused') order by created_at limit 20) x;
  if v_ids is not null then
    select count(*) into v_tot from public.ab_tests where status in ('active', 'paused');
    raise exception 'Migration B abortada: % teste(s) em andamento ou pausado (até 20): %. Nada mudou.', v_tot, v_ids;
  end if;

  select string_agg(id::text || ' (' || status || ', filho de ' || parent_test_id::text || ')', '; ') into v_ids
    from (select id, status, parent_test_id from public.ab_tests
           where parent_test_id is not null and status in ('draft', 'queued', 'active', 'paused')
           order by created_at limit 20) x;
  if v_ids is not null then
    select count(*) into v_tot from public.ab_tests
     where parent_test_id is not null and status in ('draft', 'queued', 'active', 'paused');
    raise exception 'Migration B abortada: % playoff(s) vivo(s) (até 20): %. Nada mudou.', v_tot, v_ids;
  end if;

  select count(*) into v_n from public.tracked_links where source_type = 'ab_test';
  if v_n > 0 then
    raise exception 'Migration B abortada: % link(s) de A/B em tracked_links (source_type = ab_test); o dono decide o destino deles e dos cliques. Nada mudou.', v_n;
  end if;

  if v_tem_links then
    execute 'select count(*) from public.ab_test_tracked_links' into v_n;
    if v_n > 0 then
      raise exception 'Migration B abortada: % linha(s) em ab_test_tracked_links. Nada mudou.', v_n;
    end if;
  end if;

  if v_tem_desc then
    execute $q$select string_agg(id::text, '; ') from (select id from public.ab_test_variants
               where description_text is not null order by created_at limit 20) x$q$ into v_ids;
    if v_ids is not null then
      execute 'select count(*) from public.ab_test_variants where description_text is not null' into v_tot;
      raise exception 'Migration B abortada: % variante(s) com description_text (até 20 ids): %. Nada mudou.', v_tot, v_ids;
    end if;
  end if;

  if v_tem_orig then
    execute $q$select string_agg(id::text, '; ') from (select id from public.ab_tests
               where original_description is not null and created_at >= '2026-10-15 07:02:00+00'
               order by created_at limit 20) x$q$ into v_ids;
    if v_ids is not null then
      execute $q$select count(*) from public.ab_tests
                 where original_description is not null and created_at >= '2026-10-15 07:02:00+00'$q$ into v_tot;
      raise exception 'Migration B abortada: % teste(s) com original_description gravado depois da P3 (até 20 ids; o texto não estaria no pg_dump): %. Nada mudou.', v_tot, v_ids;
    end if;
    execute 'select count(*) from public.ab_tests where original_description is not null' into v_n;
    raise notice 'Migration B: % teste(s) com original_description; o texto fica no pg_dump e em yt_own_video_meta_daily.', v_n;
  end if;

  drop function if exists public.create_playoff_test(uuid, uuid[], integer);
  select string_agg(pg_get_function_identity_arguments(oid), ' | ') into v_ids
    from pg_proc where proname = 'create_playoff_test' and pronamespace = 'public'::regnamespace;
  if v_ids is not null then
    raise exception 'Migration B abortada: create_playoff_test com assinatura inesperada (%). Nada mudou.', v_ids;
  end if;

  drop table if exists public.ab_test_tracked_links;
  alter table public.ab_test_variants drop column if exists description_text;
  alter table public.ab_tests drop column if exists original_description;
end $$;

reset lock_timeout;
notify pgrst, 'reload schema';
