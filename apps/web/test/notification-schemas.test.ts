import { describe, it, expect } from 'vitest'
import { NotificationCreateSchema, PreferencesUpdateSchema, containsPii } from '@/lib/notifications/schemas'

describe('NotificationCreateSchema', () => {
  const validInput = {
    site_id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000002',
    type: 'pipeline.stage_advance',
    domain: 'pipeline' as const,
    priority: 3,
    title: 'Test notification',
  }

  it('accepts valid minimal input', () => {
    const result = NotificationCreateSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts valid full input', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      message: 'A message body',
      payload: { itemId: '00000000-0000-0000-0000-000000000003', stage: 'roteiro' },
      dedup_key: 'pipeline.stage_advance:item1',
      group_key: 'pipeline:item1',
      suggested_action: 'Revisar roteiro',
      action_href: '/cms/pipeline/item1',
      channels: ['email', 'push'],
      actor_id: '00000000-0000-0000-0000-000000000004',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid domain', () => {
    const result = NotificationCreateSchema.safeParse({ ...validInput, domain: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects priority out of range', () => {
    expect(NotificationCreateSchema.safeParse({ ...validInput, priority: 0 }).success).toBe(false)
    expect(NotificationCreateSchema.safeParse({ ...validInput, priority: 6 }).success).toBe(false)
  })

  it('rejects empty title', () => {
    const result = NotificationCreateSchema.safeParse({ ...validInput, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects PII in payload', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      payload: { email: 'user@example.com' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('PII')
    }
  })

  it('rejects payload with CPF', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      payload: { cpf: '123.456.789-00' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-relative non-HTTPS action_href', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      action_href: 'http://evil.com',
    })
    expect(result.success).toBe(false)
  })

  it('accepts relative action_href', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      action_href: '/cms/pipeline/123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts HTTPS action_href', () => {
    const result = NotificationCreateSchema.safeParse({
      ...validInput,
      action_href: 'https://bythiagofigueiredo.com/cms/pipeline/123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(NotificationCreateSchema.safeParse({}).success).toBe(false)
    expect(NotificationCreateSchema.safeParse({ site_id: 'bad' }).success).toBe(false)
  })

  it('rejects invalid UUID for site_id', () => {
    const result = NotificationCreateSchema.safeParse({ ...validInput, site_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('PreferencesUpdateSchema', () => {
  it('accepts valid frequency mode', () => {
    const result = PreferencesUpdateSchema.safeParse({ frequency_mode: 'calm' })
    expect(result.success).toBe(true)
  })

  it('accepts valid quiet hours', () => {
    const result = PreferencesUpdateSchema.safeParse({
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      quiet_hours_timezone: 'America/Sao_Paulo',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid time format', () => {
    const result = PreferencesUpdateSchema.safeParse({ quiet_hours_start: '25:00' })
    expect(result.success).toBe(false)
  })

  it('transforms empty category to null', () => {
    const result = PreferencesUpdateSchema.safeParse({ category: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBeNull()
    }
  })
})

describe('containsPii', () => {
  it('detects email', () => {
    expect(containsPii('user@example.com')).toBe(true)
  })

  it('detects CPF', () => {
    expect(containsPii('123.456.789-00')).toBe(true)
  })

  it('detects CNPJ', () => {
    expect(containsPii('12.345.678/0001-99')).toBe(true)
  })

  it('detects BR phone', () => {
    expect(containsPii('+55 11 98765-4321')).toBe(true)
  })

  it('does not flag clean data', () => {
    expect(containsPii('pipeline stage advance')).toBe(false)
    expect(containsPii({ videoId: 'abc123', title: 'My video' })).toBe(false)
  })
})
