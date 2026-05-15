import { describe, it, expect } from 'vitest'
import {
  getPriorityConfig,
  getStaleness,
  getVvsTier,
  getFormatIcon,
  getLangConfig,
  getCardState,
  isBlocked,
  getChecklistProgress,
  GEM_CSS_VARS,
} from '@/lib/pipeline/gem-design'

describe('gem-design', () => {
  describe('GEM_CSS_VARS', () => {
    it('exports surface vars', () => {
      expect(GEM_CSS_VARS['--gem-surface']).toBe('#161d2d')
      expect(GEM_CSS_VARS['--gem-well']).toBe('#0c1222')
    })
  })

  describe('getPriorityConfig', () => {
    it('returns red config for P5', () => {
      const c = getPriorityConfig(5)
      expect(c.accent).toBe('#ef4444')
      expect(c.label).toBe('P5')
      expect(c.className).toContain('priority-5')
    })

    it('returns amber config for P4', () => {
      const c = getPriorityConfig(4)
      expect(c.accent).toBe('#f59e0b')
      expect(c.label).toBe('P4')
    })

    it('returns indigo config for P3', () => {
      const c = getPriorityConfig(3)
      expect(c.accent).toBe('#6366f1')
    })

    it('returns sky config for P2', () => {
      const c = getPriorityConfig(2)
      expect(c.accent).toBe('#0ea5e9')
    })

    it('returns slate config for P1 and P0', () => {
      expect(getPriorityConfig(1).accent).toBe('#64748b')
      expect(getPriorityConfig(0).accent).toBe('#64748b')
    })
  })

  describe('getStaleness', () => {
    it('returns ok tier for items updated within 7 days', () => {
      const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(recent)
      expect(result.tier).toBe('ok')
      expect(result.days).toBe(3)
    })

    it('returns warn tier for 7-21 days', () => {
      const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(old)
      expect(result.tier).toBe('warn')
      expect(result.days).toBe(14)
    })

    it('returns old tier for >21 days', () => {
      const veryOld = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(veryOld)
      expect(result.tier).toBe('old')
      expect(result.days).toBe(30)
    })
  })

  describe('getVvsTier', () => {
    it('returns low tier for 0-30', () => {
      const r = getVvsTier(20)
      expect(r.tier).toBe('low')
      expect(r.color).toBe('#ef4444')
      expect(r.strokeDashoffset).toBeGreaterThan(0)
    })

    it('returns mid tier for 31-60', () => {
      expect(getVvsTier(45).tier).toBe('mid')
      expect(getVvsTier(45).color).toBe('#f59e0b')
    })

    it('returns high tier for 61-90', () => {
      expect(getVvsTier(75).tier).toBe('high')
      expect(getVvsTier(75).color).toBe('#10b981')
    })

    it('returns max tier for 91-100', () => {
      expect(getVvsTier(95).tier).toBe('max')
      expect(getVvsTier(95).color).toBe('#6366f1')
    })

    it('computes correct strokeDashoffset for ring', () => {
      const circumference = 2 * Math.PI * 10
      const result = getVvsTier(50)
      const expected = circumference - (50 / 100) * circumference
      expect(result.strokeDashoffset).toBeCloseTo(expected, 1)
    })
  })

  describe('getFormatIcon', () => {
    it('returns film emoji for video', () => {
      const r = getFormatIcon('video')
      expect(r.icon).toBe('🎬')
      expect(r.label).toBe('Video')
    })

    it('returns pen emoji for blog_post', () => {
      expect(getFormatIcon('blog_post').icon).toBe('✍️')
    })

    it('returns mail emoji for newsletter', () => {
      expect(getFormatIcon('newsletter').icon).toBe('📧')
    })

    it('returns cap emoji for course', () => {
      expect(getFormatIcon('course').icon).toBe('🎓')
    })

    it('returns megaphone emoji for campaign', () => {
      expect(getFormatIcon('campaign').icon).toBe('📣')
    })
  })

  describe('getLangConfig', () => {
    it('returns PT config for pt-br', () => {
      const r = getLangConfig('pt-br')
      expect(r.label).toBe('PT')
      expect(r.className).toContain('green')
    })

    it('returns EN config for en', () => {
      const r = getLangConfig('en')
      expect(r.label).toBe('EN')
      expect(r.className).toContain('blue')
    })

    it('returns PT+EN config for both', () => {
      const r = getLangConfig('both')
      expect(r.label).toBe('PT+EN')
      expect(r.className).toContain('indigo')
    })
  })

  describe('getCardState', () => {
    const base = {
      hook: null,
      body_content: null,
      youtube_video_id: null,
      blog_post_id: null,
      newsletter_edition_id: null,
      campaign_id: null,
      social_post_id: null,
      is_archived: false,
    }

    it('returns raw when no hook and no body', () => {
      expect(getCardState(base)).toBe('raw')
    })

    it('returns enriched when hook exists', () => {
      expect(getCardState({ ...base, hook: 'a hook' })).toBe('enriched')
    })

    it('returns enriched when body_content exists', () => {
      expect(getCardState({ ...base, body_content: 'content' })).toBe('enriched')
    })

    it('returns graduated when youtube_video_id set', () => {
      expect(getCardState({ ...base, hook: 'x', youtube_video_id: 'abc' })).toBe('graduated')
    })

    it('returns graduated when blog_post_id set', () => {
      expect(getCardState({ ...base, hook: 'x', blog_post_id: 'abc' })).toBe('graduated')
    })

    it('returns graduated when social_post_id set', () => {
      expect(getCardState({ ...base, hook: 'x', social_post_id: 'abc' })).toBe('graduated')
    })

    it('returns archived when is_archived true', () => {
      expect(getCardState({ ...base, is_archived: true })).toBe('archived')
    })
  })

  describe('isBlocked', () => {
    it('returns not blocked when no deps', () => {
      const r = isBlocked([])
      expect(r.blocked).toBe(false)
      expect(r.blockers).toEqual([])
    })

    it('returns blocked with blocker codes for hard deps', () => {
      const deps = [
        { dependency_type: 'hard', depends_on_pipeline: { code: 'vid-setup' } },
        { dependency_type: 'soft', depends_on_pipeline: { code: 'vid-intro' } },
      ]
      const r = isBlocked(deps)
      expect(r.blocked).toBe(true)
      expect(r.blockers).toEqual(['vid-setup'])
    })
  })

  describe('getChecklistProgress', () => {
    it('returns zero for empty checklist', () => {
      const r = getChecklistProgress([])
      expect(r.done).toBe(0)
      expect(r.total).toBe(0)
      expect(r.segments).toEqual([])
    })

    it('computes correct segments', () => {
      const checklist = [
        { label: 'A', done: true },
        { label: 'B', done: false },
        { label: 'C', done: true },
      ]
      const r = getChecklistProgress(checklist)
      expect(r.done).toBe(2)
      expect(r.total).toBe(3)
      expect(r.segments).toEqual([true, false, true])
    })
  })
})
