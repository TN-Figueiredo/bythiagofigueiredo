> **SUPERADO EM 2026-09-05.** Os perfis registrados aqui foram todos trocados por
> `{ expire: 0 }` — perfil nomeado serve conteudo velho e nao e paridade com o Next 15.
> Ver `CORRECAO-perfis-vs-paridade.md`. A medicao de leitores continua valida.

# Lote 2.4 — Pipeline e Research

Escopo (11 arquivos, 25 chamadas `revalidateTag` exatas):

- `apps/web/src/app/api/pipeline/research/[id]/links/[linkId]/route.ts` (1)
- `apps/web/src/app/api/pipeline/research/[id]/links/route.ts` (1)
- `apps/web/src/app/api/pipeline/research/[id]/route.ts` (2)
- `apps/web/src/app/api/pipeline/research/import/route.ts` (1)
- `apps/web/src/app/api/pipeline/research/route.ts` (1)
- `apps/web/src/app/api/pipeline/research/topics/[id]/route.ts` (2)
- `apps/web/src/app/api/pipeline/research/topics/route.ts` (1)
- `apps/web/src/app/cms/(authed)/pipeline/actions.ts` (9, Server Action)
- `apps/web/src/app/cms/(authed)/pipeline/research/actions.ts` (5, Server Action)
- `apps/web/src/app/cms/(authed)/pipeline/research/decision-actions.ts` (1, Server Action)
- `apps/web/src/app/cms/(authed)/pipeline/research/foco-actions.ts` (1, Server Action)

Todas as 25 chamadas invalidam apenas duas tags: `layout-counts` (16, nos 7 `route.ts`
mais `research/actions.ts`, `decision-actions.ts`, `foco-actions.ts`) e `pipeline-blog`
(9, só em `pipeline/actions.ts`).

## Classificação por tag

| Tag | Leitor (de `leitores.md`) | Função | Perfil | Por quê |
|---|---|---|---|---|
| `layout-counts` | `apps/web/lib/cms/layout-counts.ts:37`, dono `unstable_cache(` linha 34 — contador de navegação da sidebar do CMS, compartilhado por todo staff logado | `revalidateTag` (nos 7 `route.ts` porque Route Handler nunca aceita `updateTag`; nas 3 Server Actions porque o leitor é tela compartilhada entre staff, não só quem executou a ação) | `'seconds'` | Regra de Precedência (wp2-rules.md): contexto decide a função, leitor decide o perfil. `layout-counts` está na lista explícita de tags de "superfície de CMS compartilhada entre staff" — vai de `'seconds'` mesmo dentro de Server Action, nunca `{ expire: 0 }` mesmo dentro de Route Handler (caso citado nominalmente no brief: `import/route.ts:20`). Se fosse `updateTag`, só a sessão de quem agiu veria o contador certo — os demais membros do staff ficariam com o número velho. |
| `pipeline-blog` | `apps/web/src/app/cms/(authed)/pipeline/page.tsx:68`, `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts:419`, ambos dono `unstable_cache(` — board/hub do pipeline, tela compartilhada de staff | `revalidateTag` (Server Action, mas leitor é hub compartilhado, não o autor da ação) | `'seconds'` | Mesma regra de tela compartilhada — `pipeline-blog` está nominalmente na lista de tags de hub/staff do wp2-rules.md. Nunca `updateTag`: um editor movendo um card no board precisa que todo staff olhando a mesma tela veja o board atualizado, não só ele. |

Nenhuma das 25 chamadas está em `orfas.txt` — ambas as tags têm leitor medido e real
(`unstable_cache`), não são fallback.

## Expectativa

```
esperado: updateTag 0 · {expire:0} 0 · 'seconds' 25 · 'minutes' 0 · 'max' 0
```

Por arquivo:

| Arquivo | Chamadas | Destino |
|---|---|---|
| `api/pipeline/research/[id]/links/[linkId]/route.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `api/pipeline/research/[id]/links/route.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `api/pipeline/research/[id]/route.ts` | 2 | `revalidateTag('layout-counts', 'seconds')` ×2 |
| `api/pipeline/research/import/route.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `api/pipeline/research/route.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `api/pipeline/research/topics/[id]/route.ts` | 2 | `revalidateTag('layout-counts', 'seconds')` ×2 |
| `api/pipeline/research/topics/route.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `cms/(authed)/pipeline/actions.ts` | 9 | `revalidateTag('pipeline-blog', 'seconds')` ×9 |
| `cms/(authed)/pipeline/research/actions.ts` | 5 | `revalidateTag('layout-counts', 'seconds')` ×5 |
| `cms/(authed)/pipeline/research/decision-actions.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |
| `cms/(authed)/pipeline/research/foco-actions.ts` | 1 | `revalidateTag('layout-counts', 'seconds')` |

Assert extra deste lote (nenhum `updateTag` nos 7 `route.ts`):

```
! grep -l "updateTag(" <os 7 route.ts>   # DEVE não imprimir nenhum arquivo
```

## Dúvidas / observações

- Nenhuma tag deste lote precisou de julgamento de "quem lê" além do que já está
  registrado em `leitores.md` — as duas tags do escopo (`layout-counts`,
  `pipeline-blog`) já estão nominalmente na lista de "tela compartilhada de staff"
  do wp2-rules.md, então a classificação não teve caso ambíguo.
- Como as 16 chamadas em Server Actions também vão para `revalidateTag` (nenhuma
  `updateTag` no lote inteiro), o assert de sintaxe "existe segundo argumento" e o
  assert de semântica "nunca `updateTag` nos route.ts" coincidem neste lote — mas o
  segundo é o que realmente prova a classificação, porque o primeiro não distingue
  `updateTag` de `revalidateTag` com perfil.
