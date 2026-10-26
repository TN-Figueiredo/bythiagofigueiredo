// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fraseDoTopo, itensComVoce, proximaDecisao, proximaTrocaDe, geraItemDia14, cartoesEmTeste } from '@/lib/youtube/ab-lab-pagina/com-voce'
import { montarPaginaDoLab } from '@/lib/youtube/ab-lab-pagina/montar'
import type { EntradaPagina } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { makeCardView, makeTestWithVariants } from './helpers/ab-fixtures'

const agora = new Date('2026-10-26T15:00:00Z')
const mk = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean) => ({ id, label, color: '#000', thumbUrl: null, title: null, isOriginal })
const vars = [mk('va', 'A', true), mk('vb', 'B', false)]
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000).toISOString()

type Ativa = Extract<TelaV2, { fase: 'ativo' }>
type Conc = Extract<TelaV2, { fase: 'concluido' }>
const telaAtiva = (o: Partial<Ativa> = {}): Ativa => ({ fase: 'ativo', dia: 1, teto: 15, pausado: false, passouDoFim: false, ilegivel: false, frase: { principal: '', apoio: '' }, n: null, pisos: [], sinal: null, ...o })
const telaConc = (o: Partial<Conc> = {}): Conc => ({
  fase: 'concluido', selo: { tipo: 'vence', provisorio: false, letra: 'B' }, frase: { principal: '', apoio: null }, prazo: null,
  noAr: { tipo: 'original' }, aplicar: null, voltar: false, aplicarDeNovo: null, bloqueio: null, n: null, pisos: null, tentarDeNovo: false, ...o,
})
function ativo(o: { id?: string; started?: string; status?: 'active' | 'queued'; tela?: Ativa | null; ctrs?: Record<string, number | null> } = {}): EntradaPagina['ativos'][number] {
  const bruto = { ...makeTestWithVariants(), id: o.id ?? 't1', started_at: o.started ?? '2026-10-25T12:00:00Z', youtube_video_id: 'yt1' } as AbTestWithVariants
  const card = makeCardView({ id: o.id ?? 't1', status: o.status ?? 'active', type: 'title', variants: vars, diaV2: { dia: 1, teto: 15 }, cycleStartedAt: dias(0) })
  return { card, bruto, tela: o.tela === undefined ? telaAtiva() : o.tela, ctrs: o.ctrs ?? { va: 0.041, vb: 0.048 } }
}
function concluido(aplicar: boolean): EntradaPagina['concluidos'][number] {
  const bruto = { ...makeTestWithVariants(), id: 'c1', status: 'completed', youtube_video_id: 'yt9', revert_expires_at: null } as AbTestWithVariants
  const card = makeCardView({ id: 'c1', status: 'completed', type: 'title', variants: vars })
  return { card, bruto, tela: telaConc(aplicar ? { aplicar: { variant_id: 'vb', letra: 'B' } } : {}), ctrs: {} }
}
function linha(estado: LinhaDoCaminho['estado'], o: { confirmadoEm?: string | null; inicio?: string; labPausadoAte?: string | null } = {}): LinhaDoCaminho {
  return {
    videoId: 'v1', ytId: 'yt-1', titulo: 'Vídeo do Studio', miniaturaUrl: null, publicadoEm: '2026-09-01T00:00:00Z', estado,
    caminho: { tipo: 'nativo' } as LinhaDoCaminho['caminho'], fichaId: null, labPausadoAte: o.labPausadoAte ?? null, nosso: null, impressoesPorDia: null,
    registro: {
      id: 'r1', updatedAt: dias(-1), confirmadoEm: o.confirmadoEm === undefined ? dias(-3) : o.confirmadoEm, primeiraVista: null, diaDe14: 3,
      variantes: [{ n: 1, titulo: 'Original', imagem: null }, { n: 2, titulo: 'Nova', imagem: null }], variantesTitulo: null, campos: ['titulo'],
      respostaDono: null, tituloAntes: null, varianteVencedora: null, respondidoEm: null, respostaMudadaEm: null, vencedorFonte: null,
      vencedorTitulo: null, desfechoEm: null, inicio: o.inicio ?? dias(-3),
    },
  } as LinhaDoCaminho
}
const base = (o: Partial<EntradaPagina> = {}): EntradaPagina => ({ ativos: [], concluidos: [], pausados: [], rascunhos: [], linhas: [], podeDeixarVariante: true, agora, ...o })

describe('Com você, topo e Em teste agora', () => {
  it('estado a: 1 ativo, nada com você', () => {
    const p = montarPaginaDoLab(base({ ativos: [ativo()] }))
    expect(p.topo.frase).toBe('Um teste rodando. Nada com você agora.')
    expect(p.comVoce.vazio).toBe('Próxima decisão: 08/11.')
    expect(p.comVoce.itens).toEqual([])
  })
  it('estado b: 0 ativos com histórico', () => {
    const p = montarPaginaDoLab(base({ concluidos: [concluido(false)] }))
    expect(p.topo.frase).toBe('Nenhum teste rodando. Nada com você agora.')
    expect(p.comVoce.vazio).toBe('Nenhum teste rodando; crie um quando quiser.')
  })
  it('estado b2: sem história', () => {
    const p = montarPaginaDoLab(base())
    expect(p.topo.frase).toBe('Nenhum teste ainda. Crie o primeiro quando quiser.')
    expect(p.comVoce.itens).toEqual([{ tipo: 'primeiro_teste' }])
    expect(p.temHistorico).toBe(false)
  })
  it('estado c: 3 do Lab + 1 Studio, aplicar B e dia 14', () => {
    const p = montarPaginaDoLab(base({
      ativos: [ativo({ id: 'a1' }), ativo({ id: 'a2' }), ativo({ id: 'a3' })],
      concluidos: [concluido(true)],
      linhas: [linha('em_teste_studio'), linha('resultado_pronto', { inicio: dias(-15) })],
    }))
    expect(p.topo.frase).toBe('4 testes rodando (1 no Studio). Duas coisas com você: aplicar B e dizer o que o Studio escolheu.')
  })
  it('estado f: sem Lab rodando, 4 itens', () => {
    const itens = itensComVoce(base({
      concluidos: [concluido(true)], rascunhos: [{ id: 'd1', name: 'Rasc', step: 2 } as never],
      linhas: [linha('resultado_pronto', { inicio: dias(-15) }), linha('em_teste_studio', { confirmadoEm: null })],
    }))
    expect(itens).toHaveLength(4)
    expect(fraseDoTopo({ lab: 0, studio: 0, itens, temHistorico: true })).toBe('Nenhum teste do Lab rodando. Quatro coisas com você.')
  })
  it('dois itens com o mesmo verbo não repetem a frase (Logan S1)', () => {
    const it2 = { tipo: 'aplicar', letra: 'B' } as never
    expect(fraseDoTopo({ lab: 2, studio: 0, itens: [it2, it2], temHistorico: true })).toBe('2 testes rodando. Duas coisas com você: aplicar B em dois testes.')
  })
  it('uma coisa só cita o verbo', () => {
    const itens = itensComVoce(base({ concluidos: [concluido(true)] }))
    expect(fraseDoTopo({ lab: 1, studio: 0, itens, temHistorico: true })).toBe('Um teste rodando. Uma coisa com você: aplicar B.')
  })
  it('ordem: dia14 vencido, aplicar, dia14 no prazo, retomar, rascunho, conferir', () => {
    const itens = itensComVoce(base({
      concluidos: [concluido(true)],
      pausados: [makeCardView({ id: 'p1', status: 'paused', videoTitle: 'Pausado' })],
      rascunhos: [{ id: 'd1', name: 'Rasc', step: 1 } as never],
      linhas: [linha('em_teste_studio', { confirmadoEm: null }), linha('resultado_pronto', { inicio: dias(-15) }), linha('sem_resposta', { inicio: dias(-20) })],
    }))
    expect(itens.map(i => i.tipo)).toEqual(['dia14', 'aplicar', 'dia14', 'retomar', 'rascunho', 'conferir_studio'])
    expect(itens[0]).toMatchObject({ vencido: true })
    expect(itens[2]).toMatchObject({ vencido: false })
  })
  it('dia 14 carrega a linha inteira; em_teste_studio sem confirmadoEm vira conferir_studio', () => {
    const l = linha('resultado_pronto', { inicio: dias(-15) })
    const it1 = itensComVoce(base({ linhas: [l] }))[0]!
    expect(it1.tipo === 'dia14' && it1.linha).toBe(l)
    expect(itensComVoce(base({ linhas: [linha('em_teste_studio', { confirmadoEm: null })] }))[0]).toMatchObject({ tipo: 'conferir_studio', ytId: 'yt-1' })
  })
  it('pausado há 3 dias com ciclo iniciado há 10: conta desde paused_at; sem paused_at é nulo (nunca cai no ciclo nem em 0)', () => {
    const mk = (o: Partial<ReturnType<typeof makeCardView>>) => itensComVoce(base({ pausados: [makeCardView({ status: 'paused', ...o })] })).find(i => i.tipo === 'retomar')
    expect(mk({ pausedAt: dias(-3), cycleStartedAt: dias(-10) })).toMatchObject({ pausadoHaDias: 3 })
    expect(mk({ pausedAt: null, cycleStartedAt: dias(-10) })).toMatchObject({ pausadoHaDias: null })
    expect(mk({ pausedAt: null, cycleStartedAt: null })).toMatchObject({ pausadoHaDias: null })
  })
  it('cartão queued: painel nulo; active: painel presente', () => {
    const p = montarPaginaDoLab(base({ ativos: [ativo({ status: 'queued' }), ativo({ id: 't2' })] }))
    const labs = p.emTeste.filter(c => c.tipo === 'lab')
    expect(labs[0]).toMatchObject({ painel: null, proximaTroca: null })
    expect(labs[1]!.tipo === 'lab' && labs[1]!.painel?.modo).toBe('ativo')
  })
  it('pausado por teste do YouTube aberto vira cartão studio, não "retomar"', () => {
    const p = montarPaginaDoLab(base({
      pausados: [makeCardView({ status: 'paused', pausaYoutube: { aberto: true, ate: dias(5) } })],
      linhas: [linha('em_teste_studio', { labPausadoAte: dias(5) })],
    }))
    expect(p.comVoce.itens.some(i => i.tipo === 'retomar')).toBe(false)
    expect(p.emTeste[0]).toMatchObject({ tipo: 'studio', labPausadoAte: dias(5) })
  })
  it('cartão lab: líder só com sinal; sem sinal poucos dados ou CTR não medido', () => {
    const com = montarPaginaDoLab(base({ ativos: [ativo({ tela: telaAtiva({ sinal: 'B' }) })] })).emTeste[0]!
    expect(com).toMatchObject({ lider: { letra: 'B', ctrs: ['4,8%', '4,1%'] } })
    const sem = montarPaginaDoLab(base({ ativos: [ativo()] })).emTeste[0]!
    expect(sem).toMatchObject({ lider: null, semLider: 'poucos dados' })
    const nulo = montarPaginaDoLab(base({ ativos: [ativo({ ctrs: { va: null, vb: null } })] })).emTeste[0]!
    expect(nulo).toMatchObject({ lider: null, semLider: 'CTR não medido' })
  })
  it('nulo nunca vira 0: CTR nulo no líder não aparece como 0,0%', () => {
    const p = montarPaginaDoLab(base({ ativos: [ativo({ tela: telaAtiva({ sinal: 'B' }), ctrs: { va: 0.04, vb: null } })] }))
    expect(JSON.stringify(p.emTeste)).not.toContain('0,0%')
    expect(p.emTeste[0]).toMatchObject({ lider: null })
  })
  it('régua só com menos de 3 concluídos raiz', () => {
    expect(montarPaginaDoLab(base({ concluidos: [concluido(false)] })).concluidos.regua).toEqual({ feitos: 1, meta: 3 })
    const tres = [concluido(false), concluido(false), concluido(false)]
    const p = montarPaginaDoLab(base({ concluidos: tres }))
    expect(p.concluidos.regua).toBeNull(); expect(p.concluidos.total).toBe(3)
  })
  it('proximaDecisao: menor entre ativos e prazo do Studio; proximaTrocaDe', () => {
    expect(proximaDecisao(base())).toBeNull()
    const d = proximaDecisao(base({ ativos: [ativo()], linhas: [linha('em_teste_studio', { inicio: dias(-10) })] }))!
    expect(d.toISOString()).toBe(new Date(Date.parse(dias(-10)) + 14 * 86_400_000).toISOString())
    expect(proximaTrocaDe(null, agora)).toBeNull()
    expect(proximaTrocaDe(new Date(agora.getTime() - 3_600_000).toISOString(), agora)).toBe('~23h')
    expect(proximaTrocaDe(new Date(agora.getTime() - 24 * 3_600_000).toISOString(), agora)).toBe('<1h')
  })
  it('dia14 do cartão do Studio vem da mesma regra do item: só resultado_pronto e sem_resposta geram', () => {
    expect(geraItemDia14(linha('resultado_pronto', { inicio: dias(-15) }))).toBe(true)
    expect(geraItemDia14(linha('sem_resposta', { inicio: dias(-20) }))).toBe(true)
    expect(geraItemDia14(linha('em_teste_studio'))).toBe(false)
    const l = linha('em_teste_studio')
    expect(cartoesEmTeste(base({ linhas: [l] }))[0]).toMatchObject({ tipo: 'studio', dia14: geraItemDia14(l) })
  })
})
