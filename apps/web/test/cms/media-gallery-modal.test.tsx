import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-image-crop', () => {
  const M = ({ children }: { children: React.ReactNode }) => <div data-testid="react-crop">{children}</div>
  M.displayName = 'ReactCrop'
  return { default: M }
})
vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

const mockUpload = vi.fn()
const mockList = vi.fn()
vi.mock('@/app/cms/(authed)/media/actions', () => ({
  uploadMediaAction: (...args: unknown[]) => mockUpload(...args),
  listMediaAssetsAction: (...args: unknown[]) => mockList(...args),
}))

import { MediaGalleryModal } from '@/app/cms/(authed)/_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '@/app/cms/(authed)/_shared/media/types'

function renderModal(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    locale: 'en' as const,
    siteId: 'site-1',
    ...overrides,
  }
  render(<MediaGalleryModal {...props} />)
  return props
}

describe('MediaGalleryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ ok: true, assets: [], nextCursor: null })
  })

  it('renders when open is true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Media Gallery')).toBeDefined()
  })

  it('does not render when open is false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows Upload and Library tabs', () => {
    renderModal()
    expect(screen.getByText('Upload')).toBeDefined()
    expect(screen.getByText('Library')).toBeDefined()
  })

  it('starts on Upload tab', () => {
    renderModal()
    expect(screen.getByText('Drag an image here or click to browse')).toBeDefined()
  })

  it('switches to Library tab on click', () => {
    renderModal()
    fireEvent.click(screen.getByText('Library'))
    expect(screen.getByPlaceholderText('Search by filename or tag…')).toBeDefined()
  })

  it('calls onClose when Escape is pressed', () => {
    const props = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const props = renderModal()
    const backdrop = screen.getByTestId('gallery-backdrop')
    fireEvent.click(backdrop)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('renders pt-BR strings when locale is pt-BR', () => {
    renderModal({ locale: 'pt-BR' })
    expect(screen.getByText('Galeria de Mídia')).toBeDefined()
  })
})

describe('MediaUploadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ ok: true, assets: [], nextCursor: null })
    mockUpload.mockResolvedValue({
      ok: true,
      asset: {
        id: 'a1',
        blobUrl: 'https://x.blob.vercel-storage.com/test.jpg',
        filename: 'test.jpg',
        altText: 'Alt',
        width: 100,
        height: 100,
        mimeType: 'image/jpeg',
      },
      deduplicated: false,
    })
  })

  it('shows drag-drop zone prompt', () => {
    renderModal()
    expect(screen.getByText('Drag an image here or click to browse')).toBeDefined()
  })

  it('accepts files via input', () => {
    renderModal()
    const input = screen.getByTestId('media-file-input')
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp,image/gif,image/svg+xml')
  })

  it('shows alt text required error on empty submit attempt', async () => {
    renderModal({ cropPreset: undefined })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('upload-form')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('upload-submit'))
    expect(screen.getByText('Alt text is required')).toBeDefined()
  })

  it('shows crop editor when cropPreset is set and file is selected', async () => {
    renderModal({ cropPreset: CROP_PRESETS['avatar'] })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('crop-cancel')).toBeDefined()
    })
  })

  it('calls onSelect after successful upload', async () => {
    const props = renderModal({ cropPreset: undefined })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('upload-form')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('alt-input'), { target: { value: 'My alt' } })
    fireEvent.click(screen.getByTestId('upload-submit'))

    await waitFor(() => {
      expect(props.onSelect).toHaveBeenCalledOnce()
    })
  })
})

describe('MediaLibraryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no assets', async () => {
    mockList.mockResolvedValue({ ok: true, assets: [], nextCursor: null })
    renderModal()
    fireEvent.click(screen.getByText('Library'))
    await waitFor(() => {
      expect(screen.getByText('No images uploaded yet.')).toBeDefined()
    })
  })

  it('renders search and folder filter', async () => {
    mockList.mockResolvedValue({ ok: true, assets: [], nextCursor: null })
    renderModal()
    fireEvent.click(screen.getByText('Library'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by filename or tag…')).toBeDefined()
      expect(screen.getByTestId('library-folder-filter')).toBeDefined()
    })
  })

  it('renders grid of thumbnails when assets exist', async () => {
    mockList.mockResolvedValue({
      ok: true,
      assets: [
        {
          id: 'a1',
          siteId: 'site-1',
          blobUrl: 'https://x.blob.vercel-storage.com/img.jpg',
          blobPathname: 'site-1/blog/abc.jpg',
          filename: 'img.jpg',
          altText: 'Alt 1',
          width: 200,
          height: 100,
          mimeType: 'image/jpeg',
          fileSize: 5000,
          contentHash: 'abc',
          folder: 'blog',
          tags: [],
          uploadedBy: 'user-1',
          createdAt: '2026-01-01',
        },
      ],
      nextCursor: null,
    })
    renderModal()
    fireEvent.click(screen.getByText('Library'))
    await waitFor(() => {
      expect(screen.getByTestId('media-thumb-a1')).toBeDefined()
    })
  })

  it('selects asset on click and shows details bar', async () => {
    mockList.mockResolvedValue({
      ok: true,
      assets: [
        {
          id: 'a1',
          siteId: 'site-1',
          blobUrl: 'https://x.blob.vercel-storage.com/img.jpg',
          blobPathname: 'site-1/blog/abc.jpg',
          filename: 'photo.jpg',
          altText: 'A photo',
          width: 800,
          height: 600,
          mimeType: 'image/jpeg',
          fileSize: 50000,
          contentHash: 'abc',
          folder: 'blog',
          tags: [],
          uploadedBy: 'user-1',
          createdAt: '2026-01-01',
        },
      ],
      nextCursor: null,
    })

    renderModal()
    fireEvent.click(screen.getByText('Library'))

    await waitFor(() => {
      expect(screen.getByTestId('media-thumb-a1')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('media-thumb-a1'))
    expect(screen.getByText('photo.jpg')).toBeDefined()
    expect(screen.getByText('800 × 600')).toBeDefined()
  })
})
