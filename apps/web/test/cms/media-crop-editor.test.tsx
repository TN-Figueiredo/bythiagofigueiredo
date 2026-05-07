import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-image-crop', () => {
  const MockReactCrop = ({ children, aspect, circularCrop, onChange }: {
    children: React.ReactNode
    aspect?: number
    circularCrop?: boolean
    onChange: (c: unknown) => void
  }) => (
    <div
      data-testid="react-crop"
      data-aspect={aspect}
      data-circular={circularCrop}
      onClick={() => onChange({ x: 0, y: 0, width: 50, height: 50, unit: '%' })}
    >
      {children}
    </div>
  )
  MockReactCrop.displayName = 'ReactCrop'
  return { default: MockReactCrop }
})

vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}))

import { MediaCropEditor } from '@/app/cms/(authed)/_shared/media/media-crop-editor'
import { CROP_PRESETS } from '@/app/cms/(authed)/_shared/media/types'

describe('MediaCropEditor', () => {
  const defaultProps = {
    imageUrl: 'blob:http://localhost/test-image',
    preset: CROP_PRESETS['avatar'],
    locale: 'en' as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders with locked aspect ratio for avatar preset', () => {
    render(<MediaCropEditor {...defaultProps} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.aspect).toBe('1')
  })

  it('renders without aspect lock for free preset', () => {
    render(<MediaCropEditor {...defaultProps} preset={CROP_PRESETS['free']} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.aspect).toBeUndefined()
  })

  it('enables circular mask for avatar preset', () => {
    render(<MediaCropEditor {...defaultProps} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.circular).toBe('true')
  })

  it('disables circular mask for blog-cover preset', () => {
    render(<MediaCropEditor {...defaultProps} preset={CROP_PRESETS['blog-cover']} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.circular).toBe('false')
  })

  it('shows cancel button that calls onCancel', () => {
    render(<MediaCropEditor {...defaultProps} />)
    fireEvent.click(screen.getByTestId('crop-cancel'))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('renders i18n strings for pt-BR', () => {
    render(<MediaCropEditor {...defaultProps} locale="pt-BR" />)
    expect(screen.getByText('Recortar imagem')).toBeDefined()
    expect(screen.getByText('Aplicar recorte')).toBeDefined()
  })

  it('renders i18n strings for en', () => {
    render(<MediaCropEditor {...defaultProps} locale="en" />)
    expect(screen.getByText('Crop image')).toBeDefined()
    expect(screen.getByText('Apply crop')).toBeDefined()
  })
})
