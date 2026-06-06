# A/B Testing System — Reference Completa para Design

> **Objetivo:** Documento de referência para guiar o design do sistema de testes A/B. Cobre todas as capacidades existentes, dados disponíveis, fluxos, e o novo Playoff Mode.
>
> **Data:** 2026-05-29

---

## 1. O Que o Sistema Já Faz

### 1.1 Tipos de Teste

4 tipos independentes, cada um roda o mesmo motor estatístico mas muda o que é rotacionado no YouTube:

| Tipo | O que muda | O que fica fixo | YouTube API |
|------|-----------|-----------------|-------------|
| **thumbnail** | Imagem da thumb | Título, descrição | `thumbnails.set` (POST upload) |
| **title** | Título do vídeo | Thumb, descrição | `videos.update` (PATCH snippet) |
| **description** | Descrição do vídeo | Thumb, título | `videos.update` (PATCH snippet) |
| **combo** | Thumb + título + descrição | — | `thumbnails.set` + `videos.update` |

Limite: máx 4 variantes por teste (Original A + B/C/D).

### 1.2 Rotação ABBA Counterbalanced

Elimina viés de dia-da-semana. O bloco repete ciclicamente:

- 2 variantes: `[A, B, B, A]` (bloco 4 dias)
- 3 variantes: `[A, B, C, C, B, A]` (bloco 6 dias)
- 4 variantes: `[A, B, C, D, D, C, B, A]` (bloco 8 dias)

Cada rotação = 1 ciclo. Ciclos são unidades atômicas de dados.

### 1.3 Motor Estatístico

**Primário — Bayesian P(B>A):** Modela CTR de cada variante como distribuição Beta. 10.000 simulações Monte Carlo determinam P(X vence todos os outros).

```
CTR_i ~ Beta(clicks_i + 1, impressions_i - clicks_i + 1)
```

**Backup — Z-test frequentista:** Apenas para testes de 2 variantes. Serve como sanity check. Se Bayesian e Z-test discordam, Bayesian prevalece (log de warning).

### 1.4 Auto-Resolve: 6 Gates

Um teste só é resolvido automaticamente quando TODOS os 6 gates passam:

| # | Gate | Threshold | Por quê |
|---|------|-----------|---------|
| 1 | Confidence | ≥ 95% (configurável 80-99%) | Significância estatística |
| 2 | Min impressions | ≥ 1.000 por variante | Amostra adequada |
| 3 | Min duration | ≥ 7 dias | Eliminar viés semanal |
| 4 | Min cycles | ≥ 14 ciclos | Blocos ABBA completos |
| 5 | Burn-in | Primeiros N ciclos excluídos | Remove efeito novidade |
| 6 | Stability | Confidence estável 3 avaliações consecutivas | Sem flip-flop |

Se `max_duration_days` é atingido sem os gates passarem → `completed_reason = 'inconclusive'`.

### 1.5 Três Crons Independentes

| Cron | Horário UTC | Função |
|------|------------|--------|
| **ab-rotate** | 08:00 (meia-noite PST) | Troca thumb/título/desc no YouTube, fecha ciclo, abre novo |
| **ab-backfill** | 11:00 | Puxa dados confirmados da YouTube Analytics API (48-72h delay) |
| **ab-evaluate** | 12:00 | Roda estatísticas, checa 6 gates, auto-resolve ou marca inconclusive |

Isolamento de erro: falha de OAuth na rotação não bloqueia avaliação de dados já backfillados.

### 1.6 State Machine

```
draft → active → completed → archived
         ↓                       ↑
       paused → completed ───────┘
         ↓
       archived
```

UNIQUE index garante máximo 1 teste não-terminal por vídeo.

---

## 2. Dados Disponíveis por Teste

### 2.1 Por Variante (VariantStats)

| Dado | Fonte | Delay |
|------|-------|-------|
| `total_impressions` | YouTube Analytics API confirmado | 48-72h |
| `total_clicks` | Calculado: impressions × CTR | 48-72h |
| `avg_ctr` | CTR ponderado por ciclos confirmados | 48-72h |
| `cycles_completed` | Contagem de ciclos com backfill `confirmed` | Realtime |
| `estimated_impressions` | YouTube Data API v3 (near-realtime) | ~minutos |
| `estimated_ctr` | YouTube Data API v3 | ~minutos |

### 2.2 Por Ciclo (AbTestCycle)

Cada ciclo registra:
- Variante ativa, timestamps start/end
- Dados estimados (realtime) vs confirmados (backfilled)
- `backfill_status`: pending → partial → confirmed / no_data / error
- `applied_metadata`: snapshot do que foi aplicado no YouTube (thumb set? qual título? links resolvidos?)

### 2.3 Metadata por Variante (VariantMetadata)

Estrutura rica que o Cowork preenche durante brainstorm:

```typescript
{
  thumbnail_tags: string[]           // Tags visuais: ["close-up", "saturated"]
  title_pattern: string              // Padrão: "Location: Superlative + Emoji"
  emotional_triggers: string[]       // ["curiosity", "surprise", "fomo"]
  visual_description: string         // Descrição textual da composição
  ai_image_prompt: string            // Prompt Midjourney/DALL-E
  creative_direction: string         // Direção criativa para thumbnail
  rationale: string                  // Por que o Cowork sugeriu esta variante
  composition: {                     // Composição visual
    face_position: string
    background: string
    product_placement: string
  }
  palette: Array<{                   // Paleta de cores
    hex: string
    role: string
    purpose: string
  }>
  text_overlay: {                    // Texto na thumbnail
    text: string
    font: string
    size: string
    position: string
  }
  expression: string                 // Expressão facial
  synergy: {                         // Sinergia thumb+título (combo)
    division: string
    reinforcement: string
  }
  score: {                           // Scores preditivos
    thumbnail: number
    title: number
    combo: number
  }
  classification: 'hero' | 'challenger' | 'safety'
}
```

### 2.4 Links Engine Integration (Testes de Descrição/Combo)

Sintaxe `{{link:nome}}` nas descrições gera tracked links únicos por variante:
- Cada variante recebe short codes próprios (ex: `go/news-b`, `go/news-c`)
- Link clicks trackados com visitor ID rotativo diário
- Tabela `ab_test_tracked_links` junta variante → short code → clicks

Isso permite **funnel attribution completo**: Impressão → View → Link Click → Conversão, segmentado por variante.

### 2.5 Result Metadata (Pós-Conclusão)

```typescript
{
  ctr_lift_percent: number               // +18.5%
  winner_label: string                   // "B"
  total_impressions: number              // 45.000
  estimated_monthly_extra_clicks: number // +230
}
```

---

## 3. Intelligence Engine (Scoring + Optimization Loop)

### 3.1 Scoring de Vídeos (6 Eixos)

Cada vídeo é avaliado em 6 dimensões, normalizadas via sigmoid para 0-100:

| Eixo | Peso | O que mede |
|------|------|-----------|
| CTR | 25% | Click-through rate vs mediana do canal |
| Retenção | 25% | avg_view_percentage vs mediana |
| Alcance | 15% | Impressões (log2 normalizado) |
| Engajamento | 15% | (likes+comments+shares)/views × 100 |
| Crescimento | 12% | Velocidade de crescimento diário |
| Impacto Sub | 8% | Novos inscritos atribuídos ao vídeo |

**Grades:** A ≥ 85, B ≥ 65, C ≥ 40, D < 40.

**Tiers de canal** ajustam benchmarks (Nano < 1K subs recebe bônus em CTR/Retenção).

### 3.2 Optimization Loop (State Machine)

```
unmonitored → flagged → diagnosed → test_suggested → testing
                                                        ↓
                                       post_test_monitoring
                                         ↓              ↓
                                      resolved    retest_needed → (volta p/ flagged)
                                                        ↓
                                                     exhausted (5 ciclos max)
```

**Triggers automáticos:**
- 2+ semanas com grade C/D → `flagged`
- Cowork analisa → `diagnosed` com recommendation
- Recommendation inclui teste → `test_suggested` com notificação "Criar A/B Test"
- Usuário cria teste → `testing`
- Teste concluído com vencedor → `post_test_monitoring` (checkpoints em 7, 14, 30 dias)
- Grade melhora para A/B em 30 dias → `resolved` (cooldown 60 dias)
- Grade permanece C/D → `retest_needed`
- 5 ciclos → `exhausted`

### 3.3 Notificações

| Tipo | Prioridade | Trigger |
|------|-----------|---------|
| grade_drop | 5 | Queda ≥ 2 grades em 1 semana |
| ctr_drop | 4 | CTR cai > 30% vs média 7 dias |
| monitoring_alert | 4 | Post-test: grade não recuperou |
| ab_test_completed | 3 | Teste tem vencedor |
| retest_suggested | 3 | Ciclo volta para diagnosed |
| optimization_available | 3 | Nova recomendação disponível |
| trending_viral | 2 | views48h ≥ 5x channelAvg48h |
| playoff_created | 3 | Playoff criado automaticamente |

---

## 4. Cowork Integration (IA no Loop)

### 4.1 Brainstorm Step (Wizard Step 2)

Wizard de criação tem 5 passos: **Tipo → Ideias → Variantes → Config → Revisar**.

O Step "Ideias" gera um prompt contextual com:
- Dados do canal (tier, subscribers)
- Métricas do vídeo (CTR, grade, retention)
- Histórico de testes anteriores (cross-test learning)
- Direções por slot (slotNotes injetados no prompt)
- Instruções por tipo de teste (bilíngue PT/EN)

O usuário copia o prompt, cola no Claude, discute, e o Claude faz POST de variantes via Pipeline API. SWR polling detecta variantes chegando e auto-popula o wizard.

### 4.2 4 Estados Progressivos do Step Ideias

| Estado | Trigger | UI |
|--------|---------|-----|
| Pre-copy | Inicial | Prompt card + campo de hipótese + direções por slot |
| Waiting | Prompt copiado | 3 skeleton cards, polling 5s |
| Partial | 1-2 variantes chegaram | Cards com fade-in, remaining skeleton |
| Complete | 3 variantes | Todos visíveis + badge "Passo 3 pré-preenchido" |

### 4.3 Pipeline API Endpoints para A/B

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/pipeline/youtube/ab-tests/:id/variants` | POST | Batch upsert de variantes (max 3) |
| `/api/pipeline/youtube/ab-tests/:id/variants` | GET | Listar variantes (SWR polling) |
| `/api/pipeline/youtube/ab-tests/:id/variants` | DELETE | Remover variante (só draft) |
| `/api/pipeline/youtube/ab-tests` | GET | Todos os testes + stats |
| `/api/pipeline/youtube/ab-tests/:id` | GET | Detalhe completo do teste |
| `/api/pipeline/youtube/ab-tests/:id/funnel` | GET | Funnel attribution por variante |
| `/api/pipeline/youtube/ab-performance` | GET | Cross-test patterns + best metadata tags |

### 4.4 Review Loop (Step 3, Opcional)

Após variantes populadas, botão "Solicitar Review" gera prompt com Vercel Blob URLs (permanentes) para avaliação multimodal pelo Claude. Score de contraste visual, força do hook, diferenciação.

---

## 5. Playoff Mode (NOVO — Aprovado 2026-05-29)

### 5.1 Problema

Quando um teste atinge `max_duration_days` sem confiança estatística, completa como `inconclusive`. O usuário teria que criar manualmente um novo teste com menos variantes. O Playoff automatiza isso.

### 5.2 Como Funciona

1. **Round 1** completa como `inconclusive`
2. Cron `ab-evaluate` detecta elegibilidade
3. Calcula **P(top2)** via Monte Carlo para todas as variantes
4. Seleciona os 2 melhores (com gap mínimo de 5pp entre 2º e 3º)
5. Cria **Round 2** automaticamente como `draft` com cooldown de 4h
6. Após cooldown, cron ativa o Round 2
7. Round 2 roda com apenas 2 variantes → convergência mais rápida
8. Se Round 2 também for inconclusivo → **variantes são equivalentes**, sem cascata

### 5.3 P(top2) — Monte Carlo Selection

Nova função que complementa o P(best) existente. Para cada simulação:
1. Amostra CTR de cada variante via Beta(clicks+1, impressions-clicks+1)
2. Identifica os top 2 de cada amostra
3. P(top2) = frequência de aparecer no top 2 em 10.000 simulações

Isso elimina **winner's curse** — raw CTR pode ser misleading em amostras pequenas.

### 5.4 9 Condições de Elegibilidade (TODAS devem passar)

| # | Condição | Razão |
|---|----------|-------|
| 1 | `completed_reason = 'inconclusive'` | Só inconclusivos entram em playoff |
| 2 | `test_type IN ('thumbnail', 'combo')` | Title/desc arriscam re-indexação YouTube |
| 3 | ≥ 3 variantes non-original com dados | Precisa ter variantes suficientes pra narrowing |
| 4 | `round_number = 1` + sem parent + sem playoff | Sem playoffs cascateados |
| 5 | Avg daily impressions ≥ 500 | Low-traffic não converge |
| 6 | Original NÃO é o P(best) winner | Se original ganha, não precisa otimizar |
| 7 | Gap P(top2) entre 2º e 3º ≥ 5pp | Se 2º/3º são indistinguíveis, playoff não ajuda |
| 8 | Todos os ciclos em backfill terminal | Esperar dados completos |
| 9 | Toda variante tem ≥ 2 ciclos + ≥ 200 impressions | Mínimo pra P(top2) confiável |

### 5.5 Schema Changes

```sql
-- ab_tests: novos campos
parent_test_id UUID    -- Round 2 → aponta pra Round 1
round_number INTEGER   -- 1 (default) ou 2
playoff_test_id UUID   -- Round 1 → aponta pro Round 2 criado
playoff_start_after TIMESTAMPTZ  -- cooldown 4h

-- ab_test_variants: novo campo
source_variant_id UUID -- Round 2 → aponta pra variante original do Round 1

-- UNIQUE: máx 1 playoff por teste
CREATE UNIQUE INDEX ab_tests_one_playoff_per_parent ON ab_tests (parent_test_id)
  WHERE parent_test_id IS NOT NULL;
```

### 5.6 RPC Transacional

`create_playoff_test(parent_id, variant_ids[2], cooldown_hours)` — função SECURITY DEFINER que:
1. Trava row do parent com `FOR UPDATE`
2. Valida condições
3. Cria teste Round 2 como `draft`
4. Clona as 2 variantes selecionadas
5. Liga parent → playoff bidirecionalmente
6. Tudo atômico — sem estado parcial

### 5.7 Fluxo no Cron

```
ab-evaluate cron:
  1. [NOVO] Auto-start: ativa drafts Round 2 cujo cooldown expirou
  2. [EXISTENTE] Avalia testes ativos (6 gates + auto-resolve)
  3. [NOVO] Playoff detection: busca testes inconclusivos elegíveis
     → calcula P(top2) → cria playoff → emite notificação
```

Advisory lock (`pg_try_advisory_xact_lock`) previne criação duplicada de playoffs em runs concorrentes.

### 5.8 Invariantes

1. Round 1 pode ter NO MÁXIMO 1 playoff
2. Round 2 NUNCA gera playoffs (sem cascata)
3. Round 2 inconclusivo = variantes equivalentes, resolve como-is
4. Original entra no Round 2 por mérito (não é hardcoded)
5. Dados do Round 2 começam do zero (sem carry-forward)
6. 4h cooldown entre Round 1 → Round 2

---

## 6. Riqueza de Informação — O Que Mostrar

### 6.1 Por Teste Individual

**Durante o teste (ativo):**
- Confidence trend chart (SVG polyline com threshold 95% dashed)
- Toggle "Dados Confirmados" vs "Estimativa Live"
- 4 KPI cards: CTR Lift, Link Click Lift, Impressões, Impacto Mensal Estimado
- Variant comparison cards (5 stats: Impressões, Clicks, CTR, Link Clicks, Link CTR)
- ABBA Timeline visual (dia a dia com variant colors)
- Funnel attribution (Impressão → View → Link Click → Conversão)
- Health indicator (↑ melhorando / ≈ estável / ↓ piorando)
- Next rotation date + ABBA cycle progress dots
- Round badge se é Round 1 ou Round 2

**Pós-conclusão:**
- Winner banner com lift % e confidence
- Final confidence chart completo
- Result metadata (monthly extra clicks estimate)
- Link para Playoff (se aplicável)
- Botões: Arquivar, Duplicar, Export

**Inconclusivo:**
- Amber banner com explicação
- Se elegível pra playoff: banner indicando playoff criado/agendado
- Se Round 2 inconclusivo: explicação "variantes equivalentes"

### 6.2 Cross-Test (Dashboard)

**KPI strip (4 cards):**
- Testes Ativos
- Confiança Média
- Win Rate (% de testes com vencedor declarado)
- CTR Lift Médio

**Após 3+ testes concluídos com vencedor:**
- Impacto cumulativo: total extra clicks/mês estimados
- Average CTR lift across tests
- Padrões vencedores (de VariantMetadata): quais tags, expressões, paletas vencem mais

**Coluna Round no dashboard:**
- "1/2" (tem playoff) ou "2/2" (é playoff) ou "—" (normal)
- Visual grouping: Round 2 indentado sob Round 1

### 6.3 Cross-Test Learning (Cowork)

O endpoint `/api/pipeline/youtube/ab-performance` agrega:
- Tags de thumbnail que mais vencem
- Padrões de título com melhor performance
- Emotional triggers mais eficazes
- Classificação hero/challenger/safety — qual performa melhor
- Correlações entre composição visual e CTR lift

Isso alimenta o prompt do brainstorm step: "Em X testes anteriores, thumbnails com close-up tiveram +Y% CTR."

### 6.4 Intelligence → A/B → Intelligence (Loop Fechado)

O ciclo completo:

```
1. Intelligence Engine scores vídeo → Grade D
2. Optimization Loop: unmonitored → flagged (2+ semanas C/D)
3. Cowork diagnostica via Pipeline API → diagnosed
4. Recomendação: "thumbnail_test" com confidence 0.88 → test_suggested
5. Notificação no CMS: "Oportunidade: Teste A/B de Thumbnail"
6. Usuário cria teste (wizard com brainstorm) → testing
7. Round 1 roda 14 dias → inconclusive (4 variantes sem clear winner)
8. Playoff Mode: top 2 selecionados por P(top2), Round 2 criado
9. Round 2 roda com 2 variantes → auto_resolve com winner B (+18% CTR)
10. Winner aplicado automaticamente → post_test_monitoring
11. Intelligence re-scores em 7/14/30 dias
12. Grade sobe para B → resolved (cooldown 60 dias)
```

### 6.5 Dados Únicos vs Competidores

| Dado | VidIQ/TubeBuddy | Nós |
|------|-----------------|-----|
| Thumbnail CTR A/B | Sim | Sim |
| Title A/B | Não | Sim |
| Description A/B | Não | Sim |
| Combo testing | Não | Sim |
| ABBA counterbalancing | Não | Sim |
| Bayesian + Z-test dual engine | Não | Sim |
| Link funnel attribution | Não | Sim (Links Engine) |
| Per-variant tracked links | Não | Sim |
| AI brainstorm integration | Básico | Full pipeline (Cowork) |
| Playoff mode | Não | Sim |
| 6-axis scoring + optimization loop | Não | Sim |
| Cross-test pattern learning | Não | Sim |
| Creative metadata (compositions, palettes) | Não | Sim |

---

## 7. Configuração e Automações

### 7.1 Settings por Site

```typescript
{
  default_duration_days: 14,        // 7-28
  default_confidence: 0.95,         // 0.80-0.99
  default_auto_apply: true,         // Aplicar winner automaticamente
  default_burn_in_days: 2,          // 0-3

  ctr_drop_trigger: {               // Auto-sugerir A/B quando CTR cai
    enabled: false,
    threshold_percent: 20,          // Queda de 20%+
    min_days_below: 7               // Por 7+ dias
  },

  post_publish_trigger: {           // Auto-sugerir A/B após publicar
    enabled: false,
    delay_hours: 48,                // Esperar 48h de dados
    requires_pipeline_thumbs: true  // Só se pipeline tem thumbs alternativas
  },

  notifications: {
    test_completed: true,
    test_auto_paused: true,
    ctr_drop_alert: false,
    daily_digest: false
  }
}
```

### 7.2 Rotation Patterns

3 opções: `abba` (default, counterbalanced), `round_robin` (sequencial simples), `random`.

### 7.3 Stability Threshold

Configurável 1-10 avaliações consecutivas. Default 3. Previne flip-flop — se confidence oscila entre 94% e 96%, o gate de stability não passa.

---

## 8. UI/UX Existente

### 8.1 Dashboard

- Summary strip: 4 KPI cards
- Drafts: accordion colapsável
- Active tests: grid de cards (máx 2 colunas)
- Completed list: tabela com filtros de data/outcome
- Header: "A/B Lab" + count badge + quota badge + settings gear + "New Test"
- Empty state: beaker icon + CTA

### 8.2 Videos Tab Integration

Coluna "A/B" entre Hidden e Pick. Estados: ineligible (Short = "—"), eligible ("Start A/B"), active (dot + day counter), paused (amber pill), completed ("+32%" green ou "= Original" muted).

Row expandível com painel de detalhes + pipeline badge.

### 8.3 Wizard (5 Steps)

1. **Tipo** — 4 cards (thumb/title/desc/combo). Cria draft imediatamente.
2. **Ideias** — Brainstorm com IA. 4 estados progressivos. Pode pular.
3. **Variantes** — Editor adaptativo por tipo. Auto-populado do Cowork.
4. **Config** — Duration, confidence, auto-apply, burn-in, rotation, stability.
5. **Revisar** — Side-by-side + YouTube Feed preview + config summary.

### 8.4 Test Detail

- Breadcrumb, status badge, action buttons contextuais
- Confidence hero (large % + trend)
- Data signal toggle (Confirmed vs Live)
- Variant comparison side-by-side
- ABBA rotation timeline
- Daily CTR chart (bar chart por dia por variante)
- YouTube verification badge
- Funnel attribution (para testes com links)

---

## 9. Infraestrutura Técnica

### 9.1 YouTube API

| Operação | Quota | Chamada |
|----------|-------|---------|
| `thumbnails.set` | 50 units | Upload de imagem |
| `videos.update` | 50 units | Título/descrição |
| `videos.list` | 1 unit | Verificação de thumbnail |
| YouTube Analytics `reports.query` | — | Backfill de dados |

Quota diária: 10.000 units. Com 3 testes rotacionando: ~153 units/dia.

### 9.2 Token Management

```
ab_tests.youtube_video_id
  → youtube_videos.channel_id
    → youtube_channels
      → social_connections (provider='youtube', não revogado)
        → ensureFreshToken() (decrypt + OAuth2 refresh)
```

### 9.3 Blob Storage

Thumbnails em Vercel Blob: `ab-test/{testId}/{variantLabel}.{ext}`. Retenção: indefinida enquanto ativo, 90 dias após completed, 30 dias após archived.

### 9.4 Safety

- External change detection: antes de rotacionar, verifica se thumbnail atual bate com o esperado. Mismatch → auto-pause + notificação.
- Token revogado → auto-pause + notificação.
- Quota exceeded → auto-pause todos os testes do canal, resume próximo dia.
- Advisory lock no cron evaluation (previne runs concorrentes).
- Draft cleanup cron às 04:00 UTC (drafts > 24h → archived).

---

## 10. MCP Server Integration

O MCP server expõe a tool `manage_ab_test` para o Cowork, permitindo:
- Criar testes
- Adicionar variantes (batch upsert)
- Consultar status e resultados
- Listar testes ativos/completed
- Acessar cross-test performance data

Isso permite que o Cowork opere o sistema A/B inteiramente via API, sem interação manual no CMS (exceto upload de thumbnails que é deliberadamente manual).

---

## 11. Phase 5: Competitors + Niche — PROVISIONAL

> **Status:** PROVISIONAL. This spec will be re-evaluated after Phases 1-4 are delivered and proven in real use. Do NOT begin implementation without passing the Decision Gate below.

### 11.1 Provisional Scope (subject to change)

- Track up to 20 competitor channels in the same niche
- 4h polling interval for new uploads and metadata changes
- pHash-based thumbnail change detection (detect when competitors swap thumbs)
- Niche benchmarking (compare own CTR/retention against tracked channels)
- Competitor thumbnail gallery as reference during AB test creation

### 11.2 Decision Gate — Re-evaluation Criteria

After Phases 1-4 are live for at least 30 days, evaluate:

**BUILD signal (all must be true):**

1. User has completed 5+ AB tests end-to-end (not just created — resolved with winner)
2. User visits AB Lab dashboard at least 3x/week on average
3. User has manually mentioned competitor thumbnails or asked "what are others doing?" in Cowork conversations
4. Auto-suggest from Intelligence Engine is generating suggestions the user actually acts on (>30% acceptance rate)

**DEFER signal (any one is sufficient):**

1. User has < 3 completed tests after 30 days (still learning the tool)
2. AB Lab dashboard visits < 1x/week average (not a daily driver yet)
3. Intelligence Engine auto-suggest acceptance rate < 15% (suggestions not useful — fix that first)
4. Outstanding P1-4 polish gaps identified during real use (fix those before adding scope)
5. User never organically asks about competitor behavior

### 11.3 Assumptions That May Be Wrong

| Assumption | Why it might be wrong | How P1-4 proves/disproves it |
|---|---|---|
| 20 channels is the right number | Too many = noise, too few = blind spots | If user struggles to name 5 competitors, 20 is overkill |
| 4h polling is the right frequency | Too frequent = quota waste, too slow = stale | Measure how often competitor data would actually change test decisions |
| pHash detects meaningful changes | Subtle edits (text overlay swap) may not register; platform compression adds noise | If user's own thumb swaps via AB rotate trigger false positives, pHash needs tuning first |
| User wants external reference points | Might prefer trusting own data exclusively | If user never references competitors in 30 days of active testing, this is unwanted complexity |

### 11.4 Minimum Viable Alternative

If the Decision Gate says DEFER but the user still wants lightweight competitor awareness:
- **Option A:** Manual screenshot upload to Cowork for one-off comparison (zero infra cost)
- **Option B:** Single "inspiration board" — user manually saves competitor thumbnails as reference images (Vercel Blob, no API polling)

These satisfy the need without the 20-channel polling + pHash infrastructure.
