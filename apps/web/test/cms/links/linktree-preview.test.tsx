import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Link2: icon('Link2'),
    Mail: icon('Mail'),
    BookOpen: icon('BookOpen'),
    Youtube: icon('Youtube'),
    Globe: icon('Globe'),
    Users: icon('Users'),
    Phone: icon('Phone'),
    Heart: icon('Heart'),
  }
})

import { LinktreePreview } from '@/app/cms/(authed)/links/_components/linktree/preview'

const sharedLinks = [
  { id: 's1', icon: 'globe', label_pt: 'Sobre mim', label_en: 'About me', url: '/about' },
  { id: 's2', icon: 'mail', label_pt: 'Contato', label_en: 'Contact', url: '/contact' },
]

describe('LinktreePreview', () => {
  it('renders TF initials in stamp', () => {
    const { container } = render(<LinktreePreview width={300} taglinePt="codigo" taglineEn="code" sharedLinks={[]} />)
    expect(container.textContent).toContain('T')
    expect(container.textContent).toContain('F')
  })

  it('renders PT/EN toggle badges', () => {
    render(<LinktreePreview width={300} taglinePt="codigo" taglineEn="code" sharedLinks={[]} />)
    expect(screen.getByText('PT')).toBeDefined()
    expect(screen.getByText('EN')).toBeDefined()
  })

  it('renders tagline from props', () => {
    render(<LinktreePreview width={300} taglinePt="codigo, produto & vida indie" taglineEn="code" sharedLinks={[]} />)
    expect(screen.getByText('codigo, produto & vida indie')).toBeDefined()
  })

  it('renders English and Portuguese section headers', () => {
    render(<LinktreePreview width={300} taglinePt="tag" taglineEn="tag" sharedLinks={[]} />)
    expect(screen.getByText('ENGLISH')).toBeDefined()
    expect(screen.getByText(/PORTUGU/)).toBeDefined()
  })

  it('renders shared links when provided', () => {
    render(<LinktreePreview width={280} taglinePt="tag" taglineEn="tag" sharedLinks={sharedLinks} />)
    expect(screen.getByText('Sobre mim')).toBeDefined()
    expect(screen.getByText('Contato')).toBeDefined()
  })

  it('does not render shared links section when empty', () => {
    render(<LinktreePreview width={280} taglinePt="tag" taglineEn="tag" sharedLinks={[]} />)
    expect(screen.queryByText('Sobre mim')).toBeNull()
  })

  it('applies width prop to container', () => {
    const { container } = render(<LinktreePreview width={320} taglinePt="tag" taglineEn="tag" sharedLinks={[]} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.width).toBe('320px')
  })

  it('renders social icons row at bottom', () => {
    const { container } = render(<LinktreePreview width={300} taglinePt="tag" taglineEn="tag" sharedLinks={[]} />)
    const socialRow = container.querySelector('[data-testid="social-icons"]')
    expect(socialRow).toBeTruthy()
  })
})
