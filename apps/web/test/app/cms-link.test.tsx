// @vitest-environment jsdom
// Regression guard for the Next 16 /cms 500 (2026-09-06): the link handed to
// <CmsAdminProvider linkComponent> MUST come from a 'use client' module.
// `next/link` imported in a Server Component resolves to the react-server
// build and is not a client reference — passing it throws
// "Functions cannot be passed directly to Client Components".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="1" {...rest}>{children}</a>
  ),
}))

import CmsLink from '../../src/app/cms/(authed)/_shared/cms-link'

const WEB = join(__dirname, '..', '..')

describe('CmsLink (client wrapper for next/link)', () => {
  it('module is a client boundary', () => {
    const src = readFileSync(join(WEB, 'src/app/cms/(authed)/_shared/cms-link.tsx'), 'utf8')
    expect(src.trimStart().startsWith("'use client'")).toBe(true)
  })

  it('the authed layout passes CmsLink, never a bare next/link import', () => {
    const layout = readFileSync(join(WEB, 'src/app/cms/(authed)/layout.tsx'), 'utf8')
    expect(layout).toMatch(/linkComponent=\{CmsLink\}/)
    expect(layout).not.toMatch(/from 'next\/link'/)
  })

  it('forwards props to next/link', () => {
    const { getByRole } = render(
      <CmsLink href="/cms/blog" className="x" title="t">Blog</CmsLink>,
    )
    const a = getByRole('link', { name: 'Blog' })
    expect(a.getAttribute('href')).toBe('/cms/blog')
    expect(a.getAttribute('data-next-link')).toBe('1')
    expect(a.className).toBe('x')
  })
})
