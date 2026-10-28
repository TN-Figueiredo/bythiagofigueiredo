// M10a (Tarefa 11, item 139): quem lê `competitor_videos` e o que faz com o vídeo congelado (o toco que continua com linha).
// Dados puros. O teste sem banco (leitores-competitor-videos.test.ts) varre o código e as migrations e falha por arquivo sem entrada,
// por contagem de ocorrências diferente e por ponto faltando; o teste com banco (video-antigo-leitores-vivos.test.ts) compara com o catálogo.
import { TABELAS_VIDEO_FORA_DA_CLASSE } from './tabelas-fora-da-classe'

export type Trata = 'exclui' | 'inclui_e_rotula' | 'indiferente'
/** Etapas que ainda não entregaram. Quem fecha a etapa TIRA o nome daqui, no mesmo commit que a fecha: o tsc acusa toda entrada que sobrou. */
export const ETAPAS_EM_ABERTO = ['M10b', 'M10c'] as const
export type EtapaEmAberto = (typeof ETAPAS_EM_ABERTO)[number]
export type Ponto = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export interface LeitorNoCodigo {
  /** caminho a partir da raiz do repositório */
  arquivo: string
  /** quantas vezes o texto `competitor_videos` aparece no arquivo hoje (comentário inclusive): mudou, o teste falha e alguém relê */
  ocorrencias: number
  trata: Trata
  motivo: string
  /** qual(is) dos oito pontos esta entrada fecha (Yannis Y5); o teste exige o conjunto {1..8}. Aceita lista: um arquivo (competitor-sync.ts) fecha os pontos 1 a 3 */
  ponto?: Ponto | readonly Ponto[]
  /** a M10a só fecha os oito pontos; um leitor fora deles que precisa mudar antes do primeiro congelamento leva a etapa que o fecha */
  pendenteAte?: EtapaEmAberto
}
export interface LeitorNaMigration { arquivo: string; funcoes: readonly string[]; trata: Trata; motivo: string; ponto?: Ponto; pendenteAte?: EtapaEmAberto }
export interface FuncaoViva { nome: string; trata: Trata; motivo: string; ponto?: Ponto; pendenteAte?: EtapaEmAberto }
/** Quem GRAVA nas 8 tabelas e por que nunca grava vídeo congelado (Phil M-4). */
export interface GravadorDasOito { arquivo: string; tabela: string; porQueNuncaCongelado: string; pendenteAte?: EtapaEmAberto }
export type Classe = 'video_antigo' | 'serie' | 'horaria' | 'texto' | 'fica'
export interface TabelaFilha { tabela: string; coluna: string; classe: Classe; motivo: string }

export const LEITORES_NO_CODIGO: readonly LeitorNoCodigo[] = [
  { arquivo: 'apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts', ocorrencias: 4, trata: 'inclui_e_rotula', motivo: 'ação de fixar (Tarefa 10): pinVideo manda p_pode_descongelar; unpinVideo não congela; a contagem de vídeos do canal e pinTarget leem a linha do toco', ponto: 7 },
  { arquivo: 'apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'confere por chave primária e site que o vídeo de referência existe; o toco continua com linha' },
  { arquivo: 'apps/web/src/app/cms/(authed)/youtube/ab-lab/new/page.tsx', ocorrencias: 1, trata: 'indiferente', motivo: 'lê o vídeo de referência por chave primária e site; o toco continua com linha' },
  { arquivo: 'apps/web/src/lib/conferencias.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'texto de uma consulta do dono' },
  { arquivo: 'apps/web/src/lib/pipeline/services/leitura-concorrentes.ts', ocorrencias: 1, trata: 'inclui_e_rotula', motivo: 'leitura de pipeline por video_id: o vídeo pedido por nome devolve a linha do toco; "não medido, motivo arquivado" é da M10b', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/pipeline/services/competitors.ts', ocorrencias: 3, trata: 'exclui', motivo: 'médias dos 50 mais recentes leem view_count, que congela no dia do congelamento; filtrar archive_frozen_at is null (ou usar archive_view_count) e ler o error; vídeo da troca embutido: sem troca online não aparece; o livro de trocas diz quantas ficaram no arquivo (item 147)', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/pipeline/services/competitors-campos.ts', ocorrencias: 5, trata: 'exclui', motivo: ':225 a ponta das últimas leituras: o toco de leitura mensal puxaria a menor para trás; filtro archive_frozen_at is null', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/pipeline/services/forja-queue.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário; grava em competitor_readings: o alvo congelado da fila de inteligência (recusar ao criar; 422 em readSent e completeReading) é o pedido 17', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-health.ts', ocorrencias: 3, trata: 'indiferente', motivo: 'só confere a existência de colunas e lê as provas (a chave arquivados é da Tarefa 8)' },
  { arquivo: 'apps/web/src/lib/youtube/short-backfill.ts', ocorrencias: 2, trata: 'indiferente', motivo: 'reclassifica formato (update de is_short); não grava nas 8 tabelas' },
  { arquivo: 'apps/web/src/lib/youtube/short-guard.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'reclassifica formato; não grava nas 8 tabelas' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-capture.ts', ocorrencias: 3, trata: 'indiferente', motivo: 'só comentário; as gravações dele estão em GRAVADORES_DAS_8' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-removal-impact.ts', ocorrencias: 2, trata: 'inclui_e_rotula', motivo: 'as duas parcelas novas do diálogo de remover canal (Tarefa 8, ponto 8); as frases são da M10b', ponto: 8 },
  { arquivo: 'apps/web/src/lib/youtube/competitor-sync.ts', ocorrencias: 11, trata: 'exclui', motivo: 'pontos 1 a 3 (Tarefa 7): classificação, passada semanal e página de uploads só veem os ativos', ponto: [1, 2, 3] },
  { arquivo: 'apps/web/src/lib/youtube/horaria/gravar.ts', ocorrencias: 2, trata: 'indiferente', motivo: 'janela de descoberta da leitura horária (dias, não anos); a condição c da retirada (horaria_ainda_online) cobre o resto' },
  { arquivo: 'apps/web/src/lib/youtube/horaria/lista.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/lib/youtube/teste-youtube/observados/inferir.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/lib/youtube/teste-youtube/observados/avisos.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'lê published_at por video_id para a janela de 30 dias; o toco guarda published_at' },
  { arquivo: 'apps/web/src/lib/youtube/teste-youtube/observados/passo.ts', ocorrencias: 2, trata: 'indiferente', motivo: 'junção de publicação por canal do site; o toco guarda published_at' },
  { arquivo: 'apps/web/src/lib/youtube/video-antigo/esta-congelado.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário; é o predicado' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/load.ts', ocorrencias: 7, trata: 'inclui_e_rotula', motivo: 'ponto 6 (Tarefa 9): VIDEO_COLS pede a marca e o conjunto de dados rotula o vídeo; readAll e loadLiveRows só embutem o canal da série diária (indiferente)', ponto: 6 },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/load-channel.ts', ocorrencias: 2, trata: 'inclui_e_rotula', motivo: 'ponto 6 (Tarefa 9): lê VIDEO_COLS, com a marca', ponto: 6 },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/types.ts', ocorrencias: 3, trata: 'indiferente', motivo: 'só comentário; ObsVideo.arquivo é a chave nova' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/cache-tag.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/index.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/saiu/ler-fila.ts', ocorrencias: 7, trata: 'indiferente', motivo: 'fila de ausentes e comentários: o código nunca marca congelado como ausente (markMissing não o recebe); um ausente que for congelado depois nunca mais é pedido e fica na fila sem desfecho: a elegibilidade exclui missing_since ou a leitura mensal fecha a ausência', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/saiu/rotulos.ts', ocorrencias: 2, trata: 'indiferente', motivo: 'rótulos das tabelas do diálogo de remoção' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/medidas/ler.ts', ocorrencias: 2, trata: 'inclui_e_rotula', motivo: 'leitura das medidas por canal: o toco entra com a última view lida; "não medido, motivo arquivado" para vídeo pedido por nome é da M10b', pendenteAte: 'M10b' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/arquivo/cli.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'SQL de reter_ate dos alvos da watch; não lê o toco' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/arquivo/sessao.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'E10: miniaturas por canal para o arquivo da A5' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/sinais/projecao.ts', ocorrencias: 1, trata: 'indiferente', motivo: 'só comentário' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/sinais/amostra.ts', ocorrencias: 4, trata: 'indiferente', motivo: 'título e miniatura por id e site; o toco continua com título' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/sinais/medida/passo.ts', ocorrencias: 3, trata: 'indiferente', motivo: 'lê só o id do YouTube do outlier (`video_id`) para a prova direta; o toco continua com o id' },
]

export const LEITORES_NAS_MIGRATIONS: readonly LeitorNaMigration[] = [
  { arquivo: '20260531000008_competitor_observatory.sql', funcoes: [], trata: 'indiferente', motivo: 'cria a tabela e os índices; sem função' },
  { arquivo: '20260531000009_fix_competitor_video_unique.sql', funcoes: [], trata: 'indiferente', motivo: 'chave única do vídeo; sem função' },
  { arquivo: '20260601000002_competitor_enrichment.sql', funcoes: [], trata: 'indiferente', motivo: 'colunas de enriquecimento; sem função' },
  { arquivo: '20260602000001_add_competitor_full_sync_columns.sql', funcoes: [], trata: 'indiferente', motivo: 'colunas da sincronização completa; sem função' },
  { arquivo: '20261003000002_observatorio_versoes.sql', funcoes: [], trata: 'indiferente', motivo: 'tabela de versões (chave para o vídeo); sem função' },
  { arquivo: '20261003000004_observatorio_forja.sql', funcoes: [], trata: 'indiferente', motivo: 'tabela da forja (chave para o vídeo); sem função' },
  { arquivo: '20261007000001_observatorio_fixar_video.sql', funcoes: ['competitor_channel_removal_impact'], trata: 'indiferente', motivo: 'versão antiga da contagem da remoção, redefinida pela M10a' },
  { arquivo: '20261007000002_observatorio_fixar_video_teto.sql', funcoes: ['pin_competitor_video'], trata: 'indiferente', motivo: 'versão antiga de pin_competitor_video, redefinida pela M10a' },
  { arquivo: '20261012000002_observatorio_a5_e1_campos_sinalizadores_raw.sql', funcoes: ['apply_competitor_field_plan', 'apply_competitor_raw_plan', 'competitor_capture_health', 'competitor_channel_mark_missing', 'competitor_channel_removal_impact', 'competitor_mark_missing', 'jsonb_num_merge', 'youtube_quota_add'], trata: 'exclui', motivo: 'capture_health acusaria o toco lido pela leitura mensal depois da retirada; planos de campo e raw são cobertos pela guarda', pendenteAte: 'M10b' },
  { arquivo: '20261012000003_observatorio_a5_e2_serie_faixas.sql', funcoes: ['apply_competitor_tier_plan', 'competitor_channel_removal_impact', 'competitor_series_health'], trata: 'indiferente', motivo: 'versões antigas de tier_plan, series_health e contagem da remoção, redefinidas pela M10a' },
  { arquivo: '20261012000004_observatorio_a5_e1_e2_provas_corretiva.sql', funcoes: ['competitor_capture_health', 'competitor_series_health'], trata: 'exclui', motivo: 'corretiva de capture_health (mesma pendência) e series_health (redefinida pela M10a)', pendenteAte: 'M10b' },
  { arquivo: '20261013000002_observatorio_a5_e15_leitura_horaria.sql', funcoes: ['competitor_capture_health', 'competitor_channel_removal_impact', 'competitor_hourly_health', 'youtube_channel_removal_impact'], trata: 'indiferente', motivo: 'janela de dias da leitura horária; versão de capture_health redefinida depois' },
  { arquivo: '20261013000003_observatorio_a5_e14_comentarios_destaque.sql', funcoes: ['apply_competitor_comment_snap', 'competitor_channel_comment_impact', 'competitor_comment_due', 'competitor_comment_health', 'competitor_comment_identity_purge'], trata: 'indiferente', motivo: 'comentários só nos primeiros 37 dias; a guarda cobre os retratos' },
  { arquivo: '20261014000002_observatorio_a5_e10_export_pausa_e_limite.sql', funcoes: ['competitor_archive_suggestions', 'competitor_channel_pause', 'competitor_channel_pause_covers', 'competitor_channel_remove_archived', 'competitor_channel_unpause', 'obs_archive_blobs_done', 'obs_archive_channel_counts', 'obs_archive_confirm_nas', 'obs_archive_diff', 'obs_archive_excluded', 'obs_archive_guard', 'obs_archive_is_site_admin', 'obs_archive_register', 'obs_archive_registry', 'obs_archive_uncovered', 'obs_archive_verify', 'obs_db_size_record'], trata: 'indiferente', motivo: 'exportação e pausa do arquivo da A5; a retirada de canal arquivado é da M10c', pendenteAte: 'M10c' },
  { arquivo: '20261014000004_observatorio_a5_e4_marcas_de_idade.sql', funcoes: ['competitor_marks_apply', 'competitor_marks_health', 'competitor_marks_pending'], trata: 'indiferente', motivo: 'as marcas ficam online; a reavaliação é update' },
  { arquivo: '20261015000001_observatorio_a5_e9_apagar_o_que_saiu.sql', funcoes: ['competitor_cascade_counts', 'competitor_channel_purge', 'competitor_comments_preview', 'competitor_comments_purge', 'competitor_jsonb_sum', 'competitor_missing_count', 'competitor_missing_keep', 'competitor_missing_proof', 'competitor_purge_preview', 'competitor_removed_blobs_done', 'competitor_removed_comment_groups', 'competitor_return_decide', 'competitor_video_purge'], trata: 'indiferente', motivo: 'apagar o que saiu (purga por vídeo e por canal); o desenho com o toco é da M10c', pendenteAte: 'M10c' },
  { arquivo: '20261017000001_observatorio_a5_x3_playlists_e_secoes.sql', funcoes: ['competitor_x3_guard', 'competitor_x3_items_record', 'competitor_x3_playlists_record', 'competitor_x3_sections_record', 'competitor_x3_visit_close', 'obs_archive_registry'], trata: 'indiferente', motivo: 'playlists e seções; só o registro do arquivo cita a tabela' },
  { arquivo: '20261018000002_observatorio_a5_f2_respostas_de_terceiros.sql', funcoes: ['apply_competitor_comment_snap', 'competitor_comment_health', 'competitor_comments_preview', 'competitor_comments_purge'], trata: 'indiferente', motivo: 'comentários; a guarda cobre os retratos' },
  { arquivo: '20261018000005_observatorio_a5_s4_leitura_watch.sql', funcoes: ['yt_watch_conciliar', 'yt_watch_gravar_disparo', 'yt_watch_poda', 'yt_watch_prova', 'yt_watch_titulos_ok'], trata: 'indiferente', motivo: 'janela de coleta de 30 dias da leitura watch' },
  { arquivo: '20261021000002_observatorio_a5_remover_canal_f1.sql', funcoes: ['competitor_channel_cancel_removal', 'competitor_channel_delete_unarchived', 'competitor_channel_pause_stops_watch', 'competitor_channel_removal_extra', 'competitor_channel_remove_archived', 'competitor_channel_request_removal', 'obs_archive_registry', 'obs_f1_video_compartilhado', 'obs_nome_normalizado', 'obs_unarchived_blobs_done', 'obs_unarchived_watch_sweep'], trata: 'indiferente', motivo: 'remover canal (F1); o desenho com o toco é da M10c', pendenteAte: 'M10c' },
  { arquivo: '20261021000006_ab_native_observados.sql', funcoes: ['obs_native_poda'], trata: 'indiferente', motivo: 'aprendizado do nicho do teste nativo; poda própria' },
  { arquivo: '20261021000007_ab_native_observados_registro.sql', funcoes: ['competitor_channel_delete_unarchived', 'competitor_channel_remove_archived', 'obs_archive_registry', 'obs_unarchived_watch_sweep'], trata: 'indiferente', motivo: 'registro do arquivo e remoção de canal; o desenho com o toco é da M10c', pendenteAte: 'M10c' },
  { arquivo: '20261024000002_manutencao_m2_particoes.sql', funcoes: ['competitor_channel_delete_unarchived', 'competitor_channel_remove_archived', 'obs_archive_uncovered', 'obs_db_size_record', 'obs_part', 'obs_partitions_ensure', 'obs_partitions_months_ahead'], trata: 'indiferente', motivo: 'partições da M2; a retirada de canal sem arquivo é da M10c', pendenteAte: 'M10c' },
  { arquivo: '20261024000003_observatorio_m10a_video_antigo_base.sql', funcoes: ['apply_competitor_tier_plan', 'competitor_channel_removal_impact', 'competitor_series_health', 'competitor_videos_archive_guard', 'obs_video_antigo_guarda_insert', 'pin_competitor_video'], trata: 'indiferente', motivo: 'é a marca: colunas, gatilho de imutabilidade, guarda de insert e as quatro funções dos pontos 4, 5, 7 e 8 (que estão em FUNCOES_VIVAS)' },
  { arquivo: '20261025000001_retratos_perda_nova.sql', funcoes: ['competitor_comment_health'], trata: 'indiferente', motivo: 'retratos perdidos novos; comentários só nos primeiros 37 dias' },
  { arquivo: '20261025000002_manutencao_m3b_arquivo.sql', funcoes: ['obs_archive_channel_archive_impact', 'obs_archive_channel_blobs', 'obs_archive_first_month', 'obs_archive_unit_source'], trata: 'indiferente', motivo: 'arquivo durável (M3b): lê o vídeo só para achar canal, mês e miniaturas do que vai ao arquivo; o toco (archive_dropped_at) é contado como destino, não filtrado' },
  { arquivo: '20261025000003_manutencao_m3b_recusa.sql', funcoes: [], trata: 'indiferente', motivo: 'a recusa (M3b): reedita competitor_video_purge/competitor_comments_purge só para chamar obs_archive_m9_pronto; o delete do vídeo é o da E9, sem leitura nova' },
  { arquivo: '20261027000003_manutencao_m5_telas.sql', funcoes: ['competitor_hourly_health', 'obs_archive_channel_archive_impact'], trata: 'indiferente', motivo: 'telas do arquivo (M5): a saúde da horária lê o vídeo só para achar canal e mês; o impacto do arquivo reedita o da M3b e conta o toco (archive_dropped_at) como destino, sem filtrar' },
]

export const FUNCOES_VIVAS: readonly FuncaoViva[] = [
  { nome: 'apply_competitor_comment_snap', trata: 'indiferente', motivo: 'grava o retrato de comentário; a guarda cobre o congelado' },
  { nome: 'apply_competitor_field_plan', trata: 'indiferente', motivo: 'grava campos; a guarda recusa o congelado' },
  { nome: 'apply_competitor_raw_plan', trata: 'indiferente', motivo: 'grava o raw; a guarda recusa o congelado' },
  { nome: 'apply_competitor_tier_plan', trata: 'exclui', motivo: 'ponto 4 (Tarefa 5): ignora o vídeo congelado e devolve ignorados_congelados', ponto: 4 },
  { nome: 'competitor_archive_suggestions', trata: 'indiferente', motivo: 'sugestões de arquivo por canal' },
  { nome: 'competitor_capture_health', trata: 'exclui', motivo: 'videos_vistos_sem_raw acusaria o toco lido pela leitura mensal depois da retirada', pendenteAte: 'M10b' },
  { nome: 'competitor_cascade_counts', trata: 'indiferente', motivo: 'contagem da purga em cascata', pendenteAte: 'M10c' },
  { nome: 'competitor_channel_cancel_removal', trata: 'indiferente', motivo: 'cancela a remoção do canal' },
  { nome: 'competitor_channel_delete_unarchived', trata: 'indiferente', motivo: 'remoção de canal sem arquivo', pendenteAte: 'M10c' },
  { nome: 'competitor_channel_pause_stops_watch', trata: 'indiferente', motivo: 'pausa para a watch' },
  { nome: 'competitor_channel_purge', trata: 'indiferente', motivo: 'purga do canal', pendenteAte: 'M10c' },
  { nome: 'competitor_channel_removal_extra', trata: 'indiferente', motivo: 'extras do diálogo de remoção' },
  { nome: 'competitor_channel_removal_impact', trata: 'inclui_e_rotula', motivo: 'ponto 8 (Tarefa 5): duas parcelas novas, videos_leitura_mensal e videos_no_arquivo', ponto: 8 },
  { nome: 'competitor_channel_remove_archived', trata: 'indiferente', motivo: 'remoção de canal arquivado', pendenteAte: 'M10c' },
  { nome: 'competitor_channel_request_removal', trata: 'indiferente', motivo: 'pede a remoção do canal' },
  { nome: 'competitor_comment_due', trata: 'indiferente', motivo: 'comentários só nos primeiros 37 dias' },
  { nome: 'competitor_comment_health', trata: 'indiferente', motivo: 'comentários só nos primeiros 37 dias' },
  { nome: 'competitor_hourly_health', trata: 'indiferente', motivo: 'janela de dias' },
  { nome: 'competitor_mark_missing', trata: 'indiferente', motivo: 'marca ausência (update de missing_since); o código nunca passa vídeo congelado' },
  { nome: 'competitor_marks_apply', trata: 'indiferente', motivo: 'as marcas ficam online' },
  { nome: 'competitor_marks_health', trata: 'indiferente', motivo: 'as marcas ficam online' },
  { nome: 'competitor_marks_pending', trata: 'indiferente', motivo: 'as marcas ficam online' },
  { nome: 'competitor_missing_count', trata: 'indiferente', motivo: 'prova de perda' },
  { nome: 'competitor_missing_keep', trata: 'indiferente', motivo: 'prova de perda' },
  { nome: 'competitor_missing_proof', trata: 'indiferente', motivo: 'prova de perda' },
  { nome: 'competitor_purge_preview', trata: 'indiferente', motivo: 'prévia da purga', pendenteAte: 'M10c' },
  { nome: 'competitor_series_health', trata: 'exclui', motivo: 'ponto 5 (Tarefa 5): arquivados fora da prova da série', ponto: 5 },
  { nome: 'competitor_video_purge', trata: 'indiferente', motivo: 'purga por vídeo', pendenteAte: 'M10c' },
  { nome: 'competitor_videos_archive_guard', trata: 'indiferente', motivo: 'é a marca: imutabilidade das colunas do toco' },
  { nome: 'obs_archive_channel_archive_impact', trata: 'indiferente', motivo: 'M3b: o que o arquivo guarda do canal e o que o toco já soltou (lê archive_dropped_at)' },
  { nome: 'obs_archive_channel_blobs', trata: 'indiferente', motivo: 'M3b: miniaturas do canal que o arquivo precisa listar' },
  { nome: 'obs_archive_first_month', trata: 'indiferente', motivo: 'M3b: primeiro mês com dado do canal, para as unidades devidas' },
  { nome: 'obs_archive_unit_source', trata: 'indiferente', motivo: 'M3b: monta a origem (junção com o vídeo) de cada unidade do arquivo' },
  { nome: 'obs_archive_register', trata: 'indiferente', motivo: 'registro do arquivo' },
  { nome: 'obs_archive_registry', trata: 'indiferente', motivo: 'registro do arquivo (lê competitor_hour_fold_log)' },
  { nome: 'obs_f1_video_compartilhado', trata: 'indiferente', motivo: 'vídeo compartilhado na remoção F1' },
  { nome: 'obs_native_poda', trata: 'indiferente', motivo: 'poda própria do teste nativo' },
  { nome: 'obs_unarchived_watch_sweep', trata: 'indiferente', motivo: 'varredura da watch sem arquivo' },
  { nome: 'obs_video_antigo_guarda_insert', trata: 'indiferente', motivo: 'é a marca: guarda de insert nas 8 tabelas' },
  { nome: 'pin_competitor_video', trata: 'inclui_e_rotula', motivo: 'ponto 7 (Tarefa 5): fixar descongela só com p_pode_descongelar e zera series_tier', ponto: 7 },
  { nome: 'yt_watch_conciliar', trata: 'indiferente', motivo: 'janela de 30 dias da watch' },
  { nome: 'yt_watch_prova', trata: 'indiferente', motivo: 'janela de 30 dias da watch' },
]

/** Motivo da tabela fora da classe, vindo da lista da Tarefa 4 (um só lugar). */
function motivoFora(tabela: string): string {
  const m = TABELAS_VIDEO_FORA_DA_CLASSE.find(t => t.tabela === tabela)
  if (!m) throw new Error(`tabela sem motivo em TABELAS_VIDEO_FORA_DA_CLASSE: ${tabela}`)
  return m.motivo
}

export const TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS: readonly TabelaFilha[] = [
  { tabela: 'competitor_video_versions', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_field_versions', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_raw', coluna: 'video_id', classe: 'video_antigo', motivo: 'a versão corrente; a não corrente é da classe texto, por isso a classe vai na chave do registro (M3b)' },
  { tabela: 'competitor_video_tier_spans', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_video_comment_snaps', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_hour_fold_log', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_changes', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_readings', coluna: 'video_id', classe: 'video_antigo', motivo: 'tabela da classe video_antigo: sai por idade do vídeo; a guarda de insert cobre' },
  { tabela: 'competitor_video_daily', coluna: 'video_id', classe: 'serie', motivo: motivoFora('competitor_video_daily') },
  { tabela: 'competitor_video_early', coluna: 'video_id', classe: 'serie', motivo: motivoFora('competitor_video_early') },
  { tabela: 'competitor_video_hourly', coluna: 'video_id', classe: 'horaria', motivo: motivoFora('competitor_video_hourly') },
  { tabela: 'competitor_video_comments', coluna: 'video_id', classe: 'texto', motivo: motivoFora('competitor_video_comments') },
  { tabela: 'youtube_intelligence_tasks', coluna: 'target_video_id', classe: 'fica', motivo: motivoFora('youtube_intelligence_tasks') },
  { tabela: 'competitor_video_marks', coluna: 'video_id', classe: 'fica', motivo: motivoFora('competitor_video_marks') },
  { tabela: 'competitor_video_mark_misses', coluna: 'video_id', classe: 'fica', motivo: motivoFora('competitor_video_mark_misses') },
  { tabela: 'competitor_missing_baseline', coluna: 'video_id', classe: 'fica', motivo: motivoFora('competitor_missing_baseline') },
]

export const GRAVADORES_DAS_8: readonly GravadorDasOito[] = [
  { arquivo: 'apps/web/src/lib/youtube/competitor-capture.ts', tabela: 'competitor_field_versions', porQueNuncaCongelado: 'a captura só grava o vídeo que a sincronização acabou de ler na página de ativos; o congelado nunca é pedido (Tarefa 7)' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-capture.ts', tabela: 'competitor_raw', porQueNuncaCongelado: 'a captura só grava o vídeo que a sincronização acabou de ler na página de ativos; o congelado nunca é pedido (Tarefa 7)' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-sync.ts', tabela: 'competitor_video_versions', porQueNuncaCongelado: 'a sincronização pula o congelado em todas as passadas (pontos 1 a 3); a guarda do banco recusa o resto' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-sync.ts', tabela: 'competitor_changes', porQueNuncaCongelado: 'a sincronização pula o congelado em todas as passadas (pontos 1 a 3); a guarda do banco recusa o resto' },
  { arquivo: 'apps/web/src/lib/youtube/competitor-sync.ts', tabela: 'competitor_video_tier_spans', porQueNuncaCongelado: 'apply_competitor_tier_plan ignora o congelado (ponto 4)' },
  { arquivo: 'apps/web/src/lib/youtube/observatorio/comentarios/gravar.ts', tabela: 'competitor_video_comment_snaps', porQueNuncaCongelado: 'janela de 37 dias: nunca vê vídeo de 24 meses por construção; a guarda cobre o resto' },
  { arquivo: 'apps/web/src/lib/pipeline/services/forja-queue.ts', tabela: 'competitor_readings', porQueNuncaCongelado: 'o alvo congelado da fila de inteligência deve ser recusado ao criar e com 422 em readSent e completeReading (pedido 17); hoje só a guarda do banco', pendenteAte: 'M10b' },
]
