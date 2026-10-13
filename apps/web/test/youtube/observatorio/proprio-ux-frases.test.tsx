// @vitest-environment jsdom
/**
 * Onda de consertos de UX da A4 (revisão de 12/10): item 5 (M1: o % assistido com poucos dias é "ainda não dá para dizer", não "não medido") e item 6
 * (as frases novas sem jargão: "lido", "gravou", "guardados", "CTR", "diário"; a convenção é "dias medidos" e "sem relatório").
 * Frase de tela afirmada por inteiro; mais uma varredura do código-fonte das telas da A4 que barra a volta das palavras de sistema.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { proprioWorld, alcanceComLinhas } from './proprio-fixture'
import { diarioComPct } from './proprio-assistido-fixture'
import { buildSoSeuCanal, montarSoSeuCanalDado, FRASE_NEGADO_CARTAO } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { SoSeuCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal'
import { foraDosGuardadosFrase } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { FRASE_CTR, FRASE_NADA_LIDO } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'

vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('sem router') } }))
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const W = proprioWorld()
const { obs, canalId, ytIds, hoje, dm } = W
const F = obs.fmt
const alcance = () => ({ acesso: 'ok' as const, dado: alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: addDays(hoje, -5), imp: 100, ctr: 0.03 }]) })
const dadoCom = (dias: number) => montarSoSeuCanalDado({
  nome: 'tnFigueiredo', alcance: alcance(), diario: { acesso: 'ok', dado: diarioComPct(canalId, ytIds, hoje, [{ dias, views: 40, pct: 61 }]) }, longos: ytIds, dm, F, hoje,
})
const assistido = (dias: number) => dadoCom(dias).view!.linhas.find(l => l.chave === 'assistido')!

describe('M1: o % assistido do cartão com poucos dias diz "ainda não dá para dizer", sem o quadradinho de não medido', () => {
  it('2 dias: valor nulo, a frase certa e aindaNaoDa; 1 dia no singular', () => {
    expect(assistido(2)).toMatchObject({ valor: null, aindaNaoDa: true, nota: 'Ainda não dá para dizer: só 2 dias com dado; precisa de 7.' })
    expect(assistido(1)).toMatchObject({ valor: null, aindaNaoDa: true, nota: 'Ainda não dá para dizer: só 1 dia com dado; precisa de 7.' })
  })
  it('7 dias já dá número; o "não medido" de verdade (diário vazio) NÃO é aindaNaoDa', () => {
    expect(assistido(7)).toMatchObject({ valor: '61%', aindaNaoDa: false })
    const vazio = montarSoSeuCanalDado({ nome: 'x', alcance: alcance(), diario: { acesso: 'ok', dado: { canalId, ultimoDia: null, linhas: [], descartados: 0 } }, longos: ytIds, dm, F, hoje })
    expect(vazio.view!.linhas.find(l => l.chave === 'assistido')).toMatchObject({ valor: null, aindaNaoDa: false, nota: 'ainda não há coleta diária deste canal' })
  })
  it('na tela: nenhum quadradinho nessa linha, só a frase; a linha de não medido de verdade mantém o quadradinho', () => {
    const outro = { id: 'c1', name: 'Leo', own: false }
    const mk = (d: ReturnType<typeof dadoCom>) => buildSoSeuCanal({ a: { id: 'eu', name: 'tnFigueiredo', own: true }, b: outro }, { eu: d })
    const par = { a: { id: 'eu', name: 'tnFigueiredo', own: true }, b: outro } as never
    const { container } = render(<SoSeuCanal pack={{ soSeuCanal: { eu: dadoCom(2) } } as never} par={par} />)
    const li = container.querySelector('li[data-linha="assistido"]')!
    expect(li.querySelector('.obs-ch-nm')).toBeNull()
    expect(li.textContent).toContain('Ainda não dá para dizer: só 2 dias com dado; precisa de 7.')
    expect(mk(dadoCom(2))).toHaveLength(1)
    cleanup()
    const vazio = montarSoSeuCanalDado({ nome: 'x', alcance: alcance(), diario: { acesso: 'ok', dado: { canalId, ultimoDia: null, linhas: [], descartados: 0 } }, longos: ytIds, dm, F, hoje })
    const r2 = render(<SoSeuCanal pack={{ soSeuCanal: { eu: vazio } } as never} par={par} />)
    expect(r2.container.querySelector('li[data-linha="assistido"] .obs-ch-nm[aria-label="não medido"]')).not.toBeNull()
  })
})

describe('item 6: as frases trocadas, por inteiro', () => {
  it('nota de CTR do cartão e da célula do cabeçalho: "taxa de clique", nunca "CTR"', () => {
    expect(FRASE_CTR).toBe('não medido: o YouTube não informou a taxa de clique de algum dia com impressões')
    const v = montarSoSeuCanalDado({
      nome: 'x', alcance: { acesso: 'ok', dado: alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: addDays(hoje, -5), imp: 100, ctr: null }]) },
      diario: { acesso: 'ok', dado: { canalId, ultimoDia: null, linhas: [], descartados: 0 } }, longos: ytIds, dm, F, hoje,
    }).view!
    expect(v.linhas.find(l => l.chave === 'cliques')!.nota).toBe(FRASE_CTR)
    expect(v.linhas.find(l => l.chave === 'taxa')!.nota).toBe(FRASE_CTR)
  })
  it('nenhuma impressão: "nos dias medidos" (não "lidos")', () => {
    const v = montarSoSeuCanalDado({
      nome: 'x', alcance: { acesso: 'ok', dado: alcanceComLinhas(canalId, hoje, [{ ytId: ytIds[0]!, dia: addDays(hoje, -5), imp: 0, ctr: null }]) },
      diario: { acesso: 'negado' }, longos: ytIds, dm, F, hoje,
    }).view!
    expect(v.linhas.find(l => l.chave === 'taxa')!.nota).toBe('nenhuma impressão nos dias medidos, então não há taxa')
  })
  it('"vídeos guardados" vira "lista de vídeos deste canal"', () => {
    expect(foraDosGuardadosFrase(1, String)).toBe('1 vídeo com impressões no relatório não está na lista de vídeos deste canal.')
    expect(foraDosGuardadosFrase(3, String)).toBe('3 vídeos com impressões no relatório não estão na lista de vídeos deste canal.')
  })
  it('nenhum dia medido: "ainda não há dia de alcance medido" onde havia "foi lido"', () => {
    expect(FRASE_NADA_LIDO).toBe('nenhum dia do período foi medido ainda')
  })
})

describe('varredura: o código das telas da A4 não volta a escrever as palavras de sistema (lido, gravou, guardados, CTR, diário como nome de tabela)', () => {
  const SRC = join(__dirname, '../../../src')
  const arq = (p: string) => readFileSync(join(SRC, p), 'utf8')
  const C = 'app/cms/(authed)/youtube/competitors/'
  const ARQUIVOS = [
    C + '_proprio/header-model.ts', C + '_proprio/como-esta-model.ts', C + '_proprio/video-blocos-model.ts', C + '_proprio/video-model.ts',
    C + '_proprio/retencao-model.ts', C + '_proprio/extras.ts', C + '_proprio/videos-model.ts', C + '_proprio/impressoes-model.ts', C + '_proprio/reguas-model.ts',
    C + '_comparar/so-seu-canal-model.ts', 'lib/youtube/observatorio/proprio/vpd.ts', 'lib/youtube/observatorio/proprio/dias.ts',
  ]
  /** Só o código que vira texto: comentários fora. */
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const PROIBIDAS: Array<[RegExp, string]> = [
    [/\bdias? lidos?\b/, '"dia(s) lido(s)": a convenção é "dias medidos"'],
    [/relatório lido/, '"relatório lido": é "relatório" ou "relatório medido"'],
    [/ainda não gravou/, '"não gravou": é "ainda não há coleta diária"'],
    [/vídeos? guardados? deste canal/, '"guardados deste canal": é "na lista de vídeos deste canal"'],
    [/não devolveu o CTR|× CTR|\(CTR\)/, '"CTR" na frase de tela: é "taxa de clique"'],
    [/último dia gravado/, '"dia gravado": é "dia medido"'],
    [/não a lê\b/, '"não a lê": é "não a mostra"'],
    [/reviram trechos/, 'o "porque" causal do % acima de 100'],
    [/estava quando você abr/, '"na ordem em que a lista estava": é "de onde você veio"'],
    [/foi lido ainda|foi lida? ainda/, '"foi lido ainda": é "foi medido ainda"'],
    [/A taxa não é calculada/, 'a taxa "não é calculada": é "Não dá para calcular a taxa"'],
  ]
  it.each(ARQUIVOS)('%s', f => {
    const s = semComentarios(arq(f))
    for (const [re, porque] of PROIBIDAS) expect(re.test(s), `${f}: ${porque}`).toBe(false)
    // "diário" como nome de tabela: a nota de método da aba Retenção ("Dado do diário do YouTube") não estava na tabela da revisão e fica (decisão a levar ao dono)
    if (!f.endsWith('retencao-model.ts')) expect(/do diário\b/.test(s), `${f}: "do diário" é nome de tabela`).toBe(false)
  })
  it('o aviso interno do dia sem relatório (dias.ts) também não diz "lido"', () => {
    expect(semComentarios(arq('lib/youtube/observatorio/proprio/dias.ts'))).not.toMatch(/sem relatório lido/)
  })
})

void FRASE_NEGADO_CARTAO
