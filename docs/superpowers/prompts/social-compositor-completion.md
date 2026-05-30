# Prompt: Social Compositor Completion (v2 — revisado)

> Revisado com 62 issues encontradas por 4 agentes revisores independentes.

## Bugs P0 — Corrigir ANTES de qualquer feature nova

### B1. Caption state destruída ao trocar destino (~2h)
`key={focused}` em `<DestCompositor>` causa unmount/remount, perdendo todo texto digitado.
**Fix:** Levantar `captions: Record<DestId, string>` para `CompositorNew`. Passar `caption` + `onCaptionChange` como props. Remover `key={focused}`.

### B2. Drawer intercepta rotas de sub-páginas (~30min)
`@drawer/(.)[id]` tenta carregar "new" como post ID.
**Fix:** Validar `id` como UUID antes de fazer fetch. Se não UUID, retornar null. Remover a exclusion list hardcoded.

### B3. Schedule picker com datas hardcoded (~2h)
`['Hoje', 'Amanha', 'Qua 31', ...]` é estático — errado todo dia.
**Fix:** Computar labels dinamicamente com `new Date()` + `Intl.DateTimeFormat('pt-BR')`. Armazenar `Date` objects, não indices.

### B4. Queue slots hardcoded (~1h)
`amanha 09:00`, `amanha 19:00` são estáticos.
**Fix:** Chamar `getNextQueueSlotAction()` no mount e popular com dados reais.

## Cleanup — Dead code e inconsistências

### C1. Deletar 3 compositors mortos (~30min)
`composer-shell.tsx` (807L), `composer-shell-v2.tsx` (296L), `use-composer-persistence.ts` — nenhum importado.
**Fix:** Deletar. Migrar lógica testada do `useComposer` para o state do `CompositorNew`.

### C2. Extrair PlatformIcon compartilhado (~2h)
Mesmo SVG duplicado em accounts-strip-client, feed-card, calendar-week-view, queue-list, drafts-list, destination-picker, dest-compositor, cms-content-picker (~90 linhas x 8 arquivos).
**Fix:** Criar `_components/shared/platform-icon.tsx` com props `provider`, `size`, `variant` ('solid'|'outline'|'chip'|'mini').

### C3. DraftsList: lucide-react → inline SVGs (~30min)
Único componente que importa lucide-react. Causa strokeWidth inconsistente.
**Fix:** Substituir Sparkles/Settings/ArrowRight por inline SVGs matching o design system.

### C4. CSS hardcoded → variáveis (~1h)
`rgba(16,14,11,0.92)`, `rgb(12,11,9)`, `rgb(18,16,12)` — não adaptam a temas.
**Fix:** Usar `var(--surface)` com alpha, ou Tailwind `bg-[rgba(...)]` arbitrary values.

## Prioridade 1 — Wiring essencial (~20h)

### P1.1. Publish action real (~4h)
Botões "Publicar/Agendar/Fila/Salvar rascunho" não têm onClick.
**Fix:** Importar `createSocialPost` diretamente (pattern 'use server' → 'use client' funciona). Construir payload de captions + destinations + schedule. Chamar action. Mostrar PublishFlow com Supabase Realtime (não setTimeout fake).

### P1.2. DestId→Provider mapping correto (~3h)
`createSocialPost` aceita `Provider[]`, não `DestId[]`. IG Story + IG Feed ambos mapeiam para 'instagram' = 1 delivery.
**Fix:** Ou (a) criar `createSocialPostV2` que aceita `destinations: DestId[]` e cria deliveries por destino, ou (b) passar `deliveryFormats: Record<Provider, string>` com `storyMode`/`feedMode` flags.

### P1.3. CMS Content Picker com dados reais (~4h)
Mock data hardcoded. Sem API de listagem.
**Fix:** Criar action `listRecentContent(siteId, contentType?, limit?)` que busca blog_posts + newsletter_editions + youtube_videos publicados nos últimos 30 dias. Wire no picker com loading/empty/error states.

### P1.4. CMS Content → Auto-fill compositor (~6h)
Ao selecionar conteúdo no CMS picker, nada acontece.
**Fix:** Implementar sequência: detectar idioma → auto-selecionar destinos (baseado em conexões ativas) → buscar template default via TemplateMatrix → aplicar template ao canvas state → gerar captions via `generateAICaption` por destino → mostrar resultado para revisão. Tratar cada step failure (partial state é OK).

### P1.5. Best times reais no schedule (~2h)
Horários "best" são hardcoded.
**Fix:** Chamar `getBestTimes()` no mount do footer quando `schedMode === 'schedule'`. Popular os time chips com dados reais.

## Prioridade 2 — Canvas integration (~14h)

### P2.1. Abrir canvas editor (~6h)
"Abrir editor" + clique no canvas + clique no preview devem abrir o `SocialCanvasEditor` em overlay fullscreen.
**Fix:** Montar condicionalmente quando `canvasOpen === true`. Travar aspect ratio pelo destino focado. Callbacks: `onExport` salva blob → state, `onUseInPost` fecha overlay. Wire `onImageUpload` (Vercel Blob) e template data.

### P2.2. Migration aspect ratio 4:5 (~1h)
DB CHECK constraint e `template-schemas.ts` não incluem `4:5`.
**Fix:** `npm run db:new social_template_4_5`. Atualizar CHECK + TypeScript type + `CANONICAL_SIZES`.

### P2.3. Template picker per-destination (~4h)
Ao abrir canvas, mostrar templates disponíveis para destId + contentType.
**Fix:** Filtrar `social_templates` por `aspect_ratio` matching o destino. Mostrar carousel no left panel.

### P2.4. Canvas per-destination locked (~3h)
Quando editando IG Story, canvas SEMPRE em 9:16 — sem selector de ratio.
**Fix:** Ocultar `SOCIAL_ASPECT_RATIOS` selector. Setar ratio automaticamente baseado em `DestId`.

## Prioridade 3 — User journeys faltantes (~12h)

### P3.1. Edit post flow (~6h)
Não existe `/cms/social/[id]/edit`. User salva rascunho mas nunca volta.
**Fix:** Criar rota que carrega `social_posts` por ID e hydrata o compositor com dados existentes (captions, design, schedule).

### P3.2. PublishFlow real (~4h)
`publish-flow.tsx` usa setTimeout fake.
**Fix:** Substituir por Supabase Realtime on `social_deliveries` status changes. Mostrar resultado real por destino (sucesso/erro com mensagem).

### P3.3. Duplicate post detection (~2h)
User pode criar posts duplicados pro mesmo conteúdo CMS.
**Fix:** Ao selecionar conteúdo no picker, verificar `social_posts` com mesmo `source_content_id`. Se existir, mostrar warning "Este conteúdo já tem um [rascunho/agendado] — abrir?"

## Prioridade 4 — Quality polish (~10h)

### P4.1. Mobile responsiveness (~4h)
Preview column hidden em mobile. Sem fallback.
**Fix:** Toggle button "Preview" em mobile que abre modal/sheet.

### P4.2. Testes dos novos componentes (~4h)
Zero testes para CompositorNew, DestCompositor, DestinationPicker, CMSContentPicker.
**Fix:** Testar: destination toggle/focus, caption por destino, schedule mode, content selection.

### P4.3. Visual consistency polish (~2h)
- strokeWidth inconsistente (1.7 vs 2 vs 3)
- Bluesky icon faltando em 4 componentes
- DraftsList text-white vs text-[#1a120c]
- Font sizes fora do sistema (9.5px, 17px)
- Transition timing mismatch (150ms vs 180ms)

## O que NÃO fazer (removido do plano anterior)

- ❌ **Não criar `social_delivery_metrics` table** — `post_metrics` já existe com cron funcional
- ❌ **Não criar package `@tn-figueiredo/canvas`** — re-export alias basta, premature optimization
- ❌ **Não mudar cron de 4h para 30min** — rate limits das APIs impedem, 4h é correto
- ❌ **Não adicionar Bluesky ao destinations.ts** — gap conhecido para v2

## Estimativa revisada: ~62h total
- Bugs P0: 6h
- Cleanup: 4h
- P1 Wiring: 20h
- P2 Canvas: 14h
- P3 Journeys: 12h
- P4 Quality: 10h

## Referências atualizadas

### Files a criar:
- `_components/shared/platform-icon.tsx` (compartilhado)
- `actions/list-recent-content.ts` (nova action)
- `[id]/edit/page.tsx` (edit route)

### Files a deletar:
- `composer-shell.tsx` (807L dead code)
- `composer-shell-v2.tsx` (296L dead code)

### Files a modificar significativamente:
- `compositor-new.tsx` — caption state lifted, publish wiring, dynamic schedule
- `dest-compositor.tsx` — receive caption as prop, canvas integration
- `cms-content-picker.tsx` — real data, onSelect callback
- `@drawer/(.)[id]/page.tsx` — UUID validation
- `template-schemas.ts` — add 4:5
- `publish-flow.tsx` — real Supabase Realtime
