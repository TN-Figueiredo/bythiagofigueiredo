import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PostKeyPoints } from '../../../src/components/blog/post-key-points'
import { PostPullQuote } from '../../../src/components/blog/post-pull-quote'
import { PostColophon } from '../../../src/components/blog/post-colophon'
import { PostTags } from '../../../src/components/blog/post-tags'
import { AuthorRow } from '../../../src/components/blog/author-row'
import { AuthorCard } from '../../../src/components/blog/author-card'
import { SeriesBanner } from '../../../src/components/blog/series-banner'
import { SeriesNav } from '../../../src/components/blog/series-nav'
import { CoverImage } from '../../../src/components/blog/cover-image'
import { PostComments } from '../../../src/components/blog/post-comments'
import { RelatedPostsGrid } from '../../../src/components/blog/related-posts-grid'
import { PostFootnotes } from '../../../src/components/blog/post-footnotes'
import { ShareButtons } from '../../../src/components/blog/share-buttons'
import { AUTHOR_THIAGO, MOCK_ENGAGEMENT, MOCK_COMMENTS } from '../../../src/components/blog/mock-data'

describe('PostKeyPoints', () => {
  it('renders numbered key points', () => {
    const { container } = render(<PostKeyPoints points={['Point A', 'Point B']} />)
    expect(container.textContent).toContain('01')
    expect(container.textContent).toContain('Point A')
    expect(container.textContent).toContain('02')
    expect(container.textContent).toContain('Point B')
  })

  it('returns null when points is undefined', () => {
    const { container } = render(<PostKeyPoints points={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when points is empty', () => {
    const { container } = render(<PostKeyPoints points={[]} />)
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
    const { container } = render(<PostColophon text="Written in iA Writer" />)
    expect(container.textContent).toContain('Written in iA Writer')
    expect(container.textContent).toContain('COLOFAO')
  })

  it('returns null when text is undefined', () => {
    const { container } = render(<PostColophon text={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostTags', () => {
  it('renders tag pills', () => {
    const { getByText } = render(
      <PostTags tags={['meta', 'manifesto']} locale="pt-BR" />,
    )
    expect(getByText('#meta')).toBeTruthy()
    expect(getByText('#manifesto')).toBeTruthy()
  })

  it('returns null when tags is undefined', () => {
    const { container } = render(<PostTags tags={undefined} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('AuthorRow', () => {
  it('renders author name and role', () => {
    const { container } = render(
      <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('Dev indie')
  })

  it('renders engagement stats', () => {
    const { container } = render(
      <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('2.460')
    expect(container.textContent).toContain('319')
  })
})

describe('AuthorCard', () => {
  it('renders full author card with bio', () => {
    const { container } = render(
      <AuthorCard author={AUTHOR_THIAGO} locale="pt-BR" />,
    )
    expect(container.textContent).toContain('Sobre quem escreveu')
    expect(container.textContent).toContain('Construo software')
    expect(container.textContent).toContain('YouTube')
    expect(container.textContent).toContain('GitHub')
  })
})

describe('SeriesBanner', () => {
  it('renders series title and part info', () => {
    const { container } = render(
      <SeriesBanner title="Building in public" part={1} total={3} />,
    )
    expect(container.textContent).toContain('PARTE DA SERIE')
    expect(container.textContent).toContain('1 DE 3')
    expect(container.textContent).toContain('Building in public')
  })

  it('returns null when title is undefined', () => {
    const { container } = render(<SeriesBanner title={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('SeriesNav', () => {
  it('renders next post in series', () => {
    const { container } = render(
      <SeriesNav
        nextSlug="cms-for-all"
        nextTitle="A CMS to rule them all"
        nextExcerpt="The architecture behind cross-site publishing..."
        locale="pt-BR"
      />,
    )
    expect(container.textContent).toContain('CONTINUA NA PROXIMA PARTE')
    expect(container.textContent).toContain('A CMS to rule them all')
  })

  it('returns null when nextSlug is undefined', () => {
    const { container } = render(<SeriesNav locale="pt-BR" />)
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

describe('PostComments', () => {
  it('renders comments with form', () => {
    const { container } = render(<PostComments comments={MOCK_COMMENTS} />)
    expect(container.textContent).toContain('Conversa')
    expect(container.textContent).toContain('Paula Reis')
    expect(container.textContent).toContain('resposta do autor')
    expect(container.querySelector('textarea')).toBeTruthy()
  })

  it('renders as section with id="comments"', () => {
    const { container } = render(<PostComments comments={MOCK_COMMENTS} />)
    expect(container.querySelector('section#comments')).toBeTruthy()
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
  it('renders all 3 buttons with correct aria-labels', () => {
    const { container } = render(<ShareButtons url="https://example.com/post" />)
    const xBtn = container.querySelector('[aria-label="Compartilhar no X"]')
    const linkedInBtn = container.querySelector('[aria-label="Compartilhar no LinkedIn"]')
    const copyBtn = container.querySelector('[aria-label="Copiar link"]')
    expect(xBtn).toBeTruthy()
    expect(linkedInBtn).toBeTruthy()
    expect(copyBtn).toBeTruthy()
  })

  it('includes encoded URL in share links', () => {
    const url = 'https://example.com/post?a=1'
    const { container } = render(<ShareButtons url={url} />)
    const xLink = container.querySelector('[aria-label="Compartilhar no X"]') as HTMLAnchorElement
    expect(xLink.href).toContain(encodeURIComponent(url))
    const liLink = container.querySelector('[aria-label="Compartilhar no LinkedIn"]') as HTMLAnchorElement
    expect(liLink.href).toContain(encodeURIComponent(url))
  })
})
