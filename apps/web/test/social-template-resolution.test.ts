import { describe, it, expect } from 'vitest'
import {
  CONTENT_TYPES,
  type ContentType,
  type SocialTemplate,
} from '@/lib/social/template-schemas'

describe('ContentType', () => {
  it('includes blog, newsletter, video, generic', () => {
    expect(CONTENT_TYPES).toEqual(['blog', 'newsletter', 'video', 'generic'])
  })

  it('SocialTemplate interface has slug and content_type fields', () => {
    const template: SocialTemplate = {
      id: 'test',
      site_id: null,
      name: 'Test',
      slug: 'test-slug',
      content_type: 'blog',
      aspect_ratio: '9:16',
      composition: {
        version: 1,
        canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
        background: { type: 'solid', color: '#000000' },
        elements: [],
      },
      thumbnail_url: null,
      is_default: false,
      created_at: '',
      updated_at: '',
    }
    expect(template.slug).toBe('test-slug')
    expect(template.content_type).toBe('blog')
  })
})
