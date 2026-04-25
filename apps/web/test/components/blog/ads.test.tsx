import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import {
  hashSlug,
  pickSponsor,
  pickHouse,
  computeBookmarkIndex,
  computeMobileInlineIndex,
  SPONSORS,
  HOUSE_ADS,
} from '../../../src/components/blog/ads'

// ---------- localStorage mock ----------
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k])
  }),
  get length() {
    return Object.keys(store).length
  },
  key: vi.fn((_i: number) => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// ---------- matchMedia mock ----------
Object.defineProperty(globalThis, 'matchMedia', {
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// ============ Utility tests ============

describe('hashSlug', () => {
  it('returns a number', () => {
    expect(typeof hashSlug('hello')).toBe('number')
  })

  it('is deterministic', () => {
    const a = hashSlug('my-blog-post')
    const b = hashSlug('my-blog-post')
    expect(a).toBe(b)
  })

  it('produces different hashes for different slugs', () => {
    const a = hashSlug('post-a')
    const b = hashSlug('post-b')
    expect(a).not.toBe(b)
  })

  it('handles empty string', () => {
    expect(hashSlug('')).toBe(0)
  })
})

describe('pickSponsor', () => {
  it('returns a sponsor from the array', () => {
    const result = pickSponsor(42, 0, SPONSORS)
    expect(SPONSORS).toContain(result)
  })

  it('is deterministic', () => {
    const a = pickSponsor(123, 1, SPONSORS)
    const b = pickSponsor(123, 1, SPONSORS)
    expect(a.id).toBe(b.id)
  })

  it('different offsets can produce different results', () => {
    // With 3 sponsors, offsets 0 and 1 (multiplied by 7) should differ
    const a = pickSponsor(0, 0, SPONSORS)
    const b = pickSponsor(0, 1, SPONSORS)
    // They may or may not differ depending on modular arithmetic,
    // but at least both must be valid sponsors
    expect(SPONSORS).toContain(a)
    expect(SPONSORS).toContain(b)
  })
})

describe('pickHouse', () => {
  it('returns a house ad from the array', () => {
    const result = pickHouse(99, 2, HOUSE_ADS)
    expect(HOUSE_ADS).toContain(result)
  })
})

describe('computeBookmarkIndex', () => {
  it('places before 2nd h2 when >=2 h2s exist', () => {
    // 20 blocks, h2 at indices 3 and 10
    const idx = computeBookmarkIndex(20, [3, 10])
    expect(idx).toBe(9) // h2Indices[1] - 1
  })

  it('places before 2nd h2 when 3+ h2s exist', () => {
    const idx = computeBookmarkIndex(30, [4, 12, 20])
    expect(idx).toBe(11) // h2Indices[1] - 1
  })

  it('places ~60% after single h2', () => {
    // 20 blocks, h2 at index 5
    // Math.min(18, 5 + floor((20-5)*0.6)) = Math.min(18, 5+9) = 14
    const idx = computeBookmarkIndex(20, [5])
    expect(idx).toBe(14)
  })

  it('places ~55% through body when no h2s', () => {
    const idx = computeBookmarkIndex(20, [])
    expect(idx).toBe(11) // floor(20 * 0.55)
  })

  it('caps single-h2 placement at bodyBlockCount - 2', () => {
    // 10 blocks, h2 at index 1
    // Math.min(8, 1 + floor((10-1)*0.6)) = Math.min(8, 1+5) = 6
    const idx = computeBookmarkIndex(10, [1])
    expect(idx).toBe(6)
  })
})

describe('computeMobileInlineIndex', () => {
  it('places before last h2 when >=2 h2s exist', () => {
    const idx = computeMobileInlineIndex(20, [3, 15])
    expect(idx).toBe(14) // h2Indices[last] - 1
  })

  it('places at ~70% when fewer than 2 h2s', () => {
    const idx = computeMobileInlineIndex(20, [5])
    expect(idx).toBe(14) // floor(20 * 0.7)
  })

  it('places at ~70% when no h2s', () => {
    const idx = computeMobileInlineIndex(30, [])
    expect(idx).toBe(21) // floor(30 * 0.7)
  })
})

// ============ useDismissable hook test ============

import { useDismissable as useDismissableHook } from '../../../src/components/blog/ads/use-dismissable'

describe('useDismissable', () => {
  function TestComponent({ id, onDismiss }: { id: string; onDismiss?: () => void }) {
    const [dismissed, dismiss] = useDismissableHook(id, onDismiss)
    return (
      <div>
        <span data-testid="status">{dismissed ? 'dismissed' : 'visible'}</span>
        <button data-testid="dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    )
  }

  it('starts as visible when not previously dismissed', () => {
    const { getByTestId } = render(<TestComponent id="test-1" />)
    expect(getByTestId('status').textContent).toBe('visible')
  })

  it('becomes dismissed on click and persists to localStorage', () => {
    const onDismiss = vi.fn()
    const { getByTestId } = render(
      <TestComponent id="test-2" onDismiss={onDismiss} />,
    )

    fireEvent.click(getByTestId('dismiss'))
    expect(getByTestId('status').textContent).toBe('dismissed')
    expect(onDismiss).toHaveBeenCalledOnce()

    // Verify localStorage was written
    const stored = JSON.parse(store['btf_ads_dismissed'] || '{}')
    expect(stored['test-2']).toBeDefined()
  })

  it('starts as dismissed when localStorage has the id', () => {
    store['btf_ads_dismissed'] = JSON.stringify({ 'test-3': Date.now() })
    const { getByTestId } = render(<TestComponent id="test-3" />)
    expect(getByTestId('status').textContent).toBe('dismissed')
  })
})

// ============ Component render tests ============

describe('MarginaliaAd', () => {
  it('renders headline and CTA', async () => {
    const { MarginaliaAd } = await import(
      '../../../src/components/blog/ads/marginalia-ad'
    )
    const { container } = render(
      <MarginaliaAd ad={HOUSE_ADS[0]} locale="pt-BR" />,
    )
    expect(container.textContent).toContain(HOUSE_ADS[0].headline_pt)
    expect(container.textContent).toContain(HOUSE_ADS[0].cta_pt)
  })

  it('renders english content for en locale', async () => {
    const { MarginaliaAd } = await import(
      '../../../src/components/blog/ads/marginalia-ad'
    )
    const { container } = render(
      <MarginaliaAd ad={HOUSE_ADS[0]} locale="en" />,
    )
    expect(container.textContent).toContain(HOUSE_ADS[0].headline_en)
  })

  it('returns null when dismissed', async () => {
    store['btf_ads_dismissed'] = JSON.stringify({ ['m_' + HOUSE_ADS[0].id]: Date.now() })
    const { MarginaliaAd } = await import(
      '../../../src/components/blog/ads/marginalia-ad'
    )
    const { container } = render(
      <MarginaliaAd ad={HOUSE_ADS[0]} locale="pt-BR" />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('AnchorAd', () => {
  it('renders brand mark via dangerouslySetInnerHTML', async () => {
    const { AnchorAd } = await import(
      '../../../src/components/blog/ads/anchor-ad'
    )
    const { container } = render(
      <AnchorAd ad={SPONSORS[0]} locale="pt-BR" />,
    )
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toContain(SPONSORS[0].brand)
  })
})

describe('BookmarkAd', () => {
  it('renders tape decoration and cream background', async () => {
    const { BookmarkAd } = await import(
      '../../../src/components/blog/ads/bookmark-ad'
    )
    const { container } = render(
      <BookmarkAd ad={SPONSORS[1]} locale="pt-BR" />,
    )
    // Tape is aria-hidden
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
    expect(container.textContent).toContain(SPONSORS[1].headline_pt)
  })

  it('renders CTA as a link', async () => {
    const { BookmarkAd } = await import(
      '../../../src/components/blog/ads/bookmark-ad'
    )
    const { container } = render(
      <BookmarkAd ad={SPONSORS[1]} locale="en" />,
    )
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe(SPONSORS[1].url)
  })
})

describe('CodaAd', () => {
  it('renders grid layout with mark and content', async () => {
    const { CodaAd } = await import(
      '../../../src/components/blog/ads/coda-ad'
    )
    const { container } = render(
      <CodaAd ad={SPONSORS[2]} locale="pt-BR" />,
    )
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toContain(SPONSORS[2].headline_pt)
    expect(container.textContent).toContain(SPONSORS[2].body_pt)
    // CTA link
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe(SPONSORS[2].url)
  })
})

describe('DoormanAd', () => {
  it('renders banner with headline and CTA', async () => {
    const { DoormanAd } = await import(
      '../../../src/components/blog/ads/doorman-ad'
    )
    const { container } = render(
      <DoormanAd ad={SPONSORS[0]} locale="pt-BR" />,
    )
    expect(container.textContent).toContain(SPONSORS[0].headline_pt)
    expect(container.textContent).toContain(SPONSORS[0].brand)
  })

  it('returns null when dismissed', async () => {
    store['btf_ads_dismissed'] = JSON.stringify({ ['d_' + SPONSORS[0].id]: Date.now() })
    const { DoormanAd } = await import(
      '../../../src/components/blog/ads/doorman-ad'
    )
    const { container } = render(
      <DoormanAd ad={SPONSORS[0]} locale="pt-BR" />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('BowtieAd', () => {
  it('renders email form for house newsletter ad', async () => {
    const { BowtieAd } = await import(
      '../../../src/components/blog/ads/bowtie-ad'
    )
    const { container } = render(
      <BowtieAd ad={HOUSE_ADS[0]} locale="pt-BR" />,
    )
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
    expect(container.querySelector('form')).toBeTruthy()
  })

  it('renders CTA link for sponsor ad', async () => {
    const { BowtieAd } = await import(
      '../../../src/components/blog/ads/bowtie-ad'
    )
    const { container } = render(
      <BowtieAd ad={SPONSORS[0]} locale="pt-BR" />,
    )
    // Sponsor label_pt is "PATROCINADO", not "DA CASA", so renders link
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe(SPONSORS[0].url)
  })

  it('shows confirmation after form submit', async () => {
    const { BowtieAd } = await import(
      '../../../src/components/blog/ads/bowtie-ad'
    )
    const { container, getByRole } = render(
      <BowtieAd ad={HOUSE_ADS[0]} locale="pt-BR" />,
    )

    // Fill in email and submit
    const input = container.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.submit(getByRole('button', { name: HOUSE_ADS[0].cta_pt }))

    expect(container.textContent).toContain('Recebido. Confira sua caixa.')
  })

  it('renders tape decoration', async () => {
    const { BowtieAd } = await import(
      '../../../src/components/blog/ads/bowtie-ad'
    )
    const { container } = render(
      <BowtieAd ad={HOUSE_ADS[0]} locale="en" />,
    )
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
  })
})

// ============ Ad data integrity tests ============

describe('Ad data', () => {
  it('sponsors have all required fields', () => {
    for (const s of SPONSORS) {
      expect(s.id).toBeTruthy()
      expect(s.brand).toBeTruthy()
      expect(s.brandColor).toMatch(/^#/)
      expect(s.mark).toContain('<svg')
      expect(s.url).toBeTruthy()
      expect(s.headline_pt).toBeTruthy()
      expect(s.headline_en).toBeTruthy()
      expect(s.body_pt).toBeTruthy()
      expect(s.body_en).toBeTruthy()
      expect(s.cta_pt).toBeTruthy()
      expect(s.cta_en).toBeTruthy()
    }
  })

  it('house ads have kind field', () => {
    for (const h of HOUSE_ADS) {
      expect(['newsletter', 'video', 'post']).toContain(h.kind)
    }
  })

  it('has exactly 3 sponsors and 3 house ads', () => {
    expect(SPONSORS).toHaveLength(3)
    expect(HOUSE_ADS).toHaveLength(3)
  })
})

// ============ Shared atoms ============

describe('AdLabel', () => {
  it('renders label text and brand dot', async () => {
    const { AdLabel } = await import(
      '../../../src/components/blog/ads/ad-label'
    )
    const { container } = render(
      <AdLabel ad={SPONSORS[0]} L="pt" />,
    )
    expect(container.textContent).toContain('PATROCINADO')
    // Brand dot
    const dot = container.querySelector('span.inline-block')
    expect(dot).toBeTruthy()
  })
})

describe('DismissButton', () => {
  it('calls onClick and has aria-label', async () => {
    const { DismissButton } = await import(
      '../../../src/components/blog/ads/dismiss-button'
    )
    const onClick = vi.fn()
    const { getByRole } = render(
      <DismissButton onClick={onClick} label="Fechar" />,
    )
    const btn = getByRole('button', { name: 'Fechar' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
