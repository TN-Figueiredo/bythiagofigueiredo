-- F4 T6: tipo novo da fila da forja ('titulo-complementar') e alvo "video nosso x sinal".
-- Idempotente. Definicoes de partida conferidas em producao (T0, 29/10): task_type_check com 6 tipos,
-- target_check de 2 ramos, idx_yt_intel_obs_active sem o 'not in'.
-- set local: vale so nesta transacao, nao vaza para outras migrations do mesmo db push (T6-P5/Y5).
-- Rodar fora do minuto do cron da forja (a cada 10 min). Remover canal proprio apaga em cascata pedidos e leituras dele (T6-P7/Y6, esperado).
set local lock_timeout = '5s';

-- target_signal_id e signal_id SEM FK, de proposito: o sinal expira e some; em indice unico o NULL e distinto
-- e 'on delete set null' transformaria um pedido aberto em par sem sinal (R2-P2).
alter table youtube_intelligence_tasks
  add column if not exists target_own_video_id uuid references youtube_videos(id) on delete cascade,
  add column if not exists target_signal_id uuid;

alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_task_type_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_task_type_check
  check (task_type in ('diagnostico','padroes-titulo','padroes-titulo-shorts','temas','resumo-trocas','leitura-video','titulo-complementar'));

alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_target_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_check check (
  (task_type = 'diagnostico' and channel_id is not null and target_niche is null and target_video_id is null
      and target_own_video_id is null and target_signal_id is null)
  or (task_type = 'titulo-complementar' and target_niche is not null and target_own_video_id is not null
      and target_signal_id is not null and target_video_id is null)
  or (task_type not in ('diagnostico','titulo-complementar') and target_niche is not null
      and target_own_video_id is null and target_signal_id is null
      and ((task_type = 'leitura-video') = (target_video_id is not null)))
);

-- sem o drop o indice antigo (sem o 'not in') permanece e o 2o video do nicho dá 23505 (R2-Y3)
drop index if exists idx_yt_intel_obs_active;
create unique index idx_yt_intel_obs_active on youtube_intelligence_tasks (site_id, task_type, target_niche)
  where status in ('pending','running') and task_type not in ('diagnostico','titulo-complementar');

create unique index if not exists idx_yt_intel_titulo_active
  on youtube_intelligence_tasks (site_id, task_type, target_own_video_id, target_signal_id)
  where status in ('pending','running') and task_type = 'titulo-complementar';

-- signal_id sem FK: a leitura gravada sobrevive ao sinal
alter table competitor_readings
  add column if not exists own_video_id uuid references youtube_videos(id) on delete cascade,
  add column if not exists signal_id uuid;

-- sem este CHECK uma leitura sem own_video_id entra, a tarefa fecha 'ok' e a tela mostra "nenhum titulo" para sempre (falha em verde)
alter table competitor_readings drop constraint if exists competitor_readings_alvo_titulo_check;
alter table competitor_readings add constraint competitor_readings_alvo_titulo_check check (
  (task_type = 'titulo-complementar') = (own_video_id is not null)
  and (own_video_id is null) = (signal_id is null));

create index if not exists idx_competitor_readings_own_video
  on competitor_readings (site_id, task_type, own_video_id, generated_at desc) where own_video_id is not null;

-- ORDEM DA VOLTA (C-Y5): kit -> site -> migration, nunca parcial. 0) kit: rollback da T8 (a forja deixa de anunciar `titulo-complementar`); 1) site: revert de T7/T9 e promocao
-- (o codigo novo le target_own_video_id/target_signal_id em TODO tipo: com o `drop column` e a T7 no ar o claim quebra para diagnostico, padroes e temas);
-- 2) so entao o bloco abaixo. Ida: esta migration ANTES do deploy da T7.
-- CAMINHO DE VOLTA (rodar nesta ordem; antes de recriar os CHECKs/indice antigos, senao o rollback falha por linha que viola o CHECK velho):
--   -- 0) antes de tudo, exportar (texto do modelo nao e reproduzivel): \copy (select * from competitor_readings where task_type='titulo-complementar') to 'leituras-titulo-complementar-AAAAMMDD.csv' csv header
--   delete from youtube_intelligence_tasks where task_type = 'titulo-complementar';
--   delete from "competitor_readings" where task_type = 'titulo-complementar';
--   drop index if exists idx_yt_intel_titulo_active;
--   drop index if exists idx_competitor_readings_own_video;
--   alter table youtube_intelligence_tasks drop constraint youtube_intelligence_tasks_target_check;
--   alter table youtube_intelligence_tasks drop constraint youtube_intelligence_tasks_task_type_check;
--   alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_task_type_check check (task_type in ('diagnostico','padroes-titulo','padroes-titulo-shorts','temas','resumo-trocas','leitura-video'));
--   alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_check check ((task_type = 'diagnostico' and channel_id is not null and target_niche is null and target_video_id is null) or (task_type <> 'diagnostico' and target_niche is not null and ((task_type = 'leitura-video') = (target_video_id is not null))));
--   drop index if exists idx_yt_intel_obs_active;
--   create unique index idx_yt_intel_obs_active on youtube_intelligence_tasks (site_id, task_type, target_niche) where status in ('pending','running') and task_type <> 'diagnostico';
--   alter table youtube_intelligence_tasks drop column target_own_video_id, drop column target_signal_id;
--   alter table competitor_readings drop constraint if exists competitor_readings_alvo_titulo_check;
--   alter table competitor_readings drop column own_video_id, drop column signal_id;
