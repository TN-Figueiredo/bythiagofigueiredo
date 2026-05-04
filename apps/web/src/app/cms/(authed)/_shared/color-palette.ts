export interface ColorPreset {
  light: string
  dark: string
  label: string
}

export const COLOR_PALETTE: ColorPreset[] = [
  { light: '#7c3aed', dark: '#a78bfa', label: 'Violet' },
  { light: '#ea580c', dark: '#fb923c', label: 'Orange' },
  { light: '#2563eb', dark: '#60a5fa', label: 'Blue' },
  { light: '#16a34a', dark: '#4ade80', label: 'Green' },
  { light: '#dc2626', dark: '#f87171', label: 'Red' },
  { light: '#ca8a04', dark: '#facc15', label: 'Gold' },
  { light: '#0891b2', dark: '#22d3ee', label: 'Cyan' },
  { light: '#db2777', dark: '#f472b6', label: 'Pink' },
]

export interface UsedColor {
  color: string
  entityName: string
}

export function findPresetByLight(hex: string): ColorPreset | undefined {
  return COLOR_PALETTE.find((p) => p.light.toLowerCase() === hex.toLowerCase())
}
