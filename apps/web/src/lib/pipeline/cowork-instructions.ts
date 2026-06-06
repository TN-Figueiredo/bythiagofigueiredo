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
    `Editar seção '${p.section}' do item ${p.code}. ${MCP_SUFFIX}`,
  'pipeline-translate': (p) =>
    `Traduzir item ${p.code} para ${p.locale}. ${MCP_SUFFIX}`,
  'pipeline-empty-section': (p) =>
    `Gerar conteúdo da seção '${p.section}' do item ${p.code}. ${MCP_SUFFIX}`,
  'youtube-ab-refine': (p) =>
    `Refinar variantes do teste A/B ${p.testId}. ${MCP_SUFFIX}`,
  'youtube-intelligence': () =>
    `Analisar performance do canal YouTube. ${MCP_SUFFIX}`,
  'youtube-video-optimize': (p) =>
    `Otimizar vídeo '${p.title}' no YouTube. ${MCP_SUFFIX}`,
  'playlist-organize': (p) =>
    `Organizar playlist '${p.name}'. ${MCP_SUFFIX}`,
  'reference-overview': () =>
    `Liste meus items no pipeline. Mostre status atual e sugira próximos passos. ${MCP_SUFFIX}`,
  'audio-resolve': (p) =>
    `Resolver áudio e SFX para item ${p.code}. ${MCP_SUFFIX}`,
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
