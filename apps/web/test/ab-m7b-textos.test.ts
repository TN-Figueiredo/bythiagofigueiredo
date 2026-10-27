// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MSG_RECUSA } from '@/lib/youtube/ab-acao-saida'
import { detalheDaRecusa, RECUSA_SEM_RETENTATIVA, tituloDaRecusa, corpoDrift } from '@/lib/youtube/ab-lab-pagina/painel-textos'

describe('M7b T7a: textos do Logan', () => {
  it('MSG_RECUSA usa o texto do Logan e nunca "variante" nem "thumbnail"', () => {
    for (const t of Object.values(MSG_RECUSA)) expect(t).not.toMatch(/variante|thumbnail/i)
    expect(MSG_RECUSA.drift).toBe('O vídeo foi alterado no YouTube depois do teste. Nada foi trocado.')
    expect(MSG_RECUSA.sem_tempo).toContain('A troca demorou demais')
  })
  it('detalhe com letras', () => {
    expect(detalheDaRecusa('youtube', { S: 'B', X: 'C' })).toBe('O YouTube recusou a troca e a versão B continua no ar.')
    expect(detalheDaRecusa('arquivo_indisponivel', { S: 'B', X: 'C' })).toBe('O arquivo da miniatura C não está mais disponível. Nada foi trocado.')
    expect(tituloDaRecusa('C')).toBe('Não consegui deixar a C no ar.')
  })
  it('só Fechar quando repetir não resolve', () => {
    expect([...RECUSA_SEM_RETENTATIVA].sort()).toEqual(['arquivo_indisponivel', 'sem_original'])
  })
  it('drift: concordância de título e miniatura', () => {
    expect(corpoDrift('título', 'C')).toContain('o título foi alterado')
    expect(corpoDrift('miniatura', 'C')).toContain('a miniatura foi alterada')
  })
})
