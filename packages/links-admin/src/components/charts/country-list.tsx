import { useMemo } from 'react'

export interface CountryItem {
  code: string
  name: string
  v: number
  cities: string[]
}

export interface CountryListProps {
  countries: CountryItem[]
}

const FLAG: Record<string, string> = {
  BR: '\u{1F1E7}\u{1F1F7}',
  PT: '\u{1F1F5}\u{1F1F9}',
  US: '\u{1F1FA}\u{1F1F8}',
  ES: '\u{1F1EA}\u{1F1F8}',
  DE: '\u{1F1E9}\u{1F1EA}',
  FR: '\u{1F1EB}\u{1F1F7}',
  GB: '\u{1F1EC}\u{1F1E7}',
  AR: '\u{1F1E6}\u{1F1F7}',
  MX: '\u{1F1F2}\u{1F1FD}',
  JP: '\u{1F1EF}\u{1F1F5}',
}

export function CountryList({ countries }: CountryListProps) {
  const max = useMemo(() => Math.max(...countries.map((c) => c.v), 1), [countries])

  return (
    <div role="list" aria-label="Countries by traffic" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {countries.map((c) => (
        <div key={c.code} data-country role="listitem">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
            <span style={{ fontSize: 15 }}>{FLAG[c.code] || '\u{1F30E}'}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink, #ECE6DA)', flex: 1 }}>
              {c.name}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--ink-dim, #A39C8E)',
              }}
            >
              {c.v}%
            </span>
          </div>
          <div
            data-country-bar
            style={{
              height: 6,
              background: 'var(--surface-2, #1E1B16)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              data-country-bar-fill
              style={{
                width: `${(c.v / max) * 100}%`,
                height: '100%',
                background: 'var(--accent, #F2683C)',
                borderRadius: 99,
              }}
            />
          </div>
          {c.cities && c.cities.length > 0 && (
            <div
              data-cities
              style={{
                fontSize: 10.5,
                color: 'var(--ink-faint, #6E685D)',
                marginTop: 4,
                paddingLeft: 24,
              }}
            >
              {c.cities.join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
