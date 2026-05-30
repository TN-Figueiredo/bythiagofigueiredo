// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

// ─── Mocks ───────────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  )
  return { Plus: icon('Plus'), QrCode: icon('QrCode') }
})

// ─── Import after mocks ─────────────────────────────────────────────

import { QrCardsStrip } from '@/app/cms/(authed)/links/[id]/_components/qr-cards-strip'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Fixtures ───────────────────────────────────────────────────────

function makeCards(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i + 1}`,
    name: `Card ${i + 1}`,
    previewUrl: i % 2 === 0 ? `https://cdn.example.com/preview-${i + 1}.png` : null,
    createdAt: '2026-05-01T00:00:00Z',
  }))
}

const LINK_ID = 'link-abc'

// ─── Tests ──────────────────────────────────────────────────────────

describe('QrCardsStrip', () => {
  // --- Empty state ---

  it('renders "Nenhum QR Card criado" when cards array is empty', () => {
    const { getByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    expect(getByText('Nenhum QR Card criado')).toBeTruthy()
  })

  it('shows header without count when no cards', () => {
    const { getByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    // With 0 cards, header is just "QR Cards" without the count suffix
    const header = getByText('QR Cards')
    expect(header).toBeTruthy()
    expect(header.textContent).toBe('QR Cards')
  })

  it('shows "Novo QR Card" button in empty state', () => {
    const { getByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    expect(getByText('Novo QR Card')).toBeTruthy()
  })

  it('does not render "Editar" labels in empty state', () => {
    const { queryAllByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    expect(queryAllByText('Editar')).toHaveLength(0)
  })

  // --- Rendering N cards ---

  it('renders N cards with their names', () => {
    const cards = makeCards(3)
    const { getByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    expect(getByText('Card 1')).toBeTruthy()
    expect(getByText('Card 2')).toBeTruthy()
    expect(getByText('Card 3')).toBeTruthy()
  })

  it('renders preview images for cards that have previewUrl', () => {
    const cards = makeCards(3)
    const { container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    // Cards with even index (0, 2) have preview images
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2) // card-1 (index 0) and card-3 (index 2)
    expect(images[0]?.getAttribute('src')).toBe('https://cdn.example.com/preview-1.png')
  })

  it('renders fallback QrCode icon for cards without preview', () => {
    const cards = [
      { id: 'c1', name: 'No Preview', previewUrl: null, createdAt: '2026-05-01T00:00:00Z' },
    ]
    const { container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    // No <img> elements when there is no preview
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(0)
    // Fallback is the QrCode icon from lucide-react
    const qrIcon = container.querySelector('[data-testid="icon-QrCode"]')
    expect(qrIcon).toBeTruthy()
  })

  it('renders correct alt text on preview images', () => {
    const cards = [
      { id: 'c1', name: 'My Card', previewUrl: 'https://cdn.example.com/preview.png', createdAt: '2026-05-01T00:00:00Z' },
    ]
    const { container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('Preview do QR Card: My Card')
  })

  // --- Navigation ---

  it('clicking a card navigates to /cms/links/{id}/qr?card={cardId}', () => {
    const cards = makeCards(1)
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    fireEvent.click(getByLabelText('Editar QR Card: Card 1'))
    expect(mockPush).toHaveBeenCalledWith(`/cms/links/${LINK_ID}/qr?card=card-1`)
  })

  it('clicking "Novo QR Card" navigates to /cms/links/{id}/qr (no card param)', () => {
    const { getAllByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={makeCards(1)} />,
    )
    // There is a "Criar novo QR Card" button appended to the list
    const createBtn = getAllByLabelText('Criar novo QR Card')
    fireEvent.click(createBtn[0]!)
    expect(mockPush).toHaveBeenCalledWith(`/cms/links/${LINK_ID}/qr`)
  })

  it('clicking "Novo QR Card" in empty state navigates correctly', () => {
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    fireEvent.click(getByLabelText('Criar novo QR Card'))
    expect(mockPush).toHaveBeenCalledWith(`/cms/links/${LINK_ID}/qr`)
  })

  it('clicking second card navigates with correct cardId', () => {
    const cards = makeCards(2)
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    fireEvent.click(getByLabelText('Editar QR Card: Card 2'))
    expect(mockPush).toHaveBeenCalledWith(`/cms/links/${LINK_ID}/qr?card=card-2`)
  })

  // --- Count label ---

  it('shows card count in header when cards exist', () => {
    const cards = makeCards(5)
    const { container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    // Format: "QR Cards · 5"
    expect(container.textContent).toContain('QR Cards')
    expect(container.textContent).toContain('5')
  })

  // --- Accessibility ---

  it('each card button has proper aria-label with card name', () => {
    const cards = makeCards(3)
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    expect(getByLabelText('Editar QR Card: Card 1')).toBeTruthy()
    expect(getByLabelText('Editar QR Card: Card 2')).toBeTruthy()
    expect(getByLabelText('Editar QR Card: Card 3')).toBeTruthy()
  })

  it('card elements are actual <button> elements (keyboard accessible)', () => {
    const cards = makeCards(1)
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    const cardBtn = getByLabelText('Editar QR Card: Card 1')
    expect(cardBtn.tagName).toBe('BUTTON')
    expect(cardBtn.getAttribute('type')).toBe('button')
  })

  it('"Novo QR Card" create button is a <button> element', () => {
    const { getByLabelText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={[]} />,
    )
    const createBtn = getByLabelText('Criar novo QR Card')
    expect(createBtn.tagName).toBe('BUTTON')
    expect(createBtn.getAttribute('type')).toBe('button')
  })

  // --- Edge cases ---

  it('"Novo QR Card" is always present even with many cards', () => {
    const cards = makeCards(10)
    const { getAllByLabelText, container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    expect(getAllByLabelText('Criar novo QR Card')).toHaveLength(1)
    // Header shows count
    expect(container.textContent).toContain('10')
  })

  it('long card names have text-overflow ellipsis styles', () => {
    const longName = 'Um nome de card extremamente longo que deveria ser truncado na interface visual'
    const cards = [
      { id: 'c-long', name: longName, previewUrl: null, createdAt: '2026-05-01T00:00:00Z' },
    ]
    const { getByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    const nameEl = getByText(longName)
    expect(nameEl.style.overflow).toBe('hidden')
    expect(nameEl.style.textOverflow).toBe('ellipsis')
    expect(nameEl.style.whiteSpace).toBe('nowrap')
  })

  it('each card shows "Editar" label', () => {
    const cards = makeCards(3)
    const { queryAllByText } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    expect(queryAllByText('Editar')).toHaveLength(3)
  })

  it('card list uses role="list" for semantic markup', () => {
    const cards = makeCards(2)
    const { container } = render(
      <QrCardsStrip linkId={LINK_ID} cards={cards} />,
    )
    const list = container.querySelector('[role="list"]')
    expect(list).toBeTruthy()
    // Each card + the "Novo" button are listitem
    const items = container.querySelectorAll('[role="listitem"]')
    // 2 cards + 1 "Novo QR Card" button
    expect(items).toHaveLength(3)
  })
})
