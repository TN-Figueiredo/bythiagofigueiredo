-- Migration 0 do A/B Lab (P4a): restauração segura. Aditiva; não precisa de código para ser aplicada.
-- Criar com: npm run db:new ab_restore_status   (nunca à mão)
-- Fila do banco: sozinha; fora de 11:30-13:00 UTC e dos minutos 0-4, 20-24, 30-34 e 40-44;
-- antes de o arquivo da MG15 nascer (16/10; nunca 16/10 17:00-23:00 UTC).

set lock_timeout = '5s';

-- 0. Guarda: nenhum teste pode depender de cancelGracePeriod/applyWinnerNow, que a P4a apaga (emenda 9 e 43).
--    (a) carência em curso: teste vivo com grace_expires_at e vencedor ainda não aplicado.
--        Não basta "grace_expires_at não nulo": a aplicação automática (ab-evaluate-phases.ts:547-557) e a
--        sugestão com AB_AUTO_APPLY_WINNER desligado (:245-257) deixam grace_expires_at preenchido para sempre.
--    (b) vencedor sugerido não aplicado: auto_resolve com winner_variant_id e sem winner_applied_at
--        (applyWinnerNow não olha status: actions.ts:1335), em qualquer status, inclusive archived.
do $$
declare
  v_ids text;
begin
  lock table public.ab_tests, public.ab_test_cycles, public.ab_test_variants in access exclusive mode;
  select string_agg(id::text || ' (' || status || coalesce(', ' || completed_reason, '') || ')', '; ' order by created_at)
    into v_ids
    from public.ab_tests
   where (status <> 'completed' and grace_expires_at is not null and winner_applied_at is null)
      or (completed_reason = 'auto_resolve' and winner_variant_id is not null and winner_applied_at is null);
  if v_ids is not null then
    raise exception 'Migration 0 abortada: teste em carência ou com vencedor sugerido não aplicado: %. O dono decide (aplicar ou cancelar pela tela de hoje) e roda de novo.', v_ids;
  end if;
end $$;

-- 1. ab_tests: estado da restauração por campo + contador de reivindicação.
alter table public.ab_tests
  add column if not exists restore_status jsonb,
  add column if not exists restore_seq integer not null default 0;

alter table public.ab_tests drop constraint if exists ab_tests_restore_status_shape;
alter table public.ab_tests add constraint ab_tests_restore_status_shape check (
  restore_status is null
  or coalesce((
    jsonb_typeof(restore_status) = 'object'
    and (restore_status - array['title', 'thumbnail']) = '{}'::jsonb
    and (
      not (restore_status ? 'title')
      or coalesce((
        jsonb_typeof(restore_status -> 'title') = 'object'
        and restore_status -> 'title' ->> 'estado' in ('em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu')
        and jsonb_typeof(restore_status -> 'title' -> 'destino') = 'string' and restore_status -> 'title' ->> 'destino' <> ''
        and jsonb_typeof(restore_status -> 'title' -> 'em') = 'string' and pg_input_is_valid(restore_status -> 'title' ->> 'em', 'timestamptz')
        and jsonb_typeof(restore_status -> 'title' -> 'forcado') = 'boolean'
        and coalesce(jsonb_typeof(restore_status -> 'title' -> 'escreveu'), 'null') in ('boolean', 'null')
        and jsonb_typeof(restore_status -> 'title' -> 'attempts') = 'number' and (restore_status -> 'title' ->> 'attempts') ~ '^[0-9]{1,6}$'
        and coalesce(jsonb_typeof(restore_status -> 'title' -> 'motivo'), 'null') in ('string', 'null')
        and coalesce(jsonb_typeof(restore_status -> 'title' -> 'erro'), 'null') in ('string', 'object', 'null')
      ), false)
    )
    and (
      not (restore_status ? 'thumbnail')
      or coalesce((
        jsonb_typeof(restore_status -> 'thumbnail') = 'object'
        and restore_status -> 'thumbnail' ->> 'estado' in ('em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu')
        and jsonb_typeof(restore_status -> 'thumbnail' -> 'destino') = 'string' and restore_status -> 'thumbnail' ->> 'destino' <> ''
        and jsonb_typeof(restore_status -> 'thumbnail' -> 'em') = 'string' and pg_input_is_valid(restore_status -> 'thumbnail' ->> 'em', 'timestamptz')
        and jsonb_typeof(restore_status -> 'thumbnail' -> 'forcado') = 'boolean'
        and coalesce(jsonb_typeof(restore_status -> 'thumbnail' -> 'escreveu'), 'null') in ('boolean', 'null')
        and jsonb_typeof(restore_status -> 'thumbnail' -> 'attempts') = 'number' and (restore_status -> 'thumbnail' ->> 'attempts') ~ '^[0-9]{1,6}$'
        and coalesce(jsonb_typeof(restore_status -> 'thumbnail' -> 'motivo'), 'null') in ('string', 'null')
        and coalesce(jsonb_typeof(restore_status -> 'thumbnail' -> 'erro'), 'null') in ('string', 'object', 'null')
      ), false)
    )
  ), false)
);

alter table public.ab_tests drop constraint if exists ab_tests_restore_seq_nao_negativo;
alter table public.ab_tests add constraint ab_tests_restore_seq_nao_negativo check (restore_seq >= 0);

comment on column public.ab_tests.restore_status is
  'A/B Lab, P4: o que ficou no YouTube quando o teste saiu do ar, por campo: {title?, thumbnail?}, cada um {estado, destino, em, forcado, escreveu, motivo?, erro, attempts}. '
  'NULO = o teste nunca passou pelo código novo (o leitor usa as regras antigas). {} = código novo, nada pendente (retomar e dispensar gravam {}, nunca nulo). '
  'estado em_andamento = reivindicado e sem resultado; com "em" mais velho que 15 min, foi interrompido (o leitor diz "não se sabe"). '
  'Contrato de leitura (spec A/B Lab, emenda 32): E18, tela 3b da E5b, GET do pipeline. Mudar a forma exige avisar esses planos.';
comment on column public.ab_tests.restore_seq is
  'A/B Lab, P4: contador de reivindicação. Todo escritor de restore_status e de estado (settleOnAir, retomar, forçar rotação, rotação do cron, vigia, retryRestore, dismissRestore) faz update ... restore_seq = restore_seq + 1 where restore_seq = <lido>, e relê antes de cada escrita no YouTube.';

-- 2. ab_test_cycles: por que o ciclo fechou.
alter table public.ab_test_cycles
  add column if not exists end_reason text;

alter table public.ab_test_cycles drop constraint if exists ab_test_cycles_end_reason_check;
alter table public.ab_test_cycles add constraint ab_test_cycles_end_reason_check check (
  end_reason is null or end_reason in ('pausa', 'encerrado', 'falha_api', 'duracao_maxima', 'drift', 'rotacao')
);

alter table public.ab_test_cycles drop constraint if exists ab_test_cycles_end_reason_so_fechado;
alter table public.ab_test_cycles add constraint ab_test_cycles_end_reason_so_fechado check (
  end_reason is null or ended_at is not null
);

comment on column public.ab_test_cycles.end_reason is
  'A/B Lab, P4: motivo do fechamento do ciclo. NULO com ended_at preenchido = fechado antes da Migration 0 (não se sabe). Gravado em toda parada e toda rotação (emenda 32c).';

-- 3. ab_test_variants: dHash da variante como o YouTube a serviria (hqdefaultLike + dhashOf: 16 hex minúsculos).
alter table public.ab_test_variants
  add column if not exists thumbnail_dhash text;

alter table public.ab_test_variants drop constraint if exists ab_test_variants_thumbnail_dhash_formato;
alter table public.ab_test_variants add constraint ab_test_variants_thumbnail_dhash_formato check (
  thumbnail_dhash is null or thumbnail_dhash ~ '^[0-9a-f]{16}$'
);

comment on column public.ab_test_variants.thumbnail_dhash is
  'A/B Lab, P4: dHash (dhashOf) do arquivo de blob_url redimensionado por hqdefaultLike() para 480x360. NULO = ainda não calculado (calcular na hora de comparar). Não é o dHash diário da E18 (yt_own_video_meta_daily).';

-- 4. Histórico imutável de cada resultado de restauração (o restore_status é só o estado corrente:
--    retomar e dispensar o zeram, e a parada seguinte o sobrescreve). Leitor: E18 (ordens 3, 3b, 4, 4b;
--    dívida "o Lab gravar, em cada parada, se reenviou imagem e qual"). Escrito só pelo gatilho abaixo.
create table if not exists public.ab_test_restores (
  id bigint generated always as identity primary key,
  test_id uuid not null references public.ab_tests(id) on delete cascade,
  seq integer not null,
  campo text not null check (campo in ('title', 'thumbnail')),
  destino text not null,
  estado text not null check (estado in ('ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu')),
  escreveu boolean,
  forcado boolean not null,
  motivo text,
  erro text,
  attempts integer not null,
  em timestamptz not null,
  gravado_em timestamptz not null default now(),
  constraint ab_test_restores_um_por_reivindicacao unique (test_id, seq, campo)
);

alter table public.ab_test_restores enable row level security;
-- Só o gatilho (dono postgres) e a cascata do FK escrevem. Ninguém mais grava nem trunca (TRUNCATE não passa por RLS).
revoke all on table public.ab_test_restores from anon, authenticated, service_role;
grant select on table public.ab_test_restores to authenticated, service_role;

drop policy if exists "ab_test_restores_select" on public.ab_test_restores;
create policy "ab_test_restores_select" on public.ab_test_restores
  for select to authenticated using (
    exists (select 1 from public.ab_tests t where t.id = test_id and public.can_view_site(t.site_id))
  );
-- Sem policy de escrita: só o gatilho (security definer) grava; o cliente de serviço não precisa gravar direto.

comment on table public.ab_test_restores is
  'A/B Lab, P4: uma linha por campo e por reivindicação (restore_seq) com o resultado final da restauração. Escrito só pelo gatilho tg_ab_tests_restore_log; se a mesma reivindicação regravar o resultado de um campo (não deveria: o passo 4 grava uma vez), a última escrita vence e gravado_em muda. Reivindicação nova (restore_seq + 1) = linha nova; nada é apagado senão pela cascata. Some com o teste (cascata, inclusive na remoção do canal).';
comment on column public.ab_test_restores.escreveu is
  'true = houve chamada de escrita aceita pelo YouTube nesta tentativa; false = não escreveu (já estava no destino, pulado, falhou antes de escrever); nulo = o escritor não informou.';

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
    -- O CHECK ab_tests_restore_status_shape garante que todo cast abaixo é seguro: este gatilho não tem
    -- modo de falha próprio além do FK (o teste existe, é a linha que disparou).
    continue when v is null or v ->> 'estado' = 'em_andamento';
    continue when (old.restore_status -> k) is not distinct from v;
    insert into public.ab_test_restores (test_id, seq, campo, destino, estado, escreveu, forcado, motivo, erro, attempts, em)
    values (
      new.id, new.restore_seq, k, v ->> 'destino', v ->> 'estado', (v ->> 'escreveu')::boolean,
      (v ->> 'forcado')::boolean, v ->> 'motivo', v ->> 'erro', (v ->> 'attempts')::integer, (v ->> 'em')::timestamptz
    )
    on conflict (test_id, seq, campo) do update set
      destino = excluded.destino, estado = excluded.estado, escreveu = excluded.escreveu, forcado = excluded.forcado,
      motivo = excluded.motivo, erro = excluded.erro, attempts = excluded.attempts, em = excluded.em, gravado_em = now();
  end loop;
  return new;
end;
$$;

revoke all on function public.tg_ab_tests_restore_log() from public, anon, authenticated;

drop trigger if exists ab_tests_restore_log on public.ab_tests;
create trigger ab_tests_restore_log
  after update of restore_status on public.ab_tests
  for each row
  when (new.restore_status is not null and new.restore_status is distinct from old.restore_status)
  execute function public.tg_ab_tests_restore_log();

reset lock_timeout;
