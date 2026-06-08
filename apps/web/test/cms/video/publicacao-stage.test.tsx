import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicacaoStage } from '@/app/cms/(authed)/video/[id]/edit/stages/publicacao-stage'
import type { ABDraft } from '@/lib/pipeline/video-schemas'

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

describe('PublicacaoStage (pre-publish)', () => {
  it('renders exactly 4 variant cards with the single "original" tag', () => {
    render(<PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />)
    expect(screen.getAllByTestId('ab-variant-card')).toHaveLength(4)
    expect(screen.getAllByText('original')).toHaveLength(1)
  })

  it('leader toggle calls onPatch with the new leader', () => {
    const onPatch = vi.fn()
    render(<PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} onPatch={onPatch} onPublish={vi.fn()} onSuggest={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Líder B/i }))
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ leader: 'B' }))
  })

  it('publish CTA enabled when cta.enabled; click calls onPublish', () => {
    const onPublish = vi.fn()
    render(<PublicacaoStage draft={draft} cta={enabledCta} published={false} winnerVariantId={null} onPatch={vi.fn()} onPublish={onPublish} onSuggest={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /Publicar \+ iniciar teste/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onPublish).toHaveBeenCalled()
  })

  it('publish CTA disabled + tooltip + deep-link when precondition fails (no thumbnail)', () => {
    const cta = { enabled: false, tooltip: 'Sincronize a thumbnail do YouTube primeiro', deepLink: '/cms/youtube/ab-lab/new?pipeline=p1' }
    render(<PublicacaoStage draft={draft} cta={cta} published={false} winnerVariantId={null} onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /Publicar \+ iniciar teste/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Sincronize a thumbnail do YouTube primeiro')
    expect(screen.getByRole('link', { name: /Abrir no A\/B Lab/i })).toHaveAttribute('href', '/cms/youtube/ab-lab/new?pipeline=p1')
  })
})

describe('PublicacaoStage (published read-only freeze)', () => {
  it('freezes titles (contentEditable=false), shows winner-only trophy, swaps suggest button', () => {
    render(<PublicacaoStage draft={draft} cta={enabledCta} published winnerVariantId="A" onPatch={vi.fn()} onPublish={vi.fn()} onSuggest={vi.fn()} />)
    screen.getAllByTestId('ab-title').forEach(el => expect(el).toHaveAttribute('contenteditable', 'false'))
    expect(screen.getAllByTestId('ab-trophy')).toHaveLength(1)
    expect(screen.getByText(/no ar — títulos travados/i)).toBeInTheDocument()
  })
})
