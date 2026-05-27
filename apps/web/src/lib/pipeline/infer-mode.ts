import { STAGE_GROUP, STAGE_ORDER } from './up-next-constants'
import type { PipelineItemWithSlot, ModeInference, WorkMode } from './up-next-types'

const MODE_THRESHOLD = 0.4

const MODE_LABELS: Record<WorkMode, string> = {
  escrever: 'Modo escrita',
  gravar: 'Modo gravação',
  'pos-prod': 'Modo pós-produção',
}

const WORK_MODE_GROUPS: WorkMode[] = ['escrever', 'gravar', 'pos-prod']

function maxStageOrder(group: string): number {
  const stages = STAGE_GROUP[group] ?? []
  return Math.max(...stages.map(s => STAGE_ORDER[s as keyof typeof STAGE_ORDER] ?? 0))
}

export function inferCurrentMode(items: PipelineItemWithSlot[]): ModeInference {
  const activeItems = items.filter(item => STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled'])

  const counts: Record<string, number> = {}
  for (const group of Object.keys(STAGE_GROUP)) counts[group] = 0

  for (const item of activeItems) {
    for (const [group, stages] of Object.entries(STAGE_GROUP)) {
      if (stages.includes(item.stage)) { counts[group] = (counts[group] ?? 0) + 1; break }
    }
  }

  if (activeItems.length === 0) return { mode: null, confidence: 0, label: 'Sem itens ativos', counts }

  const candidates = WORK_MODE_GROUPS
    .filter(g => (counts[g] ?? 0) / activeItems.length >= MODE_THRESHOLD)
    .sort((a, b) => {
      const ratioA = (counts[a] ?? 0) / activeItems.length
      const ratioB = (counts[b] ?? 0) / activeItems.length
      if (ratioB !== ratioA) return ratioB - ratioA
      return maxStageOrder(b) - maxStageOrder(a)
    })

  if (candidates.length === 0) return { mode: null, confidence: 0, label: 'Modo misto', counts }

  const winner = candidates[0]!
  const confidence = (counts[winner] ?? 0) / activeItems.length
  return { mode: winner, confidence, label: MODE_LABELS[winner], counts }
}
