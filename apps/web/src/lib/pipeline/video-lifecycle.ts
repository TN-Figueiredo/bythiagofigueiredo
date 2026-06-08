import { getStagePosition } from './workflows'

export type VideoColumn = 'idea' | 'roteiro' | 'gravacao' | 'published'

const COLUMN_OF: Record<string, VideoColumn> = {
  idea: 'idea',
  roteiro: 'roteiro',
  gravacao: 'gravacao',
  edicao: 'gravacao',
  pos_producao: 'gravacao',
  scheduled: 'published',
  published: 'published',
}

export function videoColumn(stage: string): VideoColumn {
  return COLUMN_OF[stage] ?? 'idea'
}

// Pós/Publicação unlock once the DB stage position >= position('gravacao') (>= 3).
export function isRecorded(stage: string): boolean {
  return getStagePosition('video', stage) >= getStagePosition('video', 'gravacao')
}

export const REACHED_BY = (stage: string): number =>
  ({ idea: 0, roteiro: 1, gravacao: 2, published: 3 }[videoColumn(stage)])

const OPEN_AT_MAP: Record<VideoColumn, 'ideia' | 'roteiro' | 'pos' | 'publicacao'> = {
  idea: 'ideia',
  roteiro: 'roteiro',
  gravacao: 'pos',
  published: 'publicacao',
}

export const OPEN_AT = (stage: string): 'ideia' | 'roteiro' | 'pos' | 'publicacao' =>
  OPEN_AT_MAP[videoColumn(stage)]
