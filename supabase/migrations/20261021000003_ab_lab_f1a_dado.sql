-- ab_lab_f1a_dado (F1a-dado, envio 1b): colunas do dia 14, quatro CHECKs de vencedor/resposta no lugar do check3,
-- tabela ab_native_fichas (ficha gravada no servidor), funções da ficha e do "Já iniciei" e RPC do formato.
-- Idempotente: reaplicar o arquivo inteiro não faz nada além do que já está feito.
set lock_timeout = '5s';

-- ---------------------------------------------------------------- colunas novas em ab_native_tests
alter table public.ab_native_tests add column if not exists lembrete_notificado_em timestamptz;
alter table public.ab_native_tests add column if not exists resposta_dono text
  check (resposta_dono in ('venceu_nova','venceu_original','ficou_igual','inconclusivo','nao_vi','sem_resposta'));
alter table public.ab_native_tests add column if not exists variante_vencedora smallint;
alter table public.ab_native_tests add column if not exists respondido_em timestamptz;
alter table public.ab_native_tests add column if not exists notificacao_tentativas smallint not null default 0;
alter table public.ab_native_tests add column if not exists notificacao_falhou_em timestamptz;
alter table public.ab_native_tests add column if not exists variantes jsonb
  check (variantes is null or (jsonb_typeof(variantes) = 'array' and jsonb_array_length(variantes) between 2 and 3));

-- ---------------------------------------------------------------- troca do CHECK de vencedor (pela definição, não pelo nome)
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.ab_native_tests'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) = 'CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))'
  loop
    execute format('alter table public.ab_native_tests drop constraint %I', c.conname);
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_titulo_com_fonte') then
    alter table public.ab_native_tests add constraint ab_native_tests_titulo_com_fonte
      check (vencedor_titulo is null or vencedor_fonte is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_fonte_com_vencedor') then
    alter table public.ab_native_tests add constraint ab_native_tests_fonte_com_vencedor
      check (vencedor_fonte is null or vencedor_titulo is not null or variante_vencedora is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_variante_da_resposta') then
    alter table public.ab_native_tests add constraint ab_native_tests_variante_da_resposta
      check (variante_vencedora is null or (
        (resposta_dono = 'venceu_nova' and (
          (variantes is null and variante_vencedora between 1 and 3) or (variantes is not null and variante_vencedora between 2 and 3)))
        or (resposta_dono = 'venceu_original' and variantes is not null and variante_vencedora = 1)));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_respondido_em_do_dono') then
    alter table public.ab_native_tests add constraint ab_native_tests_respondido_em_do_dono
      check ((respondido_em is null) = (resposta_dono is null or resposta_dono = 'sem_resposta'));
  end if;
end $$;

-- ---------------------------------------------------------------- ab_native_fichas
create table if not exists public.ab_native_fichas (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  campos text[] not null default '{}' check (campos <@ array['titulo','miniatura'] and cardinality(campos) between 0 and 2),
  variantes jsonb not null default '[]'::jsonb check (jsonb_typeof(variantes) = 'array' and jsonb_array_length(variantes) between 0 and 3),
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users(id) on delete set null,
  atualizada_em timestamptz not null default now(),
  studio_aberto_em timestamptz,
  lembrar_em timestamptz,
  descartada_em timestamptz,
  registro_id uuid unique references public.ab_native_tests(id) on delete set null
);
create index if not exists ab_native_fichas_recente on public.ab_native_fichas (site_id, video_id, criada_em desc);
create unique index if not exists ab_native_fichas_uma_aberta on public.ab_native_fichas (site_id, video_id)
  where registro_id is null and descartada_em is null;

-- CAS por atualizada_em: clock_timestamp() (duas escritas na mesma transação não empatam).
create or replace function public.ab_native_fichas_set_atualizada_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizada_em := clock_timestamp();
  return new;
end $$;
drop trigger if exists ab_native_fichas_atualizada_em on public.ab_native_fichas;
create trigger ab_native_fichas_atualizada_em before update on public.ab_native_fichas
  for each row execute function public.ab_native_fichas_set_atualizada_em();

alter table public.ab_native_fichas enable row level security;
drop policy if exists ab_native_fichas_select on public.ab_native_fichas;
create policy ab_native_fichas_select on public.ab_native_fichas for select to authenticated using (public.can_edit_site(site_id));
revoke all on public.ab_native_fichas from anon;
revoke insert, update, delete, truncate, references, trigger on public.ab_native_fichas from authenticated;

reset lock_timeout;
