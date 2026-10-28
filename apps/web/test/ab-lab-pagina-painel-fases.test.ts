// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  TETO_LEITURAS, TIPOS_DE_EVENTO, TIPOS_DE_FASE, faseDaFrase, faseInicial, painelVivo, reduzir, seqParaEnviar, travada,
  type ContextoFases, type EventoPainel, type FasePainel,
} from '@/lib/youtube/ab-lab-pagina/painel-fases'
import { montarPainelEscolha, fraseDoPainel } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { ResultadoConferir, ResultadoEscolha } from '@/lib/youtube/ab-acao-saida'
import type { NoArConfirmado } from '@/lib/youtube/ab-no-ar'

const CTX: ContextoFases = { noArId: 'vb', restoreSeq: 3 }
const noAr = (id: string, letra: 'A' | 'B' | 'C'): NoArConfirmado => ({ tipo: 'confirmado', varianteId: id, letra, desde: '2026-10-27T15:00:00.000Z' })

const FASES: Record<(typeof TIPOS_DE_FASE)[number], FasePainel> = {
  escolha: { tipo: 'escolha', selId: 'vc', aviso: null, restoreSeq: null },
  escrevendo: { tipo: 'escrevendo', selId: 'vc', anteriorId: 'vb', envioId: 7, demorando: false, forcar: false, seqEnviado: 3, semEscrita: false },
  conferindo: { tipo: 'conferindo', selId: 'vc', anteriorId: 'vb', envioId: 7, leituras: 0, seqEnviado: 3 },
  no_ar: { tipo: 'no_ar', selId: 'vc', noAr: noAr('vc', 'C'), restoreSeq: 4, hoje: false },
  recusou: { tipo: 'recusou', selId: 'vc', porque: 'youtube', noAr: noAr('vb', 'B'), entrou: [], restoreSeq: 4, conferido: false, erro: 'x' },
  sem_rede: { tipo: 'sem_rede', selId: 'vc', anteriorId: 'vb', envioId: 7, motivo: 'sem_conexao', seqEnviado: 3 },
  guardado: { tipo: 'guardado', selId: 'va', restoreSeq: 4 },
  confirmar: { tipo: 'confirmar', selId: 'vc', campos: [{ campo: 'title', valor_atual: 'x' }], restoreSeq: null },
  erro: { tipo: 'erro', selId: 'vc', texto: 'x', recarregar: false },
}
const EVENTOS: Record<(typeof TIPOS_DE_EVENTO)[number], EventoPainel> = {
  marcar: { tipo: 'marcar', varianteId: 'vb' },
  enviar: { tipo: 'enviar', envioId: 8 },
  quinze_s: { tipo: 'quinze_s' },
  resposta: { tipo: 'resposta', envioId: 7, r: { ok: true, resultado: 'no_ar', noAr: noAr('vc', 'C'), restoreSeq: 4 } },
  sem_resposta_45s: { tipo: 'sem_resposta_45s' },
  falha_rede: { tipo: 'falha_rede' },
  sessao_expirou: { tipo: 'sessao_expirou' },
  conferido: { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('vc', 'C'), restoreSeq: 4, fonte: 'registro' } },
  conferir_15s: { tipo: 'conferir_15s' },
  voltar: { tipo: 'voltar' },
}

// Tabela inteira fase × evento: o tipo da fase que sai. '=' = continua na mesma fase.
const TABELA: Record<(typeof TIPOS_DE_FASE)[number], Record<(typeof TIPOS_DE_EVENTO)[number], string>> = {
  //            marcar    enviar      quinze_s  resposta  sem_resposta_45s falha_rede  sessao_expirou conferido  conferir_15s voltar
  escolha:    { marcar: '=', enviar: 'escrevendo', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: '=' },
  escrevendo: { marcar: '=', enviar: '=', quinze_s: '=', resposta: 'no_ar', sem_resposta_45s: 'conferindo', falha_rede: 'conferindo', sessao_expirou: 'erro', conferido: '=', conferir_15s: '=', voltar: '=' },
  conferindo: { marcar: '=', enviar: '=', quinze_s: '=', resposta: 'no_ar', sem_resposta_45s: 'sem_rede', falha_rede: '=', sessao_expirou: 'erro', conferido: 'no_ar', conferir_15s: 'sem_rede', voltar: '=' },
  no_ar:      { marcar: 'escolha', enviar: '=', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: '=' },
  recusou:    { marcar: '=', enviar: 'escrevendo', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: '=' },
  sem_rede:   { marcar: '=', enviar: '=', quinze_s: '=', resposta: 'no_ar', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: 'erro', conferido: '=', conferir_15s: '=', voltar: '=' },
  guardado:   { marcar: '=', enviar: '=', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: '=' },
  confirmar:  { marcar: '=', enviar: 'escrevendo', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: 'escolha' },
  erro:       { marcar: 'escolha', enviar: 'escrevendo', quinze_s: '=', resposta: '=', sem_resposta_45s: '=', falha_rede: '=', sessao_expirou: '=', conferido: '=', conferir_15s: '=', voltar: '=' },
}

describe('M7b T9: redutor das fases do painel', () => {
  for (const fk of TIPOS_DE_FASE) for (const ek of TIPOS_DE_EVENTO) {
    it(`${fk} + ${ek}`, () => {
      const out = reduzir(FASES[fk], EVENTOS[ek], CTX)
      const esperado = TABELA[fk][ek]
      expect(out.tipo).toBe(esperado === '=' ? fk : esperado)
    })
  }

  it('teste-chave: nenhum caminho sai de `conferindo` para `escrevendo` sem um clique do dono', () => {
    const conferidos: ResultadoConferir[] = [
      { ok: true, estado: 'escrevendo' }, { ok: true, estado: 'lido', noAr: noAr('vb', 'B'), restoreSeq: 4, fonte: 'youtube' },
      { ok: true, estado: 'nao_propagou', noAr: noAr('vb', 'B'), titulo: 'conferido' }, { ok: true, estado: 'lido_misto', porCampo: { title: 'B', thumbnail: 'C' }, restoreSeq: 4 },
      { ok: true, estado: 'nenhuma_versao', restoreSeq: 4 }, { ok: false, estado: 'sem_leitura', error: 'x' },
      { ok: false, estado: 'sem_permissao', error: 'x' }, { ok: false, estado: 'ja_encerrado', error: 'x' },
    ]
    const respostas: ResultadoEscolha[] = [
      { ok: true, resultado: 'no_ar', noAr: noAr('vc', 'C'), restoreSeq: 4 }, { ok: true, resultado: 'guardado', restoreSeq: 4 },
      { ok: true, resultado: 'precisa_confirmar', campos: [] }, { ok: false, resultado: 'incerto', restoreSeq: null },
      { ok: false, resultado: 'recusou', porque: 'drift', noAr: noAr('vb', 'B'), entrou: [], restoreSeq: 4, error: 'x' },
      { ok: false, resultado: 'mudou', error: 'x' }, { ok: false, resultado: 'erro', error: 'x' },
    ]
    const todos: EventoPainel[] = [
      ...Object.values(EVENTOS), ...conferidos.map(r => ({ tipo: 'conferido', r }) as EventoPainel),
      ...respostas.map(r => ({ tipo: 'resposta', envioId: 7, r }) as EventoPainel), { tipo: 'enviar', envioId: 9, forcar: true },
    ]
    for (const ev of todos) for (const ini of [FASES.conferindo, FASES.sem_rede]) {
      let f: FasePainel = ini
      for (let i = 0; i < 6; i++) {
        f = reduzir(f, ev, CTX)
        expect(f.tipo).not.toBe('escrevendo')
      }
    }
  })

  it('falha_rede em escrevendo vai a conferindo, nunca a erro', () => {
    const f = reduzir(FASES.escrevendo, { tipo: 'falha_rede' }, CTX)
    expect(f.tipo).toBe('conferindo')
  })

  it('incerto → conferindo', () => {
    const f = reduzir(FASES.escrevendo, { tipo: 'resposta', envioId: 7, r: { ok: false, resultado: 'incerto', restoreSeq: 5 } }, CTX)
    expect(f.tipo).toBe('conferindo')
  })

  it('conferência: igual à escolhida → no_ar (hoje); à anterior → recusou conferido; a uma terceira → recusou com "No ar agora: X"', () => {
    const c = FASES.conferindo
    const a = reduzir(c, { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('vc', 'C'), restoreSeq: 9, fonte: 'registro' } }, CTX)
    expect(a).toMatchObject({ tipo: 'no_ar', hoje: true, restoreSeq: 9 })
    const b = reduzir(c, { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('vb', 'B'), restoreSeq: 9, fonte: 'youtube' } }, CTX)
    expect(b).toMatchObject({ tipo: 'recusou', conferido: true, restoreSeq: 9 })
    const t = reduzir(c, { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('va', 'A'), restoreSeq: 9, fonte: 'youtube' } }, CTX)
    expect(t).toMatchObject({ tipo: 'recusou', conferido: true, noAr: { varianteId: 'va', letra: 'A' } })
  })

  it('Yannis I1: achada só no YouTube (fonte youtube) → escolha com aviso nao_registrado e o seq do servidor; no registro → no_ar', () => {
    const y = reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('vc', 'C'), restoreSeq: 9, fonte: 'youtube' } }, CTX)
    expect(y).toMatchObject({ tipo: 'escolha', selId: 'vc', aviso: 'nao_registrado', restoreSeq: 9 })
    const r = reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: true, estado: 'lido', noAr: noAr('vc', 'C'), restoreSeq: 9, fonte: 'registro' } }, CTX)
    expect(r.tipo).toBe('no_ar')
    const p = montarPainelEscolha({
      testId: 't', nomeVideo: 'v', tipo: 'title', restoreSeq: 3, podeAdministrar: true, sugeridaId: 'vb', noAr: noAr('vb', 'B'), escolha: null,
      variantes: [{ id: 'va', letra: 'A', original: true, titulo: 'a', miniatura: null, ctr: null }, { id: 'vb', letra: 'B', original: false, titulo: 'b', miniatura: null, ctr: null }, { id: 'vc', letra: 'C', original: false, titulo: 'c', miniatura: null, ctr: null }],
      originalGuardada: { titulo: true, miniatura: true },
    })
    expect(seqParaEnviar(y, p)).toBe(9)
  })

  it('Yannis M1: recusou(6) → enviar → precisa_confirmar leva o seq 6 ao "mesmo assim" (e ao voltar)', () => {
    const p = montarPainelEscolha({
      testId: 't', nomeVideo: 'v', tipo: 'title', restoreSeq: 5, podeAdministrar: true, sugeridaId: 'vb', noAr: noAr('vb', 'B'), escolha: null,
      variantes: [{ id: 'va', letra: 'A', original: true, titulo: 'a', miniatura: null, ctr: null }, { id: 'vb', letra: 'B', original: false, titulo: 'b', miniatura: null, ctr: null }, { id: 'vc', letra: 'C', original: false, titulo: 'c', miniatura: null, ctr: null }],
      originalGuardada: { titulo: true, miniatura: true },
    })
    const recusou: FasePainel = { tipo: 'recusou', selId: 'vc', porque: 'youtube', noAr: noAr('vb', 'B'), entrou: [], restoreSeq: 6, conferido: false, erro: 'x' }
    const esc = reduzir(recusou, { tipo: 'enviar', envioId: 1 }, { noArId: 'vb', restoreSeq: 6 })
    const conf = reduzir(esc, { tipo: 'resposta', envioId: 1, r: { ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'x' }] } }, CTX)
    expect(conf).toMatchObject({ tipo: 'confirmar', restoreSeq: 6 })
    expect(seqParaEnviar(conf, p)).toBe(6)
    expect(seqParaEnviar(reduzir(conf, { tipo: 'voltar' }, CTX), p)).toBe(6)
  })

  it('Gio G3: falha de rede num "Manter" (sem escrita) vira erro "tentar de novo"; fora disso segue para a conferência', () => {
    const e = reduzir(FASES.recusou, { tipo: 'enviar', envioId: 1, semEscrita: true }, CTX)
    expect(reduzir(e, { tipo: 'falha_rede' }, CTX)).toMatchObject({ tipo: 'erro', modo: 'sem_escrita', recarregar: false, selId: 'vc' })
    const w = reduzir(FASES.recusou, { tipo: 'enviar', envioId: 1 }, CTX)
    expect(reduzir(w, { tipo: 'falha_rede' }, CTX).tipo).toBe('conferindo')
  })

  it('Gio G2: sessao_expirou em voo vira erro modo sessao (nunca "privado ou apagado")', () => {
    for (const base of [FASES.escrevendo, FASES.conferindo, FASES.sem_rede]) expect(reduzir(base, { tipo: 'sessao_expirou' }, CTX)).toMatchObject({ tipo: 'erro', modo: 'sessao' })
  })

  it('nao_propagou → sem_rede (nunca recusou); lido_misto → recusou misto (nunca no_ar)', () => {
    expect(reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: true, estado: 'nao_propagou', noAr: noAr('vb', 'B'), titulo: 'conferido' } }, CTX)).toMatchObject({ tipo: 'sem_rede', motivo: 'nao_propagou' })
    const m = reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: true, estado: 'lido_misto', porCampo: { title: 'C', thumbnail: 'B' }, restoreSeq: 6 } }, CTX)
    expect(m).toMatchObject({ tipo: 'recusou', restoreSeq: 6, noAr: { tipo: 'misto', porCampo: { title: 'C', thumbnail: 'B' } } })
  })

  it('nenhuma_versao → escolha com aviso e o seq novo; sem_leitura → sem_rede; ja_encerrado/sem_permissao → erro', () => {
    expect(reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: true, estado: 'nenhuma_versao', restoreSeq: 6 } }, CTX)).toMatchObject({ tipo: 'escolha', aviso: 'nenhuma_versao', restoreSeq: 6 })
    expect(reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: false, estado: 'sem_leitura', error: 'x' } }, CTX)).toMatchObject({ tipo: 'sem_rede', motivo: 'sem_leitura' })
    expect(reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: false, estado: 'ja_encerrado', error: 'x' } }, CTX).tipo).toBe('erro')
    expect(reduzir(FASES.conferindo, { tipo: 'conferido', r: { ok: false, estado: 'sem_permissao', error: 'x' } }, CTX).tipo).toBe('erro')
  })

  it('conferência `escrevendo` relê até o teto de 5 leituras e então vai a sem_rede "demorando"', () => {
    let f: FasePainel = FASES.conferindo
    const ev: EventoPainel = { tipo: 'conferido', r: { ok: true, estado: 'escrevendo' } }
    for (let i = 1; i < TETO_LEITURAS; i++) { f = reduzir(f, ev, CTX); expect(f).toMatchObject({ tipo: 'conferindo', leituras: i }) }
    f = reduzir(f, ev, CTX)
    expect(f).toMatchObject({ tipo: 'sem_rede', motivo: 'demorando' })
    expect(reduzir(FASES.conferindo, { tipo: 'sem_resposta_45s' }, CTX)).toMatchObject({ tipo: 'sem_rede', motivo: 'demorando' })
  })

  it('resposta tardia: o envioId corrente vence a conferência (conferindo e sem_rede); outro envioId é ignorado', () => {
    const rec: ResultadoEscolha = { ok: false, resultado: 'recusou', porque: 'drift', noAr: noAr('vb', 'B'), entrou: [], restoreSeq: 8, error: 'x' }
    for (const base of [FASES.conferindo, FASES.sem_rede]) {
      expect(reduzir(base, { tipo: 'resposta', envioId: 7, r: rec }, CTX)).toMatchObject({ tipo: 'recusou', porque: 'drift', restoreSeq: 8 })
      expect(reduzir(base, { tipo: 'resposta', envioId: 6, r: rec }, CTX)).toBe(base)
    }
    // um `incerto` tardio não traz a tela de volta à conferência
    expect(reduzir(FASES.sem_rede, { tipo: 'resposta', envioId: 7, r: { ok: false, resultado: 'incerto', restoreSeq: null } }, CTX)).toBe(FASES.sem_rede)
  })

  it('"Tentar de novo" leva o restoreSeq novo; antes, o do painel', () => {
    const p = montarPainelEscolha({
      testId: 't', nomeVideo: 'v', tipo: 'title', restoreSeq: 3, podeAdministrar: true, sugeridaId: 'vb', noAr: noAr('vb', 'B'), escolha: null,
      originalGuardada: { titulo: true, miniatura: true },
      variantes: [{ id: 'va', letra: 'A', original: true, titulo: 'a', miniatura: null, ctr: null }, { id: 'vb', letra: 'B', original: false, titulo: 'b', miniatura: null, ctr: null }, { id: 'vc', letra: 'C', original: false, titulo: 'c', miniatura: null, ctr: null }],
    })
    expect(seqParaEnviar(faseInicial(p), p)).toBe(3)
    expect(seqParaEnviar(FASES.recusou, p)).toBe(4)
    const vivo = painelVivo(p, FASES.no_ar, '2026-10-27T18:00:00.000Z')
    expect(vivo.restoreSeq).toBe(4)
    expect(vivo.noArId).toBe('vc')
    expect(fraseDoPainel(vivo)).toBe('Você deixou a versão C no ar desde 27/10. O teste sugeria a B.')
    expect(vivo.opcoes.find(o => o.id === 'vc')!.selos).toEqual(['no_ar', 'escolhida'])
  })

  it('travada e faseDaFrase cobrem todas as fases', () => {
    expect(TIPOS_DE_FASE.filter(t => travada(FASES[t]))).toEqual(['escrevendo', 'conferindo', 'sem_rede', 'guardado', 'confirmar'])
    expect(TIPOS_DE_FASE.map(t => faseDaFrase(FASES[t]))).toEqual(['normal', 'escrevendo', 'conferindo', 'normal', 'normal', 'sem_rede', 'guardado', 'normal', 'normal'])
  })

  it('"enviar" fixa a versão anterior do contexto e o forcar', () => {
    expect(reduzir(FASES.escolha, { tipo: 'enviar', envioId: 8, forcar: true }, CTX)).toMatchObject({ tipo: 'escrevendo', anteriorId: 'vb', envioId: 8, forcar: true })
    expect(reduzir({ tipo: 'escolha', selId: null, aviso: null, restoreSeq: null }, { tipo: 'enviar', envioId: 8 }, CTX).tipo).toBe('escolha')
  })
})
