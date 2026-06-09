import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicacaoStage } from '@/app/cms/(authed)/video/[id]/edit/stages/publicacao-stage'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

/* Edit-mode provider seed — firstOnAir toggle + title/brief editing require useCanEditContent() === true.
 * (Published tests still freeze via the `published` prop, which forces canEditFields false regardless.) */
const editSeed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'publicacao', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'publicacao',
  editMode: 'edit', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

/** Mount a PublicacaoStage under an edit-mode provider so content-editing affordances are live. */
function renderEdit(node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={editSeed}>{node}</VideoEditorProvider>)
}

/* View-mode seed — content read-only, but a provider is still mounted so the inline CoworkButton
 * (which reads editor state) can render. Used for the default (non-edit) render path. */
const viewSeed: VideoEditorState = { ...editSeed, editMode: 'view' }

/** Mount under a view-mode provider (read-only fields, CoworkButton can still mount). */
function renderView(node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={viewSeed}>{node}</VideoEditorProvider>)
}

/* A started 4-up draft (every variant carries content → chooser is skipped). All challengers at debut. */
const draft: ABDraft = {
  firstOnAir: 'A',
  variants: [
    { id: 'A', role: 'challenger', title: 'A', brief: 'b A' },
    { id: 'B', role: 'challenger', title: 'B', brief: 'b B' },
    { id: 'C', role: 'challenger', title: 'C', brief: 'b C' },
    { id: 'D', role: 'challenger', title: 'D', brief: 'b D' },
  ],
}
const enabledCta = { enabled: true, tooltip: null, deepLink: null }

/* ── AB_COLORS ground truth ── */
const AB_COLORS: Record<string, string> = {
  A: '#8A8F98',
  B: '#E8823C',
  C: '#3FA9C0',
  D: '#A77CE8',
}

const noop = { onPatch: vi.fn(), onSeed: vi.fn(), onPublish: vi.fn() }

describe('PublicacaoStage — handoff markup', () => {
  /* ── structural ── */
  it('renders .pub-doc.fade-in root', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.classList.contains('pub-doc')).toBe(true)
    expect(root.classList.contains('fade-in')).toBe(true)
  })

  it('renders .pub-bar with .grow spacer', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const bar = container.querySelector('.pub-bar')
    expect(bar).toBeTruthy()
    expect(bar?.querySelector('.grow')).toBeTruthy()
  })

  it('renders .pub-note', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.pub-note')).toBeTruthy()
  })

  it('renders .pub-gen-row with .grow', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const row = container.querySelector('.pub-gen-row')
    expect(row).toBeTruthy()
    expect(row?.querySelector('.grow')).toBeTruthy()
  })

  /* ── ab-grid: 4 cards ── */
  it('renders exactly 4 .ab-card elements', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelectorAll('.ab-card')).toHaveLength(4)
  })

  it('each .ab-card has data-testid="ab-variant-card"', () => {
renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(screen.getAllByTestId('ab-variant-card')).toHaveLength(4)
  })

  it('ab-grid has role=list and cards role=listitem', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.ab-grid')?.getAttribute('role')).toBe('list')
    container.querySelectorAll('.ab-card').forEach((c, i) => {
      expect(c.getAttribute('role')).toBe('listitem')
      expect(c.getAttribute('aria-label')).toBe(`Variação ${['A', 'B', 'C', 'D'][i]}`)
    })
  })

  it('sets --vc CSS var to AB_COLORS per card', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const cards = container.querySelectorAll<HTMLElement>('.ab-card')
    ;(['A', 'B', 'C', 'D'] as const).forEach((id, i) => {
      expect(cards[i].style.getPropertyValue('--vc')).toBe(AB_COLORS[id])
    })
  })

  it('.ab-card has .leader class only on the firstOnAir variant', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const cards = container.querySelectorAll('.ab-card')
    expect(cards[0].classList.contains('leader')).toBe(true)  // A = firstOnAir
    expect(cards[1].classList.contains('leader')).toBe(false)
    expect(cards[2].classList.contains('leader')).toBe(false)
    expect(cards[3].classList.contains('leader')).toBe(false)
  })

  /* ── ab-thumb anatomy ── */
  it('each card has .ab-thumb with .ab-badge inside', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const thumbs = container.querySelectorAll('.ab-thumb')
    expect(thumbs).toHaveLength(4)
    thumbs.forEach(t => expect(t.querySelector('.ab-badge')).toBeTruthy())
  })

  it('.ab-thumb-ph exists with .ab-thumb-tx "1280×720"', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const phs = container.querySelectorAll('.ab-thumb-ph')
    expect(phs).toHaveLength(4)
    phs.forEach(ph => expect(ph.querySelector('.ab-thumb-tx')?.textContent).toBe('1280×720'))
  })

  it('.ab-thumb-set (Claude Design) shows on all cards when not published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelectorAll('.ab-thumb-set')).toHaveLength(4)
  })

  it('shows NO ORIGINAL badge — all variants are fresh challengers', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelectorAll('.ab-tag')).toHaveLength(0)
    expect(screen.queryByText('original')).toBeNull()
  })

  /* ── ab-fields anatomy ── */
  it('each card has .ab-fields with .ab-lbl / .ab-title.efx / .ab-brief.efx', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const fields = container.querySelectorAll('.ab-fields')
    expect(fields).toHaveLength(4)
    fields.forEach(f => {
      expect(f.querySelectorAll('.ab-lbl').length).toBeGreaterThanOrEqual(2)
      expect(f.querySelector('.ab-title.efx')).toBeTruthy()
      expect(f.querySelector('.ab-brief.efx')).toBeTruthy()
    })
  })

  it('.ab-title.efx has data-testid="ab-title" + textbox a11y', () => {
renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const titles = screen.getAllByTestId('ab-title')
    expect(titles).toHaveLength(4)
    titles.forEach((t, i) => {
      expect(t.getAttribute('role')).toBe('textbox')
      expect(t.getAttribute('aria-label')).toBe(`Título da variação ${['A', 'B', 'C', 'D'][i]}`)
    })
  })

  /* ── firstOnAir toggle (.ab-lead-btn) ── */
  it('.ab-lead-btn.on on current firstOnAir, others without .on; aria-pressed mirrors', () => {
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    expect(btns).toHaveLength(4)
    expect(btns[0].classList.contains('on')).toBe(true)
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
    expect(btns[1].classList.contains('on')).toBe(false)
    expect(btns[1].getAttribute('aria-pressed')).toBe('false')
  })

  it('firstOnAir button shows "1ª no ar" for the pick and "no ar primeiro" for others', () => {
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    expect(btns[0].textContent).toContain('1ª no ar')
    expect(btns[1].textContent).toContain('no ar primeiro')
  })

  it('clicking a non-firstOnAir .ab-lead-btn calls onPatch({firstOnAir: id})', () => {
    const onPatch = vi.fn()
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={onPatch} onSeed={vi.fn()} onPublish={vi.fn()} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    fireEvent.click(btns[1]) // B
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ firstOnAir: 'B' }))
  })

  /* ── pre-publish: Publicar button ── */
  it('shows .btn.primary "Publicar + iniciar teste" when not published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const btn = container.querySelector('button.btn.primary')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toMatch(/publicar/i)
  })

  it('Publicar button enabled when cta.enabled; click calls onPublish', () => {
    const onPublish = vi.fn()
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onSeed={vi.fn()} onPublish={onPublish} />,
    )
    const btn = container.querySelector<HTMLButtonElement>('button.btn.primary')!
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onPublish).toHaveBeenCalled()
  })

  it('Publicar button disabled + tooltip when !cta.enabled', () => {
    const cta = { enabled: false, tooltip: 'Sincronize a thumbnail do YouTube primeiro', deepLink: '/cms/youtube/ab-lab/new?pipeline=p1' }
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={cta} published={false} winnerVariantId={null} {...noop} />,
    )
    const btn = container.querySelector<HTMLButtonElement>('button.btn.primary')!
    expect(btn.disabled).toBe(true)
    expect(btn.title).toBe('Sincronize a thumbnail do YouTube primeiro')
  })

  it('deep-link shows when !cta.enabled and deepLink is set', () => {
    const cta = { enabled: false, tooltip: 'Vincule o vídeo do YouTube primeiro', deepLink: '/cms/youtube/ab-lab/new?pipeline=p1' }
renderView(
      <PublicacaoStage draft={draft} cta={cta} published={false} winnerVariantId={null} {...noop} />,
    )
    const link = screen.getByRole('link', { name: /Abrir no A\/B Lab/i })
    expect(link).toHaveAttribute('href', '/cms/youtube/ab-lab/new?pipeline=p1')
  })

  /* ── pre-publish: Sugerir títulos com Cowork (live CoworkButton, not a dead no-op) ── */
  it('shows .cw-btn.compact "Sugerir títulos com Cowork" when not published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    const btn = container.querySelector('button.cw-btn.compact')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toMatch(/sugerir títulos \+ thumbnails/i)
  })

  it('Sugerir títulos button opens the Cowork popover (dialog) on click', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    fireEvent.click(container.querySelector('button.cw-btn.compact')!)
    expect(document.querySelector('.cw-pop[role="dialog"]')).toBeTruthy()
  })

  /* ── pub-foot distribution chips ── */
  it('renders .pub-foot with .pub-dist (role=group) and 4 .pub-chan chips', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.pub-foot')).toBeTruthy()
    expect(container.querySelector('.pub-dist')?.getAttribute('role')).toBe('group')
    expect(container.querySelectorAll('.pub-chan')).toHaveLength(4)
    expect(container.querySelectorAll('.pc-dot')).toHaveLength(4)
  })
})

describe('PublicacaoStage — empty-state chooser (create ≠ edit)', () => {
  const empty: ABDraft = {
    firstOnAir: 'A',
    variants: [
      { id: 'A', role: 'challenger', title: '', brief: '' },
      { id: 'B', role: 'challenger', title: '', brief: '' },
      { id: 'C', role: 'challenger', title: '', brief: '' },
      { id: 'D', role: 'challenger', title: '', brief: '' },
    ],
  }

  it('shows the .rot-gen chooser (Gerar / Começar do zero) when no variant has content', () => {
const { container } = renderView(
      <PublicacaoStage draft={empty} cta={enabledCta} published={false} winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.rot-gen')).toBeTruthy()
    expect(container.querySelector('.cw-btn')?.textContent).toMatch(/gerar títulos \+ thumbnails com cowork/i)
    expect(container.querySelectorAll('.ab-card')).toHaveLength(0)
  })

  it('"Começar do zero" seeds an empty draft via onSeed (force) — available even in view mode', () => {
    const onSeed = vi.fn()
const { getByText } = renderView(
      <PublicacaoStage draft={empty} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onSeed={onSeed} onPublish={vi.fn()} />,
    )
    fireEvent.click(getByText('Começar do zero'))
    expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ firstOnAir: 'A' }))
  })

  it('published always renders the grid (never the chooser), even with blank variants', () => {
const { container } = renderView(
      <PublicacaoStage draft={empty} cta={enabledCta} published winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.rot-gen')).toBeFalsy()
    expect(container.querySelectorAll('.ab-card')).toHaveLength(4)
  })
})

describe('PublicacaoStage — Recomeçar', () => {
  it('two-step Recomeçar in edit mode resets to an empty draft via onPatch', () => {
    const onPatch = vi.fn()
    const { container, getByText } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={onPatch} onSeed={vi.fn()} onPublish={vi.fn()} />,
    )
    fireEvent.click(container.querySelector('.rot-reset')!)
    fireEvent.click(getByText('limpar'))
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ firstOnAir: 'A' }))
  })

  it('Recomeçar is hidden when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId={null} {...noop} />,
    )
    expect(container.querySelector('.rot-reset')).toBeFalsy()
  })
})

describe('PublicacaoStage — published freeze', () => {
  it('.ab-grid has .locked class when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelector('.ab-grid')?.classList.contains('locked')).toBe(true)
  })

  it('all .ab-title.efx are contentEditable=false when published', () => {
renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    screen.getAllByTestId('ab-title').forEach(el => {
      expect(el).toHaveAttribute('contenteditable', 'false')
      expect(el).toHaveAttribute('aria-readonly', 'true') // a11y mirrors the frozen state
    })
  })

  it('all .ab-brief.efx are contentEditable=false when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    container.querySelectorAll('.ab-brief.efx').forEach(el => {
      expect(el).toHaveAttribute('contenteditable', 'false')
      expect(el).toHaveAttribute('aria-readonly', 'true') // a11y mirrors the frozen state
    })
  })

  it('no .ab-lead-btn when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelectorAll('.ab-lead-btn')).toHaveLength(0)
  })

  it('.ab-winner "vencedora" shows only on the resolved winner card', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelectorAll('.ab-winner')).toHaveLength(1)
    expect(container.querySelector('.ab-winner')?.textContent).toMatch(/vencedora/i)
  })

  it('data-testid="ab-trophy" appears exactly once on the winner', () => {
renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(screen.getAllByTestId('ab-trophy')).toHaveLength(1)
  })

  it('.ab-thumb-set hidden when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelectorAll('.ab-thumb-set')).toHaveLength(0)
  })

  it('shows .ed-status.live instead of Publicar btn when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelector('.ed-status.live')).toBeTruthy()
    expect(container.querySelector('button.btn.primary')).toBeFalsy()
  })

  it('.ed-status.live text contains "No ar · teste rodando"', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelector('.ed-status.live')?.textContent).toMatch(/No ar · teste rodando/i)
  })

  it('shows .pub-locknote instead of the Cowork button when published', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" {...noop} />,
    )
    expect(container.querySelector('.pub-locknote')).toBeTruthy()
    expect(container.querySelector('button.cw-btn.compact')).toBeFalsy()
    expect(container.querySelector('.pub-locknote')?.textContent).toMatch(/no ar — capas travadas/i)
  })

  it('test running (winnerVariantId=null): NO winner badge on any card, only the 1ª-no-ar marker', () => {
const { container } = renderView(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId={null} {...noop} />,
    )
    // No incumbent / no winner yet → no trophy at all.
    expect(container.querySelectorAll('.ab-winner')).toHaveLength(0)
    expect(screen.queryByTestId('ab-trophy')).toBeNull()
    // The firstOnAir card carries a neutral "1ª no ar" broadcast marker (not a winner claim).
    expect(container.querySelectorAll('.ab-onair')).toHaveLength(1)
    expect(container.querySelector('.ab-onair')?.textContent).toMatch(/1ª no ar/i)
  })
})
