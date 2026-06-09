import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicacaoStage } from '@/app/cms/(authed)/video/[id]/edit/stages/publicacao-stage'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

/* Edit-mode provider seed — leader toggle + title/brief editing require useCanEditContent() === true.
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

const draft: ABDraft = {
  leader: 'A',
  variants: [
    { id: 'A', tag: 'original', title: 'Orig', brief: 'b A' },
    { id: 'B', title: 'B', brief: 'b B' },
    { id: 'C', title: 'C', brief: 'b C' },
    { id: 'D', title: 'D', brief: 'b D' },
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

describe('PublicacaoStage — handoff markup', () => {
  /* ── structural ── */
  it('renders .pub-doc.fade-in root', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.classList.contains('pub-doc')).toBe(true)
    expect(root.classList.contains('fade-in')).toBe(true)
  })

  it('renders .pub-bar with .grow spacer', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const bar = container.querySelector('.pub-bar')
    expect(bar).toBeTruthy()
    expect(bar?.querySelector('.grow')).toBeTruthy()
  })

  it('renders .pub-note', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.pub-note')).toBeTruthy()
  })

  it('renders .pub-gen-row with .grow', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const row = container.querySelector('.pub-gen-row')
    expect(row).toBeTruthy()
    expect(row?.querySelector('.grow')).toBeTruthy()
  })

  /* ── ab-grid: 4 cards ── */
  it('renders exactly 4 .ab-card elements', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelectorAll('.ab-card')).toHaveLength(4)
  })

  it('each .ab-card has data-testid="ab-variant-card"', () => {
    render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(screen.getAllByTestId('ab-variant-card')).toHaveLength(4)
  })

  it('sets --vc CSS var to AB_COLORS per card', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const cards = container.querySelectorAll<HTMLElement>('.ab-card')
    ;(['A', 'B', 'C', 'D'] as const).forEach((id, i) => {
      expect(cards[i].style.getPropertyValue('--vc')).toBe(AB_COLORS[id])
    })
  })

  it('.ab-card has .leader class only on the leader variant', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const cards = container.querySelectorAll('.ab-card')
    expect(cards[0].classList.contains('leader')).toBe(true)  // A = leader
    expect(cards[1].classList.contains('leader')).toBe(false)
    expect(cards[2].classList.contains('leader')).toBe(false)
    expect(cards[3].classList.contains('leader')).toBe(false)
  })

  /* ── ab-thumb anatomy ── */
  it('each card has .ab-thumb with .ab-badge inside', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const thumbs = container.querySelectorAll('.ab-thumb')
    expect(thumbs).toHaveLength(4)
    thumbs.forEach(t => expect(t.querySelector('.ab-badge')).toBeTruthy())
  })

  it('.ab-thumb-ph exists with .ab-thumb-tx "1280×720"', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const phs = container.querySelectorAll('.ab-thumb-ph')
    expect(phs).toHaveLength(4)
    phs.forEach(ph => expect(ph.querySelector('.ab-thumb-tx')?.textContent).toBe('1280×720'))
  })

  it('.ab-thumb-set (Claude Design) shows on all cards when not published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelectorAll('.ab-thumb-set')).toHaveLength(4)
  })

  it('.ab-tag "original" appears exactly once', () => {
    render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(screen.getAllByText('original')).toHaveLength(1)
  })

  /* ── ab-fields anatomy ── */
  it('each card has .ab-fields with .ab-lbl / .ab-title.efx / .ab-brief.efx', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const fields = container.querySelectorAll('.ab-fields')
    expect(fields).toHaveLength(4)
    fields.forEach(f => {
      expect(f.querySelectorAll('.ab-lbl').length).toBeGreaterThanOrEqual(2)
      expect(f.querySelector('.ab-title.efx')).toBeTruthy()
      expect(f.querySelector('.ab-brief.efx')).toBeTruthy()
    })
  })

  it('.ab-title.efx has data-testid="ab-title"', () => {
    render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(screen.getAllByTestId('ab-title')).toHaveLength(4)
  })

  /* ── leader toggle (.ab-lead-btn) ── */
  it('.ab-lead-btn.on on current leader, .ab-lead-btn without .on on others', () => {
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    expect(btns).toHaveLength(4)
    expect(btns[0].classList.contains('on')).toBe(true)
    expect(btns[1].classList.contains('on')).toBe(false)
    expect(btns[2].classList.contains('on')).toBe(false)
    expect(btns[3].classList.contains('on')).toBe(false)
  })

  it('leader button shows "líder" for leader and "líder?" for others', () => {
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    expect(btns[0].textContent).toContain('líder')
    expect(btns[1].textContent).toContain('líder?')
  })

  it('clicking a non-leader .ab-lead-btn calls onPatch({leader: id})', () => {
    const onPatch = vi.fn()
    const { container } = renderEdit(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={onPatch} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btns = container.querySelectorAll('.ab-lead-btn')
    fireEvent.click(btns[1]) // B
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ leader: 'B' }))
  })

  /* ── pre-publish: Publicar button ── */
  it('shows .btn.primary "Publicar + iniciar teste" when not published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btn = container.querySelector('button.btn.primary')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toMatch(/publicar/i)
  })

  it('Publicar button enabled when cta.enabled; click calls onPublish', () => {
    const onPublish = vi.fn()
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={onPublish} onSuggest={vi.fn()} />,
    )
    const btn = container.querySelector<HTMLButtonElement>('button.btn.primary')!
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onPublish).toHaveBeenCalled()
  })

  it('Publicar button disabled + tooltip when !cta.enabled', () => {
    const cta = { enabled: false, tooltip: 'Sincronize a thumbnail do YouTube primeiro', deepLink: '/cms/youtube/ab-lab/new?pipeline=p1' }
    const { container } = render(
      <PublicacaoStage draft={draft} cta={cta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btn = container.querySelector<HTMLButtonElement>('button.btn.primary')!
    expect(btn.disabled).toBe(true)
    expect(btn.title).toBe('Sincronize a thumbnail do YouTube primeiro')
  })

  it('deep-link shows when !cta.enabled and deepLink is set', () => {
    const cta = { enabled: false, tooltip: 'Vincule o vídeo do YouTube primeiro', deepLink: '/cms/youtube/ab-lab/new?pipeline=p1' }
    render(
      <PublicacaoStage draft={draft} cta={cta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const link = screen.getByRole('link', { name: /Abrir no A\/B Lab/i })
    expect(link).toHaveAttribute('href', '/cms/youtube/ab-lab/new?pipeline=p1')
  })

  /* ── pre-publish: Sugerir títulos ── */
  it('shows .cw-btn.compact "Sugerir títulos" when not published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    const btn = container.querySelector('button.cw-btn.compact')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toMatch(/sugerir títulos/i)
  })

  it('.cw-btn.compact click calls onSuggest', () => {
    const onSuggest = vi.fn()
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={onSuggest} />,
    )
    fireEvent.click(container.querySelector('button.cw-btn.compact')!)
    expect(onSuggest).toHaveBeenCalled()
  })

  /* ── pub-foot distribution chips ── */
  it('renders .pub-foot with .pub-dist and 4 .pub-chan chips', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.pub-foot')).toBeTruthy()
    expect(container.querySelector('.pub-dist')).toBeTruthy()
    expect(container.querySelectorAll('.pub-chan')).toHaveLength(4)
    expect(container.querySelectorAll('.pc-dot')).toHaveLength(4)
  })
})

describe('PublicacaoStage — published freeze', () => {
  it('.ab-grid has .locked class when published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.ab-grid')?.classList.contains('locked')).toBe(true)
  })

  it('all .ab-title.efx are contentEditable=false when published', () => {
    render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    screen.getAllByTestId('ab-title').forEach(el => {
      expect(el).toHaveAttribute('contenteditable', 'false')
      expect(el).toHaveAttribute('aria-readonly', 'true') // a11y mirrors the frozen state
    })
  })

  it('all .ab-brief.efx are contentEditable=false when published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    container.querySelectorAll('.ab-brief.efx').forEach(el => {
      expect(el).toHaveAttribute('contenteditable', 'false')
      expect(el).toHaveAttribute('aria-readonly', 'true') // a11y mirrors the frozen state
    })
  })

  it('no .ab-lead-btn when published (replaced by .ab-winner on leader)', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelectorAll('.ab-lead-btn')).toHaveLength(0)
  })

  it('.ab-winner "liderando" shows only on winner card', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelectorAll('.ab-winner')).toHaveLength(1)
    expect(container.querySelector('.ab-winner')?.textContent).toMatch(/liderando/i)
  })

  it('data-testid="ab-trophy" appears exactly once on winner', () => {
    render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(screen.getAllByTestId('ab-trophy')).toHaveLength(1)
  })

  it('.ab-thumb-set hidden when published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelectorAll('.ab-thumb-set')).toHaveLength(0)
  })

  it('shows .ed-status.live instead of Publicar btn when published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.ed-status.live')).toBeTruthy()
    expect(container.querySelector('button.btn.primary')).toBeFalsy()
  })

  it('.ed-status.live text contains "No ar · teste rodando"', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.ed-status.live')?.textContent).toMatch(/No ar · teste rodando/i)
  })

  it('shows .pub-locknote instead of .cw-btn.compact when published', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A"
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    expect(container.querySelector('.pub-locknote')).toBeTruthy()
    expect(container.querySelector('button.cw-btn.compact')).toBeFalsy()
    expect(container.querySelector('.pub-locknote')?.textContent).toMatch(/no ar — títulos travados/i)
  })

  it('winnerVariantId=null falls back to leader — .ab-winner shows on leader card', () => {
    const { container } = render(
      <PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId={null}
        onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />,
    )
    // When no real A/B-lab winner yet, the leader card shows the trophy (§3.8 fallback).
    expect(container.querySelectorAll('.ab-winner')).toHaveLength(1)
    expect(container.querySelector('.ab-winner')?.textContent).toMatch(/liderando/i)
  })
})
