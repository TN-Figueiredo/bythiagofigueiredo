// apps/web/src/lib/youtube/observatorio/medidas-telas/tracao-72h.ts
// E5a Tarefa 14 (a regra das 72 horas, M14): puro, sem banco, sem relógio (recebe `agoraMs`), nada de COMP.
// Os limiares moram num objeto só para a ordem 13 levá-los a `rules.ts`.

export const REGRAS_DAS_72_HORAS = {
  /** A janela que se mede depois da publicação. */
  HORAS: 72,
  /** Folga da consulta depois da hora 72, para fechar o intervalo da hora 72. */
  FOLGA_DA_CONSULTA_H: 1,
  /** Um bloco de vídeos da consulta cobre no máximo esta distância entre a menor e a maior publicação. */
  JANELA_DO_BLOCO_H: 72,
  /** Ids por bloco da consulta. */
  IDS_POR_BLOCO: 150,
  /** Blocos lidos ao mesmo tempo. */
  BLOCOS_AO_MESMO_TEMPO: 6,
  /** Vídeos considerados: publicados nos últimos N dias. */
  VIDEOS_DOS_ULTIMOS_DIAS: 90,
  /** Descoberto depois de N horas da publicação fica fora do normal. */
  DESCOBERTO_TARDE_H: 6,
  /** Mais que esta fração das horas sem contagem tira o vídeo do normal. */
  MAX_HORAS_SEM_CONTAGEM: 0.2,
  /** Menos vídeos que isto: não se mede o normal. */
  MIN_VIDEOS: 3,
  /** Duração máxima de um intervalo limpo (`horaria/regra.ts`, DURACAO_MAX_MS), em minutos. */
  FOLGA_DA_ULTIMA_LEITURA_MIN: 70,
} as const
