# Prompt: Social Compositor Completion

## O que já existe e funciona

- **Hub**: Feed com filter chips, Calendar semanal, Queue com DnD, Drafts com AI badges — todos com dados reais
- **Compositor Em branco**: 4 destinos (IG Story, YT Community, FB Fanpage, IG Feed), cada um com compositor + preview dedicado, footer com Agora/Agendar/Fila
- **Compositor Do CMS**: Content picker visual com banner Cowork + tabs + items (mock data)
- **Canvas editor**: react-konva com 6 aspect ratios, 8 element types, video bg, story frames strip
- **Backend**: 9 server actions, 2 migrations, template CRUD + renderer, CMS→Social pipeline

## O que falta implementar

### Prioridade 1 — Wiring essencial

1. **Abrir canvas editor pelo compositor**: "Abrir editor" + clique no canvas area + clique no preview devem abrir o `SocialCanvasEditor` overlay. O canvas já existe em `canvas-editor/index.tsx` com `SocialCanvasEditorProps`. Precisa:
   - Montar `SocialCanvasEditor` condicionalmente quando `canvasOpen === true`
   - Passar `onExport` callback que salva o canvas no state e fecha
   - Travar aspect ratio pelo destino focado (ig_story=9:16, yt_community=1:1, fb/ig_feed=4:5)

2. **CMS Content Picker com dados reais**: Substituir `MOCK_CONTENT` por query real
   - Criar action `listRecentContent(siteId, filters)` que busca posts publicados de blog/newsletter/video nos últimos 30 dias
   - Wire no `cms-content-picker.tsx`

3. **Selecionar conteúdo CMS → auto-fill compositor**: Ao clicar num item do CMS picker:
   - Detectar idioma (PT/EN) do conteúdo
   - Auto-selecionar destinos baseado nas conexões ativas
   - Buscar template default via TemplateMatrix (contentType × destId)
   - Aplicar template no canvas (substituir variables {{title}}, {{url}}, etc.)
   - Gerar captions via `generateAICaption` por destino
   - Mostrar resultado no compositor para revisão

### Prioridade 2 — Canvas por destino

4. **Migration**: Add `4:5` ao CHECK constraint de `social_templates.aspect_ratio`
5. **Travar canvas no aspect ratio do destino**: Quando editing IG Story, canvas SEMPRE em 9:16. Sem selector de ratio livre.
6. **Template picker inline**: Ao abrir o canvas, mostrar templates disponíveis para o destino+contentType. Ex: "Blog → Story" templates em 9:16.

### Prioridade 3 — Publicação real

7. **Publicar de verdade**: Botão "Publicar" deve chamar `createSocialPost` ou `createFromContentAction` com os dados do compositor
8. **Agendar**: "Agendar" deve criar o post com `scheduled_at`
9. **Fila**: "Adicionar à fila" deve criar com `queue_position`
10. **Salvar rascunho**: Criar post com `status: 'draft'`

### Prioridade 4 — Separação de canvas

11. **Re-export paths**: Criar `links-admin/canvas-primitives` alias para imports limpos
12. **Não criar package novo**: Os 10 módulos compartilhados (hooks + inspectors + UI) ficam em links-admin, Social canvas fica em apps/web

## Referências no codebase

- Canvas editor: `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/`
- Template actions: `apps/web/src/lib/social/actions/templates.ts`
- Template renderer: `apps/web/src/lib/social/template-renderer.ts`
- CMS→Social pipeline: `apps/web/src/lib/social/create-from-content.ts`
- Caption variables: `apps/web/src/lib/social/caption-variables.ts`
- Template matrix settings: `apps/web/src/app/cms/(authed)/social/accounts/_components/template-matrix.tsx`
- Destinations: `apps/web/src/lib/social/destinations.ts`
- Compositor new: `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
- Dest compositor: `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx`
- CMS content picker: `apps/web/src/app/cms/(authed)/social/new/_components/cms-content-picker.tsx`

## Estimativa: ~40h total (Prioridade 1: 16h, P2: 10h, P3: 8h, P4: 6h)
