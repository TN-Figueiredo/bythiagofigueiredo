export type InstructionTemplate =
  | 'pipeline-section'
  | 'pipeline-translate'
  | 'pipeline-empty-section'
  | 'youtube-ab-refine'
  | 'youtube-intelligence'
  | 'youtube-video-optimize'
  | 'playlist-organize'
  | 'reference-overview'
  | 'audio-resolve'
  | 'research-triage'
  | 'foco-review'
  | 'decisao-log'

const MCP_SUFFIX = 'Use o MCP bythiagofigueiredo.'

const TEMPLATES: Record<InstructionTemplate, (p: Record<string, string>) => string> = {
  'pipeline-section': (p) =>
    `Edite a seção '${p.section}' do item ${p.code} via manage_sections: action:get pra ler o conteúdo atual, action:update pra salvar (cria revisão). ${MCP_SUFFIX}`,
  'pipeline-translate': (p) =>
    `Traduza o item ${p.code} para ${p.locale}: leia a seção de origem com manage_sections action:get e escreva a variante no idioma alvo com action:update (lang correto). ${MCP_SUFFIX}`,
  'pipeline-empty-section': (p) =>
    `Gere o conteúdo da seção '${p.section}' do item ${p.code} e salve com manage_sections action:update (lendo o roteiro/ideia com action:get pra derivar). ${MCP_SUFFIX}`,
  'youtube-ab-refine': (p) =>
    `Refine as variantes do teste A/B ${p.testId} via manage_ab_test (list_variants pra ver, depois ajuste títulos/thumbs). ${MCP_SUFFIX}`,
  'youtube-intelligence': () =>
    `Analise a performance do canal via youtube_observatory e youtube_analytics (overview, outliers, learnings) e sugira próximos passos. ${MCP_SUFFIX}`,
  'youtube-video-optimize': (p) =>
    `Otimize o vídeo '${p.title}' (título, descrição, tags) via youtube_videos. ${MCP_SUFFIX}`,
  'playlist-organize': (p) =>
    `Organize a playlist '${p.name}' via manage_playlist (action: reorder / auto_layout / add_item / remove_item). ${MCP_SUFFIX}`,
  'reference-overview': () =>
    `Liste meus items no pipeline com search_content, mostre o status atual e sugira próximos passos. ${MCP_SUFFIX}`,
  'audio-resolve': (p) =>
    `Resolva áudio e SFX do item ${p.code} via manage_audio (list/resolve) e match_audio. ${MCP_SUFFIX}`,
  'research-triage': () =>
    `Ative a skill Research Strategist e rode TRIAGE: liste as pesquisas (manage_research action:list), revise as frescas e em análise, extraia takeaways e atribua tema, sinalize pesquisas maduras e proponha decisões candidatas. Sugira arquivamentos, não execute em massa sem meu OK. ${MCP_SUFFIX}`,
  'foco-review': () =>
    `Ative a skill Research Strategist e rode REVIEW/REVISIT: pegue o foco ativo (manage_focos action:get_active), audite as decisões com revisit vencido (manage_decisions action:list) ordenando por horizonte, e se algum tema estiver maduro proponha um foco novo (state proposto — você nunca ativa, só eu). ${MCP_SUFFIX}`,
  'decisao-log': () =>
    `Ative a skill Research Strategist e rode DISTILL: transforme os takeaways das pesquisas em um rascunho de decisão preenchendo context, consequences, metric (obrigatório) e revisit, ligando as fontes (source_research_ids). Apresente o rascunho antes de criar — registre a minha decisão, não decida sozinho. ${MCP_SUFFIX}`,
}

export function buildCoworkInstruction(template: 'pipeline-section', params: { section: string; code: string }): string
export function buildCoworkInstruction(template: 'pipeline-translate', params: { code: string; locale: string }): string
export function buildCoworkInstruction(template: 'pipeline-empty-section', params: { section: string; code: string }): string
export function buildCoworkInstruction(template: 'youtube-ab-refine', params: { testId: string }): string
export function buildCoworkInstruction(template: 'youtube-intelligence', params: Record<string, never>): string
export function buildCoworkInstruction(template: 'youtube-video-optimize', params: { title: string }): string
export function buildCoworkInstruction(template: 'playlist-organize', params: { name: string }): string
export function buildCoworkInstruction(template: 'reference-overview', params: Record<string, never>): string
export function buildCoworkInstruction(template: 'audio-resolve', params: { code: string }): string
export function buildCoworkInstruction(template: 'research-triage', params: Record<string, never>): string
export function buildCoworkInstruction(template: 'foco-review', params: Record<string, never>): string
export function buildCoworkInstruction(template: 'decisao-log', params: Record<string, never>): string
export function buildCoworkInstruction(template: InstructionTemplate, params: Record<string, string>): string {
  const fn = TEMPLATES[template]
  if (!fn) {
    throw new Error(`Unknown template: ${template}`)
  }
  return fn(params)
}
