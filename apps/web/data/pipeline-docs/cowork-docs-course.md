# Course Domain — Referência Completa

Documentação completa para criação, gestão e graduação de cursos no Pipeline.
Cursos são items com `format: "course"` que usam seções específicas para estruturar
curriculum, aulas, materiais, lançamento (PLF) e página de vendas.

---

## Visão Geral

### O que são cursos no Pipeline?

Cursos são **pipeline items** com `format: "course"` que seguem o mesmo ciclo de vida
de outros formatos (ideia → roteiro → produção → graduação), mas com seções especializadas:

- **curriculum** — estrutura de módulos e aulas
- **lessons** — scripts e talking points por aula
- **material** — recursos e materiais por aula
- **launch** — plano de lançamento (Product Launch Formula)
- **publish** — página de vendas (headline, bullets, FAQ, CTA)

### Diferenças em relação a outros formatos

| Aspecto | Video/Blog | Course |
|---------|-----------|--------|
| Seções de conteúdo | ideia, draft, roteiro, postprod | ideia, curriculum, lessons, material, launch, publish |
| Graduação | Cria blog post ou newsletter | Cria **playlist** com items e edges |
| Escopo | Item único | Múltiplos módulos e aulas |
| Monitoramento | VVS score | VVS score + production_status por aula |
| Lançamento | Publicação direta | Product Launch Formula (PLF) |

### Ciclo de vida

```
1. POST /api/pipeline/items — format: "course"
2. Preencher ideia (premise, body, target audience)
3. Gerar curriculum (módulos + aulas + learning outcomes)
4. Gerar lessons (scripts por aula, por idioma)
5. Gerar materials (recursos por aula, por idioma)
6. Gerar launch plan (PLF: PLC sequence, bonuses, cart dates)
7. Gerar publish content (sales page por idioma)
8. Avançar production_status de cada aula: outline → scripted → recorded → edited → ready
9. Graduar curso → cria playlist com edges sequenciais
```

---

## Seções do Curso

### Compartilhamento de seções (shared vs per-lang)

| Section key | Tipo | Descrição |
|-------------|------|-----------|
| `ideia` | shared | Premissa, body, público-alvo (padrão do pipeline) |
| `curriculum` | shared | Estrutura de módulos e aulas (CurriculumContentSchema) |
| `lessons_pt` / `lessons_en` | per-lang | Scripts e talking points por aula |
| `material_pt` / `material_en` | per-lang | Recursos e materiais por aula |
| `launch` | shared | Plano de lançamento PLF (LaunchContentSchema) |
| `publish_pt` / `publish_en` | per-lang | Conteúdo da página de vendas |

**Nota sobre nomenclatura:** Ao fazer PATCH em seções, use o sufixo de idioma
para seções per-lang. Exemplo: `PATCH /items/:id/sections/lessons_pt`.
Seções shared usam o nome base: `PATCH /items/:id/sections/curriculum`.

---

## Schema: curriculum (shared)

**Schema:** `CurriculumContentSchema`
**Source:** `src/lib/pipeline/course-schemas.ts`

```json
{
  "curriculum_mode": "fixed",
  "target_audience": "Desenvolvedores júnior que querem dominar TypeScript",
  "difficulty": "beginner",
  "estimated_hours": 12,
  "learning_outcomes": [
    "Entender o sistema de tipos do TypeScript",
    "Configurar projetos TS do zero",
    "Usar generics e utility types"
  ],
  "modules": [
    {
      "id": "m1",
      "title": "Fundamentos do TypeScript",
      "description": "Tipos básicos, interfaces e type aliases",
      "sort_order": 0,
      "is_preview": true,
      "lessons": [
        {
          "id": "l1",
          "title": "Por que TypeScript?",
          "type": "video",
          "sort_order": 0,
          "is_preview": true,
          "estimated_minutes": 15,
          "production_status": "outline",
          "pipeline_ref": null,
          "resources": []
        },
        {
          "id": "l2",
          "title": "Setup do ambiente",
          "type": "exercise",
          "sort_order": 1,
          "is_preview": false,
          "estimated_minutes": 20,
          "production_status": "outline",
          "pipeline_ref": null,
          "resources": [
            {
              "label": "Starter repo",
              "type": "repo",
              "url": "https://github.com/example/ts-starter",
              "media_id": null
            }
          ]
        }
      ]
    }
  ]
}
```

### CurriculumContentSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `curriculum_mode` | `'fixed'` \| `'progressive'` | `'fixed'` | Fixed = todas aulas disponíveis; Progressive = liberação gradual |
| `target_audience` | string | `''` | Descrição do público-alvo |
| `difficulty` | `'beginner'` \| `'intermediate'` \| `'advanced'` | `'beginner'` | Nível de dificuldade geral |
| `estimated_hours` | number (≥ 0) | `0` | Duração total estimada em horas |
| `learning_outcomes` | string[] | `[]` | Lista de resultados de aprendizado |
| `modules` | CurriculumModule[] | `[]` | Array de módulos |

### CurriculumModuleSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | string (min 1) | — | ID único do módulo (usar `generateModuleId()` → 8-char UUID) |
| `title` | string (min 1) | — | Título do módulo |
| `description` | string | `''` | Descrição do módulo |
| `sort_order` | int (≥ 0) | — | Ordem de exibição |
| `is_preview` | boolean | `false` | Se o módulo é preview (acessível gratuitamente) |
| `lessons` | CurriculumLesson[] | `[]` | Array de aulas do módulo |

### CurriculumLessonSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | string (min 1) | — | ID único da aula (usar `generateLessonId()` → 8-char UUID) |
| `title` | string (min 1) | — | Título da aula |
| `type` | enum | — | `'video'` \| `'text'` \| `'quiz'` \| `'exercise'` \| `'pdf'` \| `'live'` \| `'mixed'` |
| `sort_order` | int (≥ 0) | — | Ordem dentro do módulo |
| `is_preview` | boolean | `false` | Se a aula é preview |
| `estimated_minutes` | int (> 0) | `10` | Duração estimada em minutos |
| `production_status` | enum | `'outline'` | `'outline'` \| `'scripted'` \| `'recorded'` \| `'edited'` \| `'ready'` |
| `pipeline_ref` | UUID \| null | `null` | Referência a outro pipeline item (para aulas que são vídeos independentes) |
| `resources` | LessonResource[] | `[]` | Recursos inline da aula |

### LessonResourceSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `label` | string (min 1) | — | Nome do recurso |
| `type` | enum | — | `'pdf'` \| `'repo'` \| `'link'` \| `'template'` \| `'tool'` |
| `url` | string \| null | `null` | URL do recurso (null para placeholder) |
| `media_id` | UUID \| null | `null` | Referência ao Media System |

### production_status — ciclo de vida

```
outline → scripted → recorded → edited → ready
```

Cada aula progride independentemente. A graduação do módulo requer que **todas** as aulas
estejam em `ready`.

### Funções utilitárias

- `generateModuleId()` → string de 8 caracteres (UUID truncado)
- `generateLessonId()` → string de 8 caracteres (UUID truncado)
- `computeModuleProgress(module)` → `{ done: number, total: number }` (aulas com status `ready`)
- `computeCourseProgress(curriculum)` → `{ done: number, total: number, byStatus: Record<string, number> }`

---

## Schema: lessons (per-lang)

**Key:** `lessons_pt` ou `lessons_en`
**Schema:** `Record<lesson_id, LessonScript>`

Cada entrada mapeia o ID de uma aula (definido no curriculum) a um objeto LessonScript:

```json
{
  "l1": {
    "talking_points": [
      "JavaScript é dinâmico — erros só aparecem em runtime",
      "TypeScript adiciona tipagem estática — erros em compile time",
      "Adoção massiva: Angular, Vue 3, Next.js, Deno — todos usam TS",
      "Não é 'Java no browser' — é JavaScript com superpoderes",
      "Demo: um bug real que TS teria pego"
    ],
    "script": "## Por que TypeScript?\n\nVocê já passou horas debugando um erro que era simplesmente...",
    "production_notes": "Gravar com screen share mostrando VS Code. Usar exemplo real de bug."
  },
  "l2": {
    "talking_points": [
      "Instalar Node.js LTS",
      "npm init + npm install typescript",
      "tsconfig.json: strict mode desde o início",
      "Extensões do VS Code para TS",
      "Primeiro arquivo .ts → compilar → executar"
    ],
    "script": "## Setup do Ambiente\n\nAntes de escrever qualquer TypeScript, vamos configurar...",
    "production_notes": "Tutorial hands-on. Pausar após cada passo para o aluno acompanhar."
  }
}
```

### LessonScript — campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `talking_points` | string[] | 5-8 bullet points com os pontos principais da aula |
| `script` | string (markdown) | Roteiro completo da aula com headers por tópico |
| `production_notes` | string | Notas de produção (cenário, equipamento, sugestões de gravação) |

**Importante:** Os IDs das chaves (`l1`, `l2`, etc.) devem corresponder exatamente aos
IDs definidos no `curriculum.modules[].lessons[].id`.

---

## Schema: material (per-lang)

**Key:** `material_pt` ou `material_en`
**Schema:** `Record<lesson_id, MaterialItem[]>`

Cada entrada mapeia o ID de uma aula a um array de materiais:

```json
{
  "l1": [
    {
      "label": "Slides da aula",
      "type": "pdf",
      "url": null
    },
    {
      "label": "Documentação oficial do TypeScript",
      "type": "link",
      "url": "https://www.typescriptlang.org/docs/"
    }
  ],
  "l2": [
    {
      "label": "Repositório starter",
      "type": "repo",
      "url": "https://github.com/example/ts-starter"
    },
    {
      "label": "Checklist de configuração",
      "type": "template",
      "url": null
    },
    {
      "label": "VS Code",
      "type": "tool",
      "url": "https://code.visualstudio.com/"
    }
  ]
}
```

### MaterialItem — campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `label` | string | Nome descritivo do recurso (no idioma da seção) |
| `type` | enum | `'pdf'` \| `'repo'` \| `'link'` \| `'template'` \| `'tool'` |
| `url` | string \| null | URL do recurso; null para materiais a serem criados |

### Escolha do type

| Conteúdo | type |
|----------|------|
| Exercícios de código, starter projects | `repo` |
| Arquivos para download (PDFs, planilhas) | `pdf` |
| Referências externas (docs, artigos) | `link` |
| Templates e starters (não-código) | `template` |
| Software e ferramentas | `tool` |

---

## Schema: launch (shared)

**Schema:** `LaunchContentSchema`
**Source:** `src/lib/pipeline/launch-schemas.ts`

```json
{
  "launch_type": "internal",
  "plc_sequence": [
    {
      "number": 1,
      "title": "O problema que ninguém fala",
      "theme": "opportunity",
      "content_format": "video",
      "pipeline_ref": null,
      "campaign_ref": null,
      "planned_date": "2026-07-01",
      "status": "planned",
      "key_message": "Desenvolvedores perdem 30% do tempo debugando erros de tipo",
      "mental_triggers": ["authority", "reciprocity"]
    },
    {
      "number": 2,
      "title": "O framework de 3 passos",
      "theme": "teaching",
      "content_format": "video",
      "pipeline_ref": null,
      "campaign_ref": null,
      "planned_date": "2026-07-04",
      "status": "planned",
      "key_message": "TypeScript strict mode + 3 patterns = zero runtime errors",
      "mental_triggers": ["reciprocity", "social_proof"]
    },
    {
      "number": 3,
      "title": "O que muda quando você domina TS",
      "theme": "ownership",
      "content_format": "video",
      "pipeline_ref": null,
      "campaign_ref": null,
      "planned_date": "2026-07-07",
      "status": "planned",
      "key_message": "Mostre o que está dentro do curso — módulos, bônus, garantia",
      "mental_triggers": ["scarcity", "anticipation"]
    }
  ],
  "cart_open_date": "2026-07-10",
  "cart_close_date": "2026-07-17",
  "early_bird_deadline": "2026-07-12",
  "bonuses": [
    {
      "title": "Template de projeto TypeScript",
      "description": "Repositório com CI/CD, ESLint, e configuração strict pronta",
      "deadline": "2026-07-12",
      "type": "tool"
    },
    {
      "title": "Grupo exclusivo no Discord",
      "description": "Acesso a comunidade de alunos para tirar dúvidas",
      "deadline": null,
      "type": "community"
    }
  ],
  "email_campaign_id": null,
  "mental_triggers": {
    "authority": "10 anos de experiência com TypeScript em produção",
    "social_proof": "500+ alunos no curso anterior de JavaScript",
    "reciprocity": "3 vídeos de conteúdo gratuito (PLCs)",
    "scarcity": "Turma limitada a 200 vagas + preço early bird",
    "community": "Grupo fechado no Discord com suporte direto",
    "anticipation": "Countdown para abertura do carrinho"
  },
  "notes": "Começar promoção 2 semanas antes do PLC1. Preparar 5 emails de aquecimento."
}
```

### LaunchContentSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `launch_type` | enum | `'seed'` | `'seed'` \| `'internal'` \| `'jv'` \| `'evergreen'` |
| `plc_sequence` | PlcItem[] | 3 items pré-criados | Sequência de Pre-Launch Content |
| `cart_open_date` | string \| null | `null` | Data de abertura do carrinho (ISO date) |
| `cart_close_date` | string \| null | `null` | Data de fechamento do carrinho |
| `early_bird_deadline` | string \| null | `null` | Deadline para preço especial |
| `bonuses` | Bonus[] | `[]` | Bônus oferecidos na compra |
| `email_campaign_id` | UUID \| null | `null` | Referência a campanha de email |
| `mental_triggers` | MentalTriggers | `{}` | Gatilhos mentais do criador |
| `notes` | string | `''` | Notas internas de planejamento |

### PlcItemSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `number` | `1` \| `2` \| `3` | — | Número do PLC |
| `title` | string | `''` | Título do conteúdo |
| `theme` | enum | — | `'opportunity'` \| `'teaching'` \| `'ownership'` |
| `content_format` | enum | `'video'` | `'video'` \| `'blog'` \| `'email'` \| `'live'` |
| `pipeline_ref` | UUID \| null | `null` | Referência ao pipeline item do PLC |
| `campaign_ref` | UUID \| null | `null` | Referência à campanha de email |
| `planned_date` | string \| null | `null` | Data planejada (ISO date) |
| `status` | enum | `'planned'` | `'planned'` \| `'drafted'` \| `'produced'` \| `'published'` |
| `key_message` | string | `''` | Mensagem principal |
| `mental_triggers` | string[] | `[]` | Gatilhos mentais usados neste PLC |

### BonusSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `title` | string (min 1) | — | Nome do bônus |
| `description` | string | `''` | Descrição do bônus |
| `deadline` | string \| null | `null` | Data limite (null = sem expiração) |
| `type` | enum | `'content'` | `'content'` \| `'access'` \| `'tool'` \| `'community'` \| `'coaching'` |

### MentalTriggersSchema — campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `authority` | string \| null | `null` | Credenciais e experiência do criador |
| `social_proof` | string \| null | `null` | Números, depoimentos, resultados |
| `reciprocity` | string \| null | `null` | Valor entregue gratuitamente (PLCs) |
| `scarcity` | string \| null | `null` | Limitação real (vagas, prazo, preço) |
| `community` | string \| null | `null` | Senso de pertencimento |
| `anticipation` | string \| null | `null` | Contagem regressiva, teasers |

---

## Schema: publish (per-lang)

**Key:** `publish_pt` ou `publish_en`

Conteúdo da página de vendas do curso:

```json
{
  "headline": "Domine TypeScript em 12 horas",
  "subheadline": "De zero a produção com o framework que as big techs usam",
  "bullets": [
    "Configure projetos TypeScript com strict mode desde o dia 1",
    "Domine generics, utility types e type guards",
    "Construa APIs type-safe com Zod + tRPC",
    "Escreva testes tipados com Vitest",
    "Deploy com CI/CD completo"
  ],
  "faq": [
    {
      "question": "Preciso saber JavaScript antes?",
      "answer": "Sim, conhecimento básico de JS é pré-requisito. Se você sabe fazer loops, funções e objetos, está pronto."
    },
    {
      "question": "Quanto tempo leva para completar?",
      "answer": "O curso tem 12 horas de conteúdo. No ritmo de 1 hora por dia, você termina em 2 semanas."
    },
    {
      "question": "Tem certificado?",
      "answer": "Sim, certificado de conclusão após completar todos os módulos e exercícios."
    },
    {
      "question": "E se eu não gostar?",
      "answer": "Garantia incondicional de 30 dias. Devolvemos 100% do valor."
    }
  ],
  "cta": "Garantir minha vaga agora",
  "guarantee": "30 dias de garantia incondicional",
  "social_proof_items": [
    "500+ alunos no curso anterior",
    "4.8/5 de avaliação média"
  ],
  "testimonials": [
    {
      "name": "João Silva",
      "role": "Dev Frontend",
      "quote": "Finalmente entendi generics. Valeu cada centavo."
    }
  ]
}
```

### Publish — campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `headline` | string | Título principal (max 10 palavras, foco em benefício) |
| `subheadline` | string | Complemento do headline (clarifica o como) |
| `bullets` | string[] | 5-7 bullet points com resultados específicos |
| `faq` | Array<{ question, answer }> | 4-6 perguntas frequentes (objeções comuns) |
| `cta` | string | Call-to-action (orientado à ação, específico) |
| `guarantee` | string | Garantia (padrão: 30 dias incondicional) |
| `social_proof_items` | string[] | Provas sociais em formato curto |
| `testimonials` | Array<{ name, role, quote }> | Depoimentos de alunos/clientes |

---

## format_metadata — campos específicos de curso

Ao criar um item com `format: "course"`, o campo `format_metadata` aceita:

```json
{
  "tier": "pro",
  "difficulty": "intermediate",
  "platform": "hotmart",
  "price_cents": 29700,
  "launch_type": "internal",
  "playlist_id": null
}
```

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `tier` | string | `'free'` \| `'starter'` \| `'pro'` \| `'premium'` | Nível do produto |
| `difficulty` | string | `'beginner'` \| `'intermediate'` \| `'advanced'` | Dificuldade (espelhado do curriculum) |
| `platform` | string | `'hotmart'` \| `'kiwify'` \| `'eduzz'` \| `'own'` \| `'other'` | Plataforma de venda |
| `price_cents` | number | inteiro positivo | Preço em centavos (R$ 297,00 = 29700) |
| `launch_type` | string | `'seed'` \| `'internal'` \| `'jv'` \| `'evergreen'` | Estratégia de lançamento |
| `playlist_id` | UUID \| null | — | ID da playlist criada na graduação (preenchido automaticamente) |

---

## Graduação de Curso → Playlist

A graduação converte um curso em uma playlist com items e edges sequenciais.

### Endpoint

```
POST /api/pipeline/items/:id/graduate
Body: { "target": "course" }
```

### Regras de elegibilidade

1. O item deve ter `format: "course"` e um curriculum válido
2. Apenas módulos onde **todas as aulas** têm `production_status: 'ready'` são graduados
3. Módulos sem aulas são ignorados (skipped)
4. Módulos com pelo menos uma aula não-ready são ignorados (skipped)
5. Se nenhum módulo é elegível, retorna erro 422

### Algoritmo de graduação

1. Parseia `curriculum_shared.content` com CurriculumContentSchema
2. Filtra módulos elegíveis (todas as aulas com `production_status: 'ready'`)
3. Se `format_metadata.playlist_id` existe → usa playlist existente
4. Caso contrário → cria nova playlist com `category: 'course'`, `status: 'draft'`
5. Para cada módulo elegível, ordena aulas por `sort_order`
6. Cria `playlist_items` com `sort_order = module.sort_order * 1000 + lesson.sort_order`
7. Cada aula vira um playlist_item, com `pipeline_id = lesson.pipeline_ref || item.id`
8. Cria `playlist_edges` do tipo `sequence` conectando items na ordem
9. Atualiza `format_metadata.playlist_id` no item original
10. Insere evento `graduated` no history com `to_value: "course:{playlist_id}"`

### Sort order na playlist

```
Módulo 0, Aula 0 → sort_order: 0    (0*1000 + 0)
Módulo 0, Aula 1 → sort_order: 1    (0*1000 + 1)
Módulo 0, Aula 2 → sort_order: 2    (0*1000 + 2)
Módulo 1, Aula 0 → sort_order: 1000 (1*1000 + 0)
Módulo 1, Aula 1 → sort_order: 1001 (1*1000 + 1)
```

### Resposta

```json
{
  "data": {
    "graduated": true,
    "target": "course",
    "entity_id": "playlist-uuid",
    "skipped_modules": [
      {
        "title": "Módulo Avançado",
        "reason": "Not all lessons are ready"
      }
    ]
  }
}
```

### Re-graduação

Se `format_metadata.playlist_id` já está definido, a graduação **adiciona** items à playlist
existente (upsert com `ignoreDuplicates: true`). Isso permite graduar módulos conforme ficam prontos.

---

## Product Launch Formula (PLF)

O PLF é a estratégia de lançamento usada para cursos. Consiste em 3 PLCs (Pre-Launch Content)
que preparam a audiência antes da abertura do carrinho.

### PLC Sequence

| PLC | Theme | Objetivo |
|-----|-------|----------|
| PLC1 | `opportunity` | Despertar interesse. Mostrar o problema e a oportunidade. Hook com a grande promessa. |
| PLC2 | `teaching` | Entregar valor real. Ensinar um framework ou método. Mostrar que você sabe do que está falando. |
| PLC3 | `ownership` | Gerar desejo. Abordar objeções. Mostrar o que tem dentro do curso. Transição para venda. |

### Cronograma padrão

```
PLC1 ──── 3 dias ──── PLC2 ──── 3 dias ──── PLC3 ──── 3 dias ──── Cart Open ──── 7 dias ──── Cart Close
                                                                     │
                                                                     └─ Early Bird (primeiras 48h)
```

### Tipos de lançamento

| Tipo | Quando usar | Características |
|------|-------------|-----------------|
| `seed` | Sem audiência | PLCs curtos, preço baixo, foco em validação e primeiros depoimentos |
| `internal` | Lista existente | PLCs robustos, sequência de emails, bônus escalonados |
| `jv` | Parcerias | PLCs compartilhados, afiliados, comissão, co-marketing |
| `evergreen` | Vendas contínuas | PLCs automatizados (webinar, email sequence), sem urgência real |

### Gatilhos mentais

Os 6 gatilhos mentais do PLF:

| Trigger | Chave | Como usar |
|---------|-------|-----------|
| Autoridade | `authority` | Credenciais, anos de experiência, resultados publicados |
| Prova Social | `social_proof` | Número de alunos, avaliações, depoimentos, resultados de alunos |
| Reciprocidade | `reciprocity` | Conteúdo gratuito entregue nos PLCs (valor antes da venda) |
| Escassez | `scarcity` | Vagas limitadas, preço por tempo limitado, bônus com deadline |
| Comunidade | `community` | Grupo fechado, networking, senso de pertencimento |
| Antecipação | `anticipation` | Countdown, teasers, "em breve", waitlist |

### Bônus

Tipos de bônus disponíveis:

| Type | Exemplo |
|------|---------|
| `content` | Aulas extras, ebooks, templates de conteúdo |
| `access` | Acesso antecipado, período estendido, módulos extras |
| `tool` | Templates de código, repositórios, ferramentas |
| `community` | Grupo Discord/Telegram, fórum exclusivo |
| `coaching` | Sessões de mentoria, Q&A ao vivo, code review |

**Fast-action bonus:** Primeiro bônus deve ter deadline de 48h após abertura do carrinho.
Cria urgência para decisão rápida.

---

## VVS Score — pesos específicos de curso

O VVS (Viability Validation Score) inclui pesos adicionais para cursos,
avaliando a completude dos metadados de comercialização:

| Condição | Peso | O que verifica |
|----------|------|---------------|
| `has_tier` | +3 | `format_metadata.tier` preenchido (free/starter/pro/premium) |
| `has_pricing_model` | +3 | `format_metadata.pricing_model` preenchido |
| `has_platform` | +2 | `format_metadata.platform` preenchido (hotmart/kiwify/etc.) |
| `has_difficulty` | +2 | `format_metadata.difficulty` preenchido |

Total de bônus possível: **+10 pontos** sobre o VVS base.

Esses pesos incentivam o preenchimento dos campos comerciais antes da graduação,
garantindo que o curso tem modelo de negócio definido.

---

## AI Prompt Guidelines por Seção

### Gerar curriculum a partir de ideia

**Input:** `ideia_shared` (premise, body, target audience)
**Output:** `CurriculumContentSchema`

Regras:
- Criar 3-5 módulos com 3-5 aulas cada
- Definir `estimated_minutes` por aula (10-30 min para vídeo, 5-10 para texto/quiz)
- Definir `difficulty` baseado no conteúdo da ideia
- Gerar 3-5 learning outcomes mensuráveis
- Todas as aulas começam com `production_status: 'outline'`
- Marcar módulo 1 como `is_preview: true`
- Marcar aula 1.1 como `is_preview: true`
- Usar `generateModuleId()` e `generateLessonId()` para IDs
- Progressão lógica: do básico ao avançado
- Último módulo: projeto prático ou caso real

### Gerar lessons a partir de curriculum

**Input:** `curriculum_shared` (estrutura de módulos/aulas) + `ideia_shared`
**Output:** `Record<lesson_id, LessonScript>`

Regras:
- Gerar `talking_points` (5-8 bullet points por aula)
- Gerar `script` como markdown com headers por tópico
- Incluir `production_notes` com sugestões de gravação
- Referenciar o título da aula e o contexto do módulo
- Manter tempo de fala próximo ao `estimated_minutes`
- Incluir exemplos práticos e analogias
- Para aulas tipo `exercise`: incluir instruções passo-a-passo
- Para aulas tipo `quiz`: incluir perguntas e respostas no script

### Gerar materials a partir de curriculum

**Input:** `curriculum_shared` (estrutura com lesson IDs)
**Output:** `Record<lesson_id, MaterialItem[]>`

Regras:
- Usar exatamente os lesson IDs do curriculum (e.g., `l1`, `abc123`)
- Incluir pelo menos 1-3 materiais por aula (mais para aulas hands-on)
- Escolher `type` baseado no conteúdo: código → `repo`, download → `pdf`, referência → `link`, starter → `template`, software → `tool`
- Fornecer URLs concretas quando conhecidas (GitHub, docs oficiais); usar `null` para placeholder
- Labels no idioma da seção (pt ou en)
- Priorizar materiais que reforçam os learning outcomes
- Para aulas `exercise` e `quiz`: sempre incluir `template` ou `repo`

### Gerar launch plan

**Input:** `ideia_shared` + `curriculum_shared` + `format_metadata` (pricing, tier)
**Output:** `LaunchContentSchema`

Regras:
- Definir `launch_type` baseado no tamanho da audiência (sem audiência → seed, lista existente → internal)
- PLC1 tema: opportunity — hook com a grande promessa
- PLC2 tema: teaching — entregar valor real, mostrar framework
- PLC3 tema: ownership — abordar objeções, mostrar o que tem dentro
- Espaçar PLCs 3 dias entre si
- Cart open 3 dias após PLC3, close 7 dias após open
- Sugerir 2-3 bônus com deadlines (primeiro 48h para fast-action bonus)
- Preencher `mental_triggers` baseado nos assets do criador
- Cada PLC deve ter `key_message` clara e específica
- Listar `mental_triggers` usados em cada PLC

### Gerar sales copy (publish)

**Input:** `ideia_shared` + `curriculum_shared` + `launch_shared` (testimonials, social proof)
**Output:** Publish section content

Regras:
- Headline: max 10 palavras, foco em benefício
- Subheadline: clarificar o como
- 5-7 bullet points com outcomes específicos (não genéricos)
- 4-6 FAQ items abordando objeções comuns
- CTA: orientado à ação, específico (não "Comprar agora" genérico)
- Guarantee: 30 dias padrão, a menos que especificado diferente
- Incluir `social_proof_items` quando disponíveis
- Incluir `testimonials` quando disponíveis
- Tom: confiante mas não agressivo, baseado em resultados

---

## Workflow Completo: Curso do Zero

### 1. Criar item

```json
POST /api/pipeline/items
{
  "title_pt": "TypeScript do Zero ao Pro",
  "title_en": "TypeScript from Zero to Pro",
  "format": "course",
  "format_metadata": {
    "tier": "pro",
    "difficulty": "beginner",
    "platform": "hotmart",
    "price_cents": 29700,
    "launch_type": "internal"
  }
}
```

### 2. Escrever ideia

```json
PATCH /api/pipeline/items/:id/sections/ideia
{
  "content": {
    "premise": "Ensinar TypeScript de forma prática",
    "body": "Curso completo de TypeScript para devs JavaScript...",
    "target_audience": "Desenvolvedores JavaScript que querem migrar para TS"
  },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 3. Gerar curriculum

```json
PATCH /api/pipeline/items/:id/sections/curriculum
{
  "content": { /* CurriculumContentSchema */ },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 4. Gerar lessons (por idioma)

```json
PATCH /api/pipeline/items/:id/sections/lessons_pt
{
  "content": { /* Record<lesson_id, LessonScript> */ },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 5. Gerar materials (por idioma)

```json
PATCH /api/pipeline/items/:id/sections/material_pt
{
  "content": { /* Record<lesson_id, MaterialItem[]> */ },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 6. Gerar launch plan

```json
PATCH /api/pipeline/items/:id/sections/launch
{
  "content": { /* LaunchContentSchema */ },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 7. Gerar publish (por idioma)

```json
PATCH /api/pipeline/items/:id/sections/publish_pt
{
  "content": { /* Publish content */ },
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

### 8. Avançar production status das aulas

Atualizar `production_status` de cada aula no curriculum conforme gravação progride:
`outline → scripted → recorded → edited → ready`

### 9. Graduar

```json
POST /api/pipeline/items/:id/graduate
{ "target": "course" }
→ { "data": { "graduated": true, "target": "course", "entity_id": "playlist-uuid", "skipped_modules": [] } }
```

---

## Regras Gerais

1. **Seções per-lang** (`lessons`, `material`, `publish`): usar sufixo `_pt` ou `_en`
2. **Seções shared** (`curriculum`, `launch`): nome base sem sufixo de idioma
3. **IDs de aula/módulo**: usar os IDs gerados pelo curriculum em todas as seções
4. **production_status**: gerenciado no curriculum, não nas outras seções
5. **source**: sempre `"cowork"` quando gerado por AI
6. **modified_by**: sempre `"cowork-claude"` para rastreabilidade
7. **format_metadata.playlist_id**: preenchido automaticamente na graduação — não editar manualmente
8. **Re-graduação**: segura — upsert ignora duplicatas, permite graduar módulos incrementalmente
