// O mundo das tarefas da fase A3 (lista de Canais e comparação): o oráculo com os canais próprios do preset.
// O conjunto base é lido UMA vez por arquivo de teste e por preset (o CI tem limite de 60 s por executor do Vitest);
// cada chamada trabalha numa cópia, e a mutação roda nela antes de o motor ser criado.
import { datasetFromOracle, loadOracleOwns, createTestObservatory } from './oracle'
import { plain } from './fase4-world'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { Observatory } from '@/lib/youtube/observatorio'

const bases = new Map<OwnPreset, Dataset>()
function baseDataset(preset: OwnPreset): Dataset {
  let b = bases.get(preset)
  if (!b) { b = plain(datasetFromOracle(loadOracleOwns(preset))); bases.set(preset, b) }
  return b
}

export function a3World(mut?: (ds: Dataset) => void, preset: OwnPreset = '2'): { obs: Observatory; ds: Dataset; owns: string[] } {
  const ds = plain(baseDataset(preset))
  mut?.(ds)
  return { obs: createTestObservatory(ds), ds, owns: ds.channels.filter(c => c.own).map(c => c.id) }
}
