import { describe, it, expect } from 'vitest'
import { confirmSubscriptionTemplate } from '../../src/templates/confirm-subscription'

const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }
const baseVars = {
  confirmUrl: 'https://x.com/confirm/tok',
  expiresAt: new Date('2026-05-01T00:00:00Z'),
  branding,
}

describe('confirmSubscriptionTemplate', () => {
  it('renders pt-BR', async () => {
    const r = await confirmSubscriptionTemplate.render(baseVars, 'pt-BR')
    expect(r.subject).toBe('Confirme sua inscrição em TestBrand')
    expect(r.html).toContain('Confirme sua inscrição')
    expect(r.html).toContain('/')
    expect(r.html).toContain('Confirmar')
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Confirme sua inscrição')
  })
  it('renders en', async () => {
    const r = await confirmSubscriptionTemplate.render(baseVars, 'en')
    expect(r.subject).toBe('Confirm your subscription to TestBrand')
    expect(r.html).toContain('Confirm your subscription')
    expect(r.html).toContain("If you didn't request this")
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Confirm your subscription')
  })
  it('includes the confirm url', async () => {
    const r = await confirmSubscriptionTemplate.render(baseVars, 'pt-BR')
    expect(r.html).toContain('https://x.com/confirm/tok')
  })
})
