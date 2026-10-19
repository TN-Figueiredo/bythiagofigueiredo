-- ab_lab_s7_teste_nativo (A/B Lab S7 fase 1): registro do teste nativo do YouTube.
-- Rascunho (T6). Idempotente. Nenhum CHECK de tabela existente (ab_test_restores_estado_check etc. são da S8-F1).
-- Não depende da S4 (yt_watch_reter é plpgsql: não confere yt_watch_alvos ao criar) nem da S8-F1.
set lock_timeout = '5s';

-- ---------------------------------------------------------------- 7.1
create table if not exists public.ab_native_tests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  origem text not null check (origem in ('detectado','confirmado')),
  campos text[] not null check (campos <@ array['titulo','miniatura'] and cardinality(campos) between 1 and 2),
  estado text not null check (estado in ('em_andamento','encerrado','sem_desfecho','descartado')),
  variantes_titulo jsonb check (variantes_titulo is null or (jsonb_typeof(variantes_titulo) = 'array' and jsonb_array_length(variantes_titulo) between 2 and 3)),
  votos_titulo jsonb,
  titulo_oficial text check (titulo_oficial is null or length(btrim(titulo_oficial)) > 0),
  primeira_vista timestamptz,
  ultima_vista timestamptz,
  veredito jsonb,
  versao_regra smallint,
  sinais_fracos jsonb not null default '[]'::jsonb,
  evidencia jsonb not null default '[]'::jsonb,
  miniatura_a jsonb,
  desfecho_estado text check (desfecho_estado in ('vencedor_provavel','em_andamento','sem_dado')),
  desfecho_motivo text,
  desfecho_versao_regra smallint,
  desfecho_em timestamptz,
  vencedor_titulo text,
  vencedor_fonte text check (vencedor_fonte in ('regra','dono','data_api')),
  vencedor_visto_em timestamptz, -- captura (Data API ou dono) que sustentou o vencedor; obrigatória quando a fonte é data_api
  confirmado_em timestamptz, confirmado_por uuid references auth.users(id) on delete set null,
  descartado_em timestamptz, descartado_por uuid references auth.users(id) on delete set null,
  encerrado_em timestamptz,
  evidencia_cortada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origem = 'detectado' or confirmado_em is not null),
  check ((estado = 'descartado') = (descartado_em is not null)),
  check ((estado in ('encerrado','sem_desfecho')) = (encerrado_em is not null)),
  check ((vencedor_titulo is null) = (vencedor_fonte is null)),
  check (vencedor_fonte is distinct from 'data_api' or vencedor_visto_em is not null),
  check (origem = 'confirmado' or (variantes_titulo is not null and primeira_vista is not null and versao_regra is not null)),
  check (ultima_vista is null or ultima_vista >= primeira_vista)
);
create unique index if not exists ab_native_tests_um_aberto on public.ab_native_tests (site_id, video_id) where estado = 'em_andamento';
create index if not exists ab_native_tests_video on public.ab_native_tests (video_id, created_at desc);

-- CAS por updated_at: o relógio de parede do statement não serve (duas escritas na mesma transação empatam); clock_timestamp() sim.
create or replace function public.ab_native_tests_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists ab_native_tests_updated_at on public.ab_native_tests;
create trigger ab_native_tests_updated_at before update on public.ab_native_tests
  for each row execute function public.ab_native_tests_set_updated_at();

-- ---------------------------------------------------------------- 7.2
create table if not exists public.ab_native_avaliacoes (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  avaliada_em timestamptz not null,
  ate_lida_em timestamptz,
  estado_14 text not null check (estado_14 in ('sem_leitura','insuficiente','nada_visivel','provavel_teste','sem_rodada_nova','erro')),
  motivo_14 text,
  estado_48 text check (estado_48 in ('sem_leitura','insuficiente','nada_visivel','provavel_teste')),
  mistas_48 smallint,
  mistas_48_fora_quarentena smallint,
  min_desde_escrita int[],
  estado_pos_liberacao text check (estado_pos_liberacao is null or estado_pos_liberacao in ('sem_leitura','insuficiente','nada_visivel','provavel_teste')),
  contagem jsonb,
  escritas smallint,
  versao_regra smallint not null,
  registro_id uuid references public.ab_native_tests(id) on delete set null,
  erro text check (erro is null or erro ~ '^[a-z0-9_]{1,40}$'),
  retroativa boolean not null default false,
  aviso text check (aviso is null or aviso in ('variantes_demais')),
  check ((estado_14 = 'erro') = (erro is not null))
);
create index if not exists ab_native_avaliacoes_ultima on public.ab_native_avaliacoes (video_id, avaliada_em desc);
create index if not exists ab_native_avaliacoes_poda on public.ab_native_avaliacoes (avaliada_em);
create index if not exists ab_native_avaliacoes_registro on public.ab_native_avaliacoes (registro_id) where registro_id is not null;

-- ---------------------------------------------------------------- 7.3 (fase 2, vazia)
create table if not exists public.ab_guarda_liberacoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  motivo_na_hora text not null,
  liberado_em timestamptz not null default now(),
  liberado_por uuid references auth.users(id) on delete set null,
  valido_ate timestamptz not null,
  desfeito_em timestamptz, desfeito_por uuid references auth.users(id) on delete set null
);
create index if not exists ab_guarda_liberacoes_video on public.ab_guarda_liberacoes (video_id, liberado_em desc);

-- ---------------------------------------------------------------- RLS
alter table public.ab_native_tests enable row level security;
alter table public.ab_native_avaliacoes enable row level security;
alter table public.ab_guarda_liberacoes enable row level security;

drop policy if exists ab_native_tests_select on public.ab_native_tests;
create policy ab_native_tests_select on public.ab_native_tests for select to authenticated using (public.can_edit_site(site_id));
drop policy if exists ab_native_avaliacoes_select on public.ab_native_avaliacoes;
create policy ab_native_avaliacoes_select on public.ab_native_avaliacoes for select to authenticated using (public.can_edit_site(site_id));
drop policy if exists ab_guarda_liberacoes_select on public.ab_guarda_liberacoes;
create policy ab_guarda_liberacoes_select on public.ab_guarda_liberacoes for select to authenticated using (public.can_edit_site(site_id));

revoke all on public.ab_native_tests, public.ab_native_avaliacoes, public.ab_guarda_liberacoes from anon;
revoke insert, update, delete, truncate, references, trigger on public.ab_native_tests, public.ab_native_avaliacoes, public.ab_guarda_liberacoes from authenticated;

-- ---------------------------------------------------------------- funções (todas service_role)
create or replace function public.yt_watch_reter(p_site uuid, p_video text, p_ate timestamptz) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if p_site is null or p_video is null or p_ate is null then
    raise exception 'yt_watch_reter: parametro nulo' using errcode = '22004';
  end if;
  update public.yt_watch_alvos set reter_ate = greatest(reter_ate, p_ate)
   where site_id = p_site and youtube_video_id = p_video;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.ab_native_ultimas(p_videos uuid[])
returns table (video_id uuid, alguma boolean, ultima_em timestamptz, ultima_ok_em timestamptz,
               ultimo_erro_em timestamptz, ultimo_erro text, ultimo_erro_id bigint, ultima_id bigint, ultimo_sem_rodada_em timestamptz)
language sql stable security invoker set search_path = '' as $$
  select v.id,
         exists (select 1 from public.ab_native_avaliacoes x where x.video_id = v.id and x.estado_14 <> 'erro') as alguma,
         u.avaliada_em, ok.avaliada_em, er.avaliada_em, er.erro, er.id, u.id, sr.avaliada_em
    from unnest(p_videos) as v(id)
    left join lateral (select a.id, a.avaliada_em from public.ab_native_avaliacoes a
                        where a.video_id = v.id and not a.retroativa order by a.avaliada_em desc, a.id desc limit 1) u on true
    left join lateral (select a.avaliada_em from public.ab_native_avaliacoes a
                        where a.video_id = v.id and not a.retroativa and a.estado_14 not in ('erro','sem_rodada_nova')
                        order by a.avaliada_em desc, a.id desc limit 1) ok on true
    left join lateral (select a.id, a.avaliada_em, a.erro from public.ab_native_avaliacoes a
                        where a.video_id = v.id and a.estado_14 = 'erro' order by a.avaliada_em desc, a.id desc limit 1) er on true
    left join lateral (select a.avaliada_em from public.ab_native_avaliacoes a
                        where a.video_id = v.id and a.estado_14 = 'sem_rodada_nova' order by a.avaliada_em desc, a.id desc limit 1) sr on true;
$$;

create or replace function public.ab_native_poda(p_agora timestamptz, p_lote integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if p_agora is null or p_lote is null or p_lote < 1 or p_lote > 5000 then
    raise exception 'p_lote invalido' using errcode = '22023';
  end if;
  delete from public.ab_native_avaliacoes
   where id in (select id from public.ab_native_avaliacoes
                 where avaliada_em < p_agora - interval '180 days' order by avaliada_em limit p_lote);
  get diagnostics n = row_count;
  return n;
end $$;

-- Reprodução do passado: registros e avaliações na MESMA transação; a guarda (sem avaliação sem erro) é a própria trava.
-- site_id e video_id vêm dos parâmetros, nunca do JSON.
create or replace function public.ab_native_reproduzir(p_site uuid, p_video uuid, p_registros jsonb, p_avaliacoes jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ab_native:' || p_video::text, 0));
  if exists (select 1 from public.ab_native_avaliacoes where video_id = p_video and estado_14 <> 'erro') then
    return 0;
  end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p_avaliacoes, '[]'::jsonb)) e
                  where coalesce(e->>'estado_14', 'erro') <> 'erro') then
    raise exception 'reproducao sem avaliacao sem erro' using errcode = '22023';
  end if;

  insert into public.ab_native_tests (
    id, site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, votos_titulo, titulo_oficial,
    primeira_vista, ultima_vista, veredito, versao_regra, sinais_fracos, evidencia, miniatura_a,
    desfecho_estado, desfecho_motivo, desfecho_versao_regra, desfecho_em, vencedor_titulo, vencedor_fonte, vencedor_visto_em,
    encerrado_em, evidencia_cortada)
  select coalesce(r.id, gen_random_uuid()), p_site, p_video, r.youtube_video_id, r.origem, r.campos, r.estado,
         r.variantes_titulo, r.votos_titulo, r.titulo_oficial, r.primeira_vista, r.ultima_vista, r.veredito, r.versao_regra,
         coalesce(r.sinais_fracos, '[]'::jsonb), coalesce(r.evidencia, '[]'::jsonb), r.miniatura_a,
         r.desfecho_estado, r.desfecho_motivo, r.desfecho_versao_regra, r.desfecho_em, r.vencedor_titulo, r.vencedor_fonte, r.vencedor_visto_em,
         r.encerrado_em, coalesce(r.evidencia_cortada, false)
    from jsonb_populate_recordset(null::public.ab_native_tests, coalesce(p_registros, '[]'::jsonb)) r;

  insert into public.ab_native_avaliacoes (
    site_id, video_id, avaliada_em, ate_lida_em, estado_14, motivo_14, estado_48, mistas_48, mistas_48_fora_quarentena,
    min_desde_escrita, estado_pos_liberacao, contagem, escritas, versao_regra, registro_id, erro, retroativa, aviso)
  select p_site, p_video, a.avaliada_em, a.ate_lida_em, a.estado_14, a.motivo_14, a.estado_48, a.mistas_48, a.mistas_48_fora_quarentena,
         a.min_desde_escrita, a.estado_pos_liberacao, a.contagem, a.escritas, a.versao_regra, a.registro_id, a.erro,
         coalesce(a.retroativa, false), a.aviso
    from jsonb_populate_recordset(null::public.ab_native_avaliacoes, coalesce(p_avaliacoes, '[]'::jsonb)) a
   order by a.avaliada_em;
  get diagnostics n = row_count;
  if exists (select 1 from public.ab_native_avaliacoes a join public.ab_native_tests t on t.id = a.registro_id
              where a.video_id = p_video and t.video_id <> p_video) then
    raise exception 'registro de outro video' using errcode = '23514';
  end if;
  return n;
end $$;

revoke all on function public.yt_watch_reter(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.ab_native_ultimas(uuid[]) from public, anon, authenticated;
revoke all on function public.ab_native_poda(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.ab_native_reproduzir(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_watch_reter(uuid, text, timestamptz) to service_role;
grant execute on function public.ab_native_ultimas(uuid[]) to service_role;
grant execute on function public.ab_native_poda(timestamptz, integer) to service_role;
grant execute on function public.ab_native_reproduzir(uuid, uuid, jsonb, jsonb) to service_role;

reset lock_timeout;
