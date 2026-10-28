import { describe, it, expect } from 'vitest'
import {
  seloDoTeste, freioDoEncerrar, contarDiasMedidos, contarDiasAguardando, fraseDaPausa, fraseDaFaixaDePausa, textoDoDialogoDePausa, linhaFicouNoAr,
} from '../../src/app/cms/(authed)/youtube/ab-lab/_components/cabecalho-do-teste'
import type { RestoreStatus } from '../../src/lib/youtube/ab-restore'
import type { DiaDaFaixa } from '../../src/lib/youtube/ab-gravacao/placar'

const campo = (estado: 'ok' | 'falhou', destino = 'original') =>
  ({ estado, destino, em: '2026-10-25T19:40:00Z', forcado: false, escreveu: true, erro: null, attempts: 1 }) as const
const okTitle: RestoreStatus = { title: campo('ok') }
const okThumb: RestoreStatus = { thumbnail: campo('ok') }

describe('seloDoTeste', () => {
  it('rodando com dia', () => expect(seloDoTeste({ status: 'active', dayOf: 2, durationDays: 14 }).texto).toBe('Rodando · dia 3 de 14'))
  it('prazo vencido', () => expect(seloDoTeste({ status: 'active', dayOf: 20, durationDays: 14 }).texto).toBe('Rodando · dia 20 de 20'))
  it('dia vazio sem separador', () => {
    expect(seloDoTeste({ status: 'active', dayOf: 0, durationDays: 0 }).texto).toBe('Rodando')
    expect(seloDoTeste({ status: 'paused', dayOf: 0, durationDays: 0 }).texto).toBe('Pausado')
  })
  it('pausado', () => expect(seloDoTeste({ status: 'paused', dayOf: 4, durationDays: 14 })).toEqual({ tom: 'pausado', texto: 'Pausado · dia 5 de 14' }))
  it('escrevendo', () => expect(seloDoTeste({ status: 'active', dayOf: 4, durationDays: 14, escrevendo: true })).toEqual({ tom: 'escrevendo', texto: 'Escrevendo no YouTube… · dia 5 de 14' }))
  it('concluido tem prioridade', () => expect(seloDoTeste({ status: 'completed', dayOf: 4, durationDays: 14, concluidoEm: '12/10', escrevendo: true })).toEqual({ tom: 'concluido', texto: 'Concluído em 12/10' }))
  it('nao iniciado', () => expect(seloDoTeste({ status: 'draft', dayOf: 0, durationDays: 14, naoIniciado: true })).toEqual({ tom: 'nao_iniciado', texto: 'Teste do Lab não iniciado' }))
})

describe('freioDoEncerrar', () => {
  it('completo com prazo vencido', () => expect(freioDoEncerrar({ dayOf: 20, durationDays: 14, medidos: 20, aguardando: 0 }).tipo).toBe('completo'))
  it('completo texto', () => expect(freioDoEncerrar({ dayOf: 20, durationDays: 14, medidos: 20, aguardando: 0 }).texto).toBe('Todos os 20 dias foram medidos.'))
  it('resultado ainda não saiu: acrescenta o aviso de esperar', () => expect(freioDoEncerrar({ dayOf: 14, durationDays: 14, medidos: 12, aguardando: 2, resultadoPendente: true }).texto).toBe('O prazo terminou: 12 dos 14 dias medidos, 2 aguardando o YouTube. Esperar até amanhã calcula o resultado; encerrar agora, não.'))
  it('resultado pendente não muda o freio quando todos os dias foram medidos', () => expect(freioDoEncerrar({ dayOf: 14, durationDays: 14, medidos: 14, resultadoPendente: true }).texto).toBe('Todos os 14 dias foram medidos.'))
  it('prazo completo com dias aguardando (D3)', () => expect(freioDoEncerrar({ dayOf: 14, durationDays: 14, medidos: 12, aguardando: 2 })).toEqual({ tipo: 'completo', texto: 'O prazo terminou: 12 dos 14 dias medidos, 2 aguardando o YouTube.' }))
  it('medidos acima do total não passa do total', () => expect(freioDoEncerrar({ dayOf: 5, durationDays: 14, medidos: 20, aguardando: 0 }).texto).toBe('Faltam 8 dias dos 14. Encerrar agora usa só os 14 dias já medidos.'))
  it('falta 1 (g3)', () => expect(freioDoEncerrar({ dayOf: 12, durationDays: 14, medidos: 12 })).toEqual({ tipo: 'falta_1', texto: 'Falta 1 dia.' }))
  it('faltam (g2)', () => expect(freioDoEncerrar({ dayOf: 5, durationDays: 14, medidos: 5 })).toEqual({ tipo: 'faltam', texto: 'Faltam 8 dias dos 14. Encerrar agora usa só os 5 dias já medidos.' }))
  it('sem leitura (g1)', () => expect(freioDoEncerrar({ dayOf: 1, durationDays: 14, medidos: 0 })).toEqual({ tipo: 'sem_leitura', texto: 'Ainda não há leitura. Encerrar agora não calcula resultado.' }))
})

describe('contarDiasMedidos', () => {
  it('conta medido e zero_medido', () => {
    const d = (estado: string) => ({ day_pt: 'x', variante: null, estado, impressoes: null, ctr: null, motivo: null }) as unknown as DiaDaFaixa
    expect(contarDiasMedidos([d('medido'), d('zero_medido'), d('fora_do_placar')])).toBe(2)
    expect(contarDiasMedidos(undefined)).toBe(0)
  })
})

describe('fraseDaPausa', () => {
  it('title ok', () => expect(fraseDaPausa('title', okTitle)).toBe('O título original foi restaurado e nenhum dia novo entra no placar.'))
  it('thumbnail ok', () => expect(fraseDaPausa('thumbnail', okThumb)).toBe('A thumbnail original foi restaurada e nenhum dia novo entra no placar.'))
  it('combo ok', () => expect(fraseDaPausa('combo', { ...okTitle, ...okThumb })).toBe('O título e a thumbnail originais foram restaurados e nenhum dia novo entra no placar.'))
  it('combo com um só campo ok', () => expect(fraseDaPausa('combo', okTitle)).toBe('Nenhum dia novo entra no placar.'))
  it('falhou', () => expect(fraseDaPausa('title', { title: campo('falhou') })).toBe('Nenhum dia novo entra no placar.'))
  it('null', () => expect(fraseDaPausa('title', null)).toBe('Nenhum dia novo entra no placar.'))
  it('destino não original', () => expect(fraseDaPausa('title', { title: campo('ok', 'a1b2-uuid') })).toBe('Nenhum dia novo entra no placar.'))
})

describe('fraseDaFaixaDePausa', () => {
  it('com data', () => expect(fraseDaFaixaDePausa('thumbnail', okThumb, '2026-10-25T19:40:00Z')).toBe('Você pausou em 25/10 às 16:40. A thumbnail original foi restaurada e nenhum dia novo entra no placar.'))
  it('sem data', () => {
    expect(fraseDaFaixaDePausa('thumbnail', okThumb, null)).toBe('A thumbnail original foi restaurada e nenhum dia novo entra no placar.')
    expect(fraseDaFaixaDePausa('title', null, 'lixo')).toBe('Nenhum dia novo entra no placar.')
  })
})

describe('textoDoDialogoDePausa', () => {
  it('por tipo', () => {
    expect(textoDoDialogoDePausa('title')).toBe('Pausar vai restaurar o título original imediatamente.')
    expect(textoDoDialogoDePausa('thumbnail')).toBe('Pausar vai restaurar a miniatura original imediatamente.')
    expect(textoDoDialogoDePausa('combo')).toBe('Pausar vai restaurar o título e a miniatura originais imediatamente.')
  })
})

describe('linhaFicouNoAr', () => {
  it('sem letra', () => { expect(linhaFicouNoAr(null)).toBeNull(); expect(linhaFicouNoAr({ letra: null })).toBeNull() })
  it('com e sem data', () => {
    expect(linhaFicouNoAr({ letra: 'B' })).toBe('Ficou no ar: a versão B.')
    expect(linhaFicouNoAr({ letra: 'B' }, '12/10')).toBe('O teste terminou em 12/10. Ficou no ar: a versão B.')
  })
})
