// @vitest-environment node
/** A5 · E9, Tarefa 5: apagar do Blob (`saiu/blob.ts`). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apagarDoBlob } from '@/lib/youtube/observatorio/saiu/blob'

const UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const PASTA = `observatorio/thumbs/${UUID}/`
const url = (n: number): string => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${UUID}/h${n}.jpg`
const urls = (n: number): string[] => Array.from({ length: n }, (_, i) => url(i))

type ListFn = NonNullable<Parameters<typeof apagarDoBlob>[1]['list']>
const vazio: ListFn = async () => ({ blobs: [], hasMore: false })

const SALVO = { ...process.env }
beforeEach(() => { process.env.BLOB_READ_WRITE_TOKEN = 'tok'; delete process.env.OBS_E2E })
afterEach(() => { process.env = { ...SALVO }; vi.useRealTimers() })

describe('A5 E9 T5: apagarDoBlob', () => {
  it('apaga URLs e prefixo e devolve tudo em feitos', async () => {
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob([url(1), PASTA], { prazoMs: 10_000, del, list: vazio })
    expect(r).toEqual({ feitos: [url(1), PASTA], restam: [], motivo: 'ok' })
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('o Blob falha uma vez: a URL fica em restam; a segunda chamada conclui', async () => {
    let falha = true
    const del = vi.fn(async () => { if (falha) { falha = false; throw new Error('500') } })
    const r1 = await apagarDoBlob([url(1)], { prazoMs: 10_000, del, list: vazio })
    expect(r1).toEqual({ feitos: [], restam: [url(1)], motivo: 'erro' })
    const r2 = await apagarDoBlob(r1.restam, { prazoMs: 10_000, del, list: vazio })
    expect(r2).toEqual({ feitos: [url(1)], restam: [], motivo: 'ok' })
  })

  it('lote de 250 URLs faz 3 chamadas de del', async () => {
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob(urls(250), { prazoMs: 10_000, del, list: vazio })
    expect(del).toHaveBeenCalledTimes(3)
    expect(del.mock.calls.map(c => (c as unknown as [string[]])[0].length)).toEqual([100, 100, 50])
    expect(r.feitos).toHaveLength(250)
  })

  it('um lote falha e os outros seguem', async () => {
    let n = 0
    const del = vi.fn(async () => { n += 1; if (n === 2) throw new Error('x') })
    const r = await apagarDoBlob(urls(250), { prazoMs: 10_000, del, list: vazio })
    expect(del).toHaveBeenCalledTimes(3)
    expect(r.restam).toHaveLength(100)
    expect(r.feitos).toHaveLength(150)
    expect(r.motivo).toBe('erro')
  })

  it('prefixo com 2 páginas de list apaga as duas e confirma com a terceira vazia', async () => {
    let restante = [url(1), url(2), url(3)]
    const list: ListFn = vi.fn(async () => {
      const pagina = restante.slice(0, 2)
      return { blobs: pagina.map(u => ({ url: u })), hasMore: restante.length > 2 }
    })
    const del = vi.fn(async (u: string[]) => { restante = restante.filter(x => !u.includes(x)) })
    const r = await apagarDoBlob([PASTA], { prazoMs: 10_000, del, list })
    expect(del).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledTimes(3)
    expect(r).toEqual({ feitos: [PASTA], restam: [], motivo: 'ok' })
  })

  it('list falha: o prefixo fica em restam mesmo com as URLs apagadas', async () => {
    const del = vi.fn(async () => undefined)
    const list: ListFn = async () => { throw new Error('boom') }
    const r = await apagarDoBlob([url(1), PASTA], { prazoMs: 10_000, del, list })
    expect(r).toEqual({ feitos: [url(1)], restam: [PASTA], motivo: 'erro' })
  })

  it('prefixo com mais de 2.000 arquivos numa chamada: para e deixa em restam', async () => {
    const list: ListFn = async () => ({ blobs: urls(1000).map(u => ({ url: u })), hasMore: true })
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob([PASTA], { prazoMs: 10_000, del, list })
    expect(r.restam).toEqual([PASTA])
    expect(del).toHaveBeenCalledTimes(2)
  })

  it('sem tempo antes da segunda chamada: devolve o que fez e sem_tempo', async () => {
    let agora = 0
    const del = vi.fn(async () => { agora += 6_000 })
    const r = await apagarDoBlob(urls(250), { prazoMs: 5_000, del, list: vazio, agora: () => agora })
    expect(del).toHaveBeenCalledTimes(1)
    expect(r.motivo).toBe('sem_tempo')
    expect(r.feitos).toHaveLength(100)
    expect(r.restam).toHaveLength(150)
  })

  it('sem token: nenhuma chamada e blob_nao_configurado', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob([url(1), PASTA], { prazoMs: 10_000, del, list: vazio })
    expect(del).not.toHaveBeenCalled()
    expect(r).toEqual({ feitos: [], restam: [url(1), PASTA], motivo: 'blob_nao_configurado' })
    process.env.BLOB_READ_WRITE_TOKEN = ''
    expect((await apagarDoBlob([url(1)], { prazoMs: 10_000, del, list: vazio })).motivo).toBe('blob_nao_configurado')
  })

  it('com OBS_E2E=1 fora de produção e o token presente: nenhuma chamada e blob_nao_configurado', async () => {
    process.env.OBS_E2E = '1'
    vi.stubEnv('NODE_ENV', 'test')
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob([url(1)], { prazoMs: 10_000, del, list: vazio })
    vi.unstubAllEnvs()
    expect(del).not.toHaveBeenCalled()
    expect(r.motivo).toBe('blob_nao_configurado')
  })

  it('com OBS_E2E=1 em NODE_ENV=production o token vale', async () => {
    process.env.OBS_E2E = '1'
    vi.stubEnv('NODE_ENV', 'production')
    const del = vi.fn(async () => undefined)
    const r = await apagarDoBlob([url(1)], { prazoMs: 10_000, del, list: vazio })
    vi.unstubAllEnvs()
    expect(del).toHaveBeenCalledTimes(1)
    expect(r.motivo).toBe('ok')
  })

  it('sem OBS_E2E (variável apagada) o token vale', async () => {
    delete process.env.OBS_E2E
    const del = vi.fn(async () => undefined)
    expect((await apagarDoBlob([url(1)], { prazoMs: 10_000, del, list: vazio })).motivo).toBe('ok')
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('entrada fora da pasta do Observatório não é apagada', async () => {
    const del = vi.fn(async () => undefined)
    const ruins = ['instagram/x/', 'https://x.blob.vercel-storage.com/outra/pasta/a.jpg', 'observatorio/thumbs/', 'observatorio/thumbs/nao-e-uuid/', `https://x.com/observatorio/thumbs/../a.jpg`]
    const r = await apagarDoBlob(ruins, { prazoMs: 10_000, del, list: vazio })
    expect(del).not.toHaveBeenCalled()
    expect(r.restam.sort()).toEqual([...ruins].sort())
    expect(r.motivo).toBe('erro')
  })

  it('lista vazia: nenhuma chamada, ok', async () => {
    const del = vi.fn(async () => undefined)
    const list = vi.fn(vazio)
    expect(await apagarDoBlob([], { prazoMs: 10_000, del, list })).toEqual({ feitos: [], restam: [], motivo: 'ok' })
    expect(del).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  })

  it('nunca lança (del e list que lançam)', async () => {
    const del = vi.fn(async () => { throw new Error('x') })
    const list: ListFn = async () => { throw new Error('y') }
    await expect(apagarDoBlob([url(1), PASTA], { prazoMs: 10_000, del, list })).resolves.toMatchObject({ motivo: 'erro' })
  })

  it('del que nunca volta: devolve sem_tempo dentro do teto da chamada, a URL fica em restam e nenhuma outra chamada sai', async () => {
    vi.useFakeTimers()
    const del = vi.fn(() => new Promise<void>(() => undefined))
    const p = apagarDoBlob(urls(250), { prazoMs: 60_000, del, list: vazio })
    await vi.advanceTimersByTimeAsync(5_001)
    const r = await p
    expect(r.motivo).toBe('sem_tempo')
    expect(r.feitos).toEqual([])
    expect(r.restam).toHaveLength(250)
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('list que nunca volta: idem, o prefixo fica em restam', async () => {
    vi.useFakeTimers()
    const del = vi.fn(async () => undefined)
    const list: ListFn = () => new Promise(() => undefined)
    const p = apagarDoBlob([url(1), PASTA], { prazoMs: 60_000, del, list })
    await vi.advanceTimersByTimeAsync(5_001)
    const r = await p
    expect(r.motivo).toBe('sem_tempo')
    expect(r.feitos).toEqual([url(1)])
    expect(r.restam).toEqual([PASTA])
  })
})
