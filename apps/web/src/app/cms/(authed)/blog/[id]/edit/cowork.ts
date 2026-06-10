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
