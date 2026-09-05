# Validação do ecossistema `@tn-figueiredo/*` contra Next.js 16

Gerado durante a migração (`docs/superpowers/plans/2026-09-04-next16-ecosystem-validation.md`),
branch `next16-migration`, Next 16.3.4, Turbopack. Rascunho iniciado antes do deploy com os
achados que **não dependem** de produção; as linhas de QA por tela (WP-6.1) entram depois.

## Achados por pacote

| Pacote | Versão | Achado | Severidade | Ação sugerida |
|---|---|---|---|---|
| `email` | 0.2.0 | **Não builda sob Turbopack.** `dist/chunk-AIFJIPGT.js:7` importa `resend`, `chunk-VFALXZUJ.js:7` importa `nodemailer`, `webhooks.js:13` importa `svix` — estaticamente. Os três não existem em `node_modules` nem no lockfile do consumidor (migrado para SES). O webpack tolerava; o Turbopack recusa módulo ausente. Contornado no app com `turbopack.resolveAlias` → `src/stubs/absent-module.ts` (Proxy que lança). | **Alta** — qualquer consumidor em Next 16 quebra no build | Tornar os adapters Resend/Svix/SMTP `optionalDependencies` + `import()` lazy dentro do adapter, ou separar em subpaths (`@tn-figueiredo/email/resend`). `SesWebhookProcessor` não depende de `svix`; só `ResendWebhookProcessor` depende. |
| `cms-admin` | 0.2.x | Contrato `revalidateTag: (tag: string) => void` não aceita mais o `revalidateTag` do Next 16, cujo 2º argumento (perfil) é **obrigatório** (`TS2322` em `lib/cms/admin.ts:18`). Contornado com wrapper `(tag) => revalidateTag(tag, 'seconds')`. | Média | Mudar o contrato para `(tag: string, profile?: string \| { expire?: number }) => void` e deixar o consumidor decidir o perfil, ou documentar que o pacote invalida telas de staff e fixar `'seconds'` internamente. |
| `seo` | 0.1.0 | **Declarado e não importado.** Está em `apps/web/package.json` e nenhum arquivo o importa; `sitemap.ts`/`robots.ts` usam `@/lib/seo/*`. Não validável por tela neste app. Ainda puxa peer de `next` no `npm ci`. | Baixa | Remover do `package.json` do consumidor (commit separado) ou validar no repo do pacote. |
| `auth-nextjs` | 2.0.0 | `middleware.ts` mantido (não migrado para `proxy.ts`): o pacote garante "Edge Runtime safe" em `dist/middleware/create-auth-middleware.js:16`; `proxy.ts` roda só em Node. Build e typecheck passam sob Next 16 com `middleware.ts`. | Nota | Decidir o contrato (WP-6.4): manter a garantia edge e documentar que o consumidor fica em `middleware.ts`, ou publicar variante `proxy` com as implicações declaradas. |
| `admin`, `cms-ui`, `cms-reader`, `ad-engine-admin` | — | Typecheck e build passam sob Next 16 / Turbopack; `cms-ui` e `cms-admin` entram por `@import` de CSS (`globals.css:1-2`, `layer(packages)`) e `cms-reader` via `styles/reader-pinboard.css:1` — paridade de CSS confirmada no WP-4.3 (823/823 classes arbitrárias; seletores idênticos módulo hashes de bundler). QA por tela pendente (WP-6.1, pós-deploy). | — | — |

## Achados do próprio app, expostos pela migração

- **Dois envios de e-mail nunca funcionaram:** `lib/youtube/ab-escalation.ts` (escalação do A/B Lab) e `lib/social/notifications/email-fallback.ts` instanciavam `ResendEmailAdapter` guardados por `RESEND_API_KEY`, dentro de `try`, com o módulo `resend` ausente. Trocados por `getEmailService()` (SES) no WP-3b.
- **26 das 43 tags de cache são invalidadas e nunca lidas** (59 das 171 chamadas): `sitemap:*`, `og:*`, `blog:post:*`, `campaign:*`, `newsletter:type:*`, `link:*` (todas as formas), `links:*`, `link-analytics:*`, `ad:slot*`, `media:*`, `linktree-config`, `ab-tests`, `most-read`, `content-analytics`, `social`, e mais — inventário em `docs/ops/next16-wp2-lotes/orfas.txt`, leitor medido por tag em `leitores.md`. Convertidas para o fallback `'seconds'` e marcadas "candidata a remoção"; a remoção é limpeza separada.
- **Zero `updateTag`:** nenhuma das 171 chamadas satisfaz "quem salvou é o único que lê" — todo alvo de Server Action é tela compartilhada de staff ou página pública.
- Perfis aplicados (medidos, excluindo o wrapper de `lib/cms/admin.ts`): `'seconds'` 143 · `'minutes'` 28 · `'max'` 0 · `{ expire: 0 }` 0 (contagem por lote em `lote-2.*.md`).

## Decisão WP-6.4 — contrato do `auth-nextjs`

**Mantida a garantia "Edge Runtime safe".** O consumidor fica em `middleware.ts`; a migração
para `proxy.ts` (Node) não é feita por este app e não deve ser feita por padrão por nenhum
consumidor, porque tornaria falsa uma promessa que o pacote faz na própria implementação
(`dist/middleware/create-auth-middleware.js:16`). Sob Next 16, `middleware.ts` continua
suportado: build, typecheck e o guard de rota passam com ele. Se algum consumidor precisar de
Node no middleware (APIs de Node, pacotes que não rodam em edge), a resposta é uma **variante
publicada e nomeada** (`@tn-figueiredo/auth-nextjs/proxy`) com as implicações declaradas — não
um rename silencioso do arquivo. Isso é decisão do pacote, fora deste plano.

## Nota operacional do Next 16

`next dev` passou a gerar `apps/web/AGENTS.md` e `apps/web/CLAUDE.md` (e a tocar
`next-env.d.ts`) a cada start. Não são do repo: adicionar `apps/web/AGENTS.md` e
`apps/web/CLAUDE.md` ao `.gitignore` antes que um `git add -A` os arraste — ou decidir
mantê-los como artefato versionado, o que é escolha, não default.

## Pendente (pós-deploy)

- WP-5: `minimumCacheTTL` (fixado em 60), `scroll-behavior` (restaurar via `data-scroll-behavior="smooth"` e levar a decisão), avatares do Google (`maximumRedirects` 3), smoke dos destinos de invalidação em produção.
- WP-6.1: roteiro por pacote (tabela no plano) e 6.3b (Sentry sob Turbopack num preview).
