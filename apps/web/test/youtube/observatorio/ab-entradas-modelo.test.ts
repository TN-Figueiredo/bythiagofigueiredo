// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { entradaDoProprio, semDadoDoVideo, semDadoDoCartao, valorAbEntradas, FRASE_SEM_DADO, ROTULO_TESTAR } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'
import type { TestesAbertos, TesteAbertoView } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/testes-abertos'
import type { ProprioVideoView } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/videos-model'

const U = '0b4c1e6a-1111-4222-8333-444455556666'
const t: TesteAbertoView = { id: 't1', estado: 'andamento', href: '/cms/youtube/ab-lab/t1', rotulo: 'Ver teste', frase: 'Teste de thumbnail em andamento desde 18/10.', curto: 'em andamento' }
const ok = (porVideo: Record<string, TesteAbertoView> = {}): TestesAbertos => ({ acesso: 'ok', porVideo })
const base = { podeEditar: true, videoUuid: U, dur: 600, abertos: ok(), semDado: null }

describe('entradaDoProprio', () => {
  it('rótulo único', () => expect(ROTULO_TESTAR).toBe('Testar no A/B Lab'))
  it('reporter: nada', () => expect(entradaDoProprio({ ...base, podeEditar: false })).toBeNull())
  it('Short: nada, sem botão nem frase', () => {
    expect(entradaDoProprio({ ...base, dur: 45 })).toBeNull()
    expect(entradaDoProprio({ ...base, dur: 45, semDado: 'restrito' })).toBeNull()
  })
  it('61 s e duração desconhecida: testar', () => {
    expect(entradaDoProprio({ ...base, dur: 61 })?.tipo).toBe('testar')
    expect(entradaDoProprio({ ...base, dur: null })?.tipo).toBe('testar')
  })
  it('abertos negado: nada', () => expect(entradaDoProprio({ ...base, abertos: { acesso: 'negado' } })).toBeNull())
  it('teste aberto: ver, e vence o sem dado', () => {
    expect(entradaDoProprio({ ...base, abertos: ok({ [U]: t }), semDado: 'restrito' })).toEqual({ tipo: 'ver', href: t.href, rotulo: 'Ver teste', frase: t.frase, curto: 'em andamento' })
  })
  it('teste aberto de outro vídeo não conta', () => {
    expect(entradaDoProprio({ ...base, abertos: ok({ outro: t }) })?.tipo).toBe('testar')
  })
  it('sem dado', () => {
    expect(entradaDoProprio({ ...base, semDado: 'restrito' })).toEqual({ tipo: 'sem-dado', frase: FRASE_SEM_DADO.restrito })
    expect(entradaDoProprio({ ...base, semDado: 'falhou' })).toEqual({ tipo: 'sem-dado', frase: FRASE_SEM_DADO.falhou })
  })
  it('nao_medido mostra o botão (Q-a, padrão)', () => {
    expect(entradaDoProprio({ ...base, semDado: 'nao_medido' })?.tipo).toBe('testar')
  })
  it('abertos erro ou null: testar', () => {
    expect(entradaDoProprio({ ...base, abertos: { acesso: 'erro' } })?.tipo).toBe('testar')
    expect(entradaDoProprio({ ...base, abertos: null })?.tipo).toBe('testar')
  })
  it('testar leva o uuid e o tipo', () => {
    expect(entradaDoProprio({ ...base, tipo: 'title' })).toEqual({ tipo: 'testar', href: `/cms/youtube/ab-lab/new?videoId=${U}&changeType=title` })
    expect(entradaDoProprio(base)).toEqual({ tipo: 'testar', href: `/cms/youtube/ab-lab/new?videoId=${U}` })
  })
  it('frases exatas', () => {
    expect(FRASE_SEM_DADO.restrito).toBe('A leitura deste vídeo é restrita: só quem tem acesso ao Analytics vê os números.')
    expect(FRASE_SEM_DADO.falhou).toBe('A leitura deste vídeo falhou. Recarregue a página para tentar de novo.')
  })
})

describe('semDadoDoVideo', () => {
  it('ok: null, inclusive com ausência nao_medido', () => {
    expect(semDadoDoVideo({ acesso: 'ok', ausencia: null })).toBeNull()
    expect(semDadoDoVideo({ acesso: 'ok', ausencia: 'nao_medido' })).toBeNull()
  })
  it('negado com sem_direito é restrito; sem prova é falhou; erro é falhou', () => {
    expect(semDadoDoVideo({ acesso: 'negado', ausencia: 'restrito' })).toBe('restrito')
    expect(semDadoDoVideo({ acesso: 'negado', ausencia: 'falhou' })).toBe('falhou')
    expect(semDadoDoVideo({ acesso: 'negado', ausencia: null })).toBe('falhou')
    expect(semDadoDoVideo({ acesso: 'erro', ausencia: 'falhou' })).toBe('falhou')
  })
})

describe('semDadoDoCartao', () => {
  const v = (impEstado: ProprioVideoView['impEstado'], semImpressao = false) => ({ impEstado, semImpressao }) as ProprioVideoView
  it('restrito e falhou escondem; nao_medido e zero medido mostram (P3)', () => {
    expect(semDadoDoCartao(v('restrito'))).toBe('restrito')
    expect(semDadoDoCartao(v('falhou'))).toBe('falhou')
    expect(semDadoDoCartao(v('nao_medido'))).toBeNull()
    expect(semDadoDoCartao(v(null, true))).toBeNull()
  })
})

describe('valorAbEntradas', () => {
  it('reporter: null', () => expect(valorAbEntradas({ podeEditar: false, abertos: ok() })).toBeNull())
  it('abertos negado: null (Yannis M5)', () => expect(valorAbEntradas({ podeEditar: true, abertos: { acesso: 'negado' } })).toBeNull())
  it('editor com erro ou ok', () => {
    expect(valorAbEntradas({ podeEditar: true, abertos: { acesso: 'erro' } })).toEqual({ podeEditar: true, abertos: { acesso: 'erro' } })
    expect(valorAbEntradas({ podeEditar: true, abertos: ok() })).toEqual({ podeEditar: true, abertos: ok() })
  })
})
