-- Semente da página Arquivo (M5, Tarefa 14, Gio). SÓ para o banco de integração bythiago_int (54422). Nunca 54322 nem produção.
-- Caso cheio: "hoje" = 03/05/2028, simulado por obs_archive.hoje/agora (ver m5-relogio.sh: define no PAPEL authenticator; não usa data fixa
-- no futuro nas colunas: tudo é relativo a :hoje abaixo). Idempotente: apaga o que é do site antes de semear.
-- Uso: psql "$DB" -v ON_ERROR_STOP=1 -f m5-arquivo.sql
\set site '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c'
begin;
select set_config('obs_archive.hoje', '2028-05-03', true), set_config('obs_archive.agora', '2028-05-03 14:00:00-03', true);
set local session_replication_role = replica;   -- sem gatilhos de guarda nas cargas diretas (a semente imita estados que os gatilhos só deixam chegar passo a passo)

delete from public.obs_archive_unit_parts where unit_id in (select id from public.obs_archive_units where site_id = :'site');
delete from public.obs_archive_units where site_id = :'site';
delete from public.obs_archive_months where site_id = :'site';
delete from public.obs_archive_restores where site_id = :'site';
delete from public.obs_archive_switch where site_id = :'site';
delete from public.obs_archive_heartbeat where site_id = :'site';
delete from public.obs_archive_channel_removals where site_id = :'site';
delete from public.competitor_channels where site_id = :'site' and id::text like 'aaaaaaaa-%';

-- canais ativos (um com nome de 100 caracteres, Review Focus 4)
insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001', :'site', 'UCgio000000000000000001', 'Nômade Raiz', '2026-09-15T12:00:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000002', :'site', 'UCgio000000000000000002', 'Rota Andina', '2026-09-15T12:00:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000003', :'site', 'UCgio000000000000000003', 'Mochilão Sem Fim', '2026-09-15T12:00:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000004', :'site', 'UCgio000000000000000004', 'Viagem Lenta pelo Mundo com um Nome Muito Comprido que Passa dos Cem Caracteres de Propósito para Estourar a Linha', '2026-09-15T12:00:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000005', :'site', 'UCgio000000000000000005', 'Emoji 🌍 "aspas" <b>tag</b> & cia', '2026-09-15T12:00:00Z');

insert into public.obs_archive_switch (site_id, class, first_month, first_month_at, armed_at) values
 (:'site', 'horaria', '2026-10-01', '2026-10-02', '2026-10-02'), (:'site', 'serie', '2026-10-01', '2026-10-02', '2026-10-02'), (:'site', 'texto', '2026-10-01', '2026-10-02', '2026-10-02');

-- meses: m = 2028-05 menos k meses. Estados por deslocamento k (sem linha: k=0 e k=1)
-- k>=9 (serie) / k>=4 (horaria) / k>=9 (texto): no arquivo (descartado); depois destacado, pode sair, recuperação, B2, NAS, e a fila.
with t as (
  select * from (values ('horaria','competitor_video_hourly',3),('serie','competitor_video_daily',6),('serie','competitor_video_early',6),
                        ('texto','competitor_video_comments',6),('texto','competitor_video_comment_marks',6),('texto','competitor_raw',6)) v(cl,tb,win)
), k as (select generate_series(2, 19) as k), g as (
  select t.*, k.k, (date '2028-05-01' - (k.k || ' months')::interval)::date as mes from t cross join k
)
insert into public.obs_archive_months (site_id, class, table_name, month, units_total, units_empty, rows_total, days_measured, days_in_month,
   sealed_at, sealed_version, sealed_kind, nas_attested_at, b2_forja_ok_at, b2_attested_at, b2_attested_via, b2_last_attempt_at, b2_last_attempt_result, b2_last_attempt_via,
   detached_at, dropped_at, drop_mode, rows_dropped, bytes_freed)
select :'site', cl, tb, mes, 5, 0, 5000, extract(day from (mes + interval '1 month' - interval '1 day'))::int, extract(day from (mes + interval '1 month' - interval '1 day'))::int,
   case when k >= 2 then (mes + interval '1 month' + interval '29 days') end, 1, case when k >= 2 then 'com_dado' end,
   case when k >= 2 then timestamptz '2028-05-03 06:17-03' end,
   case when k >= 3 then timestamptz '2028-05-03 11:20-03' end,
   case when k >= 3 then timestamptz '2028-05-03 11:20-03' end, case when k >= 3 then 'forja' end,
   case when k >= 3 then timestamptz '2028-05-03 11:20-03' end, case when k >= 3 then 'ok' end, case when k >= 3 then 'forja' end,
   case when k >= win + 1 then timestamptz '2028-05-01 09:00-03' end,
   case when k >= win + 2 then timestamptz '2028-04-02 09:00-03' end, case when k >= win + 2 then 'clique' end,
   case when k >= win + 2 then 5000 end, case when k >= win + 2 then 1000000 end
  from g where mes >= date '2026-10-01';

-- um problema: serie/daily, mês k=3 (fev/2028) sem a conferência do B2 (âmbar), e um mês de texto ainda sem selo e já devido (atrasado)
update public.obs_archive_months set b2_attested_at = null, b2_attested_via = null, b2_forja_ok_at = null, b2_last_attempt_at = null, b2_last_attempt_result = null, b2_last_attempt_via = null
 where site_id = :'site' and table_name = 'competitor_video_early' and month = '2028-02-01';
update public.obs_archive_months set sealed_at = null, sealed_kind = null, nas_attested_at = null, b2_attested_at = null, b2_attested_via = null, b2_forja_ok_at = null
 where site_id = :'site' and table_name = 'competitor_raw' and month = '2028-02-01';

-- unidades dos canais ativos para os meses selados e para 2028-03 parcialmente (copiando) em daily
insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at, nas_attested_at)
select :'site', m.class, m.table_name, c.id::text, m.month, 1, 1000, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64), 200000, 1, m.nas_attested_at, m.nas_attested_at
  from public.obs_archive_months m cross join public.competitor_channels c
 where m.site_id = :'site' and c.site_id = :'site' and c.id::text like 'aaaaaaaa-%' and m.sealed_at is not null and m.class in ('horaria', 'serie', 'texto');
-- canais removidos: A (pedido, 3 meses de unidades), B (sem destino, unidades), C (sem arquivo, com Blobs por apagar)
insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_via, archive_decision, decided_at, units_at_removal, bytes_at_removal, first_month, last_month, online_thumbs_known, blobs_pending) values
 (:'site', 'bbbbbbbb-0000-0000-0000-00000000000a', 'UCremovido0000000000000a', 'Canal Removido A', '2028-04-28T12:00:00Z', 'botao', 'apagar', '2028-04-28T12:00:00Z', 3, 600000, '2027-10-01', '2027-12-01', true, '{}'),
 (:'site', 'bbbbbbbb-0000-0000-0000-00000000000c', 'UCremovido0000000000000c', 'Canal Removido C (sem arquivo)', '2028-04-20T12:00:00Z', 'fila', 'apagar', '2028-04-20T12:00:00Z', 0, 0, null, null, true, '{https://blob.example/a.jpg,https://blob.example/b.jpg}');
insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at, nas_attested_at)
select :'site', 'serie', 'competitor_video_daily', ref, mes, 1, 500, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64), 100000, 1, now(), now()
  from (values ('bbbbbbbb-0000-0000-0000-00000000000a'), ('bbbbbbbb-0000-0000-0000-00000000000b')) r(ref), (values (date '2027-10-01'), (date '2027-11-01'), (date '2027-12-01')) mm(mes);

-- batimentos: a casa responde (copiador e conferir_b2)
insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, version, nas_ok, nas_checked_at, updated_at, machine_time) values
 (:'site', 'copiador', '2028-05-03 13:50:00-03', '1', true, '2028-05-03 13:50:00-03', '2028-05-03 13:50:00-03', '2028-05-03 13:50:00-03'),
 (:'site', 'conferir_b2', '2028-05-03 13:30:00-03', '1', true, '2028-05-03 13:30:00-03', '2028-05-03 13:30:00-03', '2028-05-03 13:30:00-03');
-- recuperação testada (schema_fp igual ao atual, para o teste valer)
insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by, done_at)
select :'site', p.class, p.table_name, public.obs_archive_schema_fp(pg_catalog.to_regclass('public.' || p.table_name)), 'b2', 'cofre', 5, 5000, 0, 'gio', '2028-01-10 10:00-03'
  from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto');
commit;
