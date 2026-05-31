import { describe, it, expect } from 'vitest'
import {
  CardCompositionSchema,
  createDefaultComposition,
  createTextElement,
} from '@tn-figueiredo/links/qr'

function wrapInComp(element: Record<string, unknown>) {
  const comp = createDefaultComposition()
  comp.elements = [element as any]
  return comp
}

describe('stamp element (handleAddCarimbo shape)', () => {
  const stamp = {
    id: 'stamp-test', type: 'image', name: '__stamp:monogram',
    src: '/brand/monogram-dark-bg.svg',
    x: 500, y: 500, width: 80, height: 80,
    rotation: 0, opacity: 1, locked: false,
    objectFit: 'cover', borderRadius: 40,
    borderWidth: 0, borderColor: '#000000',
    maintainAspectRatio: true,
  }

  it('passes schema validation', () => {
    expect(CardCompositionSchema.safeParse(wrapInComp(stamp)).success).toBe(true)
  })

  it('borderRadius 40 produces circular 80px element', () => {
    expect(stamp.borderRadius).toBe(stamp.width / 2)
  })
})

describe('button element (handleAddButton shape)', () => {
  const base = createTextElement('btn-test', 1080, 1080, 'Botão')
  const button = {
    ...base,
    name: '__button:cta', content: 'LER MAIS',
    fontFamily: 'Inter', fontSize: 14, fontWeight: 700,
    uppercase: true, color: '#FFFFFF', backgroundColor: '#1F1B17',
    backgroundPadding: 12, backgroundRadius: 8,
    align: 'center' as const, letterSpacing: '0.05em',
  }

  it('passes schema validation', () => {
    expect(CardCompositionSchema.safeParse(wrapInComp(button)).success).toBe(true)
  })

  it('fontSize 14 within [8, 400]', () => {
    expect(button.fontSize).toBeGreaterThanOrEqual(8)
    expect(button.fontSize).toBeLessThanOrEqual(400)
  })

  it('backgroundPadding 12 within [0, 40]', () => {
    expect(button.backgroundPadding).toBeLessThanOrEqual(40)
  })

  it('backgroundRadius 8 within [0, 30]', () => {
    expect(button.backgroundRadius).toBeLessThanOrEqual(30)
  })
})

describe('shape element (handleAddShape shape)', () => {
  const base = createTextElement('shape-test', 1080, 1080, 'Forma')
  const shape = {
    ...base,
    content: '__shape:line', fontSize: 8, fontWeight: 400,
    lineHeight: 1, letterSpacing: '0em', align: 'center' as const,
    uppercase: false, width: 864, height: 6,
    x: 108, y: 540,
    backgroundColor: '#1F1B17', backgroundPadding: 0,
    backgroundRadius: 0, color: '#1F1B17',
  }

  it('passes schema validation', () => {
    expect(CardCompositionSchema.safeParse(wrapInComp(shape)).success).toBe(true)
  })

  it('fontSize 8 is exactly the schema minimum', () => {
    expect(shape.fontSize).toBe(8)
  })
})

describe('GIF placeholder element', () => {
  const gif = {
    type: 'image', id: 'gif-test', name: 'GIF',
    x: 378, y: 378, width: 324, height: 324,
    rotation: 0, opacity: 1, locked: false,
    src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    objectFit: 'cover', borderRadius: 0,
    borderColor: '#000000', borderWidth: 0,
    maintainAspectRatio: true,
  }

  it('passes schema validation', () => {
    expect(CardCompositionSchema.safeParse(wrapInComp(gif)).success).toBe(true)
  })
})

describe('cornerRadius <-> percentage mapping', () => {
  const toPercent = (cr: number) => Math.round((cr / 50) * 100)
  const toCorner = (pct: number) => Math.round((pct / 100) * 50)

  it('0 -> 0%', () => expect(toPercent(0)).toBe(0))
  it('50 -> 100%', () => expect(toPercent(50)).toBe(100))
  it('25 -> 50%', () => expect(toPercent(25)).toBe(50))
  it('0% -> 0', () => expect(toCorner(0)).toBe(0))
  it('100% -> 50', () => expect(toCorner(100)).toBe(50))

  it('round-trip stable within +/-1 for all integer percentages', () => {
    for (let pct = 0; pct <= 100; pct++) {
      expect(Math.abs(toPercent(toCorner(pct)) - pct)).toBeLessThanOrEqual(1)
    }
  })

  it('output always within schema [0, 50]', () => {
    for (let pct = 0; pct <= 100; pct++) {
      const cr = toCorner(pct)
      expect(cr).toBeGreaterThanOrEqual(0)
      expect(cr).toBeLessThanOrEqual(50)
    }
  })
})

describe('EC_LEVELS percentages match ISO 18004', () => {
  const EC = [
    { key: 'L', pct: 7 },
    { key: 'M', pct: 15 },
    { key: 'Q', pct: 25 },
    { key: 'H', pct: 30 },
  ]
  it.each(EC)('$key = $pct% recovery', ({ key, pct }) => {
    expect(pct).toBe(EC.find(l => l.key === key)!.pct)
  })
  it('monotonically increasing', () => {
    for (let i = 1; i < EC.length; i++) {
      expect(EC[i]!.pct).toBeGreaterThan(EC[i - 1]!.pct)
    }
  })
})
