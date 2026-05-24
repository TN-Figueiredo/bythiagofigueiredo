import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublishRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer'

// next/navigation is used by BlogDraftPublishPanel — stub it to avoid errors in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// next/link renders as an <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

describe('PublishRenderer — read mode (video/generic format)', () => {
  const baseProps = {
    content: {
      title: { chosen: 'My Video Title', alternatives: ['Alt 1', 'Alt 2'] },
      description: 'Short description without tokens.',
      tags: ['typescript', 'react'],
    },
    isEditing: false as const,
    lang: 'pt',
    format: 'video',
    onContentChange: vi.fn(),
  }

  it('renders the chosen title', () => {
    render(<PublishRenderer {...baseProps} />)
    expect(screen.getByText('My Video Title')).toBeTruthy()
  })

  it('renders alternative titles', () => {
    render(<PublishRenderer {...baseProps} />)
    expect(screen.getByText('Alt 1')).toBeTruthy()
    expect(screen.getByText('Alt 2')).toBeTruthy()
  })

  it('renders description text', () => {
    render(<PublishRenderer {...baseProps} />)
    expect(screen.getByText('Short description without tokens.')).toBeTruthy()
  })

  it('renders tags with # prefix', () => {
    render(<PublishRenderer {...baseProps} />)
    expect(screen.getByText('#typescript')).toBeTruthy()
    expect(screen.getByText('#react')).toBeTruthy()
  })

  it('tokenizes URLs in description', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{ ...baseProps.content, description: 'Check https://example.com now' }}
      />
    )
    const link = screen.getByText('https://example.com')
    expect(link).toBeTruthy()
    expect(link.tagName.toLowerCase()).toBe('span')
  })

  it('tokenizes hashtags in description', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{ ...baseProps.content, description: 'This is #awesome content' }}
      />
    )
    expect(screen.getByText('#awesome')).toBeTruthy()
  })

  it('tokenizes @handles in description', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{ ...baseProps.content, description: 'Follow @user for more' }}
      />
    )
    expect(screen.getByText('@user')).toBeTruthy()
  })

  it('renders cards with timestamps', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{
          ...baseProps.content,
          cards: [
            { timestamp: '01:30', text: 'Subscribe reminder', type: 'question' },
            { timestamp: '05:00', text: 'End screen', type: undefined },
          ],
        }}
      />
    )
    expect(screen.getByText('01:30')).toBeTruthy()
    expect(screen.getByText('Subscribe reminder')).toBeTruthy()
    expect(screen.getByText('05:00')).toBeTruthy()
  })

  it('renders card type badge', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{ ...baseProps.content, cards: [{ timestamp: '00:10', text: 'Poll now', type: 'poll' }] }}
      />
    )
    expect(screen.getByText('poll')).toBeTruthy()
  })

  it('empty content shows empty state message for non-course non-blog formats', () => {
    render(
      <PublishRenderer
        content={null}
        isEditing={false}
        lang="pt"
        format="video"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Nenhuma informação de publicação disponível.')).toBeTruthy()
  })

  it('renders strategy launch steps', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{
          ...baseProps.content,
          strategy: ['D+1: Announce the course', 'D+3: Send testimonials'],
        }}
      />
    )
    expect(screen.getByText('Announce the course')).toBeTruthy()
    expect(screen.getByText('Send testimonials')).toBeTruthy()
  })

  it('renders strategy phase label from step prefix', () => {
    render(
      <PublishRenderer
        {...baseProps}
        content={{ ...baseProps.content, strategy: ['D+1: First step'] }}
      />
    )
    expect(screen.getByText('D+1')).toBeTruthy()
  })
})

describe('PublishRenderer — read mode (course format)', () => {
  const courseContent = {
    headline: 'Domine IA em 12 Semanas',
    subheadline: 'O framework que funciona',
    bullet_points: ['Ponto 1', 'Ponto 2'],
    testimonials: [
      { name: 'João', text: 'Ótimo curso!', result: '+50% salário' },
    ],
    faq: [
      { question: 'Quanto tempo dura?', answer: '12 semanas no total.' },
    ],
    cta_text: 'Garantir minha vaga',
    guarantee: '30 dias de garantia',
    platform: 'hotmart',
    platform_url: 'https://pay.hotmart.com/curso',
    sales_page_url: 'https://example.com/vendas',
  }

  const courseProps = {
    content: courseContent,
    isEditing: false as const,
    lang: 'pt',
    format: 'course',
    onContentChange: vi.fn(),
  }

  it('renders course headline', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('Domine IA em 12 Semanas')).toBeTruthy()
  })

  it('renders course subheadline', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('O framework que funciona')).toBeTruthy()
  })

  it('renders bullet points with checkmark prefix', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('Ponto 1')).toBeTruthy()
    expect(screen.getByText('Ponto 2')).toBeTruthy()
    const checks = screen.getAllByText('✓')
    expect(checks.length).toBeGreaterThanOrEqual(2)
  })

  it('renders testimonial text and author name', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('"Ótimo curso!"')).toBeTruthy()
    expect(screen.getByText('João')).toBeTruthy()
  })

  it('renders testimonial result label', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('+50% salário')).toBeTruthy()
  })

  it('renders FAQ question (summary element)', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('Quanto tempo dura?')).toBeTruthy()
  })

  it('renders CTA text', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('Garantir minha vaga')).toBeTruthy()
  })

  it('renders guarantee text', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('30 dias de garantia')).toBeTruthy()
  })

  it('renders platform name badge', () => {
    render(<PublishRenderer {...courseProps} />)
    expect(screen.getByText('hotmart')).toBeTruthy()
  })

  it('shows empty state for course with no sales content', () => {
    render(
      <PublishRenderer
        content={{}}
        isEditing={false}
        lang="pt"
        format="course"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText(/página de vendas ainda não configurada/i)).toBeTruthy()
  })
})

describe('PublishRenderer — edit mode', () => {
  const baseEditProps = {
    content: {
      title: { chosen: 'Original Title' },
      description: 'Original description',
    },
    isEditing: true as const,
    lang: 'pt',
    format: 'video',
    onContentChange: vi.fn(),
  }

  it('title is editable (contentEditable element with aria-label)', () => {
    render(<PublishRenderer {...baseEditProps} />)
    const titleEl = screen.getByRole('textbox', { name: 'Título principal' })
    expect(titleEl).toBeTruthy()
    expect(titleEl.getAttribute('contenteditable')).toBe('true')
  })

  it('description is editable in edit mode', () => {
    render(<PublishRenderer {...baseEditProps} />)
    const descEl = screen.getByRole('textbox', { name: 'Descrição' })
    expect(descEl).toBeTruthy()
    expect(descEl.getAttribute('contenteditable')).toBe('true')
  })

  it('editing title calls onContentChange on blur', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...baseEditProps} onContentChange={onContentChange} />)
    const titleEl = screen.getByRole('textbox', { name: 'Título principal' })
    fireEvent.blur(titleEl, { target: { textContent: 'Updated Title' } })
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { title: { chosen: string } }
    expect(updated.title.chosen).toBe('Updated Title')
  })

  it('editing description calls onContentChange on blur', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...baseEditProps} onContentChange={onContentChange} />)
    const descEl = screen.getByRole('textbox', { name: 'Descrição' })
    fireEvent.blur(descEl, { target: { textContent: 'New description' } })
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { description: string }
    expect(updated.description).toBe('New description')
  })
})

describe('PublishRenderer — edit mode (course format)', () => {
  const courseEditProps = {
    content: {
      headline: 'Original Headline',
      bullet_points: ['Point A', 'Point B'],
      testimonials: [{ name: 'Ana', text: 'Incrível!', result: '2x renda' }],
      faq: [{ question: 'Tem suporte?', answer: 'Sim, 24h.' }],
      cta_text: 'Comprar agora',
      guarantee: '7 dias',
      platform: 'self-hosted',
    },
    isEditing: true as const,
    lang: 'pt',
    format: 'course',
    onContentChange: vi.fn(),
  }

  it('shows add bullet point button', () => {
    render(<PublishRenderer {...courseEditProps} />)
    expect(screen.getByText('+ Argumento')).toBeTruthy()
  })

  it('adding a bullet point calls onContentChange with one more item', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...courseEditProps} onContentChange={onContentChange} />)
    fireEvent.click(screen.getByText('+ Argumento'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { bullet_points: string[] }
    expect(updated.bullet_points).toHaveLength(3)
  })

  it('removing a bullet point calls onContentChange with one fewer item', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...courseEditProps} onContentChange={onContentChange} />)
    // "×" buttons appear for each bullet point; click the first
    const removeButtons = screen.getAllByText('×')
    fireEvent.click(removeButtons[0])
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { bullet_points: string[] }
    expect(updated.bullet_points).toHaveLength(1)
  })

  it('shows add testimonial button', () => {
    render(<PublishRenderer {...courseEditProps} />)
    expect(screen.getByText('+ Depoimento')).toBeTruthy()
  })

  it('adding a testimonial calls onContentChange with one more testimonial', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...courseEditProps} onContentChange={onContentChange} />)
    fireEvent.click(screen.getByText('+ Depoimento'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { testimonials: unknown[] }
    expect(updated.testimonials).toHaveLength(2)
  })

  it('shows add FAQ button', () => {
    render(<PublishRenderer {...courseEditProps} />)
    expect(screen.getByText('+ FAQ')).toBeTruthy()
  })

  it('adding a FAQ item calls onContentChange with one more FAQ entry', () => {
    const onContentChange = vi.fn()
    render(<PublishRenderer {...courseEditProps} onContentChange={onContentChange} />)
    fireEvent.click(screen.getByText('+ FAQ'))
    expect(onContentChange).toHaveBeenCalledOnce()
    const updated = onContentChange.mock.calls[0][0] as { faq: unknown[] }
    expect(updated.faq).toHaveLength(2)
  })

  it('shows platform select in edit mode', () => {
    render(<PublishRenderer {...courseEditProps} />)
    // The displayed text for value="self-hosted" is "Self-hosted"
    const select = screen.getByDisplayValue('Self-hosted')
    expect(select).toBeTruthy()
  })
})

describe('PublishRenderer — edge cases', () => {
  it('handles null content gracefully', () => {
    render(
      <PublishRenderer
        content={null}
        isEditing={false}
        lang="pt"
        format="video"
        onContentChange={vi.fn()}
      />
    )
    // Should not throw; empty state message appears
    expect(screen.getByText('Nenhuma informação de publicação disponível.')).toBeTruthy()
  })

  it('handles empty object content gracefully', () => {
    render(
      <PublishRenderer
        content={{}}
        isEditing={false}
        lang="pt"
        format="video"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Nenhuma informação de publicação disponível.')).toBeTruthy()
  })

  it('handles string content by treating it as a title', () => {
    render(
      <PublishRenderer
        content="Plain string title"
        isEditing={false}
        lang="pt"
        format="video"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Plain string title')).toBeTruthy()
  })

  it('handles missing title field without crashing', () => {
    render(
      <PublishRenderer
        content={{ description: 'Only description' }}
        isEditing={false}
        lang="pt"
        format="video"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Only description')).toBeTruthy()
  })

  it('unsafe platform URL is not rendered as a link', () => {
    const { container } = render(
      <PublishRenderer
        content={{ platform: 'other', platform_url: 'javascript:alert(1)' }}
        isEditing={false}
        lang="pt"
        format="course"
        onContentChange={vi.fn()}
      />
    )
    const links = container.querySelectorAll('a[href="javascript:alert(1)"]')
    expect(links.length).toBe(0)
  })
})
