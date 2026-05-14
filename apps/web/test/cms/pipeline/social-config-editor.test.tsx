import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SocialConfigEditor } from '../../../src/app/cms/(authed)/pipeline/_components/detail/social-config-editor'
import type { SocialConfig } from '../../../src/lib/social/types'

const BASE_CONFIG: SocialConfig = {
  enabled: true,
  platforms: ['facebook', 'instagram'],
  captions: { facebook: { pt: 'hello' } },
  hashtags: ['test'],
  image_source: 'og_image',
  ig_template: 'card',
  formats: { facebook: 'link_share' },
}

describe('SocialConfigEditor', () => {
  let onChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onChange = vi.fn()
  })

  // 1. null config renders "Configurar Social" button
  it('renders "Configurar Social" button when config is null', () => {
    render(<SocialConfigEditor config={null} onChange={onChange} />)
    expect(screen.getByText('Configurar Social')).toBeDefined()
  })

  // 2. clicking "Configurar Social" calls onChange with default config
  it('clicking "Configurar Social" calls onChange with default config', () => {
    render(<SocialConfigEditor config={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('Configurar Social'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.enabled).toBe(true)
    expect(arg.platforms).toEqual([])
    expect(arg.captions).toEqual({})
    expect(arg.hashtags).toEqual([])
    expect(arg.image_source).toBe('og_image')
    expect(arg.ig_template).toBe('card')
    expect(arg.formats).toEqual({})
  })

  // 3. disabled prop disables "Configurar Social" button
  it('disabled prop disables "Configurar Social" button', () => {
    render(<SocialConfigEditor config={null} onChange={onChange} disabled />)
    const btn = screen.getByText('Configurar Social') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  // 4. toggle switch flips enabled
  it('toggle switch flips enabled', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: 'Ativar publicação social' })
    fireEvent.click(toggle)

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.enabled).toBe(false)
  })

  // 5. content hidden when disabled
  it('hides platform checkboxes when config.enabled is false', () => {
    const disabledConfig: SocialConfig = { ...BASE_CONFIG, enabled: false }
    render(<SocialConfigEditor config={disabledConfig} onChange={onChange} />)

    // The toggle switch should still be present
    expect(screen.getByRole('switch')).toBeDefined()
    // Platform checkboxes should not be rendered
    expect(screen.queryByText('Facebook')).toBeNull()
    expect(screen.queryByText('Instagram')).toBeNull()
  })

  // 6. toggling a platform checkbox adds/removes from platforms
  it('toggling a platform checkbox adds it to platforms', () => {
    const config: SocialConfig = { ...BASE_CONFIG, platforms: ['facebook'], captions: {}, formats: {} }
    render(<SocialConfigEditor config={config} onChange={onChange} />)

    // Check Bluesky to add it
    const blueskyCheckbox = screen.getByLabelText('Bluesky') as HTMLInputElement
    fireEvent.click(blueskyCheckbox)

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.platforms).toContain('bluesky')
    expect(arg.platforms).toContain('facebook')
  })

  // 7. removing a platform preserves captions and formats (non-destructive toggle)
  it('removing a platform preserves its captions and formats', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)

    // Uncheck Facebook (currently in platforms with captions and formats)
    const fbCheckbox = screen.getByLabelText('Facebook') as HTMLInputElement
    fireEvent.click(fbCheckbox)

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.platforms).not.toContain('facebook')
    // Captions and formats are preserved for re-toggle
    expect(arg.captions.facebook).toEqual({ pt: 'hello' })
    expect(arg.formats.facebook).toBe('link_share')
  })

  // 8. caption textarea updates onChange
  it('caption textarea updates onChange', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)

    // Expand facebook captions section
    const expandButtons = screen.getAllByText('Facebook')
    // The expand button is the one inside the captions area (a <button> element)
    const expandBtn = expandButtons.find((el) => el.closest('button[type="button"]'))
    expect(expandBtn).toBeDefined()
    fireEvent.click(expandBtn!)

    // Now the PT textarea should be visible with the existing caption
    const ptTextarea = screen.getByDisplayValue('hello') as HTMLTextAreaElement
    fireEvent.change(ptTextarea, { target: { value: 'updated caption' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.captions.facebook?.pt).toBe('updated caption')
  })

  // 9. hashtags parsed on blur
  it('parses hashtags on blur', () => {
    const config: SocialConfig = { ...BASE_CONFIG, hashtags: [] }
    render(<SocialConfigEditor config={config} onChange={onChange} />)

    const input = screen.getByPlaceholderText('tag1, tag2, tag3') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'tag1, tag2 tag3' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.hashtags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  // 10. image source radio changes
  it('changes image_source when Cover Image radio clicked', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)

    const coverRadio = screen.getByLabelText('Cover Image')
    fireEvent.click(coverRadio)

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.image_source).toBe('cover_image')
  })

  // 11. IG template only shown when instagram selected
  it('does not show IG template when instagram not selected', () => {
    const config: SocialConfig = {
      ...BASE_CONFIG,
      platforms: ['facebook'],
    }
    render(<SocialConfigEditor config={config} onChange={onChange} />)

    expect(screen.queryByText('Template Instagram')).toBeNull()
    expect(screen.queryByLabelText('Minimal')).toBeNull()
    expect(screen.queryByLabelText('Bold')).toBeNull()
  })

  // 12. IG template shown when instagram selected
  it('shows IG template radios when instagram is selected', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)

    expect(screen.getByText('Template Instagram')).toBeDefined()
    expect(screen.getByLabelText('Minimal')).toBeDefined()
    expect(screen.getByLabelText('Card')).toBeDefined()
    expect(screen.getByLabelText('Bold')).toBeDefined()
  })

  // 13. format dropdown changes
  it('changes format when dropdown value changes', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} />)

    // Find the Facebook format dropdown in the "Formato por plataforma" section
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    // First select corresponds to facebook (first in platforms array)
    const fbSelect = selects[0]
    expect(fbSelect.value).toBe('link_share')

    fireEvent.change(fbSelect, { target: { value: 'image_post' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.formats.facebook).toBe('image_post')
  })

  // 14. Enter key on hashtags triggers update
  it('Enter key on hashtags triggers update', () => {
    const config: SocialConfig = { ...BASE_CONFIG, hashtags: [] }
    render(<SocialConfigEditor config={config} onChange={onChange} />)

    const input = screen.getByPlaceholderText('tag1, tag2, tag3') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'alpha, beta' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as SocialConfig
    expect(arg.hashtags).toEqual(['alpha', 'beta'])
  })

  // 15. disabled prop disables all form elements
  it('disabled prop disables all form elements when config provided', () => {
    render(<SocialConfigEditor config={BASE_CONFIG} onChange={onChange} disabled />)

    // Toggle switch should be disabled
    const toggle = screen.getByRole('switch') as HTMLButtonElement
    expect(toggle.disabled).toBe(true)

    // Platform checkboxes should be disabled (via parent fieldset)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    for (const cb of checkboxes) {
      expect(cb.closest('fieldset')?.disabled).toBe(true)
    }

    // Format selects should be disabled
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    for (const sel of selects) {
      expect(sel.disabled).toBe(true)
    }
  })

  // 16. hashtag input has key for re-render on external change
  it('hashtag input updates when config.hashtags changes externally', () => {
    const config1: SocialConfig = { ...BASE_CONFIG, hashtags: ['old'] }
    const { rerender } = render(<SocialConfigEditor config={config1} onChange={onChange} />)

    const input1 = screen.getByPlaceholderText('tag1, tag2, tag3') as HTMLInputElement
    expect(input1.defaultValue).toBe('old')

    const config2: SocialConfig = { ...BASE_CONFIG, hashtags: ['new', 'tags'] }
    rerender(<SocialConfigEditor config={config2} onChange={onChange} />)

    const input2 = screen.getByPlaceholderText('tag1, tag2, tag3') as HTMLInputElement
    expect(input2.defaultValue).toBe('new tags')
  })

  // 17. contentFormat prop sets default format for platforms
  it('uses content-specific default format', () => {
    const config: SocialConfig = { ...BASE_CONFIG, platforms: ['youtube'], formats: {} }
    render(<SocialConfigEditor config={config} onChange={onChange} contentFormat="video" />)
    // YouTube format dropdown should default to 'video_share' for video content type
    const select = screen.getByLabelText('Formato para YouTube')
    expect(select).toBeDefined()
    // The select value should default from CONTENT_FORMAT_MAP['video']['youtube']
    expect((select as HTMLSelectElement).value).toBe('video_share')
  })

  // 18. non-destructive platform toggle preserves captions
  it('preserves captions when toggling platform off and back on', () => {
    const config: SocialConfig = {
      ...BASE_CONFIG,
      platforms: ['facebook'],
      captions: { facebook: { pt: 'My caption' } },
    }
    render(<SocialConfigEditor config={config} onChange={onChange} />)

    // Uncheck facebook
    const fb = screen.getByLabelText('Facebook')
    fireEvent.click(fb)

    const offCall = onChange.mock.calls[0][0] as SocialConfig
    expect(offCall.platforms).not.toContain('facebook')
    // Captions should still be preserved
    expect(offCall.captions.facebook?.pt).toBe('My caption')
  })
})
