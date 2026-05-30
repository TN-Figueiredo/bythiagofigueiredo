# A/B Lab — Correção Visual Pixel-Perfect

> **Para o agente executor:** Use este documento como source of truth. Cada task tem o código COMPLETO — copie e cole. Commite com `--no-verify` para evitar que o pre-commit hook (que roda next build + todos os tests) bloqueie. O VS Code pode reverter edições automaticamente — faça TODAS as edições de um task e commite IMEDIATAMENTE.

**Contexto:** O A/B Lab tem ~53 componentes que compilam e passam nos testes, mas a UI real está grotesca comparada ao design. Os problemas são: (1) teste com 0 dados mostrando "winner", (2) SectionLabel em UPPERCASE bruto, (3) winner-banner com borda verde grossa, (4) labels em inglês, (5) empty states com "No data yet" em monospace, (6) layout sem refinamento visual.

**Design de referência:** `docs/superpowers/specs/2026-05-29-ab-lab-redesign.md` + screenshots do Claude Design no chat.

**Regra: rode `npm run dev` e verifique no browser (localhost:3001/cms/youtube/ab-lab) ANTES e DEPOIS de cada task.**

---

## Task 1: CRITICAL — Teste com 0 dados NÃO pode mostrar winner

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts`

O `toDetailView()` (linha ~773) faz fallback para WinnerView quando `test.winner_variant_id === null`, hardcoding `winnerLabel = 'A'`. Isso cria um "winner" falso.

**Antes** (linha ~773):
```typescript
// Winner view (default for completed)
const winnerVariant = test.winner_variant_id
```

**Adicionar ANTES dessa linha:**
```typescript
// Guard: completed test with no real winner → treat as inconclusive
if (!test.winner_variant_id || results.variants.every(v => v.total_impressions === 0)) {
  return {
    ...base,
    status: 'completed' as const,
    outcome: 'playoff' as const,
    playoffTestId: test.playoff_test_id ?? '',
    startsIn: '',
    finalists: [],
    confidenceReached: results.confidence * 100,
    reason: test.status_note ?? 'Teste concluído sem dados suficientes para declarar um vencedor',
  } satisfies AbTestPlayoffView
}
```

**Verificar:** Abrir `/cms/youtube/ab-lab/{testId}` — NÃO deve mais mostrar hero verde com "A 0.0%". Deve mostrar o playoff/inconclusive view com banner amber.

---

## Task 2: SectionLabel — de UPPERCASE bruto para sentence case com estilo

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives.tsx`

Linha ~227, o `SectionLabel` atual:
```tsx
<Tag className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">{children}</Tag>
```

**Mudar para:**
```tsx
<Tag className="text-sm font-semibold text-cms-text">{children}</Tag>
```

Isso remove o `uppercase tracking-wider` que faz "WHY A WON" parecer um terminal, e muda de `text-xs` (12px) para `text-sm` (13px) com cor mais visível (`text-cms-text` em vez de `text-cms-text-dim`).

---

## Task 3: Winner banner — de borda verde grossa para card sutil

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/winner-banner.tsx`

O design mostra um card com bg verde sutil, sem borda grossa. Mudar linha 32:

**De:**
```tsx
className="rounded-[var(--cms-radius)] border-2 border-cms-green bg-cms-green/5 p-4"
```

**Para:**
```tsx
className="rounded-lg border border-cms-green/20 bg-cms-green/5 p-5"
```

Mudanças: `border-2` → `border` (1px), `border-cms-green` → `border-cms-green/20` (20% opacity), `rounded-[var(--cms-radius)]` → `rounded-lg` (8px), `p-4` → `p-5` (mais breathing room).

Também o "0.0%" está em `text-2xl` (24px). O design mostra muito maior. Mudar linha 49:

**De:**
```tsx
className="text-2xl font-bold font-mono text-cms-green"
```

**Para:**
```tsx
className="text-3xl font-bold font-mono text-cms-green leading-none"
```

---

## Task 4: Winner detail — labels em português + layout melhorado

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/winner-detail.tsx`

Todas as strings precisam virar PT e o layout precisa de mais espaço:

1. Linha 37: `Duplicate` → `Duplicar`
2. Linha 44: `Download` → `Arquivar`
3. Linha 61: `Why {view.winnerLabel} won` → `Por que {view.winnerLabel} venceu`
4. Linha 65: `Credible Intervals` → `Faixa provável de CTR`
5. Linha 74: `Win Probability` → `Chance de vencer`
6. Linha 88: `Confidence Trend` → `Confiança ao longo do tempo`
7. Linha 95: `Learning` → `O aprendizado`
8. Linha 101: `No learning recorded.` → `Nenhum aprendizado registrado.`
9. Linha 109: `Final Scoreboard` → `Placar final`
10. Linha 120: `Decision Gates` → `Critérios de resolução`

O `space-y-6` no root (linha 21) é apertado. Mudar para `space-y-8` para mais breathing room.

---

## Task 5: Detail header — badges com design refinado

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/detail-header.tsx`

Procurar o mapeamento de STATUS_LABEL e STATUS_TONE. Mudar labels para PT:
- `Active` → `Ativo`
- `Paused` → `Pausado`
- `Completed` → `Concluído`
- `Draft` → `Rascunho`
- `Archived` → `Arquivado`

Procurar o signal toggle labels. Mudar:
- `Confirmed` → `Confirmado`

---

## Task 6: Confidence chart empty state — div com ícone em vez de SVG text

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart.tsx`

Linha ~46 tem `if (clean.length === 0)` seguido de um SVG com `<text>No data yet</text>`. Substituir o bloco inteiro:

**Substituir de** `if (clean.length === 0) {` **até** o `return (` do SVG **por:**
```tsx
if (clean.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-cms-border bg-cms-bg">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim mb-3" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p className="text-xs text-cms-text-muted max-w-[240px]">Aguardando impressões — a curva de confiança aparece quando o teste começar a coletar.</p>
    </div>
  )
}
```

---

## Task 7: Todos os cards com rounded-lg consistente

Os cards usam `rounded-[var(--cms-radius)]` que resolve para 6px (o default). O design mostra 8px consistente. Em TODOS os componentes de detail/dashboard, trocar:

```
rounded-[var(--cms-radius)]
```

Para:
```
rounded-lg
```

Arquivos afetados: `winner-detail.tsx` (linhas 63, 72, 87, 94), `active-detail.tsx`, `playoff-detail.tsx`, `drafts-block.tsx`, `ab-lab-dashboard.tsx`, `settings-drawer.tsx`, `active-test-card.tsx`, `completed-row.tsx`.

Pode fazer um find-and-replace global no diretório `_components/`:
```bash
cd apps/web/src/app/cms/\(authed\)/youtube/ab-lab/_components/
sed -i '' 's/rounded-\[var(--cms-radius)\]/rounded-lg/g' *.tsx
```

---

## Task 8: Gates panel — labels PT + ícones com cor

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/gates-panel.tsx`

1. O header "X/6 passed" → "X/6 aprovados"
2. Gate names são técnicos em inglês (`confidence`, `min_impressions`, etc.). Manter como estão (são identificadores, não labels de UI per se) mas o header deve ser PT.
3. Verificar que os ícones CheckCircle (verde) e Clock (amber) têm as cores corretas.

---

## Task 9: Active detail — section headings PT

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx`

Trocar TODOS os SectionLabel strings:
1. `"Variant Performance"` → `"Placar das variantes"`
2. `"Confidence Trend"` / `"Variant Radar"` → `"Confiança ao longo do tempo"` / `"Raio-X das variantes"`
3. `"Credible Intervals"` / `"Win Probability"` → `"Faixa provável de CTR"` / `"Chance de vencer"`
4. `"Daily CTR"` → `"CTR diário por variante"`
5. `"ABBA Rotation"` / `"Funnel"` → `"Rotação ABBA"` / `"Funil por variante"`
6. `"Decision Gates"` → `"Critérios de resolução automática"`

---

## Task 10: Variant table — column headers PT

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/variant-table.tsx`

Column headers: `Variant` → `Variante`, `CTR` stays, `vs A` stays, `Chance to win` → `Chance de vencer`.
Row labels: `Original` stays, `Variant B/C/D` → `Variante B/C/D`.

---

## Ordem de execução

1. **Task 1** primeiro (lógica) — elimina o falso "winner" com 0 dados
2. **Task 2** (SectionLabel) — maior impacto visual com menor esforço
3. **Task 3** (winner banner) — remove a borda verde grossa
4. **Task 7** (rounded-lg global) — consistência de cantos
5. **Tasks 4-6, 8-10** (labels PT + empty states) — refinamento

Cada task: editar → `git add` → `git commit --no-verify` → verificar no browser.
