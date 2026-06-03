# YouTube System Fix — Implementation Plan

**Generated:** 2026-06-03
**Scope:** 38 achados de auditoria + 6 testes falhando + cobertura de testes
**Total estimado:** ~60h

---

## Estado Real dos Testes (corrigido)

A análise inicial rodou Vitest do root — o estado real rodando de `apps/web/`:
- **62 pass / 6 fail / 2 skip** (70 test files)
- Os 6 fails são lógica de teste desatualizada, NÃO module resolution
- Zero mudanças necessárias no `vitest.config.ts`

---

## Fase 0 — Quick Wins (≤1h cada)

### 0A. Dead code cleanup (~30min)
Deletar 8 items confirmados como dead code — ~1.216 linhas:

**Arquivos para deletar:**
- `competitors/_components/competitor-dashboard.tsx` (421 lines, v1 substituído por v2)
- `competitors/_components/competitor-tabs.tsx` (42 lines, nunca importado)
- `lib/youtube/fixtures/ab-fixtures.ts` (77 lines, 0 imports)
- `lib/youtube/fixtures/observatory-fixtures.ts` (369 lines, 0 imports)
- `lib/youtube/fixtures/performance-fixtures.ts` (74 lines, 0 imports)
- `fixtures/` directory (vazio após deleções)
- `test/youtube/ab-step-revisar.test.tsx.bak` (154 lines, .bak)

**Funções/constantes para remover:**
- `StatBox` + `VsPill` em `channel-drawer.tsx` (linhas 582-610)
- `DEFAULT_BENCHMARKS` + `NOTIFICATION_TRIGGER_RULES` em `intelligence-types.ts`

### 0B. Minor fixes batch (~26min)
8 fixes em um commit:

1. **`logPromptCopy` no-op** → deletar função + deletar `use-prompt-copy.ts`
2. **`updateComment` sem Zod** → adicionar `CommentSchema.partial().parse(input)`
3. **`reorderCategories` unused** → deletar função
4. **Coaching diagnostics static** → adicionar TODO comment documentando intenção
5. **Feature flag dead fallback** → deletar `use-redesign-screen.ts` + remover condicional
6. **Comentários "placeholder" enganosos** → renomear para "always valid — step is optional"
7. **Deprecated alias** → deletar `computeReachDiversityForBaseline` (0 callers em prod)
8. **PLACEHOLDER_KPIS naming** → renomear para `NEW_CHANNEL_KPIS`

### 0C. Mock data em prod bundle (~30min)
- Deletar 3 fixture files + directory (já feito em 0A)
- Converter import estático de `mock-views.ts` para dynamic import gated por `NODE_ENV`
- `mock-dashboard.ts` → mover para `test/helpers/` (usado por `ab-low.test.ts`)

---

## Fase 1 — Dados Fake Visíveis ao Usuário (CRITICAL)

### 1A. DEMO_NOTES → persistência real (~5h)
**Migration:** `npm run db:new youtube_notes`
```sql
CREATE TABLE youtube_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 5000),
  is_bot BOOLEAN NOT NULL DEFAULT false,
  source TEXT CHECK (source IS NULL OR source IN ('manual','cowork','cron')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**Server actions:** `listNotes`, `createNote`, `deleteNote` em `analytics/actions.ts`
**Component:** Remover `DEMO_NOTES`, wire `NotesView` com props reais
**Testes:** 14 tests (9 unit + 5 component)

### 1B. Math.random() no video-modal (~50min)
- Deletar `TrendChart` inteiro (~70 linhas) — dados de time-series não existem para vídeos de competidores
- Deletar CTR fabricado (`3.4 + mult * 0.7`) — YouTube não expõe CTR de terceiros
- Substituir por métrica "idade" (dias desde publicação) — dado real
- Net: -78 linhas, +8 linhas

### 1C. toast.success mentiroso no GapsCard (~30min)
- Wire `handleGapClick` para `createPipelineItem` real
- Track `addedTopics` com Set para disable após click
- `useTransition` para prevenir double-click

---

## Fase 2 — Features Stub / Desconectadas (HIGH)

### 2A. Video Optimizer: 8 campos stub (~5h)
- Adicionar 4 queries paralelas: peer videos, daily analytics, grade history, optimization cycles
- Usar `computeBaseline()` + `scoreVideo()` + `computeTrend()` existentes
- Zero migrations — todas as tabelas/colunas já existem
- 12 testes unitários

### 2B. Content Calendar + Channel Health: 9 campos stub (~8h)
- Novo helper: `lib/youtube/prompt-query-helpers.ts` com 6 funções puras
- ContentCalendar: `topPerformingCategories`, `outlierSuccesses`, `bestPerformingDay`, `bestPerformingHour`
- ChannelHealth: `healthScore`, `trend`, `outliers`, `abTestResults`, `cyclesSummary`
- ~9 queries adicionais (batched em Promise.all)
- Thresholds mínimos para evitar recomendações ruidosas (2 para categorias, 7 para dias, etc.)

### 2C. Notification bell — migrar para sistema genérico (~7h)
**Fase 1:** Deletar bell específico do YouTube (2 arquivos) + remover CSS hide
**Fase 2:** Migrar 3 cron writers de `yt_notifications` → `notifications` table
**Fase 3:** (futuro) Drop `yt_notifications` table
- Criar helper `getSiteAdminUserIds()` para fan-out
- O generic CMS bell já existe e funciona

### 2D. "Pedir diagnostico ao Cowork" → wire existente (~15min)
- Substituir toast por `handleRequestAnalysis` que já existe no mesmo arquivo
- Adicionar disabled state + label dinâmico

### 2E. Competitor history sempre vazio (~3h)
- Agrupar `competitor_changes` por `video_id` no server-side (zero query changes)
- ZoomModal CTA: navegar para `/cms/youtube/ab-lab/new` com query params
- AB Lab new page: aceitar `ref=competitor&changeType=thumbnail` etc.

---

## Fase 3 — UX Enganosa / Placeholders (MEDIUM)

### 3A. 3 botões "em breve" no InsightsTab (~2h20min)
- PlayCard "Montar roteiro" → disable com tooltip
- "Roteirizar lacunas no Cowork" → disable com tooltip
- "Testar tema de maior tração" → navegar pro AB Lab
- CadenceCard insight hardcoded → computar dinâmicamente com algoritmo de peak detection
- ZoomModal CTA → navegar pro AB Lab com context toast

### 3B. Analytics toast-only buttons (~2h)
- Coach "Aplicar": CTR → navigate AB Lab; outros → toast honesto "Ação anotada"
- Search Terms "Criar roteiro" → wire para `createPipelineItem` + navigate para edit
- Outliers "Criar A/B Test" → navigate como grades-v2 faz

### 3C. AB Lab UI stubs (~2h40min)
- PLACEHOLDER_TAKES (fake frames) → remover
- "regerar" link no-op → remover
- Filter button → implementar type filter dropdown
- "ver todos" button → implementar expand/collapse
- "quota 1,5% hoje" → remover (YouTube API não expõe quota)
- Pause/End Test menu → wire para `pauseAbTest`/`endAbTest` com confirmação

---

## Fase 4 — Testes

### 4A. Corrigir 6 testes falhando (~3-4h)

| Arquivo | Root cause | Fix |
|---------|-----------|-----|
| `ab-youtube.test.ts` | URL allowlist validation | Atualizar URLs de teste |
| `ab-detail-active.test.tsx` | Missing `LayoutGrid` mock | Adicionar ao mock lucide-react |
| `ab-detail-winner.test.tsx` | Component redesign | Atualizar assertions |
| `ab-apply-metadata.test.ts` | Return shape changed | Atualizar tipo esperado |
| `competitor-sync.test.ts` | Mock faltando `.or()` | Adicionar ao mock chain |
| `social-youtube-enhancements.test.tsx` | View count format | Atualizar assertion |

### 4B. Novos testes para fixes (~3.5h — Priority 1)
- `yt-analytics-tabs-logic.test.ts` — computeRadarData, computeCoachingCards
- `search-terms-logic.test.ts` — estimateCtr, estimateTrend
- `outliers-v2-logic.test.ts` — toDisplay, tier classification
- `prompt-actions-save-notes.test.ts` — Zod, version conflict, revalidation

### 4C. Testes de core happy paths (~17h — Priority 2)
8 novos test files cobrindo os componentes com zero coverage:
- `yt-analytics-tabs.test.tsx`
- `notes-view.test.tsx`
- `yt-health-coach.test.tsx`
- `mudancas-tab.test.tsx`
- `video-modal.test.tsx`
- `insights-tab.test.tsx`
- `ab-lab-dashboard.test.tsx`
- `prompt-actions-full.test.ts`

### 4D. Edge cases (~6.25h — Priority 3)
5 test files adicionais para estados vazios, erros, loading.

### 4E. Coverage threshold
Adicionar ao `vitest.config.ts`:
```typescript
'src/lib/youtube/**': { lines: 75, functions: 75, branches: 65 },
```

---

## Ordem de Execução Recomendada

```
Fase 0 (≤2h)     → Quick wins, sem risco
  ↓
Fase 4A (3-4h)   → Rede de segurança: 6 testes falhando corrigidos
  ↓
Fase 1 (≤7h)     → Critical: dados fake removidos
  ↓
Fase 2 (≤26h)    → High: stubs populados com dados reais
  ↓
Fase 3 (≤7h)     → Medium: UX corrigida
  ↓
Fase 4B-D (≤27h) → Test coverage expandida
```

## Resumo de Esforço

| Fase | Horas | Items |
|------|-------|-------|
| 0 - Quick wins | ~2h | Dead code + minor fixes + mock cleanup |
| 1 - Critical | ~7h | DEMO_NOTES + Math.random + toast mentiroso |
| 2 - High | ~26h | Prompt stubs + notification bell + competitor history |
| 3 - Medium | ~7h | Toast buttons + AB Lab stubs + insights |
| 4 - Tests | ~30h | Fix 6 fails + P1/P2/P3 coverage |
| **Total** | **~60h** | **38 achados + testes** |

## Migrations Necessárias

| # | Nome | Tabela |
|---|------|--------|
| 1 | `youtube_notes` | Nova tabela para notas do Analytics |

Todas as outras mudanças usam tabelas/colunas existentes.
