import { describe, it, expect } from 'vitest'
import { generateCsv, type CsvRow } from './csv-export.js'

describe('generateCsv', () => {
  it('generates header row from column names', () => {
    const columns = ['Link', 'Cliques', 'Unicos']
    const csv = generateCsv(columns, [])
    expect(csv).toBe('Link,Cliques,Unicos\r\n')
  })

  it('generates data rows', () => {
    const columns = ['Link', 'Cliques']
    const rows: CsvRow[] = [
      { Link: '/test', Cliques: '100' },
      { Link: '/blog', Cliques: '200' },
    ]
    const csv = generateCsv(columns, rows)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Link,Cliques')
    expect(lines[1]).toBe('/test,100')
    expect(lines[2]).toBe('/blog,200')
  })

  it('escapes values containing commas', () => {
    const columns = ['Title']
    const rows: CsvRow[] = [{ Title: 'Hello, World' }]
    const csv = generateCsv(columns, rows)
    expect(csv).toContain('"Hello, World"')
  })

  it('escapes values containing double quotes', () => {
    const columns = ['Title']
    const rows: CsvRow[] = [{ Title: 'He said "hello"' }]
    const csv = generateCsv(columns, rows)
    expect(csv).toContain('"He said ""hello"""')
  })

  it('handles empty rows array', () => {
    const csv = generateCsv(['A', 'B'], [])
    expect(csv).toBe('A,B\r\n')
  })

  it('handles values with newlines', () => {
    const columns = ['Desc']
    const rows: CsvRow[] = [{ Desc: 'Line1\nLine2' }]
    const csv = generateCsv(columns, rows)
    expect(csv).toContain('"Line1\nLine2"')
  })
})
