import { AB_BRIEFING_PROMPT_VERSION } from './prompt-types'
import type { AbBriefingData } from './prompt-types'
import type { TestType, VariantMetadata } from './ab-types'
import type { PromptChannelInfo } from './prompt-types'
import { buildSharedBase, escapeXmlTags } from './prompt-builders'
import { sanitizeForMarkdown } from './prompt-sanitize'

type Locale = 'pt' | 'en'

const TEST_TYPE_INSTRUCTIONS: Record<Locale, Record<TestType, string>> = {
  pt: {
    thumbnail: `Analise a thumbnail atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Composição visual e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)
- Expressão facial / elemento humano
Foco: composição visual, paleta de cores, texto overlay, expressão facial. 3 variações.`,
    title: `Analise o título atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Hook emocional ou curiosidade
- Power words e senso de urgência
- Uso de números, brackets, ou padrões comprovados
- Comprimento ideal: 50-60 caracteres
Foco: hook emocional, power words, números/brackets, comprimento 50-60 chars. 3 variações.`,
    description: `Analise a descrição atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Posição e texto do CTA principal
- Conteúdo acima do fold (3 primeiras linhas visíveis)
- Uso de links rastreados com sintaxe {{link:nome}}
- Hashtags estratégicas
Foco: CTA posição, fold (3 primeiras linhas), links {{link:nome}}, hashtags. 3 variações.`,
    combo: `Analise o combo atual (thumbnail + título) e sugira 3 combos coerentes para teste A/B.
Para cada combo (B, C, D), descreva:
**Thumbnail:** Composição e enquadramento, paleta de cores, texto overlay
**Título:** Hook emocional, power words, urgência, por que esse combo funciona junto
Foco: sinergia thumb+título, complementaridade visual/textual. 3 combos coerentes.`,
  },
  en: {
    thumbnail: `Analyze the current thumbnail and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Visual composition and framing
- Color palette and contrast
- Text overlay (if applicable)
- Facial expression / human element
Focus: visual composition, color palette, text overlay, facial expression. 3 variations.`,
    title: `Analyze the current title and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Emotional hook or curiosity gap
- Power words and sense of urgency
- Use of numbers, brackets, or proven patterns
- Ideal length: 50-60 characters
Focus: emotional hook, power words, numbers/brackets, length 50-60 chars. 3 variations.`,
    description: `Analyze the current description and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Position and text of the main CTA
- Content above the fold (first 3 visible lines)
- Use of tracked links with {{link:name}} syntax
- Strategic hashtags
Focus: CTA position, fold (first 3 lines), links {{link:name}}, hashtags. 3 variations.`,
    combo: `Analyze the current combo (thumbnail + title) and suggest 3 coherent combos for A/B testing.
For each combo (B, C, D), describe:
**Thumbnail:** Composition, palette, text overlay
**Title:** Emotional hook, power words, urgency, why this combo works together
Focus: thumb+title synergy, visual/textual complementarity. 3 coherent combos.`,
  },
}

const WORKFLOW_STEPS: Record<Locale, (testId: string) => string> = {
  pt: (testId) => `## Workflow
1. Discuta as ideias com o usuário até atingir consenso
2. Para cada variante acordada (B, C, D), envie:
   POST /api/pipeline/youtube/ab-tests/${testId}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body: {
     "variants": [
       {
         "label": "B",
         "title_text": "<título ou null>",
         "description_text": "<descrição ou null>",
         "metadata": {
           "creative_direction": "<para thumbnails>",
           "ai_image_prompt": "<para geração de imagem AI>",
           "rationale": "<por que esta variante>"
         }
       }
     ]
   }
3. Confirme quais variantes foram criadas`,
  en: (testId) => `## Workflow
1. Discuss ideas with the user until consensus
2. For each agreed variant (B, C, D), send:
   POST /api/pipeline/youtube/ab-tests/${testId}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body: {
     "variants": [
       {
         "label": "B",
         "title_text": "<title or null>",
         "description_text": "<description or null>",
         "metadata": {
           "creative_direction": "<for thumbnails>",
           "ai_image_prompt": "<for AI image generation>",
           "rationale": "<why this variant>"
         }
       }
     ]
   }
3. Confirm which variants were created`,
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
}): string {
  const { testType, data, focus } = options
  const locale: Locale = data.locale ?? 'pt'
  const sharedBase = buildSharedBase(data.channel, locale)

  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const contextPayload: Record<string, unknown> = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    current_time: new Date().toISOString(),
    test_id: data.testId,
    test_type: testType,
    channel: {
      name: data.channel.name,
      subscribers: data.channel.subscribers,
      tier: data.channel.tier,
    },
    video: {
      title: sanitizeForMarkdown(data.video.title, 200),
      thumbnailUrl: data.video.thumbnailUrl,
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

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = (JSON.parse(historySection) as { historico_ab: unknown }).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[locale][testType]
  instructions += '\n\n' + WORKFLOW_STEPS[locale](data.testId)

  if (focus) {
    const focusLabel = locale === 'pt' ? 'Instruções adicionais do usuário:' : 'Additional user instructions:'
    instructions += `\n\n${focusLabel}\n${escapeXmlTags(focus)}`
  }

  return `${sharedBase}

<context>
\`\`\`json
${contextJson}
\`\`\`
</context>

<instructions>
${instructions}
</instructions>`
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
  const sharedBase = buildSharedBase(channel, locale)

  const contextPayload = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    test_id: testId,
    variants: variants.map(v => ({
      label: v.label,
      title_text: v.title_text,
      description_text: v.description_text,
      blob_url: v.blob_url,
      metadata: v.metadata,
    })),
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  return `${sharedBase}

<context>
\`\`\`json
${contextJson}
\`\`\`
</context>

<instructions>
${REVIEW_INSTRUCTIONS[locale]}
</instructions>`
}
