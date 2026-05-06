'use client'
import { useState, useCallback } from 'react'

export interface LinkFormData {
  destination_url: string
  title: string
  slug: string
  source_type: 'manual' | 'campaign' | 'newsletter' | 'blog' | 'social' | 'print'
  redirect_type: 301 | 302
  active: boolean
  tags: string[]
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  expires_at: string
  click_limit: number | null
  password: string
}

export type LinkFormErrors = Partial<Record<keyof LinkFormData, string>>

const EMPTY_FORM: LinkFormData = {
  destination_url: '',
  title: '',
  slug: '',
  source_type: 'manual',
  redirect_type: 302,
  active: true,
  tags: [],
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
  expires_at: '',
  click_limit: null,
  password: '',
}

const URL_REGEX = /^https?:\/\/.+/
const SLUG_REGEX = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/

function validateForm(form: LinkFormData): LinkFormErrors {
  const errors: LinkFormErrors = {}

  if (!form.destination_url) {
    errors.destination_url = 'Destination URL is required'
  } else if (!URL_REGEX.test(form.destination_url)) {
    errors.destination_url = 'Must be a valid URL (https://...)'
  }

  if (form.slug && !SLUG_REGEX.test(form.slug)) {
    errors.slug = 'Slug must contain only lowercase letters, digits, and hyphens'
  }

  if (form.click_limit !== null && form.click_limit < 1) {
    errors.click_limit = 'Click limit must be at least 1'
  }

  return errors
}

export function useLinkForm(initialData?: LinkFormData) {
  const initial = initialData ?? EMPTY_FORM
  const [form, setForm] = useState<LinkFormData>(initial)
  const [errors, setErrors] = useState<LinkFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setField = useCallback(<K extends keyof LinkFormData>(key: K, value: LinkFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return prev
    })
  }, [])

  const validate = useCallback((): boolean => {
    const errs = validateForm(form)
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form])

  const handleSubmit = useCallback(
    async (onSubmit: (data: LinkFormData) => Promise<unknown>) => {
      const errs = validateForm(form)
      setErrors(errs)
      if (Object.keys(errs).length > 0) return

      setIsSubmitting(true)
      try {
        await onSubmit(form)
      } finally {
        setIsSubmitting(false)
      }
    },
    [form],
  )

  const reset = useCallback(() => {
    setForm(initial)
    setErrors({})
  }, [initial])

  const addTag = useCallback((tag: string) => {
    setForm((prev) => {
      if (prev.tags.includes(tag)) return prev
      return { ...prev, tags: [...prev.tags, tag] }
    })
  }, [])

  const removeTag = useCallback((tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }, [])

  return {
    form,
    errors,
    isSubmitting,
    setField,
    validate,
    handleSubmit,
    reset,
    addTag,
    removeTag,
  }
}
