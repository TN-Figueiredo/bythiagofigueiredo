// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarFaixa, faixaTentando, type Faixa, type FaixaCompleta, type CtxFaixa } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-restauracao-texto'
import type { CampoRestauracao, RestoreStatus } from '@/lib/youtube/ab-restore'

const AGORA = new Date('2026-10-12T08:00:00Z') // 05:00 SP; próximo vigia 10:00 UTC = 07:00 SP
const ULTIMA = '2026-10-11T20:00:00Z' // vigia em dia
const ctx: CtxFaixa = {
  agora: AGORA, rotulo: id => (id === 'vb' ? 'B' : id), noArAntes: 'C', noArDesde: '2026-10-07T08:00:00Z', youtubeId: 'yt123',
  vigiaUltimaExecucao: ULTIMA, podeAdministrar: true, bloqueio: null, inicioDoSim: {},
}
const T0502 = '2026-10-12T04:02:00Z'
const recusa = { status: 403, reason: 'forbidden', chamada: 'videos.update' as const }
function campo(p: Partial<CampoRestauracao>): CampoRestauracao {
  return { estado: 'ok', destino: 'original', em: T0502, forcado: false, escreveu: true, erro: null, attempts: 1, ...p }
}
const falhou = (p: Partial<CampoRestauracao> = {}): RestoreStatus => ({ title: campo({ estado: 'falhou', erro: recusa, ...p }), thumbnail: campo({}) })
function completa(f: Faixa | null): FaixaCompleta {
  if (!f || f.tom === 'ok') throw new Error('esperava faixa completa')
  return f
}
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString()
const textoTodo = (f: FaixaCompleta) => [f.lbl, f.resumo, ...f.linhas.map(l => l.texto), f.ajuda ?? '', f.fine ?? ''].join(' | ')

describe('P4b: frases de nova tentativa', () => {
  it('C: tentativa 2 de 3 com attempts 1 e 07:00 com agora 08:00 UTC', () => {
    const f = completa(montarFaixa(falhou({ attempts: 1 }), ctx))
    expect(f.linhas[0].texto).toBe('O YouTube recusou em 12/10 01:02. Nova tentativa automática por volta das 07:00 (horário de São Paulo), tentativa 2 de 3.')
  })
  it('C às 12:00 UTC → 17:00', () => {
    const f = completa(montarFaixa(falhou(), { ...ctx, agora: new Date('2026-10-12T12:00:00Z'), vigiaUltimaExecucao: '2026-10-12T10:00:00Z' }))
    expect(f.linhas[0].texto).toContain('por volta das 17:00')
  })
  it('attempts 2 → tentativa 3 de 3; cota com attempts igual mantém N', () => {
    expect(completa(montarFaixa(falhou({ attempts: 2 }), ctx)).linhas[0].texto).toContain('tentativa 3 de 3')
    const cota = falhou({ attempts: 1, erro: { status: 403, reason: 'quotaExceeded', chamada: 'videos.update' } })
    expect(completa(montarFaixa(cota, ctx)).linhas[0].texto).toContain('tentativa 2 de 3')
  })
  it('vigia atrasado → "na próxima verificação" e nenhuma hora', () => {
    const f = completa(montarFaixa(falhou(), { ...ctx, vigiaUltimaExecucao: '2026-10-10T00:00:00Z' }))
    expect(f.linhas[0].texto).toContain('na próxima verificação')
    expect(f.linhas[0].texto).not.toMatch(/por volta das|\d\d:\d\d \(/)
    expect(completa(montarFaixa(falhou(), { ...ctx, vigiaUltimaExecucao: null })).linhas[0].texto).toContain('na próxima verificação')
  })
  it('D: em de 47 h → "sem perguntar de novo"; com 49 h → frase de D2', () => {
    const d = (h: number) => falhou({ destino: 'vb', forcado: true, em: horasAtras(h) })
    expect(completa(montarFaixa(d(47), ctx)).linhas[0].texto).toContain('sem perguntar de novo: ela repete a troca que você confirmou.')
    const velha = completa(montarFaixa(d(49), ctx)).linhas[0].texto
    expect(velha).toContain('tentativa 2 de 3')
    expect(velha).not.toContain('sem perguntar de novo')
  })
  it('R-1: forcado, em de 1 h, inicioDoSim de 50 h → frase de D2, não a de D', () => {
    const rs = falhou({ destino: 'vb', forcado: true, em: horasAtras(1) })
    const t = completa(montarFaixa(rs, { ...ctx, inicioDoSim: { title: horasAtras(50) } })).linhas[0].texto
    expect(t).toContain('tentativa 2 de 3')
    expect(t).not.toContain('sem perguntar de novo')
    const dentro = completa(montarFaixa(rs, { ...ctx, inicioDoSim: { title: horasAtras(10) } })).linhas[0].texto
    expect(dentro).toContain('sem perguntar de novo')
  })
  it('falhou sem erro de escrita: frase de A3 e a nova tentativa', () => {
    const t = completa(montarFaixa(falhou({ erro: 'interrompido' }), ctx)).linhas[0].texto
    expect(t).toMatch(/^Sem resposta desde 12\/10 01:02\. Não sabemos se a troca foi feita\. Confira o título no YouTube Studio\. Nova tentativa automática por volta das 07:00 \(horário de São Paulo\), tentativa 2 de 3\.$/)
  })
  it('bloqueio: nenhuma hora e nenhum "tentativa N de 3"; acoes.tentar segue', () => {
    const a = completa(montarFaixa(falhou(), { ...ctx, bloqueio: 'outro_teste' }))
    expect(a.linhas[0].texto).toContain('Sem nova tentativa automática enquanto outro teste estiver em andamento neste vídeo.')
    expect(a.linhas[0].texto).not.toMatch(/por volta|tentativa \d de 3|\d\d:\d\d \(/)
    expect(a.acoes.tentar).toBe(true)
    const p = completa(montarFaixa(falhou(), { ...ctx, bloqueio: 'pausado_variante' }))
    expect(p.linhas[0].texto).toContain('Sem nova tentativa automática enquanto este teste estiver pausado.')
    const sim = completa(montarFaixa(falhou({ destino: 'vb', forcado: true, em: horasAtras(1) }), { ...ctx, bloqueio: 'outro_teste' }))
    expect(sim.linhas[0].texto).not.toMatch(/por volta|sem perguntar/)
  })
})

describe('P4b: desistiu', () => {
  const des = (motivo: string, p: Partial<CampoRestauracao> = {}): RestoreStatus => ({ title: campo({ estado: 'desistiu', motivo, attempts: 3, ...p }), thumbnail: campo({}) })
  it('H: tres_falhas', () => {
    const f = completa(montarFaixa(des('tres_falhas', { erro: recusa }), ctx))
    expect(f).toMatchObject({ tom: 'err', lbl: 'Erro:', fine: null, linkRotulo: 'Abrir no YouTube Studio', linkStudio: 'https://studio.youtube.com/video/yt123/edit' })
    expect(f.resumo).toBe('a restauração falhou 3 vezes e parou. O título no ar ainda é o da variante C.')
    expect(f.linhas[0].texto).toBe('Última recusa do YouTube em 12/10 01:02. Não haverá nova tentativa automática.')
    expect(f.acoes.tentar).toBe(true)
    expect(f.acoes.dispensar).toEqual(['title'])
  })
  it('H só com desistiu/tres_falhas, nunca com falhou attempts 2', () => {
    const f = completa(montarFaixa(falhou({ attempts: 2 }), ctx))
    expect(textoTodo(f)).not.toContain('falhou 3 vezes')
    expect(textoTodo(f)).not.toContain('Não haverá nova tentativa')
  })
  it('antes_da_nova_tentativa', () => {
    const f = completa(montarFaixa(des('antes_da_nova_tentativa'), ctx))
    expect(f).toMatchObject({ tom: 'warn', lbl: 'Sem nova tentativa:', resumo: expect.stringMatching(/^a restauração d[oa] (título|thumbnail) falhou e o Lab não vai tentar de novo\. Confira no YouTube Studio\.$/), fine: null })
    expect(f.linhas[0].texto).toBe('Parou em 12/10 01:02. Não haverá nova tentativa automática.')
    expect(f.linkStudio).not.toBeNull()
    expect(f.acoes.tentar).toBe(true)
  })
  it('N1: destino_invalido → aviso, sem "Tentar agora", sem "vídeo não encontrado"', () => {
    const f = completa(montarFaixa(des('destino_invalido'), ctx))
    expect(f.tom).toBe('warn')
    expect(f.lbl).toBe('Sem nova tentativa:')
    expect(f.resumo).toMatch(/^o Lab não soube para qual versão devolver (o título|a thumbnail)\. Confira no YouTube Studio e corrija se precisar\.$/)
    expect(f.linhas[0].texto).toBe('Parou em 12/10 01:02. Não haverá nova tentativa automática.')
    expect(f.linhas[0].tom).toBe('warn')
    expect(f.linkStudio).not.toBeNull()
    expect(f.acoes.tentar).toBe(false)
    expect(f.acoes.dispensar).toEqual(['title'])
    expect(textoTodo(f)).not.toMatch(/não foi encontrado|Tentar agora/)
  })
  it('desistiu/novo_teste → tentar false, dispensar com o campo', () => {
    const f = completa(montarFaixa(des('novo_teste'), ctx))
    expect(f.acoes).toEqual({ tentar: false, dispensar: ['title'], motivoSemBotao: null })
  })
})

describe('P4b: acoes', () => {
  it('I: destino variante sem admin → acoes vazias e motivoSemBotao', () => {
    const rs = falhou({ destino: 'vb' })
    const f = completa(montarFaixa(rs, { ...ctx, podeAdministrar: false }))
    expect(f.acoes).toEqual({ tentar: false, dispensar: [], motivoSemBotao: 'Só quem administra o site pode tentar de novo ou dispensar este aviso.' })
    expect(completa(montarFaixa(rs, ctx)).acoes).toEqual({ tentar: true, dispensar: ['title'], motivoSemBotao: null })
    // destino original não depende de administrar
    expect(completa(montarFaixa(falhou(), { ...ctx, podeAdministrar: false })).acoes.tentar).toBe(true)
  })
  it('pulado_drift → dispensar [thumbnail], tentar false', () => {
    const rs: RestoreStatus = { title: campo({}), thumbnail: campo({ estado: 'pulado_drift' }) }
    expect(completa(montarFaixa(rs, ctx)).acoes).toEqual({ tentar: false, dispensar: ['thumbnail'], motivoSemBotao: null })
  })
  it('nenhuma faixa da P4b contém "Este aviso ainda não pode ser dispensado."', () => {
    const casos: RestoreStatus[] = [
      falhou(), falhou({ destino: 'vb', forcado: true }),
      { title: campo({ estado: 'desistiu', motivo: 'tres_falhas' }) }, { title: campo({ estado: 'desistiu', motivo: 'video_inexistente' }) },
      { title: campo({ estado: 'desistiu', motivo: 'novo_teste' }) }, { title: campo({ estado: 'desistiu', motivo: 'destino_invalido' }) },
      { title: campo({}), thumbnail: campo({ estado: 'pulado_drift' }) },
    ]
    for (const rs of casos) {
      const f = completa(montarFaixa(rs, ctx))
      expect(f.fine).toBeNull()
      expect(textoTodo(f)).not.toContain('Este aviso ainda não pode ser dispensado.')
    }
  })
  it('pulado_teste_youtube: sem botão, texto neutro, não quebra', () => {
    const rs: RestoreStatus = { title: campo({ estado: 'falhou', erro: recusa }), thumbnail: campo({ estado: 'pulado_teste_youtube' }) }
    const f = completa(montarFaixa(rs, ctx))
    expect(f.acoes.dispensar).toEqual(['title'])
    const so = completa(montarFaixa({ thumbnail: campo({ estado: 'pulado_teste_youtube' }) }, ctx))
    expect(so.acoes).toEqual({ tentar: false, dispensar: [], motivoSemBotao: null })
    expect(textoTodo(so)).not.toMatch(/undefined|null|NaN|Sem resposta/)
  })
})

describe('P4b: faixaTentando', () => {
  it('C → tom busy e "Voltando ao original…"', () => {
    const f = completa(faixaTentando(falhou(), ctx))
    expect(f.tom).toBe('busy')
    expect(f.lbl).toBe('Voltando ao original…')
    expect(f.resumo).toBe('Título e thumbnail estão sendo trocados no YouTube.')
    expect(f.linhas[0].texto).toBe('Trocando desde 12/10 05:00.')
    expect(f.acoes.tentar).toBe(false)
  })
  it('sem campo pendente → faixa normal', () => {
    const rs: RestoreStatus = { title: campo({}) }
    expect(faixaTentando(rs, ctx)).toEqual(montarFaixa(rs, ctx))
  })
})
