// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { placarDoTeste } from '@/lib/youtube/ab-gravacao/placar'
import { casoDoPlacar, faixaDoPlacar, fraseDoPlacar } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-texto'

const AGORA = new Date('2026-10-24T10:00:00Z')
const H = 3_600_000
const ha = (h: number) => new Date(AGORA.getTime() - h * H).toISOString()
const semLinhas = (inicio: string, fim: string | null, status: string) =>
  placarDoTeste({ dias: [], variantes: [{ variant_id: 'A' }, { variant_id: 'B' }], regra: 'v1', agora: AGORA, inicio, fim, status })

describe('Phil 24/10: atrasado em teste encerrado', () => {
  it('(a) viveu 20 h, arquivado, sem linhas: não atrasado, sem_dia_fechado', () => {
    const p = semLinhas(ha(96), ha(76), 'archived')
    expect(p.atrasado).toBe(false)
    expect(casoDoPlacar(p, 'archived')).toBe('sem_dia_fechado')
    expect(faixaDoPlacar(p, 'archived')).toBeNull()
    expect(fraseDoPlacar(p, 'archived').principal).toContain('terminou antes')
  })
  it('(b) viveu 60 h, sem linhas: atrasado, sem "segue valendo"', () => {
    const p = semLinhas(ha(96), ha(36), 'archived')
    expect(p.atrasado).toBe(true)
    const f = fraseDoPlacar(p, 'archived')
    expect(f.principal).toBe('Os dados do YouTube não rodaram durante este teste. Não há números.')
    expect(f.apoio).toBe('O teste já terminou; esta leitura não vai mais mudar sozinha.')
  })
  it('(c) atrasado encerrado nunca diz "segue valendo" nem "desde o início"', () => {
    const f = fraseDoPlacar(semLinhas(ha(96), ha(36), 'completed'), 'completed')
    expect(JSON.stringify(f)).not.toMatch(/segue valendo|desde o início|próxima leitura/)
  })
  it('em curso mantém o texto atual', () => {
    const p = semLinhas(ha(96), null, 'active')
    expect(p.atrasado).toBe(true)
    expect(fraseDoPlacar(p, 'active').principal).toContain('desde o início')
  })
})
