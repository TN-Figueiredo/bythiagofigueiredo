-- youtube_fatigue_alerts.expected_ctr / actual_ctr nasceram como numeric(6,4) (teto 99.9999) para
-- guardar CTR, mas o cron sync-analytics-metrics grava nelas CONTAGEM DE VIEWS por dia
-- (detectFatigue devolve expectedViews/actualViews, sempre >= 50). Qualquer valor >= 100 estoura
-- com 22003 (numeric field overflow) e o alerta não é gravado.
-- Alarga as duas colunas; os nomes ficam (renomear mexe em leitores e fica para o plano do A/B Lab).
-- Idempotente: alterar para o mesmo tipo de novo não faz nada. Tabela vazia em produção (08/10/2026).
alter table public.youtube_fatigue_alerts
  alter column expected_ctr type numeric(14,2),
  alter column actual_ctr type numeric(14,2);

comment on column public.youtube_fatigue_alerts.expected_ctr is
  'Views por dia esperadas pela curva do próprio vídeo (apesar do nome, não é CTR).';
comment on column public.youtube_fatigue_alerts.actual_ctr is
  'Views do último dia válido do vídeo (apesar do nome, não é CTR).';
