// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { VChip } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

const CSS = fs.readFileSync(
  path.resolve(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog.css'),
  'utf8',
)

describe('M6 tokens .etd-tok', () => {
  it('declara os tokens fora do .etd, no escuro e no claro', () => {
    const escuro = CSS.match(/(^|\n)([^{}\n]*\.etd-tok[^{}]*)\{([^}]*)\}/g) ?? []
    expect(escuro.some((r) => !r.includes('[data-theme') && r.includes('--etd-info-bg') && r.includes('--etd-err'))).toBe(true)
    const claro = CSS.match(/\[data-theme="light"\][^{}]*\.etd-tok[^{}]*\{[^}]*\}/)?.[0] ?? ''
    expect(claro).toContain('--etd-err: #A4261B')
  })
  it('não usa color-mix', () => {
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('color-mix')
  })
  it('VChip tem letra escura e rótulo em português', () => {
    render(<VChip label="B" />)
    expect(screen.getByLabelText('Variante B').style.color).toBe('rgb(26, 18, 10)')
  })
})
