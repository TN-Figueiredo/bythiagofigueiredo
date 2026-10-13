// @vitest-environment node
// A5 · E14, Tarefa 5: a seleção dos comentários do lote (criador, destaque, curtidos). Dado 100% inventado.
import { describe, expect, it } from 'vitest'
import { selecionar } from '@/lib/youtube/observatorio/comentarios/selecao'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'
import type { Conversa, Destaque } from '@/lib/youtube/observatorio/comentarios/tipos'

/** Gerador com semente fixa (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function embaralhar<T>(lista: T[], r: () => number): T[] {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function conv(id: string, o: Partial<Conversa> = {}): Conversa {
  return {
    id, posicao: 0, texto: 'texto inventado ' + id, cortado: false, publicadoEm: '2020-01-01T00:00:00Z', editadoEm: null,
    curtidas: 10, respostasTotal: 0, autor: { nome: null, canalId: null, foto: null },
    doCriador: false, criadorRespondeu: false, respostasDoCriador: [], canaisNasRespostas: [], ...o,
  }
}

const dest = (motivo: Destaque['motivo'], faixaTamanho: string | null = null, faixaRazao: string | null = null): Destaque =>
  ({ motivo, canalRowId: null, faixaTamanho, faixaRazao })

/** n conversas com curtidas decrescentes: c0 é a mais curtida. */
function lote(n: number, prefixo = 'c'): Conversa[] {
  return Array.from({ length: n }, (_, i) => conv(`${prefixo}${String(i).padStart(3, '0')}`, { curtidas: 1000 - i, posicao: i }))
}

const ids = (xs: { conversa: Conversa }[]): string[] => xs.map((x) => x.conversa.id)
const nenhum = new Map<string, Destaque>()

describe('selecionar', () => {
  it('reproduzível: a mesma lista embaralhada dentro do mesmo likeCount dá os mesmos escolhidos, na mesma ordem', () => {
    const base: Conversa[] = Array.from({ length: 40 }, (_, i) => conv(`b${String(i).padStart(2, '0')}`, {
      curtidas: [5, 3, 3, 3, 1][i % 5], posicao: i % 7, respostasTotal: i % 3,
      doCriador: i === 9, criadorRespondeu: i % 11 === 0 ? true : i % 13 === 0 ? null : false,
    }))
    const d = new Map<string, Destaque>([['b03', dest('inscritos', '1m_10m')], ['b17', dest('canal_acompanhado')]])
    const ref = ids(selecionar(base, d))
    const r = rng(42)
    for (let k = 0; k < 20; k++) expect(ids(selecionar(embaralhar(base, r), d))).toEqual(ref)
  })

  it('lote de 5: os 5; lote de 100: 12; lote vazio: lista vazia', () => {
    expect(selecionar(lote(5), nenhum)).toHaveLength(5)
    expect(selecionar(lote(100), nenhum)).toHaveLength(COMMENT_RULES.target)
    expect(selecionar([], nenhum)).toEqual([])
  })

  it('lote com exatamente 12 e com 13', () => {
    expect(selecionar(lote(12), nenhum)).toHaveLength(12)
    expect(selecionar(lote(13), nenhum)).toHaveLength(12)
  })

  it('nenhum com o criador: 0 em criador, as 4 vagas vão para curtidos', () => {
    const s = selecionar(lote(30), nenhum)
    expect(s.filter((x) => x.grupo === 'criador')).toHaveLength(0)
    expect(s.filter((x) => x.grupo === 'curtidos')).toHaveLength(12)
    expect(ids(s)).toEqual(lote(12).map((c) => c.id))
  })

  it('mais de 4 com o criador: 4 em criador (os mais curtidos), os outros disputam como comuns', () => {
    const l = lote(30).map((c, i) => (i >= 10 && i < 17 ? { ...c, doCriador: i % 2 === 0, criadorRespondeu: i % 2 === 1 ? true : false } : c))
    const s = selecionar(l, nenhum)
    const cri = s.filter((x) => x.grupo === 'criador')
    expect(ids(cri)).toEqual(['c010', 'c011', 'c012', 'c013'])
    // c014..c016 são do criador também, mas só disputam como comuns: entram só pelas curtidas
    const resto = s.filter((x) => x.grupo === 'curtidos')
    expect(resto).toHaveLength(8)
    expect(ids(resto)).toEqual(['c000', 'c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007'])
    expect(ids(s)).not.toContain('c014')
  })

  it('o mais curtido que também tem resposta do criador entra uma vez, no grupo criador, com os dois sinalizadores', () => {
    const l = lote(20)
    l[0] = { ...l[0], doCriador: true, criadorRespondeu: true }
    const s = selecionar(l, nenhum)
    const achados = s.filter((x) => x.conversa.id === 'c000')
    expect(achados).toHaveLength(1)
    expect(achados[0].grupo).toBe('criador')
    expect(achados[0].conversa.doCriador).toBe(true)
    expect(achados[0].conversa.criadorRespondeu).toBe(true)
  })

  it('criadorRespondeu nulo NÃO entra no grupo criador', () => {
    const l = lote(20).map((c) => ({ ...c, criadorRespondeu: null as boolean | null }))
    const s = selecionar(l, nenhum)
    expect(s.filter((x) => x.grupo === 'criador')).toHaveLength(0)
  })

  it('preferência nas duas vagas: acompanhado antes de grande; entre os grandes, faixa maior primeiro', () => {
    const l = lote(40)
    const d = new Map<string, Destaque>([
      ['c030', dest('inscritos', '100k_1m')],
      ['c031', dest('inscritos', '10m_mais')],
      ['c032', dest('inscritos', '1m_10m')],
      ['c033', dest('canal_acompanhado')],
      ['c034', dest('canal_proprio')],
    ])
    const s = selecionar(l, d)
    const g = s.filter((x) => x.grupo === 'destaque')
    expect(ids(g)).toEqual(['c033', 'c034'])
    // acompanhado e proprio ocupam as 2 vagas: os grandes perdem
    const d2 = new Map<string, Destaque>(d)
    d2.delete('c034')
    const g2 = selecionar(l, d2).filter((x) => x.grupo === 'destaque')
    expect(ids(g2)).toEqual(['c033', 'c031'])
    const d3 = new Map<string, Destaque>([...d].filter(([k]) => k !== 'c033' && k !== 'c034'))
    const g3 = selecionar(l, d3).filter((x) => x.grupo === 'destaque')
    expect(ids(g3)).toEqual(['c031', 'c032'])
  })

  it('empate de faixa: pela ordem geral (mais curtido primeiro)', () => {
    const l = lote(40)
    const d = new Map<string, Destaque>([['c035', dest('inscritos', '1m_10m')], ['c030', dest('inscritos', '1m_10m')], ['c038', dest('inscritos', '1m_10m')]])
    expect(ids(selecionar(l, d).filter((x) => x.grupo === 'destaque'))).toEqual(['c030', 'c035'])
  })

  it('comentário de destaque já escolhido em criador não ocupa vaga de destaque', () => {
    const l = lote(40)
    l[5] = { ...l[5], doCriador: true }
    const d = new Map<string, Destaque>([
      ['c005', dest('canal_acompanhado')], ['c030', dest('inscritos', '10m_mais')], ['c031', dest('inscritos', '1m_10m')],
    ])
    const s = selecionar(l, d)
    expect(s.find((x) => x.conversa.id === 'c005')?.grupo).toBe('criador')
    expect(ids(s.filter((x) => x.grupo === 'destaque'))).toEqual(['c030', 'c031'])
    expect(s.find((x) => x.conversa.id === 'c005')?.destaque?.motivo).toBe('canal_acompanhado')
  })

  it('o destaque do Escolhido vem preenchido em qualquer grupo; sem destaque é null', () => {
    const l = lote(20)
    const d = new Map<string, Destaque>([['c000', dest('inscritos', '10m_mais')]])
    const s = selecionar(l, d)
    expect(s.find((x) => x.conversa.id === 'c000')?.destaque?.faixaTamanho).toBe('10m_mais')
    expect(s.find((x) => x.conversa.id === 'c001')?.destaque).toBeNull()
  })

  it('vaga não usada de destaque passa para curtidos', () => {
    const l = lote(30)
    const d = new Map<string, Destaque>([['c020', dest('inscritos', '1m_10m')]])
    const s = selecionar(l, d)
    expect(s).toHaveLength(12)
    expect(s.filter((x) => x.grupo === 'destaque')).toHaveLength(1)
    expect(s.filter((x) => x.grupo === 'curtidos')).toHaveLength(11)
  })

  it('id repetido na entrada entra uma vez só; destaque de id que não está no lote é ignorado', () => {
    const l = [...lote(5), conv('c000', { curtidas: 1 })]
    const d = new Map<string, Destaque>([['fantasma', dest('canal_acompanhado')]])
    const s = selecionar(l, d)
    expect(ids(s).filter((x) => x === 'c000')).toHaveLength(1)
    expect(s).toHaveLength(5)
  })

  it('M-5: o mesmo comentário elegível como criador, como destaque e como curtido aparece UMA vez, no grupo criador', () => {
    const l = lote(20)
    l[0] = conv('c000', { curtidas: 5000, posicao: 0, doCriador: true, criadorRespondeu: true })
    const d = new Map<string, Destaque>([['c000', dest('inscritos', '10m_mais')]])
    const s = selecionar(l, d)
    expect(ids(s).filter((x) => x === 'c000')).toHaveLength(1)
    expect(s.find((x) => x.conversa.id === 'c000')?.grupo).toBe('criador')
    expect(new Set(ids(s)).size).toBe(s.length)
    expect(s).toHaveLength(12)
  })

  it('M-5: linha repetida na entrada de um comentário do criador ou de destaque entra uma vez só', () => {
    const base = lote(20)
    const criador = conv('cr', { curtidas: 7, posicao: 30, doCriador: true })
    const grande = conv('gr', { curtidas: 6, posicao: 31 })
    const d = new Map<string, Destaque>([['gr', dest('inscritos', '1m_10m')]])
    const s = selecionar([...base, criador, { ...criador }, grande, { ...grande }], d)
    expect(ids(s).filter((x) => x === 'cr')).toHaveLength(1)
    expect(ids(s).filter((x) => x === 'gr')).toHaveLength(1)
    expect(s.find((x) => x.conversa.id === 'cr')?.grupo).toBe('criador')
    expect(s.find((x) => x.conversa.id === 'gr')?.grupo).toBe('destaque')
    expect(new Set(ids(s)).size).toBe(s.length)
  })

  it('não altera a entrada', () => {
    const l = embaralhar(lote(30), rng(7))
    const copia = JSON.stringify(l)
    selecionar(l, nenhum)
    expect(JSON.stringify(l)).toBe(copia)
  })

  it('sempre no máximo 12 e nunca repetido (200 lotes aleatórios, semente fixa)', () => {
    const r = rng(2026)
    for (let k = 0; k < 200; k++) {
      const n = Math.floor(r() * 120)
      const l: Conversa[] = Array.from({ length: n }, (_, i) => conv(`p${k}-${i}`, {
        curtidas: Math.floor(r() * 20), respostasTotal: Math.floor(r() * 5), posicao: i,
        doCriador: r() < 0.1, criadorRespondeu: r() < 0.15 ? true : r() < 0.3 ? null : false,
      }))
      const d = new Map<string, Destaque>()
      for (const c of l) {
        const x = r()
        if (x < 0.08) d.set(c.id, dest('canal_acompanhado'))
        else if (x < 0.2) d.set(c.id, dest('inscritos', ['100k_1m', '1m_10m', '10m_mais'][Math.floor(r() * 3)]))
      }
      const s = selecionar(l, d)
      const sel = ids(s)
      expect(sel.length).toBeLessThanOrEqual(12)
      expect(sel.length).toBe(Math.min(12, n))
      expect(new Set(sel).size).toBe(sel.length)
      expect(s.filter((x) => x.grupo === 'criador').length).toBeLessThanOrEqual(4)
      expect(s.filter((x) => x.grupo === 'destaque').length).toBeLessThanOrEqual(2)
    }
  })
})
