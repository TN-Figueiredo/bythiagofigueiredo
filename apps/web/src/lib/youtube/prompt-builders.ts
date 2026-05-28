import { PROMPT_VERSIONS, assertNever } from './prompt-types'
import type {
  BuildYoutubePromptOptions,
  ContentCalendarData,
  ChannelHealthData,
  VideoOptimizerData,
  PromptChannelInfo,
  PromptVideoInfo,
} from './prompt-types'
import { sanitizeForMarkdown, sanitizeThumbnailUrl } from './prompt-sanitize'
import { getLifecycle } from './scoring'

const LANGUAGE_DIRECTIVE =
  'LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.\nJSON field names stay in English. All prose output in PT-BR.'

const PERSONA = `# Persona
Você é um consultor de YouTube especializado em canais pequenos/médios.
Três modos de operação:
1. **Análise**: quando o usuário perguntar sobre dados existentes, use APENAS os dados inline. Toda afirmação factual deve ser rastreável. Cite o dado entre parênteses.
2. **Criativo**: quando o usuário pedir sugestões, ideias, ou planejamento (thumbnails, títulos, tópicos, hooks), use os dados como inspiração e contexto — mas pode propor ideias originais. Marque claramente: "[Sugestão criativa]" vs "[Baseado nos dados]".
3. **Híbrido**: quando a pergunta é diagnóstica mas a resposta requer recomendação (ex: "como melhorar meu CTR?"), use Análise para o diagnóstico e sinalize a transição com "[Sugestão criativa]" antes da parte prescritiva.
Não tente fazer requisições HTTP.
Cruze dados entre os blocos JSON quando relevante.
Se um campo não estiver no JSON, trate como inexistente para análise — mas pode usar padrões gerais do canal para sugestões criativas.
O campo \`prompt_version\` no JSON é metadado de versão — ignore-o na resposta.`

const NANO_CALIBRATION = `## Calibração Nano (< 1.000 inscritos)
- Threshold de padrão: 3+ vídeos (não 5+)
- Confiança máxima em Análise: medium (nunca high) — não se aplica a sugestões criativas
- Métricas de crescimento: interpretar em termos absolutos, não percentuais
- Recomendações: focar em ação direta, não em otimização incremental`

const GUARDRAILS = `## Guardrails (modo Análise)
As regras abaixo aplicam-se ao modo Análise. No modo Criativo, apenas os bullets marcados com [TODOS] são obrigatórios.
- APENAS cite números que aparecem nos dados inline.
- Se não tem um dado, diga "dados insuficientes" — NÃO estime.
- Toda afirmação deve ser rastreável: "Retenção do vídeo X é 38% (inline data)".
- NÃO emita padrão com sample_size < 5 vídeos.
- Se sample_size < 5, confiança DEVE ser medium ou low (nunca high).
- NÃO infira causalidade de correlação. Diga "correlação observada" quando apropriado.
- NÃO cite benchmarks externos (ex: "média da indústria"). Use APENAS os benchmarks do JSON inline.
- [TODOS] NÃO referencie vídeos que NÃO estão nos dados.
- [TODOS] NÃO invente video_id, URLs, ou identificadores.
- Se snapshot_age_hours > 48, recomende re-execução do prompt com dados atualizados.
- Se 'truncated: true' no JSON, informe que dados adicionais existem mas foram omitidos por limite de contexto.`

const RESPONSE_FORMAT = `## Formato de Resposta
- Use subtítulos (##) para cada tema.
- Cada afirmação factual: dado inline entre parênteses (ex: "retenção: 38%, grade C").
- Encerre com "Próximos passos" (2-3 bullets acionáveis).
- Ajuste para a complexidade: briefings focados até 300 palavras, diagnósticos completos até 900 palavras.`

const CONFIDENCE_GUIDE = `## Guia de Confiança (modo Análise)

Aplica-se apenas a afirmações factuais baseadas em dados. Em modo Criativo, omita o guia de confiança.

Três faixas — use APENAS as categorias (strings), sem valores numéricos:

- "high" (5+ data points confirmados): Padrão claro e reproduzível. Se sample_size < 5: nunca use "high".
- "medium" (2-4 data points): Correlação observada mas amostra limitada.
- "low" (1 data point): Observação isolada, sem padrão confirmado. Se não há dados suficientes, omita a recomendação.

Prefira sub-estimar confiança.`

export function escapeXmlTags(text: string): string {
  return text.replace(/</g, '&lt;')
}

export function buildSharedBase(channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>): string {
  const persona =
    channel.tier === 'nano' ? `${PERSONA}\n${NANO_CALIBRATION}` : PERSONA

  return [LANGUAGE_DIRECTIVE, persona, GUARDRAILS, RESPONSE_FORMAT, CONFIDENCE_GUIDE].join('\n\n')
}

function omitNullish<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>
}

export function serializeContentCalendarContext(data: ContentCalendarData): string {
  const payload = {
    prompt_version: PROMPT_VERSIONS['content-calendar'],
    current_time: new Date().toISOString(),
    ...omitNullish(data),
  }
  return JSON.stringify(payload, null, 2)
}

export function serializeChannelHealthContext(data: ChannelHealthData): string {
  const payload = {
    prompt_version: PROMPT_VERSIONS['channel-health'],
    current_time: new Date().toISOString(),
    ...omitNullish(data),
  }
  return JSON.stringify(payload, null, 2)
}

export function serializeVideoOptimizerContext(data: VideoOptimizerData, video: PromptVideoInfo): string {
  const safeVideo = {
    ...video,
    title: sanitizeForMarkdown(video.title, 200),
    thumbnailUrl: video.thumbnailUrl ? sanitizeThumbnailUrl(video.thumbnailUrl, video.youtubeVideoId) : null,
  }
  const payload = {
    prompt_version: PROMPT_VERSIONS['video-optimizer'],
    current_time: new Date().toISOString(),
    video: omitNullish(safeVideo),
    ...omitNullish(data),
  }
  return JSON.stringify(payload, null, 2)
}

export function buildYoutubePrompt(options: BuildYoutubePromptOptions): string {
  const { instructions } = options
  if (instructions.trim() === '') return ''

  const capped = instructions.slice(0, 2000)
  const escaped = escapeXmlTags(capped)

  let channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>
  let contextJson: string

  switch (options.preset) {
    case 'content-calendar':
      channel = options.data.channel
      contextJson = serializeContentCalendarContext(options.data)
      break
    case 'channel-health':
      channel = options.data.channel
      contextJson = serializeChannelHealthContext(options.data)
      break
    case 'video-optimizer':
      channel = options.data.channel
      contextJson = serializeVideoOptimizerContext(options.data, options.video)
      break
    default:
      assertNever(options)
  }

  const sharedBase = buildSharedBase(channel)

  return [
    sharedBase,
    `<context>\n\`\`\`json\n${contextJson}\n\`\`\`\n</context>`,
    `<instructions>\n${escaped}\n</instructions>`,
  ].join('\n\n')
}

export function buildVideoInfo(video: { id: string; youtubeVideoId: string; title: string; thumbnailUrl: string | null; duration: string; publishedAt: string; viewCount: number }): PromptVideoInfo {
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / 86400000))
  return {
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    publishedAt: video.publishedAt,
    ageDays,
    lifecycleStage: getLifecycle(ageDays),
    viewCount: video.viewCount,
  }
}
