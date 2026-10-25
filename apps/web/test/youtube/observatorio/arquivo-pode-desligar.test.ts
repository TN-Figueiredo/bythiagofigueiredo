// @vitest-environment node
/**
 * M3b (lado da forja): o `pode-desligar` (item 149, parte do comando; contrato C11). As contas de prazo (7 dias e 1 segundo,
 * 6 dias e 23 horas) são da função SQL, do lado do site; aqui: a forma da leitura, as frases e que o comando só lê.
 */
import { describe, it, expect } from 'vitest'
import { frasesPodeDesligar, lerPodeDesligar, COMANDO_CONFERIR_B2_COMPLETO } from '@/lib/youtube/observatorio/arquivo/pode-desligar'

describe('lerPodeDesligar: a forma do contrato C11', () => {
  it('tudo em dia: pode desligar', () => {
    expect(frasesPodeDesligar(lerPodeDesligar({ pode: true, faltam: [] }))).toEqual({ codigo: 0, saida: expect.arrayContaining(['PODE DESLIGAR']) })
  })
  it('cada motivo vira uma linha com o que fazer', () => {
    const r = frasesPodeDesligar(lerPodeDesligar({ pode: false, faltam: [
      { motivo: 'automatico_armado', classe: null, tabela: null, mes: null, detalhe: null },
      { motivo: 'mes_nao_recebido', classe: 'serie', tabela: 'competitor_video_daily', mes: '2026-10', detalhe: null },
      { motivo: 'b2_vencido_mes_fora', classe: 'horaria', tabela: 'competitor_video_hourly', mes: '2027-01', detalhe: '7 d 0 h 0 min 1 s' },
    ] }))
    expect(r.codigo).toBe(1)
    expect(r.saida[0]).toContain('desarme')
    expect(r.saida[1]).toContain('serie competitor_video_daily 2026-10')
    expect(r.saida[2]).toContain(COMANDO_CONFERIR_B2_COMPLETO)
    expect(r.saida[3]).toBe('NÃO DESLIGUE AINDA (3 pendências)')
  })
  it.each([
    ['nulo', null],
    ['lista', []],
    ['sem pode', { faltam: [] }],
    ['pode em texto', { pode: 'true', faltam: [] }],
    ['sem faltam', { pode: true }],
    ['motivo desconhecido', { pode: false, faltam: [{ motivo: 'mudanca' }] }],
    ['pode com pendência', { pode: true, faltam: [{ motivo: 'automatico_armado' }] }],
    ['não pode sem pendência', { pode: false, faltam: [] }],
    ['mês em número', { pode: false, faltam: [{ motivo: 'mes_nao_recebido', mes: 202610 }] }],
  ])('%s: nunca "pode desligar"', (_, bruto) => {
    const r = frasesPodeDesligar(lerPodeDesligar(bruto))
    expect(r.codigo).toBe(1)
    expect(r.saida.join('\n')).not.toContain('PODE DESLIGAR')
  })
  // Yannis N7 (2ª rodada): a rota C11 decide 500 contra 200 por `.ok`, e `frasesPodeDesligar` esconde o `ok` atrás de um código 1 que também sai da leitura
  // válida com pendência. Três mutantes (tirar "não pode sem pendência", tirar a validação do motivo, tirar `textoOuNulo(mes)`) sobreviviam porque
  // nenhum teste olhava `.ok`; estes olham, com o `porque`.
  it.each([
    ['não pode sem pendência', { pode: false, faltam: [] }, 'leitura incoerente: não pode desligar e nenhuma pendência'],
    ['pode com pendência', { pode: true, faltam: [{ motivo: 'automatico_armado' }] }, 'leitura incoerente: pode desligar com pendências'],
    ['motivo desconhecido', { pode: false, faltam: [{ motivo: 'mudanca' }] }, 'motivo desconhecido: mudanca'],
    ['mês em número', { pode: false, faltam: [{ motivo: 'mes_nao_recebido', mes: 202610 }] }, 'pendência com campo fora da forma'],
  ])('%s: a leitura é ok:false com o porquê (a rota C11 responde 500, nunca 200)', (_, bruto, porque) => {
    expect(lerPodeDesligar(bruto)).toEqual({ ok: false, porque })
  })
  it('a leitura válida é ok:true (o contraponto dos quatro acima)', () => {
    expect(lerPodeDesligar({ pode: true, faltam: [] })).toEqual({ ok: true, pode: true, faltam: [] })
    expect(lerPodeDesligar({ pode: false, faltam: [{ motivo: 'automatico_armado' }] })).toMatchObject({ ok: true, pode: false })
  })
})
