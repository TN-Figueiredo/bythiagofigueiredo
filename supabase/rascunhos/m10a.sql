-- M10a (fase de manutenção, emenda de 14/10): o vídeo antigo, o que não depende de ninguém.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.8; 05 §15.1 (M10a) e §17 (pedido 15); 06 §18, itens 135, 138 e 139.
-- Com ZERO vídeo marcado nada disto muda dado nem saída, salvo chaves novas que valem 0:
--   competitor_series_health.arquivados; competitor_channel_removal_impact.videos_leitura_mensal e .videos_no_arquivo;
--   apply_competitor_tier_plan.ignorados_congelados.
-- Ordem dura (02 §10.8, passos 1 e 2): esta migration ANTES do código que lê as colunas.
-- Depende só de ordem da M2 (arquivo posterior e push separado, depois da M2 conferida); não usa objeto dela.
-- Idempotente: add column/create table/create index if not exists, create or replace function, drop trigger if exists.
set lock_timeout = '3s';
