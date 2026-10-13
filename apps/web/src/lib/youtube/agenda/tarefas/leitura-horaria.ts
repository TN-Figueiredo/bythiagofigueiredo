import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { executarLeituraHoraria } from '@/lib/youtube/horaria/executar'
import { BANCO_MS } from '../relogio'
import { relatarAgenda } from '../fecho'
import type { Tarefa } from '../tipos'

/**
 * `leitura_horaria`: a parte de código da tarefa (a definição, com o rótulo, os motivos e os tempos, mora em `DEFINICOES` de
 * `agenda/catalogo.ts`, que monta a `Tarefa` inteira; este arquivo não importa o catálogo para não criar ciclo).
 * A guarda da MG9 confere as três tabelas da leitura horária, em paralelo e com o prazo do banco.
 */
export const leituraHoraria: Pick<Tarefa, 'rodar'> = {
  rodar: c => executarLeituraHoraria({
    sb: c.sb, apiKey: c.apiKey, t0: c.t0, agora: c.agora, relatar: relatarAgenda,
    guarda: () => schemaTablesReady(c.sb, [['MG9', [
      ['competitor_video_hourly', 'video_id'],
      ['yt_own_public_video_hourly', 'youtube_video_id'],
      ['yt_own_public_video_early', 'youtube_video_id'],
    ]]], { signal: AbortSignal.timeout(BANCO_MS) }),
  }),
}
