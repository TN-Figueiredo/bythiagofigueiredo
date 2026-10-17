// A5, X3: tetos e tempos da coleta de playlists e seções. Puro, sem importar código de coleta nem de agenda (os números da
// definição na agenda são escritos por extenso e um teste confere a igualdade).
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'

/** `fimAteMs` da tarefa `playlists_semanais` (o mesmo número está em `agenda/definicoes.ts`; um teste confere). */
export const FIM_ATE_MS = 85_000
export const CHAMADA_MS = 8_000

export const X3_RULES = {
  /** Unidades da Data API por canal por visita (canal com até ~37 playlists pequenas fecha numa visita). */
  unidadesPorVisita: 40,
  /** 10 páginas de 50 = 500 itens por playlist; acima disso a saída de item nunca é inferida. */
  paginasDeItensPorPlaylist: 10,
  /** 6% da cota de 10.000; só dispara em defeito. */
  unidadesPorDia: 600,
  diasEntreVoltas: 7,
  chamadaMs: CHAMADA_MS,
  /** Nenhum canal novo começa depois disto (e a tarefa só é tomada até aqui: `comecaAteMs` da definição). */
  canalComecaAteMs: 50_000,
  /**
   * Nenhuma chamada à API começa depois disto: `fimAteMs − chamadaMs − 4 × BANCO_MS − 2 s` = 85 − 8 − 20 − 2 = 55 s
   * (a última chamada termina em 63 s e ainda cabem `itensPresentes`, `items_record`, `visit_close` e `recordQuota` de 5 s cada; Phil M-8 = Yannis M-1).
   */
  chamadaComecaAteMs: FIM_ATE_MS - CHAMADA_MS - 4 * BANCO_MS - 2_000,
} as const
