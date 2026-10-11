// O mundo das tarefas da página do canal (tarefas 2, 3 e 5): o oráculo, com o concorrente `matt-wolfe` como canal.
// Os casos de dado ausente são mutações de um vídeo real do oráculo, nunca um vídeo montado do zero.
import { datasetFromOracle, loadOracle, createTestObservatory } from './oracle'
import { plain } from './fase4-world'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { Observatory } from '@/lib/youtube/observatorio'

const CANAL = 'matt-wolfe'

/** O oráculo guarda a duração como "mm:ss"; o dataset de produção a guarda em segundos (ObsVideo.dur). */
function secondsOf(d: unknown): number | null {
  if (typeof d === 'number' || d == null) return d ?? null
  const p = String(d).split(':').map(Number)
  return p.reduce((a, x) => a * 60 + x, 0)
}

// Carregar o oráculo custa ~0,4 s (2 s no CI): lido uma vez por arquivo de teste; cada chamada trabalha numa cópia.
let base: Dataset | null = null
function baseDataset(): Dataset {
  if (base == null) {
    base = plain(datasetFromOracle(loadOracle()))
    for (const v of base.videos) v.dur = secondsOf(v.dur)
  }
  return base
}

/** `mut` roda numa cópia do dataset; o motor é criado depois dela. */
export function canalWorld(mut?: (ds: Dataset, chId: string) => void): { obs: Observatory; chId: string; ds: Dataset } {
  const ds = plain(baseDataset())
  mut?.(ds, CANAL)
  return { obs: createTestObservatory(ds), chId: CANAL, ds }
}
