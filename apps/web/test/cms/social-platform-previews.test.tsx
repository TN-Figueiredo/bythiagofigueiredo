import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DestPreview } from '@/app/cms/(authed)/social/_components/platform-previews/dest-preview'
import { DEST_IDS } from '@/lib/social/destinations'

describe('DestPreview dispatcher', () => {
  it.each(DEST_IDS)('renders without error for %s', (destId) => {
    const { container } = render(
      <DestPreview
        destId={destId}
        caption="Test caption"
        imageUrl={null}
        accountName="@test"
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders Story phone mockup for ig_story', () => {
    render(
      <DestPreview destId="ig_story" caption="" imageUrl={null} accountName="@test" />
    )
    expect(screen.getByText('Envie uma mensagem')).toBeTruthy()
  })

  it('renders community card for yt_community', () => {
    render(
      <DestPreview destId="yt_community" caption="Test" imageUrl={null} accountName="TestChannel" />
    )
    expect(screen.getByText('TestChannel')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
  })
})
