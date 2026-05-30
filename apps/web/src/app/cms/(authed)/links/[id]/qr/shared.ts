import type { CardComposition } from '@tn-figueiredo/links/qr'

export function sanitizeBlobUrls(comp: CardComposition): CardComposition {
  const background = comp.background.type === 'image' && comp.background.url.startsWith('blob:')
    ? { type: 'solid' as const, color: comp.background.fallbackColor }
    : comp.background
  const elements = comp.elements.filter(el => !(el.type === 'image' && el.src.startsWith('blob:')))
  return { ...comp, background, elements }
}
