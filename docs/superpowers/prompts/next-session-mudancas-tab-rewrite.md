# Prompt: Rewrite Mudanças Tab to Match Handoff

## Contexto

A aba Mudanças do Observatory (`apps/web/src/app/cms/(authed)/youtube/competitors/_components/mudancas-tab.tsx`) precisa ser reescrita para match exato com o handoff HTML. O usuario colou o HTML do prototipo com a estrutura desejada.

## Estrutura do Handoff (md-card)

Cada card de mudança no handoff tem esta estrutura:

```
.card.md-card (flex row):
  .change-rail (barra vertical colorida na esquerda, 4px width, cor do canal)
  .grow (conteudo):
    .row.between (header):
      .row (gap 8px, flex-wrap):
        Channel name (13px/600, cor do canal — cada canal tem cor unica)
        .badge (RotateCcw icon 11px + "N mudanças")
        .badge.amber (FlaskConical icon + "Provável A/B test") — quando 2+ mudanças em 14 dias
      .md-mark (bookmark toggle, Bookmark icon 15px, .on state com fill)
    
    Video title (14.5px/600, line-height 1.3)
    
    .row (gap 8px, margin-top 5px, flex-wrap):
      .mono.dim (11px): "{views} views · publicado há {time}"
      .md-summary (dim): "N trocas de thumbnail · N trocas de título"
    
    .md-latest:
      .section-label "Mudança mais recente"
      .md-ev (mudança mais recente):
        .badge.{color} (Thumbnail=purple/Título=blue/Descrição=amber + icon + text)
        .md-ev-ba.thumbs (thumbnail: mini antes→depois + zoom icon)
        OR .md-ev-ba.text (titulo: strike old → new + zoom icon)
        .mono.dim.md-ev-time: "há Xh"
    
    .md-history-toggle (ChevronRight + "Ver histórico completo (N)")
    
    .row (gap 8px, margin-top 14px):
      .btn.primary.sm (FlaskConical icon + "Testar esta abordagem")
```

## Diferenças Chave vs Atual

1. **change-rail**: barra vertical colorida na esquerda do card (cor unica por canal)
2. **Channel name colorido**: cada canal tem sua cor
3. **Badge de mudanças**: icon RotateCcw + "N mudanças" (nao tipo de mudança)
4. **Badge A/B test**: amber com FlaskConical quando 2+ mudanças em 14 dias
5. **Titulo do video**: 14.5px/600, proeminente
6. **Summary line**: "N trocas de thumbnail · N trocas de título · N trocas de descrição"
7. **"Mudança mais recente" section**: com section-label + evento mais recente
8. **Thumbnail events**: mini before/after com labels "antes"/"depois" + zoom icon (ZoomIn)
9. **Title events**: old text (strikethrough) → new text
10. **Testar esta abordagem**: btn primary sm com FlaskConical icon

## Dados Mock

Os mock data ja existem em `competitor-dashboard-v2.tsx` (MOCK_CHANGES com 6 items). Cada item tem: changeType, channelName, videoTitle, viewCountAtChange, detectedAt, bookmarked, oldTitle/newTitle, history array.

## CSS Classes Necessárias (adicionar ao youtube-motion.css)

```css
.md-card { display: flex; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); overflow: hidden; }
.change-rail { width: 4px; flex-shrink: 0; border-radius: 2px 0 0 2px; }
.md-latest { margin-top: 14px; }
.md-ev { display: flex; align-items: center; gap: 8px; }
.md-ev-ba.thumbs { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.md-ev-ba.text { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.md-mini.thumb { width: 64px; height: 36px; border-radius: 6px; border: 1px solid var(--border-subtle); }
.ba-strike { text-decoration: line-through; color: var(--red); }
.ba-new { color: var(--green); }
.md-summary { font-size: 11px; color: var(--text-dim); }
.md-history-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); cursor: pointer; margin-top: 10px; }
.md-ev-time { font-size: 10.5px; margin-left: auto; }
.badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 500; padding: 2px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-muted); }
.badge.purple { background: var(--purple-soft); color: var(--purple); }
.badge.blue { background: var(--blue-soft); color: var(--blue); }
.badge.amber { background: var(--amber-soft); color: var(--amber); }
```

## Arquivo a reescrever

`apps/web/src/app/cms/(authed)/youtube/competitors/_components/mudancas-tab.tsx`

O zoom modal que ja existe deve ser preservado — so a lista de cards muda.
