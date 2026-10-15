-- Retira UM dia da cobertura de UM vídeo e UM conjunto (parte o intervalo em dois). O dia deixa de ser
-- "conferido, sem mudança" e passa a ser AUSÊNCIA: uma derivação refeita não avança last_day_pt por ele.
-- As versões já derivadas não mudam. Só usar quando a linha do dia não pode voltar pelo CSV.
-- (você roda) Trocar <UUID_DO_SITE>, <VIDEO>, <CONJUNTO> (meta_texto ou meta_thumb) e <DIA> (AAAA-MM-DD) nas três
-- instruções. Colar tudo de uma vez: é uma transação.
begin;
-- 1. O que vinha depois do dia vira um intervalo novo.
insert into public.yt_own_video_coverage
  (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
select c.youtube_video_id, c.metric_set, date '<DIA>' + 1, c.covered_to, c.site_id, c.video_id, c.channel_id, c.source, c.collected_at
  from public.yt_own_video_coverage c
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from <= date '<DIA>' and c.covered_to > date '<DIA>';
-- 2. Se o dia é o primeiro do intervalo, o intervalo antigo sai.
delete from public.yt_own_video_coverage c
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from = date '<DIA>';
-- 3. Senão, ele termina na véspera.
update public.yt_own_video_coverage c
   set covered_to = date '<DIA>' - 1
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from < date '<DIA>' and c.covered_to >= date '<DIA>';
-- 4. Confere: os intervalos que sobraram (o buraco tem de aparecer em <DIA>). Se a lista vier igual a antes, nada mudou:
-- o dia já estava fora da cobertura ou o <VIDEO>/<CONJUNTO>/<UUID_DO_SITE> está errado.
select c.covered_from, c.covered_to from public.yt_own_video_coverage c
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
 order by 1;
commit;
