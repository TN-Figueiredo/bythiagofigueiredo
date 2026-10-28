// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fraseDoMesFora } from '@/lib/youtube/observatorio/arquivo-mensal/frases-remocao'

const COMUM = 'Enquanto isso não dá para remover canal nem apagar vídeo.'
describe('M6a T13: D7 e D7r (mês fora das telas)', () => {
  const um = { meses: 1 as const, recusadoNoClique: false, nomes: ['2026-10-01'], liberarAPartir: '2026-10-24' }
  it('D7 com data, papel e link só depois da data', () => {
    expect(fraseDoMesFora({ ...um, podeAdministrar: true, hojeSP: '2026-10-20' })).toEqual({
      negrito: 'Outubro de 2026 saiu das telas e o espaço dele ainda não foi liberado.',
      resto: `${COMUM} O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta.`,
      linkArquivo: false,
      info: 'Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer. “Exportar” continua permitido.',
    })
    expect(fraseDoMesFora({ ...um, podeAdministrar: true, hojeSP: '2026-10-24' })).toMatchObject({ resto: `${COMUM} Você já pode liberar o espaço ou trazer o mês de volta.`, linkArquivo: true })
    expect(fraseDoMesFora({ ...um, podeAdministrar: false, hojeSP: '2026-10-20' }).resto)
      .toBe(`${COMUM} O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta. Quem só edita o site: peça a quem o administra.`)
    expect(fraseDoMesFora({ ...um, podeAdministrar: false, hojeSP: '2026-10-25' }))
      .toMatchObject({ resto: `${COMUM} O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site.`, linkArquivo: false })
  })
  it('dois meses (mesmo ano e anos diferentes) e D7r', () => {
    const dois = { meses: 2 as const, recusadoNoClique: true, nomes: ['2026-10-01', '2026-11-01'], liberarAPartir: '2026-10-24', podeAdministrar: true, hojeSP: '2026-10-20' }
    const f7 = fraseDoMesFora(dois)
    expect(f7.negrito).toBe('O mês saiu das telas enquanto este diálogo estava aberto. Outubro e novembro de 2026 saíram das telas e o espaço deles ainda não foi liberado.')
    expect(f7.resto.startsWith(`${COMUM} Nada foi removido. O espaço só pode`)).toBe(true)
    expect(fraseDoMesFora({ ...dois, recusadoNoClique: false, nomes: ['2026-12-01', '2027-01-01'] }).negrito)
      .toBe('Dezembro de 2026 e janeiro de 2027 saíram das telas e o espaço deles ainda não foi liberado.')
  })
  it('sem os campos novos: forma curta, sem papel e sem link; sem nomes: não chuta mês', () => {
    expect(fraseDoMesFora({ meses: 1, recusadoNoClique: true })).toEqual({
      negrito: 'O mês saiu das telas enquanto este diálogo estava aberto. Um mês saiu das telas e o espaço dele ainda não foi liberado.',
      resto: `${COMUM} Nada foi removido.`, linkArquivo: false, info: expect.any(String),
    })
    expect(fraseDoMesFora({ meses: 2, recusadoNoClique: false }).negrito).toBe('Dois meses saíram das telas e o espaço deles ainda não foi liberado.')
  })
})
