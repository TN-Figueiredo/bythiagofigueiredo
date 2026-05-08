import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PostKeyPoints } from '../../../src/components/blog/post-key-points'
import { PostPullQuote } from '../../../src/components/blog/post-pull-quote'
import { PostColophon } from '../../../src/components/blog/post-colophon'
import { PostNotes } from '../../../src/components/blog/post-notes'
import { PostTags } from '../../../src/components/blog/post-tags'
import { AuthorRow } from '../../../src/components/blog/author-row'
import { AuthorCard } from '../../../src/components/blog/author-card'
import { SeriesBanner } from '../../../src/components/blog/series-banner'
import { SeriesNav } from '../../../src/components/blog/series-nav'
import { CoverImage } from '../../../src/components/blog/cover-image'
import { RelatedPostsGrid } from '../../../src/components/blog/related-posts-grid'
import { PostFootnotes } from '../../../src/components/blog/post-footnotes'
import { ShareButtons } from '../../../src/components/blog/share-buttons'
import { ptBR } from '../../../src/components/blog/_i18n/pt-BR'
import { en } from '../../../src/components/blog/_i18n/en'

const testAuthor = {
  name: 'Thiago Figueiredo',
  role: 'Dev indie, BH',
  avatarUrl: null,
  initials: 'TF',
  bio: 'Construo software ha seis anos. Desde 2024, so pra mim mesmo: seis apps no forno, um canal no YouTube, um blog que virou o centro de tudo. Aqui voce me acha escrevendo uma vez por semana, filmando uma vez por semana, e quebrando coisa em producao com a frequencia que Deus achar justa.',
  links: [
    { label: 'YouTube', href: 'https://www.youtube.com/@bythiagofigueiredo' },
    { label: 'GitHub', href: 'https://github.com/tn-figueiredo' },
  ],
}

describe('PostKeyPoints', () => {
  it('renders numbered key points', () => {
    const { container } = render(<PostKeyPoints points={['Point A', 'Point B']} t={ptBR} />)
    expect(container.textContent).toContain('01')
    expect(container.textContent).toContain('Point A')
    expect(container.textContent).toContain('02')
    expect(container.textContent).toContain('Point B')
  })

  it('uses i18n label', () => {
    const { container } = render(<PostKeyPoints points={['Point A']} t={ptBR} />)
    expect(container.textContent).toContain('Pontos-chave')
  })

  it('uses en i18n label', () => {
    const { container } = render(<PostKeyPoints points={['Point A']} t={en} />)
    expect(container.textContent).toContain('Key Points')
  })

  it('returns null when points is undefined', () => {
    const { container } = render(<PostKeyPoints points={undefined} t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when points is empty', () => {
    const { container } = render(<PostKeyPoints points={[]} t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostPullQuote', () => {
  it('renders quote and attribution', () => {
    const { container } = render(
      <PostPullQuote quote="a notebook" attribution="PROMISE 3" />,
    )
    expect(container.textContent).toContain('a notebook')
    expect(container.textContent).toContain('PROMISE 3')
  })

  it('returns null when quote is undefined', () => {
    const { container } = render(<PostPullQuote quote={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostColophon', () => {
  it('renders colophon text', () => {
    const { container } = render(<PostColophon text="Written in iA Writer" t={ptBR} />)
    expect(container.textContent).toContain('Written in iA Writer')
    expect(container.textContent).toContain('COLOFÃO')
  })

  it('uses en i18n label', () => {
    const { container } = render(<PostColophon text="Written in iA Writer" t={en} />)
    expect(container.textContent).toContain('COLOPHON')
  })

  it('returns null when text is undefined', () => {
    const { container } = render(<PostColophon text={undefined} t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostNotes', () => {
  it('renders numbered notes', () => {
    const { container } = render(<PostNotes notes={['First note', 'Second note']} t={ptBR} />)
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('First note')
    expect(container.textContent).toContain('2')
    expect(container.textContent).toContain('Second note')
  })

  it('uses i18n label', () => {
    const { container } = render(<PostNotes notes={['Note']} t={ptBR} />)
    expect(container.textContent).toContain('Notas')
  })

  it('returns null when notes is empty', () => {
    const { container } = render(<PostNotes notes={[]} t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostTags', () => {
  const hashtags = [
    { id: '1', name: 'meta', slug: 'meta' },
    { id: '2', name: 'manifesto', slug: 'manifesto' },
  ]

  it('renders tag pills', () => {
    const { getByText } = render(
      <PostTags hashtags={hashtags} locale="pt-BR" t={ptBR} />,
    )
    expect(getByText('#meta')).toBeTruthy()
    expect(getByText('#manifesto')).toBeTruthy()
  })

  it('uses i18n label', () => {
    const { container } = render(<PostTags hashtags={hashtags} locale="pt-BR" t={ptBR} />)
    expect(container.textContent).toContain('Tags')
  })

  it('returns null when hashtags is empty', () => {
    const { container } = render(<PostTags hashtags={[]} locale="pt-BR" t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('AuthorRow', () => {
  it('renders author name and role', () => {
    const { container } = render(
      <AuthorRow author={testAuthor} engagement={{ views: 2460, likes: 319, bookmarked: false }} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('Dev indie')
  })

  it('renders engagement stats', () => {
    const { container } = render(
      <AuthorRow author={testAuthor} engagement={{ views: 2460, likes: 319, bookmarked: false }} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('2.460')
    expect(container.textContent).toContain('319')
  })
})

describe('AuthorCard', () => {
  it('renders full author card with bio', () => {
    const { container } = render(
      <AuthorCard author={testAuthor} locale="pt-BR" />,
    )
    expect(container.textContent).toContain('Sobre quem escreveu')
    expect(container.textContent).toContain('Construo software')
    expect(container.textContent).toContain('YouTube')
    expect(container.textContent).toContain('GitHub')
  })
})

describe('SeriesBanner', () => {
  it('renders previous post link', () => {
    const { container } = render(
      <SeriesBanner
        previousPost={{ title: 'Building in public', slug: 'building-in-public', locale: 'pt-BR' }}
        t={ptBR}
      />,
    )
    expect(container.textContent).toContain('PARTE DA SÉRIE')
    expect(container.textContent).toContain('Building in public')
  })

  it('uses en i18n label', () => {
    const { container } = render(
      <SeriesBanner
        previousPost={{ title: 'First Part', slug: 'first-part', locale: 'en' }}
        t={en}
      />,
    )
    expect(container.textContent).toContain('PART OF SERIES')
  })

  it('returns null when previousPost is null', () => {
    const { container } = render(<SeriesBanner previousPost={null} t={ptBR} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('SeriesNav', () => {
  it('renders next post in series', () => {
    const { container } = render(
      <SeriesNav
        previousPost={null}
        nextPost={{ title: 'A CMS to rule them all', slug: 'cms-for-all', locale: 'pt-BR', excerpt: 'The architecture behind cross-site publishing...' }}
        continuesInNext={false}
        t={ptBR}
        locale="pt-BR"
      />,
    )
    expect(container.textContent).toContain('CONTINUA NA PRÓXIMA PARTE')
    expect(container.textContent).toContain('A CMS to rule them all')
  })

  it('renders previous post link', () => {
    const { container } = render(
      <SeriesNav
        previousPost={{ title: 'Part One', slug: 'part-one', locale: 'pt-BR' }}
        nextPost={null}
        continuesInNext={false}
        t={ptBR}
        locale="pt-BR"
      />,
    )
    expect(container.textContent).toContain('POST ANTERIOR')
    expect(container.textContent).toContain('Part One')
  })

  it('renders continuesInNext without nextPost', () => {
    const { container } = render(
      <SeriesNav
        previousPost={null}
        nextPost={null}
        continuesInNext={true}
        t={en}
        locale="en"
      />,
    )
    expect(container.textContent).toContain('CONTINUES IN NEXT PART')
  })

  it('returns null when nothing to show', () => {
    const { container } = render(
      <SeriesNav previousPost={null} nextPost={null} continuesInNext={false} t={ptBR} locale="pt-BR" />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('CoverImage', () => {
  it('renders image in paper+tape wrapper', () => {
    const { container } = render(
      <CoverImage src="https://example.com/img.jpg" alt="Test" />,
    )
    expect(container.querySelector('img')).toBeTruthy()
    expect(container.textContent).toContain('bythiagofigueiredo')
  })

  it('returns null when src is null and no heroIllustration', () => {
    const { container } = render(<CoverImage src={null} alt="Test" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders hero illustration when heroIllustration is set', () => {
    const { container } = render(<CoverImage src={null} alt="Test" heroIllustration="constellation" />)
    expect(container.innerHTML).not.toBe('')
  })
})

describe('RelatedPostsGrid', () => {
  it('renders 3 related post cards', () => {
    const posts = [
      { id: '1', slug: 'post-1', title: 'First Post', excerpt: 'Excerpt 1', category: 'Ensaios', coverImageUrl: null, readingTimeMin: 5, publishedAt: '2026-04-17' },
      { id: '2', slug: 'post-2', title: 'Second Post', excerpt: 'Excerpt 2', category: 'Ensaios', coverImageUrl: null, readingTimeMin: 8, publishedAt: '2026-03-01' },
      { id: '3', slug: 'post-3', title: 'Third Post', excerpt: null, category: 'Codigo', coverImageUrl: null, readingTimeMin: 4, publishedAt: '2026-02-01' },
    ]
    const { container } = render(
      <RelatedPostsGrid posts={posts} locale="pt-BR" category="Ensaios" />,
    )
    expect(container.textContent).toContain('Textos relacionados')
    expect(container.textContent).toContain('First Post')
    expect(container.textContent).toContain('Second Post')
    expect(container.textContent).toContain('Third Post')
  })

  it('returns null when posts is empty', () => {
    const { container } = render(<RelatedPostsGrid posts={[]} locale="pt-BR" category={null} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostFootnotes', () => {
  it('renders footnotes with back-links', () => {
    const footnotes = [
      { id: '1', content: 'First footnote text' },
      { id: '2', content: 'Second footnote text' },
    ]
    const { container } = render(<PostFootnotes footnotes={footnotes} />)
    expect(container.textContent).toContain('NOTAS')
    expect(container.textContent).toContain('First footnote text')
    expect(container.textContent).toContain('Second footnote text')
    const backLinks = container.querySelectorAll('a[href^="#fnref-"]')
    expect(backLinks.length).toBe(2)
    expect(backLinks[0]!.getAttribute('href')).toBe('#fnref-1')
    expect(backLinks[1]!.getAttribute('href')).toBe('#fnref-2')
  })

  it('returns null when footnotes is empty', () => {
    const { container } = render(<PostFootnotes footnotes={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('ShareButtons', () => {
  it('renders all 3 buttons with correct aria-labels (en)', () => {
    const { container } = render(<ShareButtons url="https://example.com/post" locale="en" />)
    const xBtn = container.querySelector('[aria-label="Share on X"]')
    const linkedInBtn = container.querySelector('[aria-label="Share on LinkedIn"]')
    const copyBtn = container.querySelector('[aria-label="Copy link"]')
    expect(xBtn).toBeTruthy()
    expect(linkedInBtn).toBeTruthy()
    expect(copyBtn).toBeTruthy()
  })

  it('includes encoded URL in share links', () => {
    const url = 'https://example.com/post?a=1'
    const { container } = render(<ShareButtons url={url} locale="en" />)
    const xLink = container.querySelector('[aria-label="Share on X"]') as HTMLAnchorElement
    expect(xLink.href).toContain(encodeURIComponent(url))
    const liLink = container.querySelector('[aria-label="Share on LinkedIn"]') as HTMLAnchorElement
    expect(liLink.href).toContain(encodeURIComponent(url))
  })
})
