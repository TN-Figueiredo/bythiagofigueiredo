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
let ctxLanca = false
const lerLista = vi.fn()
/** Troca só a resposta do decide, mantendo a função de estado do canal em `removido: true`. */
const rpcDecide = (r: unknown): void => { rpc.mockImplementation(async (nome: string) => (nome === 'obs_archive_channel_is_removed' ? { data: { removido: true }, error: null } : r)) }
let lista: { ok: true; lista: Array<Record<string, unknown>> } | { ok: false } = { ok: true, lista: [{ channel_ref: REF, nome: 'Canal Ção X' }] }

function carregar() {
  vi.resetModules()
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async (_s: string, acao: string) => (negado ? { ok: false, error: `Só quem administra o site pode ${acao}.` } : null),
  }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => { if (ctxLanca) throw new Error('sem contexto'); return { siteId: 's1' } } }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async () => (semEdicao ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } }),
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag }))
  vi.doMock('next/server', () => ({ after: vi.fn() }))
  vi.doMock('@sentry/nextjs', () => ({ captureException, captureMessage }))
  vi.doMock('@/lib/youtube/observatorio/cache-tag', () => ({ invalidateObservatory: invalidate }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { clienteCriado(); return { rpc } } }))
  vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/canais-removidos', () => ({ lerCanaisRemovidos: async (_sb: unknown, siteId: string) => lerLista(siteId) ?? lista }))
  return import('@/app/cms/(authed)/youtube/competitors/_arquivo/actions-canal')
}

beforeEach(() => {
  for (const f of [rpc, clienteCriado, invalidate, revalidate, revalidateTag, captureMessage, captureException, lerLista]) f.mockReset()
  // a função de estado do canal (removido) e o decide: por nome da função
  rpc.mockImplementation(async (nome: string) => (nome === 'obs_archive_channel_is_removed' ? { data: { removido: true, decisao: 'guardar', sem_destino: false }, error: null } : { data: { status: 'ok' }, error: null }))
  negado = false; semEdicao = false; ctxLanca = false
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
    rpcDecide({ data: { status: 'ja_pedido' }, error: null })
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: true, status: 'ja_pedido' })
  })

  it('erros do banco: canal_nao_encontrado e sem_direito traduzidos; desconhecido vira interno, com Sentry e sem a mensagem', async () => {
    const m = await carregar()
    rpcDecide({ data: null, error: { message: 'canal_nao_encontrado' } })
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'canal_nao_encontrado' })
    rpcDecide({ data: null, error: { message: 'sem_direito' } })
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'sem_permissao' })
    rpcDecide({ data: null, error: { message: 'segredo do banco' } })
    const r = await m.apagarDoArquivoAction(REF, 'Canal Ção X')
    expect(r).toEqual({ ok: false, erro: 'interno' })
    expect(JSON.stringify(r)).not.toContain('segredo')
    expect(captureMessage.mock.calls.length + captureException.mock.calls.length).toBeGreaterThan(0)
  })

  it('o cache é solto mesmo quando o banco falha', async () => {
    rpcDecide({ data: null, error: { message: 'x' } })
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
    rpcDecide({ data: null, error: { message: 'x' } })
    const m = await carregar()
    expect(await m.marcarRodado('item:12')).toEqual({ ok: false, erro: 'interno' })
  })

  it('T7b: marcar traduz sem_permissao e item_desconhecido do banco; item_invalido vira forma; o resto, interno', async () => {
    const m = await carregar()
    for (const [msg, erro] of [['sem_permissao', 'sem_permissao'], ['item_desconhecido', 'item_desconhecido'], ['item_invalido', 'forma'], ['boom', 'interno']] as const) {
      rpcDecide({ data: null, error: { message: msg } })
      expect(await m.marcarRodado('item:12')).toEqual({ ok: false, erro })
      expect(await m.desfazerRodado('item:12')).toEqual({ ok: false, erro })
    }
  })

  it('conserto 2: só "removido: false" claro é canal_existe; decide nunca chamado, cache não solto', async () => {
    const m = await carregar()
    rpc.mockReset(); invalidate.mockReset()
    rpc.mockResolvedValue({ data: { removido: false }, error: null })
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'canal_existe' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('obs_archive_channel_is_removed', { p_site: 's1', p_channel_ref: REF })
    expect(invalidate).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('conserto 1/7: erro do banco ou resposta torta na função de estado NÃO diz que o canal existe: interno, com Sentry, decide nunca chamado', async () => {
    const m = await carregar()
    for (const resp of [{ data: null, error: { message: 'x', code: '57014' } }, { data: null, error: null }, { data: 'lixo', error: null }, { data: {}, error: null }, { data: { removido: 'false' }, error: null }]) {
      rpc.mockReset(); invalidate.mockReset(); captureMessage.mockReset()
      rpc.mockResolvedValue(resp)
      expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'interno' })
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(invalidate).not.toHaveBeenCalled()
      expect(captureMessage).toHaveBeenCalledTimes(1)
    }
  })

  it('conserto 1/7: a guarda que LANÇA é erro interno com Sentry, não sem_permissão (e nada é chamado)', async () => {
    ctxLanca = true
    const m2 = await carregar()
    expect(await m2.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'interno' })
    expect(await m2.marcarRodado('item:5')).toEqual({ ok: false, erro: 'interno' })
    expect(await m2.desfazerRodado('item:5')).toEqual({ ok: false, erro: 'interno' })
    expect(captureException).toHaveBeenCalledTimes(3)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('conserto 4: lista com 2 canais, a leitura é do site da sessão e acha o canal certo (não lista[0])', async () => {
    const OUTRO = '22222222-2222-4222-8222-222222222222'
    lerLista.mockImplementation(() => ({ ok: true, lista: [{ channel_ref: OUTRO, nome: 'Primeiro' }, { channel_ref: REF, nome: 'Segundo' }] }))
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Primeiro')).toEqual({ ok: false, erro: 'nome_nao_confere' })
    expect(await m.apagarDoArquivoAction(REF, 'Segundo')).toEqual({ ok: true, status: 'ok' })
    expect(lerLista).toHaveBeenCalledWith('s1')
  })

  it('conserto 4: requireSiteScope negado: sem_permissao nas três e nada chamado', async () => {
    semEdicao = true
    const m = await carregar()
    expect(await m.apagarDoArquivoAction(REF, 'Canal Ção X')).toEqual({ ok: false, erro: 'sem_permissao' })
    expect(await m.marcarRodado('item:5')).toMatchObject({ ok: false, erro: 'sem_permissao' })
    expect(await m.desfazerRodado('item:5')).toMatchObject({ ok: false, erro: 'sem_permissao' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('conserto 5: o cache só é solto quando o decide foi chamado; erro desconhecido leva o code ao Sentry', async () => {
    let m = await carregar()
    await m.apagarDoArquivoAction(REF, 'errado'); await m.apagarDoArquivoAction(`${REF}'`, 'x')
    expect(invalidate).not.toHaveBeenCalled()
    rpcDecide({ data: null, error: { message: 'x', code: '40001' } })
    m = await carregar()
    await m.apagarDoArquivoAction(REF, 'Canal Ção X')
    expect(invalidate).toHaveBeenCalledWith('s1')
    expect(JSON.stringify(captureMessage.mock.calls)).toContain('40001')
  })
})
