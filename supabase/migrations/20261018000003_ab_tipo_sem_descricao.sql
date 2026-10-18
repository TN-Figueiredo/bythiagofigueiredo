-- ab_tipo_sem_descricao (A/B Lab P3, Migration A). Tira 'description' do CHECK de ab_tests.test_type.
-- Reversível pelo ALTER da seção 9 do plano da P3 (docs/superpowers/plans/2026-10-14-ab-lab-p3-sai-a-descricao-plan.md).
-- Idempotente. Atômica por construção: guarda, drop e add num único comando (o DO).
set lock_timeout = '5s';

do $$
declare
  v_ids  text;
  v_nome text;
begin
  lock table public.ab_tests in access exclusive mode;

  select string_agg(id::text || ' (' || status || ', ' || test_type || ')', '; ' order by created_at)
    into v_ids
    from public.ab_tests
   where test_type not in ('thumbnail', 'title', 'combo');
  if v_ids is not null then
    raise exception 'Migration A abortada: teste com tipo fora dos três: %. Não aplicar a Migration A; o destino da linha se decide com a Migration B (pg_dump antes). Nunca mudar o tipo para combo.', v_ids;
  end if;

  for v_nome in
    select c.conname from pg_constraint c
     where c.conrelid = 'public.ab_tests'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ~ '\mtest_type\M'
  loop
    execute format('alter table public.ab_tests drop constraint %I', v_nome);
  end loop;

  alter table public.ab_tests
    add constraint ab_tests_test_type_check check (test_type in ('thumbnail', 'title', 'combo'));
end $$;

comment on column public.ab_tests.test_type is 'Discriminator: thumbnail|title|combo (description saiu na P3, 10/2026)';
reset lock_timeout;
