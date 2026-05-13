import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social/new'),
}))

import { ImageComposer } from '@/app/cms/(authed)/social/new/_components/image-composer'
import { VideoComposer } from '@/app/cms/(authed)/social/new/_components/video-composer'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

// ── ImageComposer ─────────────────────────────────────────────────────────────

describe('ImageComposer', () => {
  const defaultProps = {
    images: [] as string[],
    onImagesChange: vi.fn(),
    caption: '',
    onCaptionChange: vi.fn(),
    selectedPlatforms: [] as never[],
    strings: en,
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders add images label', () => {
    render(<ImageComposer {...defaultProps} />)
    expect(screen.getByText(en.composer.image.addImages)).toBeDefined()
  })

  it('renders caption textarea', () => {
    render(<ImageComposer {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('shows image thumbnails when images are provided', () => {
    render(<ImageComposer {...defaultProps} images={['https://example.com/img1.jpg', 'https://example.com/img2.jpg']} />)
    // Images use alt="" so they are presentational — query by tag directly
    const imgs = document.querySelectorAll('img')
    expect(imgs.length).toBe(2)
  })

  it('calls onImagesChange when remove button is clicked', () => {
    const onImagesChange = vi.fn()
    render(
      <ImageComposer
        {...defaultProps}
        images={['https://example.com/img1.jpg']}
        onImagesChange={onImagesChange}
      />,
    )
    // The remove button renders "x"
    const removeBtn = screen.getByRole('button', { name: 'x' })
    fireEvent.click(removeBtn)
    expect(onImagesChange).toHaveBeenCalledWith([])
  })

  it('shows position numbers on image thumbnails', () => {
    render(
      <ImageComposer
        {...defaultProps}
        images={['https://example.com/img1.jpg', 'https://example.com/img2.jpg']}
      />,
    )
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows IG carousel badge for 2+ images on Instagram', () => {
    render(
      <ImageComposer
        {...defaultProps}
        images={['https://a.com/1.jpg', 'https://a.com/2.jpg']}
        selectedPlatforms={['instagram'] as never[]}
      />,
    )
    expect(screen.getByText(en.composer.image.igCarousel)).toBeDefined()
  })

  it('shows FB multi-photo badge for 2+ images on Facebook', () => {
    render(
      <ImageComposer
        {...defaultProps}
        images={['https://a.com/1.jpg', 'https://a.com/2.jpg']}
        selectedPlatforms={['facebook'] as never[]}
      />,
    )
    expect(screen.getByText(en.composer.image.fbMulti)).toBeDefined()
  })

  it('calls onCaptionChange when caption textarea changes', () => {
    const onCaptionChange = vi.fn()
    render(<ImageComposer {...defaultProps} onCaptionChange={onCaptionChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A caption' } })
    expect(onCaptionChange).toHaveBeenCalledWith('A caption')
  })
})

// ── VideoComposer ─────────────────────────────────────────────────────────────

describe('VideoComposer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the upload zone', () => {
    render(<VideoComposer strings={en} />)
    expect(screen.getByText(en.composer.video.uploadZone)).toBeDefined()
  })

  it('renders privacy dropdown in default state', () => {
    render(<VideoComposer strings={en} />)
    // The select has no associated id, so query by label text directly
    expect(screen.getByText(en.composer.video.privacyLabel)).toBeDefined()
    expect(screen.getByRole('combobox')).toBeDefined()
  })

  it('shows all three privacy options', () => {
    render(<VideoComposer strings={en} />)
    expect(screen.getByRole('option', { name: en.composer.video.privacyPrivate })).toBeDefined()
    expect(screen.getByRole('option', { name: en.composer.video.privacyUnlisted })).toBeDefined()
    expect(screen.getByRole('option', { name: en.composer.video.privacyPublic })).toBeDefined()
  })

  it('renders title input label', () => {
    render(<VideoComposer strings={en} />)
    expect(screen.getByText(en.composer.video.titleLabel)).toBeDefined()
  })

  it('renders description textarea label', () => {
    render(<VideoComposer strings={en} />)
    expect(screen.getByText(en.composer.video.descLabel)).toBeDefined()
  })

  it('shows quota info with 0 used by default', () => {
    render(<VideoComposer strings={en} />)
    const expected = en.composer.video.quotaLabel.replace('{used}', '0').replace('{limit}', '10000')
    expect(screen.getByText(expected)).toBeDefined()
  })

  it('shows quota used when provided', () => {
    render(<VideoComposer strings={en} quotaUsed={2500} />)
    const expected = en.composer.video.quotaLabel.replace('{used}', '2500').replace('{limit}', '10000')
    expect(screen.getByText(expected)).toBeDefined()
  })

  it('shows quota percentage', () => {
    render(<VideoComposer strings={en} quotaUsed={5000} />)
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('shows file info after a video file is selected', () => {
    render(<VideoComposer strings={en} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['video content'], 'my-video.mp4', { type: 'video/mp4' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(screen.getByText('my-video.mp4')).toBeDefined()
  })
})
