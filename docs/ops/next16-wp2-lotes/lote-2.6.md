# Lote 2.6 — Blog, Video, Linktree e varredura final

Arquivos do lote:
- `apps/web/src/app/cms/(authed)/video/[id]/edit/actions.ts` (Server Action)
- `apps/web/src/app/api/cron/aggregate-content-metrics/route.ts` (Route Handler / cron)
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (Server Action)
- `apps/web/src/app/cms/(authed)/blog/_shared/server-utils.ts` (helper `revalidateBlogHub` — nunca `updateTag`, chamado de dentro de Server Actions de `blog/actions.ts` e `blog/tag-actions.ts`)
- `apps/web/src/app/cms/(authed)/linktree/actions.ts` (Server Action)

Classificação (contexto decide função, leitor decide perfil):

| Tag | Leitor (de leitores.md) | Função | Perfil | Por quê |
|---|---|---|---|---|
| `pipeline-blog` (video edit actions.ts:141) | `pipeline/page.tsx:68`, `blog/_hub/hub-queries.ts:419` — `unstable_cache` | `revalidateTag` | `'seconds'` | tela de staff compartilhada (hub/pipeline), nomeada explicitamente na generalização das regras — mesmo dentro de Server Action, não é `updateTag` porque quem lê não é só quem salvou |
| `ab-tests` (video edit actions.ts:283) | sem leitor (orfas.txt) | `revalidateTag` | `'seconds'` | sem leitor localizável — fallback; registro: **sem leitor — candidata a remoção** |
| `most-read` (aggregate-content-metrics/route.ts:31) | sem leitor (orfas.txt) | `revalidateTag` | `'seconds'` | Route Handler (cron) → nunca `updateTag`; tag também sem leitor — fallback; registro: **sem leitor — candidata a remoção** |
| `content-analytics` (aggregate-content-metrics/route.ts:32) | sem leitor (orfas.txt) | `revalidateTag` | `'seconds'` | idem — Route Handler + sem leitor; registro: **sem leitor — candidata a remoção** |
| `blog-hub` (blog/[id]/edit/actions.ts:136,265,569) | `blog/_hub/hub-queries.ts:66,167,345` — `unstable_cache` | `revalidateTag` | `'seconds'` | tela de staff compartilhada, nomeada explicitamente |
| `pipeline-blog` (blog/[id]/edit/actions.ts:137,266) | `pipeline/page.tsx:68`, `blog/_hub/hub-queries.ts:419` | `revalidateTag` | `'seconds'` | idem |
| `blog-hub` (server-utils.ts:12, dentro de `revalidateBlogHub`) | `blog/_hub/hub-queries.ts:66,167,345` | `revalidateTag` | `'seconds'` | helper — nunca `updateTag` por construção; tela de staff compartilhada |
| `pipeline-blog` (server-utils.ts:13) | `pipeline/page.tsx:68`, `blog/_hub/hub-queries.ts:419` | `revalidateTag` | `'seconds'` | helper; tela de staff compartilhada |
| `sidebar-badges` (server-utils.ts:14) | `lib/cms/sidebar-badges.ts:161` — `unstable_cache` | `revalidateTag` | `'seconds'` | helper; contador de navegação compartilhado entre staff, nomeado explicitamente na regra |
| `` sitemap:${siteId} `` (server-utils.ts:16) | sem leitor (orfas.txt: `sitemap:*`) | `revalidateTag` | `'seconds'` | ÓRFÃ — não `'max'` (SEO por nome não é critério; regra corrige explicitamente este caso). Registro: **sem leitor — candidata a remoção** |
| `linktree-config` (linktree/actions.ts:45) | sem leitor (orfas.txt) | `revalidateTag` | `'seconds'` | Server Action, mas tag sem leitor — fallback; registro: **sem leitor — candidata a remoção** |
| `sidebar-badges` (linktree/actions.ts:46) | `lib/cms/sidebar-badges.ts:161` | `revalidateTag` | `'seconds'` | contador de navegação compartilhado entre staff — mesmo dentro de Server Action, não é o autor da ação quem lê sozinho |

**Nenhuma chamada deste lote vai para `updateTag`**: todas as tags são tela/contador de staff compartilhado (`blog-hub`, `pipeline-blog`, `sidebar-badges`) ou órfãs sem leitor (`ab-tests`, `most-read`, `content-analytics`, `` sitemap:${siteId} ``, `linktree-config`). Nenhuma tem leitor de visitante público nem leitor exclusivo do autor da action.

Tags órfãs deste lote — todas já constam de `docs/ops/next16-wp2-lotes/orfas.txt` (`ab-tests`, `most-read`, `content-analytics`, `sitemap:*`, `linktree-config`); nenhuma linha nova precisou ser acrescentada a `leitores.md`.

**esperado: updateTag 0 · {expire:0} 0 · 'seconds' 15 · 'minutes' 0 · 'max' 0**

(15 chamadas totais no lote: 2 em video/edit + 2 em aggregate-content-metrics + 5 em blog/edit + 4 em server-utils.ts + 2 em linktree — brief estimava "~10", contagem real do grep é 15.)
