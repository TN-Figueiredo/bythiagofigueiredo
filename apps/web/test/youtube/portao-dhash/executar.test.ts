// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { Diario, type Estado, type Fase, type Medida } from '@/lib/youtube/portao-dhash/diario'
import { dhashComoHq, gerarImagemTeste } from '@/lib/youtube/portao-dhash/imagem'
import { ensaio, valer, devolver, conferir, montarResultado, type Deps } from '@/lib/youtube/portao-dhash/executar'
import { Recusa } from '@/lib/youtube/portao-dhash/regras'
import type { Escritor } from '@/lib/youtube/portao-dhash/youtube'
import { imagemSintetica, respostaImagem, fetchFalso } from './util'

const H = 3_600_000
const VIDEO = '6jL-jeux_1Y'

async function mundo(o: { atrasoMs: number; semMaxres?: boolean; maxresAntiga?: boolean; falhasTroca?: number; falhasDevolucao?: number; video?: { canal: string; privacidade: string } | null }) {
  const original = await imagemSintetica(1280, 720, 3)
  const hq = await sharp(original).resize(480, 360, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
  const sd = await sharp(original).resize(640, 480, { fit: 'contain', background: '#000' }).jpeg().toBuffer()
  const maxres = o.maxresAntiga ? await imagemSintetica(1280, 720, 9) : original
  let t = 1_000_000
  const escritas: { em: number; bytes: Buffer }[] = []
  let falhasTroca = o.falhasTroca ?? 0, falhasDev = o.falhasDevolucao ?? 0
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'portao-'))
  const diario = new Diario(pasta, () => t)
  const esc: Escritor = {
    canal: 'UC_dono',
    conferirVideo: vi.fn(async () => (o.video === undefined ? { canal: 'UC_dono', privacidade: 'public' } : o.video)),
    definirThumb: vi.fn(async (_v: string, b: Buffer) => {
      const ehTroca = escritas.length === 0 && !fs.existsSync(path.join(pasta, 'estado.json')) ? false : JSON.parse(fs.readFileSync(path.join(pasta, 'estado.json'), 'utf8')).fase === 'trocando'
      if (ehTroca && falhasTroca-- > 0) throw new Error('rede caiu na troca')
      if (!ehTroca && falhasDev-- > 0) throw new Error('rede caiu na devolução')
      escritas.push({ em: t, bytes: b })
    }),
  }
  const visivel = () => [...escritas].reverse().find((e) => t >= e.em + o.atrasoMs)?.bytes ?? original
  const d: Deps = {
    video: VIDEO, diario,
    f: fetchFalso({ ...(o.semMaxres ? {} : { maxresdefault: respostaImagem(maxres) }), sddefault: respostaImagem(sd), hqdefault: respostaImagem(hq) }),
    sondar: async () => ({ dhash: await dhashComoHq(visivel()), etag: null }),
    escritor: vi.fn(async () => esc),
    agora: () => t,
    dormir: async (ms) => { t += ms },
    sinal: { parar: false },
    log: () => {},
  }
  return { d, esc, escritas, original, pasta, agora: () => t }
}

/** Pasta montada à mão, como um processo morto a deixaria. */
async function semear(m: Awaited<ReturnType<typeof mundo>>, fase: Fase): Promise<Estado> {
  const sha = m.d.diario.salvarUmaVez('original-maior.jpg', m.original)
  const teste = await gerarImagemTeste(m.original)
  const dh = await dhashComoHq(m.original)
  const dt = await dhashComoHq(teste)
  const e: Estado = {
    versao: 1, video: VIDEO, fase, criadoEm: 'x', atualizadoEm: 'x',
    original: { variante: 'maxresdefault', largura: 1280, altura: 720, sha256: sha, sha256Hq: 'h', dhashHq: dh },
    teste: { sha256: 't', dhashComoHq: dt, distanciaDoOriginal: 40 },
    trocaEm: fase === 'preparado' ? null : m.agora(), devolucaoEm: fase === 'devolvida_sem_conferir' ? m.agora() : null,
    cotaGasta: 51, tentativasDevolucao: 0, aparicao: null, volta: null,
  }
  m.d.diario.gravar(e)
  return e
}

const lerEstado = (pasta: string) => JSON.parse(fs.readFileSync(path.join(pasta, 'estado.json'), 'utf8')) as Estado

describe('ensaio', () => {
  it('não chama o escritor, não cria nada na pasta, código 0', async () => {
    const m = await mundo({ atrasoMs: 0 })
    const s = await ensaio(m.d, false)
    expect(s.codigo).toBe(0)
    expect(m.d.escritor).not.toHaveBeenCalled()
    expect(fs.readdirSync(m.pasta)).toEqual([])
  })
})

describe('valer', () => {
  it('caminho feliz: teste, depois a original exata; conferida; cota 101', async () => {
    const m = await mundo({ atrasoMs: 2 * H })
    const s = await valer(m.d, false)
    expect(s.codigo).toBe(0)
    expect(m.escritas).toHaveLength(2)
    expect(m.escritas[0]!.bytes.equals(m.d.diario.lerArquivo('teste-1280x720.jpg'))).toBe(true)
    expect(m.escritas[1]!.bytes.equals(m.d.diario.lerArquivo('original-maior.jpg'))).toBe(true)
    expect(m.escritas[1]!.bytes.equals(m.original)).toBe(true)
    const e = lerEstado(m.pasta)
    expect(e.fase).toBe('conferida')
    expect(e.cotaGasta).toBe(101)
    const dt = e.aparicao!.estavelEm! - e.trocaEm!
    expect(dt).toBeGreaterThanOrEqual(2 * H)
    expect(dt).toBeLessThanOrEqual(2 * H + 5 * 60_000)
    const r = fs.readFileSync(path.join(m.pasta, 'resultado.md'), 'utf8')
    expect(r).toContain('(iii)')
    expect(r).toContain('confirmada')
  })

  it('a cópia e o estado existem antes da troca (fase trocando)', async () => {
    const m = await mundo({ atrasoMs: 0 })
    let visto: { copia: boolean; fase: string } | null = null
    const orig = m.esc.definirThumb
    m.esc.definirThumb = vi.fn(async (v: string, b: Buffer) => {
      if (!visto) visto = { copia: fs.existsSync(path.join(m.pasta, 'original-maior.jpg')), fase: lerEstado(m.pasta).fase }
      return orig(v, b)
    })
    await valer(m.d, false)
    expect(visto).toEqual({ copia: true, fase: 'trocando' })
  })

  it('teto: devolve mesmo assim e sai com código 1', async () => {
    const m = await mundo({ atrasoMs: 13 * H })
    const s = await valer(m.d, false)
    const e = lerEstado(m.pasta)
    expect(e.aparicao!.motivo).toBe('teto')
    expect(m.escritas).toHaveLength(2)
    expect(s.codigo).toBe(1)
  })

  it('Ctrl-C durante a medida: devolve a original, devolvida_sem_conferir, código 1', async () => {
    const m = await mundo({ atrasoMs: 2 * H })
    const sondar = m.d.sondar
    let n = 0
    m.d.sondar = async (v) => { if (++n === 3) m.d.sinal.parar = true; return sondar(v) }
    const s = await valer(m.d, false)
    expect(m.escritas).toHaveLength(2)
    expect(m.escritas[1]!.bytes.equals(m.original)).toBe(true)
    expect(lerEstado(m.pasta).fase).toBe('devolvida_sem_conferir')
    expect(s.codigo).toBe(1)
  })

  it('sonda que lança conta como sem_dado e a medida continua', async () => {
    const m = await mundo({ atrasoMs: 0 })
    const sondar = m.d.sondar
    let n = 0
    m.d.sondar = async (v) => { if (++n === 1) throw new Error('rede'); return sondar(v) }
    await valer(m.d, false)
    const e = lerEstado(m.pasta)
    expect(e.aparicao!.semDado).toBe(1)
    expect(e.aparicao!.motivo).toBe('estavel')
  })

  it('a troca lança: a original é devolvida mesmo assim (2 chamadas)', async () => {
    const m = await mundo({ atrasoMs: 0, falhasTroca: 1 })
    await valer(m.d, false)
    expect(m.esc.definirThumb).toHaveBeenCalledTimes(2)
    expect(m.escritas).toHaveLength(1)
    expect(m.escritas[0]!.bytes.equals(m.original)).toBe(true)
  })

  it('a devolução falha duas vezes: devolucao_falhou, código 3, 3 chamadas, mensagem com o comando', async () => {
    const m = await mundo({ atrasoMs: 0, falhasDevolucao: 2 })
    const s = await valer(m.d, false)
    expect(lerEstado(m.pasta).fase).toBe('devolucao_falhou')
    expect(s.codigo).toBe(3)
    expect(m.esc.definirThumb).toHaveBeenCalledTimes(3)
    expect(s.mensagem).toContain(`devolver ${VIDEO}`)
    expect(s.mensagem).toContain('original-maior.jpg')
  })

  it('pasta já usada: Recusa sem chamar o escritor', async () => {
    const m = await mundo({ atrasoMs: 0 })
    fs.writeFileSync(path.join(m.pasta, 'qualquer.txt'), 'x')
    await expect(valer(m.d, false)).rejects.toBeInstanceOf(Recusa)
    expect(m.d.escritor).not.toHaveBeenCalled()
  })

  it('sem maxres: recusa sem --aceitar-menor; com ela segue com sddefault', async () => {
    const a = await mundo({ atrasoMs: 0, semMaxres: true })
    await expect(valer(a.d, false)).rejects.toBeInstanceOf(Recusa)
    expect(a.d.escritor).not.toHaveBeenCalled()
    const b = await mundo({ atrasoMs: 0, semMaxres: true })
    await valer(b.d, true)
    expect(lerEstado(b.pasta).original.variante).toBe('sddefault')
  })

  it('maxres antiga (outra imagem): recusa, sem escritor e sem arquivo', async () => {
    const m = await mundo({ atrasoMs: 0, maxresAntiga: true })
    await expect(valer(m.d, false)).rejects.toBeInstanceOf(Recusa)
    expect(m.d.escritor).not.toHaveBeenCalled()
    expect(m.d.diario.temAlgo()).toBe(false)
  })

  it.each([
    ['null', null],
    ['outro canal', { canal: 'UC_outro', privacidade: 'public' }],
    ['unlisted', { canal: 'UC_dono', privacidade: 'unlisted' }],
  ])('videos.list %s: recusa sem definirThumb e sem arquivo', async (_n, video) => {
    const m = await mundo({ atrasoMs: 0, video })
    await expect(valer(m.d, false)).rejects.toBeInstanceOf(Recusa)
    expect(m.esc.definirThumb).not.toHaveBeenCalled()
    expect(m.d.diario.temAlgo()).toBe(false)
  })
})

describe('devolver', () => {
  it('depois de processo morto (fase trocada): sobe a original e chega a conferida', async () => {
    const m = await mundo({ atrasoMs: 0 })
    await semear(m, 'trocada')
    const s = await devolver(m.d)
    expect(m.escritas).toHaveLength(1)
    expect(m.escritas[0]!.bytes.equals(m.original)).toBe(true)
    expect(lerEstado(m.pasta).fase).toBe('conferida')
    expect(s.codigo).toBe(1) // sem aparição medida: devolvido, sem conclusão
  })
  it('fase preparado: nada foi escrito, sem escritor', async () => {
    const m = await mundo({ atrasoMs: 0 })
    await semear(m, 'preparado')
    const s = await devolver(m.d)
    expect(s.mensagem).toContain('nada foi escrito')
    expect(m.d.escritor).not.toHaveBeenCalled()
  })
  it('sem estado: recusa', async () => {
    const m = await mundo({ atrasoMs: 0 })
    await expect(devolver(m.d)).rejects.toBeInstanceOf(Recusa)
  })
})

describe('conferir', () => {
  it('mede a volta e grava conferida', async () => {
    const m = await mundo({ atrasoMs: 0 })
    await semear(m, 'devolvida_sem_conferir')
    await conferir(m.d)
    const e = lerEstado(m.pasta)
    expect(e.fase).toBe('conferida')
    expect(e.volta!.motivo).toBe('estavel')
    expect(m.d.escritor).not.toHaveBeenCalled()
  })
})

describe('montarResultado', () => {
  it('teto com menor distância 9: FALHOU', async () => {
    const m = await mundo({ atrasoMs: 0 })
    const e = await semear(m, 'conferida')
    const med: Medida = { motivo: 'teto', primeiraEm: null, estavelEm: null, distanciaNaEstavel: null, menorDistancia: 9, sondas: 10, outras: 10, semDado: 0, lacunas: 0 }
    e.aparicao = med
    expect(montarResultado(e)).toContain('FALHOU: a tolerância é decidida com o dono')
  })
})
