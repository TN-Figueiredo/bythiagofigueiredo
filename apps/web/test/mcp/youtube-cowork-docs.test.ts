/**
 * Cowork docs integrity tests — verifies that the YouTube pipeline
 * documentation file is complete, well-structured, and covers all
 * expected endpoint groups and workflows.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const docs = readFileSync(
  resolve(__dirname, '../../data/pipeline-docs/cowork-docs-youtube.md'),
  'utf-8',
)

// ---------------------------------------------------------------------------
// Section completeness
// ---------------------------------------------------------------------------

describe('cowork-docs-youtube section completeness', () => {
  const requiredSectionGroups = [
    { label: 'competitors', pattern: /Competitor Observatory/i },
    { label: 'analytics', pattern: /Performance Analytics/i },
    { label: 'videos', pattern: /Video Data/i },
    { label: 'categories', pattern: /categori/i },
    { label: 'ab-tests', pattern: /AB Lab/i },
    { label: 'thumbnails', pattern: /Thumbnail Library/i },
  ]

  for (const group of requiredSectionGroups) {
    it(`contains section for ${group.label}`, () => {
      expect(docs).toMatch(group.pattern)
    })
  }
})

// ---------------------------------------------------------------------------
// Workflow documentation
// ---------------------------------------------------------------------------

describe('cowork-docs-youtube workflow documentation', () => {
  it('contains workflow documentation section', () => {
    expect(docs).toMatch(/Workflows? de Referência/i)
  })

  it('documents Health Coach Analysis workflow', () => {
    expect(docs).toContain('Health Coach Analysis')
  })

  it('documents Competitor Monitoring workflow', () => {
    expect(docs).toContain('Competitor Monitoring')
  })

  it('documents Video Optimization workflow', () => {
    expect(docs).toContain('Video Optimization')
  })
})

// ---------------------------------------------------------------------------
// JSON response examples
// ---------------------------------------------------------------------------

describe('cowork-docs-youtube JSON examples', () => {
  // Split docs into major sections (## headings)
  const sectionSplits = docs.split(/(?=^## )/m).filter((s) => s.trim().length > 0)

  // Each major content section should have at least one JSON example
  const sectionsRequiringJson = [
    'Endpoints Pipeline',
    'Competitor Observatory',
    'Performance Analytics',
    'Video Data',
    'AB Lab Extended',
    'Thumbnail Library',
  ]

  for (const sectionName of sectionsRequiringJson) {
    it(`has at least one JSON example in "${sectionName}" section`, () => {
      const section = sectionSplits.find((s) => s.includes(sectionName))
      expect(section).toBeDefined()
      expect(section).toContain('```json')
    })
  }

  it('has a substantial number of JSON examples overall', () => {
    const jsonBlockCount = (docs.match(/```json/g) ?? []).length
    // Docs currently have 33 JSON blocks; at minimum each endpoint group needs one
    expect(jsonBlockCount).toBeGreaterThanOrEqual(6)
  })
})

// ---------------------------------------------------------------------------
// No broken markdown links
// ---------------------------------------------------------------------------

describe('cowork-docs-youtube markdown integrity', () => {
  it('has no broken markdown links (empty href)', () => {
    // Matches [text]() with empty parens
    const brokenLinks = docs.match(/\[[^\]]+\]\(\s*\)/g)
    expect(brokenLinks ?? []).toEqual([])
  })

  it('has no orphaned link references', () => {
    // Matches [text][ref] where ref is used but never defined
    const refLinks = docs.match(/\[[^\]]+\]\[[^\]]+\]/g) ?? []
    for (const link of refLinks) {
      const refMatch = link.match(/\]\[([^\]]+)\]/)
      if (refMatch) {
        const ref = refMatch[1]
        // Check that a definition like [ref]: url exists
        const defRegex = new RegExp(`^\\[${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:`, 'm')
        expect(docs).toMatch(defRegex)
      }
    }
  })

  it('has no unclosed code fences', () => {
    const openFences = (docs.match(/^```/gm) ?? []).length
    // Code fences come in pairs (open + close)
    expect(openFences % 2).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Endpoint coverage
// ---------------------------------------------------------------------------

describe('cowork-docs-youtube endpoint coverage', () => {
  it('documents at least 19 endpoints', () => {
    // Count unique endpoint declarations (METHOD /api/pipeline/youtube/...)
    const endpointMatches = docs.match(
      /(GET|POST|PATCH|PUT|DELETE)\s+\/api\/pipeline\/youtube[^\s]*/g,
    ) ?? []

    const uniqueEndpoints = new Set(endpointMatches)
    expect(uniqueEndpoints.size).toBeGreaterThanOrEqual(19)
  })

  it('covers intelligence endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/intelligence')
  })

  it('covers competitor endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/competitors/channels')
    expect(docs).toContain('/api/pipeline/youtube/competitors/outliers')
    expect(docs).toContain('/api/pipeline/youtube/competitors/insights')
    expect(docs).toContain('/api/pipeline/youtube/competitors/changes')
  })

  it('covers analytics endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/analytics/overview')
    expect(docs).toContain('/api/pipeline/youtube/analytics/grades')
    expect(docs).toContain('/api/pipeline/youtube/analytics/demographics')
    expect(docs).toContain('/api/pipeline/youtube/analytics/search-terms')
  })

  it('covers video endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/videos')
  })

  it('covers AB test endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/ab-tests')
  })

  it('covers thumbnail endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/thumbnails/library')
    expect(docs).toContain('/api/pipeline/youtube/thumbnails/fatigue')
  })

  it('covers category endpoints', () => {
    expect(docs).toContain('/api/pipeline/youtube/categories')
  })
})
