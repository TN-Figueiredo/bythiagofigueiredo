import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubHeader } from '@/app/cms/(authed)/video/_components/hub-header'
import { channelByLang } from '@/lib/pipeline/channels'

describe('HubHeader', () => {
  it('renders the title, a pulsing live dot, and per-language channel names from CHANNELS', () => {
    const { container } = render(<HubHeader />)
    expect(screen.getByRole('heading', { name: 'Vídeos' })).toBeInTheDocument()
    const live = container.querySelector('.mod-live')
    expect(live).toBeTruthy()
    expect(live!.querySelector('i')).toBeTruthy()
    const pt = channelByLang('pt')!.name
    const en = channelByLang('en')!.name
    expect(live!.textContent).toContain(`Canal ${pt} · ${en}`)
  })

  it('renders a right-pushed "Novo Vídeo" link to the create route', () => {
    render(<HubHeader />)
    const link = screen.getByRole('link', { name: /novo vídeo/i })
    expect(link).toHaveAttribute('href', '/cms/video/new')
    expect(link.className).toContain('mod-new')
  })
})
