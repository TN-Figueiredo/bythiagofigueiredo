import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { AdCreativeData } from '../../../src/components/blog/ads'

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

// ---------- Mock creative factory ----------

function mockCreative(overrides: Partial<AdCreativeData> = {}): AdCreativeData {
  return {
    campaignId: 'test-campaign-1',
    slotKey: 'rail_left',
    type: 'house',
    source: 'campaign',
    interaction: 'link',
    title: 'Test Headline',
    body: 'Test body text for the ad.',
    ctaText: 'Click here →',
    ctaUrl: '#test-url',
    imageUrl: null,
    logoUrl: '/ads/logos/test.svg',
    brandColor: '#7B5BF7',
    dismissSeconds: 0,
    ...overrides,
  }
}

// ============ adLabel helper tests ============

describe('adLabel', () => {
  it('returns PATROCINADO for cpa pt-BR', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('cpa', 'pt-BR')).toBe('PATROCINADO')
  })

  it('returns SPONSORED for cpa en', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('cpa', 'en')).toBe('SPONSORED')
  })

  it('returns DA CASA for house pt-BR', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('house', 'pt-BR')).toBe('DA CASA')
  })

  it('returns HOUSE for house en', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('house', 'en')).toBe('HOUSE')
  })
})

// ============ useDismissable hook test ============

import { useDismissable } from '../../../src/components/blog/ads/use-dismissable'

describe('useDismissable', () => {
  function TestComponent({
    creative,
    onDismiss,
  }: {
    creative: AdCreativeData
    onDismiss?: () => void
  }) {
    const [dismissed, dismiss] = useDismissable(creative, onDismiss)
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
    const { getByTestId } = render(
      <TestComponent creative={mockCreative()} />,
    )
    expect(getByTestId('status').textContent).toBe('visible')
  })

  it('becomes dismissed on click and persists to localStorage', () => {
    const onDismiss = vi.fn()
    const creative = mockCreative()
    const { getByTestId } = render(
      <TestComponent creative={creative} onDismiss={onDismiss} />,
    )

    fireEvent.click(getByTestId('dismiss'))
    expect(getByTestId('status').textContent).toBe('dismissed')
    expect(onDismiss).toHaveBeenCalledOnce()

    const stored = JSON.parse(store['btf_ads_dismissed'] || '{}')
    expect(stored['rail_left_test-campaign-1']).toBeDefined()
  })

  it('uses slotKey_ph for placeholder dismiss key', () => {
    const creative = mockCreative({ campaignId: null, source: 'placeholder' })
    const { getByTestId } = render(<TestComponent creative={creative} />)

    fireEvent.click(getByTestId('dismiss'))
    const stored = JSON.parse(store['btf_ads_dismissed'] || '{}')
    expect(stored['rail_left_ph']).toBeDefined()
  })

  it('starts as dismissed when localStorage has the key', () => {
    const creative = mockCreative({ slotKey: 'banner_top', campaignId: 'abc' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'banner_top_abc': Date.now() })
    const { getByTestId } = render(<TestComponent creative={creative} />)
    expect(getByTestId('status').textContent).toBe('dismissed')
  })
})

// ============ Component render tests ============

describe('MarginaliaAd', () => {
  it('renders title and CTA', async () => {
    const { MarginaliaAd } = await import('../../../src/components/blog/ads/marginalia-ad')
    const creative = mockCreative({ slotKey: 'rail_left' })
    const { container } = render(<MarginaliaAd creative={creative} locale="pt-BR" />)
    expect(container.textContent).toContain('Test Headline')
    expect(container.textContent).toContain('Click here →')
  })

  it('returns null when dismissed', async () => {
    const creative = mockCreative({ slotKey: 'rail_left', campaignId: 'xyz' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'rail_left_xyz': Date.now() })
    const { MarginaliaAd } = await import('../../../src/components/blog/ads/marginalia-ad')
    const { container } = render(<MarginaliaAd creative={creative} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('AnchorAd', () => {
  it('renders logo img instead of dangerouslySetInnerHTML', async () => {
    const { AnchorAd } = await import('../../../src/components/blog/ads/anchor-ad')
    const creative = mockCreative({ slotKey: 'rail_right', type: 'cpa', logoUrl: '/ads/logos/test.svg' })
    const { container } = render(<AnchorAd creative={creative} locale="pt-BR" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('/ads/logos/test.svg')
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('BookmarkAd', () => {
  it('renders tape decoration and cream background', async () => {
    const { BookmarkAd } = await import('../../../src/components/blog/ads/bookmark-ad')
    const creative = mockCreative({ slotKey: 'inline_mid', type: 'cpa' })
    const { container } = render(<BookmarkAd creative={creative} locale="pt-BR" />)
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
    expect(container.textContent).toContain('Test Headline')
  })

  it('renders CTA as a link', async () => {
    const { BookmarkAd } = await import('../../../src/components/blog/ads/bookmark-ad')
    const creative = mockCreative({ slotKey: 'inline_mid' })
    const { container } = render(<BookmarkAd creative={creative} locale="en" />)
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('#test-url')
  })
})

describe('CodaAd', () => {
  it('renders logo img and content', async () => {
    const { CodaAd } = await import('../../../src/components/blog/ads/coda-ad')
    const creative = mockCreative({ slotKey: 'block_bottom', type: 'cpa' })
    const { container } = render(<CodaAd creative={creative} locale="pt-BR" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(container.textContent).toContain('Test Headline')
    expect(container.textContent).toContain('Test body text')
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('#test-url')
  })
})

describe('DoormanAd', () => {
  it('renders banner with title and CTA', async () => {
    const { DoormanAd } = await import('../../../src/components/blog/ads/doorman-ad')
    const creative = mockCreative({ slotKey: 'banner_top' })
    const { container } = render(<DoormanAd creative={creative} locale="pt-BR" />)
    expect(container.textContent).toContain('Test Headline')
  })

  it('returns null when dismissed', async () => {
    const creative = mockCreative({ slotKey: 'banner_top', campaignId: 'abc' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'banner_top_abc': Date.now() })
    const { DoormanAd } = await import('../../../src/components/blog/ads/doorman-ad')
    const { container } = render(<DoormanAd creative={creative} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('BowtieAd', () => {
  it('renders email form when interaction is form', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
    expect(container.querySelector('form')).toBeTruthy()
  })

  it('renders CTA link when interaction is link', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'link', type: 'cpa' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('#test-url')
  })

  it('shows confirmation after form submit', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)

    const input = container.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(container.textContent).toContain('Recebido. Confira sua caixa.')
  })

  it('renders tape decoration', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="en" />)
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
  })
})

// ============ Shared atoms ============

describe('AdLabel component', () => {
  it('renders label text and brand dot', async () => {
    const { AdLabel } = await import('../../../src/components/blog/ads/ad-label')
    const { container } = render(
      <AdLabel type="cpa" locale="pt-BR" brandColor="#7B5BF7" />,
    )
    expect(container.textContent).toContain('PATROCINADO')
    const dot = container.querySelector('span.inline-block')
    expect(dot).toBeTruthy()
  })
})

describe('DismissButton', () => {
  it('calls onClick and has aria-label', async () => {
    const { DismissButton } = await import('../../../src/components/blog/ads/dismiss-button')
    const onClick = vi.fn()
    const { getByRole } = render(
      <DismissButton onClick={onClick} label="Fechar" />,
    )
    const btn = getByRole('button', { name: 'Fechar' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
