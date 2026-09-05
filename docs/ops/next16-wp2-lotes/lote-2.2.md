> **SUPERADO EM 2026-09-05.** Os perfis registrados aqui foram todos trocados por
> `{ expire: 0 }` — perfil nomeado serve conteudo velho e nao e paridade com o Next 15.
> Ver `CORRECAO-perfis-vs-paridade.md`. A medicao de leitores continua valida.

# Lote 2.2 — YouTube

Expectativa registrada ANTES de tocar código. Leitor medido vem de
`docs/ops/next16-wp2-lotes/leitores.md` (passo 2.0) — nenhuma tag foi classificada por
inferência de nome.

## Tags do lote (auditadas contra `revalidateTag(...)` de cada arquivo)

| Tag | Leitor (de leitores.md) | Função | Perfil | Por quê |
|---|---|---|---|---|
| `youtube` | `apps/web/src/app/cms/(authed)/youtube/page.tsx:122`, `apps/web/src/lib/youtube/queries.ts:124`, `apps/web/lib/home/queries.ts:282,328,393,411` — todos `unstable_cache(` | `revalidateTag` (mesmo dentro de Server Actions) | `'seconds'` | Tag de hub/dashboard de staff nomeada explicitamente na generalização do wp2-rules.md ("Toda tag cujo alvo é superfície de CMS compartilhada entre staff... inclui, por nome: ... `youtube`"). Quem salva um vídeo/categoria/comentário não é o único que lê o dashboard — outro membro do staff olhando a mesma tela precisa ver o dado atualizado, então nunca `updateTag`. |
| `layout-counts` | `apps/web/lib/cms/layout-counts.ts:37` — `unstable_cache(` | `revalidateTag` | `'seconds'` | Contador de navegação compartilhado entre staff — caso explícito do wp2-rules.md ("Contadores de navegação compartilhados entre staff — `sidebar-badges` e `layout-counts`"). Mesmo no cron (Route Handler), o leitor decide o perfil, não o contexto: `'seconds'`, nunca `{ expire: 0 }` (exemplo idêntico já resolvido no wp2-rules.md para este mesmo caso). |
| `ab-tests` | sem leitor (`docs/ops/next16-wp2-lotes/orfas.txt` confirma) | `revalidateTag` | `'seconds'` (fallback) | Órfã — candidata a remoção. Registro obrigatório pela regra de fallback: nunca `updateTag` numa tag sem leitor. |
| `page-content:youtube` | `apps/web/src/lib/content/fetch.ts:30` via tag dinâmica `` page-content:${page} `` (dono `unstable_cache(` linha 10) | `revalidateTag` | `'minutes'` | Conteúdo público lido por visitante em página renderizada (Quarto caso do wp2-rules.md) — mesma régua de `'ads'`/`'instagram-feed'`. Não é órfã apesar do `comm -23` cru marcar: `page-content:youtube` é exatamente a instância dinâmica de `page-content:*`, que tem leitor real. |

## Por arquivo

- `apps/web/src/app/api/cron/sync-youtube/route.ts` — Route Handler → nunca `updateTag` (regra de contexto). 2 chamadas: `youtube` (L273), `layout-counts` (L274). Ambas com leitor de staff → `'seconds'`, não `{ expire: 0 }`, apesar de ser Route Handler — mesmo padrão já resolvido em `api/pipeline/research/import/route.ts` no wp2-rules.md.
- `youtube/_actions/youtube-prompt-actions.ts` — Server Action (`saveVideoNotes`), 1 chamada: `youtube` (L853) → `'seconds'` via `revalidateTag` (regra de tela compartilhada vence a permissão de `updateTag` em Server Action).
- `youtube/ab-lab/actions.ts` — Server Actions, 14 chamadas: `youtube` ×11 (L224, 369, 425, 593, 652, 723, 747, 849, 943, 973, 1016) → `'seconds'`; `ab-tests` ×3 (L1097, 1145, 1262) → `'seconds'` fallback.
- `youtube/categories/actions.ts` — Server Actions, 4 chamadas: `youtube` ×3 (L45, 60, 73) → `'seconds'`; `layout-counts` ×1 (L74) → `'seconds'`.
- `youtube/comments/actions.ts` — Server Actions, 4 chamadas: `youtube` ×4 (L45, 60, 73, 88) → `'seconds'`.
- `youtube/content/actions.ts` — Server Actions, 2 chamadas: `page-content:youtube` ×2 (L137, 163) → `'minutes'`.
- `youtube/videos/actions.ts` — Server Actions, 10 chamadas: `youtube` ×6 (L40, 73, 92, 145, 184, 208) → `'seconds'`; `layout-counts` ×4 (L41, 74, 93, 146) → `'seconds'`.

## Resumo

```
esperado: updateTag 0 · {expire:0} 0 · 'seconds' 35 · 'minutes' 2 · 'max' 0
```

Total de chamadas no lote: 37 (26 `youtube` + 6 `layout-counts` + 3 `ab-tests` + 2 `page-content:youtube`).
Nenhuma chamada deste lote vira `updateTag`: todas as tags ou são tela de staff
compartilhada (`youtube`, `layout-counts`), órfã (`ab-tests`), ou lida por visitante em
página renderizada (`page-content:youtube`) — nenhuma é "quem salvou é quem lê".
