-- =============================================================================
-- MIGRATION: youtube_intelligence — a analise de CANAL passa a acumular historico
-- =============================================================================
--
-- PROBLEMA
-- `idx_youtube_intelligence_channel_dedup` era UNIQUE (site_id, channel_id, source)
-- WHERE video_id IS NULL: UMA linha por fonte, para sempre. A maquina local mede o
-- canal toda semana e cada execucao APAGAVA a anterior (o write path fazia
-- read-then-update). Nao havia como ver tendencia, e uma execucao ruim destruia a
-- medicao boa anterior. Em producao (2026-09-22) existiam exatamente 2 linhas de
-- canal — uma `forja` e uma `cowork` de maio — e nunca existiriam mais.
--
-- DECISAO (do dono, explicita e ciente do custo, 2026-09-22): acumular, como ja
-- fazem `video_grade_history`, `playlist_snapshots`, `competitor_channel_snapshots`
-- e `content_pipeline_history`. A analise de canal era a unica que se apagava.
--
-- O QUE ESTA MIGRATION FAZ
-- Troca o indice UNIQUE por um indice COMUM com a MESMA chave e o MESMO predicado
-- parcial. A unicidade morre; o valor de busca fica: a leitura quente
-- (`fetchChannelCoaching`) filtra por (site_id, channel_id) + `video_id IS NULL` +
-- `source`, ordena por `generated_at DESC` e pega 1 linha por fonte — esse indice
-- continua sendo o caminho dela, agora com `generated_at` na cauda para que o
-- "mais recente de cada fonte" saia do indice em vez de um sort.
--
-- NAO TOCA em `idx_youtube_intelligence_dedup` (o de VIDEO,
-- WHERE video_id IS NOT NULL). O escopo e so canal: a analise por video continua
-- com uma linha por (site, canal, video, fonte) e o write path dela continua
-- fazendo update-in-place.
--
-- DADOS: nenhuma linha e criada, alterada ou removida. Remover unicidade nunca
-- falha por conflito (o conjunto atual ja e unico) e nao duplica nada. A linha
-- `cowork` de maio fica exatamente onde esta, com o `generated_at` dela — ela NAO
-- vira historico retroativo de nada; a partir daqui cada execucao nova INSERE uma
-- linha nova ao lado dela.
--
-- RETENCAO: deliberadamente SEM teto nesta migration. ~104 linhas/ano por canal por
-- fonte e ruido ao lado de `youtube_video_analytics`; as quatro tabelas de historico
-- irmas que ja existem tambem nao podam por idade (so `playlist_snapshots`, que
-- cresce por acao do usuario, tem `snapshot-cleanup`); e todas as leituras desta
-- tabela sao limitadas (1 linha por fonte no coaching, `.limit(50)` no snapshot da
-- forja). Podar e apagar dado de forma irreversivel — exatamente o que esta migration
-- existe para parar de fazer — e exigiria cron + valvula de seguranca. BACKLOG: se o
-- volume por canal passar de ~2 anos (ou o snapshot da forja comecar a encostar no
-- `.limit(50)`), avaliar um `snapshot-cleanup` analogo, com teto por (canal, fonte) e
-- nao por idade, para nunca deixar um canal sem nenhuma medicao.
-- =============================================================================

drop index if exists idx_youtube_intelligence_channel_dedup;

create index if not exists idx_youtube_intelligence_channel_history
  on youtube_intelligence (site_id, channel_id, source, generated_at desc)
  where video_id is null;
