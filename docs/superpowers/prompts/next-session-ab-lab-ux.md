# Prompt: AB Lab Observatory — UX Polish Session

Cole isso no início da próxima sessão do Claude Code.

---

## Contexto

A sessão anterior (2026-05-31) implementou o AB Lab Observatory completo: 7 fases (P1-P7), 204+ testes, 15 migrations, ~10K linhas. O backend está sólido (91/100), mas a experiência do usuário tem gaps sérios (42/100 na avaliação do usuário).

**Spec:** `docs/superpowers/specs/2026-05-31-ab-lab-observatory-design.md`
**P7 status:** Itens 7.1-7.18 no spec, 14 DONE, 3 PARTIAL, 2 DEFERRED
**Memory:** `.claude/projects/.../memory/project_ab_lab_observatory_status.md`

## Regra fundamental desta sessão

**TESTE CADA MUDANÇA NO BROWSER ANTES DE PROSSEGUIR.** Rode `npm run dev` e verifique visualmente. Não confie só em typecheck — a sessão anterior provou que typecheck ≠ funcional.

## O que precisa ser feito (priorizado)

### P0 — Verificar se fixes da última sessão funcionam

1. Abra `/cms/youtube` — avatares dos canais carregam? (fix: `referrerPolicy="no-referrer"`)
2. Abra `/cms/youtube/competitors` — busque "Nomade Raiz" — thumbnails na dropdown carregam?
3. Abra `/cms/settings` — a seção "YouTube" foi REMOVIDA do sidebar de Settings?
4. No channel card em `/cms/youtube` — "⚙ Configurar" expande posting schedule inline?
5. No channel card — botão "Reconectar Token" abre popup OAuth?

Se QUALQUER um falhar, corrija ANTES de prosseguir.

### P1 — Competitor Observatory é oco (CRÍTICO)

Problema: Adicionar um canal mostra só o Channel ID e "subs" genérico. Nenhum valor real.

O que deve acontecer ao adicionar um competidor:
1. **Sync imediato** — ao clicar no resultado da busca, chamar `syncCompetitorNow()` automaticamente (não esperar cron)
2. **Mostrar dados do canal** — nome, avatar, subscriber count, video count (já vem do sync)
3. **Mostrar últimos 3 vídeos** com thumbnails — os dados já estão em `competitor_videos` após sync
4. **Revalidar a página** após sync para mostrar dados frescos

Arquivos:
- `src/app/cms/(authed)/youtube/competitors/_components/competitor-dashboard.tsx` — UI
- `src/app/cms/(authed)/youtube/competitors/actions.ts` — `addCompetitorChannel`, `syncCompetitorNow`
- `src/lib/youtube/competitor-sync.ts` — sync logic
- `src/app/cms/(authed)/youtube/competitors/page.tsx` — server data fetch

### P2 — Mock data vazando em produção

Problema: `src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx` tem `MOCK_MAP` que renderiza dados fake para IDs como `mock-active-1`. O dashboard (`mock-dashboard.ts`) alimenta esses IDs. Usuários sem testes reais veem dashboard populado com dados falsos.

Fix: Envolver `MOCK_MAP` em `if (process.env.NODE_ENV === 'development')`. Em produção, mostrar empty state.

### P3 — Botões mortos

Estes botões renderizam mas não fazem nada:
- `active-detail.tsx`: "Pausar", "⚙ Settings" (linhas ~147-153)
- `winner-detail.tsx`: "Duplicar", "Arquivar", "Download" (linhas ~41-49)
- `ab-lab-dashboard.tsx`: "Todos os tipos" filter

Fix: Adicionar `disabled className="opacity-50 cursor-not-allowed"` + `title="Em breve"`. Ou remover se não planejado.

### P4 — Hardcoded strings

- `ab-lab-dashboard.tsx` linha ~150: `"quota 1,5% hoje"` — remover ou computar real
- `winner-detail.tsx` linha ~107: `"93% de chance"` — usar `view.confidence`
- `active-test-card.tsx` linha ~139: "variante ---" e "Proxima rotacao ---" — computar real ou esconder

### P5 — Library tag editing

`updateLibraryTags` action existe mas sem UI. Adicionar botão edit em cada card que abre inline tag editor.

### P6 — Competitor loading states

`syncCompetitorNow` e `removeCompetitorChannel` sem loading state. Adicionar `useTransition` + spinner.

### P7 — `removeCompetitorChannel` sem confirmação

Ação destrutiva sem `window.confirm`. Adicionar dialog.

## Arquivos-chave para esta sessão

```
src/app/cms/(authed)/youtube/competitors/_components/competitor-dashboard.tsx
src/app/cms/(authed)/youtube/competitors/actions.ts
src/app/cms/(authed)/youtube/competitors/page.tsx
src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx
src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx
src/app/cms/(authed)/youtube/ab-lab/_components/winner-detail.tsx
src/app/cms/(authed)/youtube/ab-lab/_components/active-test-card.tsx
src/app/cms/(authed)/youtube/ab-lab/_components/mock-dashboard.ts
src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx
src/app/cms/(authed)/youtube/ab-lab/library/_components/library-dashboard.tsx
src/app/cms/(authed)/youtube/dashboard-connected.tsx
src/lib/youtube/competitor-sync.ts
```

## Como trabalhar

1. Rode `npm run dev` no início
2. Faça UMA mudança por vez
3. Verifique no browser
4. Se funcionar → commit
5. Se não → corrija antes de prosseguir
6. NÃO use sub-agents em paralelo para mudanças no mesmo arquivo
7. Priorize o que o USUÁRIO VÊ sobre o que o código diz
