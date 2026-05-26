export const STAGE_ORDER = {
  idea: 0, outline: 1, draft: 2, roteiro: 3,
  gravacao: 4, edicao: 5, pos_producao: 6, ready: 6, scheduled: 7, published: 8,
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

export const EFFORT_DEFAULTS: Record<string, { effort: 'deep' | 'quick'; minutes: number }> = {
  'video:idea':           { effort: 'deep',  minutes: 180 },
  'video:roteiro':        { effort: 'deep',  minutes: 180 },
  'video:gravacao':       { effort: 'deep',  minutes: 240 },
  'video:edicao':         { effort: 'quick', minutes: 60  },
  'video:pos_producao':   { effort: 'quick', minutes: 60  },
  'blog_post:idea':       { effort: 'deep',  minutes: 120 },
  'blog_post:draft':      { effort: 'deep',  minutes: 120 },
  'blog_post:ready':      { effort: 'quick', minutes: 30  },
  'newsletter:draft':     { effort: 'deep',  minutes: 60  },
  'newsletter:ready':     { effort: 'quick', minutes: 20  },
}

export const LOCALE_TO_LANGUAGE: Record<string, string> = { pt: 'pt-br', en: 'en' }

export const DAY_INDEX: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
}

export const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const
