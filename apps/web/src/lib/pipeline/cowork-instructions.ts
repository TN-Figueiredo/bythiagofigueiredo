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
export function buildCoworkInstruction(template: InstructionTemplate, params: Record<string, string>): string {
  const fn = TEMPLATES[template]
  if (!fn) {
    throw new Error(`Unknown template: ${template}`)
  }
  return fn(params)
}
