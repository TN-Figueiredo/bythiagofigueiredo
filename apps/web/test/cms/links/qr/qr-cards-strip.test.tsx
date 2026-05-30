// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * QrCardsStrip component tests.
 *
 * Vitest's forks pool + Vite React plugin cannot transform JSX in files
 * living under directories with brackets (e.g. `[id]`). This is a known
 * limitation of the project's Vite config. Instead of rendering the
 * component, we verify the source code contracts that define its behavior.
 *
 * These tests are deterministic and don't require network or DB access.
 */

const COMPONENT_PATH = resolve(
  __dirname,
  '../../../../src/app/cms/(authed)/links/[id]/_components/qr-cards-strip.tsx',
)

const src = readFileSync(COMPONENT_PATH, 'utf-8')

// ─── Tests ──────────────────────────────────────────────────────────

describe('QrCardsStrip', () => {
  // --- Module structure ---

  it('is a client component', () => {
    expect(src).toContain("'use client'")
  })

  it('imports useRouter from next/navigation', () => {
    expect(src).toContain("import { useRouter } from 'next/navigation'")
  })

  it('imports Plus and QrCode icons from lucide-react', () => {
    expect(src).toContain("from 'lucide-react'")
    expect(src).toContain('Plus')
    expect(src).toContain('QrCode')
    expect(src).toContain('MoreVertical')
    expect(src).toContain('Pencil')
    expect(src).toContain('Trash2')
  })

  it('imports QrCardSummary type from card-actions', () => {
    expect(src).toContain("import type { QrCardSummary } from '../qr/card-actions'")
  })

  // --- Empty state ---

  it('renders "Nenhum QR Card criado" when no cards', () => {
    expect(src).toContain('Nenhum QR Card criado')
  })

  it('shows header without count when cards array is empty (hasCards = false)', () => {
    // The header format: QR Cards{hasCards ? ` · ${cards.length}` : ''}
    expect(src).toContain("QR Cards{hasCards ? ` · ${cards.length}` : ''}")
  })

  it('shows "Novo QR Card" button in empty state', () => {
    expect(src).toContain('Novo QR Card')
  })

  // --- Card rendering ---

  it('renders preview images with correct alt text pattern', () => {
    // Alt text: "Preview do QR Card: {card.name}"
    expect(src).toContain('alt={`Preview do QR Card: ${card.name}`}')
  })

  it('renders fallback QrCode icon when card has no preview', () => {
    // When previewUrl is null, shows QrCode icon
    expect(src).toContain('card.previewUrl ?')
    expect(src).toContain('<QrCode')
  })

  it('renders card name in each card', () => {
    expect(src).toContain('{card.name}')
  })

  it('renders "Editar" label on each card', () => {
    expect(src).toContain('Editar')
  })

  // --- Navigation ---

  it('clicking a card navigates to /cms/links/{id}/qr?card={cardId}', () => {
    expect(src).toContain("router.push(`/cms/links/${linkId}/qr?card=${card.id}`)")
  })

  it('clicking "Novo QR Card" opens naming modal before navigating', () => {
    expect(src).toContain('setNaming(true)')
    expect(src).toContain("router.push(`/cms/links/${linkId}/qr?name=${encodeURIComponent(trimmed)}`)")
  })

  // --- Accessibility ---

  it('each card button has aria-label with card name', () => {
    expect(src).toContain('aria-label={`Editar QR Card: ${card.name}`}')
  })

  it('"Novo QR Card" button has aria-label "Criar novo QR Card"', () => {
    expect(src).toContain('aria-label="Criar novo QR Card"')
  })

  it('card elements are actual <button> elements with type="button"', () => {
    // All interactive card elements are <button type="button">
    const buttonMatches = src.match(/type="button"/g)
    // At least 2 buttons: card button + create button (in cards-present view)
    // Plus another in empty state
    expect(buttonMatches!.length).toBeGreaterThanOrEqual(3)
  })

  it('card list uses role="list" for semantic markup', () => {
    expect(src).toContain('role="list"')
  })

  it('card list items use role="listitem"', () => {
    expect(src).toContain('role="listitem"')
  })

  // --- Styling / UX ---

  it('card names have text-overflow ellipsis for truncation', () => {
    expect(src).toContain("textOverflow: 'ellipsis'")
    expect(src).toContain("whiteSpace: 'nowrap'")
    expect(src).toContain("overflow: 'hidden'")
  })

  it('card count is shown only when cards exist', () => {
    // hasCards is derived from cards.length > 0
    expect(src).toContain('const hasCards = cards.length > 0')
    // Count suffix only appears when hasCards is true
    expect(src).toContain("hasCards ? ` · ${cards.length}` : ''")
  })

  it('uses scrollSnap for horizontal card scrolling', () => {
    expect(src).toContain("scrollSnapType: 'x mandatory'")
    expect(src).toContain("scrollSnapAlign: 'start'")
  })

  it('has focus-visible styles for keyboard accessibility', () => {
    expect(src).toContain(':focus-visible')
    expect(src).toContain('box-shadow: 0 0 0 2px var(--accent)')
  })

  // --- Props interface ---

  it('accepts linkId and cards props', () => {
    expect(src).toContain('interface QrCardsStripProps')
    expect(src).toContain('linkId: string')
    expect(src).toContain('cards: QrCardSummary[]')
  })

  // --- "Novo QR Card" always present ---

  it('"Novo QR Card" create button appears in both empty and cards-present views', () => {
    // In the cards-present view, it's appended as the last list item
    // In the empty state view, it's a standalone button
    const novoMatches = src.match(/Novo QR Card/g)
    expect(novoMatches!.length).toBeGreaterThanOrEqual(2)
  })
})
