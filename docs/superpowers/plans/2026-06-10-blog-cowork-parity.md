# Blog ↔ Vídeo Cowork Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à área de Blog do CMS a mesma fluidez de fluxo da área de Vídeo — geração de direções/conteúdo via Cowork com 1 clique, prompts de imagem para Midjourney, auditoria SEO via `seo_auditor.py`, distribuição social persistida — e tirar o hub do visual azul/indigo genérico, alinhando ao design system do CMS.

**Architecture:** O Cowork opera o blog através do item `content_pipeline` **já linkado** a cada post (`getPipelineItemForPost`, em `apps/web/src/lib/pipeline/blog-link.ts`) usando a API de sections existente (`manage_sections` / `PATCH /api/pipeline/items/{id}/sections/{section}`) — **zero endpoints novos** (sections de blog não têm validação estrita no write, então campos novos como `siblings` e `audit` entram sem mudança de backend; apenas docs + reseed). O editor de blog já lê seções do pipeline no load (`draft_*`, `images_shared` em `page.tsx`); este plano amplia essa leitura (`ideia_shared.angle/siblings`, `seo_*.audit`, prompts por imagem) e adiciona botões Cowork via um componente **compartilhado extraído do vídeo** (`CoworkTrigger`). A distribuição social persiste em `blog_posts.distribution_plan` (jsonb novo) e materializa `social_posts` no publish via `createSocialPostFromContent` (já existe).

**Tech Stack:** Next.js 15 + React 19, Supabase (service client + migrations via `npm run db:new`), TipTap, Vitest, pipeline REST/MCP existente, `~/Workspace/youtube/seo_auditor.py` (rodado pelo Cowork localmente — o CMS nunca chama Python).

**Decisões de produto (fixadas):**
1. "A direção" do blog = `ideia_shared.content.angle` (fallback: `hook` do item). Alternativas = `ideia_shared.content.siblings` (string[], novo campo livre).
2. Imagens: o Cowork gera **prompts para Midjourney** (texto), nunca imagens. Usuário roda no Midjourney e sobe o resultado pela galeria existente.
3. SEO: o Cowork roda `seo_auditor.py` na máquina local (tem acesso) e grava um **resumo compacto** em `seo_{lang}.content.audit`. O CMS só exibe.
4. Distribuição v1: persiste o plano; no publish cria **um** social_post com todas as plataformas selecionadas (timing por plataforma fica documentado como v2 — o índice `idx_social_posts_active_per_content` permite só um post ativo por conteúdo).
5. Posts sem item de pipeline linkado: botões Cowork não aparecem (degradação silenciosa — o load já tolera `pipelineItem === null`).
6. O 1-clique do Cowork existe nos **5 steps**: ideia/conteúdo/imagens/seo escrevem sections; Publicação opera em **modo conversa** (captions/hashtags pra colar — automação de captions por rede é v2).

**Convenções de execução (valem para TODOS os comandos do plano):**
- **Vitest sempre com cwd em `apps/web`** — não há vitest config na raiz; o `apps/web/vitest.config.ts` carrega o `bracketDirAliasPlugin` que resolve `@/app/cms/(authed)/blog/[id]/...`. Forma canônica: `cd apps/web && npx vitest run test/cms/foo.test.ts` (paths relativos a `apps/web`). Rodar da raiz falha no resolve de alias.
- **Typecheck sempre a partir da RAIZ do repo**: `npm run typecheck -w apps/web` / `npm run typecheck -w apps/api` (flags `-w` só resolvem da raiz). Quando um step combina vitest + typecheck, rode o typecheck primeiro (raiz) e depois o `cd apps/web && npx vitest …` — ou em shells separados; nunca encadeie typecheck APÓS um `cd apps/web`.
- **Atenção ao gate de tipos dos testes:** o `tsconfig.json` de apps/web **exclui `test/**`** — campos novos obrigatórios em `SharedFields`/`EditorState`/`VersionContent` NÃO quebram o typecheck nos fixtures; só aparecem rodando o vitest. Por isso as Tasks 2, 4 e 5 rodam as suítes de stage explicitamente após mudar tipos.
- O conteúdo dos docs Tier-2 (`apps/web/data/pipeline-docs/*.md`) é servido **do filesystem** por `GET /api/pipeline/docs/[domain]` — vai ao ar no **deploy**, não via seed. O seed (`npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts`) cobre apenas as entries de reference/context restantes (section-schemas foram removidos do seed — ver nota no próprio script, linha ~96).

**Regras do repo que se aplicam (CLAUDE.md + memória):**
- Commits direto em `staging`; sem branches de feature. `--no-verify` apenas se o hook falhar em arquivos de outro terminal.
- Migration **somente** via `npm run db:new <nome>` — nunca criar arquivo manualmente.
- Cores CSS load-bearing em rgba/hex literal (Opera renderiza `color-mix()` transparente).
- Docs do Cowork são vivos: editar `docs/cowork-pipeline-reference.md` ⇒ rodar o seed (`npx tsx scripts/seed-pipeline-reference.ts`).
- **Visual approval first:** Tasks 3, 4, 5, 6 e 7 mudam UI — antes de cada uma, mostrar ao usuário um mockup/screenshot da proposta e obter OK explícito (o padrão visual do vídeo já é aprovado; o checkpoint é para as adaptações ao blog).
- Não chamar `getSupabaseServiceClient()` sem guard — toda server action nova aqui começa com `requireSiteAdminForRow('blog_posts', postId)`.

**Arquivos novos (mapa):**
| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/app/cms/(authed)/_shared/cowork/cowork-trigger.tsx` | Popover Cowork genérico (ex-video CoworkButton, parametrizado) |
| `apps/web/src/app/cms/(authed)/_shared/cowork/sparkles-glyph.tsx` | Glyph movido do vídeo |
| `apps/web/src/app/cms/(authed)/_shared/cowork/cowork.css` | Estilos `.cw-*` extraídos de `video.css` |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/cowork.ts` | Header + hints + prompts por stage do blog (funções puras) |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/blog-cowork-button.tsx` | Wrapper do CoworkTrigger lendo o editor state do blog |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/pipeline-actions.ts` | Server actions: swap de direção, poll de draft |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/use-pipeline-draft-poll.ts` | Poll de draft gerado pelo Cowork |
| `apps/web/src/lib/social/distribution-to-config.ts` | Função pura DistributionPlan → SocialConfig |
| `apps/web/test/cms/blog-cowork.test.ts` | Testes dos builders de instrução |
| `apps/web/test/cms/blog-distribution.test.ts` | Testes do mapper de distribuição |
| `supabase/migrations/<timestamp>_add_blog_distribution_plan.sql` | Coluna `distribution_plan` (gerada via `npm run db:new`) |

---

## Task 1: Módulo Cowork compartilhado (extração do vídeo)

O popover Cowork do vídeo (`cowork-button.tsx`) é 90% genérico — só o header, hints e prompts são específicos. Extrair o genérico para `_shared/cowork/` e fazer o vídeo consumir, sem mudança de comportamento.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/cowork/cowork-trigger.tsx`
- Create: `apps/web/src/app/cms/(authed)/_shared/cowork/sparkles-glyph.tsx`
- Create: `apps/web/src/app/cms/(authed)/_shared/cowork/cowork.css`
- Modify: `apps/web/src/app/cms/(authed)/video/[id]/edit/_components/cowork-button.tsx`
- Modify: `apps/web/src/app/cms/(authed)/video/[id]/edit/_components/sparkles-glyph.tsx` (vira re-export)
- Modify: `apps/web/src/app/cms/(authed)/video/video.css` (remover regras `.cw-*` movidas, importar o css novo)

- [ ] **Step 1: Mover o SparklesGlyph**

Copiar o conteúdo integral de `video/[id]/edit/_components/sparkles-glyph.tsx` para `_shared/cowork/sparkles-glyph.tsx` (sem alterações). Substituir o arquivo original por um re-export para não quebrar os imports existentes do vídeo:

```tsx
// apps/web/src/app/cms/(authed)/video/[id]/edit/_components/sparkles-glyph.tsx
export { SparklesGlyph } from '@/app/cms/(authed)/_shared/cowork/sparkles-glyph'
```

- [ ] **Step 2: Criar o CoworkTrigger genérico**

Criar `_shared/cowork/cowork-trigger.tsx` copiando `video/[id]/edit/_components/cowork-button.tsx` na íntegra e aplicando exatamente estas transformações (todo o resto — focus trap, anchor/flip, fases, animação, toast — fica idêntico):

1. Remover os imports de `useVideoEditorState` e `VideoStage` **e os usos correspondentes dentro do componente** (`const editor = useVideoEditorState()` e `const lang = editor.activeLang` dentro de `send`); remover as constantes `STAGE_LABEL`, `STAGE_TARGET_HINT`, `CW_PROMPTS`, `CW_PLACEHOLDER`. Adicionar `import './cowork.css'` no topo (ver Step 4).
2. Trocar a interface de props e a montagem da instrução:

```tsx
export interface CoworkTriggerProps {
  /** Linha(s) de contexto que abrem a instrução, ex.: "[Blog tc-05 · Ideia · PT · item_id …]\nTrabalhe EXCLUSIVAMENTE…" */
  header: string
  /** Hint de alvo (seção/schema) anexado após o header. Opcional. */
  hint?: string
  /** Quick-prompts exibidos como chips. */
  prompts: string[]
  /** Placeholder do textarea. */
  placeholder: string
  /** Texto descritivo sob o título do popover. */
  subline?: string
  label?: string
  compact?: boolean
}

export function CoworkTrigger({
  header,
  hint,
  prompts,
  placeholder,
  subline = 'ele escreve direto na pipeline — pede o ajuste e ele aplica.',
  label = 'Cowork',
  compact,
}: CoworkTriggerProps) {
```

3. Dentro de `send`, substituir a montagem do contexto (as linhas que constroem `head`/`hint`/`ctx` a partir do editor de vídeo) por:

```tsx
    const ctx = hint ? `${header}\n${hint}` : header
    const copied = openCowork(`${ctx}\n\n${m}`)
```

4. No JSX, trocar `{CW_PLACEHOLDER[stage]}` por `{placeholder}`, o `<div className="cw-sub">…</div>` hardcoded por `{subline}`, e `const prompts = CW_PROMPTS[stage] ?? []` some (prompts agora vem por prop).

- [ ] **Step 3: Refatorar o CoworkButton do vídeo para wrapper**

Reescrever `video/[id]/edit/_components/cowork-button.tsx` mantendo **exatamente** as constantes `STAGE_LABEL`, `STAGE_TARGET_HINT`, `CW_PROMPTS`, `CW_PLACEHOLDER` atuais (copiar do arquivo existente — há mudanças não commitadas neste arquivo, preservá-las) e delegando o resto:

```tsx
'use client'

import { CoworkTrigger } from '@/app/cms/(authed)/_shared/cowork/cowork-trigger'
import { useVideoEditorState } from '../context'
import type { VideoStage } from '../types'

// … STAGE_LABEL, STAGE_TARGET_HINT, CW_PROMPTS, CW_PLACEHOLDER — copiados sem alteração …

export interface CoworkButtonProps {
  stage: VideoStage
  label?: string
  compact?: boolean
}

export function CoworkButton({ stage, label = 'Cowork', compact }: CoworkButtonProps) {
  const editor = useVideoEditorState()
  const lang = editor.activeLang
  const header =
    `[Vídeo ${editor.code} · ${STAGE_LABEL[stage]} · ${lang.toUpperCase()} · item_id ${editor.itemId}]\n` +
    `Trabalhe EXCLUSIVAMENTE neste item_id (${editor.itemId}). NÃO crie um novo item nem use outra "versão"/duplicata — ` +
    `se você tiver uma task antiga apontando pra outro id, ignore: a fonte da verdade é o item aberto agora no CMS.`
  return (
    <CoworkTrigger
      header={header}
      hint={STAGE_TARGET_HINT[stage]?.(editor.itemId, lang)}
      prompts={CW_PROMPTS[stage] ?? []}
      placeholder={CW_PLACEHOLDER[stage]}
      subline="ele escreve direto na pipeline — pede o ajuste e ele mexe na ideia, no roteiro, no pós e na publicação."
      label={label}
      compact={compact}
    />
  )
}
```

- [ ] **Step 4: Extrair o CSS `.cw-*`**

Em `video/video.css`, mover para `_shared/cowork/cowork.css` as regras do popover/botão Cowork, com estas regras de decisão (verificadas no arquivo real):

1. **Movem inteiras:** regras cujo seletor é só `.cw-wrap`, `.cw-btn`, `.cw-pop` e descendentes (`.cw-head`, `.cw-sub`, `.cw-quick`, `.cw-chip`, `.cw-input`, `.cw-foot`, `.cw-kbd`, `.cw-send`, `.cw-ico`, `.cw-kick`, `.cw-name`) + keyframes de entrada/saída do popover.
2. **Seletores agrupados com classes do vídeo** (ex.: `video.css:1289-1309` — `.vi-alt, .vcard, .pub-chan, .cw-btn, …`): **dividir** a regra — a parte `.cw-*` é duplicada em `cowork.css` com o mesmo bloco de declarações; as classes do vídeo permanecem em `video.css`.
3. **Ficam no vídeo:** `.cw-spin`/`@keyframes cwspin` (~linhas 219-220, pertencem ao rot-gen do vídeo) e o override contextual `.vid-ed .rot-gen-actions .cw-btn` (~129-131) — NÃO mover nem des-escopar (vazaria pro blog).
4. **Tokens:** no topo de `cowork.css`, criar o bloco de escopo `.cw-pop, .cw-btn { … }` copiando do token bridge de `video.css:14-69` **apenas as linhas que as regras `.cw-*` consomem** — manter as referências `var(--cms-*)` como estão (resolvem em qualquer página sob o root do CMS, blog incluso) e incluir também os tokens de motion/tipografia `--t-fast`, `--t`, `--ease`, `--ease-back`, `--shadow-pop`, `--font-mono`, `--radius` (video.css:61-69), senão transições e sombras do popover morrem. O literal `--accent: #ff8240; --on-accent: #fff;` copia como está (sem `color-mix`).

**Wiring (determinístico — sem `@import` em CSS):** as classes `.cw-*` são consumidas exclusivamente pelo próprio CoworkTrigger, então o import vive em UM lugar — dentro do componente (App Router permite CSS global importado em qualquer client component):

```ts
// no topo de _shared/cowork/cowork-trigger.tsx
import './cowork.css'
```

Nenhum outro import necessário (vídeo e blog herdam via o componente); nenhuma mudança em `video.css` além da REMOÇÃO das regras movidas.

- [ ] **Step 5: Typecheck + testes do vídeo**

Run: `npm run typecheck -w apps/web`
Expected: PASS (exit 0, sem output de erro)

Run: `cd apps/web && npx vitest run src/lib/pipeline/cowork-instructions.test.ts`
Expected: PASS — nenhum teste referencia o componente movido por path.

- [ ] **Step 6: QA visual rápido no vídeo**

Abrir `/cms/video/<id>/edit`, conferir que o botão Cowork e o popover renderizam idênticos (estilo + envio + toast).

- [ ] **Step 7: Commit (paths explícitos — repo multi-terminal, NÃO stagear arquivos de outros terminais)**

```bash
git add "apps/web/src/app/cms/(authed)/_shared/cowork" \
  "apps/web/src/app/cms/(authed)/video/[id]/edit/_components/cowork-button.tsx" \
  "apps/web/src/app/cms/(authed)/video/[id]/edit/_components/sparkles-glyph.tsx" \
  "apps/web/src/app/cms/(authed)/video/video.css"
git commit -m "refactor(cms): extract shared CoworkTrigger from video editor"
```

(`handoff-sheet.tsx`/`editor-shell.tsx` têm mudanças de outro terminal — ficam fora. Se o pre-commit falhar APENAS nesses arquivos alheios, vale a regra do repo: `--no-verify` com a sua mudança verificada e staged por path explícito.)

---

## Task 2: Plumbing — contexto de pipeline no editor de blog

Carregar do item linkado: `ideia_shared.angle/siblings`, `seo_{lang}.audit`, prompts por imagem; expor `pipelineItemId` no estado; criar os builders de instrução do blog (com teste primeiro).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/cowork.ts`
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/blog-cowork-button.tsx`
- Create: `apps/web/test/cms/blog-cowork.test.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/reducer.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx`

- [ ] **Step 1: Teste falhando dos builders**

Criar `apps/web/test/cms/blog-cowork.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildBlogCoworkHeader,
  BLOG_STAGE_HINT,
  BLOG_CW_PROMPTS,
} from '@/app/cms/(authed)/blog/[id]/edit/cowork'

describe('blog cowork builders', () => {
  it('header inclui code, stage, lang, item_id e post_id + guarda de exclusividade', () => {
    const h = buildBlogCoworkHeader({
      code: 'tc-05', stage: 'ideia', lang: 'pt',
      pipelineItemId: 'item-123', postId: 'post-456',
    })
    expect(h).toContain('[Blog tc-05 · Ideia · PT · item_id item-123]')
    expect(h).toContain('post_id post-456')
    expect(h).toContain('EXCLUSIVAMENTE')
  })

  it('hint de ideia aponta pra seção shared (sem lang) e pede siblings', () => {
    const hint = BLOG_STAGE_HINT.ideia('item-123', 'pt')
    expect(hint).toContain('section:ideia')
    expect(hint).toContain('siblings')
    expect(hint).not.toContain('lang:pt') // ideia é shared no blog
  })

  it('hint de conteúdo aponta pro draft per-lang com body markdown', () => {
    const hint = BLOG_STAGE_HINT.conteudo('item-123', 'en')
    expect(hint).toContain('section:draft')
    expect(hint).toContain('lang:en')
    expect(hint).toContain('body')
  })

  it('hint de seo contém o comando do auditor e o alvo audit', () => {
    const hint = BLOG_STAGE_HINT.seo('item-123', 'pt')
    expect(hint).toContain('seo_auditor.py')
    expect(hint).toContain('audit')
  })

  it('todos os stages com botão têm prompts', () => {
    for (const k of ['ideia', 'conteudo', 'imagens', 'seo', 'publicacao'] as const) {
      expect(BLOG_CW_PROMPTS[k].length).toBeGreaterThan(0)
    }
  })

  it('hint de publicação é conversacional (não escreve sections)', () => {
    const hint = BLOG_STAGE_HINT.publicacao('item-123', 'pt')
    expect(hint).toContain('não escreva sections')
    expect(hint).toContain('caption')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/cms/blog-cowork.test.ts`
Expected: FAIL — "Cannot find module" apontando pro `cowork.ts` inexistente.

- [ ] **Step 3: Implementar `cowork.ts`**

Criar `apps/web/src/app/cms/(authed)/blog/[id]/edit/cowork.ts`:

```ts
import type { Stage } from './types'

/** Stages do blog com botão Cowork ('rascunho' é o stage interno; o rótulo público é 'conteudo'). */
export type BlogCoworkStage = Exclude<Stage, 'rascunho'> | 'conteudo'

const STAGE_LABEL: Record<BlogCoworkStage, string> = {
  ideia: 'Ideia', conteudo: 'Conteúdo', imagens: 'Imagens', seo: 'SEO', publicacao: 'Publicação',
}

export interface BlogCoworkContext {
  code: string
  stage: BlogCoworkStage
  lang: 'pt' | 'en'
  pipelineItemId: string
  postId: string
}

export function buildBlogCoworkHeader(ctx: BlogCoworkContext): string {
  return (
    `[Blog ${ctx.code} · ${STAGE_LABEL[ctx.stage]} · ${ctx.lang.toUpperCase()} · item_id ${ctx.pipelineItemId}]\n` +
    `post_id ${ctx.postId} (post do blog linkado a este item).\n` +
    `Trabalhe EXCLUSIVAMENTE neste item_id (${ctx.pipelineItemId}). NÃO crie um novo item nem outra "versão"/duplicata — ` +
    `a fonte da verdade é o item aberto agora no CMS.`
  )
}

/**
 * Hints por stage — apontam a seção exata + shape esperado, no mesmo padrão do
 * STAGE_TARGET_HINT do vídeo. Blog: ideia/images são SHARED (sem lang);
 * draft/seo são per-language.
 */
export const BLOG_STAGE_HINT: Record<BlogCoworkStage, (itemId: string, lang: string) => string> = {
  ideia: (itemId) =>
    `→ atualize a seção \`ideia\` (SHARED — sem lang) via MCP manage_sections (action:update, item_id:${itemId}, section:ideia); ` +
    `leia primeiro com action:get; preserve os campos existentes (premise, body, vvs, cross_refs) e mexa só no que foi pedido: ` +
    `\`angle\` = a direção atual (1–2 frases, o ângulo que o artigo vai desenvolver) e ` +
    `\`siblings\` = string[] de direções ALTERNATIVAS (1–2 frases cada, ângulos genuinamente distintos — contrário/dados/história pessoal/contraintuitivo). ` +
    `Ao gerar mais, ACRESCENTE em siblings (máx. 8, remova as mais fracas se passar).`,
  conteudo: (itemId, lang) =>
    `→ escreva a seção \`draft\` via MCP manage_sections (action:update, item_id:${itemId}, section:draft, lang:${lang}) ` +
    `com shape {body: "<markdown>"}; leia ANTES a ideia (action:get section:ideia) e desenvolva o angle atual; ` +
    `markdown: H2/H3 a cada 300–400 palavras, 800+ palavras, listas onde couber, primeira pessoa; ` +
    `imagens: NÃO gere imagens — marque pontos de imagem com \`![img-<ref_id>: descrição](https://placehold.co/800x450)\` ` +
    `E registre cada uma em images_shared.body_images[] ({ref_id, description, placement:"after_h2:<n>"}); ` +
    `o editor do CMS renderiza esse markdown na primeira abertura do post.`,
  imagens: (itemId) =>
    `→ atualize a seção \`images\` (SHARED) via MCP manage_sections (action:update, item_id:${itemId}, section:images); ` +
    `leia primeiro (action:get) e PRESERVE image_url existentes; para a capa escreva cover.prompts = [{prompt, alt_text_pt, alt_text_en}] ` +
    `e para cada body_images[i] escreva prompts = [{prompt, alt_text_pt, alt_text_en}]. ` +
    `Cada \`prompt\` é um prompt PRONTO PRA MIDJOURNEY (inglês, descritivo, fotográfico/editorial coerente com o post, ` +
    `SEM texto dentro da imagem; capa: terminar com --ar 16:9; inline: --ar 16:9 salvo pedido). ` +
    `NÃO gere a imagem — o usuário roda no Midjourney e sobe o resultado no CMS.`,
  seo: (itemId, lang) =>
    `→ rode o auditor LOCAL: \`python3 ~/Workspace/youtube/seo_auditor.py <URL> --json-only\` ` +
    `(post publicado: URL pública + fase completa; rascunho: use --phase pre_publish com a URL de preview, ` +
    `ou audit_html() sobre o HTML do draft); defina --keyword se houver keyword-alvo. ` +
    `Depois grave um RESUMO via manage_sections (action:update, item_id:${itemId}, section:seo, lang:${lang}): ` +
    `leia a seção antes (action:get) e faça MERGE preservando campos existentes, escrevendo em \`audit\`: ` +
    `{score (número 0–100), grade ("A".."F"), ran_at (ISO), phase, keyword, ` +
    `issues: [{severity, check, msg, fix}] (só os 5–8 mais importantes, NÃO o JSON inteiro), ` +
    `title_suggestions: [{title, rationale}] (3–5 títulos igualmente bons ou melhores, ângulos distintos), ` +
    `meta_suggestion: {title, description} (40–60 / 120–160 chars)}.`,
  publicacao: () =>
    `→ modo CONVERSA (não escreva sections): leia o draft e a ideia (action:get) e responda no chat com ` +
    `sugestões prontas pra colar — caption por rede selecionada (Instagram/Bluesky/Facebook/Comunidade YouTube, ` +
    `respeitando o tom de cada uma), hashtags (5–10, misturando alcance e nicho) e o melhor horário relativo. ` +
    `O usuário cola no editor; a automação de captions por rede é v2.`,
}

export const BLOG_CW_PROMPTS: Record<BlogCoworkStage, string[]> = {
  ideia: ['Gerar 3 novas direções', 'Qual ângulo tem mais tração?', 'Cruzar com a pesquisa (Research)'],
  conteudo: ['Gerar o rascunho a partir da direção', 'Apertar a introdução', 'Sugerir subtítulos melhores', 'Encurtar 20% sem perder substância'],
  imagens: ['Gerar prompts pra todas as imagens', 'Prompt da capa (16:9, sem texto)', 'Variar o estilo dos prompts'],
  seo: ['Rodar auditoria SEO', 'Sugerir 5 títulos melhores', 'Gerar meta título + descrição', 'Ângulos alternativos de busca'],
  publicacao: ['Sugerir captions pras redes selecionadas', 'Gerar hashtags (alcance + nicho)', 'Qual rede combina mais com este post?'],
}

export const BLOG_CW_PLACEHOLDER: Record<BlogCoworkStage, string> = {
  ideia: 'ex.: e se o ângulo fosse mais contraintuitivo? me dá 3 caminhos…',
  conteudo: 'ex.: desenvolve a seção 2 com um exemplo real meu…',
  imagens: 'ex.: prompts mais cinematográficos, menos stock photo…',
  seo: 'ex.: roda a auditoria mirando a keyword "aprender inglês"…',
  publicacao: 'ex.: caption mais provocativa pro Bluesky, formal pro Facebook…',
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd apps/web && npx vitest run test/cms/blog-cowork.test.ts`
Expected: PASS (6 testes, "Test Files  1 passed")

- [ ] **Step 5: Estender `types.ts`**

Em `types.ts`:

```ts
// VersionContent — adicionar após `distribution: DistributionPlan`:
  seoAudit: SeoAudit | null

// SharedFields — adicionar após `coverPrompt: string`:
  direction: string
  directionAlts: string[]
  /** Prompt Midjourney por ref_id de imagem inline (de images_shared.body_images[].prompts). */
  imagePrompts: Record<string, string>

// EditorState — adicionar após `postId: string | null`:
  pipelineItemId: string | null

// Novo tipo (junto das interfaces):
/** Resumo da auditoria SEO gravado pelo Cowork em seo_{lang}.content.audit. */
export interface SeoAudit {
  score: number
  grade: string
  ranAt: string
  phase: 'pre_publish' | 'post_publish'
  keyword: string
  issues: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; check: string; msg: string; fix: string }>
  titleSuggestions: Array<{ title: string; rationale: string }>
  metaSuggestion: { title: string; description: string } | null
}

// EMPTY_VERSION — adicionar:
  seoAudit: null,
```

- [ ] **Step 6: Estender `reducer.ts`**

Em `ServerData` adicionar:

```ts
  pipelineItemId?: string | null
  direction?: string
  directionAlts?: string[]
  imagePrompts?: Record<string, string>
  seoAudit?: import('./types').SeoAudit | null
```

Em `buildInitialState`: no objeto `version` adicionar `seoAudit: data.seoAudit ?? null,`; no objeto de sibling adicionar `seoAudit: null,`; em `shared` adicionar `direction: data.direction ?? '', directionAlts: data.directionAlts ?? [], imagePrompts: data.imagePrompts ?? {},`; no retorno final adicionar `pipelineItemId: data.pipelineItemId ?? null,`.

- [ ] **Step 7: Carregar tudo no `page.tsx`**

Hoje as sections do pipeline são buscadas em DOIS lugares: dentro de `getPipelineBody` (linhas 33-49, fetch interno) e no branch `else if (pipelineItem)` (linhas 167-177, variável `pipelineSections` que é a ROW, não o record). Unificar:

7a. Adicionar `import type { SeoAudit } from './types'` no topo do arquivo.

7b. Mudar a assinatura de `getPipelineBody` para receber as sections já buscadas — remover o fetch interno (linhas 34-41) e o parâmetro `pipelineItemId`. O fallback `body_content` é preservado via terceiro parâmetro (versão final, colar como está):

```ts
async function getPipelineBody(
  sections: Record<string, unknown> | null,
  locale: string,
  bodyContent: string | null = null,
): Promise<PipelineBodyResult | null> {
  if (!sections && !bodyContent) return null
  const draftKey = locale === 'en' ? 'draft_en' : 'draft_pt'
  const draft = sections?.[draftKey] as { content?: { body?: unknown } } | undefined
  const draftBody = typeof draft?.content?.body === 'string' ? draft.content.body : null

  const markdown = draftBody || bodyContent
  if (!markdown || markdown.trim().length === 0) return null
  // … resto da função inalterado (o `await marked.parse(markdown)` permanece —
  // a função segue legitimamente async; figuras + cover seguem lendo de
  // `sections?.['images_shared']` via o parâmetro) …
```

7c. Substituir os blocos das linhas 153-177 por um fetch único + derivação:

```ts
  // 4. Sections do pipeline (fetch único) — draft fallback, cover, direção, prompts, seo audit
  let sectionsMap: Record<string, unknown> | null = null
  let pipelineBodyContent: string | null = null
  if (pipelineItem) {
    const { data: itemRow } = await supabase
      .from('content_pipeline')
      .select('sections, body_content')
      .eq('id', pipelineItem.id)
      .single()
    sectionsMap = (itemRow?.sections as Record<string, unknown> | null) ?? null
    pipelineBodyContent = (itemRow?.body_content as string | null) ?? null
  }

  let contentJson = tx.content_json as Record<string, unknown> | null
  let contentHtml = tx.content_html as string | null
  let coverPrompt = ''
  let pipelineCoverUrl: string | null = null

  if (isContentJsonEmpty(contentJson) && pipelineItem) {
    const pipelineBody = await getPipelineBody(sectionsMap, tx.locale, pipelineBodyContent)
    if (pipelineBody) {
      contentJson = null
      contentHtml = pipelineBody.html
      coverPrompt = pipelineBody.coverPrompt
      pipelineCoverUrl = pipelineBody.coverImageUrl
    }
  } else if (sectionsMap) {
    const cover = (sectionsMap['images_shared'] as {
      content?: { cover?: { prompts?: Array<{ prompt?: string }>; image_url?: string | null } }
    } | undefined)?.content?.cover
    coverPrompt = cover?.prompts?.[0]?.prompt ?? ''
    pipelineCoverUrl = cover?.image_url ?? null
  }

  // Pipeline extras: direção + alternativas (ideia_shared), prompts por imagem
  // (images_shared) e auditoria SEO (seo_{lang}.audit)
  let direction = ''
  let directionAlts: string[] = []
  const imagePrompts: Record<string, string> = {}
  let seoAudit: SeoAudit | null = null

  if (sectionsMap) {
    const ideia = sectionsMap['ideia_shared'] as
      | { content?: { angle?: string; siblings?: string[] } } | undefined
    direction = typeof ideia?.content?.angle === 'string' ? ideia.content.angle : ''
    directionAlts = Array.isArray(ideia?.content?.siblings)
      ? ideia.content.siblings.filter((s): s is string => typeof s === 'string')
      : []

    const imgs = sectionsMap['images_shared'] as
      | { content?: { body_images?: Array<{ ref_id?: string; prompts?: Array<{ prompt?: string }> }> } } | undefined
    for (const bi of imgs?.content?.body_images ?? []) {
      const p = bi.prompts?.[0]?.prompt
      if (bi.ref_id && typeof p === 'string' && p) {
        imagePrompts[bi.ref_id.startsWith('img-') ? bi.ref_id : `img-${bi.ref_id}`] = p
      }
    }

    const seoKey = tx.locale === 'en' ? 'seo_en' : 'seo_pt'
    const seoSection = sectionsMap[seoKey] as
      | { content?: { audit?: Record<string, unknown> } } | undefined
    const a = seoSection?.content?.audit
    if (a && typeof a.score === 'number') {
      seoAudit = {
        score: a.score,
        grade: typeof a.grade === 'string' ? a.grade : '',
        ranAt: typeof a.ran_at === 'string' ? a.ran_at : '',
        phase: a.phase === 'post_publish' ? 'post_publish' : 'pre_publish',
        keyword: typeof a.keyword === 'string' ? a.keyword : '',
        issues: Array.isArray(a.issues) ? (a.issues as SeoAudit['issues']) : [],
        titleSuggestions: Array.isArray(a.title_suggestions)
          ? (a.title_suggestions as SeoAudit['titleSuggestions']) : [],
        metaSuggestion: (a.meta_suggestion ?? null) as SeoAudit['metaSuggestion'],
      }
    }
  }
```

7d. Em `buildInitialState({...})` passar: `pipelineItemId: pipelineItem?.id ?? null, direction, directionAlts, imagePrompts, seoAudit,`.

7e. **Fixtures dos testes de stage:** o tsconfig exclui `test/**`, então os campos novos obrigatórios não quebram o typecheck — quebram em runtime no vitest. Rodar a suíte dos stages e atualizar os fixtures que constroem `shared`/`EditorState` literais (adicionar `direction: ''`, `directionAlts: []`, `imagePrompts: {}`, `pipelineItemId: null`, `seoAudit: null`):

Run: `cd apps/web && npx vitest run test/cms/blog --reporter=dot`
Expected: PASS após atualizar os fixtures.

- [ ] **Step 8: Criar o `BlogCoworkButton`**

Criar `blog-cowork-button.tsx`:

```tsx
'use client'

import { CoworkTrigger } from '@/app/cms/(authed)/_shared/cowork/cowork-trigger'
import { useEditorState } from './context'
import {
  buildBlogCoworkHeader, BLOG_STAGE_HINT, BLOG_CW_PROMPTS, BLOG_CW_PLACEHOLDER,
  type BlogCoworkStage,
} from './cowork'

export function BlogCoworkButton({
  stage, label = 'Cowork', compact,
}: { stage: BlogCoworkStage; label?: string; compact?: boolean }) {
  const state = useEditorState()
  // Sem item de pipeline linkado não há onde o Cowork escrever — degrada silenciosamente.
  if (!state.pipelineItemId || !state.postId) return null
  const header = buildBlogCoworkHeader({
    code: state.code,
    stage,
    lang: state.activeLang,
    pipelineItemId: state.pipelineItemId,
    postId: state.postId,
  })
  return (
    <CoworkTrigger
      header={header}
      hint={BLOG_STAGE_HINT[stage](state.pipelineItemId, state.activeLang)}
      prompts={BLOG_CW_PROMPTS[stage]}
      placeholder={BLOG_CW_PLACEHOLDER[stage]}
      subline="ele escreve direto no pipeline do post — direção, rascunho, prompts de imagem e SEO."
      label={label}
      compact={compact}
    />
  )
}
```

(Nenhum import de CSS necessário aqui — o `cowork.css` é importado pelo próprio `CoworkTrigger`, ver Task 1 Step 4.)

- [ ] **Step 9: Typecheck + testes**

Run: `npm run typecheck -w apps/web && cd apps/web && npx vitest run test/cms/blog-cowork.test.ts test/cms/blog-hub.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog apps/web/test/cms/blog-cowork.test.ts
git commit -m "feat(blog): pipeline context plumbing + cowork instruction builders"
```

---

## Task 3: Hub do blog no design system (kanban + KPIs)

⚠️ **Checkpoint visual antes de codar:** montar uma proposta (screenshot anotado ou mockup HTML) com as cores novas e obter OK do usuário.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts:66-72`
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx:176-213`
- Verify: `apps/web/test/cms/blog-hub.test.ts` (pode assertar cores)

- [ ] **Step 1: Trocar as cores das lanes**

As lanes hoje misturam paleta fora do sistema. Alinhar à semântica do vídeo (Ideia roxo, trabalho-em-curso âmbar, pronto ciano, agendado rosa, publicado verde) com os hex literais que o `video.css` resolve:

```ts
export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#8b5cf6', dataSource: 'pipeline' },       // cms-purple (= coluna Ideia do vídeo)
  { id: 'draft', label: 'Rascunho', color: '#f59e0b', dataSource: 'pipeline' },    // cms-amber (trabalho em curso)
  { id: 'ready', label: 'Entrega', color: '#06b6d4', dataSource: 'pipeline' },     // cms-cyan (pronto p/ promover)
  { id: 'scheduled', label: 'Agendado', color: '#f43f5e', dataSource: 'pipeline' },// cms-rose
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'pipeline' } // cms-green
]
```

- [ ] **Step 2: Rodar os testes do hub para detectar asserts de cor**

Run: `cd apps/web && npx vitest run test/cms/blog-hub.test.ts test/cms/blog-hub-components.test.tsx`
Expected: PASS — verificado na escrita do plano: esses testes não assertam cores de lane. (Se algum assert novo aparecer, atualizar pro hex novo.)

- [ ] **Step 3: Restylar os KPI cards e a busca**

Em `editorial-tab.tsx:176-213`, o grid de métricas usa `bg-gray-900/80 border-gray-800` + acentos `indigo` (o "azul"). Trocar pelo chrome quente do CMS — mesmo padrão de surface do vídeo, com acento laranja da marca para o card de pipeline:

```tsx
      <div role="group" aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#e8e6e3]">{totalItems}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#8a8782]">{strings?.editorial?.kpiTotal ?? 'Total'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(255,130,64,0.25)] bg-[rgba(255,130,64,0.06)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#ff8240]">{pipelineData.length}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[rgba(255,130,64,0.65)]">{strings?.pipeline?.inPipeline ?? 'Pipeline'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.05)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#22c55e]">{data.velocity.publishedCount}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[rgba(34,197,94,0.6)]">{strings?.editorial?.kpiPublished ?? 'Published'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#e8e6e3]">
            {data.velocity.throughput}<span className="text-sm font-semibold text-[#8a8782]">{strings?.editorial?.kpiThroughputUnit ?? '/mo'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#8a8782]">{strings?.editorial?.kpiThroughput ?? 'Throughput'}</span>
            {data.velocity.avgIdeaToPublished > 0 && (
              <span className="text-[10px] tabular-nums text-[#6b6863]" title="Average days from idea creation to publication">
                · {data.velocity.avgIdeaToPublished}d avg
              </span>
            )}
          </div>
        </div>
      </div>
```

No input de busca (linhas ~205-212), trocar `border-gray-800 bg-gray-900 … focus:border-indigo-500 focus:ring-indigo-500/30` por `border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] … focus:border-[#ff8240] focus:ring-[rgba(255,130,64,0.3)]`.

Varredura final (alvo: acentos indigo de chrome; manter cores semânticas de status como o emerald de Published):

```bash
grep -rn "indigo" "apps/web/src/app/cms/(authed)/blog/_tabs/editorial/" "apps/web/src/app/cms/(authed)/blog/_hub/"
```

Para cada hit que for chrome (botões primários, focus rings, links de empty-state — ex.: o `bg-indigo-500` do EmptyState em `editorial-tab.tsx:159`), trocar pelo acento laranja `#ff8240`/`rgba(255,130,64,…)`; hits que forem status semântico ficam.

- [ ] **Step 4: QA visual**

Abrir `/cms/blog` e comparar lado a lado com `/cms/video`: mesmo tom de surface, acento laranja, dots de lane na paleta cms. Screenshot pro usuário.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog apps/web/test/cms
git commit -m "fix(blog): hub kanban + KPIs on CMS design tokens (kill the blue)"
```

---

## Task 4: Stage Ideia — direção, alternativas e CTA dinâmico

⚠️ **Checkpoint visual antes de codar** (layout segue o `ideia-stage.tsx` do vídeo, adaptado).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/pipeline-actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/stages/stage-ideia.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/types.ts` (action nova)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/reducer.ts` (case novo)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/editor-theme.css` (estilos novos)

- [ ] **Step 1: Server action de swap de direção**

Criar `pipeline-actions.ts`:

Pontos não-negociáveis do design (aprendidos do service layer real):
- **Envelope de seção:** o caminho canônico (`patchSection`, `lib/pipeline/services/items.ts`) mantém `{rev, source, edited, content, updated_at, modified_by}` e usa `rev` pra detecção de conflito com o Cowork. A escrita aqui DEVE preservar esse envelope (rev+1, updated_at, source/edited), senão o Cowork recebe 409 permanente numa seção sem `rev`.
- **CAS de verdade:** Supabase `.update().eq(...)` que não casa linha retorna `error: null` com 0 rows — checar via `.select('id')` + resultado vazio, como `lib/pipeline/blog-sync.ts:11-27` faz.
- **`version` NÃO se seta manualmente:** o trigger `pipeline_updated_at` (migration `20260509000001`) incrementa sozinho.
- **Publish freeze:** `PUBLISHED_READONLY_BASES` inclui `ideia` para qualquer formato — num post publicado o próprio Cowork é recusado; esta action também recusa, mantendo a política consistente.

```ts
'use server'

import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPipelineItemForPost } from '@/lib/pipeline/blog-link'

export interface SwapDirectionResult {
  ok: boolean
  direction?: string
  directionAlts?: string[]
  error?: string
}

interface SectionEnvelope {
  rev?: number
  source?: string
  edited?: boolean
  updated_at?: string
  modified_by?: string
  content?: Record<string, unknown>
}

/**
 * Promove uma direção alternativa a direção atual no ideia_shared do item
 * linkado: a escolhida sai de `siblings`, o `angle` atual entra em `siblings`.
 * Preserva o envelope de seção (rev/source/edited) pra não quebrar a detecção
 * de conflito do Cowork, e usa CAS real no `version` do item (padrão blog-sync).
 */
export async function swapBlogDirection(
  postId: string,
  chosen: string,
): Promise<SwapDirectionResult> {
  await requireSiteAdminForRow('blog_posts', postId)
  const item = await getPipelineItemForPost(postId)
  if (!item) return { ok: false, error: 'no_pipeline_item' }

  const svc = getSupabaseServiceClient()
  const { data, error } = await svc
    .from('content_pipeline')
    .select('sections, version, stage')
    .eq('id', item.id)
    .single()
  if (error || !data) return { ok: false, error: 'load_failed' }
  // Mesma política do service layer: ideia é read-only após publicar.
  if (data.stage === 'published') return { ok: false, error: 'published_readonly' }

  const sections = (data.sections ?? {}) as Record<string, SectionEnvelope>
  const ideia: SectionEnvelope = sections['ideia_shared'] ?? {}
  const content = { ...(ideia.content ?? {}) }
  const currentAngle = typeof content.angle === 'string' ? content.angle : ''
  const siblings = (Array.isArray(content.siblings) ? content.siblings : [])
    .filter((s): s is string => typeof s === 'string')

  if (!siblings.includes(chosen)) return { ok: false, error: 'stale_alternative' }

  const nextSiblings = siblings.filter((s) => s !== chosen)
  if (currentAngle.trim()) nextSiblings.unshift(currentAngle)
  content.angle = chosen
  content.siblings = nextSiblings.slice(0, 8)

  const nextEnvelope: SectionEnvelope = {
    ...ideia,
    content,
    rev: (typeof ideia.rev === 'number' ? ideia.rev : 0) + 1,
    source: 'user',
    edited: true,
    updated_at: new Date().toISOString(),
    // modified_by é string livre nullable — o patchSection real faz pass-through
    // do payload (callers usam 'cowork-claude' ou o user id). 'cms-editor'
    // identifica esta origem (swap manual na UI) nos diffs de seção.
    modified_by: 'cms-editor',
  }

  // CAS: .eq('version') sem match retorna error:null + 0 rows — por isso o
  // .select('id') + checagem de vazio (mesmo padrão de lib/pipeline/blog-sync.ts).
  const { data: updated, error: writeError } = await svc
    .from('content_pipeline')
    .update({ sections: { ...sections, ideia_shared: nextEnvelope } })
    .eq('id', item.id)
    .eq('version', data.version)
    .select('id')
    .maybeSingle()
  if (writeError) return { ok: false, error: 'write_failed' }
  if (!updated) return { ok: false, error: 'version_conflict' } // Cowork escreveu no meio — recarregar

  return { ok: true, direction: chosen, directionAlts: content.siblings as string[] }
}
```

- [ ] **Step 2: Action + reducer case `SET_DIRECTION`**

Em `types.ts`, adicionar à union `EditorAction`:

```ts
  | { type: 'SET_DIRECTION'; direction: string; alts: string[] }
```

Em `reducer.ts`, no switch (junto de `SET_SHARED`):

```ts
    case 'SET_DIRECTION':
      return {
        ...state,
        shared: { ...state.shared, direction: action.direction, directionAlts: action.alts },
      }
```

- [ ] **Step 2b: Helper `bodyHasContent` (usado aqui e na Task 5)**

`!!version?.body` é armadilha: um doc TipTap vazio (`{type:'doc',content:[]}`) é truthy. Em `helpers.ts`, exportar um helper que reusa o walker existente `hasTextContent` (privado no arquivo — basta referenciá-lo):

```ts
/** True quando a versão tem corpo de verdade (texto no JSON OU html não-vazio). */
export function bodyHasContent(
  version: Pick<VersionContent, 'body' | 'bodyHtml'> | null | undefined,
): boolean {
  if (!version) return false
  if (hasTextContent(version.body)) return true
  return version.bodyHtml.trim().length > 0
}
```

(O `| null` é obrigatório: os call sites passam o retorno de `useEditorVersion()`, que é `VersionContent | null` — sem ele o strict typecheck falha.)

- [ ] **Step 3: Reescrever o `stage-ideia.tsx`**

Manter título/hook/sinopse exatamente como estão (linhas 40–126 atuais) e **acrescentar** entre `.idea-brief` e o botão `.idea-next`: card de direção + alternativas (espelha o vocabulário visual do vídeo: card rose de direção, chips de alternativas, "Gerar mais" roxo). Substituir também o botão final por CTA dinâmico.

Imports: o arquivo **já importa** `useCallback, useRef` de react, `ArrowRight` e os três hooks do context (linha 5) — adicionar apenas:

```tsx
import { useState } from 'react' // juntar ao import de react existente
import { toast } from 'sonner'
import { BlogCoworkButton } from '../blog-cowork-button'
import { swapBlogDirection } from '../pipeline-actions'
import { bodyHasContent } from '../helpers'
```

O componente já destrutura `const { shared, activeLang } = state` (linha 12) — `shared.direction`/`shared.directionAlts` ficam disponíveis. Adicionar dentro do componente, após os handlers existentes:

```tsx
  const [swapping, setSwapping] = useState<string | null>(null)
  const hasPipeline = !!state.pipelineItemId
  const isPublished = shared.status === 'published'
  const hasBody = bodyHasContent(version)

  const onSwap = async (alt: string) => {
    if (!state.postId || swapping) return
    setSwapping(alt)
    const res = await swapBlogDirection(state.postId, alt)
    setSwapping(null)
    if (res.ok && res.direction) {
      dispatch({ type: 'SET_DIRECTION', direction: res.direction, alts: res.directionAlts ?? [] })
      toast.success('Direção trocada')
    } else if (res.error === 'version_conflict' || res.error === 'stale_alternative') {
      toast.error('O Cowork mexeu nessa ideia agora — recarregue a página')
    } else if (res.error === 'published_readonly') {
      toast.error('Post publicado — a ideia fica congelada')
    } else {
      toast.error('Não consegui trocar a direção')
    }
  }

// JSX — inserir após o fechamento de `.idea-brief`:
      {hasPipeline && (
        <>
          <div className="idea-direction" data-testid="idea-direction">
            <div className="id-head">
              <span className="id-kick">✦ A direção</span>
              <span className="id-sub">o ângulo que o artigo vai desenvolver — ainda solto, de propósito</span>
            </div>
            <div className="id-body" data-empty={!shared.direction ? 'true' : 'false'}>
              {shared.direction || 'Sem direção ainda — peça ao Cowork pra propor uma.'}
            </div>
          </div>

          {/* ideia é read-only após publicar (PUBLISHED_READONLY_BASES no service
              layer recusa o próprio Cowork) — esconder geração/swap, manter o display */}
          {!isPublished && (
            <div className="idea-alts" data-testid="idea-alts">
              <div className="ia-head">
                <span className="ia-kick">✦ Outras direções do Cowork</span>
                <BlogCoworkButton stage="ideia" label="Gerar mais" compact />
              </div>
              {shared.directionAlts.length === 0 ? (
                <div className="ia-empty">Sem alternativas ainda — peça ao Cowork pra gerar algumas.</div>
              ) : (
                <div className="ia-list">
                  {shared.directionAlts.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      className="ia-alt"
                      disabled={swapping !== null}
                      onClick={() => onSwap(alt)}
                      title="Usar esta direção"
                    >
                      {swapping === alt ? 'trocando…' : alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

// CTA final — substituir o botão .idea-next atual por:
      <button type="button" className="idea-next" onClick={goToRascunho}>
        {hasBody
          ? <>Abrir o conteúdo <ArrowRight size={15} /></>
          : <>Conceito definido — gerar o conteúdo <ArrowRight size={15} /></>}
      </button>
```

- [ ] **Step 4: Estilos em `editor-theme.css`**

Adicionar (cores literais, paleta alinhada ao card de direção do vídeo — rose pra direção, roxo pro gerador):

```css
/* ---- Ideia: direção + alternativas (paridade com vídeo) ---- */
.idea-direction {
  margin-top: 22px; padding: 16px 18px; border-radius: 12px;
  border: 1px solid rgba(244, 63, 94, 0.28); background: rgba(244, 63, 94, 0.05);
}
.idea-direction .id-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 8px; }
.idea-direction .id-kick { font-size: 12px; font-weight: 700; color: #f43f5e; }
.idea-direction .id-sub { font-size: 11px; color: rgba(232, 230, 227, 0.45); }
.idea-direction .id-body { font-size: 14px; line-height: 1.55; color: #e8e6e3; }
.idea-direction .id-body[data-empty='true'] { color: rgba(232, 230, 227, 0.4); font-style: italic; }

.idea-alts { margin-top: 14px; }
.idea-alts .ia-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.idea-alts .ia-kick { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(232, 230, 227, 0.55); }
.idea-alts .ia-empty { font-size: 12px; color: rgba(232, 230, 227, 0.4); padding: 10px 2px; }
.idea-alts .ia-list { display: flex; flex-direction: column; gap: 6px; }
.idea-alts .ia-alt {
  text-align: left; font-size: 13px; line-height: 1.45; color: #d8d6d2;
  padding: 9px 12px; border-radius: 9px; cursor: pointer;
  border: 1px solid rgba(139, 92, 246, 0.22); background: rgba(139, 92, 246, 0.07);
  transition: border-color 0.15s, background 0.15s;
}
.idea-alts .ia-alt:hover { border-color: rgba(139, 92, 246, 0.5); background: rgba(139, 92, 246, 0.13); }
.idea-alts .ia-alt:disabled { opacity: 0.55; cursor: default; }
```

- [ ] **Step 5: Atualizar o teste do stage + rodar**

`apps/web/test/cms/blog/editor/stages/stage-ideia.test.tsx:127` asserta o texto antigo do CTA (`getByText(/escrever o conteúdo/)`). Atualizar para o comportamento novo:

```tsx
    expect(screen.getByText(/gerar o conteúdo/i)).toBeInTheDocument()
```

(e, se o fixture tiver corpo preenchido, assertar `/Abrir o conteúdo/i`). Fixtures ganham os campos novos do Step 7e da Task 2 se ainda não tiverem.

Run: `npm run typecheck -w apps/web`
Expected: PASS

Run: `cd apps/web && npx vitest run test/cms/blog/editor/stages/stage-ideia.test.tsx`
Expected: PASS

Nota de risco documentada: a action checa `stage === 'published'` no **item do pipeline** e a UI checa `shared.status === 'published'` no **post** — podem divergir por instantes (post publicado, item ainda sincronizando via `syncPipelineOnPostStatusChange`); nesse caso o toast `published_readonly` cobre.

QA manual: abrir um post linkado a pipeline (ex.: td-06) → ver direção/alternativas; pedir "Gerar 3 novas direções" → conferir clipboard/deep-link; clicar numa alternativa → swap persiste (recarregar e conferir). Post sem pipeline → seção não renderiza. Post publicado → direção visível, sem "Gerar mais"/swap.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog apps/web/test/cms/blog
git commit -m "feat(blog): ideia stage — direção, alternativas do Cowork e CTA dinâmico"
```

---

## Task 5: Stage Conteúdo — chooser vazio + refine + poll do draft

⚠️ **Checkpoint visual antes de codar** (chooser espelha o empty-state do roteiro de vídeo).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/use-pipeline-draft-poll.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/pipeline-actions.ts` (action de poll)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/stages/stage-rascunho.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/editor-theme.css`

- [ ] **Step 1: Server action de poll**

Adicionar em `pipeline-actions.ts`:

```ts
/** True quando o draft_{lang} do item linkado tem body não-vazio. */
export async function hasPipelineDraft(
  postId: string,
  lang: 'pt' | 'en',
): Promise<boolean> {
  await requireSiteAdminForRow('blog_posts', postId)
  const item = await getPipelineItemForPost(postId)
  if (!item) return false
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('sections')
    .eq('id', item.id)
    .single()
  const sections = data?.sections as Record<string, { content?: { body?: unknown } }> | null
  const body = sections?.[`draft_${lang}`]?.content?.body
  return typeof body === 'string' && body.trim().length > 0
}
```

- [ ] **Step 2: Hook de poll**

Criar `use-pipeline-draft-poll.ts`:

```ts
'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { hasPipelineDraft } from './pipeline-actions'

const POLL_MS = 5000

/**
 * Enquanto o corpo está vazio e existe item linkado, sonda o pipeline por um
 * draft escrito pelo Cowork. Quando aparece, FULL RELOAD — `router.refresh()`
 * NÃO serve aqui: o EditorProvider usa useReducer(initialState) e o EditorClient
 * é renderizado sem `key`, então um refresh do App Router preserva o estado
 * client e ignora o initialState novo. window.location.reload() remonta tudo e
 * o page.tsx converte o markdown do draft em HTML no load. Seguro: o corpo está
 * vazio por definição (condição do poll) — não há trabalho não-salvo a perder.
 */
export function usePipelineDraftPoll(opts: {
  enabled: boolean
  postId: string | null
  lang: 'pt' | 'en'
}) {
  const stopped = useRef(false)

  useEffect(() => {
    if (!opts.enabled || !opts.postId) return
    stopped.current = false
    const id = window.setInterval(async () => {
      if (stopped.current || document.hidden) return
      try {
        const ready = await hasPipelineDraft(opts.postId as string, opts.lang)
        if (ready && !stopped.current) {
          stopped.current = true
          window.clearInterval(id)
          toast.success('Cowork terminou o rascunho — carregando…')
          window.setTimeout(() => window.location.reload(), 600) // deixa o toast pintar
        }
      } catch { /* transient — tenta no próximo tick */ }
    }, POLL_MS)
    return () => { stopped.current = true; window.clearInterval(id) }
  }, [opts.enabled, opts.postId, opts.lang])
}
```

- [ ] **Step 3: Chooser no `stage-rascunho.tsx`**

Imports adicionais: `import { BlogCoworkButton } from '../blog-cowork-button'`, `import { usePipelineDraftPoll } from '../use-pipeline-draft-poll'`, `useState` (juntar ao import de react existente da linha 3) e `bodyHasContent` (juntar ao import de `../helpers` da linha 10, que já traz `resolveCategory`).

Dentro do componente, antes do `return` (NÃO usar `!!version?.body` — doc TipTap vazio é truthy; o helper da Task 4 Step 2b cobre isso):

```tsx
  const [startedBlank, setStartedBlank] = useState(false)
  const bodyEmpty = !bodyHasContent(version)
  const showChooser = bodyEmpty && !startedBlank && !!state.pipelineItemId

  usePipelineDraftPoll({
    enabled: showChooser,
    postId: state.postId,
    lang: state.activeLang,
  })
```

No JSX, imediatamente antes de `<div className="doc-prose">`:

```tsx
      {showChooser && (
        <div className="draft-chooser" data-testid="draft-chooser">
          <BlogCoworkButton stage="conteudo" label="Gerar conteúdo com Cowork" />
          <button type="button" className="dch-blank" onClick={() => setStartedBlank(true)}>
            + Começar do zero
          </button>
          <div className="dch-sub">O Cowork rascunha a partir da direção, ou comece do zero.</div>
        </div>
      )}
```

E, quando havia conteúdo (else implícito — sempre renderizado junto do `.doc-meta`), adicionar um refine compacto no fim da linha `.doc-meta`:

```tsx
        {!bodyEmpty && state.pipelineItemId && (
          <>
            <span className="msep">·</span>
            <BlogCoworkButton stage="conteudo" label="Refinar com Cowork" compact />
          </>
        )}
```

- [ ] **Step 4: Estilos**

Em `editor-theme.css`:

```css
/* ---- Conteúdo: chooser de geração (paridade com roteiro do vídeo) ---- */
.draft-chooser {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 18px 0 6px;
}
.draft-chooser .dch-blank {
  font-size: 13px; font-weight: 600; color: #d8d6d2; cursor: pointer;
  padding: 8px 14px; border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04);
}
.draft-chooser .dch-blank:hover { border-color: rgba(255, 255, 255, 0.25); }
.draft-chooser .dch-sub { flex-basis: 100%; font-size: 11.5px; color: rgba(232, 230, 227, 0.42); }
```

- [ ] **Step 5: Typecheck + testes do stage + QA**

Run: `npm run typecheck -w apps/web`
Expected: PASS

Run: `cd apps/web && npx vitest run test/cms/blog/editor/stages/stage-rascunho.test.tsx`
Expected: PASS (se o fixture renderizar com corpo vazio + `pipelineItemId` setado, o chooser novo aparece — ajustar asserts/fixtures conforme; com `pipelineItemId: null` nada muda nos asserts existentes)

QA: post com direção e corpo vazio → chooser aparece; "Começar do zero" some o chooser e o TipTap segue editável; disparar geração via Cowork → ao gravar `draft_pt`, em ≤5s o toast + refresh trazem o conteúdo. Post sem pipeline → sem chooser (TipTap normal).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog
git commit -m "feat(blog): conteúdo stage — chooser Cowork/zero + draft poll + refine"
```

---

## Task 6: Stage Imagens — prompts Midjourney no lugar do mock

⚠️ **Checkpoint visual antes de codar.**

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/stages/stage-imagens.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/editor-theme.css`

- [ ] **Step 1: Remover o mock de geração**

Em `stage-imagens.tsx`, deletar: `GenState`, `IMG_VARIANTS`, `MOCK_COVER`, `MOCK_INLINE`, `VariantPicker`, o estado `gen`, `startGen`, `cancelGen`, `pickCover`, `pickInline`, `genAll`, e os branches de render `coverGen === 'choosing' | 'generating'` / `tileGen` (o tile passa a ter só `done`/`empty`). A linha de imports do lucide fica exatamente assim (saem `Check` e `Sparkles` — só eram usados pelo mock; entra `Copy`):

```tsx
import { Image, CheckCircle, Info, Layers, ListChecks, RefreshCw, Eye, Copy } from 'lucide-react'
```

- [ ] **Step 2: Helper de cópia + imports novos**

```tsx
import { BlogCoworkButton } from '../blog-cowork-button' // (Copy já entrou no import do lucide no Step 1)

// dentro do componente:
  const copyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('Prompt copiado — cole no Midjourney')
    } catch {
      toast.error('Não consegui copiar — selecione o texto manualmente')
    }
  }, [])
```

- [ ] **Step 3: Header — "Gerar todas" vira gerador de prompts**

Substituir o bloco `{pendingCount > 0 && (<button … onClick={genAll}>Gerar todas…)}` por:

```tsx
        {pendingCount > 0 && state.pipelineItemId && (
          <BlogCoworkButton stage="imagens" label={`Gerar prompts (${pendingCount})`} />
        )}
```

- [ ] **Step 4: Capa — prompt card + ações**

No branch `cover-hero empty`, substituir `hero-empty-actions` por:

```tsx
              <div className="hero-empty-actions">
                {state.pipelineItemId && <BlogCoworkButton stage="imagens" label="Gerar prompt" compact />}
                <button
                  type="button"
                  className="btn"
                  onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
                >
                  <ListChecks size={15} /> Enviar imagem
                </button>
              </div>
              {state.shared.coverPrompt && (
                <div className="prompt-card" data-testid="cover-prompt">
                  <div className="pc-head">
                    <span>prompt · Midjourney</span>
                    <button type="button" className="pc-copy" onClick={() => copyPrompt(state.shared.coverPrompt)}>
                      <Copy size={12} /> Copiar
                    </button>
                  </div>
                  <div className="pc-text">{state.shared.coverPrompt}</div>
                  <div className="pc-hint">rode no Midjourney · 1200×675 · depois envie o resultado aqui</div>
                </div>
              )}
```

- [ ] **Step 5: Tiles inline — prompt por ref_id**

No branch vazio do tile (`tile-empty-actions`), substituir o botão "Gerar" mock por prompt + envio:

```tsx
                      <div className="tile-empty">
                        <span className="tile-empty-ic"><Image size={22} /></span>
                        <div className="tile-empty-actions">
                          <button
                            type="button"
                            className="btn sm"
                            data-testid={`img-gallery-${imgId}`}
                            onClick={() => {
                              setInlineTargetIndex(idx)
                              inlineGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS.free })
                            }}
                          >
                            <ListChecks size={13} /> Enviar
                          </button>
                        </div>
                      </div>
```

E no `tile-meta` (após `.tile-head`), exibir o prompt quando existir:

```tsx
                    {state.shared.imagePrompts[imgId] && (
                      <div className="pc-mini">
                        <button type="button" className="pc-copy" onClick={() => copyPrompt(state.shared.imagePrompts[imgId]!)}>
                          <Copy size={11} /> prompt
                        </button>
                        <span className="pc-mini-text">{state.shared.imagePrompts[imgId]}</span>
                      </div>
                    )}
```

- [ ] **Step 6: Estilos**

```css
/* ---- Imagens: prompt cards (Midjourney) ---- */
.prompt-card {
  margin-top: 12px; text-align: left; border-radius: 10px;
  border: 1px solid rgba(255, 130, 64, 0.22); background: rgba(255, 130, 64, 0.05);
  padding: 10px 12px; max-width: 560px;
}
.prompt-card .pc-head {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
  font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(255, 130, 64, 0.8);
}
.prompt-card .pc-copy, .pc-mini .pc-copy {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
  font-size: 11px; font-weight: 600; color: #ff8240;
  border: 1px solid rgba(255, 130, 64, 0.3); background: transparent;
  border-radius: 6px; padding: 2px 8px;
}
.prompt-card .pc-text { font-size: 12.5px; line-height: 1.5; color: #d8d6d2; font-family: ui-monospace, monospace; }
.prompt-card .pc-hint { margin-top: 6px; font-size: 10.5px; color: rgba(232, 230, 227, 0.4); }
.pc-mini { display: flex; gap: 8px; align-items: flex-start; margin-top: 6px; }
.pc-mini .pc-mini-text {
  font-size: 11px; line-height: 1.45; color: rgba(216, 214, 210, 0.75);
  font-family: ui-monospace, monospace;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
```

- [ ] **Step 7: Testes existentes + typecheck**

Run (da raiz): `npm run typecheck -w apps/web`
Expected: PASS

Run: `cd apps/web && npx vitest run test/cms/blog/editor/stages/stage-imagens.test.tsx`
Expected: asserts do mock ("Gerar com IA", VariantPicker) falham → atualizar para o fluxo novo (botão "Enviar", prompt card via `data-testid="cover-prompt"`); fixtures de `useEditorState` ganham `pipelineItemId: null` e `shared.imagePrompts: {}`. Re-rodar → PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/blog" apps/web/test/cms/blog
git commit -m "feat(blog): imagens stage — prompts Midjourney via Cowork (mata o mock de IA)"
```

---

## Task 7: Stage SEO — auditoria, score e sugestões de título

⚠️ **Checkpoint visual antes de codar.**

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/stages/stage-seo.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/editor-theme.css`

- [ ] **Step 1: Reescrever o `stage-seo.tsx`**

Manter os campos meta título/descrição + SERP preview intactos; **adicionar** acima deles o painel de auditoria e abaixo as sugestões:

```tsx
'use client'

import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { LANG_LABEL } from '../helpers'
import { BlogCoworkButton } from '../blog-cowork-button'

function charStatus(count: number, ideal: [number, number]): { label: string; cls: string } {
  if (count === 0) return { label: 'vazio', cls: '' }
  if (count < ideal[0]) return { label: 'curto', cls: '' }
  if (count <= ideal[1]) return { label: 'ideal', cls: 'ok' }
  return { label: 'pode truncar', cls: 'warn' }
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'crítico', high: 'alto', medium: 'médio', low: 'baixo',
}

function scoreTone(score: number): string {
  if (score >= 90) return 'ok'
  if (score >= 70) return 'warn'
  return 'bad'
}

export function StageSeo() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const audit = version.seoAudit
  const titleStatus = charStatus(version.metaTitle.length, [40, 60])
  const descStatus = charStatus(version.metaDesc.length, [120, 160])

  const serpTitle = version.metaTitle || version.title || 'Sem título'
  const serpDesc = version.metaDesc || version.excerpt || 'Sem descrição'
  const serpUrl = `bythiagofigueiredo.com/blog/${lang}/${version.slug || '...'}`

  const useTitle = (t: string) => {
    dispatch({ type: 'SET_TITLE', title: t })
    toast.success('Título aplicado')
  }
  const useAsMeta = (t: string) => {
    dispatch({ type: 'SET_FIELD', field: 'metaTitle', value: t })
    toast.success('Meta título aplicado')
  }
  const applyMetaSuggestion = () => {
    if (!audit?.metaSuggestion) return
    dispatch({ type: 'SET_FIELD', field: 'metaTitle', value: audit.metaSuggestion.title })
    dispatch({ type: 'SET_FIELD', field: 'metaDesc', value: audit.metaSuggestion.description })
    toast.success('Meta título + descrição aplicados')
  }

  return (
    <div>
      <div className="doc-kicker">SEO · {LANG_LABEL[lang] ?? lang.toUpperCase()}</div>
      {version.title && <h2 className="doc-title-sm">{version.title}</h2>}

      {/* ---- Auditoria ---- */}
      <section className="seo-audit" data-testid="seo-audit">
        {audit ? (
          <>
            <div className="sa-head">
              <div className={`sa-score ${scoreTone(audit.score)}`}>
                <b>{Math.round(audit.score)}</b>
                <span className="sa-grade">{audit.grade}</span>
              </div>
              <div className="sa-meta">
                <div className="sa-kick">Auditoria SEO · {audit.phase === 'pre_publish' ? 'pré-publicação' : 'pós-publicação'}</div>
                <div className="sa-sub">
                  {audit.keyword ? <>keyword: <b>{audit.keyword}</b> · </> : null}
                  {audit.ranAt ? new Date(audit.ranAt).toLocaleString('pt-BR') : ''}
                </div>
              </div>
              {state.pipelineItemId && <BlogCoworkButton stage="seo" label="Rodar de novo" compact />}
            </div>
            {audit.issues.length > 0 && (
              <ul className="sa-issues">
                {audit.issues.map((iss, i) => (
                  <li key={i} className={`sa-issue sev-${iss.severity}`}>
                    <span className="sa-sev">{SEVERITY_LABEL[iss.severity] ?? iss.severity}</span>
                    <span className="sa-check">{iss.check}</span>
                    <span className="sa-msg">{iss.msg}</span>
                    {iss.fix && <span className="sa-fix">→ {iss.fix}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="sa-empty">
            <div className="sa-kick">Auditoria SEO</div>
            <p>Sem auditoria ainda. O Cowork roda o <span className="mono">seo_auditor.py</span> (15 checks: headings, meta, schema, keywords, legibilidade…) e traz a pontuação pra cá.</p>
            {state.pipelineItemId
              ? <BlogCoworkButton stage="seo" label="Rodar auditoria SEO" />
              : <p className="sa-sub">Este post não tem item de pipeline linkado — link no Inspector pra habilitar.</p>}
          </div>
        )}
      </section>

      {/* ---- Sugestões de título ---- */}
      {audit && audit.titleSuggestions.length > 0 && (
        <section className="seo-suggestions" data-testid="seo-suggestions">
          <div className="doc-kicker">Títulos sugeridos</div>
          <ul className="ss-list">
            {audit.titleSuggestions.map((s, i) => (
              <li key={i} className="ss-item">
                <div className="ss-title">{s.title}</div>
                {s.rationale && <div className="ss-why">{s.rationale}</div>}
                <div className="ss-actions">
                  <button type="button" className="ss-use" onClick={() => useTitle(s.title)}>
                    <Check size={12} /> Usar como título
                  </button>
                  <button type="button" className="ss-use alt" onClick={() => useAsMeta(s.title)}>
                    Usar como meta título
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {audit?.metaSuggestion && (
        <button type="button" className="ss-use" style={{ marginTop: 10 }} onClick={applyMetaSuggestion}>
          <Check size={12} /> Aplicar meta título + descrição sugeridos
        </button>
      )}

      {/* ---- Meta title ---- */}
      {/* (bloco existente inalterado — input metaTitle com counter) */}
      {/* ---- Meta description ---- */}
      {/* (bloco existente inalterado — textarea metaDesc com counter) */}
      {/* ---- Google SERP preview ---- */}
      {/* (bloco existente inalterado) */}
    </div>
  )
}
```

(Os três blocos comentados são os já existentes nas linhas 41–89 do arquivo atual — manter byte a byte.)

- [ ] **Step 2: Estilos**

```css
/* ---- SEO: auditoria + sugestões ---- */
.seo-audit { margin-top: 24px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 18px; background: rgba(255, 255, 255, 0.02); }
.seo-audit .sa-head { display: flex; align-items: center; gap: 14px; }
.seo-audit .sa-score { display: flex; flex-direction: column; align-items: center; min-width: 64px; padding: 8px 10px; border-radius: 10px; }
.seo-audit .sa-score b { font-size: 26px; line-height: 1; }
.seo-audit .sa-score .sa-grade { font-size: 11px; font-weight: 700; opacity: 0.8; }
.seo-audit .sa-score.ok { color: #22c55e; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); }
.seo-audit .sa-score.warn { color: #f59e0b; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); }
.seo-audit .sa-score.bad { color: #f43f5e; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); }
.seo-audit .sa-meta { flex: 1; }
.seo-audit .sa-kick { font-size: 12px; font-weight: 700; color: #e8e6e3; }
.seo-audit .sa-sub { font-size: 11.5px; color: rgba(232, 230, 227, 0.5); margin-top: 2px; }
.seo-audit .sa-issues { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; list-style: none; padding: 0; }
.seo-audit .sa-issue { font-size: 12.5px; line-height: 1.5; display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.seo-audit .sa-sev { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 7px; border-radius: 99px; }
.seo-audit .sev-critical .sa-sev, .seo-audit .sev-high .sa-sev { color: #f43f5e; background: rgba(244, 63, 94, 0.12); }
.seo-audit .sev-medium .sa-sev { color: #f59e0b; background: rgba(245, 158, 11, 0.12); }
.seo-audit .sev-low .sa-sev { color: #8a8782; background: rgba(255, 255, 255, 0.06); }
.seo-audit .sa-check { font-weight: 600; color: #d8d6d2; }
.seo-audit .sa-msg { color: rgba(216, 214, 210, 0.8); }
.seo-audit .sa-fix { flex-basis: 100%; color: rgba(34, 197, 94, 0.85); font-size: 12px; }
.seo-audit .sa-empty p { font-size: 12.5px; color: rgba(216, 214, 210, 0.7); margin: 8px 0 12px; max-width: 520px; }

.seo-suggestions { margin-top: 22px; }
.ss-list { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 10px; }
.ss-item { border: 1px solid rgba(139, 92, 246, 0.2); background: rgba(139, 92, 246, 0.05); border-radius: 10px; padding: 11px 13px; }
.ss-title { font-size: 13.5px; font-weight: 600; color: #e8e6e3; }
.ss-why { font-size: 11.5px; color: rgba(232, 230, 227, 0.5); margin-top: 3px; }
.ss-actions { display: flex; gap: 8px; margin-top: 8px; }
.ss-use { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11.5px; font-weight: 600; color: #ff8240; border: 1px solid rgba(255, 130, 64, 0.3); background: transparent; border-radius: 7px; padding: 4px 10px; }
.ss-use.alt { color: rgba(216, 214, 210, 0.8); border-color: rgba(255, 255, 255, 0.14); }
```

- [ ] **Step 3: Atualizar testes do stage SEO**

Os testes existentes usam `data-testid="meta-title-counter"`, `serp-url` etc. — devem continuar passando (`seoAudit: null` renderiza o empty-state da auditoria, que não interfere nos testids existentes):

Run: `cd apps/web && npx vitest run test/cms/blog/editor/stages/stage-seo.test.tsx`
Expected: PASS (fixtures de `useEditorState` ganham `pipelineItemId: null`; versões nos fixtures ganham `seoAudit: null` — já coberto pelo `EMPTY_VERSION` quando usado)

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/blog" apps/web/test/cms/blog
git commit -m "feat(blog): seo stage — auditoria via seo_auditor + sugestões de título"
```

---

## Task 8: Publicação — distribuição persistida + social posts no publish

**Decisão de persistência (importante):** o autosave do editor só roda para status `idea`/`draft` (`AUTO_SAVE_STATUSES` em `types.ts` + `saveMode` em `context.tsx`) — e o stage Publicação é usado exatamente quando o post já é ready/scheduled/published. Persistir o plano via payload do autosave **perderia silenciosamente** a seleção nesses status. Por isso o plano persiste via **server action dedicada disparada no toggle** (`saveDistributionPlan`), independente do autosave; a coluna é per-post (shared entre idiomas), o que também elimina o drift de plano entre PT/EN.

**Files:**
- Create: migration via `npm run db:new add_blog_distribution_plan`
- Create: `apps/web/src/lib/social/distribution-to-config.ts`
- Create: `apps/web/test/cms/blog-distribution.test.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (saveDistributionPlan + publishPost)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx` (load)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/reducer.ts` (seed do plano)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/stages/distribution-planner.tsx` (persistir no toggle + copy do summary)

- [ ] **Step 1: Teste falhando do mapper**

Criar `apps/web/test/cms/blog-distribution.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { distributionToSocialConfig } from '@/lib/social/distribution-to-config'

describe('distributionToSocialConfig', () => {
  it('mapeia plataformas selecionadas e habilita', () => {
    const cfg = distributionToSocialConfig({ instagram: 'with', bluesky: 'plus1' }, ['#ai'])
    expect(cfg.enabled).toBe(true)
    expect(cfg.platforms.sort()).toEqual(['bluesky', 'instagram'])
    expect(cfg.hashtags).toEqual(['#ai'])
  })

  it('plano vazio desabilita', () => {
    const cfg = distributionToSocialConfig({}, [])
    expect(cfg.enabled).toBe(false)
    expect(cfg.platforms).toEqual([])
  })
})
```

Run: `cd apps/web && npx vitest run test/cms/blog-distribution.test.ts`
Expected: FAIL — "Cannot find module" apontando pro `distribution-to-config.ts` inexistente

- [ ] **Step 2: Implementar o mapper**

Criar `apps/web/src/lib/social/distribution-to-config.ts`. O tipo do plano **reusa** os unions já existentes do editor (`DistPlatformId`/`DistTiming` em `blog/[id]/edit/types.ts` — import type-only, sem ciclo de runtime; regra reuse-first do projeto). Os campos de `SocialConfig` abaixo foram conferidos contra `apps/web/src/lib/social/schemas.ts:15-23` na escrita do plano — batem exatos (`image_source: 'cover_image'` e `ig_template: 'card'` são valores válidos dos enums):

```ts
import type { SocialConfig } from './types'
import type { DistributionPlan } from '@/app/cms/(authed)/blog/[id]/edit/types'

export type BlogDistributionPlan = DistributionPlan

/**
 * Converte o plano de distribuição do editor de blog num SocialConfig pronto
 * pro createSocialPostFromContent. v1: timing por plataforma ainda não viaja
 * (um social_post ativo por conteúdo — índice idx_social_posts_active_per_content);
 * o post social sai junto da publicação do blog.
 */
export function distributionToSocialConfig(
  plan: BlogDistributionPlan,
  hashtags: string[],
): SocialConfig {
  const platforms = Object.keys(plan) as SocialConfig['platforms']
  return {
    enabled: platforms.length > 0,
    platforms,
    captions: {},
    hashtags,
    image_source: 'cover_image',
    ig_template: 'card',
    formats: {},
  }
}
```

Run: `cd apps/web && npx vitest run test/cms/blog-distribution.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 3: Migration**

```bash
npm run db:new add_blog_distribution_plan
```

Editar o arquivo gerado em `supabase/migrations/`:

```sql
-- Plano de distribuição social escolhido no editor de blog (per-post, shared
-- entre idiomas). Shape: {"instagram": "with" | "plus1" | "plus1d", ...}
alter table blog_posts
  add column if not exists distribution_plan jsonb not null default '{}'::jsonb;
```

Push: `npm run db:push:prod` (com confirmação YES — combinar com o usuário o momento).

- [ ] **Step 4: Server action `saveDistributionPlan` + persistência no toggle**

4a. Em `actions.ts`, adicionar (junto das outras granular actions, perto de `savePostField`):

```ts
import type { DistPlatformId, DistTiming } from './types'

const VALID_PLATFORMS = new Set<string>(
  ['instagram', 'bluesky', 'facebook', 'youtube'] satisfies DistPlatformId[],
)
const VALID_TIMINGS = new Set<string>(
  ['with', 'plus1', 'plus1d'] satisfies DistTiming[],
)

export async function saveDistributionPlan(
  postId: string,
  plan: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireSiteAdminForRow('blog_posts', postId)
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
  for (const [platform, timing] of Object.entries(plan)) {
    if (!VALID_PLATFORMS.has(platform) || !VALID_TIMINGS.has(timing)) {
      return { ok: false, error: 'invalid_plan' }
    }
  }
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ distribution_plan: plan })
    .eq('id', postId)
  if (error) return { ok: false, error: 'db_error' }
  return { ok: true }
}
```

(`actions.ts` é `'use server'` — constantes module-level não-exportadas são permitidas; se o lint do repo reclamar, mover os dois Sets pra dentro da função.)

4b. Em `distribution-planner.tsx`: o componente hoje usa só `useEditorVersion` + `useEditorDispatch` e tem **dois** handlers que despacham `SET_DIST` — `toggle` (timing implícito `plan[id] ? null : 'with'`) e `setWhen` (timing explícito). Adicionar o hook de estado e um helper único de persistência, chamado pelos dois:

```tsx
import { toast } from 'sonner'
import { useEditorState } from '../context' // juntar ao import de context existente
import { saveDistributionPlan } from '../actions'
import type { DistPlatformId, DistTiming } from '../types'

// dentro do componente:
  const state = useEditorState()

  /** Espelha a lógica do reducer (timing null remove) e persiste fire-and-forget. */
  const persistPlan = (platform: DistPlatformId, timing: DistTiming | null) => {
    const nextPlan = { ...(version?.distribution ?? {}) }
    if (timing === null) delete nextPlan[platform]
    else nextPlan[platform] = timing
    if (state.postId) {
      void saveDistributionPlan(state.postId, nextPlan as Record<string, string>).then((res) => {
        if (!res.ok) toast.error('Não consegui salvar a distribuição')
      })
    }
  }

// em `toggle`: após o dispatch, chamar persistPlan(id, plan[id] ? null : 'with')
// em `setWhen`: após o dispatch, chamar persistPlan(id, w)
```

4c. Em `reducer.ts`, reescrever o case `SET_DIST` para espelhar a mudança em **TODAS** as línguas (o plano é per-post no DB; manter per-lang no estado causaria write-loss cross-idioma: toggle em PT → troca pra EN → toggle em EN persistiria o snapshot stale apagando o do PT):

```ts
    case 'SET_DIST': {
      const lang = state.activeLang
      const version = state.content[lang]
      if (!version) return state
      const next = { ...version.distribution }
      if (action.timing === null) {
        delete next[action.platform]
      } else {
        next[action.platform] = action.timing
      }
      // O plano é per-post (coluna distribution_plan) — espelha em todas as
      // línguas pra view PT/EN nunca divergir. Persistido via
      // saveDistributionPlan() no próprio toggle (o autosave não roda em posts
      // ready/published — ver AUTO_SAVE_STATUSES). Não marca dirty.
      const content = { ...state.content }
      for (const key of Object.keys(content) as Array<'pt' | 'en'>) {
        const v = content[key]
        if (v) content[key] = { ...v, distribution: next }
      }
      return { ...state, content }
    }
```

4d. Em `page.tsx`: incluir `distribution_plan` no select de `blog_posts` (linha ~126); em `reducer.ts` adicionar `distributionPlan?: Record<string, 'with' | 'plus1' | 'plus1d'>` ao `ServerData` e seedar `distribution: (data.distributionPlan ?? {}) as VersionContent['distribution']` no `version` **e** no loop de siblings (plano é per-post/shared; seedar igual nas duas versões); em `page.tsx`, passar `distributionPlan: (post.distribution_plan ?? {}) as Record<string, 'with' | 'plus1' | 'plus1d'>,` no `buildInitialState`.

- [ ] **Step 5: Materializar no publishPost**

Em `actions.ts` `publishPost`, após o bloco `social_config` existente, adicionar (mantendo o fluxo antigo intacto — o plano do editor tem precedência apenas quando preenchido):

```ts
  // Distribuição planejada no editor (stage Publicação) — materializa social post
  const { data: postRow } = await getSupabaseServiceClient()
    .from('blog_posts')
    .select('distribution_plan')
    .eq('id', id)
    .single()
  const plan = (postRow?.distribution_plan ?? {}) as import('@/lib/social/distribution-to-config').BlogDistributionPlan
  if (Object.keys(plan).length > 0 && !postWithSocial.social_config?.enabled) {
    const [{ distributionToSocialConfig }, { createSocialPostFromContent }] = await Promise.all([
      import('@/lib/social/distribution-to-config'),
      import('@/lib/social/create-from-content'),
    ])
    const { data: tagRows } = await getSupabaseServiceClient()
      .from('post_hashtags').select('hashtags(name)').eq('post_id', id)
    const hashtags = ((tagRows ?? []) as unknown as Array<{ hashtags: { name: string } | null }>)
      .map(r => r.hashtags?.name).filter((n): n is string => !!n)
    createSocialPostFromContent({
      supabase: getSupabaseServiceClient(),
      siteId,
      contentType: 'blog',
      contentId: id,
      config: distributionToSocialConfig(plan, hashtags),
      origin: 'publish_modal',
      userId: 'system',
    }).catch((err: unknown) =>
      Sentry.captureException(err, {
        tags: { context: 'blog-distribution-publish', contentType: 'blog' },
        extra: { postId: id },
      }),
    )
  }
```

**Atualizar o mock de `cms-blog-actions.test.ts` (senão os testes de publishPost quebram):** o `fromMock` do teste (`apps/web/test/app/cms-blog-actions.test.ts:82`) só implementa `{ update: … }` — o novo `.select('distribution_plan').eq('id', …).single()` daria TypeError. Estender o mock pra `blog_posts` com a chain de leitura devolvendo plano vazio (assim o branch novo é no-op e os asserts existentes seguem valendo):

```ts
// o fromMock retorna o mesmo objeto pra qualquer tabela — incluir a chain de
// leitura junto do `update` existente nesse objeto:
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: { distribution_plan: {} }, error: null })),
    })),
  })),
```

(Com plano vazio o fetch de `post_hashtags` nem roda. Opcional: um teste novo cobrindo plano preenchido → `createSocialPostFromContent` chamado — bom de ter, não obrigatório.)

- [ ] **Step 6: UI do stage Publicação — copy honesto**

Em `distribution-planner.tsx`, o summary diz "{N} posts serão agendados ao publicar" — na v1 o post social sai **junto** da publicação (timing por rede é v2). Ajustar o copy para não prometer o que não acontece:

Alterar **somente** os substantivos do summary, preservando o ternário `scheduledMode` e o sufixo "· ajuste fino no Painel Social" existentes no JSX (código final do trecho, com o branch mantido):

```tsx
  {count} {count === 1 ? 'rede recebe o post' : 'redes recebem o post'}{' '}
  {scheduledMode ? 'junto com o agendamento' : 'ao publicar'}
```

Se `apps/web/test/cms/blog/editor/stages/stage-publicacao.test.tsx` assertar o copy antigo ("serão agendados"), atualizar o assert junto.

O botão "Abrir Painel Social" já aponta pra `/cms/social?post={id}` (`stage-publicacao.tsx:353`) — nenhuma mudança necessária.

Adicionar também o 1-clique do Cowork neste stage (modo conversa — captions/hashtags; ver hint `publicacao` na Task 2). O header "Distribuição nas redes" vive em `distribution-planner.tsx` (`.dist-head`) — o botão entra LÁ, à direita do título:

```tsx
import { BlogCoworkButton } from '../blog-cowork-button'

// dentro do elemento .dist-head, após o título:
  <BlogCoworkButton stage="publicacao" label="Captions com Cowork" compact />
```

Atenção ao mock: `stage-publicacao.test.tsx` mocka `[id]/edit/actions` exportando só `publishPost` — adicionar `saveDistributionPlan: vi.fn()` ao `vi.mock` (o planner agora importa esse export; sem ele o vitest acusa "No export defined on mock" assim que algum teste interagir com o toggle).

(O drift PT/EN do plano morreu no Step 4c — `SET_DIST` espelha em todas as línguas.)

- [ ] **Step 7: Testes + typecheck**

Run (da raiz): `npm run typecheck -w apps/web`
Expected: PASS

Run: `cd apps/web && npx vitest run test/cms/blog-distribution.test.ts test/app/cms-blog-actions.test.ts test/cms/blog/editor/stages/stage-publicacao.test.tsx`
Expected: PASS (após as duas atualizações de mock dos Steps 5 e 6 — fromMock com select chain e `saveDistributionPlan: vi.fn()`)

QA com DB local: `npm run db:start && cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration --reporter=dot` (suites de blog) — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations "apps/web/src/app/cms/(authed)/blog" apps/web/src/lib/social apps/web/test/cms/blog-distribution.test.ts apps/web/test/cms/blog
git commit -m "feat(blog): persist distribution plan + materialize social post on publish"
```

---

## Task 9: Enablement do Cowork — docs vivos

O Cowork só executa bem o que está documentado online. **Mecanismo real (verificado):** os shapes de sections vivem em `apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md`, servido do **filesystem** por `GET /api/pipeline/docs/items-and-sections` — entra no ar com o **deploy**, sem seed (o `scripts/seed-pipeline-reference.ts` removeu as entries de section-schemas — nota no próprio script, ~linha 96). O `docs/cowork-pipeline-reference.md` continua sendo a fonte canônica versionada para humanos/sessões e deve ficar em sincronia.

**Files:**
- Modify: `apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md` (o que o Cowork lê em produção)
- Modify: `docs/cowork-pipeline-reference.md` (fonte canônica no repo)

- [ ] **Step 1: Documentar os shapes novos do blog no doc Tier-2 (o que o Cowork lê)**

Em `apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md`, na parte de sections de `blog_post`, adicionar/atualizar (texto copy-pasteável, sem hardcode de thresholds — docs vivos):

```markdown
### blog_post · seção `ideia` (SHARED — sem lang)
{ premise, body (markdown), angle, vvs, cross_refs[],
  siblings: string[]   // direções ALTERNATIVAS (1–2 frases cada, ângulos distintos).
}                       // O editor exibe `angle` como "A direção" e `siblings` como
                        // "Outras direções"; trocar a direção via UI faz swap angle↔sibling.

### blog_post · seção `draft_{pt,en}`
{ body: "<markdown>" }  // H2/H3 a cada 300–400 palavras; imagens como
                        // ![img-<ref_id>: descrição](https://placehold.co/800x450)
                        // registradas também em images_shared.body_images[].

### blog_post · seção `images` (SHARED)
{ cover: { prompts: [{prompt, alt_text_pt, alt_text_en}], image_url },
  body_images: [{ ref_id, description, placement: "after_h2:<n>" | "after_paragraph:<n>",
                  prompts: [{prompt, alt_text_pt, alt_text_en}], url? }] }
// `prompt` = prompt PRONTO PRA MIDJOURNEY (inglês, sem texto na imagem; capa --ar 16:9).
// NUNCA gerar a imagem — o usuário roda no Midjourney e sobe no CMS.

### blog_post · seção `seo_{pt,en}`
{ keyword, meta_description, focus_keywords[],
  audit: {              // escrito pelo Cowork após rodar ~/Workspace/youtube/seo_auditor.py
    score, grade, ran_at, phase: "pre_publish"|"post_publish", keyword,
    issues: [{severity, check, msg, fix}],        // só os 5–8 mais importantes
    title_suggestions: [{title, rationale}],       // 3–5, ângulos distintos
    meta_suggestion: {title, description}
  } }
// Fluxo: post publicado → `python3 ~/Workspace/youtube/seo_auditor.py <url-pública> --json-only`;
// rascunho → `--phase pre_publish` (ou audit_html() sobre o HTML do draft). Sempre MERGE
// (action:get antes do update) — não apagar keyword/meta existentes.
```

No mesmo doc, adicionar uma subseção "Blog workflow no editor do CMS" descrevendo: (a) cada post de blog tem item linkado e o editor LÊ ideia_shared/draft/images/seo no load; (b) instruções chegam com header `[Blog <code> · <Stage> · <LANG> · item_id …]`; (c) os 4 fluxos (direções, draft, prompts de imagem, auditoria SEO) com os shapes acima; (d) `ideia` fica read-only após publish (PUBLISHED_READONLY_BASES). (Doc já tem ≥100 linhas e H1 — nenhum teste de registry é afetado: não há endpoint novo.)

- [ ] **Step 2: Espelhar na reference canônica do repo**

Copiar os mesmos blocos para `docs/cowork-pipeline-reference.md` na parte de `blog_post` (mantém a fonte versionada em sincronia com o que é servido).

- [ ] **Step 3: Validar o que o Cowork vai ler**

O route handler cacheia os docs em module-level — **(re)iniciar o dev server APÓS editar o .md** (`npm run dev -w apps/web`). A key não está no shell — exportar do `.env.local` primeiro:

```bash
export PIPELINE_COWORK_KEY=$(grep '^PIPELINE_COWORK_KEY=' apps/web/.env.local | cut -d= -f2-)
curl -s -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY" http://localhost:3000/api/pipeline/docs/items-and-sections | grep -c "siblings"
```

Expected: ≥1 — o doc servido contém os shapes novos. (Em produção entra no ar com o deploy do push final; **não** rodar seed — as entries de section-schemas foram removidas do seed script.)

- [ ] **Step 4: Rodar os testes de pipeline**

Run: `cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts test/api/pipeline/registry-completeness.test.ts`
Expected: PASS — sem mudanças de registry, os testes só confirmam que nada quebrou.

- [ ] **Step 5: Commit**

```bash
git add docs/cowork-pipeline-reference.md apps/web/data/pipeline-docs
git commit -m "docs(pipeline): blog sections — siblings, image prompts, seo audit"
```

---

## Task 10: Verificação final + push

- [ ] **Step 1: Gates locais completos**

```bash
npm run typecheck -w apps/web && npm run typecheck -w apps/api
cd apps/web && npx vitest run --reporter=dot
```
Expected: tudo PASS. (`npx vitest run` SEM path roda `test/**` E os testes em `src/**` — ex. `cowork-instructions.test.ts`. Não tocamos `packages/*/src` — `build:packages` não é necessário, mas o pre-commit roda de qualquer forma.)

- [ ] **Step 2: QA manual end-to-end (checklist)**

1. `/cms/blog` — kanban e KPIs no tom do CMS (sem azul/indigo), dnd funcionando.
2. Post com pipeline: Ideia mostra direção+alternativas; "Gerar mais" abre Cowork com instrução correta no clipboard.
3. Conteúdo vazio → chooser; Cowork escreve `draft_pt` → poll recarrega com o texto.
4. Imagens: prompt da capa visível + copiar; "Gerar prompts (N)" cobre as inline.
5. SEO: auditoria renderiza score/issues/sugestões; "Usar como título" aplica no editor (persistir segue o fluxo do status: autosave em idea/draft, botão Salvar em ready+).
6. Publicação: selecionar Instagram+Bluesky, salvar, publicar → social_post criado (conferir em `/cms/social`).
7. Post SEM pipeline: nenhum botão Cowork; editor funciona normal.
8. Vídeo: editor + popover Cowork inalterados (regressão da extração).

- [ ] **Step 3: Push único (budget-conscious)**

```bash
git push origin staging
```
Um push só com tudo verificado local (cada push dispara 4 builds Vercel). Acompanhar o build; **não** rebuildar local salvo falha real no Vercel.

---

## Self-review (escrita + rodada de revisão por 3 agentes independentes)

- **Cobertura do pedido:** kanban azul → Task 3; ideia sem geração/apresentação → Task 4; gerar conteúdo do vazio + 1-clique → Task 5; prompt de imagem p/ Midjourney (não gerar imagem) → Task 6; SEO com auditor + score + títulos/ângulos → Task 7; publicação/share posts → Task 8; confirmação "Pós/roteiro continua certo no vídeo" → sem task (já correto, screenshots 6–7). O 1-clique do Cowork existe nos 5 steps (Publicação em modo conversa — captions/hashtags; escrita automatizada de captions é v2). **Fora de escopo deliberado:** timing por plataforma na distribuição (v2 — um social_post ativo por conteúdo).
- **Sem placeholders:** todos os passos têm código/comando com cwd correto (`cd apps/web` para vitest — não há config na raiz); condicionais de runtime foram resolvidas na escrita (SocialConfig confere com `schemas.ts:15-23`; `/cms/social?post=` já existe; testes de hub não assertam cores).
- **Consistência de tipos:** `SeoAudit`, `BlogCoworkStage`, `BlogDistributionPlan` (= `DistributionPlan` do editor, reuse-first), `pipelineItemId`, `bodyHasContent` usados de forma idêntica entre Tasks 2, 4–8.
- **Correções incorporadas da revisão (3 agentes, leitura do código real):**
  1. Task 9 reescrita — docs Tier-2 são servidos do filesystem por `/api/pipeline/docs/[domain]` (deploy, não seed); o seed script removeu section-schemas.
  2. `swapBlogDirection` — CAS real via `.select('id').maybeSingle()` (update sem match retorna `error:null` + 0 rows), envelope de seção preservado (rev+1/source/edited/updated_at — sem isso o Cowork entra em 409 permanente), `version` é do trigger, e guard de `published` (PUBLISHED_READONLY_BASES congela `ideia` pra qualquer formato; UI esconde geração/swap quando publicado).
  3. Distribuição — autosave só roda em idea/draft (`AUTO_SAVE_STATUSES`), então a persistência é via `saveDistributionPlan` no toggle (corrige perda silenciosa em ready/published e o drift PT/EN); copy do summary ajustado pro comportamento v1 real.
  4. `bodyHasContent` substitui `!!version?.body` (doc TipTap vazio é truthy) nas Tasks 4 e 5.
  5. Extração CSS com regras de decisão explícitas (seletores agrupados se dividem; `.cw-spin`/override `.rot-gen-actions` ficam no vídeo; tokens `var(--cms-*)` resolvem sob o root do CMS + motion tokens incluídos).
  6. Snippets compilam como dados: `import type { SeoAudit }` no page.tsx, refactor do `getPipelineBody` com código completo (fetch único, `sectionsMap` sem colidir com a row), imports do stage-ideia/imagens sem duplicação.
- **Correções da 2ª rodada de revisão:** `bodyHasContent` aceita `| null` (retorno real do `useEditorVersion`); `distribution-planner` ganha `useEditorState` + helper `persistPlan` cobrindo os DOIS handlers (`toggle`/`setWhen`); wiring do CSS compartilhado virou import JS determinístico (sem condicional de `@import`); todos os comandos vitest com `cd apps/web` + typecheck sempre da raiz; testes de stage afetados nomeados explicitamente (`stage-ideia.test.tsx:127` CTA, `stage-imagens`, `stage-seo`, `stage-rascunho`, `stage-publicacao`) com step de atualização perto da causa; nota de que `tsconfig` exclui `test/**` (fixtures quebram no vitest, não no typecheck) + Step 7e na Task 2; Task 9 com export da key do `.env.local` e restart do dev server (cache module-level dos docs); Task 10 roda `vitest run` sem path (cobre `src/**`); sets de validação derivados de `DistPlatformId`/`DistTiming`; divergência stage-do-item × status-do-post documentada.
- **Correções da 3ª rodada:** poll de draft usa `window.location.reload()` — `router.refresh()` seria no-op (EditorProvider usa `useReducer(initialState)` sem `key`; refresh preserva estado client); `SET_DIST` espelha o plano em TODAS as línguas (mata write-loss cross-idioma na persistência); CSS importado uma vez dentro do próprio `CoworkTrigger` (único consumidor de `.cw-*`); Cowork no stage Publicação em modo conversa (captions/hashtags — fecha o "em nenhum dos steps"); `git add` por paths explícitos no repo multi-terminal (não stagear `handoff-sheet.tsx`/`editor-shell.tsx` de outro terminal); copy do summary preserva o branch `scheduledMode`; `modified_by` copiado do literal real do `patchSection`.
- **Riscos residuais:** (a) o split de regras CSS agrupadas exige atenção manual — QA visual do vídeo no Step 6 da Task 1 cobre regressão; (b) `version_conflict` no swap exige reload manual (aceitável, raro); (c) social post v1 sai imediato sem timing por rede — documentado na UI e no plano.
