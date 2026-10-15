import { describe, it, expect } from 'vitest'
import { YouTubeApiError, ErroConhecido, erroDaResposta, erroDeRede, paraErroGravado, contaParaFalhas } from '@/lib/youtube/youtube-api-error'

describe('youtube-api-error', () => {
  it('lê reason de error.errors[0].reason', async () => {
    const res = new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: 'quotaExceeded', message: 'segredo' }] } }), { status: 403 })
    const e = await erroDaResposta(res, 'videos.update')
    expect(e).toMatchObject({ status: 403, reason: 'quotaExceeded', chamada: 'videos.update' })
    expect(JSON.stringify(paraErroGravado(e))).not.toMatch(/segredo/)
    expect(paraErroGravado(e)).toEqual({ status: 403, reason: 'quotaExceeded', chamada: 'videos.update' })
  })
  it('aborto interno vira { motivo }; 403 do Blob não conta para as falhas (Y-D10, Y-P2)', () => {
    expect(paraErroGravado(new YouTubeApiError(0, 'snippet_sem_descricao', 'videos.update'))).toEqual({ motivo: 'snippet_sem_descricao' })
    expect(contaParaFalhas(new YouTubeApiError(403, 'blob_403', 'blob'))).toBe(false)
    expect(contaParaFalhas(new YouTubeApiError(403, 'quotaExceeded', 'videos.update'))).toBe(false)
    expect(contaParaFalhas(new YouTubeApiError(403, 'forbidden', 'thumbnails.set'))).toBe(true)
  })
  it('corpo ilegível → reason "desconhecido"', async () => {
    expect((await erroDaResposta(new Response('<html>', { status: 502 }), 'videos.list')).reason).toBe('desconhecido')
  })
  it('timeout → status 0, reason timeout; rede → status 0, reason rede', () => {
    expect(erroDeRede(new DOMException('x', 'TimeoutError'), 'videos.update')).toMatchObject({ status: 0, reason: 'timeout' })
    expect(erroDeRede(new TypeError('fetch failed'), 'blob')).toMatchObject({ status: 0, reason: 'rede', chamada: 'blob' })
  })
  it('YouTubeApiError.message = "chamada status reason" (os chamadores com includes("403") seguem certos)', () => {
    expect(new YouTubeApiError(403, 'forbidden', 'thumbnails.set').message).toBe('thumbnails.set 403 forbidden')
  })
  it('status 0 com reason fora dos motivos internos fica como erro do YouTube (timeout/rede)', () => {
    expect(paraErroGravado(new YouTubeApiError(0, 'timeout', 'videos.update'))).toEqual({ status: 0, reason: 'timeout', chamada: 'videos.update' })
  })
  it('ErroConhecido: carrega o motivo e vira { motivo } no retrato (par 13)', () => {
    const e = new ErroConhecido('token')
    expect(e).toBeInstanceOf(Error)
    expect(e).toMatchObject({ name: 'ErroConhecido', motivo: 'token' })
    expect(paraErroGravado(e)).toEqual({ motivo: 'token' })
  })
  it('erro desconhecido vira { motivo: erro_interno } sem vazar a mensagem', () => {
    expect(paraErroGravado(new Error('Bearer abc123'))).toEqual({ motivo: 'erro_interno' })
  })
})
