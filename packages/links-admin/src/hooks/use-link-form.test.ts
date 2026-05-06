import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLinkForm } from './use-link-form'

describe('useLinkForm', () => {
  it('initializes with empty form state when no initial data', () => {
    const { result } = renderHook(() => useLinkForm())
    expect(result.current.form.destination_url).toBe('')
    expect(result.current.form.title).toBe('')
    expect(result.current.form.slug).toBe('')
    expect(result.current.form.source_type).toBe('manual')
    expect(result.current.form.redirect_type).toBe(302)
    expect(result.current.form.active).toBe(true)
    expect(result.current.form.tags).toEqual([])
    expect(result.current.errors).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
  })

  it('initializes with provided initial data', () => {
    const initial = {
      destination_url: 'https://example.com',
      title: 'My Link',
      slug: 'my-link',
      source_type: 'campaign' as const,
      redirect_type: 301 as const,
      active: false,
      tags: ['promo'],
      utm_source: 'twitter',
      utm_medium: 'social',
      utm_campaign: 'launch',
      utm_term: '',
      utm_content: '',
      expires_at: '2026-12-31T00:00:00Z',
      click_limit: 1000,
      password: '',
    }
    const { result } = renderHook(() => useLinkForm(initial))
    expect(result.current.form.destination_url).toBe('https://example.com')
    expect(result.current.form.title).toBe('My Link')
    expect(result.current.form.source_type).toBe('campaign')
    expect(result.current.form.redirect_type).toBe(301)
    expect(result.current.form.tags).toEqual(['promo'])
  })

  it('setField updates a single field', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('title', 'Updated Title')
    })
    expect(result.current.form.title).toBe('Updated Title')
  })

  it('setField clears field-level error on change', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.validate()
    })
    expect(result.current.errors.destination_url).toBeDefined()

    act(() => {
      result.current.setField('destination_url', 'https://valid.com')
    })
    expect(result.current.errors.destination_url).toBeUndefined()
  })

  it('validate returns false and sets errors for invalid URL', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('destination_url', 'not-a-url')
    })
    let isValid = false
    act(() => {
      isValid = result.current.validate()
    })
    expect(isValid).toBe(false)
    expect(result.current.errors.destination_url).toContain('valid URL')
  })

  it('validate returns false when destination_url is empty', () => {
    const { result } = renderHook(() => useLinkForm())
    let isValid = false
    act(() => {
      isValid = result.current.validate()
    })
    expect(isValid).toBe(false)
    expect(result.current.errors.destination_url).toBeDefined()
  })

  it('validate returns true for valid form data', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('destination_url', 'https://example.com/page')
    })
    let isValid = false
    act(() => {
      isValid = result.current.validate()
    })
    expect(isValid).toBe(true)
    expect(result.current.errors).toEqual({})
  })

  it('validate rejects slug with spaces or special chars', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('destination_url', 'https://example.com')
      result.current.setField('slug', 'my slug!')
    })
    let isValid = false
    act(() => {
      isValid = result.current.validate()
    })
    expect(isValid).toBe(false)
    expect(result.current.errors.slug).toBeDefined()
  })

  it('handleSubmit calls onSubmit when valid and manages isSubmitting state', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('destination_url', 'https://example.com')
    })

    await act(async () => {
      await result.current.handleSubmit(onSubmit)
    })

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ destination_url: 'https://example.com' }),
    )
    expect(result.current.isSubmitting).toBe(false)
  })

  it('handleSubmit does not call onSubmit when invalid', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useLinkForm())

    await act(async () => {
      await result.current.handleSubmit(onSubmit)
    })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('reset restores form to initial values', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.setField('title', 'Changed')
      result.current.setField('destination_url', 'https://changed.com')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.form.title).toBe('')
    expect(result.current.form.destination_url).toBe('')
  })

  it('addTag appends to tags array', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.addTag('marketing')
    })
    expect(result.current.form.tags).toEqual(['marketing'])
    act(() => {
      result.current.addTag('social')
    })
    expect(result.current.form.tags).toEqual(['marketing', 'social'])
  })

  it('addTag does not add duplicate', () => {
    const { result } = renderHook(() => useLinkForm())
    act(() => {
      result.current.addTag('marketing')
      result.current.addTag('marketing')
    })
    expect(result.current.form.tags).toEqual(['marketing'])
  })

  it('removeTag removes from tags array', () => {
    const { result } = renderHook(() =>
      useLinkForm({
        destination_url: '',
        title: '',
        slug: '',
        source_type: 'manual',
        redirect_type: 302,
        active: true,
        tags: ['a', 'b', 'c'],
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_term: '',
        utm_content: '',
        expires_at: '',
        click_limit: null,
        password: '',
      }),
    )
    act(() => {
      result.current.removeTag('b')
    })
    expect(result.current.form.tags).toEqual(['a', 'c'])
  })
})
