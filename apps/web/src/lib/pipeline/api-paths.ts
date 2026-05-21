// ---------------------------------------------------------------------------
// Centralized path builders for the Pipeline API.
//
// Every prompt-generation file should import paths from here instead of
// assembling inline string templates.  The functions intentionally return
// *relative* paths (no host prefix) — callers that need an absolute URL
// prepend `baseUrl` themselves.
// ---------------------------------------------------------------------------

export const pipelinePaths = {
  /** Root catalog — `GET /api/pipeline/` */
  catalog: () => '/api/pipeline/' as const,

  items: {
    /** Single item — `GET|PATCH /api/pipeline/items/:id` */
    detail: (id: string) => `/api/pipeline/items/${id}`,

    /** Section with lang — `GET|PATCH /api/pipeline/items/:id/sections/:section?lang=:lang` */
    section: (id: string, section: string, lang: string) =>
      `/api/pipeline/items/${id}/sections/${section}?lang=${lang}`,
  },

  docs: {
    /** Domain documentation — `GET /api/pipeline/docs/:domain` */
    domain: (domain: string) => `/api/pipeline/docs/${domain}`,
  },

  context: {
    /** All references (all skills) — `GET /api/pipeline/context?format=md` */
    all: () => '/api/pipeline/context?format=md' as const,

    /** References for a single skill — `GET /api/pipeline/context?skill=:skill&format=md` */
    withSkill: (skill: string) =>
      `/api/pipeline/context?skill=${skill}&format=md`,
  },
} as const
