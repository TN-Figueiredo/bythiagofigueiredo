// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { linhasConcluidas, noArDoTeste } from '@/lib/youtube/ab-lab-pagina/concluidos'
import { painelEscolhaDoConcluido } from '@/lib/youtube/ab-lab-pagina/painel-do-concluido'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { makeCardView, makeTestWithVariants } from './helpers/ab-fixtures'

const agora = new Date('2026-10-26T15:00:00Z')
const mk = (id: string, label: 'A' | 'B' | 'C', isOriginal: boolean) => ({ id, label, color: '#000', thumbUrl: null, title: null, isOriginal })
const card = makeCardView({ id: 't1', type: 'title', videoTitle: 'Vídeo X', variants: [mk('va', 'A', true), mk('vb', 'B', false)] })
type Conc = Extract<TelaV2, { fase: 'concluido' }>
const tela = (o: Partial<Conc> = {}): Conc => ({
  fase: 'concluido', selo: { tipo: 'vence', provisorio: false, letra: 'B' }, frase: { principal: '', apoio: null }, prazo: null,
  noAr: { tipo: 'original' }, aplicar: null, aplicarDeNovo: null, bloqueio: null, n: null, pisos: null, tentarDeNovo: false, ...o,
})
const campo = (destino: string, em: string, estado = 'ok') => ({ estado, destino, em, forcado: false, escreveu: true, erro: null, attempts: 1 })
function bruto(o: Partial<AbTestWithVariants> = {}): AbTestWithVariants {
  return { ...makeTestWithVariants(), id: 't1', test_type: 'title', youtube_video_id: 'yt1', status: 'completed',
    completed_at: '2026-10-26T14:00:00Z', winner_applied_at: null, winner_variant_id: null, ...o } as AbTestWithVariants
}
function lab(b: AbTestWithVariants, t: Conc | null, painel: PainelEscolha | null = null, c = card) {
  return linhasConcluidas({ testes: [{ card: c, bruto: b, painel, tela: t }], linhasStudio: [], agora })[0]!
}
const letraDe = (id: string) => (id === 'vb' ? 'B' : id === 'va' ? 'A' : null)

describe('Concluídos do Lab', () => {
  it('aplicada: "B venceu" e no ar desde = maior em', () => {
    const b = bruto({ winner_variant_id: 'vb', winner_applied_at: '2026-10-26T13:00:00Z',
      restore_status: { title: campo('vb', '2026-10-26T13:00:00Z') } })
    const l = lab(b, tela({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false } }))
    expect(l.resultado).toBe('B venceu'); expect(l.apoio).toBe('no ar desde 26/10')
  })
  it('combo com campo falho: "no ar: não confirmado"', () => {
    const b = bruto({ test_type: 'combo', winner_variant_id: 'vb',
      restore_status: { title: campo('vb', '2026-10-26T13:00:00Z'), thumbnail: campo('vb', '2026-10-26T13:00:00Z', 'falhou') } })
    expect(lab(b, null).apoio).toBe('no ar: não confirmado')
    expect(noArDoTeste(b, letraDe).confirmado).toBe(false)
  })
  it('combo: maior em entre os campos ok com o mesmo destino', () => {
    const b = bruto({ test_type: 'combo', winner_variant_id: 'vb',
      restore_status: { title: campo('vb', '2026-10-25T10:00:00Z'), thumbnail: campo('vb', '2026-10-26T10:00:00Z') } })
    expect(noArDoTeste(b, letraDe)).toEqual({ letra: 'B', desde: '2026-10-26T10:00:00Z', confirmado: true })
  })
  it('original vence: "A (original) ficou"', () => {
    const b = bruto({ winner_variant_id: null, restore_status: { title: campo('original', '2026-10-26T13:00:00Z') } })
    const l = lab(b, null)
    expect(l.resultado).toBe('A (original) ficou'); expect(l.apoio).toBe('no ar desde 26/10')
  })
  it('sugerida não aplicada: "B sugerido pelo teste", falta aplicar, linha abre o painel', () => {
    const t = tela({ aplicar: { variant_id: 'vb', letra: 'B' } })
    const b = bruto()
    const p = painelEscolhaDoConcluido({ card, bruto: b, tela: t, ctrs: {} }, true)
    const l = lab(b, t, p)
    expect(l.resultado).toBe('B sugerido pelo teste'); expect(l.apoio).toBe('falta aplicar no vídeo')
    expect(l.painel?.modo).toBe('escolha')
  })
  it('aplicada: a linha também abre o painel; sem tela, não abre', () => {
    const t = tela({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false } })
    const b = bruto({ winner_variant_id: 'vb', restore_status: { title: campo('vb', '2026-10-26T13:00:00Z') } })
    expect(lab(b, t, painelEscolhaDoConcluido({ card, bruto: b, tela: t, ctrs: {} }, true)).painel).not.toBeNull()
    expect(painelEscolhaDoConcluido({ card, bruto: b, tela: null, ctrs: {} }, true)).toBeNull()
  })
  it('desfecho sem vencedor', () => {
    for (const tipo of ['sem_diferenca', 'volume', 'dado', 'falha'] as const) {
      expect(lab(bruto(), tela({ selo: { tipo } })).resultado).toBe('Sem vencedor')
    }
  })
  it('outro teste aberto no vídeo: sem painel, linha não clicável', () => {
    const t = tela({ noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: false }, bloqueio: 'outro_teste' })
    const b = bruto()
    const p = painelEscolhaDoConcluido({ card, bruto: b, tela: t, ctrs: {}, outroAberto: true }, true)
    expect(p).toBeNull()
    expect(lab(b, t, p).painel).toBeNull()
  })
  it('teste v1 sem restore_status: usa winner_applied_at', () => {
    const b = bruto({ winner_variant_id: 'vb', winner_applied_at: '2026-10-20T12:00:00Z' })
    expect(noArDoTeste(b, letraDe)).toEqual({ letra: 'B', desde: '2026-10-20T12:00:00Z', confirmado: true })
  })
})

function studio(o: Partial<NonNullable<LinhaDoCaminho['registro']>>, estado: LinhaDoCaminho['estado'] = 'ficou_no_ar'): LinhaDoCaminho {
  return { videoId: 'v9', ytId: 'yt9', titulo: 'Vídeo do Studio', miniaturaUrl: null, publicadoEm: '2026-09-01T00:00:00Z', estado, caminho: 'studio' as never, fichaId: null,
    registro: { id: 'r9', updatedAt: '2026-10-12T00:00:00Z', confirmadoEm: null, primeiraVista: null, diaDe14: 14, variantes: null,
      variantesTitulo: ['Original', 'Nova'], campos: ['titulo'], respostaDono: 'venceu_original', tituloAntes: 'Original', varianteVencedora: null,
      respondidoEm: '2026-10-12T15:00:00Z', respostaMudadaEm: null, vencedorFonte: 'dono', vencedorTitulo: 'Original', desfechoEm: null,
      inicio: '2026-09-28T00:00:00Z', ...o },
    labPausadoAte: null, nosso: null, impressoesPorDia: null }
}

describe('Concluídos do Studio e ordem', () => {
  it('ficou no ar: original, dd/mm do respondidoEm e "você contou do Studio"', () => {
    const l = linhasConcluidas({ testes: [], linhasStudio: [studio({})], agora })[0]!
    expect(l.resultado).toBe('A (original) ficou'); expect(l.apoio).toBe('no ar desde 12/10 · você contou do Studio')
    expect(l.origem).toBe('studio'); expect(l.painel).toBeNull(); expect(l.selos).toBeNull(); expect(l.tipo).toBe('Título')
  })
  it('sem vencedor', () => {
    const l = linhasConcluidas({ testes: [], linhasStudio: [studio({ respostaDono: 'nenhum_venceu' as never }, 'respondido_sem_vencedor')], agora })[0]!
    expect(l.resultado).toBe('Sem vencedor'); expect(l.apoio).toBe('você contou do Studio')
  })
  it('ordena do mais recente ao mais antigo misturando Lab e Studio', () => {
    const b = bruto({ completed_at: '2026-10-20T00:00:00Z' })
    const r = linhasConcluidas({ testes: [{ card, bruto: b, painel: null, tela: null }], linhasStudio: [studio({}), studio({ id: 'r10', respondidoEm: '2026-10-25T00:00:00Z' })], agora })
    expect(r.map(x => x.chave)).toEqual(['studio:v9:r10', 'lab:t1', 'studio:v9:r9'])
  })
})
