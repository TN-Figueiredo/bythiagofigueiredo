// @vitest-environment node
/**
 * F2 do Remover canal, T4: as 3 actions (pedir, desfazer, apagar sem guardar). Guarda de administração primeiro (o cliente de serviço nem é
 * criado), id validado, trava E9, cache solto depois de qualquer chamada à F1 e as contagens do toast vindas do que o banco apagou.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))
const UUID = '11111111-1111-4111-8111-111111111111'
const NEGADO = 'Só quem administra o site pode agendar a guarda de um canal concorrente no NAS.'

const ordem: string[] = []
const f1 = { pedir: vi.fn(), cancelar: vi.fn(), apagar: vi.fn() }
const invalidate = vi.fn()
const revalidate = vi.fn()
const revalidateTag = vi.fn()
let negado: { ok: false; error: string } | null = null
let canal: { missing_since: string | null } | null = { missing_since: null }
let esperando = { videos: 0, comentarios: 0 }
let leituraFalha = false
let transito: Array<{ tabela: string; mes: string; destacado_em: string; liberar_a_partir: string }> | null = []
const lerTransito = vi.fn(async () => transito)

function carregar() {
  vi.resetModules()
  ordem.length = 0
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async (_s: string, acao: string) => { ordem.push('guarda'); return negado ? { ok: false, error: `Só quem administra o site pode ${acao}.` } : null },
    requireSiteAdminScope: async () => ({ ok: true, user: { id: 'u1' } }),
    siteAdminOnlyMessage: (a: string) => `Só quem administra o site pode ${a}.`,
    requireSiteAdminForRow: async () => ({ siteId: 's1' }),
  }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag }))
  vi.doMock('next/server', () => ({ after: vi.fn() }))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
  vi.doMock('@/lib/youtube/observatorio/cache-tag', () => ({ invalidateObservatory: invalidate }))
  vi.doMock('@/lib/youtube/observatorio/arquivo/remover', () => ({ pedirRemocao: f1.pedir, cancelarRemocao: f1.cancelar, apagarCanalSemGuardar: f1.apagar }))
  vi.doMock('@/lib/youtube/observatorio/arquivo-mensal/saida', () => ({ lerEmTransito: lerTransito }))
  vi.doMock('@/lib/supabase/service', () => ({
    getSupabaseServiceClient: () => {
      ordem.push('cliente')
      return {
        from: (tabela: string) => {
          const cadeia: Record<string, unknown> = {}
          const fim = (): unknown => {
            if (leituraFalha) return { data: null, error: { message: 'x' }, count: null }
            if (tabela === 'competitor_channels') return { data: canal ? [{ id: UUID, ...canal }] : [], error: null }
            return { count: tabela === 'competitor_videos' ? esperando.videos : esperando.comentarios, error: null }
          }
          for (const m of ['select', 'eq', 'not', 'is', 'limit']) cadeia[m] = () => cadeia
          cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve(fim()).then(ok)
          return cadeia
        },
      }
    },
  }))
  return import('@/app/cms/(authed)/youtube/competitors/actions')
}

beforeEach(() => {
  for (const f of [f1.pedir, f1.cancelar, f1.apagar, invalidate, revalidate]) f.mockReset()
  f1.pedir.mockResolvedValue({ ok: true, jaPedido: false })
  f1.cancelar.mockResolvedValue({ ok: true, naoPedido: false, despausado: true })
  f1.apagar.mockResolvedValue({ ok: true, videos: 340, miniaturasPendentes: 0, foraDoPrefixo: 0, registrosDiarios: 4000, leituras: 68 })
  lerTransito.mockClear(); transito = []
  negado = null; canal = { missing_since: null }; esperando = { videos: 0, comentarios: 0 }; leituraFalha = false
})

type Acao = 'pedir' | 'desfazer' | 'apagar'
const rodar = async (a: Awaited<ReturnType<typeof carregar>>, qual: Acao, id = UUID) =>
  qual === 'pedir' ? a.pedirRemocaoCanal(id) : qual === 'desfazer' ? a.desfazerRemocaoCanal(id) : a.apagarCanalSemGuardarAction(id, '  Canal X ')
const TODAS: Acao[] = ['pedir', 'desfazer', 'apagar']

describe('guarda (A4.1, A4.2)', () => {
  it.each(TODAS)('A4.1 %s: sem administrar, converte a recusa e nem cria o cliente de serviço', async qual => {
    negado = { ok: false, error: 'x' }
    const a = await carregar()
    const r = await rodar(a, qual)
    expect(r).toMatchObject({ ok: false, codigo: 'sem_direito' })
    expect(!r.ok && r.frase).toMatch(/^Só quem administra o site pode /)
    expect(ordem).toEqual(['guarda'])
    expect(invalidate).not.toHaveBeenCalled()
  })
  it('A4.1 a frase exata de pedir', async () => {
    negado = { ok: false, error: 'x' }
    expect(await (await carregar()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'sem_direito', frase: NEGADO })
  })
  it.each(TODAS)('A4.2 %s: id fora do formato de uuid = leitura, sem cliente nem cache', async qual => {
    const a = await carregar()
    expect(await rodar(a, qual, 'nao-e-uuid')).toMatchObject({ ok: false, codigo: 'leitura' })
    expect(ordem).toEqual(['guarda'])
    expect(invalidate).not.toHaveBeenCalled()
    expect(f1.pedir).not.toHaveBeenCalled(); expect(f1.cancelar).not.toHaveBeenCalled(); expect(f1.apagar).not.toHaveBeenCalled()
  })
})

describe('chamada à F1 (A4.3, A4.6)', () => {
  it('A4.3 pedir usa o motivo do guardar e o ator da sessão', async () => {
    const r = await (await carregar()).pedirRemocaoCanal(UUID)
    expect(r).toEqual({ ok: true, jaPedido: false })
    expect(f1.pedir.mock.calls[0]![1]).toEqual({ siteId: 's1', canalId: UUID, actorId: 'u1', motivo: 'nao_acompanhar' })
  })
  it('A4.3 apagar leva o nome SEM trim e o motivo do engano', async () => {
    await (await carregar()).apagarCanalSemGuardarAction(UUID, '  Canal X ')
    expect(f1.apagar.mock.calls[0]![1]).toEqual({ siteId: 's1', canalId: UUID, actorId: 'u1', nomeDigitado: '  Canal X ', motivo: 'entrou_por_engano' })
  })
  it('desfazer devolve naoPedido e despausado', async () => {
    f1.cancelar.mockResolvedValue({ ok: true, naoPedido: true, despausado: false })
    expect(await (await carregar()).desfazerRemocaoCanal(UUID)).toEqual({ ok: true, naoPedido: true, despausado: false })
    expect(f1.cancelar.mock.calls[0]![1]).toEqual({ siteId: 's1', canalId: UUID, actorId: 'u1' })
  })
  it.each(TODAS)('A4.6 %s: a falha da F1 passa adiante sem reescrever a frase', async qual => {
    const falha = { ok: false, codigo: 'video_compartilhado', frase: 'FRASE DO CATÁLOGO' }
    f1.pedir.mockResolvedValue(falha); f1.cancelar.mockResolvedValue(falha); f1.apagar.mockResolvedValue(falha)
    expect(await rodar(await carregar(), qual)).toEqual(falha)
  })
  it('desfazer: canal_nao_encontrado volta como resposta (a tela trata como normal)', async () => {
    f1.cancelar.mockResolvedValue({ ok: false, codigo: 'canal_nao_encontrado', frase: 'Este canal já foi removido. Atualize a página.' })
    expect(await (await carregar()).desfazerRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'canal_nao_encontrado', frase: 'Este canal já foi removido. Atualize a página.' })
  })
})

describe('trava E9 (A4.4)', () => {
  it.each(['pedir', 'apagar'] as const)('%s: canal que saiu do YouTube não chama a F1', async qual => {
    canal = { missing_since: '2026-10-10' }
    expect(await rodar(await carregar(), qual)).toEqual({ ok: false, codigo: 'saiu_do_youtube', frase: 'Este canal saiu do YouTube: responda na aba Saíram do YouTube.' })
    expect(f1.pedir).not.toHaveBeenCalled(); expect(f1.apagar).not.toHaveBeenCalled()
  })
  it('itens esperando: código próprio e a frase com o número', async () => {
    esperando = { videos: 1, comentarios: 1 }
    expect(await (await carregar()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'itens_na_fila', frase: 'Este canal tem 2 itens esperando resposta na aba Saíram do YouTube: responda primeiro.' })
  })
  it('leitura que falha: não remove sem saber', async () => {
    leituraFalha = true
    expect(await (await carregar()).apagarCanalSemGuardarAction(UUID, 'X')).toEqual({ ok: false, codigo: 'leitura', frase: 'Não deu para conferir o canal agora. Nada mudou. Tente de novo.' })
    expect(f1.apagar).not.toHaveBeenCalled()
  })
  it('desfazer NÃO passa pela trava', async () => {
    canal = { missing_since: '2026-10-10' }
    expect(await (await carregar()).desfazerRemocaoCanal(UUID)).toMatchObject({ ok: true })
  })
})

describe('cache (A4.5)', () => {
  it.each(TODAS)('%s: sucesso solta o cache do site e o layout', async qual => {
    await rodar(await carregar(), qual)
    expect(invalidate).toHaveBeenCalledWith('s1')
    expect(revalidate).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it.each(TODAS)('%s: solta também o aviso do arquivo (Phil r2 R2)', async qual => {
    revalidateTag.mockClear()
    await rodar(await carregar(), qual)
    expect(revalidateTag).toHaveBeenCalledWith('arquivo:s1', { expire: 0 })
  })
  it.each(TODAS)('%s: falha da F1 também solta', async qual => {
    const falha = { ok: false, codigo: 'sem_vaga', frase: 'f' }
    f1.pedir.mockResolvedValue(falha); f1.cancelar.mockResolvedValue(falha); f1.apagar.mockResolvedValue(falha)
    await rodar(await carregar(), qual)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledTimes(1)
  })
  it.each(TODAS)('%s: exceção da F1 solta e propaga', async qual => {
    const boom = new Error('rede')
    f1.pedir.mockRejectedValue(boom); f1.cancelar.mockRejectedValue(boom); f1.apagar.mockRejectedValue(boom)
    await expect(rodar(await carregar(), qual)).rejects.toThrow('rede')
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledTimes(1)
  })
  it('trava recusando (a F1 não foi chamada) não solta nada', async () => {
    canal = { missing_since: '2026-10-10' }
    await (await carregar()).pedirRemocaoCanal(UUID)
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('contagens do apagar (A4.9)', () => {
  it('os números vêm do que o banco apagou', async () => {
    expect(await (await carregar()).apagarCanalSemGuardarAction(UUID, 'X')).toEqual({ ok: true, videos: 340, leituras: 68, registrosDiarios: 4000 })
  })
  it('T12/Q4: imagensRestantes passa adiante quando a F1 leu; ausente quando não leu', async () => {
    f1.apagar.mockResolvedValue({ ok: true, videos: 340, miniaturasPendentes: 47, foraDoPrefixo: 0, imagensRestantes: 47 })
    expect(await (await carregar()).apagarCanalSemGuardarAction(UUID, 'X')).toEqual({ ok: true, videos: 340, imagensRestantes: 47 })
  })
  it('campo que a F1 não devolveu fica AUSENTE, nunca 0', async () => {
    f1.apagar.mockResolvedValue({ ok: true, videos: 340, miniaturasPendentes: 0, foraDoPrefixo: 0 })
    const r = await (await carregar()).apagarCanalSemGuardarAction(UUID, 'X')
    expect(r).toEqual({ ok: true, videos: 340 })
    expect(r).not.toHaveProperty('leituras')
  })
})

describe('código morto (A4.8)', () => {
  const DIR = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
  it('removeCompetitorChannel e removerCanalArquivado não existem mais nos arquivos de src', () => {
    for (const f of ['actions.ts', 'page.tsx', 'canal/[id]/page.tsx', '../../../../../lib/youtube/observatorio/arquivo/remover.ts']) {
      const t = readFileSync(resolve(DIR, f), 'utf8')
      expect(t, f).not.toContain('removeCompetitorChannel')
      expect(t, f).not.toContain('removerCanalArquivado')
      expect(t, f).not.toContain('SEM_LOTE_NA_TELA')
    }
  })
})

describe('M6a T13: recusa por mês em trânsito', () => {
  const FRASE = 'Não dá para remover canal agora: o mês saiu das telas.'
  const recusaMes = { ok: false, codigo: 'mes_destacado_em_transito', frase: FRASE }
  const mes = (m: string, d: string) => ({ tabela: 'competitor_video_daily', mes: m, destacado_em: '2026-10-17T15:00:00Z', liberar_a_partir: d })
  it.each(TODAS)('%s: devolve a frase e os meses (sem gravar nada por conta própria)', async qual => {
    f1.pedir.mockResolvedValue(recusaMes); f1.cancelar.mockResolvedValue(recusaMes); f1.apagar.mockResolvedValue(recusaMes)
    transito = [mes('2026-11-01', '2026-11-24'), mes('2026-10-01', '2026-10-24'), mes('2026-10-01', '2026-10-24')]
    const r = await rodar(await carregar(), qual)
    expect(r).toEqual({ ok: false, codigo: 'mes_destacado_em_transito', frase: FRASE, mesFora: { meses: 2, nomes: ['2026-10-01', '2026-11-01'], liberarAPartir: '2026-10-24' } })
    expect(lerTransito).toHaveBeenCalledWith(expect.anything(), 's1')
  })
  it.each([[null], [[]]])('leitura dos meses falha ou vazia (%j): só a frase, sem mesFora', async t => {
    f1.apagar.mockResolvedValue(recusaMes)
    transito = t as typeof transito
    expect(await rodar(await carregar(), 'apagar')).toEqual({ ok: false, codigo: 'mes_destacado_em_transito', frase: FRASE })
  })
  it('a leitura dos meses lança: só a frase', async () => {
    f1.apagar.mockResolvedValue(recusaMes)
    lerTransito.mockRejectedValueOnce(new Error('rede'))
    expect(await rodar(await carregar(), 'apagar')).toEqual({ ok: false, codigo: 'mes_destacado_em_transito', frase: FRASE })
  })
  it('outras recusas não leem o trânsito', async () => {
    f1.apagar.mockResolvedValue({ ok: false, codigo: 'sem_vaga', frase: 'f' })
    await rodar(await carregar(), 'apagar')
    expect(lerTransito).not.toHaveBeenCalled()
  })
})
