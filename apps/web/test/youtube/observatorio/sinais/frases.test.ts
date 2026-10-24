// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { textoDoRotulo, textoDoVazio, textoNuncaCalculado, textoDaAcao } from '@/lib/youtube/observatorio/sinais/frases'
import { DEFINICAO_SINAIS_DO_NICHO } from '@/lib/youtube/agenda/definicoes'
import { calculoLigadoNoAmbiente } from '@/lib/youtube/observatorio/sinais/leitura'

// 24/10/2026 em São Paulo (UTC-3)
const sp = (hhmm: string): Date => new Date(`2026-10-24T${hhmm}:00-03:00`)

describe('textoNuncaCalculado', () => {
  it('desligado: a frase do desligado, a qualquer hora', () => {
    for (const h of ['06:59', '07:01', '23:59']) expect(textoNuncaCalculado(sp(h), false)).toBe('O cálculo das sugestões ainda não foi ligado.')
  })
  it('ligado antes das 07:00 (Brasília): hoje', () => {
    expect(textoNuncaCalculado(sp('06:59'), true)).toBe('O 1º cálculo roda hoje depois das 07:00 (Brasília).')
  })
  it('ligado às 07:01 e às 23:59: amanhã, ou na próxima rodada se hoje falhou', () => {
    for (const h of ['07:01', '23:59']) expect(textoNuncaCalculado(sp(h), true)).toBe('O 1º cálculo roda depois das 07:00 de amanhã (Brasília), ou na próxima rodada da agenda se hoje falhou.')
  })
  it('a hora vem da definição da tarefa (7), não está escrita à mão', () => {
    expect(DEFINICAO_SINAIS_DO_NICHO.aPartirDaHoraSP).toBe(7)
  })
})

describe('calculoLigado vem de OBS_SINAIS_NICHO === "on"', () => {
  const antes = process.env.OBS_SINAIS_NICHO
  afterEach(() => { if (antes === undefined) delete process.env.OBS_SINAIS_NICHO; else process.env.OBS_SINAIS_NICHO = antes })
  it('apagando a variável: desligado (o padrão)', () => {
    delete process.env.OBS_SINAIS_NICHO
    expect(calculoLigadoNoAmbiente()).toBe(false)
  })
  it('só o valor exato "on" liga', () => {
    for (const v of ['ON', 'true', '1', '', ' on']) { process.env.OBS_SINAIS_NICHO = v; expect(calculoLigadoNoAmbiente(), v).toBe(false) }
    process.env.OBS_SINAIS_NICHO = 'on'
    expect(calculoLigadoNoAmbiente()).toBe(true)
  })
})

describe('textoDoVazio: cada vazio mostra só o número que a chave trouxe', () => {
  const agora = sp('10:00')
  it('sem a chave, sem número (nunca "undefined" nem "NaN")', () => {
    for (const m of ['sem-historico', 'sync-atrasado', 'sem-terceiro-outlier', 'sem-lugar', 'abaixo-do-minimo', 'sem-grupo', 'tudo-respondido']) {
      expect(textoDoVazio(m, {}, agora, true), m).not.toMatch(/undefined|NaN|null/)
    }
  })
  it('com as chaves', () => {
    expect(textoDoVazio('sync-atrasado', { canais_sem_ritmo: 3, canais_total: 5 }, agora, true)).toContain('3 de 5')
    expect(textoDoVazio('sem-lugar', { outliers_sem_lugar: 4, outliers_total: 6 }, agora, true)).toContain('4 de 6')
    expect(textoDoVazio('tudo-respondido', { respondidos_30d: 2 }, agora, true)).toContain('2 nos últimos 30 dias')
    expect(textoDoVazio('abaixo-do-minimo', { sem_n_minimo: 1, abaixo_do_piso: 2 }, agora, true)).toMatch(/\(1\).*\(2\)/)
  })
  it('sem-grupo se separa por contagem: só 1 canal, já respondidos antes, ou o genérico', () => {
    expect(textoDoVazio('sem-grupo', { canais_com_outlier: 1, outliers_total: 2 }, agora, true)).toMatch(/só em 1 canal/)
    expect(textoDoVazio('sem-grupo', { canais_com_outlier: 2, outliers_total: 3, outliers_ancora: 3 }, agora, true)).toMatch(/já foram respondidos antes/)
    expect(textoDoVazio('sem-grupo', { canais_com_outlier: 2, outliers_total: 3, outliers_ancora: 1 }, agora, true)).toMatch(/nenhum grupo forma um evento/)
  })
  it('nunca-calculado usa a frase do relógio; motivo desconhecido não some em silêncio', () => {
    expect(textoDoVazio('nunca-calculado', {}, sp('06:59'), true)).toBe(textoNuncaCalculado(sp('06:59'), true))
    expect(textoDoVazio('inventado', {}, agora, true)).toMatch(/motivo não foi informado/)
  })
})

describe('rótulos e ações em palavras', () => {
  it('"pode ajudar", nunca "vai ajudar"', () => {
    for (const a of ['titulo_descricao', 'video_novo', 'playlist', 'outra']) { expect(textoDaAcao(a)).toMatch(/pode ajudar/); expect(textoDaAcao(a)).not.toMatch(/vai ajudar/) }
  })
  it('o texto do botão nos 6 casos do mockup (kind obrigatório)', () => {
    expect(textoDoRotulo('abrir-concorrente', 0, 'Japão', 'destino')).toBe('Abrir o vídeo do concorrente')
    expect(textoDoRotulo('abrir-seus', 2, 'Japão', 'destino')).toBe('Abrir seus 2 vídeos sobre Japão')
    expect(textoDoRotulo('abrir-seus', 1, 'Japão', 'destino')).toBe('Abrir seu vídeo sobre Japão')
    expect(textoDoRotulo('abrir-seus', 3, undefined, 'parecido')).toBe('Abrir seus 3 vídeos parecidos')
    expect(textoDoRotulo('abrir-seus', 1, undefined, 'parecido')).toBe('Abrir seu vídeo parecido')
    expect(textoDoRotulo('generico', null, 'Japão', 'destino')).toBe('Abrir seus vídeos')
    expect(textoDoRotulo('abrir-seus', 2, '  ', 'destino')).toBe('Abrir seus 2 vídeos sobre este lugar')
  })
})
