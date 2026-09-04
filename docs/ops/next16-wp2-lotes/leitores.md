# Leitores medidos — WP-2 passo 2.0

Gerado em 2026-09-04 rodando a função `leitor` (wp2-rules.md, seção "Como achar o
leitor") contra as 43 tags distintas de `inv.txt` (saída de
`revalidateTag(...)` em `apps/web/src` + `apps/web/lib`). **Leitor real = dono do
bloco `tags:` é `unstable_cache(`.** Dono `uploadMediaAsset(` (metadata de upload)
ou `0` (array solto, ex.: `Sentry.captureException(err, { tags: {...} })`) não
conta como leitor, mesmo aparecendo no grep bruto de `tags:`.

Este arquivo é a fonte que os seis lotes consultam para decidir o perfil de
`revalidateTag` — não infira pelo nome da tag.

| Tag | Leitor (arquivo:linha) | Dono do bloco |
|---|---|---|
| `ab-tests` | sem leitor | — |
| `` about:${siteId} `` | `apps/web/lib/about/queries.ts:94` | `unstable_cache(` (linha 91) |
| `` ad:slot-config:${appId} `` | sem leitor | — |
| `` ad:slot:${slotKey} `` | sem leitor | — |
| `ads` | `apps/web/src/lib/ads/resolve.ts:352` | `export const loadAdCreatives = unstable_cache(` (linha 349) |
| `` author:${authorId} `` | `apps/web/lib/newsletter/author-queries.ts:36`, `apps/web/lib/newsletter/author-queries.ts:78` | `const fn = unstable_cache(` (linhas 22, 47) — falso leitor descartado: `uploadMediaAsset(` em `apps/web/src/app/cms/(authed)/authors/actions.ts:274,420` |
| `blog-hub` | `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts:66,167,345` | `fetchBlogSharedData`/`fetchEditorialData`/`fetchScheduleData = unstable_cache(` (linhas 9, 69, 170) |
| `` blog:post:${slug} `` | sem leitor | — |
| `` campaign:${id} `` | sem leitor (os dois hits de `tags:` que o grep bruto acha são `Sentry.captureException(err, { tags: {...} })`, dono `0`, não cache) | — |
| `canvas-formats` | sem leitor | — |
| `content-analytics` | sem leitor | — |
| `home-posts` | sem leitor | — |
| `home-tags` | sem leitor | — |
| `instagram-feed` | `apps/web/lib/home/queries.ts:429` | `export const getInstagramPosts = unstable_cache(` (linha 414) |
| `layout-counts` | `apps/web/lib/cms/layout-counts.ts:37` | `export const fetchLayoutCounts = unstable_cache(` (linha 34) |
| `link-alerts` | sem leitor | — |
| `` link-analytics:${linkId} `` | sem leitor | — |
| `` link:${id} `` (e variantes `link:${linkId}`, `link:${input.link_id}`) | sem leitor — falso leitor: `uploadMediaAsset(` em `apps/web/src/app/cms/(authed)/links/actions.ts:781`, `apps/web/src/app/cms/(authed)/links/[id]/qr/actions.ts:244` | `uploadMediaAsset(` (não é cache) |
| `` link:${siteId}:${code} `` | sem leitor — mesmo falso leitor acima | `uploadMediaAsset(` (não é cache) |
| `links-hub` | `apps/web/src/app/cms/(authed)/links/page.tsx:437` | `const fetchLinksDashboardCached = unstable_cache(` (linha 56) |
| `links-settings` | sem leitor | — |
| `` links:${siteId} `` | sem leitor | — |
| `linktree-config` | sem leitor | — |
| `` media:asset:${id} `` | sem leitor | — |
| `` media:gallery:${id} `` | sem leitor | — |
| `` media:stats:${id} `` | sem leitor | — |
| `most-read` | sem leitor | — |
| `newsletter-automations` | `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts:786` | `export const fetchAutomationsData = unstable_cache(` (linha 704) |
| `newsletter-hub` | `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts:98,330,410,701,786,951` | `fetchSharedData`/`fetchOverviewData`/`fetchEditorialData`/`fetchScheduleData`/`fetchAutomationsData`/`fetchAudienceData = unstable_cache(` (linhas 21, 101, 333, 413, 704, 789) |
| `newsletter-schedule` | `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts:701` | `export const fetchScheduleData = unstable_cache(` (linha 413) |
| `newsletter-suggestions` | `apps/web/lib/newsletter/suggestions.ts:200` | `export const getNewsletterSuggestions = unstable_cache(` (linha 123) — leitor é widget público em `app/(public)/newsletters/[slug]/` |
| `` newsletter:type:${slug} `` | sem leitor (distinto de `newsletter:types:count`/`newsletter:types:hub` — grafia diferente, "type" singular vs "types" plural) | — |
| `newsletter:types:count` | `apps/web/lib/newsletter/queries.ts:123` | `export const getActiveTypeCount = unstable_cache(` (linha 111) |
| `` og:blog:${slug} `` | sem leitor | — |
| `` og:campaign:${slug} `` | sem leitor | — |
| `` og:newsletter:${slug} `` | sem leitor | — |
| `page-content:youtube` | `apps/web/src/lib/content/fetch.ts:30` (via tag dinâmica `` page-content:${page} ``) | `const fetcher = unstable_cache(` (linha 10) |
| `pipeline-blog` | `apps/web/src/app/cms/(authed)/pipeline/page.tsx:68`, `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts:419` | `fetchPipelineBoardCached = unstable_cache(` (linha 27); `export const fetchPipelineData = unstable_cache(` (linha 348) |
| `seo-config` | `apps/web/lib/seo/config.ts:70` | `export const getSiteSeoConfig = unstable_cache(` (linha 67) |
| `sidebar-badges` | `apps/web/lib/cms/sidebar-badges.ts:161` | `export const fetchSidebarBadges = unstable_cache(` (linha 158) |
| `` sitemap:${siteId} `` | sem leitor | — |
| `social` | sem leitor (todos os hits de `tags:` no grep bruto são arrays soltos não relacionados a cache, dono `0`) | — |
| `youtube` | `apps/web/src/app/cms/(authed)/youtube/page.tsx:122`, `apps/web/src/lib/youtube/queries.ts:124`, `apps/web/lib/home/queries.ts:282,328,393,411` | `fetchYouTubeDashboardCached = unstable_cache(` (linha 13); `export const getYouTubePageData = unstable_cache(` (linha 9); `getHomeChannels`/`getHomeVideos`/`getWeeklyPick`/`getVideoCount = unstable_cache(` (linhas 252, 285, 331, 396) |

## Resumo

- 43 tags distintas invalidadas (`inv.txt`), 50 tags distintas lidas (`read.txt`).
- `comm -23 inv.txt read.txt` cru: 26 tags sem correspondência textual em `read.txt`.
- Conferência via `leitor` (dono do bloco = `unstable_cache(`): o conjunto de 26
  "sem leitor" **não é o mesmo** conjunto do `comm -23` cru. `page-content:youtube`
  sai (tem leitor real via a tag dinâmica `` page-content:${page} ``, normalizada
  como `page-content:*` em `read.txt` e por isso já "lida" para o `comm`, mas o
  literal `page-content:youtube` é exatamente essa instância). `` link:* `` entra
  (o único "leitor" textual em `read.txt` é metadata de `uploadMediaAsset`, não
  `unstable_cache` — falso positivo do grep bruto). `` link:*:* `` já estava no
  `comm -23` cru e continua órfã pelo mesmo motivo. Uma tag sai, uma entra: o
  total permanece 26. Ver `orfas.txt` para a lista final, que é o conjunto que
  vale para o assert do portão final do WP-2.
