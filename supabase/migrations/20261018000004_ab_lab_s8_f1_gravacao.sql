-- ab_lab_s8_f1_gravacao (A/B Lab S8 fase 1): só gravação. Tabelas ab_test_dias e ab_test_sondas, ab_tests.regra_duracao,
-- quatro CHECKs alargados por superconjunto. Plano: docs/superpowers/plans/2026-10-18-ab-s8-f1-gravacao-plan.md. Desfazer: s8-f1-migration-desfazer.sql do ledger.
set lock_timeout = '5s';

alter table public.ab_tests add column if not exists regra_duracao text not null default 'v1';
alter table public.ab_tests drop constraint if exists ab_tests_regra_duracao_check;
alter table public.ab_tests add constraint ab_tests_regra_duracao_check check (regra_duracao in ('v1','v2'));

create table if not exists public.ab_test_dias (
  test_id uuid not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (length(youtube_video_id) = 11),
  regra_duracao text not null check (regra_duracao in ('v1','v2')),
  variant_id uuid,
  motivo_sem_variante text check (motivo_sem_variante in ('menos_de_90','meta_ausente','meta_nula','dia_de_outro_teste','teste_apagado')),
  motivo_nulo_meta text,
  segundos_no_ar int,
  segundos_do_dia int not null,
  dia_de_troca boolean,
  ciclos jsonb not null check (jsonb_typeof(ciclos) = 'array' and jsonb_array_length(ciclos) > 0),
  impressoes bigint,
  ctr numeric,
  alcance_estado text not null check (alcance_estado in ('medido','zero_medido','ausente_no_relatorio','aguardando','nao_medido')),
  source_report_id text,
  report_create_time timestamptz,
  views bigint,
  views_estado text not null check (views_estado in ('medido','zero_medido','nao_medido')),
  views_fonte text,
  metric_version text,
  engaged_views bigint,
  watch_time_minutes numeric,
  avg_view_percentage numeric,
  troca_vista_em timestamptz,
  retratado_em timestamptz not null,
  final boolean not null default false,
  primary key (test_id, day_pt),
  check ((variant_id is null) = (motivo_sem_variante is not null)),
  check (troca_vista_em is null or dia_de_troca)
);
create index if not exists ab_test_dias_abertas on public.ab_test_dias (test_id) where not final;

create table if not exists public.ab_test_sondas (
  test_id uuid not null,
  hora timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (length(youtube_video_id) = 11),
  lida_em timestamptz not null,
  http int,
  erro text check (erro is null or erro in ('timeout','rede','imagem_invalida') or erro ~ '^http_[0-9]{3}$'),
  etag text,
  enviada_em timestamptz,
  sha16 text,
  dhash text,
  variante_esperada uuid,
  variante_vista uuid,
  leitura_estado text not null check (leitura_estado in ('bate','nenhuma_bate','sem_referencia','ambigua','falhou')),
  variantes_sem_referencia smallint not null default 0,
  primary key (test_id, hora)
);

create or replace function public.ab_test_dias_apply(p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.ab_test_dias (test_id, day_pt, site_id, youtube_video_id, regra_duracao, variant_id, motivo_sem_variante,
    motivo_nulo_meta, segundos_no_ar, segundos_do_dia, dia_de_troca, ciclos, impressoes, ctr, alcance_estado, source_report_id,
    report_create_time, views, views_estado, views_fonte, metric_version, engaged_views, watch_time_minutes, avg_view_percentage,
    troca_vista_em, retratado_em, final)
  select x.test_id, x.day_pt, x.site_id, x.youtube_video_id, x.regra_duracao, x.variant_id, x.motivo_sem_variante,
    x.motivo_nulo_meta, x.segundos_no_ar, x.segundos_do_dia, x.dia_de_troca, x.ciclos, x.impressoes, x.ctr, x.alcance_estado,
    x.source_report_id, x.report_create_time, x.views, x.views_estado, x.views_fonte, x.metric_version, x.engaged_views,
    x.watch_time_minutes, x.avg_view_percentage, x.troca_vista_em, x.retratado_em, x.final
  from jsonb_to_recordset(p_rows) as x(test_id uuid, day_pt date, site_id uuid, youtube_video_id text, regra_duracao text,
    variant_id uuid, motivo_sem_variante text, motivo_nulo_meta text, segundos_no_ar int, segundos_do_dia int, dia_de_troca boolean,
    ciclos jsonb, impressoes bigint, ctr numeric, alcance_estado text, source_report_id text, report_create_time timestamptz,
    views bigint, views_estado text, views_fonte text, metric_version text, engaged_views bigint, watch_time_minutes numeric,
    avg_view_percentage numeric, troca_vista_em timestamptz, retratado_em timestamptz, final boolean)
  on conflict (test_id, day_pt) do update set
    site_id = excluded.site_id, youtube_video_id = excluded.youtube_video_id, regra_duracao = excluded.regra_duracao,
    variant_id = excluded.variant_id, motivo_sem_variante = excluded.motivo_sem_variante, motivo_nulo_meta = excluded.motivo_nulo_meta,
    segundos_no_ar = excluded.segundos_no_ar, segundos_do_dia = excluded.segundos_do_dia, dia_de_troca = excluded.dia_de_troca,
    ciclos = excluded.ciclos, impressoes = excluded.impressoes, ctr = excluded.ctr, alcance_estado = excluded.alcance_estado,
    source_report_id = excluded.source_report_id, report_create_time = excluded.report_create_time, views = excluded.views,
    views_estado = excluded.views_estado, views_fonte = excluded.views_fonte, metric_version = excluded.metric_version,
    engaged_views = excluded.engaged_views, watch_time_minutes = excluded.watch_time_minutes,
    avg_view_percentage = excluded.avg_view_percentage, troca_vista_em = excluded.troca_vista_em,
    retratado_em = excluded.retratado_em, final = excluded.final
  where not public.ab_test_dias.final;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.ab_test_dias_fechar_apagados(p_test_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.ab_test_dias set final = true, retratado_em = now(),
    alcance_estado = case when alcance_estado = 'aguardando' then 'nao_medido' else alcance_estado end,
    motivo_sem_variante = case when variant_id is null then 'teste_apagado' else motivo_sem_variante end
  where test_id = any(p_test_ids) and not final;
  get diagnostics n = row_count;
  return n;
end $$;

-- Linhas abertas antigas demais para a janela de leitura: fecham sem tocar variante nem motivo (Yannis B2).
create or replace function public.ab_test_dias_fechar_antigas(p_antes date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.ab_test_dias set final = true, retratado_em = now(),
    alcance_estado = case when alcance_estado = 'aguardando' then 'nao_medido' else alcance_estado end
  where day_pt < p_antes and not final;
  get diagnostics n = row_count;
  return n;
end $$;

-- Funções: só a service role executa.
revoke all on function public.ab_test_dias_apply(jsonb) from public, anon, authenticated;
revoke all on function public.ab_test_dias_fechar_apagados(uuid[]) from public, anon, authenticated;
revoke all on function public.ab_test_dias_fechar_antigas(date) from public, anon, authenticated;
grant execute on function public.ab_test_dias_apply(jsonb) to service_role;
grant execute on function public.ab_test_dias_fechar_apagados(uuid[]) to service_role;
grant execute on function public.ab_test_dias_fechar_antigas(date) to service_role;

-- RLS: leitura só de quem edita o site; sem policy de escrita.
alter table public.ab_test_dias enable row level security;
alter table public.ab_test_sondas enable row level security;
revoke all on table public.ab_test_dias from anon;
revoke all on table public.ab_test_sondas from anon;
revoke insert, update, delete, truncate on table public.ab_test_dias from authenticated;
revoke insert, update, delete, truncate on table public.ab_test_sondas from authenticated;
drop policy if exists "ab_test_dias_select" on public.ab_test_dias;
create policy "ab_test_dias_select" on public.ab_test_dias for select to authenticated using (public.can_edit_site(site_id));
drop policy if exists "ab_test_sondas_select" on public.ab_test_sondas;
create policy "ab_test_sondas_select" on public.ab_test_sondas for select to authenticated using (public.can_edit_site(site_id));

-- Índice da leitura de relatórios por tipo, canal e início.
create index if not exists yt_reporting_reports_tipo_canal_inicio on public.yt_reporting_reports (report_type_id, channel_id, start_time);

-- Quatro CHECKs alargados por superconjunto, na mesma transação (shape e histórico aceitam o mesmo conjunto).
alter table public.ab_tests drop constraint if exists ab_tests_completed_reason_check;
alter table public.ab_tests add constraint ab_tests_completed_reason_check check (
  completed_reason is null or completed_reason in ('auto_resolve','manual_winner','manual_archive','max_duration','inconclusive','manual_no_apply','manual_apply','regra_v2')
) not valid;
alter table public.ab_tests validate constraint ab_tests_completed_reason_check;

alter table public.ab_test_cycles drop constraint if exists ab_test_cycles_end_reason_check;
alter table public.ab_test_cycles add constraint ab_test_cycles_end_reason_check check (
  end_reason is null or end_reason in ('pausa','encerrado','falha_api','duracao_maxima','drift','rotacao','regra_v2','teste_youtube')
) not valid;
alter table public.ab_test_cycles validate constraint ab_test_cycles_end_reason_check;

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
        and restore_status -> 'title' ->> 'estado' in ('em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu', 'pulado_teste_youtube')
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
        and restore_status -> 'thumbnail' ->> 'estado' in ('em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu', 'pulado_teste_youtube')
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
) not valid;
alter table public.ab_tests validate constraint ab_tests_restore_status_shape;

alter table public.ab_test_restores drop constraint if exists ab_test_restores_estado_check;
alter table public.ab_test_restores add constraint ab_test_restores_estado_check check (
  estado in ('ok','falhou','pulado_sem_original','pulado_drift','desistiu','pulado_teste_youtube')
) not valid;
alter table public.ab_test_restores validate constraint ab_test_restores_estado_check;

-- Comentários: o que nulo quer dizer.
comment on column public.ab_tests.regra_duracao is 'A/B Lab S8: regra de duração com que o teste nasceu (v1 = a atual; v2 = futura). Nunca nulo; default v1.';
comment on table public.ab_test_dias is 'A/B Lab S8-F1: retrato diário por teste e dia do Pacífico (day_pt). Escrito só pelo cron ab-retrato via ab_test_dias_apply. final = não muda mais (D+10 ou fechada).';
comment on column public.ab_test_dias.variant_id is 'Variante que valeu no dia. Nulo = dia sem variante atribuída; ver motivo_sem_variante (nunca a variante do ciclo por palpite).';
comment on column public.ab_test_dias.motivo_sem_variante is 'Por que variant_id é nulo: menos_de_90, meta_ausente, meta_nula, dia_de_outro_teste, teste_apagado. Nulo = há variante.';
comment on column public.ab_test_dias.motivo_nulo_meta is 'Recalculado pela S8 (recálculo) com os ciclos só deste teste; nulo = não reproduzido aqui; não é o valor que a A5 calculou nem o que a meta_daily viu.';
comment on column public.ab_test_dias.segundos_no_ar is 'seconds_on_air_analytics da meta do dia. Nulo = sem meta.';
comment on column public.ab_test_dias.segundos_do_dia is 'Duração do dia do Pacífico em segundos (82800, 86400 ou 90000).';
comment on column public.ab_test_dias.dia_de_troca is 'Variante diferente da do dia anterior do mesmo teste. Nulo = primeiro dia ou uma das duas variantes é nula.';
comment on column public.ab_test_dias.ciclos is 'Ciclos do teste que tocam o dia: [{id, started_at, ended_at}].';
comment on column public.ab_test_dias.impressoes is 'Impressões do dia no relatório channel_reach_basic_a1. Nulo = sem linha de alcance (ver alcance_estado; o zero de zero_medido é do estado, não desta coluna).';
comment on column public.ab_test_dias.ctr is 'CTR do dia no relatório. Nulo = sem medida.';
comment on column public.ab_test_dias.alcance_estado is 'medido, zero_medido, ausente_no_relatorio, aguardando (relatório ainda não normalizado) ou nao_medido.';
comment on column public.ab_test_dias.source_report_id is 'Relatório de onde veio o alcance. Nulo = sem relatório.';
comment on column public.ab_test_dias.report_create_time is 'create_time do relatório de origem. Nulo = sem relatório.';
comment on column public.ab_test_dias.views is 'Views do DIA (não o total de 90 dias). Nulo = nao_medido.';
comment on column public.ab_test_dias.views_estado is 'medido, zero_medido ou nao_medido.';
comment on column public.ab_test_dias.views_fonte is 'Fonte da linha do diário, copiada como veio. Nulo = sem linha.';
comment on column public.ab_test_dias.metric_version is 'Versão da métrica da linha do diário. Nulo = sem linha.';
comment on column public.ab_test_dias.engaged_views is 'Views engajadas do dia. Nulo = não medido.';
comment on column public.ab_test_dias.watch_time_minutes is 'Minutos assistidos no dia. Nulo = não medido.';
comment on column public.ab_test_dias.avg_view_percentage is 'Percentual médio assistido. Nulo = não medido.';
comment on column public.ab_test_dias.troca_vista_em is 'Primeira sonda que viu a nova miniatura no dia de troca. Nulo = não vista ou teste de título.';
comment on column public.ab_test_dias.retratado_em is 'Quando a linha foi gravada pela última vez.';
comment on column public.ab_test_dias.final is 'true = a linha não muda mais (apply ignora).';
comment on table public.ab_test_sondas is 'A/B Lab S8-F1: leitura horária da miniatura servida pelo CDN, por teste e hora UTC. Escrito só pelo cron ab-sonda-miniatura.';
comment on column public.ab_test_sondas.http is 'Status HTTP do HEAD/GET. Nulo = não houve resposta (ver erro).';
comment on column public.ab_test_sondas.erro is 'timeout, rede, http_<n> ou imagem_invalida. Nulo = sem erro.';
comment on column public.ab_test_sondas.etag is 'ETag cru da resposta. Nulo = sem resposta ou sem ETag.';
comment on column public.ab_test_sondas.enviada_em is 'Instante de envio derivado do ETag numérico. Nulo = ETag não numérico ou "0".';
comment on column public.ab_test_sondas.dhash is 'dHash da imagem lida. Nulo = não lida.';
comment on column public.ab_test_sondas.variante_esperada is 'Variante que o Lab achava no ar. Nulo = nenhuma.';
comment on column public.ab_test_sondas.variante_vista is 'Variante cuja referência bate com o dHash. Nulo = nenhuma ou ambígua.';
comment on column public.ab_test_sondas.variantes_sem_referencia is 'Quantas variantes do teste não tinham dHash de referência na leitura.';

reset lock_timeout;
