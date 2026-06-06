import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlogImageView } from '@/app/cms/(authed)/blog/[id]/edit/image-block/blog-image-view'

/* ------------------------------------------------------------------ */
/*  Mock @tiptap/react                                                */
/* ------------------------------------------------------------------ */

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="node-view-wrapper" {...props}>
      {children as React.ReactNode}
    </div>
  ),
}))

/* ------------------------------------------------------------------ */
/*  Mock lucide-react — render simple spans with icon name            */
/* ------------------------------------------------------------------ */

vi.mock('lucide-react', () => {
  const icon = (name: string) => {
    const C = (props: Record<string, unknown>) => (
      <span data-icon={name} {...props} />
    )
    C.displayName = name
    return C
  }
  return {
    ImageIcon: icon('ImageIcon'),
    Plus: icon('Plus'),
    ArrowRight: icon('ArrowRight'),
    Loader2: icon('Loader2'),
    AlertTriangle: icon('AlertTriangle'),
    Columns3: icon('Columns3'),
    ArrowLeftRight: icon('ArrowLeftRight'),
    Maximize: icon('Maximize'),
    Replace: icon('Replace'),
    Trash2: icon('Trash2'),
    MoreHorizontal: icon('MoreHorizontal'),
  }
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeProps(
  attrsOverride: Record<string, unknown> = {},
  propsOverride: Partial<{
    updateAttributes: ReturnType<typeof vi.fn>
    deleteNode: ReturnType<typeof vi.fn>
    selected: boolean
  }> = {},
) {
  return {
    node: {
      attrs: {
        id: 'img-1',
        src: null,
        alt: '',
        caption: '',
        status: 'empty',
        alignment: 'column',
        width: null,
        assetId: null,
        filename: null,
        ...attrsOverride,
      },
    },
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    selected: false,
    ...propsOverride,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('BlogImageView', () => {
  /* 1 — Empty state renders .doc-img.pending */
  it('renders empty state when status is "empty"', () => {
    const { container } = render(<BlogImageView {...makeProps()} />)

    const block = container.querySelector('.doc-img.pending')
    expect(block).toBeTruthy()
    expect(block?.querySelector('.di-thumb')).toBeTruthy()
    expect(block?.querySelector('.di-info')).toBeTruthy()
    expect(block?.querySelector('.di-id')).toBeTruthy()
    expect(screen.getByText('sem imagem')).toBeTruthy()
  })

  /* 2 — Uploading state */
  it('renders uploading state when status is "uploading"', () => {
    const { container } = render(
      <BlogImageView
        {...makeProps({ status: 'uploading', filename: 'hero.jpg' })}
      />,
    )

    const block = container.querySelector('.doc-img')
    expect(block).toBeTruthy()
    expect(screen.getByText('enviando…')).toBeTruthy()
    expect(screen.getByText('hero.jpg')).toBeTruthy()
  })

  /* 3 — Processing state */
  it('renders processing state when status is "processing"', () => {
    const { container } = render(
      <BlogImageView {...makeProps({ status: 'processing' })} />,
    )

    const block = container.querySelector('.doc-img')
    expect(block).toBeTruthy()
    expect(screen.getByText('processando…')).toBeTruthy()
  })

  /* 4 — Done state */
  it('renders done state when status is "done" with src', () => {
    const { container } = render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/image.jpg',
          id: 'img-3',
        })}
      />,
    )

    const block = container.querySelector('.doc-img.done')
    expect(block).toBeTruthy()

    const img = container.querySelector('img[src="https://example.com/image.jpg"]')
    expect(img).toBeTruthy()
  })

  /* 5 — di-go button in empty state */
  it('di-go button is present in empty state', () => {
    const { container } = render(
      <BlogImageView {...makeProps()} />,
    )

    const goBtn = container.querySelector('.di-go')
    expect(goBtn).toBeTruthy()
    expect(goBtn?.getAttribute('title')).toBe('Abrir em Imagens')
  })

  /* 6 — Caption/Alt toggle */
  it('toggles between caption and alt modes', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/img.jpg',
          caption: 'My caption',
          alt: 'My alt text',
        })}
      />,
    )

    const captionInput = screen.getByTestId('img-caption-input')
    expect((captionInput as HTMLTextAreaElement).value).toBe('My caption')

    fireEvent.click(screen.getByTestId('img-alt-tab'))
    const altInput = screen.getByTestId('img-alt-input')
    expect((altInput as HTMLTextAreaElement).value).toBe('My alt text')

    fireEvent.click(screen.getByTestId('img-caption-tab'))
    const captionAgain = screen.getByTestId('img-caption-input')
    expect((captionAgain as HTMLTextAreaElement).value).toBe('My caption')
  })

  /* 7 — Alt button shows amber dot when alt is empty */
  it('shows amber dot on Alt button when alt text is empty', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/img.jpg',
          alt: '',
        })}
      />,
    )

    expect(screen.getByTestId('img-alt-dot')).toBeTruthy()
  })

  it('hides amber dot when alt text is present', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/img.jpg',
          alt: 'Descriptive alt text',
        })}
      />,
    )

    expect(screen.queryByTestId('img-alt-dot')).toBeNull()
  })

  /* 8 — Toolbar width mode buttons in done state */
  it('shows width mode buttons in done state toolbar', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/img.jpg',
        })}
      />,
    )

    expect(screen.getByTestId('img-width-column')).toBeTruthy()
    expect(screen.getByTestId('img-width-wide')).toBeTruthy()
    expect(screen.getByTestId('img-width-full')).toBeTruthy()
  })

  /* 9 — Wide button disabled when naturalWidth < 900 */
  it('wide button is not disabled before image loads (naturalWidth null)', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/img.jpg',
        })}
      />,
    )

    const wideBtn = screen.getByTestId('img-width-wide')
    expect(wideBtn.hasAttribute('disabled')).toBe(false)
  })

  /* 10 — Delete button calls deleteNode */
  it('delete button calls deleteNode', () => {
    const deleteNode = vi.fn()
    render(
      <BlogImageView
        {...makeProps(
          { status: 'done', src: 'https://example.com/img.jpg' },
          { deleteNode },
        )}
      />,
    )

    fireEvent.click(screen.getByTestId('img-delete-btn'))
    expect(deleteNode).toHaveBeenCalledTimes(1)
  })

  /* 11 — Empty state shows id text */
  it('shows image id in empty state', () => {
    render(<BlogImageView {...makeProps({ id: 'img-5' })} />)

    expect(screen.getByText('img-5')).toBeTruthy()
  })

  /* 12 — Empty state shows alt/caption text */
  it('shows caption text in di-alt when present', () => {
    const { container } = render(
      <BlogImageView {...makeProps({ caption: 'Timeline visual' })} />,
    )

    const altSpan = container.querySelector('.di-alt')
    expect(altSpan?.textContent).toBe('Timeline visual')
  })

  it('shows alt text in di-alt when no caption', () => {
    const { container } = render(
      <BlogImageView {...makeProps({ alt: 'Good alt text' })} />,
    )

    const altSpan = container.querySelector('.di-alt')
    expect(altSpan?.textContent).toBe('Good alt text')
  })

  /* 13 — NodeViewWrapper rendered */
  it('wraps in NodeViewWrapper', () => {
    render(<BlogImageView {...makeProps()} />)

    expect(screen.getByTestId('node-view-wrapper')).toBeTruthy()
  })

  /* 14 — Replace button calls updateAttributes */
  it('replace button resets to empty state', () => {
    const updateAttributes = vi.fn()
    render(
      <BlogImageView
        {...makeProps(
          { status: 'done', src: 'https://example.com/img.jpg' },
          { updateAttributes },
        )}
      />,
    )

    fireEvent.click(screen.getByTestId('img-replace-btn'))
    expect(updateAttributes).toHaveBeenCalledWith({
      status: 'empty',
      src: null,
    })
  })

  /* 15 — Caption input updates attributes */
  it('caption input calls updateAttributes on change', () => {
    const updateAttributes = vi.fn()
    render(
      <BlogImageView
        {...makeProps(
          { status: 'done', src: 'https://example.com/img.jpg', caption: '' },
          { updateAttributes },
        )}
      />,
    )

    const input = screen.getByTestId('img-caption-input')
    fireEvent.change(input, { target: { value: 'New caption' } })
    expect(updateAttributes).toHaveBeenCalledWith({ caption: 'New caption' })
  })

  /* 16 — Done without src falls back to empty */
  it('falls back to empty state when done but no src', () => {
    const { container } = render(
      <BlogImageView {...makeProps({ status: 'done', src: null })} />,
    )

    const block = container.querySelector('.doc-img.pending')
    expect(block).toBeTruthy()
  })
})
