import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SectionConflict } from '@/app/cms/(authed)/video/[id]/edit/section-conflict'

describe('SectionConflict (409 surface)', () => {
  it('renders the pipeline conflict banner with local vs remote content', () => {
    const onKeepLocal = vi.fn()
    const onAcceptRemote = vi.fn()
    const { getByText } = render(
      <SectionConflict
        conflict={{ remoteData: { content: { title: 'remote' } } as never, localContent: { title: 'local' } }}
        onKeepLocal={onKeepLocal}
        onAcceptRemote={onAcceptRemote}
      />,
    )
    expect(getByText(/Cowork atualizou esta seção/i)).toBeTruthy()
    fireEvent.click(getByText(/Manter minha versão/i))
    expect(onKeepLocal).toHaveBeenCalled()
    fireEvent.click(getByText(/Aceitar Cowork/i))
    expect(onAcceptRemote).toHaveBeenCalled()
  })
  it('renders nothing when there is no conflict', () => {
    const { container } = render(<SectionConflict conflict={null} onKeepLocal={() => {}} onAcceptRemote={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
