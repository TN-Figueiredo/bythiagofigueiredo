// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashValue } from '@/lib/youtube/competitor-versions'
import {
  aplicarPlanoNasCorrentes, derivarDia, type CorrenteDoCampo, type FatoDoDia,
} from '@/lib/youtube/coleta/versoes-derivar'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const D0 = '2026-03-10'
const cap = (dia: string, h = '12:00:00'): string => `${addDays(dia, 1)}T${h}.000Z`
const H0 = '0000000000000000'
/** dHash a n bits de H0 (liga os n bits menos significativos). */
const bits = (n: number): string => {
  let v = 0n
  for (let i = 0; i < n; i++) v |= 1n << BigInt(i)
  return v.toString(16).padStart(16, '0')
}

function fato(dia: string, extra: Partial<FatoDoDia> = {}): FatoDoDia {
  return {
    ytId: 'abcdefghijk', dia, videoId: 'v-1', capturadoEm: cap(dia), privacidade: 'public', privacidadeConhecida: null,
    titulo: 'Título A', descHash: 'd'.repeat(16), dhash: H0, sha256: 's1', blobUrl: 'https://blob.test/a.jpg', ...extra,
  }
}
function corrente(campo: CorrenteDoCampo['campo'], extra: Partial<CorrenteDoCampo> = {}): CorrenteDoCampo {
  const base: CorrenteDoCampo = { id: `id-${campo}`, ytId: 'abcdefghijk', campo, hash: 'x', ancoraDhash: null, sha256: null, ultimoDia: D0, vistaAte: cap(D0) }
  if (campo === 'title') base.hash = hashValue('Título A')
  if (campo === 'desc') base.hash = 'd'.repeat(16)
  if (campo === 'thumb') { base.hash = H0; base.ancoraDhash = H0; base.sha256 = 's1' }
  return { ...base, ...extra }
}
const doCampo = (abrir: ReturnType<typeof derivarDia>['abrir'], campo: string) => abrir.filter(a => a.campo === campo)

describe('derivarDia', () => {
  it('1. item 173: o primeiro dia abre uma linha de base por campo (first, janela nula), nenhuma troca', () => {
    const p = derivarDia([], [fato(D0)])
    expect(p.abrir).toHaveLength(3)
    for (const a of p.abrir) { expect(a.precisao).toBe('first'); expect(a.janela).toBeNull() }
    expect(p.confirmar).toEqual([])
    expect(doCampo(p.abrir, 'thumb')[0]!.thumb).toMatchObject({ dhash: H0, ancoraDhash: H0, retoque: false })
    expect(doCampo(p.abrir, 'title')[0]!.tituloOuNulo).toBe('Título A')
  })

  it('2. item 174: título igual confirma; diferente abre com janela de vistaAte até a captura', () => {
    const cs = [corrente('title')]
    const igual = derivarDia(cs, [fato(addDays(D0, 1))])
    expect(igual.confirmar).toContainEqual({ id: 'id-title', vistaEm: cap(addDays(D0, 1)) })
    const dif = derivarDia(cs, [fato(addDays(D0, 1), { titulo: 'Título B' })])
    const a = doCampo(dif.abrir, 'title').find(x => x.tituloOuNulo === 'Título B')!
    expect(a.janela).toEqual({ de: cap(D0), ate: cap(addDays(D0, 1)) })
    expect(a.precisao).toBe('1d')
  })

  it('3. item 175: privacidade nula com título e descrição diferentes: nada abre nem confirma, sem_captura conta; a thumbnail é tratada', () => {
    const cs = [corrente('title'), corrente('desc'), corrente('thumb')]
    const p = derivarDia(cs, [fato(addDays(D0, 1), { privacidade: null, titulo: 'Outro', descHash: 'e'.repeat(16) })])
    expect(doCampo(p.abrir, 'title')).toHaveLength(0)
    expect(doCampo(p.abrir, 'desc')).toHaveLength(0)
    expect(p.confirmar.map(c => c.id)).not.toContain('id-title')
    expect(p.confirmar.map(c => c.id)).not.toContain('id-desc')
    expect(p.pulados.sem_captura).toBeGreaterThan(0)
    expect(p.confirmar.map(c => c.id)).toContain('id-thumb')
  })

  it('4. item 176 (desvio 1): deriva de 3 bits por dia com bytes diferentes: retoque, retoque, troca cheia com âncora nova', () => {
    let cs: CorrenteDoCampo[] = [corrente('thumb')]
    const ab: Array<ReturnType<typeof derivarDia>['abrir'][number]> = []
    for (let i = 1; i <= 3; i++) {
      const dia = addDays(D0, i)
      const p = derivarDia(cs, [fato(dia, { dhash: bits(3 * i), sha256: `s${i + 1}`, titulo: null, descHash: null, privacidade: 'public' })])
      const t = doCampo(p.abrir, 'thumb')
      expect(t).toHaveLength(1)
      ab.push(t[0]!)
      cs = [{ ...corrente('thumb'), id: `n${i}`, hash: bits(3 * i), ancoraDhash: t[0]!.thumb!.ancoraDhash, sha256: `s${i + 1}`, ultimoDia: dia, vistaAte: cap(dia) }]
    }
    expect(ab[0]!.thumb).toMatchObject({ retoque: true, ancoraDhash: H0 })
    expect(ab[1]!.thumb).toMatchObject({ retoque: true, ancoraDhash: H0 })
    expect(ab[2]!.thumb).toMatchObject({ retoque: false, ancoraDhash: bits(9) })
  })

  it('4b. mesmos bytes (sha igual) nos dias 1 e 2: só confirma; no dia 3 a troca', () => {
    const cs = [corrente('thumb')]
    const p1 = derivarDia(cs, [fato(addDays(D0, 1), { dhash: bits(3), sha256: 's1' })])
    expect(doCampo(p1.abrir, 'thumb')).toHaveLength(0)
    expect(p1.confirmar.map(c => c.id)).toContain('id-thumb')
    const p3 = derivarDia(cs, [fato(addDays(D0, 3), { dhash: bits(9), sha256: 's1' })])
    expect(doCampo(p3.abrir, 'thumb')[0]!.thumb).toMatchObject({ retoque: false, ancoraDhash: bits(9) })
  })

  it('5. item 177: sem dHash a thumbnail é pulada e não confirma; vídeo privado idem; o título segue', () => {
    const cs = [corrente('title'), corrente('thumb')]
    const sem = derivarDia(cs, [fato(addDays(D0, 1), { dhash: null })])
    expect(sem.pulados.sem_dhash).toBe(1)
    expect(sem.confirmar.map(c => c.id)).toEqual(['id-title'])
    const priv = derivarDia(cs, [fato(addDays(D0, 1), { privacidade: 'private' })])
    expect(priv.pulados.privado).toBe(1)
    expect(priv.confirmar.map(c => c.id)).toEqual(['id-title'])
  })

  it('6. item 178: bytes diferentes e distância 6 é retoque; 7 é troca cheia (fronteira 6 e 7)', () => {
    const cs = [corrente('thumb')]
    const seis = derivarDia(cs, [fato(addDays(D0, 1), { dhash: bits(6), sha256: 'novo' })])
    expect(doCampo(seis.abrir, 'thumb')[0]!.thumb!.retoque).toBe(true)
    const sete = derivarDia(cs, [fato(addDays(D0, 1), { dhash: bits(7), sha256: 'novo' })])
    expect(doCampo(sete.abrir, 'thumb')[0]!.thumb!.retoque).toBe(false)
  })

  it('7. sha nulo de um dos lados com distância até 6: confirma, não inventa retoque', () => {
    const a = derivarDia([corrente('thumb')], [fato(addDays(D0, 1), { dhash: bits(4), sha256: null })])
    expect(doCampo(a.abrir, 'thumb')).toHaveLength(0)
    const b = derivarDia([corrente('thumb', { sha256: null })], [fato(addDays(D0, 1), { dhash: bits(4), sha256: 'x' })])
    expect(doCampo(b.abrir, 'thumb')).toHaveLength(0)
    expect(b.confirmar.map(c => c.id)).toContain('id-thumb')
  })

  it('8. item 179: diferença de 1 dia dá 1d; de 2 dá lacuna (fronteira 1 e 2)', () => {
    const cs = [corrente('title')]
    expect(doCampo(derivarDia(cs, [fato(addDays(D0, 1), { titulo: 'B' })]).abrir, 'title')[0]!.precisao).toBe('1d')
    expect(doCampo(derivarDia(cs, [fato(addDays(D0, 2), { titulo: 'B' })]).abrir, 'title')[0]!.precisao).toBe('lacuna')
  })

  it('9. item 180: título e thumbnail trocados no mesmo dia: duas aberturas com a mesma janela', () => {
    const p = derivarDia([corrente('title'), corrente('thumb')], [fato(addDays(D0, 1), { titulo: 'B', dhash: bits(20) })])
    const t = doCampo(p.abrir, 'title')[0]!, th = doCampo(p.abrir, 'thumb')[0]!
    expect(t.janela).toEqual(th.janela)
    expect(t.janela).not.toBeNull()
  })

  it('10. título nulo com captura: pulado como sem_captura, nunca versão de texto vazio', () => {
    const p = derivarDia([], [fato(D0, { titulo: null })])
    expect(doCampo(p.abrir, 'title')).toHaveLength(0)
    expect(p.pulados.sem_captura).toBe(1)
  })

  it('11. vídeo com corrente e sem fato no dia: nada; lista vazia devolve plano vazio', () => {
    const p = derivarDia([corrente('title')], [])
    expect(p).toEqual({ confirmar: [], abrir: [], pulados: { sem_captura: 0, sem_dhash: 0, privado: 0 } })
  })

  it('12. dois fatos do mesmo vídeo no mesmo dia: lança erro de programação', () => {
    expect(() => derivarDia([], [fato(D0), fato(D0)])).toThrow()
  })

  it('13. item 199: aberturas com precisão diferente de first = mudanças entre fatos válidos seguidos (200 sequências)', () => {
    let seed = 12345
    const rnd = (): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    const titulos = ['A', 'B', 'C']
    let totalAberturas = 0
    for (let rep = 0; rep < 200; rep++) {
      let cs: CorrenteDoCampo[] = []
      let ultimo: string | null = null
      let esperadoTitulo = 0, achadoTitulo = 0, aberturas = 0
      const dias = 1 + Math.floor(rnd() * 30)
      for (let i = 0; i < dias; i++) {
        const dia = addDays(D0, i)
        if (rnd() < 0.25) continue // dia sem captura
        const valido = rnd() >= 0.2
        const t = titulos[Math.floor(rnd() * 3)]!
        const f = fato(dia, { privacidade: valido ? 'public' : null, titulo: t, dhash: null, descHash: null })
        const p = derivarDia(cs, [f])
        if (valido) {
          if (ultimo !== null && ultimo !== t) esperadoTitulo++
          ultimo = t
        }
        for (const a of doCampo(p.abrir, 'title')) { aberturas++; if (a.precisao !== 'first') achadoTitulo++ }
        // aplica: confirma ou "grava" a abertura como nova corrente
        const ab = doCampo(p.abrir, 'title')[0]
        if (ab) cs = [{ id: `r${rep}-${i}`, ytId: f.ytId, campo: 'title', hash: ab.hash, ancoraDhash: null, sha256: null, ultimoDia: dia, vistaAte: ab.capturadoEm }]
        else cs = aplicarPlanoNasCorrentes(cs, p, dia)
      }
      expect(achadoTitulo).toBe(esperadoTitulo)
      totalAberturas += aberturas
    }
    expect(totalAberturas).toBeGreaterThan(0)
  })

  it('13d. (portão 14/10, Yannis M10) a mesma propriedade para a thumbnail: o sha é o valor com distância até 6 (200 sequências)', () => {
    let seed = 777
    const rnd = (): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    for (let rep = 0; rep < 200; rep++) {
      let cs: CorrenteDoCampo[] = []
      let ultimo: string | null = null
      let esperado = 0, achado = 0
      const dias = 1 + Math.floor(rnd() * 30)
      for (let i = 0; i < dias; i++) {
        const dia = addDays(D0, i)
        if (rnd() < 0.25) continue
        const sha = `s${Math.floor(rnd() * 3)}`
        const dh = bits(Math.floor(rnd() * 7)) // 0 a 6 bits da âncora H0: sempre retoque, nunca troca cheia
        const p = derivarDia(cs, [fato(dia, { privacidade: rnd() < 0.2 ? null : 'public', dhash: dh, sha256: sha })]) // a thumbnail não depende da privacidade nula
        if (ultimo !== null && ultimo !== sha) esperado++
        ultimo = sha
        const ab = doCampo(p.abrir, 'thumb')[0]
        if (ab?.thumb) {
          if (ab.precisao !== 'first') achado++
          cs = [{ id: `r${rep}-${i}`, ytId: 'abcdefghijk', campo: 'thumb', hash: ab.hash, ancoraDhash: ab.thumb.ancoraDhash, sha256: ab.thumb.sha256, ultimoDia: dia, vistaAte: ab.capturadoEm }]
        } else cs = aplicarPlanoNasCorrentes(cs, { ...p, abrir: [] }, dia)
      }
      expect(achado).toBe(esperado)
    }
  })

  it('14. (portão 14/10, Phil m-2) descrição sem hash, com privacidade presente, conta em sem_captura', () => {
    const p = derivarDia([], [fato(D0, { descHash: null, dhash: null })])
    expect(p.pulados.sem_captura).toBe(1)
    expect(doCampo(p.abrir, 'desc')).toHaveLength(0)
  })

  it('15. (portão 14/10, Yannis M5) fato no mesmo dia da corrente ou antes dela lança, sem o título na mensagem', () => {
    const c = corrente('title')
    for (const dia of [D0, addDays(D0, -1)]) {
      let msg = ''
      try { derivarDia([c], [fato(dia, { titulo: 'Outro segredo' })]) } catch (e) { msg = (e as Error).message }
      expect(msg).toContain('fato não posterior à corrente')
      expect(msg).not.toContain('segredo')
    }
  })

  it('13b. A, B, A dá três versões e duas trocas', () => {
    let cs: CorrenteDoCampo[] = []
    const seq = ['A', 'B', 'A']
    let versoes = 0, trocas = 0
    seq.forEach((t, i) => {
      const dia = addDays(D0, i)
      const p = derivarDia(cs, [fato(dia, { titulo: t, dhash: null, descHash: null })])
      const ab = doCampo(p.abrir, 'title')[0]!
      versoes++
      if (ab.precisao !== 'first') trocas++
      cs = [{ id: `v${i}`, ytId: 'abcdefghijk', campo: 'title', hash: ab.hash, ancoraDhash: null, sha256: null, ultimoDia: dia, vistaAte: ab.capturadoEm }]
    })
    expect([versoes, trocas]).toEqual([3, 2])
  })

  it('13c. thumbnail: o sha é o valor quando a distância fica até 6 (A, B, A dá três versões)', () => {
    let cs: CorrenteDoCampo[] = []
    let versoes = 0
    ;['sa', 'sb', 'sa'].forEach((s, i) => {
      const dia = addDays(D0, i)
      const p = derivarDia(cs, [fato(dia, { titulo: null, descHash: null, dhash: bits(2), sha256: s })])
      const ab = doCampo(p.abrir, 'thumb')[0]!
      versoes++
      cs = [{ id: `v${i}`, ytId: 'abcdefghijk', campo: 'thumb', hash: ab.hash, ancoraDhash: ab.thumb!.ancoraDhash, sha256: s, ultimoDia: dia, vistaAte: ab.capturadoEm }]
    })
    expect(versoes).toBe(3)
  })

  it('14. a função não devolve origem em campo nenhum', () => {
    const p = derivarDia([], [fato(D0)])
    for (const a of p.abrir) expect('origem' in a).toBe(false)
  })

  it('15. (D-I1) dia 1 confirma, dia 2 troca: com aplicarPlanoNasCorrentes a janela e a precisão são as de duas execuções diárias', () => {
    const d1 = addDays(D0, 1), d2 = addDays(D0, 2)
    const cs = [corrente('title'), corrente('desc'), corrente('thumb')]
    const plano1 = derivarDia(cs, [fato(d1)])
    expect(plano1.abrir).toHaveLength(0)
    const aplicadas = aplicarPlanoNasCorrentes(cs, plano1, d1)
    const f2 = fato(d2, { titulo: 'B', dhash: bits(20), sha256: 's9' })
    const certo = derivarDia(aplicadas, [f2])
    const t = doCampo(certo.abrir, 'title')[0]!, th = doCampo(certo.abrir, 'thumb')[0]!
    expect(t.precisao).toBe('1d'); expect(t.janela!.de).toBe(cap(d1))
    expect(th.precisao).toBe('1d'); expect(th.janela!.de).toBe(cap(d1))
    // o defeito, nomeado: sem aplicar o plano, a janela sai da captura do dia 0 e vira lacuna
    const defeito = derivarDia(cs, [f2])
    expect(doCampo(defeito.abrir, 'title')[0]!.precisao).toBe('lacuna')
    expect(doCampo(defeito.abrir, 'title')[0]!.janela!.de).toBe(cap(D0))
    // thumbnail aplicada herda a âncora e o sha da corrente
    expect(aplicadas.find(c => c.campo === 'thumb')).toMatchObject({ ancoraDhash: H0, sha256: 's1', ultimoDia: d1 })
    expect(() => aplicarPlanoNasCorrentes(cs, derivarDia([], [fato(D0)]), D0)).toThrow()
  })

  it('16. (S-m5) privacidade nula + privacidadeConhecida private: thumbnail pulada como privado; com nula ou public: tratada', () => {
    const cs = [corrente('thumb')]
    const priv = derivarDia(cs, [fato(addDays(D0, 1), { privacidade: null, privacidadeConhecida: 'private' })])
    expect(priv.pulados.privado).toBe(1)
    expect(priv.confirmar).toEqual([])
    expect(priv.abrir.filter(a => a.campo === 'thumb')).toHaveLength(0)
    for (const pc of [null, 'public'] as const) {
      const p = derivarDia(cs, [fato(addDays(D0, 1), { privacidade: null, privacidadeConhecida: pc })])
      expect(p.confirmar.map(c => c.id)).toContain('id-thumb')
    }
  })

  it('17. (S-m9) a mensagem do erro do caso 12 traz o id do vídeo e o dia, nunca o título', () => {
    const f = fato(D0, { titulo: 'Segredo do vídeo não listado' })
    let msg = ''
    try { derivarDia([], [f, f]) } catch (e) { msg = (e as Error).message }
    expect(msg).toContain('abcdefghijk')
    expect(msg).toContain(D0)
    expect(msg).not.toContain('Segredo')
  })
})
