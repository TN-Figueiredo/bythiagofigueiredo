// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import {
  aplicarPlanoNasCorrentes, derivarDia, type AberturaSemOrigem, type CorrenteDoCampo, type FatoDoDia,
} from '@/lib/youtube/coleta/versoes-derivar'
import {
  fatosDoDia, videosCobertosSemLinha, type IntervaloMeta, type LinhaDiaria,
} from '@/lib/youtube/coleta/versoes-fatos-cobertura'

const D0 = '2026-03-10'
const cap = (dia: string): string => `${addDays(dia, 1)}T12:00:00.000Z`
const H0 = '0000000000000000'

function linha(ytId: string, dia: string, extra: Partial<LinhaDiaria> = {}): LinhaDiaria {
  return {
    youtube_video_id: ytId, day_pt: dia, video_id: `uuid-${ytId}`, title_at_capture: 'Título A', description_sha256: 'd'.repeat(16),
    thumbnail_dhash: H0, thumbnail_sha256_at_capture: 's1', thumbnail_blob_url: 'https://blob.test/a.jpg', privacy_status: 'public',
    captured_at: cap(dia), ...extra,
  }
}
const iv = (ytId: string, set: IntervaloMeta['metric_set'], de: string, ate: string): IntervaloMeta =>
  ({ youtube_video_id: ytId, metric_set: set, covered_from: de, covered_to: ate })
const ambos = (ytId: string, de: string, ate: string): IntervaloMeta[] => [iv(ytId, 'meta_texto', de, ate), iv(ytId, 'meta_thumb', de, ate)]
const V1 = 'aaaaaaaaaaa'
const V2 = 'bbbbbbbbbbb'

describe('fatosDoDia (puro)', () => {
  it('1. dia com todas as linhas: devolve as mesmas, repetidos vazio', () => {
    const doDia = [linha(V1, addDays(D0, 5)), linha(V2, addDays(D0, 5))]
    const r = fatosDoDia(addDays(D0, 5), doDia, new Map(), [...ambos(V1, D0, addDays(D0, 9)), ...ambos(V2, D0, addDays(D0, 9))])
    expect(r.linhas).toEqual(doDia)
    expect(r.repetidos.size).toBe(0)
    expect(r.cobertos_sem_linha).toBe(0)
  })

  it('2. cobertura vazia: devolve só as linhas do dia (dado ausente)', () => {
    const doDia = [linha(V1, addDays(D0, 5))]
    const r = fatosDoDia(addDays(D0, 5), doDia, new Map([[V2, linha(V2, D0)]]), [])
    expect(r.linhas).toEqual(doDia)
    expect(r.repetidos.size).toBe(0)
    expect(r.cobertos_sem_linha).toBe(0)
    expect(videosCobertosSemLinha(addDays(D0, 5), doDia, [])).toEqual([])
  })

  it('3. coberto nos dois conjuntos e sem linha: cópia da última, com o dia trocado', () => {
    const ultima = linha(V1, D0, { title_at_capture: 'Outro', captured_at: '2026-03-10T20:00:00.000Z' })
    const dia = addDays(D0, 3)
    const r = fatosDoDia(dia, [], new Map([[V1, ultima]]), ambos(V1, D0, addDays(D0, 9)))
    expect(r.linhas).toEqual([{ ...ultima, day_pt: dia }])
    expect([...r.repetidos]).toEqual([V1])
    expect(r.cobertos_sem_linha).toBe(0)
    expect(r.linhas[0]!.captured_at).toBe(ultima.captured_at)
  })

  it('4. coberto só em meta_thumb: a cópia vem sem privacidade; só em meta_texto: sem dHash', () => {
    const ultima = linha(V1, D0)
    const dia = addDays(D0, 3)
    const soThumb = fatosDoDia(dia, [], new Map([[V1, ultima]]), [iv(V1, 'meta_thumb', D0, addDays(D0, 9))]).linhas[0]!
    expect(soThumb.privacy_status).toBeNull()
    expect(soThumb.thumbnail_dhash).toBe(H0)
    const soTexto = fatosDoDia(dia, [], new Map([[V1, ultima]]), [iv(V1, 'meta_texto', D0, addDays(D0, 9))]).linhas[0]!
    expect(soTexto.privacy_status).toBe('public')
    expect(soTexto.thumbnail_dhash).toBeNull()
    expect(soTexto.thumbnail_sha256_at_capture).toBeNull()
    expect(soTexto.thumbnail_blob_url).toBeNull()
  })

  it('5. fronteira do intervalo: covered_from e covered_to contam; um dia antes e um dia depois não', () => {
    const ultima = linha(V1, D0)
    const cob = ambos(V1, addDays(D0, 3), addDays(D0, 5))
    const cobre = (n: number): boolean => fatosDoDia(addDays(D0, n), [], new Map([[V1, ultima]]), cob).repetidos.has(V1)
    expect([2, 3, 4, 5, 6].map(cobre)).toEqual([false, true, true, true, false])
    expect(videosCobertosSemLinha(addDays(D0, 3), [], cob)).toEqual([V1])
    expect(videosCobertosSemLinha(addDays(D0, 2), [], cob)).toEqual([])
    expect(videosCobertosSemLinha(addDays(D0, 6), [], cob)).toEqual([])
  })

  it('6. sem última linha: não entra, e conta', () => {
    const r = fatosDoDia(addDays(D0, 3), [], new Map(), ambos(V1, D0, addDays(D0, 9)))
    expect(r.linhas).toEqual([])
    expect(r.cobertos_sem_linha).toBe(1)
    // Uma "última" que não é anterior ao dia também não serve (contrato quebrado, nunca copiar do futuro).
    const r2 = fatosDoDia(addDays(D0, 3), [], new Map([[V1, linha(V1, addDays(D0, 3))]]), ambos(V1, D0, addDays(D0, 9)))
    expect(r2.linhas).toEqual([])
    expect(r2.cobertos_sem_linha).toBe(1)
  })

  it('6b. vídeo sem linha e sem cobertura não entra, nem conta', () => {
    const r = fatosDoDia(addDays(D0, 3), [], new Map([[V1, linha(V1, D0)]]), [])
    expect(r.linhas).toEqual([])
    expect(r.cobertos_sem_linha).toBe(0)
  })
})

// ── Item 202, parte pura ────────────────────────────────────────────────────────────────────────
// Gerador com semente (mulberry32): 200 sequências de 40 dias por vídeo.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SEMENTE = 20261013
const DIAS = 40
const dhashDe = (n: number): string => (BigInt(n) * 0x9e3779b97f4a7c15n & 0xffffffffffffffffn).toString(16).padStart(16, '0')
const flip = (h: string, bits: number): string => {
  let v = BigInt(`0x${h}`)
  for (let i = 0; i < bits; i++) v ^= 1n << BigInt(i * 7)
  return v.toString(16).padStart(16, '0')
}

interface LinhaSim extends LinhaDiaria { ab_test_id: string | null; seconds: number | null }

function gerarSequencia(rnd: () => number, ytId: string): LinhaSim[] {
  const linhas: LinhaSim[] = []
  const titulos = ['T0', 'T1', 'T2']
  let titulo = 0
  let desc = 'd0'.padEnd(16, '0')
  let base = dhashDe(Math.floor(rnd() * 1e6) + 1)
  let dh = base
  let sha = 's0'
  let priv: LinhaDiaria['privacy_status'] = 'public'
  let ab: string | null = null
  let abFim = -1
  for (let i = 0; i < DIAS; i++) {
    const dia = addDays(D0, i)
    if (rnd() < 0.05) titulo = rnd() < 0.5 ? (titulo + 1) % 3 : 0 // inclui o retorno A, B, A
    if (rnd() < 0.04) desc = `d${Math.floor(rnd() * 1000)}`.padEnd(16, '0')
    if (rnd() < 0.2) dh = flip(base, 1 + Math.floor(rnd() * 2)) // deriva pequena, dentro da âncora
    if (rnd() < 0.04) { base = dhashDe(Math.floor(rnd() * 1e6) + 1); dh = base } // troca grande
    if (rnd() < 0.03) sha = `s${i}` // retoque: mesma imagem, bytes diferentes
    if (rnd() < 0.03) priv = priv === 'private' ? 'public' : rnd() < 0.5 ? 'private' : 'unlisted'
    if (ab === null && rnd() < 0.04) { ab = `ab-${i}`; abFim = i + 2 + Math.floor(rnd() * 3) }
    const emTeste = ab !== null && i <= abFim
    if (ab !== null && i > abFim) ab = null
    const r = rnd()
    if (r < 0.08) continue // dia sem linha para o vídeo
    if (r < 0.14) { // dia sem captura (falha)
      linhas.push({ ...linha(ytId, dia), title_at_capture: null, description_sha256: null, thumbnail_dhash: null, thumbnail_sha256_at_capture: null, thumbnail_blob_url: null, privacy_status: null, ab_test_id: null, seconds: null })
      continue
    }
    linhas.push({
      ...linha(ytId, dia, { title_at_capture: titulos[titulo]!, description_sha256: desc, thumbnail_dhash: dh, thumbnail_sha256_at_capture: sha, thumbnail_blob_url: `https://blob.test/${sha}.jpg`, privacy_status: priv, captured_at: `${addDays(dia, 1)}T${String(10 + Math.floor(rnd() * 8)).padStart(2, '0')}:00:00.000Z` }),
      ab_test_id: emTeste ? ab : null,
      seconds: emTeste ? Math.floor(rnd() * 3) * 100 : 1000,
    })
  }
  return linhas
}

/** Identidade de uma linha para a regra 2: todas as colunas menos `day_pt` e `captured_at`. */
const identidade = (l: LinhaSim): string => {
  const { day_pt: _d, captured_at: _c, ...resto } = l
  void _d; void _c
  return JSON.stringify(Object.keys(resto).sort().map(k => [k, (resto as Record<string, unknown>)[k]]))
}

/** A regra de 4.2 escrita a partir do texto (regras 1 a 4 e 8; a 5 e a 6 valem por construção; a 9 só existe no banco). */
function emagrecer(seq: readonly LinhaSim[], diaGravado: string): LinhaSim[] {
  return seq.filter((c, i) => {
    const p = seq[i - 1]
    const n = seq[i + 1]
    if (p === undefined || n === undefined) return true // regra 1
    if (identidade(p) !== identidade(c) || identidade(n) !== identidade(c)) return true // regra 2
    if (n.day_pt >= diaGravado) return true // regra 3
    if (c.privacy_status === null) return true // regra 4
    if (c.ab_test_id !== null) return true // regra 8
    return false
  })
}

interface VersaoSim { abrir: AberturaSemOrigem; abertaEm: string; ultimoDia: string }

/** Deriva a tabela inteira dia a dia (como o passo): devolve as versões abertas, com o último dia visto de cada uma. */
function derivarTudo(
  dias: readonly string[],
  linhasDoDia: (dia: string) => LinhaDiaria[],
  fatos: (dia: string, ultimas: Map<string, LinhaDiaria>) => LinhaDiaria[],
): { versoes: VersaoSim[]; copiasUsadas: number } {
  let correntes: CorrenteDoCampo[] = []
  const versoes: VersaoSim[] = []
  const ultimas = new Map<string, LinhaDiaria>()
  const privConhecida = new Map<string, FatoDoDia['privacidadeConhecida']>()
  let seq = 0
  let copias = 0
  for (const dia of dias) {
    const reais = linhasDoDia(dia)
    const todas = fatos(dia, ultimas)
    copias += todas.length - reais.length
    const fs: FatoDoDia[] = todas.map(l => ({
      ytId: l.youtube_video_id, dia, videoId: l.video_id, capturadoEm: l.captured_at, privacidade: l.privacy_status,
      privacidadeConhecida: privConhecida.get(l.youtube_video_id) ?? null, titulo: l.title_at_capture, descHash: l.description_sha256,
      dhash: l.thumbnail_dhash, sha256: l.thumbnail_sha256_at_capture, blobUrl: l.thumbnail_blob_url,
    }))
    const plano = derivarDia(correntes, fs)
    if (plano.abrir.length === 0) {
      correntes = aplicarPlanoNasCorrentes(correntes, plano, dia)
    } else {
      const vista = new Map(plano.confirmar.map(c => [c.id, c.vistaEm]))
      const fecham = new Set(plano.abrir.map(a => `${a.ytId}|${a.campo}`))
      correntes = correntes.map(c => {
        if (fecham.has(`${c.ytId}|${c.campo}`)) return c
        const v = vista.get(c.id)
        return v === undefined ? c : { ...c, ultimoDia: dia, vistaAte: v }
      })
      for (const c of correntes.filter(x => fecham.has(`${x.ytId}|${x.campo}`))) {
        const v = versoes.find(x => (x as VersaoSim & { id?: string }).id === c.id)
        if (v) v.ultimoDia = c.ultimoDia
      }
      correntes = correntes.filter(c => !fecham.has(`${c.ytId}|${c.campo}`))
      for (const a of plano.abrir) {
        const id = `v${++seq}`
        correntes.push({ id, ytId: a.ytId, campo: a.campo, hash: a.hash, ancoraDhash: a.thumb?.ancoraDhash ?? null, sha256: a.thumb?.sha256 ?? null, ultimoDia: dia, vistaAte: a.capturadoEm })
        versoes.push(Object.assign({ abrir: a, abertaEm: dia, ultimoDia: dia }, { id }))
      }
    }
    // O fim de cada versão é o último dia em que a corrente foi confirmada.
    for (const c of correntes) {
      const v = versoes.find(x => (x as VersaoSim & { id?: string }).id === c.id)
      if (v) v.ultimoDia = c.ultimoDia
    }
    for (const l of reais) ultimas.set(l.youtube_video_id, l)
    for (const l of todas) if (l.privacy_status !== null) privConhecida.set(l.youtube_video_id, l.privacy_status)
  }
  return { versoes: versoes.map(({ abrir, abertaEm, ultimoDia }) => ({ abrir, abertaEm, ultimoDia })), copiasUsadas: copias }
}

describe('item 202, parte pura: derivar a tabela inteira = derivar a tabela emagrecida com fatosDoDia', () => {
  const dias = Array.from({ length: DIAS }, (_, i) => addDays(D0, i))
  const diaGravado = dias[DIAS - 1]!

  function umaSequencia(n: number): void {
    const rnd = mulberry32(SEMENTE + n)
    const ytId = `v${String(n).padStart(10, '0')}`
    const inteira = gerarSequencia(rnd, ytId)
    const magra = emagrecer(inteira, diaGravado)
    // A cobertura é a mesma que a MG17a daria à tabela inteira: os dias com captura, por conjunto.
    const cob: IntervaloMeta[] = []
    const runs = (set: IntervaloMeta['metric_set'], tem: (l: LinhaSim) => boolean): void => {
      let ini: string | null = null
      let ant: string | null = null
      for (const dia of dias) {
        const l = inteira.find(x => x.day_pt === dia)
        const ok = l !== undefined && tem(l)
        if (ok && ini === null) ini = dia
        if (!ok && ini !== null) { cob.push(iv(ytId, set, ini, ant!)); ini = null }
        if (ok) ant = dia
      }
      if (ini !== null) cob.push(iv(ytId, set, ini, ant!))
    }
    runs('meta_texto', l => l.privacy_status !== null)
    runs('meta_thumb', l => l.thumbnail_dhash !== null)

    const A = derivarTudo(dias, d => inteira.filter(l => l.day_pt === d), (d, _u) => inteira.filter(l => l.day_pt === d))
    const B = derivarTudo(
      dias,
      d => magra.filter(l => l.day_pt === d),
      (d, ultimas) => fatosDoDia(d, magra.filter(l => l.day_pt === d), ultimas, cob).linhas,
    )
    expect(B.versoes, `sequência ${n}`).toEqual(A.versoes)
    if (magra.length < inteira.length) expect(B.copiasUsadas).toBeGreaterThan(0)
  }

  it('7. 200 sequências de 40 dias (semente fixa): as mesmas versões, em todas as colunas que a função pura produz', () => {
    let emagreceu = 0
    for (let n = 0; n < 200; n++) {
      umaSequencia(n)
      const rnd = mulberry32(SEMENTE + n)
      const s = gerarSequencia(rnd, 'x')
      if (emagrecer(s, diaGravado).length < s.length) emagreceu++
    }
    // O gerador exercita de verdade a dieta (senão a igualdade seria trivial).
    expect(emagreceu).toBeGreaterThan(100)
  })

  it('9. a sequência A, B, A dá três versões de título nas duas derivações (item 199)', () => {
    const t = ['A', 'A', 'A', 'B', 'B', 'B', 'A', 'A', 'A', 'A']
    const inteira: LinhaSim[] = t.map((x, i) => ({ ...linha(V1, addDays(D0, i), { title_at_capture: x }), ab_test_id: null, seconds: 1000 }))
    const d10 = dias.slice(0, t.length)
    const magra = emagrecer(inteira, d10[d10.length - 1]!)
    expect(magra.length).toBeLessThan(inteira.length)
    const cob = ambos(V1, D0, addDays(D0, t.length - 1))
    const titulos = (r: ReturnType<typeof derivarTudo>): string[] => r.versoes.filter(v => v.abrir.campo === 'title').map(v => v.abrir.tituloOuNulo ?? '')
    const A = derivarTudo(d10, d => inteira.filter(l => l.day_pt === d), (d) => inteira.filter(l => l.day_pt === d))
    const B = derivarTudo(d10, d => magra.filter(l => l.day_pt === d), (d, u) => fatosDoDia(d, magra.filter(l => l.day_pt === d), u, cob).linhas)
    expect(titulos(A)).toEqual(['A', 'B', 'A'])
    expect(titulos(B)).toEqual(['A', 'B', 'A'])
    expect(B.versoes).toEqual(A.versoes)
    void hashValue
  })
})

describe('last_day_pt pela cobertura', () => {
  function correntes(): CorrenteDoCampo[] {
    const base = { ytId: V1, ultimoDia: D0, vistaAte: cap(D0) }
    return [
      { ...base, id: 'c-title', campo: 'title', hash: hashValue('Título A'), ancoraDhash: null, sha256: null },
      { ...base, id: 'c-desc', campo: 'desc', hash: 'd'.repeat(16), ancoraDhash: null, sha256: null },
      { ...base, id: 'c-thumb', campo: 'thumb', hash: H0, ancoraDhash: H0, sha256: 's1' },
    ]
  }
  const avancar = (dia: string, cobertura: IntervaloMeta[]): string => {
    const ultima = linha(V1, D0)
    const f = fatosDoDia(dia, [], new Map([[V1, ultima]]), cobertura).linhas
    const fs: FatoDoDia[] = f.map(l => ({
      ytId: l.youtube_video_id, dia, videoId: l.video_id, capturadoEm: l.captured_at, privacidade: l.privacy_status, privacidadeConhecida: null,
      titulo: l.title_at_capture, descHash: l.description_sha256, dhash: l.thumbnail_dhash, sha256: l.thumbnail_sha256_at_capture, blobUrl: l.thumbnail_blob_url,
    }))
    const plano = derivarDia(correntes(), fs)
    return aplicarPlanoNasCorrentes(correntes(), plano, dia).map(c => c.ultimoDia).join(',')
  }

  it('8. dia coberto sem linha avança last_day_pt; dia não coberto não avança', () => {
    const dia = addDays(D0, 2)
    expect(avancar(dia, ambos(V1, D0, addDays(D0, 5)))).toBe(`${dia},${dia},${dia}`)
    expect(avancar(dia, [])).toBe(`${D0},${D0},${D0}`)
    expect(avancar(dia, ambos(V1, addDays(D0, 3), addDays(D0, 5)))).toBe(`${D0},${D0},${D0}`)
  })
})
