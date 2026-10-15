// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 9: a ação `gerarPacoteIa`. Guarda, cliente de serviço, Sentry e `EMPACOTAR` são simulados; o registro e a
 * segmentação rodam de verdade. Todos os testes simulam `ligado: true`, salvo o do interruptor, que lê o valor real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PacoteModelo, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { E17_D1_DEPLOY } from '@/lib/conferencias'
import { modeloCheio, modeloComComentarios, modeloPrivadoExcluido, modeloPrivadoIncluido, modeloVazio, SENTINELA } from './contexto-ia-fixture'

vi.mock('server-only', () => ({}))
const modo = vi.hoisted(() => ({ real: false, ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' && !modo.real ? modo.ligado : Reflect.get(t, k)) }) }
})
const SITE = '00000000-0000-4000-8000-0000000000aa'
const SITE_DO_PEDIDO = '00000000-0000-4000-8000-0000000000bb'
const USUARIO = '00000000-0000-4000-8000-0000000000cc'
const ctx = vi.hoisted(() => ({ siteId: '' }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn(async () => ({ siteId: ctx.siteId })) }))
const guarda = vi.hoisted(() => vi.fn())
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: guarda }))
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
const registro = vi.hoisted(() => vi.fn())
vi.mock('@/lib/youtube/observatorio/contexto-ia/registrar-acesso', () => ({ registrarAcesso: registro }))
const empacotarSim = vi.hoisted(() => vi.fn())
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', async (orig) => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_contexto-ia')>().catch(() => ({} as Record<string, unknown>))
  return { ...m, EMPACOTAR: new Proxy({}, { get: (_t, k) => (typeof k === 'string' && k !== 'then' ? (k in alvos ? alvos[k] : undefined) : undefined) }) }
})
const alvos = vi.hoisted(() => ({} as Record<string, unknown>))

import { gerarPacoteIa } from '@/app/cms/(authed)/youtube/competitors/contexto-ia-actions'

const TELAS_EXISTE: TelaId[] = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'canal-proprio', 'video-proprio']
const ID = '00000000-0000-4000-8000-000000000123'
const montado = (modelo: PacoteModelo = modeloCheio(), estado: Record<string, string> = { niche: 'todos' }) => ({ modelo, recente: '13/10/2026 09:10', estado })

beforeEach(() => {
  modo.real = false; modo.ligado = true; ctx.siteId = SITE
  guarda.mockResolvedValue({ ok: true, user: { id: USUARIO } })
  registro.mockResolvedValue({ ok: true })
  empacotarSim.mockResolvedValue(montado())
  for (const t of TELAS_EXISTE) alvos[t] = empacotarSim
})
afterEach(() => { vi.clearAllMocks() })

const pedir = (tela: string, extra: Record<string, unknown> = {}) => gerarPacoteIa({ tela, consulta: '', ...extra } as never)

describe('a guarda e a forma do pedido', () => {
  it('sem sessão: sem_acesso, nada é registrado, o empacotador não roda', async () => {
    guarda.mockResolvedValue({ ok: false })
    expect(await pedir('outliers')).toEqual({ ok: false, motivo: 'sem_acesso' })
    expect(empacotarSim).not.toHaveBeenCalled()
    expect(registro).not.toHaveBeenCalled()
  })

  it('a guarda é a de visualização do site do contexto', async () => {
    await pedir('outliers')
    expect(guarda).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'view' })
  })

  it('o site vem do contexto: um campo siteId no pedido é ignorado', async () => {
    await pedir('outliers', { siteId: SITE_DO_PEDIDO })
    expect(guarda).toHaveBeenCalledWith(expect.objectContaining({ siteId: SITE }))
    expect(registro.mock.calls[0]![0]).toMatchObject({ siteId: SITE, userId: USUARIO })
  })

  it.each([
    ['tela desconhecida', { tela: 'nada', consulta: '' }],
    ['tela em espera_a_tela', { tela: 'fila', consulta: '' }],
    ["tela '__proto__'", { tela: '__proto__', consulta: '' }],
    ['tela ausente', { consulta: '' }],
    ['consulta que não é texto', { tela: 'outliers', consulta: 7 }],
  ])('%s: pedido_invalido, a guarda nem é chamada', async (_n, p) => {
    expect(await gerarPacoteIa(p as never)).toEqual({ ok: false, motivo: 'pedido_invalido' })
    expect(guarda).not.toHaveBeenCalled()
  })

  it('pedido null: pedido_invalido, a guarda nem é chamada', async () => {
    expect(await gerarPacoteIa(null as never)).toEqual({ ok: false, motivo: 'pedido_invalido' })
    expect(guarda).not.toHaveBeenCalled()
  })

  it('id faltando numa tela que pede id; id com barra; id com 300 caracteres: pedido_invalido', async () => {
    for (const id of [undefined, 'a/b', 'x'.repeat(300), '']) {
      expect(await gerarPacoteIa({ tela: 'canal', id, consulta: '' } as never)).toEqual({ ok: false, motivo: 'pedido_invalido' })
    }
    expect(guarda).not.toHaveBeenCalled()
  })

  it('consulta com 2.001 caracteres: pedido_invalido; com 2.000: passa', async () => {
    expect(await pedir('outliers', { consulta: '?q=' + 'a'.repeat(1_998) })).toEqual({ ok: false, motivo: 'pedido_invalido' })
    expect((await pedir('outliers', { consulta: '?q=' + 'a'.repeat(1_997) })).ok).toBe(true)
  })

  it('a ação não tem parâmetro para a pergunta', () => {
    // @ts-expect-error a pergunta não faz parte do pedido
    void gerarPacoteIa({ tela: 'outliers', consulta: '', pergunta: 'x' })
  })
})

describe('o interruptor', () => {
  it('com ligado falso (simulado): pedido_invalido, a guarda nem é chamada', async () => {
    modo.ligado = false
    expect(await pedir('outliers')).toEqual({ ok: false, motivo: 'pedido_invalido' })
    expect(guarda).not.toHaveBeenCalled()
  })

  it('com ligado verdadeiro (simulado): o caminho feliz', async () => {
    expect((await pedir('outliers')).ok).toBe(true)
  })

  it('com o valor real da constante: pedido_invalido se E17_D1_DEPLOY é nula, caminho feliz se está preenchida', async () => {
    modo.real = true
    const r = await pedir('outliers')
    expect(CONTEXTO_IA_RULES.ligado).toBe(E17_D1_DEPLOY !== null)
    expect(r.ok).toBe(E17_D1_DEPLOY !== null)
    if (!r.ok) expect(r.motivo).toBe('pedido_invalido')
  })
})

describe('montar', () => {
  it('o empacotador devolve null: nao_encontrado, nenhuma linha gravada', async () => {
    empacotarSim.mockResolvedValue(null)
    expect(await gerarPacoteIa({ tela: 'canal', id: ID, consulta: '' })).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(registro).not.toHaveBeenCalled()
  })

  it('id de outro site e id inexistente dão a mesma resposta', async () => {
    empacotarSim.mockResolvedValue(null)
    const a = await gerarPacoteIa({ tela: 'video', id: ID, consulta: '' })
    const b = await gerarPacoteIa({ tela: 'video', id: 'inexistente', consulta: '' })
    expect(a).toEqual(b)
  })

  it('o empacotador recebe o id e os parâmetros planos da consulta; "?fmt=a&fmt=b" vira fmt = a', async () => {
    await gerarPacoteIa({ tela: 'canal', id: ID, consulta: '?fmt=a&fmt=b&tab=trocas' })
    expect(empacotarSim).toHaveBeenCalledWith({ id: ID, sp: { fmt: 'a', tab: 'trocas' } })
  })

  it('EMPACOTAR lança: falhou, um evento no Sentry com step e tela, sem a mensagem da exceção', async () => {
    empacotarSim.mockRejectedValue(new Error(`segredo ${SENTINELA}`))
    expect(await pedir('outliers')).toEqual({ ok: false, motivo: 'falhou' })
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const [erro, opcoes] = sentry.captureException.mock.calls[0]!
    expect(JSON.stringify([String(erro), opcoes])).not.toContain('segredo')
    expect(opcoes).toMatchObject({ tags: { component: 'observatorio-contexto-ia', step: 'montar', tela: 'outliers' }, extra: { siteId: SITE } })
    expect(registro).not.toHaveBeenCalled()
  })

  it('o redirecionamento do Next é relançado', async () => {
    const redir = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' })
    empacotarSim.mockRejectedValue(redir)
    await expect(pedir('outliers')).rejects.toBe(redir)
  })
})

describe('o registro', () => {
  it('caminho feliz: uma linha gravada, com cada campo', async () => {
    const r = await gerarPacoteIa({ tela: 'canal', id: ID, consulta: '?tab=trocas&q=segredo+de+busca' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(registro).toHaveBeenCalledTimes(1)
    const l = registro.mock.calls[0]![0]
    const p = r.pacote
    expect(l).toEqual({
      siteId: SITE, userId: USUARIO, tela: 'canal', incluiuPrivado: false, caracteres: expect.any(Number),
      params: {
        tela: 'canal', id: ID, estado: ['niche=todos'], versao: 1,
        total: p.numeros.medidos + p.numeros.zerosMedidos + p.numeros.naoMedidos, completo: expect.any(Number), degrau: expect.any(Number),
        piso_passou: expect.any(Boolean), tabelas: p.tabelas.length, medidos: p.numeros.medidos, zeros_medidos: p.numeros.zerosMedidos,
        nao_medidos: p.numeros.naoMedidos, privado: 'na', privado_medidos: 0, comentarios: 'na', tem_busca: true,
      },
    })
    expect(l.caracteres).toBeGreaterThan(100)
    expect(l.params.completo).toBeGreaterThanOrEqual(l.caracteres)
  })

  it('params não tem a chave pergunta, nem a consulta crua, nem o título sentinela; a busca vira tem_busca', async () => {
    empacotarSim.mockResolvedValue(montado(modeloCheio(), { niche: 'todos', q: 'minha busca livre', sort: 'x'.repeat(80) }))
    await pedir('outliers', { consulta: '?q=minha+busca+livre' })
    const l = registro.mock.calls[0]![0]
    const texto = JSON.stringify(l.params)
    expect(l.params).not.toHaveProperty('pergunta')
    expect(l.params).not.toHaveProperty('consulta')
    expect(texto).not.toContain('minha busca livre')
    expect(texto).not.toContain('Vídeo número')
    expect(l.params.tem_busca).toBe(true)
    // texto cru de 80 letras na URL não entra no estado
    expect(l.params.estado).toEqual(['niche=todos'])
  })

  it('o estado só leva chaves conhecidas e valores curtos', async () => {
    empacotarSim.mockResolvedValue(montado(modeloCheio(), { niche: 'viagem', fmt: 'shorts', desconhecida: 'x', topic: 'com espaço' }))
    await pedir('outliers')
    expect(registro.mock.calls[0]![0].params.estado).toEqual(['fmt=shorts', 'niche=viagem'])
  })

  it('privado: na, incluido e os três excluido:<motivo>; included_private só com incluido', async () => {
    const casos: Array<[PacoteModelo, string, boolean]> = [
      [modeloCheio(), 'na', false],
      [modeloPrivadoIncluido(true), 'incluido', true],
      [modeloPrivadoExcluido('sem_direito'), 'excluido:sem_direito', false],
      [modeloPrivadoExcluido('nao_conferido'), 'excluido:nao_conferido', false],
      [modeloPrivadoExcluido('leitura_falhou'), 'excluido:leitura_falhou', false],
    ]
    for (const [modelo, privado, incluiu] of casos) {
      registro.mockClear(); empacotarSim.mockResolvedValue(montado(modelo))
      expect((await pedir('canal-proprio', { id: ID })).ok).toBe(true)
      const l = registro.mock.calls[0]![0]
      expect(l.params.privado, privado).toBe(privado)
      expect(l.incluiuPrivado, privado).toBe(incluiu)
    }
  })

  it('privado_medidos: 0 com a tabela privada toda não medida e included_private true; maior que zero com número privado; 0 com excluído ou na', async () => {
    registro.mockClear(); empacotarSim.mockResolvedValue(montado(modeloPrivadoIncluido(false)))
    await pedir('canal-proprio', { id: ID })
    expect(registro.mock.calls[0]![0]).toMatchObject({ incluiuPrivado: true, params: { privado_medidos: 0 } })
    registro.mockClear(); empacotarSim.mockResolvedValue(montado(modeloPrivadoIncluido(true)))
    await pedir('canal-proprio', { id: ID })
    expect(registro.mock.calls[0]![0].params.privado_medidos).toBeGreaterThan(0)
    registro.mockClear(); empacotarSim.mockResolvedValue(montado(modeloPrivadoExcluido()))
    await pedir('canal-proprio', { id: ID })
    expect(registro.mock.calls[0]![0].params.privado_medidos).toBe(0)
  })

  it('included_private: true com comentários incluídos', async () => {
    empacotarSim.mockResolvedValue(montado(modeloComComentarios('incluido')))
    await pedir('video-proprio', { id: ID })
    expect(registro.mock.calls[0]![0]).toMatchObject({ incluiuPrivado: true, params: { comentarios: 'incluido' } })
    registro.mockClear(); empacotarSim.mockResolvedValue(montado(modeloComComentarios('excluido')))
    await pedir('video-proprio', { id: ID })
    expect(registro.mock.calls[0]![0]).toMatchObject({ incluiuPrivado: false, params: { comentarios: 'excluido' } })
  })

  it('uma chamada, uma linha: duas chamadas gravam duas', async () => {
    await pedir('outliers'); await pedir('outliers')
    expect(registro).toHaveBeenCalledTimes(2)
  })

  it('tela vazia: ainda registra e devolve o pacote', async () => {
    empacotarSim.mockResolvedValue(montado(modeloVazio()))
    const r = await pedir('canais')
    expect(r.ok && r.pacote.vazio).toBe(true)
    expect(registro).toHaveBeenCalledTimes(1)
  })
})

describe('quando a gravação falha, o pacote não sai', () => {
  it('a gravação falha (erro do banco): registro_falhou e a resposta não contém o pacote nem o sentinela', async () => {
    registro.mockResolvedValue({ ok: false, code: '23514' })
    const modelo = modeloCheio()
    modelo.avisos = ['SENTINELA-DO-MODELO']
    empacotarSim.mockResolvedValue(montado(modelo))
    const r = await pedir('outliers')
    expect(r).toEqual({ ok: false, motivo: 'registro_falhou' })
    expect(JSON.stringify(r)).not.toContain('SENTINELA-DO-MODELO')
    expect(sentry.captureException.mock.calls[0]![1]).toMatchObject({ tags: { step: 'registrar', tela: 'outliers' }, extra: { siteId: SITE, code: '23514' } })
  })

  it('a tabela não existe (42P01 e PGRST205): idem, com o code no Sentry', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      sentry.captureException.mockClear(); registro.mockResolvedValue({ ok: false, code })
      expect(await pedir('outliers')).toEqual({ ok: false, motivo: 'registro_falhou' })
      expect(sentry.captureException.mock.calls[0]![1]).toMatchObject({ extra: { code } })
    }
  })

  it('o registro só roda depois de montar e antes de devolver (mutação: devolver antes de registrar cairia aqui)', async () => {
    const ordem: string[] = []
    empacotarSim.mockImplementation(async () => { ordem.push('montar'); return montado() })
    registro.mockImplementation(async () => { ordem.push('registrar'); return { ok: false, code: 'x' } })
    const r = await pedir('outliers')
    expect(ordem).toEqual(['montar', 'registrar'])
    expect(r.ok).toBe(false)
  })
})
