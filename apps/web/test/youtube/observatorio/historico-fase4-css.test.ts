// @vitest-environment node
// The stylesheet of "histórico com muitas versões" (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 9).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors')
const hist = fs.readFileSync(path.join(DIR, '_historico/historico.css'), 'utf8'), mud = fs.readFileSync(path.join(DIR, '_mudancas/mudancas.css'), 'utf8')
const tsx = (dir: string) => fs.readdirSync(path.join(DIR, dir)).filter(f => f.endsWith('.tsx')).map(f => fs.readFileSync(path.join(DIR, dir, f), 'utf8')).join('\n')
const rule = (css: string, sel: string) => css.split('\n').find(l => l.startsWith('[data-obs-screen="historico"] ' + sel + '{')) ?? ''

describe('historico.css e mudancas.css depois da Fase 4', () => {
  it('nenhum color-mix() (o Opera desenha transparente)', () => {
    expect(hist.includes('color-mix')).toBe(false)
    expect(mud.includes('color-mix')).toBe(false)
  })
  it('toda classe nova que os componentes usam tem regra na folha da tela', () => {
    const NEW = ['seg', 'rng-ctl', 'rng-l', 'rng-txt', 'sm', 'gwrap', 'cgrp', 'sl', 'gl', 'gn', 'mkg', 'mtick', 'mspan', 'gpop', 'gk', 'g1', 'g2', 'hint', 'runrow', 'runb', 'rl', 'swrun', 'swgrp',
      'isum-card', 'isum-sc', 'isum', 'isum-c', 'isum-b', 'strip', 'isum-n', 'more-row', 'target', 'cmp-sum', 'flt', 'flt-g', 'flt-l', 'cmp-count', 'cmpx', 'clist', 'cdet', 'cmp-empty', 'seqline', 'three']
    const used = tsx('_historico')
    for (const c of NEW) {
      expect([c, new RegExp('[\'" ]' + c + '[\'" ]').test(used)], 'classe sem uso: ' + c).toEqual([c, true])
      // the group list lives in #flut now: its rule is written on .hv-gpop (the markup keeps both classes)
      const rx = c === 'gpop' ? '\\.hv-gpop' : '\\.' + c
      expect([c, new RegExp(rx + '(?![\\w-])').test(hist)], 'classe sem regra: ' + c).toEqual([c, true])
    }
  })
  it('toda regra da Fase 4 fica dentro da tela: nenhum seletor solto', () => {
    const block = hist.slice(hist.indexOf('/* ===== Fase 4'))
    expect(block.length).toBeGreaterThan(5000)
    const sels = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0]!.trim()).filter(Boolean)
    for (const s of sels) for (const one of s.split(',')) expect(one.trim().startsWith('[data-obs-screen="historico"]'), one).toBe(true)
  })
  it('o período estreito antigo (.clip.tiny, 32 px por cima do vizinho) saiu da folha e dos componentes', () => {
    expect(hist.includes('.clip.tiny')).toBe(false)
    expect(/clip tiny|spread\(/.test(tsx('_historico'))).toBe(false)
  })
  it('o botão escolhido de um filtro não muda de largura: sem negrito (revisão visual r2, N6)', () => {
    const r = rule(hist, '.seg button[aria-pressed="true"]')
    expect(r).not.toBe('')
    expect(r.includes('font-weight')).toBe(false)
  })
  it('o botão do resumo por imagem não encolhe (a imagem ficava com 16 px ao lado de "no ar") e tem largura mínima sem imagem', () => {
    const b = rule(hist, '.isum-b'), img = rule(hist, '.isum-b img')
    expect(b).toMatch(/flex:none/)
    expect(b).toMatch(/min-width:var\(--f4-hit\)/)
    expect(img).toMatch(/flex:none/)
  })
  it('a lista de um grupo fechado some por [hidden], e a barra da sequência fica por cima das linhas verticais', () => {
    expect(hist).toMatch(/\[data-obs-screen="historico"\] \[hidden\]\{display:none!important\}/)
    expect(rule(hist, '.runrow')).toMatch(/z-index:2/)
  })
})
