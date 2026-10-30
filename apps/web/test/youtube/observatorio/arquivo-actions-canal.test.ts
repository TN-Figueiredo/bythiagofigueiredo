// @vitest-environment node
/**
 * M9b T2: apagarDoArquivoAction, marcarRodado, desfazerRodado. Guarda de admin primeiro (cliente de serviço nem é criado),
 * variável ausente = desligado, nome relido no servidor, erro do banco traduzido sem repassar a mensagem.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const REF = '11111111-1111-4111-8111-111111111111'
const NEGADO = 'Só quem administra o site pode apagar o arquivo de um canal removido.'

const rpc = vi.fn()
const clienteCriado = vi.fn()
const invalidate = vi.fn()
const revalidate = vi.fn()
const revalidateTag = vi.fn()
const captureMessage = vi.fn()
const captureException = vi.fn()
let negado = false
let semEdicao = false
let lista: { ok: true; lista: Array<Record<string, unknown>> } | { ok: false } = { ok: true, lista: [{ channel_ref: REF, nome: 'Canal Ção X' }] }

function carregar() {
  vi.resetModules()
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async (_s: string, acao: string) => (negado ? { ok: false, error: `Só quem administra o site pode ${acao}.` } : null),
  }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async () => (semEdicao ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } }),
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag }))
  vi.doMock('next/server', () => ({ after: vi.fn() }))
  vi.doMock('@sentry/nextjs', () => ({ captureException, captureMessage }))
  vi.doMock('@/lib/youtube/observatorio/cache-tag', () => ({ invalidateObservatory: invalidate }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { clienteCriado(); return { rpc } } }))
  vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos', () => ({ lerCanaisRemovidos: async () => lista }))
  return import('@/app/cms/(authed)/youtube/competitors/_arquivo/actions-canal')
}

beforeEach(() => {
  for (const f of [rpc, clienteCriado, invalidate, revalidate, revalidateTag, captureMessage, captureException]) f.mockReset()
  rpc.mockResolvedValue({ data: { status: 'ok' }, error: null })
  negado = false; semEdicao = false
  lista = { ok: true, lista: [{ channel_ref: REF, nome: 'Canal Ção X' }] }
  process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'on'
  process.env.OBS_ARQUIVO_BLOCO_CANAIS_REMOVIDOS = 'on'
})

describe('M9b T2: ações do canal removido', () => {
  it('sem admin: sem_permissao e rpc não chamado, nas três', async () => {
    negado = true
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'sem_permissao' })
    expect(await m.marcarRodado(`item:5`)).toMatchObject({ ok: false, erro: 'sem_permissao' })
    expect(await m.desfazerRodado(`item:5`)).toMatchObject({ ok: false, erro: 'sem_permissao' })
    expect(rpc).not.toHaveBeenCalled()
    expect(clienteCriado).not.toHaveBeenCalled()
  })

  it('variável ausente: desligado, sem rpc', async () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'desligado' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('uuid com aspas: forma', async () => {
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(`${REF}'`, 'x')).toEqual({ ok: false, erro: 'forma' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('nome errado: nome_nao_confere, sem rpc', async () => {
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'outro')).toEqual({ ok: false, erro: 'nome_nao_confere' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('nome com caixa e espaço diferentes passa; chama a função com site, canal e ator e solta o cache', async () => {
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, '  canal ção   x ')).toEqual({ ok: true, status: 'ok' })
    expect(rpc).toHaveBeenCalledWith('obs_archive_channel_removal_decide', { p_site: 's1', p_channel_ref: REF, p_actor: 'u1' })
    expect(invalidate).toHaveBeenCalledWith('s1')
    expect(revalidate).toHaveBeenCalled()
    expect(revalidateTag).toHaveBeenCalled()
  })

  it('sem nome na lista, o código de 8 (maiúsculo) é o esperado', async () => {
    lista = { ok: true, lista: [{ channel_ref: REF, nome: null }] }
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, '11111111')).toEqual({ ok: true, status: 'ok' })
  })

  it('lista ilegível ou canal fora da lista: interno / canal_nao_encontrado, sem rpc', async () => {
    lista = { ok: false }
    let m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'x')).toEqual({ ok: false, erro: 'interno' })
    lista = { ok: true, lista: [] }
    m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'x')).toEqual({ ok: false, erro: 'canal_nao_encontrado' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('ja_pedido do banco vira ok com status ja_pedido', async () => {
    rpc.mockResolvedValue({ data: { status: 'ja_pedido' }, error: null })
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: true, status: 'ja_pedido' })
  })

  it('erros do banco: canal_nao_encontrado e sem_direito traduzidos; desconhecido vira interno, com Sentry e sem a mensagem', async () => {
    const m = await carregar()
    rpc.mockResolvedValue({ data: null, error: { message: 'canal_nao_encontrado' } })
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'canal_nao_encontrado' })
    rpc.mockResolvedValue({ data: null, error: { message: 'sem_direito' } })
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'sem_permissao' })
    rpc.mockResolvedValue({ data: null, error: { message: 'segredo do banco' } })
    const r = await m.apagarDoArquivoAction(REF, 'Canal Ção X')
    expect(r).toEqual({ ok: false, erro: 'interno' })
    expect(JSON.stringify(r)).not.toContain('segredo')
    expect(captureMessage.mock.calls.length + captureException.mock.calls.length).toBeGreaterThan(0)
  })

  it('o cache é solto mesmo quando o banco falha', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const m = await carregar()
    await m.apagarDoArquivoAction(REF, 'Canal Ção X')
    expect(invalidate).toHaveBeenCalledWith('s1')
  })

  it('marcarRodado: item e canal passam; antiga: e lixo viram forma; rpc com p_desfazer false', async () => {
    const m = await carregar()
    expect(await m.marcarRodado('item:12')).toEqual({ ok: true })
    expect(rpc).toHaveBeenLastCalledWith('obs_archive_marcar_rodado', { p_site: 's1', p_item_id: 'item:12', p_actor: 'u1', p_desfazer: false })
    expect(await m.marcarRodado(`canal:${REF}`)).toEqual({ ok: true })
    rpc.mockClear()
    expect(await m.marcarRodado(`antiga:${REF}`)).toEqual({ ok: false, erro: 'forma' })
    expect(await m.marcarRodado(`item:0`)).toEqual({ ok: false, erro: 'forma' })
    expect(await m.marcarRodado(`item:1'; drop`)).toEqual({ ok: false, erro: 'forma' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('desfazerRodado: p_desfazer true; antiga: forma', async () => {
    const m = await carregar()
    expect(await m.desfazerRodado('item:12')).toEqual({ ok: true })
    expect(rpc).toHaveBeenLastCalledWith('obs_archive_marcar_rodado', { p_site: 's1', p_item_id: 'item:12', p_actor: 'u1', p_desfazer: true })
    expect(await m.desfazerRodado(`antiga:${REF}`)).toEqual({ ok: false, erro: 'forma' })
  })

  it('marcar com erro do banco: interno', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const m = await carregar()
    expect(await m.marcarRodado('item:12')).toEqual({ ok: false, erro: 'interno' })
  })
})
