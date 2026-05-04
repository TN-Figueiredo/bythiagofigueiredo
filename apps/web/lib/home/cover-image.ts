const CATEGORY_HUES: Record<string, [number, number]> = {
  tech: [220, 260],
  vida: [30, 60],
  viagem: [160, 200],
  crescimento: [100, 140],
  code: [200, 240],
  negocio: [350, 20],
}
const DEFAULT_HUES: [number, number] = [35, 50]

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === r) h = ((g - b) / d + 6) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return Math.round(h * 60)
}

export function coverGradient(tagOrCategory: string | null, dark: boolean, tagColor?: string | null): string {
  let h1: number, h2: number
  if (tagColor && /^#[0-9a-fA-F]{6}$/.test(tagColor)) {
    const hue = hexToHue(tagColor)
    h1 = (hue - 20 + 360) % 360
    h2 = (hue + 20) % 360
  } else {
    const pair = (tagOrCategory ? CATEGORY_HUES[tagOrCategory] : undefined) ?? DEFAULT_HUES
    h1 = pair[0]
    h2 = pair[1]
  }
  const s = dark ? 45 : 55
  const l = dark ? 28 : 72
  return `linear-gradient(135deg, hsl(${h1},${s}%,${l}%) 0%, hsl(${h2},${s}%,${l}%) 100%)`
}
