// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DetailHeader } from '@/app/cms/(authed)/youtube/ab-lab/_components/detail-header'

afterEach(() => cleanup())
const base = { title: 'T', flag: 'title' as const, roundNumber: 1, totalRounds: 1, hasPlayoff: false }

describe('DetailHeader: Abrir no YouTube (D20)', () => {
  for (const [nome, status, lab] of [
    ['teste rodando (Lab)', 'active', { thumbUrl: null }],
    ['teste concluído (Lab)', 'completed', { thumbUrl: null, concluidoEm: '20/10' }],
    ['cabeçalho padrão (v1)', 'completed', undefined],
  ] as const) {
    it(`${nome}: link certo, aba nova, rel seguro`, () => {
      render(<DetailHeader {...base} status={status} lab={lab} youtubeVideoId="abc_DEF-123" />)
      const a = screen.getByRole('link', { name: /Abrir no YouTube/ })
      expect(a.getAttribute('href')).toBe('https://www.youtube.com/watch?v=abc_DEF-123')
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
      expect(a.className).toContain('min-h-[44px]')
    })
    it(`${nome}: sem id, o botão não aparece`, () => {
      render(<DetailHeader {...base} status={status} lab={lab} youtubeVideoId={null} />)
      expect(screen.queryByRole('link', { name: /Abrir no YouTube/ })).toBeNull()
    })
  }
  it('escapa o id na URL', () => {
    render(<DetailHeader {...base} status="active" lab={{ thumbUrl: null }} youtubeVideoId="a&b=c" />)
    expect(screen.getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=a%26b%3Dc')
  })
})
