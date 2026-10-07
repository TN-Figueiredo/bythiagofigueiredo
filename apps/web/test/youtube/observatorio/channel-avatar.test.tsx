// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/channel-avatar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ChannelAvatar } from '@/app/cms/(authed)/youtube/competitors/_chrome/channel-avatar'

describe('ChannelAvatar (R124)', () => {
  it('com foto: desenha a imagem, sem as iniciais, decorativa', () => {
    const { container } = render(<ChannelAvatar src="https://yt3.ggpht.com/abc=s88" ini="NR" color="#B8479C" />)
    const box = container.querySelector('.av')!, img = box.querySelector('img')!
    expect(box.getAttribute('aria-hidden')).toBe('true')
    expect(box.getAttribute('data-avatar')).toBe('img')
    expect(img.getAttribute('src')).toBe('https://yt3.ggpht.com/abc=s88')
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(box.textContent).toBe('')
  })
  it('sem foto (o dado não existe): iniciais sobre a cor do canal', () => {
    for (const src of [null, undefined, '']) {
      const { container } = render(<ChannelAvatar src={src} ini="NR" color="#B8479C" />)
      const box = container.querySelector('.av')!
      expect(box.querySelector('img')).toBeNull()
      expect(box.textContent).toBe('NR')
      expect(box.getAttribute('data-avatar')).toBe('ini')
    }
  })
  it('a imagem falha ao carregar: volta para as iniciais', () => {
    const { container } = render(<ChannelAvatar src="https://yt3.ggpht.com/quebrada" ini="NR" color="#B8479C" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.av')!.textContent).toBe('NR')
  })
  it('respeita o elemento e a cor do texto pedidos pela tela', () => {
    const { container } = render(<ChannelAvatar as="div" src={null} ini="NR" color="#B8479C" ink="#fff" />)
    const box = container.querySelector('div.av') as HTMLElement
    expect(box).toBeTruthy(); expect(box.style.color).toBe('rgb(255, 255, 255)')
  })
})
