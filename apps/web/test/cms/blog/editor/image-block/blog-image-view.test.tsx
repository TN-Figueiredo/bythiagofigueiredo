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
    Upload: icon('Upload'),
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
  /* 1 — Empty state */
  it('renders empty state when status is "empty"', () => {
    render(<BlogImageView {...makeProps()} />)

    expect(screen.getByTestId('img-empty-state')).toBeTruthy()
    expect(screen.getByText('Clique para adicionar imagem')).toBeTruthy()
    expect(screen.getByTestId('img-gallery-btn')).toBeTruthy()
    expect(screen.getByTestId('img-upload-btn')).toBeTruthy()
  })

  /* 2 — Uploading state */
  it('renders uploading state when status is "uploading"', () => {
    render(
      <BlogImageView
        {...makeProps({ status: 'uploading', filename: 'hero.jpg' })}
      />,
    )

    expect(screen.getByTestId('img-uploading-state')).toBeTruthy()
    expect(screen.getByText('Enviando...')).toBeTruthy()
    expect(screen.getByText('hero.jpg')).toBeTruthy()
  })

  /* 3 — Processing state */
  it('renders processing state when status is "processing"', () => {
    render(<BlogImageView {...makeProps({ status: 'processing' })} />)

    expect(screen.getByTestId('img-processing-state')).toBeTruthy()
    expect(screen.getByText('Processando...')).toBeTruthy()
  })

  /* 4 — Done state */
  it('renders done state when status is "done" with src', () => {
    render(
      <BlogImageView
        {...makeProps({
          status: 'done',
          src: 'https://example.com/image.jpg',
          id: 'img-3',
        })}
      />,
    )

    expect(screen.getByTestId('img-done-state')).toBeTruthy()
    expect(screen.getByTestId('img-badge')).toBeTruthy()
    expect(screen.getByTestId('img-badge').textContent).toBe('img-3')

    // alt="" gives role="presentation", so query by tag
    const img = document.querySelector('img[src="https://example.com/image.jpg"]')
    expect(img).toBeTruthy()
  })

  /* 5 — Gallery button exists */
  it('gallery button is present in empty state', () => {
    const updateAttributes = vi.fn()
    render(
      <BlogImageView {...makeProps({}, { updateAttributes })} />,
    )

    const btn = screen.getByTestId('img-gallery-btn')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('Galeria')
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

    // Default: caption mode
    const captionInput = screen.getByTestId('img-caption-input')
    expect((captionInput as HTMLTextAreaElement).value).toBe('My caption')

    // Toggle to alt
    fireEvent.click(screen.getByTestId('img-alt-tab'))
    const altInput = screen.getByTestId('img-alt-input')
    expect((altInput as HTMLTextAreaElement).value).toBe('My alt text')

    // Toggle back to caption
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

    // Before onLoad fires, naturalWidth is null — buttons should not be disabled
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

  /* Bonus — Empty state shows badge with id */
  it('shows badge with image id in empty state', () => {
    render(<BlogImageView {...makeProps({ id: 'img-5' })} />)

    expect(screen.getByText('img-5')).toBeTruthy()
  })

  /* Bonus — Alt text warning in empty state */
  it('shows alt text warning when alt is empty in empty state', () => {
    render(<BlogImageView {...makeProps({ alt: '' })} />)

    expect(screen.getByTestId('img-alt-warning')).toBeTruthy()
  })

  it('hides alt text warning when alt is present in empty state', () => {
    render(<BlogImageView {...makeProps({ alt: 'Good alt text' })} />)

    expect(screen.queryByTestId('img-alt-warning')).toBeNull()
  })

  /* Bonus — NodeViewWrapper rendered */
  it('wraps in NodeViewWrapper', () => {
    render(<BlogImageView {...makeProps()} />)

    expect(screen.getByTestId('node-view-wrapper')).toBeTruthy()
  })

  /* Bonus — Replace button calls updateAttributes */
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

  /* Bonus — Caption input updates attributes */
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
})
