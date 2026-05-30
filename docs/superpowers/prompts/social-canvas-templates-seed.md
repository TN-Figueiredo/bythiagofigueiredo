# Prompt: Social Canvas Templates — Seed + Editor Wiring

## Contexto

O fluxo "Do CMS" precisa de templates reais para gerar a arte automaticamente. O design mostra um template "Blog → Story" com elementos específicos posicionados no canvas. Hoje esses templates não existem no DB — precisam ser criados como seed data.

## O que criar

### Template 1: "Blog → Story" (9:16, 1080x1920)

Composition JSONB com estes elementos (de baixo pra cima):

1. **Background**: `linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))` — tom editorial creme
2. **Moldura editorial**: border 1px `rgba(31,27,23,0.25)` inset 5%, border-radius 4px
3. **Kicker**: mono font, 13px, tracking 0.22em, cor `rgb(154,107,63)`, border dourada, posição top 13%
   - Text variable: `{{kicker}}` (default: "NO BLOG")
4. **Título**: Fraunces serif, 46px, weight 700, cor `rgb(31,27,23)`, posição top 28%
   - Text variable: `{{title}}`
5. **Capa do post**: Imagem ou gradient placeholder, 70% width, 26% height, posição center 56%
   - Image variable: `{{cover_image}}`
6. **Sticker de link**: Botão branco com sombra, "LER O POST" + link icon, posição center 80%
   - Hardcoded text (não é variável — sempre "LER O POST")
7. **Carimbo TF**: Círculo com border accent, iniciais "TF", posição center bottom 92%
   - Text variable: `{{initials}}` (default: site initials)

### Template 2: "Blog → Fanpage" (4:5, 1080x1350)
Mesma estrutura mas adaptada para 4:5. Título maior, sem reply bar.

### Template 3: "Blog → Comunidade" (1:1, 1080x1080)  
Quadrado, sem sticker de link (YT Community não suporta links clicáveis na imagem).

### Template 4: "Newsletter → Story" (9:16, 1080x1920)
Similar ao Blog → Story mas com kicker "NEWSLETTER WEEKLY" e elementos da newsletter.

## Como criar no DB

### Migration
```bash
npm run db:new social_seed_templates
```

```sql
-- Primeiro: adicionar 4:5 ao CHECK constraint
ALTER TABLE social_templates DROP CONSTRAINT IF EXISTS social_templates_aspect_ratio_check;
ALTER TABLE social_templates ADD CONSTRAINT social_templates_aspect_ratio_check
  CHECK (aspect_ratio IN ('9:16', '1:1', '16:9', '4:5'));

-- Depois: INSERT templates com composition JSONB
INSERT INTO social_templates (site_id, name, aspect_ratio, composition, is_default, thumbnail_url)
VALUES
  (NULL, 'Blog → Story', '9:16', '...composition JSON...', true, NULL),
  (NULL, 'Blog → Fanpage', '4:5', '...composition JSON...', false, NULL),
  (NULL, 'Blog → Comunidade', '1:1', '...composition JSON...', false, NULL),
  (NULL, 'Newsletter → Story', '9:16', '...composition JSON...', false, NULL);
```

A composition JSONB deve seguir o `CardCompositionSchema` de `packages/links/src/qr/card-composition.ts`:
```typescript
{
  canvas: { width: 1080, height: 1920 },
  background: { type: 'solid', color: '#f7f1e8' }, // ou gradient
  elements: [
    { id: 'kicker', type: 'text', content: '{{kicker}}', ... },
    { id: 'title', type: 'text', content: '{{title}}', ... },
    { id: 'cover', type: 'image', src: '{{cover_image}}', ... },
    { id: 'sticker', type: 'text', content: 'LER O POST', ... },
    { id: 'logo', type: 'text', content: '{{initials}}', ... },
  ]
}
```

## Canvas editor wiring

### Abrir editor pelo compositor (P2.1)

No `dest-compositor.tsx`, quando "Abrir editor" é clicado:

1. Montar `SocialCanvasEditor` em overlay fullscreen
2. Travar aspect ratio pelo destino focado
3. Se template existe, carregar como `initialComposition`
4. Se `{{title}}` e `{{cover_image}}` estão presentes, substituir com dados do CMS content selecionado
5. `onExport` → salvar imagem no state + fechar overlay
6. `onUseInPost` → mesma coisa

### Template resolver

Usar `template-renderer.ts` que já tem:
- `resolveTemplateForPost()` — busca template por aspect ratio
- Variable interpolation — substitui `{{title}}`, `{{description}}`, etc.
- Server-side Konva rendering — gera PNG thumbnail

## Referências

- Canvas editor: `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx`
- Template CRUD: `apps/web/src/lib/social/actions/templates.ts`
- Template renderer: `apps/web/src/lib/social/template-renderer.ts`
- Konva renderer: `apps/web/src/lib/social/konva-renderer.ts`
- Card composition schema: `packages/links/src/qr/card-composition.ts`
- Caption variables: `apps/web/src/lib/social/caption-variables.ts`
- Template schemas: `apps/web/src/lib/social/template-schemas.ts` (precisa add '4:5')

## Estimativa: ~12h
- Migration + seed templates: 4h
- Canvas editor wiring (overlay, aspect lock, callbacks): 6h
- Template auto-apply on CMS content select: 2h
