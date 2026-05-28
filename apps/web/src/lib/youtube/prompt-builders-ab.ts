import { AB_BRIEFING_PROMPT_VERSION } from './prompt-types'
import type { AbBriefingData } from './prompt-types'
import type { TestType } from './ab-types'
import { buildSharedBase, escapeXmlTags } from './prompt-builders'
import { sanitizeForMarkdown } from './prompt-sanitize'

const TEST_TYPE_INSTRUCTIONS: Record<TestType, string> = {
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

**Thumbnail:**
- Composição e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)

**Título:**
- Hook emocional ou curiosidade
- Power words e urgência
- Por que esse combo funciona junto

Foco: sinergia thumb+título, complementaridade visual/textual. 3 combos coerentes.`,
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
  const sharedBase = buildSharedBase(data.channel)

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
        : { nota: 'sem dados de performance disponíveis' }),
    },
  }

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = (JSON.parse(historySection) as { historico_ab: unknown }).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[testType]
  if (focus) {
    instructions += `\n\nInstruções adicionais do usuário:\n${escapeXmlTags(focus)}`
  }

  if (!videoHasData) {
    instructions += '\n\nNota: sem dados de performance disponíveis para este vídeo. Use contexto do canal.'
  }

  return `${sharedBase}

<context>
${contextJson}
</context>

<instructions>
${instructions}
</instructions>`
}
