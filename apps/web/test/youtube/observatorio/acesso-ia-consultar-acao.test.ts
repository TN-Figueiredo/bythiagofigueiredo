// @vitest-environment node
/**
 * A4 R5 T9: a 11ª ação no esquema, no tradutor e nos exemplos. Puro: `ENTRADA`, `traduzir`, `FORMATO_DA_ACAO`/`EXEMPLO_DA_ACAO`.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))

import { ACOES, ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { CAMPOS_DA_ACAO, EXEMPLO_DA_ACAO, FORMATO_DA_ACAO, exemploValido, fraseDeRecusa } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { DEFAULT_AGES } from '@/lib/youtube/observatorio/rules'
import { METRICAS_DA_CONSULTA } from '@/lib/youtube/observatorio/consulta/catalogo'

const C1 = '11111111-1111-4111-8111-111111111111'
const C2 = '22222222-2222-4222-8222-222222222222'
const ok = (e: unknown) => { const r = ENTRADA.safeParse(e); if (!r.success) throw new Error(JSON.stringify(r.error.issues)); return traduzir(r.data) }
const pedidoDe = (e: unknown) => { const t = ok(e); if (!t.ok) throw new Error(t.frase); return t.pedido.consulta! }

describe('consultar: esquema', () => {
  it('é a 11ª ação, com formato e exemplo que passam pelo esquema e pelo tradutor', () => {
    expect(ACOES).toHaveLength(11)
    expect(ACOES).toContain('consultar')
    expect(FORMATO_DA_ACAO.consultar).toBeTruthy()
    const dado = JSON.parse(exemploValido('consultar', { uuid: C1, video: 'dQw4w9WgXcQ' })) as unknown
    const lida = ENTRADA.safeParse(dado)
    expect(lida.success, JSON.stringify(lida)).toBe(true)
    expect(traduzir((lida as { data: never }).data).ok).toBe(true)
    expect(JSON.parse(EXEMPLO_DA_ACAO.consultar).acao).toBe('consultar')
    for (const k of Object.keys(JSON.parse(EXEMPLO_DA_ACAO.consultar) as object).filter((x) => x !== 'acao')) expect(CAMPOS_DA_ACAO.consultar).toContain(k)
  })
  it('(§7 teste 13) entidade "comentario" e chave extra: pedido recusado, só nomes de campo; entidade omitida vale "video"', () => {
    const c = ENTRADA.safeParse({ acao: 'consultar', entidade: 'comentario' })
    expect(c.success).toBe(false)
    if (!c.success) expect(JSON.stringify(c.error.issues.map((i) => i.path))).toContain('entidade')
    expect(ENTRADA.safeParse({ acao: 'consultar', zz_extra: 1 }).success).toBe(false)
    const livre = ENTRADA.safeParse({ acao: 'consultar' })
    expect(livre.success).toBe(true)
    if (livre.success) expect((livre.data as { entidade?: string }).entidade).toBe('video')
  })
  it('a lista fechada: lugar fora da forma, faixa inventada, métrica inventada, limite 0 e 51, canal_ids com 7 são recusados', () => {
    const recusa = (extra: object) => expect(ENTRADA.safeParse({ acao: 'consultar', ...extra }).success, JSON.stringify(extra)).toBe(false)
    recusa({ lugar: 'Hanoi' }); recusa({ lugar: 'local:VN-hanoi' }); recusa({ lugar: 'pais:vn' })
    recusa({ janela_idade: ['0-31'] }); recusa({ janela_idade: [] }); recusa({ metricas: ['views', 'ouro'] }); recusa({ ordenar_por: 'ouro' })
    recusa({ limite: 0 }); recusa({ limite: 51 }); recusa({ limite: '51' }); recusa({ limite: '1.5' })
    recusa({ canal_ids: [C1, C2, C1, C2, C1, C2, 'a'.repeat(22)] }); recusa({ canal_ids: ['nao-e-id'] })
    recusa({ direcao: 'cima' }); recusa({ publicado_de: '2026-13-01' }); recusa({ incluir_base_fraca: 'talvez' })
    recusa({ nicho: 'x'.repeat(65) })
  })
  it('limite "20" e incluir_base_fraca "true" (texto) valem 20 e true; as formas válidas passam', () => {
    const p = pedidoDe({ acao: 'consultar', limite: '20', incluir_base_fraca: 'true' })
    expect(p.limite).toBe(20)
    expect(p.incluirBaseFraca).toBe(true)
    for (const e of [{ lugar: 'local:vn-hanoi' }, { lugar: 'pais:VN' }, { janela_idade: 'todas' }, { janela_idade: ['0-30', '365+'] }, { janela_idade: '31-90' }, { canal_ids: [C1, 'UCabcdefghijklmnopqrstuv'] }]) {
      expect(ENTRADA.safeParse({ acao: 'consultar', ...e }).success, JSON.stringify(e)).toBe(true)
    }
  })
})

describe('consultar: tradutor', () => {
  it('os padrões: formato todos, faixas padrão da Outliers, multiplicador desc, 20 linhas, base fraca fora, cinco métricas (engajamento entra: C1 R3)', () => {
    const t = ok({ acao: 'consultar' })
    expect(t.ok).toBe(true)
    if (!t.ok) return
    expect(t.pedido.telas).toEqual([{ tela: 'consultar', sp: {} }])
    expect(t.pedido.limite).toEqual({ tipo: 'linhas', n: 20 })
    expect(t.pedido.consulta).toEqual({
      formato: 'todos', janelaIdade: [...DEFAULT_AGES], metricas: ['views', 'likes', 'comentarios', 'multiplicador', 'engajamento'],
      ordenarPor: 'multiplicador', direcao: 'desc', limite: 20, incluirBaseFraca: false,
    })
  })
  it('ordenar_por sempre entra em metricas; janela_idade de uma faixa vira lista; "todas" fica "todas"; canal_ids e filtros passam', () => {
    const p = pedidoDe({ acao: 'consultar', ordenar_por: 'engajamento', metricas: ['views'], janela_idade: '31-90', lugar: 'pais:VN', nicho: 'viagem', canal_ids: [C1], publicado_de: '2026-10-01', publicado_ate: '2026-10-31', direcao: 'asc', formato: 'shorts' })
    expect(p.metricas).toEqual(['views', 'engajamento'])
    expect(p.janelaIdade).toEqual(['31-90'])
    expect(p).toMatchObject({ lugar: 'pais:VN', nicho: 'viagem', canalIds: [C1], publicadoDe: '2026-10-01', publicadoAte: '2026-10-31', direcao: 'asc', formato: 'shorts', ordenarPor: 'engajamento' })
    expect(pedidoDe({ acao: 'consultar', janela_idade: 'todas' }).janelaIdade).toBe('todas')
    for (const m of Object.keys(METRICAS_DA_CONSULTA)) expect(pedidoDe({ acao: 'consultar', ordenar_por: m }).metricas).toContain(m)
  })
  it.each([
    ['canal_ids repetido (maiúscula e minúscula)', { canal_ids: [C1, C1.toUpperCase()] }, 'canal_ids'],
    ['canal_ids com proprio', { canal_ids: ['proprio', C1] }, 'canal_ids'],
    ['janela_idade com faixa repetida', { janela_idade: ['0-30', '0-30'] }, 'janela_idade'],
    ['metricas repetidas', { metricas: ['views', 'views'] }, 'metricas'],
    ['publicado_de depois de publicado_ate', { publicado_de: '2026-11-02', publicado_ate: '2026-11-01' }, 'publicado_de'],
    ['entidade canal (2ª entrega)', { entidade: 'canal' }, 'entidade'],
  ])('recusa %s com o campo certo', (_n, extra, campo) => {
    const lida = ENTRADA.safeParse({ acao: 'consultar', ...extra })
    if (!lida.success) { expect(JSON.stringify(lida.error.issues.map((i) => i.path))).toContain(campo); return }
    const t = traduzir(lida.data)
    expect(t.ok).toBe(false)
    if (!t.ok) { expect(t.campos).toContain(campo); expect(t.frase.length).toBeGreaterThan(10); expect(fraseDeRecusa('consultar', t.frase)).toContain('Exemplo válido:') }
  })
  it('publicado_de igual a publicado_ate vale (um dia só)', () => {
    expect(pedidoDe({ acao: 'consultar', publicado_de: '2026-11-01', publicado_ate: '2026-11-01' }).publicadoDe).toBe('2026-11-01')
  })
  it('nenhuma ação antiga ganhou consulta no pedido', () => {
    for (const e of [{ acao: 'definicoes' }, { acao: 'sugestoes' }, { acao: 'listar_canais' }]) {
      const t = ok(e); expect(t.ok && t.pedido.consulta).toBeFalsy()
    }
  })
})
