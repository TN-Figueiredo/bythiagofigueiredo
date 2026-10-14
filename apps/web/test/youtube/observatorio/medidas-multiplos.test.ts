// @vitest-environment node
// A5 · E7, Tarefa 11b: os múltiplos de M4 por canal, o módulo neutro (a rota do Cowork e as telas derivam do mesmo lugar).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { a3World } from './a3-fixture'
import { multiplosDoCanal } from '@/lib/youtube/observatorio/medidas-multiplos'

const { obs } = a3World()
const CANAIS = obs.channels.map(c => c.id)
const AGORA = obs.NOW

describe('multiplosDoCanal', () => {
  it('só os vídeos do canal, valor do motor, base fraca por falta', () => {
    const [c1, c2] = CANAIS.filter(id => obs.videos.some(v => v.ch === id))
    expect(c1).toBeDefined(); expect(c2).toBeDefined()
    const m1 = multiplosDoCanal(obs, c1!, AGORA)
    const ids2 = new Set(obs.videos.filter(v => v.ch === c2).map(v => v.id))
    for (const id of m1.keys()) expect(ids2.has(id)).toBe(false)
    expect(m1.size).toBe(obs.videos.filter(v => v.ch === c1).length)
    for (const v of obs.videos.filter(x => x.ch === c1)) {
      const e = obs.multiplier(v.id)
      expect(m1.get(v.id)).toEqual({ valor: e.value, baseFraca: e.weak })
    }
  })

  it('vídeo sem múltiplo sai valor nulo e base fraca; vídeo com base fraca mantém o valor', () => {
    const alvo = obs.videos.find(v => v.mult?.value == null)
    expect(alvo).toBeDefined()
    expect(multiplosDoCanal(obs, alvo!.ch, AGORA).get(alvo!.id)).toEqual({ valor: null, baseFraca: true })
    const fraco = obs.videos.find(v => v.mult?.value != null && v.mult.weak)
    if (fraco) expect(multiplosDoCanal(obs, fraco.ch, AGORA).get(fraco.id)).toEqual({ valor: fraco.mult!.value, baseFraca: true })
  })

  it('motor sem o campo de múltiplo: o vídeo sai nulo com base fraca, sem lançar', () => {
    const v = obs.videos[0]!
    const falso = { videos: [{ id: v.id, ch: v.ch, mult: null }] }
    expect(multiplosDoCanal(falso, v.ch, AGORA).get(v.id)).toEqual({ valor: null, baseFraca: true })
  })

  it('canal sem vídeo ou desconhecido: mapa vazio', () => {
    expect(multiplosDoCanal(obs, 'canal-que-nao-existe', AGORA).size).toBe(0)
    expect(multiplosDoCanal({ videos: [] }, CANAIS[0]!, AGORA).size).toBe(0)
  })

  it('o instante não entra na conta: dois agoraMs dão o mesmo mapa (resposta m da Tarefa 10)', () => {
    const c = obs.videos[0]!.ch
    const a = multiplosDoCanal(obs, c, AGORA)
    const b = multiplosDoCanal(obs, c, AGORA + 400 * 86_400_000)
    expect([...b]).toEqual([...a])
  })

  it('não muda o motor (nada é escrito nos vídeos)', () => {
    const antes = JSON.stringify(obs.videos.map(v => v.mult))
    multiplosDoCanal(obs, obs.videos[0]!.ch, AGORA)
    expect(JSON.stringify(obs.videos.map(v => v.mult))).toBe(antes)
  })
})

describe('medidas-multiplos.ts é neutro', () => {
  // só o código: os comentários podem citar o que o módulo não faz
  const texto = readFileSync(join(process.cwd(), 'src/lib/youtube/observatorio/medidas-multiplos.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  it('sem server-only, next, banco nem serviço do pipeline', () => {
    for (const proibido of ['server-only', 'next/', '@/lib/supabase', '@/lib/pipeline', '@supabase/'])
      expect(texto).not.toContain(proibido)
  })
  it('não recalcula: usa o múltiplo que o motor já gravou', () => {
    expect(texto).not.toMatch(/multiplierAt\(|median\(/)
  })
})
