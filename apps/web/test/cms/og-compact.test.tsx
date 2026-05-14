import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('OgCompact', () => {
  it('renders og:title with character count', async () => {
    const { OgCompact } = await import(
      '@/app/cms/(authed)/_shared/social/og-compact'
    )

    render(
      <OgCompact
        ogTitle="AI Empire: O Que Vem Por Ai"
        ogDescription="O futuro da inteligencia artificial e como construir do zero"
        ogImage="https://example.com/og.jpg"
      />,
    )

    expect(screen.getByText('og:title')).toBeDefined()
    expect(screen.getByText(/AI Empire/)).toBeDefined()
    expect(screen.getByText(/\/60/)).toBeDefined()
  })

  it('renders og:description with character count', async () => {
    const { OgCompact } = await import(
      '@/app/cms/(authed)/_shared/social/og-compact'
    )

    render(
      <OgCompact
        ogTitle="Test"
        ogDescription="A medium-length description for testing"
        ogImage={null}
      />,
    )

    expect(screen.getByText('og:description')).toBeDefined()
    expect(screen.getByText(/\/155/)).toBeDefined()
  })

  it('renders og:image with thumbnail when URL provided', async () => {
    const { OgCompact } = await import(
      '@/app/cms/(authed)/_shared/social/og-compact'
    )

    const { container } = render(
      <OgCompact
        ogTitle="Title"
        ogDescription="Description"
        ogImage="https://example.com/image.jpg"
      />,
    )

    expect(screen.getByText('og:image')).toBeDefined()
    const img = container.querySelector('img')
    expect(img).toBeDefined()
    expect(img?.getAttribute('src')).toBe('https://example.com/image.jpg')
  })

  it('shows "Missing" when og:image is null', async () => {
    const { OgCompact } = await import(
      '@/app/cms/(authed)/_shared/social/og-compact'
    )

    render(
      <OgCompact ogTitle="Title" ogDescription="Desc" ogImage={null} />,
    )

    expect(screen.getByText(/missing/i)).toBeDefined()
  })

  it('renders all 3 columns', async () => {
    const { OgCompact } = await import(
      '@/app/cms/(authed)/_shared/social/og-compact'
    )

    const { container } = render(
      <OgCompact
        ogTitle="T"
        ogDescription="D"
        ogImage="https://example.com/i.jpg"
      />,
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeDefined()
    expect(grid?.children.length).toBe(3)
  })
})
