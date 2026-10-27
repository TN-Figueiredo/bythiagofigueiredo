-- =============================================================================
-- MIGRATION: A/B Lab M7b, escolha do dono (colunas escolha_*, guarda, iniciativa no histórico, ab_event escolha)
-- =============================================================================


set lock_timeout = '5s';
alter table public.ab_tests
  add column if not exists escolha_variant_id uuid null references public.ab_test_variants(id) on delete set null,
  add column if not exists escolha_em timestamptz null,
  add column if not exists escolha_por uuid null references auth.users(id) on delete set null; -- LGPD: some quem escolheu, a escolha fica
alter table public.ab_tests drop constraint if exists ab_tests_escolha_tem_data;
alter table public.ab_tests add constraint ab_tests_escolha_tem_data check (escolha_variant_id is null or escolha_em is not null);

-- A policy ab_tests_update deixa um editor (can_edit_site) mudar a linha pelo PostgREST. A escolha exige o degrau de administrar,
-- então só o servidor grava estas colunas. SECURITY INVOKER de propósito: em SECURITY DEFINER, current_user vira o dono da função
-- (postgres) e o raise nunca roda. No PostgREST current_user = authenticated; na migration e nas ações de FK (on delete set null,
-- executadas pelo dono da tabela) = postgres.
create or replace function public.tg_ab_tests_escolha_so_servidor() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and (
       (tg_op = 'INSERT' and (new.escolha_variant_id is not null or new.escolha_em is not null or new.escolha_por is not null))
    or (tg_op = 'UPDATE' and (new.escolha_variant_id, new.escolha_em, new.escolha_por)
          is distinct from (old.escolha_variant_id, old.escolha_em, old.escolha_por))) then
    raise exception 'ab_tests.escolha_*: só o servidor grava' using errcode = '42501';
  end if;
  if new.escolha_variant_id is not null and not exists (
    select 1 from public.ab_test_variants v where v.id = new.escolha_variant_id and v.test_id = new.id) then
    raise exception 'ab_tests.escolha_variant_id de outro teste' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.tg_ab_tests_escolha_so_servidor() from public, anon, authenticated;
drop trigger if exists ab_tests_escolha_so_servidor on public.ab_tests;
create trigger ab_tests_escolha_so_servidor before insert or update of escolha_variant_id, escolha_em, escolha_por on public.ab_tests
  for each row execute function public.tg_ab_tests_escolha_so_servidor();

-- Marca "iniciativa do dono" no histórico (o gatilho tg_ab_tests_restore_log copia o campo para a linha de ab_test_restores).
alter table public.ab_test_restores add column if not exists iniciativa text null;
alter table public.ab_test_restores drop constraint if exists ab_test_restores_iniciativa_check;
alter table public.ab_test_restores add constraint ab_test_restores_iniciativa_check check (iniciativa is null or iniciativa = 'dono');
create or replace function public.tg_ab_tests_restore_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  foreach k in array array['title', 'thumbnail'] loop
    v := new.restore_status -> k;
    continue when v is null or v ->> 'estado' = 'em_andamento';
    continue when (old.restore_status -> k) is not distinct from v;
    -- P4a (32 i): retomar que falha regrava o valor anterior; a mesma restauração não ganha segunda linha.
    continue when exists (
      select 1 from public.ab_test_restores r
       where r.test_id = new.id and r.campo = k and r.seq < new.restore_seq
         and r.estado = v ->> 'estado' and r.destino = v ->> 'destino'
         and r.em = (v ->> 'em')::timestamptz and r.attempts = (v ->> 'attempts')::integer);
    insert into public.ab_test_restores (test_id, seq, campo, destino, estado, escreveu, forcado, motivo, erro, attempts, em, iniciativa)
    values (
      new.id, new.restore_seq, k, v ->> 'destino', v ->> 'estado', (v ->> 'escreveu')::boolean,
      (v ->> 'forcado')::boolean, v ->> 'motivo', v ->> 'erro', (v ->> 'attempts')::integer, (v ->> 'em')::timestamptz,
      case when v ->> 'iniciativa' = 'dono' then 'dono' end
    )
    on conflict (test_id, seq, campo) do update set
      destino = excluded.destino, estado = excluded.estado, escreveu = excluded.escreveu, forcado = excluded.forcado,
      motivo = excluded.motivo, erro = excluded.erro, attempts = excluded.attempts, em = excluded.em,
      iniciativa = excluded.iniciativa, gravado_em = now();
  end loop;
  return new;
end;
$$;
revoke all on function public.tg_ab_tests_restore_log() from public, anon, authenticated;

-- E18: a escolha do dono não é "vencedor".
-- Nome verificado no banco local: yt_own_video_versions_ab_event_check (CHECK inline de 20261014000008:56). `not valid` + `validate`
-- para não varrer a tabela sob lock exclusivo.
alter table public.yt_own_video_versions drop constraint if exists yt_own_video_versions_ab_event_check;
alter table public.yt_own_video_versions add constraint yt_own_video_versions_ab_event_check
  check (ab_event is null or ab_event in ('rotacao', 'vencedor', 'restauro', 'escolha')) not valid;
alter table public.yt_own_video_versions validate constraint yt_own_video_versions_ab_event_check;

comment on column public.ab_tests.escolha_variant_id is 'M7b: versão que o dono deixou no ar ou manteve (a original = id da variante is_original). Separada de winner_variant_id: nunca muda o vencedor nem getLearnings, EXCETO quando a escolha é a própria sugerida (aí o vencedor recebe a sugerida, como no aplicarSugerido). Gravada só quando a escrita fechou ok em todos os campos, ou no "Manter"/"já está no ar" sem escrita.';
reset lock_timeout;
