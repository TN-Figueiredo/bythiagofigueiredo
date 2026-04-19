const CATEGORY_HUES: Record<string, [number, number]> = {
  tech: [220, 260],
  vida: [30, 60],
  viagem: [160, 200],
  crescimento: [100, 140],
  code: [200, 240],
  negocio: [350, 20],
}
const DEFAULT_HUES: [number, number] = [35, 50]

export function coverGradient(category: string | null, dark: boolean): string {
  const [h1, h2] = (category && CATEGORY_HUES[category]) ?? DEFAULT_HUES
  const s = dark ? 45 : 55
  const l = dark ? 28 : 72
  return `linear-gradient(135deg, hsl(${h1},${s}%,${l}%) 0%, hsl(${h2},${s}%,${l}%) 100%)`
}
