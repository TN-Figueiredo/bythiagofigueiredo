export const SITE_TIMEZONE = 'America/Sao_Paulo' as const

export const STAGE_ORDER = {
  idea: 0, outline: 1, draft: 2, roteiro: 3,
  gravacao: 4, edicao: 5, pos_producao: 6, ready: 7, scheduled: 8, published: 9,
} as const satisfies Record<string, number>

export type Stage = keyof typeof STAGE_ORDER

export const STAGE_GROUP: Record<string, Stage[]> = {
  escrever: ['idea', 'outline', 'draft', 'roteiro'],
  gravar: ['gravacao'],
  'pos-prod': ['edicao', 'pos_producao', 'ready'],
  prontos: ['scheduled'],
}

export const URGENCY_ORDER: Record<string, number> = {
  overdue: 0, today: 1, tomorrow: 2, this_week: 3,
}

type EffortEntry = { effort: 'deep' | 'medium' | 'quick'; minutes: number }
export const EFFORT_DEFAULTS: Record<string, EffortEntry> = {
  'video:idea':           { effort: 'deep',   minutes: 180 },
  'video:outline':        { effort: 'deep',   minutes: 120 },
  'video:draft':          { effort: 'deep',   minutes: 120 },
  'video:roteiro':        { effort: 'deep',   minutes: 180 },
  'video:gravacao':       { effort: 'deep',   minutes: 240 },
  'video:edicao':         { effort: 'medium', minutes: 90  },
  'video:pos_producao':   { effort: 'quick',  minutes: 60  },
  'video:ready':          { effort: 'quick',  minutes: 30  },
  'video:scheduled':      { effort: 'quick',  minutes: 15  },
  'blog_post:idea':       { effort: 'deep',   minutes: 120 },
  'blog_post:outline':    { effort: 'deep',   minutes: 90  },
  'blog_post:draft':      { effort: 'deep',   minutes: 120 },
  'blog_post:ready':      { effort: 'quick',  minutes: 30  },
  'newsletter:draft':     { effort: 'deep',   minutes: 60  },
  'newsletter:ready':     { effort: 'quick',  minutes: 20  },
  'course:idea':          { effort: 'deep',   minutes: 240 },
  'course:outline':       { effort: 'deep',   minutes: 180 },
  'course:draft':         { effort: 'deep',   minutes: 180 },
  'campaign:idea':        { effort: 'medium', minutes: 90  },
  'campaign:draft':       { effort: 'medium', minutes: 60  },
} as const satisfies Record<string, EffortEntry>

export const LOCALE_TO_LANGUAGE: Record<string, string> = { pt: 'pt-br', en: 'en' } as const satisfies Record<string, string>

export const DAY_INDEX: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
} as const satisfies Record<string, number>

export const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const

/* ------------------------------------------------------------------ */
/*  WIP Limits                                                          */
/* ------------------------------------------------------------------ */

export const DEFAULT_WIP_LIMITS: Record<string, number> = {
  escrever: 6,
  gravar: 3,
  'pos-prod': 4,
  prontos: 5,
}

export type WipStatusLevel = 'ok' | 'warning' | 'exceeded'

export function getWipStatus(
  stageCounts: Record<string, number>,
  limits: Record<string, number> = DEFAULT_WIP_LIMITS,
): Record<string, WipStatusLevel> {
  const result: Record<string, WipStatusLevel> = {}
  for (const [group, limit] of Object.entries(limits)) {
    const count = stageCounts[group] ?? 0
    if (count > limit) result[group] = 'exceeded'
    else if (count === limit) result[group] = 'warning'
    else result[group] = 'ok'
  }
  return result
}
