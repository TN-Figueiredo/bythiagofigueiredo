// @vitest-environment node
/** Guarda de CSS da fase A0 (spec 19.1 item 2 e 19.2): escala de camadas num arquivo só, tokens novos, sem color-mix. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const cssFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : [])
const numericos = (f: string) => (semComentario(fs.readFileSync(f, 'utf8')).match(/z-index\s*:\s*-?\d+/g) ?? []).length

/** Arquivos que nasceram na fase A: nenhum z-index numérico. A lista cresce a cada fase. */
const NOVOS = ['_chrome/tokens-telas.css', '_chrome/flut/flut.css', '_chrome/kit.css']
/** z-index numéricos nos arquivos antigos em 10/10/2026, antes da A0 (34 declarações; a 35ª linha do grep é um comentário). Catraca: só pode cair. */
const TETO_ANTIGOS = 29 // 34 → 31 na Tarefa 4 (Canais: .tt 40, :has 3, .menu 30 saíram) → 29 na Tarefa 5 (moldura: .obs-ch-pop 40, .fx-hint 30 saíram)

describe('Observatório · escala de camadas', () => {
  const camadas = semComentario(read('_chrome/camadas.css'))
  it('a escala tem os nove níveis do spec, com os valores do spec', () => {
    const esperado: Record<string, string> = { fundo: '0', conteudo: '1', marca: '2', 'marca-alta': '3', 'marca-topo': '4', grudado: '10', flutuante: '1000', aviso: '1100', modal: '2000' }
    for (const [k, v] of Object.entries(esperado)) expect(camadas, k).toMatch(new RegExp(`--z-${k}\\s*:\\s*${v}\\s*[;}]`))
  })
  it('#flut é fixo, cobre a janela, usa a variável e não captura clique', () => {
    const regra = camadas.match(/#flut\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(regra).toMatch(/position\s*:\s*fixed/)
    expect(regra).toMatch(/inset\s*:\s*0/)
    expect(regra).toMatch(/z-index\s*:\s*var\(--z-flutuante\)/)
    expect(regra).toMatch(/pointer-events\s*:\s*none/)
  })
  it('arquivo novo não tem z-index numérico', () => {
    for (const f of NOVOS) if (fs.existsSync(path.join(DIR, f))) expect(numericos(path.join(DIR, f)), f).toBe(0)
  })
  it('catraca: os z-index numéricos dos arquivos antigos só diminuem', () => {
    const antigos = cssFiles(DIR).filter(f => !NOVOS.some(n => f.endsWith(n)) && !f.endsWith('camadas.css'))
    expect(antigos.reduce((n, f) => n + numericos(f), 0)).toBeLessThanOrEqual(TETO_ANTIGOS)
  })
})

describe('Observatório · tokens das telas novas', () => {
  const tokens = semComentario(read('_chrome/tokens-telas.css'))
  it('cada token do spec 19.2 existe com o valor do spec', () => {
    const esperado: Record<string, string> = { nm: '#E59CC0', 'nm-line': '#B0678F', 'nm-bg': '#3A2232', 'lado-o': '#FF8240', 'lado-b': '#7CC8F8', 'lado-n': '#D9C08F', 'terco-baixo': '#F2C14E', 'im-cl': '#38BDF8', 'im-zero': '#7A8FA6' }
    for (const [k, v] of Object.entries(esperado)) expect(tokens, k).toMatch(new RegExp(`--${k}\\s*:\\s*${v}\\s*[;}]`, 'i'))
  })
  it('"não medido" tem forma além da cor: hachura', () => {
    expect(tokens).toMatch(/\.obs-ch-nm\s*\{[^}]*repeating-linear-gradient/)
  })
  it('nenhum CSS do Observatório usa color-mix()', () => {
    for (const f of cssFiles(DIR)) expect(semComentario(fs.readFileSync(f, 'utf8')), f).not.toMatch(/color-mix\s*\(/)
  })
})
