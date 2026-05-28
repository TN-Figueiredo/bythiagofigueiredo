import { AB_BRIEFING_PROMPT_VERSION } from './prompt-types'
import type { AbBriefingData } from './prompt-types'
import type { TestType, VariantMetadata } from './ab-types'
import type { PromptChannelInfo } from './prompt-types'
import { buildSharedBase, escapeXmlTags } from './prompt-builders'
import { sanitizeForMarkdown } from './prompt-sanitize'

type Locale = 'pt' | 'en'

const TYPE_FIELD_DOCS: Record<Locale, Record<TestType, string>> = {
  pt: {
    title: '         "title_text": "<título, obrigatório, máx 200 chars>"',
    description: '         "description_text": "<descrição, obrigatório, máx 5000 chars>"',
    thumbnail: `         "metadata": {
           "creative_direction": "<direção criativa>",
           "ai_image_prompt": "<prompt para geração de imagem AI>",
           "visual_description": "<descrição visual detalhada>",
           "thumbnail_tags": ["<tag1>", "<tag2>"],
           "rationale": "<justificativa da variante>"
         }`,
    combo: `         "title_text": "<título, obrigatório, máx 200 chars>",
         "description_text": "<descrição, opcional>",
         "metadata": {
           "creative_direction": "<direção criativa, opcional>",
           "ai_image_prompt": "<prompt AI, opcional>",
           "visual_description": "<descrição visual detalhada, opcional>",
           "thumbnail_tags": ["<tag1>", "<tag2>"],
           "rationale": "<justificativa do combo>"
         }`,
  },
  en: {
    title: '         "title_text": "<title, required, max 200 chars>"',
    description: '         "description_text": "<description, required, max 5000 chars>"',
    thumbnail: `         "metadata": {
           "creative_direction": "<creative direction>",
           "ai_image_prompt": "<prompt for AI image generation>",
           "visual_description": "<detailed visual description>",
           "thumbnail_tags": ["<tag1>", "<tag2>"],
           "rationale": "<rationale for the variant>"
         }`,
    combo: `         "title_text": "<title, required, max 200 chars>",
         "description_text": "<description, optional>",
         "metadata": {
           "creative_direction": "<creative direction, optional>",
           "ai_image_prompt": "<AI image prompt, optional>",
           "visual_description": "<detailed visual description, optional>",
           "thumbnail_tags": ["<tag1>", "<tag2>"],
           "rationale": "<rationale for the combo>"
         }`,
  },
}

const TEST_TYPE_INSTRUCTIONS: Record<Locale, Record<TestType, string>> = {
  pt: {
    thumbnail: `Analise a thumbnail atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Composição visual e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)
- Expressão facial / elemento humano
Sugira exatamente 3 variações (B, C, D).`,
    title: `Analise o título atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Hook emocional ou curiosidade
- Power words e senso de urgência
- Uso de números, brackets, ou padrões comprovados
- Comprimento ideal: 50-60 caracteres
Sugira exatamente 3 variações (B, C, D).`,
    description: `Analise a descrição atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Posição e texto do CTA principal
- Conteúdo acima do fold (3 primeiras linhas visíveis)
- Uso de links rastreados com sintaxe {{link:nome}}
- Hashtags estratégicas
Sugira exatamente 3 variações (B, C, D).`,
    combo: `Analise o combo atual (thumbnail + título) e sugira 3 combos coerentes para teste A/B.
Para cada combo (B, C, D), descreva:
**Thumbnail:** Composição e enquadramento, paleta de cores, texto overlay
**Título:** Hook emocional, power words, urgência, por que esse combo funciona junto
Sugira exatamente 3 variações (B, C, D).`,
  },
  en: {
    thumbnail: `Analyze the current thumbnail and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Visual composition and framing
- Color palette and contrast
- Text overlay (if applicable)
- Facial expression / human element
Suggest exactly 3 variations (B, C, D).`,
    title: `Analyze the current title and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Emotional hook or curiosity gap
- Power words and sense of urgency
- Use of numbers, brackets, or proven patterns
- Ideal length: 50-60 characters
Suggest exactly 3 variations (B, C, D).`,
    description: `Analyze the current description and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Position and text of the main CTA
- Content above the fold (first 3 visible lines)
- Use of tracked links with {{link:name}} syntax
- Strategic hashtags
Suggest exactly 3 variations (B, C, D).`,
    combo: `Analyze the current combo (thumbnail + title) and suggest 3 coherent combos for A/B testing.
For each combo (B, C, D), describe:
**Thumbnail:** Composition, palette, text overlay
**Title:** Emotional hook, power words, urgency, why this combo works together
Suggest exactly 3 variations (B, C, D).`,
  },
}

const WORKFLOW_STEPS: Record<Locale, (testId: string, baseUrl: string, fieldDocs: string) => string> = {
  pt: (testId, baseUrl, fieldDocs) => `Workflow para salvar variantes:
0. GET ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants
   → Verifique variantes existentes. Pule labels que já existem ou confirme substituição.

1. Discuta as ideias com o usuário até atingir consenso em 1-3 variantes (B, C, D)

2. POST ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body:
   {
     "variants": [
       {
         "label": "B",
${fieldDocs}
       }
     ]
   }

   On 400: erro de validação — verificar label (apenas B/C/D), campos obrigatórios por tipo
   On 409: teste não está em status "draft" — variantes só podem ser adicionadas a rascunhos
   On 404: teste não encontrado ou acesso negado
   On 500: erro interno — tente novamente

3. Confirme quais variantes foram criadas e seus IDs

Outras operações:
- DELETE ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants?label=<B|C|D>
  Remove uma variante. Apenas rascunhos. Não é possível deletar a original (A).
  On 404: variante não encontrada
  On 409: teste não está em status "draft"`,
  en: (testId, baseUrl, fieldDocs) => `Workflow to save variants:
0. GET ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants
   → Check existing variants. Skip labels that already exist or confirm replacement.

1. Discuss ideas with the user until consensus on 1-3 variants (B, C, D)

2. POST ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body:
   {
     "variants": [
       {
         "label": "B",
${fieldDocs}
       }
     ]
   }

   On 400: validation error — check label (B/C/D only), required fields per type
   On 409: test is not in "draft" status — variants can only be added to drafts
   On 404: test not found or access denied
   On 500: internal error — retry

3. Confirm which variants were created and their IDs

Other operations:
- DELETE ${baseUrl}/api/pipeline/youtube/ab-tests/${testId}/variants?label=<B|C|D>
  Remove a variant. Draft-only. Cannot delete the original (A).
  On 404: variant not found
  On 409: test is not in "draft" status`,
}

const REVIEW_INSTRUCTIONS: Record<Locale, string> = {
  pt: `Avalie cada variante contra a original. Para cada uma, analise:
- Contraste visual e diferenciação
- Força do hook / curiosidade
- Probabilidade de click (estimativa qualitativa)
Dê uma nota de 1-5 para cada variante e recomende a melhor para testar primeiro.`,
  en: `Evaluate each variant against the original. For each one, analyze:
- Visual contrast and differentiation
- Hook strength / curiosity
- Click probability (qualitative estimate)
Rate each variant 1-5 and recommend the best one to test first.`,
}

function buildHistorySection(testHistory: AbBriefingData['testHistory']): string {
  if (testHistory.length === 0) return ''

  const completedTests = testHistory.filter(t => t.winner_label !== null)
  const avgLift =
    completedTests.length > 0
      ? completedTests.reduce((sum, t) => sum + (t.ctr_lift_percent ?? 0), 0) / completedTests.length
      : 0

  const winnerPatterns = completedTests
    .map(t => t.winner_label)
    .filter((v): v is string => v !== null)

  return JSON.stringify(
    {
      historico_ab: {
        testes_anteriores: testHistory.length,
        lift_medio: avgLift > 0 ? `+${avgLift.toFixed(1)}%` : 'N/A',
        padroes_vencedores: winnerPatterns,
      },
    },
    null,
    2,
  )
}

export function buildAbBriefingPrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
}): string {
  const { testType, data, focus } = options
  const locale: Locale = data.locale ?? 'pt'
  const sharedBase = buildSharedBase(data.channel, locale)

  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const contextPayload: Record<string, unknown> = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    current_time: new Date().toISOString(),
    channel: {
      name: data.channel.name,
      subscribers: data.channel.subscribers,
      tier: data.channel.tier,
    },
    video: {
      title: sanitizeForMarkdown(data.video.title, 200),
      thumbnailUrl: data.video.thumbnailUrl,
      ...(data.video.youtubeVideoId ? { youtubeUrl: `https://youtube.com/watch?v=${data.video.youtubeVideoId}` } : {}),
      ...(videoHasData
        ? {
            ctr: data.video.ctr,
            avgViewPercentage: data.video.avgViewPercentage,
            score: data.video.score,
            grade: data.video.grade,
          }
        : { nota: locale === 'pt' ? 'sem dados de performance disponíveis' : 'no performance data available' }),
    },
  }

  if (data.testId) {
    contextPayload.test_id = data.testId
  }

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = (JSON.parse(historySection) as { historico_ab: unknown }).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[locale][testType]
  if (focus) {
    const focusLabel = locale === 'pt' ? 'Instruções adicionais do usuário:' : 'Additional user instructions:'
    instructions += `\n\n${focusLabel}\n${escapeXmlTags(focus)}`
  }

  const noDataNote = locale === 'pt'
    ? 'Nota: sem dados de performance disponíveis para este vídeo. Use contexto do canal.'
    : 'Note: no performance data available for this video. Use channel context.'

  if (!videoHasData) {
    instructions += `\n\n${noDataNote}`
  }

  return `${sharedBase}

<context>
${contextJson}
</context>

<instructions>
${instructions}
</instructions>`
}

export function buildAbWritePrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
  baseUrl?: string
}): string {
  const { testType, data, focus, baseUrl = '' } = options

  if (!data.testId) {
    throw new Error('buildAbWritePrompt requires a testId')
  }

  const locale: Locale = data.locale ?? 'pt'
  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const testTypeLabel = locale === 'pt'
    ? { thumbnail: 'Thumbnail', title: 'Título', description: 'Descrição', combo: 'Combo (Thumb+Título)' }[testType]
    : { thumbnail: 'Thumbnail', title: 'Title', description: 'Description', combo: 'Combo (Thumb+Title)' }[testType]

  const lines: string[] = []

  // Context header
  lines.push(`A/B Test Brainstorm: ${testTypeLabel} — "${sanitizeForMarkdown(data.video.title, 200)}"`)
  lines.push(`Channel: ${data.channel.name} (${data.channel.subscribers} subs, ${data.channel.tier})`)
  if (data.video.youtubeVideoId) {
    lines.push(`Video: https://youtube.com/watch?v=${data.video.youtubeVideoId}`)
  }
  if (data.video.thumbnailUrl) {
    lines.push(`Thumbnail atual: ${data.video.thumbnailUrl}`)
  }
  lines.push(locale === 'pt' ? 'Idioma: Português (PT-BR)' : 'Language: English')
  lines.push('')

  // Video metrics
  if (videoHasData) {
    const metricParts: string[] = []
    if (data.video.ctr !== null) metricParts.push(`CTR: ${data.video.ctr}%`)
    if (data.video.grade !== null) metricParts.push(`Grade: ${data.video.grade}`)
    if (data.video.score !== null) metricParts.push(`Score: ${data.video.score}`)
    if (metricParts.length > 0) lines.push(metricParts.join(' | '))
  } else {
    lines.push(locale === 'pt' ? 'Sem dados de performance disponíveis para este vídeo.' : 'No performance data available for this video.')
  }
  lines.push('')

  // Test history
  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    const parsed = JSON.parse(historySection) as { historico_ab: { testes_anteriores: number; lift_medio: string; padroes_vencedores: string[] } }
    const h = parsed.historico_ab
    lines.push(locale === 'pt'
      ? `Histórico: ${h.testes_anteriores} testes anteriores | lift médio: ${h.lift_medio} | vencedores: ${h.padroes_vencedores.join(', ') || 'N/A'}`
      : `History: ${h.testes_anteriores} previous tests | avg lift: ${h.lift_medio} | winners: ${h.padroes_vencedores.join(', ') || 'N/A'}`)
    lines.push('')
  }

  // Type-specific brainstorm instructions
  lines.push(TEST_TYPE_INSTRUCTIONS[locale][testType])

  // Optional user focus
  if (focus) {
    lines.push('')
    const focusLabel = locale === 'pt' ? 'Instruções adicionais do usuário:' : 'Additional user instructions:'
    lines.push(`${focusLabel}\n${escapeXmlTags(focus)}`)
  }

  lines.push('')
  lines.push('---')
  lines.push('# Auth: include X-Pipeline-Key header in ALL requests. Rate limit: 100 req/min.')
  lines.push('')
  lines.push(WORKFLOW_STEPS[locale](data.testId, baseUrl, TYPE_FIELD_DOCS[locale][testType]))

  return lines.join('\n')
}

export function buildAbReviewPrompt(options: {
  testId: string
  locale: 'pt' | 'en'
  variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    blob_url: string | null
    metadata: VariantMetadata | Record<string, unknown>
  }>
  channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>
}): string {
  const { testId, locale, variants, channel } = options

  const lines: string[] = []

  lines.push(`A/B Test Review: ${variants.length} variant${variants.length !== 1 ? 's' : ''} for test ${testId}`)
  lines.push(`Channel tier: ${channel.tier} (${channel.subscribers} subs)`)
  lines.push('')

  lines.push(locale === 'pt' ? 'Variantes:' : 'Variants:')
  for (const v of variants) {
    lines.push(`  ${v.label}:`)
    if (v.title_text) lines.push(`    title: ${v.title_text}`)
    if (v.description_text) lines.push(`    description: ${v.description_text}`)
    if (v.blob_url) lines.push(`    image: ${v.blob_url}`)
    const meta = v.metadata as Record<string, unknown>
    if (meta && Object.keys(meta).length > 0) lines.push(`    metadata: ${JSON.stringify(meta)}`)
  }
  lines.push('')

  lines.push(REVIEW_INSTRUCTIONS[locale])
  lines.push('')

  lines.push('---')
  lines.push('# Auth: include X-Pipeline-Key header in ALL requests.')
  lines.push(locale === 'pt'
    ? '# Revisão somente leitura — sem chamadas de API necessárias. Avalie e responda na conversa.'
    : '# Read-only review — no API calls needed. Evaluate and respond in conversation.')

  return lines.join('\n')
}
