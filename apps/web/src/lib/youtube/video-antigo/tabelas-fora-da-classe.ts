// M10a (Tarefa 4, emenda 23/10; Phil, onda0-phil-tabelas-capacidade.md §1.2 e §1.3): as tabelas por vídeo que NÃO são da classe
// `video_antigo` (a guarda de insert cobre só as 8 da classe). Lista FECHADA de 14. Dados puros, sem import: o código de produção
// (Tarefa 11) e a M3b a importam daqui; `src` nunca importa de `test/`. A varredura da Tarefa 11 exclui este arquivo.
// O teste de forma (video-antigo-guarda-insert.test.ts) falha, com o nome da tabela, se aparecer tabela com chave para o vídeo
// de concorrente que não esteja nas 8 nem aqui: sem ele a próxima tabela da A5 ficaria fora da classe em silêncio.
export interface TabelaVideoFora {
  tabela: string
  motivo: string
  /** a tabela continua online depois do congelamento (marcas, prova de perda, janela de 30 dias) */
  fica_online?: boolean
}

export const TABELAS_VIDEO_FORA_DA_CLASSE: readonly TabelaVideoFora[] = [
  // FK para o vídeo e FICA ONLINE (spec 02 l.186): a reavaliação é `update`, não `insert`
  { tabela: 'competitor_video_marks', motivo: 'marcas de 1, 7 e 30 dias ficam online; a reavaliação é update, não insert', fica_online: true },
  { tabela: 'competitor_video_mark_misses', motivo: 'faltas das marcas ficam online; a reavaliação é update, não insert', fica_online: true },
  { tabela: 'competitor_missing_baseline', motivo: 'a prova de perda fica online; a reavaliação é update, não insert', fica_online: true },
  // sem FK, chave youtube_video_id (texto), FICA ONLINE: janela de coleta de 30 dias após a publicação, nunca alvo de vídeo congelado
  { tabela: 'yt_watch_alvos', motivo: 'janela de coleta de 30 dias após a publicação; não há alvo de vídeo congelado', fica_online: true },
  { tabela: 'yt_watch_thumbs', motivo: 'janela de coleta de 30 dias após a publicação; não há alvo de vídeo congelado', fica_online: true },
  { tabela: 'yt_watch_readings', motivo: 'poda própria da A5, 30 dias após saiu_em; não há alvo de vídeo congelado', fica_online: true },
  { tabela: 'ab_native_observados', motivo: 'aprendizado do nicho do teste nativo; nunca sai por idade do vídeo', fica_online: true },
  { tabela: 'ab_native_obs_cursor', motivo: 'cursor do aprendizado do nicho; nunca sai por idade do vídeo', fica_online: true },
  { tabela: 'competitor_playlist_items', motivo: 'mutável; sem saída por enquanto (gatilho 15/11)', fica_online: true },
  // FK, mas OUTRA classe de saída (por mês, não por idade do vídeo)
  { tabela: 'competitor_video_daily', motivo: 'classe serie: sai pela política mensal da M3b, não pela idade do vídeo' },
  { tabela: 'competitor_video_early', motivo: 'classe serie: sai pela política mensal da M3b, não pela idade do vídeo' },
  { tabela: 'competitor_video_hourly', motivo: 'classe horaria: sai pela política mensal da M3b, não pela idade do vídeo' },
  { tabela: 'competitor_video_comments', motivo: 'classe texto: sai pela política mensal da M3b, não pela idade do vídeo' },
  { tabela: 'youtube_intelligence_tasks', motivo: 'classe fica: a tarefa aponta para o vídeo, que não é apagado' },
]
