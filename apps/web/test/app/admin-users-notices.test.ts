// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { noticeFor } from '@/app/admin/(authed)/users/notices'
import { inviteAcceptUrl } from '@/app/admin/(authed)/users/invite-url'

describe('avisos de /admin/users', () => {
  it('convite criado sem e-mail é AVISO, cita o plano B e não afirma envio', () => {
    const n = noticeFor('invite_created_email_failed')
    expect(n?.tone).toBe('warning')
    expect(n?.message).toMatch(/^Convite criado, mas o e-mail não saiu/)
    expect(n?.message).toContain('Copiar link do convite')
    expect(n?.message).not.toMatch(/enviado\./)
  })

  it('reenvio cujo e-mail falhou também é aviso com o plano B', () => {
    const n = noticeFor('resend_email_failed')
    expect(n?.tone).toBe('warning')
    expect(n?.message).toContain('Copiar link do convite')
  })

  it('só o que aconteceu é sucesso', () => {
    expect(noticeFor('invite_created')?.tone).toBe('success')
    expect(noticeFor('resend_sent')?.tone).toBe('success')
    expect(noticeFor('resend_too_soon')?.tone).toBe('warning')
    for (const k of ['invite_failed', 'invite_duplicate', 'invite_rate_limited', 'resend_failed', 'resend_expired']) {
      expect(noticeFor(k)?.tone, k).toBe('error')
    }
  })

  it('todo aviso que as ações emitem tem texto (nenhum redirect cai em tela muda)', () => {
    const src = readFileSync(
      join(__dirname, '../../src/app/admin/(authed)/users/actions.ts'),
      'utf8',
    )
    const emitted = new Set<string>()
    for (const m of src.matchAll(/\/admin\/users\?notice=([a-z_]+)/g)) emitted.add(m[1]!)
    for (const m of src.matchAll(/\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)'\s*\}`/g)) {
      emitted.add(m[1]!)
      emitted.add(m[2]!)
    }
    expect(emitted.size).toBeGreaterThanOrEqual(9)
    expect([...emitted].filter((k) => noticeFor(k) === null)).toEqual([])
  })

  it('aviso desconhecido ou ausente não renderiza nada', () => {
    expect(noticeFor(undefined)).toBeNull()
    expect(noticeFor('<script>')).toBeNull()
  })
})

describe('inviteAcceptUrl', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = original
  })

  it('usa NEXT_PUBLIC_APP_URL (sem barra dobrada)', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com/'
    expect(inviteAcceptUrl('abc')).toBe('https://bythiagofigueiredo.com/signup/invite/abc')
  })

  it('SEM a variável cai no padrão de desenvolvimento (o ramo que nenhum outro teste exercita)', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(inviteAcceptUrl('abc')).toBe('http://localhost:3001/signup/invite/abc')
  })
})
