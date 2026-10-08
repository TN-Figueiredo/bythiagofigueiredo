// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ReportingHttpError, REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'
import { descreverErro, HABILITADOS, statusHttp } from '@/lib/youtube/coleta/token'

describe('token.ts', () => {
  it('statusHttp: status do ReportingHttpError, nulo para o resto', () => {
    expect(statusHttp(new ReportingHttpError(503, null))).toBe(503)
    expect(statusHttp(new Error('x'))).toBeNull()
    expect(statusHttp(null)).toBeNull()
  })

  it('descreverErro: status e reason, nunca o corpo', () => {
    expect(descreverErro(new ReportingHttpError(403, 'accessNotConfigured'))).toBe('HTTP 403 accessNotConfigured')
    expect(descreverErro(new ReportingHttpError(500, null))).toBe('HTTP 500')
    expect(descreverErro(new Error('relation "segredo" does not exist'))).toBe('database error')
  })

  it('HABILITADOS espelha REPORT_TYPES_ENABLED', () => {
    expect([...HABILITADOS]).toEqual([...REPORT_TYPES_ENABLED])
  })
})
