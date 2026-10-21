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

-- ---------------------------------------------------------------- funções (todas service_role)
-- Abrir a ficha do vídeo: descarta a aberta inativa há mais de 14 dias (inatividade, não idade), expira o `ficha-lembrar:` dela
-- na mesma transação, insere a nova (índice parcial: o PostgREST não infere `on conflict` parcial, 42P10) e devolve a aberta.
create or replace function public.ab_native_ficha_abrir(p_site uuid, p_video uuid, p_usuario uuid)
returns public.ab_native_fichas
language plpgsql security invoker set search_path = '' as $$
declare
  r public.ab_native_fichas;
  d uuid;
begin
  if not exists (select 1 from public.youtube_videos v where v.id = p_video and v.site_id = p_site) then
    raise exception 'ab_native_ficha_abrir: video fora do site' using errcode = '23503';
  end if;

  for d in
    update public.ab_native_fichas f set descartada_em = now()
     where f.site_id = p_site and f.video_id = p_video and f.registro_id is null and f.descartada_em is null
       and greatest(f.criada_em, f.atualizada_em, f.studio_aberto_em, f.lembrar_em) < now() - interval '14 days'
    returning f.id
  loop
    update public.notifications n set expired_at = now()
     where n.domain = 'youtube' and n.dedup_key = 'ficha-lembrar:' || d::text and n.expired_at is null;
  end loop;

  insert into public.ab_native_fichas (site_id, video_id, criada_por)
  values (p_site, p_video, p_usuario)
  on conflict (site_id, video_id) where registro_id is null and descartada_em is null do nothing;

  select * into r from public.ab_native_fichas f
   where f.site_id = p_site and f.video_id = p_video and f.registro_id is null and f.descartada_em is null;
  return r;
end $$;

-- "Já iniciei": ficha -> registro `em_andamento` confirmado, atômico. Retornos (jsonb):
--   {ok, registro_id, confirmou_detectado} | {ok, ja_iniciada, registro_id} | {erro: nao_encontrada}
--   | {erro: ficha_incompleta, motivo: variantes|campos} | {erro: ja_ha_teste_em_andamento, registro_id} | {erro: estado_mudou}
create or replace function public.ab_native_iniciar(p_site uuid, p_ficha uuid, p_usuario uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  f public.ab_native_fichas;
  v_yt text;
  r_id uuid;
  era_detectada boolean;
  outro uuid;
begin
  select * into f from public.ab_native_fichas x where x.id = p_ficha and x.site_id = p_site for update;
  if not found then return jsonb_build_object('erro', 'nao_encontrada'); end if;
  if f.registro_id is not null then
    return jsonb_build_object('ok', true, 'ja_iniciada', true, 'registro_id', f.registro_id);
  end if;
  if f.descartada_em is not null then return jsonb_build_object('erro', 'estado_mudou'); end if;
  if jsonb_array_length(f.variantes) < 2 then return jsonb_build_object('erro', 'ficha_incompleta', 'motivo', 'variantes'); end if;
  if cardinality(f.campos) not between 1 and 2 then return jsonb_build_object('erro', 'ficha_incompleta', 'motivo', 'campos'); end if;

  select v.youtube_video_id into v_yt from public.youtube_videos v where v.id = f.video_id and v.site_id = p_site;
  if v_yt is null then return jsonb_build_object('erro', 'nao_encontrada'); end if;

  -- 2: insere confirmado, ou cai no teste em andamento que o registrador já tenha aberto.
  insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, confirmado_por, variantes)
  values (p_site, f.video_id, v_yt, 'confirmado', f.campos, 'em_andamento', now(), p_usuario, f.variantes)
  on conflict (site_id, video_id) where estado = 'em_andamento' do nothing
  returning id into r_id;

  if r_id is null then
    -- 3: só confirma linha livre (não vinculada a outra ficha); a linha trava aqui, o CAS do registrador perde depois e relê.
    select t.id, (t.confirmado_em is null) into r_id, era_detectada
      from public.ab_native_tests t
     where t.site_id = p_site and t.video_id = f.video_id and t.estado = 'em_andamento'
       and not exists (select 1 from public.ab_native_fichas o where o.registro_id = t.id)
     for update;
    if r_id is null then
      select t.id into outro from public.ab_native_tests t
       where t.site_id = p_site and t.video_id = f.video_id and t.estado = 'em_andamento';
      if outro is not null then return jsonb_build_object('erro', 'ja_ha_teste_em_andamento', 'registro_id', outro); end if;
      return jsonb_build_object('erro', 'estado_mudou');
    end if;
    update public.ab_native_tests t set
      confirmado_em = coalesce(t.confirmado_em, now()),
      confirmado_por = coalesce(t.confirmado_por, p_usuario),
      variantes = f.variantes,
      campos = array(select distinct c from unnest(t.campos || f.campos) c order by c)
     where t.id = r_id;
  end if;

  -- 4: vincula (o `unique` em registro_id segura a dupla vinculação); 5: o lembrete da ficha sai do sino.
  update public.ab_native_fichas x set registro_id = r_id where x.id = p_ficha;
  update public.notifications n set expired_at = now()
   where n.domain = 'youtube' and n.dedup_key = 'ficha-lembrar:' || p_ficha::text and n.expired_at is null;

  return jsonb_build_object('ok', true, 'registro_id', r_id, 'confirmou_detectado', coalesce(era_detectada, false));
end $$;

revoke all on function public.ab_native_ficha_abrir(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.ab_native_iniciar(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ab_native_ficha_abrir(uuid, uuid, uuid) to service_role;
grant execute on function public.ab_native_iniciar(uuid, uuid, uuid) to service_role;

reset lock_timeout;
