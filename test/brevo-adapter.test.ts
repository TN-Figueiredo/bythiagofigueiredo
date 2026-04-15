import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrevoEmailAdapter } from '../src/brevo/brevo-adapter'

describe('BrevoEmailAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('POSTs to Brevo with api-key + correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ messageId: 'm1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    const promise = adapter.send({
      from: { email: 'noreply@x.com', name: 'X' },
      to: 'user@y.com',
      subject: 'Hi',
      html: '<p>body</p>',
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ messageId: 'm1', provider: 'brevo' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((init as { headers: Record<string, string> }).headers['api-key']).toBe('test-key')
    const body = JSON.parse((init as { body: string }).body)
    expect(body.sender).toEqual({ email: 'noreply@x.com', name: 'X' })
    expect(body.to).toEqual([{ email: 'user@y.com' }])
    expect(body.subject).toBe('Hi')
    expect(body.htmlContent).toBe('<p>body</p>')
  })

  it('throws on 4xx without retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad',
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    const promise = adapter.send({
      from: { email: 'a@x.com', name: 'A' }, to: 'u@y.com', subject: 'S', html: '<p>b</p>',
    })
    const assertion = expect(promise).rejects.toThrow(/brevo 400/)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 5xx then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'bad gw' })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ messageId: 'm2' }) })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    const promise = adapter.send({
      from: { email: 'a@x.com', name: 'A' }, to: 'u@y.com', subject: 'S', html: '<p>b</p>',
    })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.messageId).toBe('m2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('handleWebhook throws not_implemented (Sprint 3 stub)', async () => {
    const adapter = new BrevoEmailAdapter('test-key')
    await expect(adapter.handleWebhook!({}, '')).rejects.toThrow(/not_implemented/)
  })

  it('constructor throws on empty apiKey', () => {
    expect(() => new BrevoEmailAdapter('')).toThrow(/apiKey/)
    expect(() => new BrevoEmailAdapter('   ')).toThrow(/apiKey/)
  })

  it('constructor accepts valid apiKey', () => {
    expect(() => new BrevoEmailAdapter('test-key')).not.toThrow()
  })

  it('sendTemplate calls render + send with template metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ messageId: 'm3' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const template = {
      name: 'test-tpl',
      render: vi.fn().mockResolvedValue({ subject: 'TS', html: '<p>tpl</p>' }),
    }
    const adapter = new BrevoEmailAdapter('test-key')
    const promise = adapter.sendTemplate(
      template as never,
      { email: 'noreply@x.com', name: 'X' },
      'user@y.com',
      { foo: 'bar' },
      'pt-BR',
    )
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.messageId).toBe('m3')
    expect(template.render).toHaveBeenCalledWith({ foo: 'bar' }, 'pt-BR')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tags).toEqual(['test-tpl'])
  })
})
