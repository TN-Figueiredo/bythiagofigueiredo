// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-telas-frases.test.ts
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

import { FRASES, classeDoMotivo, fraseDaNota, FRASE_FIXA_DA_FONTE } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { FRASES_DE_MOTIVO, type ContextoDaFrase } from '@/lib/youtube/observatorio/medidas-frases'
import { MOTIVOS_NAO_MEDIDO, type Nota } from '@/lib/youtube/observatorio/medidas/tipos'
import { acharTermoProibido } from './medidas-termos-proibidos'

const CHEIO: ContextoDaFrase = { n: 2, minimo: 5, desde: '2026-10-03', fechaEm: '2026-12-14', idade: 7 }
const VAZIO: ContextoDaFrase = {}

describe('frases das telas (E5a T1)', () => {
  it('todo motivo da E4 tem frase curta e longa não vazias', () => {
    expect(MOTIVOS_NAO_MEDIDO).toHaveLength(35)
    for (const m of MOTIVOS_NAO_MEDIDO) for (const c of [VAZIO, CHEIO]) {
      const f = FRASES[m](c)
      expect(f.curta.length, m).toBeGreaterThan(3); expect(f.longa.length, m).toBeGreaterThan(15)
      expect(f.curta + f.longa, m).not.toMatch(/undefined|null|NaN/)
    }
  })
  it('leitura_falhou e calculo_falhou são "não carregou"; os outros, "não medido"', () => {
    for (const m of MOTIVOS_NAO_MEDIDO) expect(classeDoMotivo(m), m).toBe(m === 'leitura_falhou' || m === 'calculo_falhou' ? 'nao_carregou' : 'nao_medido')
  })
  it('frase com data pedida e sem data não inventa data', () => {
    expect(FRASES.fecha_em(VAZIO).curta).toBe('ainda sem data para fechar')
    expect(FRASES.fecha_em({ fechaEm: '2026-12-14' }).curta).toBe('fecha em 14/12')
    expect(FRASES.fecha_em(VAZIO).curta).not.toMatch(/\d/)
  })
  it('nenhuma frase tem termo proibido nem a palavra do item 56', () => {
    const textos: string[] = [FRASE_FIXA_DA_FONTE]
    for (const m of MOTIVOS_NAO_MEDIDO) for (const c of [VAZIO, CHEIO]) { const f = FRASES[m](c); textos.push(f.curta, f.longa) }
    for (const t of textos) expect(acharTermoProibido(t), t).toBeNull()
    for (const t of textos) expect(t).not.toMatch(/reten[cç]ão/i)
  })
  it('a frase longa de todo motivo é a da tabela única', () => {
    for (const m of MOTIVOS_NAO_MEDIDO) for (const c of [VAZIO, CHEIO]) expect(FRASES[m](c).longa, m).toBe(FRASES_DE_MOTIVO[m](c))
    const fonte = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/medidas-telas/frases.ts'), 'utf8')
    expect(fonte).not.toMatch(/longa:\s*['"`]/)
  })
  it('a variante por tela só troca a curta', () => {
    const a = FRASES.sem_publicacao(VAZIO), b = FRASES.sem_publicacao(VAZIO, 'canais')
    expect(b.longa).toBe(a.longa)
  })
  it('toda nota tem frase não vazia, sem termo proibido', () => {
    const notas: Nota[] = [
      { tipo: 'mudanca_de_contagem' }, { tipo: 'ao_vivo_fora', n: 2 }, { tipo: 'fora_do_ar_dentro', n: 1 }, { tipo: 'formato_nao_confirmado_fora', n: 3 },
      { tipo: 'ao_vivo_nao_se_sabe', n: 1 }, { tipo: 'total_de_hoje' }, { tipo: 'so_curtidas' }, { tipo: 'so_comentarios' }, { tipo: 'serie_semanal' }, { tipo: 'agendado_fora', n: 1 },
    ]
    for (const n of notas) { const f = fraseDaNota(n); expect(f.length, n.tipo).toBeGreaterThan(10); expect(acharTermoProibido(f), f).toBeNull(); expect(f).not.toMatch(/undefined|NaN/) }
  })
  it('a fonte é a frase fixa do item 35', () => {
    expect(FRASE_FIXA_DA_FONTE).toBe('Cálculo do Observatório sobre dados públicos do YouTube.')
  })
})
