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
