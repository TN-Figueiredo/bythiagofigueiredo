import type { CardComposition, CardElement, Background } from './card-composition.js'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function renderBackground(bg: Background, width: number, height: number): string {
  switch (bg.type) {
    case 'solid':
      return `<rect width="${width}" height="${height}" fill="${escapeXml(bg.color)}" />`
    case 'gradient': {
      const id = 'bg-gradient'
      const rad = (bg.angle * Math.PI) / 180
      const x1 = 50 - Math.cos(rad) * 50
      const y1 = 50 - Math.sin(rad) * 50
      const x2 = 50 + Math.cos(rad) * 50
      const y2 = 50 + Math.sin(rad) * 50
      const stops = bg.stops
        .map(s => `<stop offset="${s.position * 100}%" stop-color="${escapeXml(s.color)}" />`)
        .join('\n      ')
      return `<defs>
    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${id})" />`
    }
    case 'image':
      return `<rect width="${width}" height="${height}" fill="${escapeXml(bg.fallbackColor)}" />
  <image href="${escapeXml(bg.url)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
  }
}

function buildTransform(el: CardElement): string {
  if (el.rotation === 0) return ''
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  return ` transform="rotate(${el.rotation}, ${cx}, ${cy})"`
}

function renderElement(el: CardElement): string {
  const transform = buildTransform(el)
  switch (el.type) {
    case 'qr':
      return `<rect${transform} x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${escapeXml(el.backgroundColor)}" opacity="${el.opacity}" rx="${el.cornerRadius}" />
  <text${transform} x="${el.x + el.width / 2}" y="${el.y + el.height / 2}" text-anchor="middle" dominant-baseline="central" fill="${escapeXml(el.foregroundColor)}" font-size="10" opacity="${el.opacity}">[QR]</text>`
    case 'text': {
      const text = el.uppercase ? el.content.toUpperCase() : el.content
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
      const tx = el.align === 'center' ? el.x + el.width / 2 : el.align === 'right' ? el.x + el.width : el.x
      return `<text${transform} x="${tx}" y="${el.y + el.fontSize}" fill="${escapeXml(el.color)}" font-family="${escapeXml(el.fontFamily)}" font-size="${el.fontSize}" font-weight="${el.fontWeight}" letter-spacing="${escapeXml(el.letterSpacing)}" text-anchor="${anchor}" opacity="${el.opacity}">${escapeXml(text)}</text>`
    }
    case 'image':
      return `<image${transform} href="${escapeXml(el.src)}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity}" preserveAspectRatio="xMidYMid slice" />`
  }
}

export function compositionToSvg(composition: CardComposition): string {
  const { canvas, background, elements } = composition
  const bg = renderBackground(background, canvas.width, canvas.height)
  const els = elements.map(renderElement).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <clipPath id="canvas-clip"><rect width="${canvas.width}" height="${canvas.height}" /></clipPath>
  <g clip-path="url(#canvas-clip)">
  ${bg}
  ${els}
  </g>
</svg>`
}
