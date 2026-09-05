> **SUPERADO EM 2026-09-05.** Os perfis registrados aqui foram todos trocados por
> `{ expire: 0 }` — perfil nomeado serve conteudo velho e nao e paridade com o Next 15.
> Ver `CORRECAO-perfis-vs-paridade.md`. A medicao de leitores continua valida.

# Lote 2.3 — Newsletters, SEO e autores

Registrado ANTES de tocar código, por tag, com leitor de `leitores.md` (re-confirmado
linha a linha nesta sessão em 2026-09-04 contra o código atual). Todos os arquivos deste
lote são helper / Route Handler / Server Action-com-tag-órfã-ou-compartilhada — **nenhuma
call site qualifica para `updateTag`** (ver coluna "por quê" em cada linha: toda tag lida
por outra pessoa que não quem submeteu, ou sem leitor).

Arquivos: `lib/newsletter/cache-invalidation.ts` (helper), `lib/seo/cache-invalidation.ts`
(helper), `api/cron/send-scheduled-newsletters/route.ts` (Route Handler),
`api/webhooks/ses/route.ts` (Route Handler), `cms/(authed)/newsletters/actions.ts`
(Server Actions + helper local `revalidateNewsletterHub`),
`newsletter/confirm/[token]/actions.ts` (Server Action — "quem submete não é quem lê").

| Tag | Chamadas (arquivo×N) | Leitor (leitores.md) | Perfil | Por quê |
|---|---|---|---|---|
| `` newsletter:type:${slug} `` | newsletter/cache-invalidation.ts×1 | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `` og:newsletter:${slug} `` | newsletter/cache-invalidation.ts×1 | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `` sitemap:${siteId} `` | newsletter/cache-invalidation.ts×1, seo/cache-invalidation.ts×3 (blog/campaign/newsletterType fns) | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `newsletter:types:count` | newsletter/cache-invalidation.ts×1, seo/cache-invalidation.ts×1 | `lib/newsletter/queries.ts:123` (`getActiveTypeCount`) → consumido em `app/(public)/newsletters/[slug]/page.tsx` | `'minutes'` | conteúdo público lido por visitante em página renderizada |
| `newsletter-suggestions` | newsletter/cache-invalidation.ts×2, cron send-scheduled-newsletters×1, webhooks/ses×1, newsletters/actions.ts×1 (dentro do helper `revalidateNewsletterHub`), newsletter/confirm/[token]/actions.ts×1 | `lib/newsletter/suggestions.ts:200` (`getNewsletterSuggestions`) → widget público em `app/(public)/newsletters/[slug]/` | `'minutes'` | visitante; Route Handlers e a Server Action de confirm são os 3 casos "quem submete não é quem lê" do wp2-rules |
| `` author:${authorId} `` | newsletter/cache-invalidation.ts×1 | `lib/newsletter/author-queries.ts:36,78` (`getAuthorByIdTagged`/`getAuthorWithLocale`) → consumido em `app/(public)/newsletters/[slug]/page.tsx` | `'minutes'` | página pública (confirmado: mesmo leitor de `newsletter:types:count`) |
| `` about:${siteId} `` | newsletter/cache-invalidation.ts×1 | `lib/about/queries.ts:94` (`getAboutData`) → `app/(public)/about/page.tsx` | `'minutes'` | página pública |
| `` blog:post:${postId} `` | seo/cache-invalidation.ts×1 | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `` og:blog:${postId} `` | seo/cache-invalidation.ts×1 | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `` campaign:${campaignId} `` | seo/cache-invalidation.ts×1 | sem leitor (hits de `tags:` no grep bruto são `Sentry.captureException`, dono `0`) | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `` og:campaign:${campaignId} `` | seo/cache-invalidation.ts×1 | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `seo-config` | seo/cache-invalidation.ts×1 | `lib/seo/config.ts:70` (`getSiteSeoConfig`) → `sitemap.ts`, `robots.ts`, metadata em quase toda página pública + `og/*` | `'minutes'` | crawler e visitante |
| `newsletter-hub` | newsletters/actions.ts×2 (1 dentro do helper `revalidateNewsletterHub`, 1 direto em `updateCadencePattern`) | `newsletters/_hub/hub-queries.ts` (`fetchSharedData` etc.) | `'seconds'` | tela de CMS compartilhada entre staff — nomeada explicitamente na generalização do wp2-rules |
| `sidebar-badges` | newsletters/actions.ts×1 (dentro do helper) | `lib/cms/sidebar-badges.ts:161` | `'seconds'` | contador de navegação compartilhado entre staff — nomeado explicitamente |
| `home-tags` | newsletters/actions.ts×2 (`createNewsletterType`, `updateNewsletterType`) | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `home-posts` | newsletters/actions.ts×2 (idem) | sem leitor | `'seconds'` | fallback — sem leitor — candidata a remoção |
| `newsletter-automations` | newsletters/actions.ts×1 (`toggleWorkflow`) | `newsletters/_hub/hub-queries.ts:786` (`fetchAutomationsData`) | `'seconds'` | tela de CMS compartilhada entre staff (não nomeada no wp2-rules, mesma regra por analogia — hub de automações) |
| `newsletter-schedule` | newsletters/actions.ts×1 (`updateCadencePattern`, chamada direta) | `newsletters/_hub/hub-queries.ts:701` (`fetchScheduleData`) | `'seconds'` | tela de CMS compartilhada entre staff (schedule board) |

**Nenhuma tag deste lote foi classificada com dúvida** — todas as 18 tags distintas têm
linha em `leitores.md` (ou estão em `orfas.txt`) e o leitor foi reaberto/confirmado nesta
sessão para as 5 com leitor real (`newsletter:types:count`, `newsletter-suggestions`,
`author:*`, `about:*`, `seo-config`).

**Resumo — esperado:** `updateTag 0 · {expire:0} 0 · 'seconds' 19 · 'minutes' 11 · 'max' 0`
(total 30 chamadas de `revalidateTag`, 0 `updateTag` — nenhum contexto Server Action deste
lote tem leitor = autor; todas as tags são ou órfãs ou lidas por outra pessoa/staff
compartilhado/visitante).

Detalhamento de 'seconds' (19): `newsletter:type:*`(1) + `og:newsletter:*`(1) +
`sitemap:*`(4) + `blog:post:*`(1) + `og:blog:*`(1) + `campaign:*`(1) + `og:campaign:*`(1) +
`newsletter-hub`(2) + `sidebar-badges`(1) + `home-tags`(2) + `home-posts`(2) +
`newsletter-automations`(1) + `newsletter-schedule`(1) = 19.

Detalhamento de 'minutes' (11): `newsletter:types:count`(2) + `newsletter-suggestions`(6) +
`author:*`(1) + `about:*`(1) + `seo-config`(1) = 11.
