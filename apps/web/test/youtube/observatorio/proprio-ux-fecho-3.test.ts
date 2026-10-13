// @vitest-environment node
/**
 * Onda de consertos de UX da A4, rodada 3 (revisão de 13/10): K1 (a pastilha "não medido" da régua tem folga), K4 (sem jargão do sistema nas dicas do ⓘ)
 * e a regra única de "vídeo novo" (serie-video.ts chama `videoNovo`, não escreve o limite à mão). K2, K3 e K5 têm as suas expectativas nos testes dos modelos.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { serieDoVideo } from '@/lib/youtube/observatorio/proprio/serie-video'
import { videoNovo } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'

const SRC = path.resolve(__dirname, '../../../src')
const PROPRIO = path.join(SRC, 'app/cms/(authed)/youtube/competitors/_proprio')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

describe('K1: a pastilha "não medido" da coluna do valor da régua cabe com folga (1440 px)', () => {
  const css = semComentario(fs.readFileSync(path.join(PROPRIO, 'reguas.css'), 'utf8'))
  const largura = (re: RegExp) => Number(css.match(re)![1])
  // fora do bloco estreito: o primeiro .vb-rg-v é o da tabela
  const v = largura(/\.vb-rg-v\{width:(\d+)px/)
  const pad = largura(/\.vb-rg-v\{[^}]*padding-right:(\d+)px/)
  const hv = largura(/thead \.vb-rg-hv\{width:(\d+)px/)
  const pastilha = css.match(/\.vb-rg-v \.obs-ch-nm\{([^}]*)\}/)

  it('a pastilha da coluna tem regra própria: 12 px, 4 px de respiro lateral (menor que a global, que passa de 96 px)', () => {
    expect(pastilha, 'regra .vb-rg-v .obs-ch-nm').not.toBeNull()
    expect(pastilha![1]).toMatch(/font-size:12px/)
    expect(pastilha![1]).toMatch(/padding:1px 4px/)
  })
  it('a coluna é larga o bastante: conteúdo útil (largura menos o respiro à direita) de pelo menos 104 px, e o cabeçalho da tabela acompanha', () => {
    expect(v - pad).toBeGreaterThanOrEqual(104)
    expect(hv).toBe(v)
  })
  it('a pastilha mais larga ("não medido" em 12 px monoespaçado, 4 px de respiro, 1 px de borda) cabe com folga na coluna', () => {
    const texto = 'não medido'.length * 12 * 0.62 // monoespaçada: ~0,62 em por caractere (margem alta)
    const caixa = texto + 2 * 4 + 2
    expect(caixa + 4).toBeLessThanOrEqual(v - pad)
  })
})

describe('K4: nenhuma dica do ⓘ fala a língua do sistema ("O motor", "lido/lida")', () => {
  const ARQUIVOS = ['video-model.ts', 'impressoes-model.ts']
  const PROIBIDAS: Array<[RegExp, string]> = [
    [/O motor não calculou/, '"O motor": é "Não foi possível calcular o múltiplo deste vídeo"'],
    [/o relatório foi lido/, '"o relatório foi lido": é "foi recebido"'],
    [/lida? junto com as views/, '"lida junto com as views": é "atualizada junto com as views"'],
    [/ainda não foi lida/, '"ainda não foi lida": é "ainda não foi recebida"'],
    [/, lida em /, '"lida em": é "atualizada em"'],
  ]
  it.each(ARQUIVOS)('%s', f => {
    const s = fs.readFileSync(path.join(PROPRIO, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    for (const [re, porque] of PROIBIDAS) expect(re.test(s), `${f}: ${porque}`).toBe(false)
  })
  it('a redação do parecer está lá', () => {
    const vm = fs.readFileSync(path.join(PROPRIO, 'video-model.ts'), 'utf8')
    expect(vm).toContain('Não foi possível calcular o múltiplo deste vídeo')
    expect(vm).toContain('atualizada junto com as views')
    expect(fs.readFileSync(path.join(PROPRIO, 'impressoes-model.ts'), 'utf8')).toContain('o relatório foi recebido e')
  })
})

describe('regra única de "vídeo novo": a série do vídeo usa a mesma função da página, do cartão, da lista e da régua', () => {
  it('serie-video.ts não compara o limite à mão: chama videoNovo', () => {
    const s = semComentario(fs.readFileSync(path.join(SRC, 'lib/youtube/observatorio/proprio/serie-video.ts'), 'utf8'))
    expect(s).toMatch(/\bvideoNovo\(/)
    expect(s).not.toMatch(/<\s*DIAS_DE_VIDA_MIN/)
  })
  const HOJE = '2026-09-20'
  const diario = (ultimoDia: string): Privado<DiarioCanal> => ({
    acesso: 'ok',
    dado: { canalId: 'c', ultimoDia, linhas: [{ ytId: 'v', dia: ultimoDia, views: 5, pctAssistido: 40, duracaoMediaSeg: 120 }], descartados: 0 },
  })
  it.each([0, 1, 2, 3, 4, 10])('publicado há %i dias: a série e videoNovo concordam (novo só com menos de 3 dias)', n => {
    const pub = addDays(HOJE, -n)
    const novo = videoNovo(pub, HOJE)
    expect(novo).toBe(n < 3)
    expect(serieDoVideo(diario(addDays(HOJE, -3)), { ytId: 'v', publicadoEm: pub, hoje: HOJE }).estado === 'video-novo').toBe(novo)
  })
  it('sem data de publicação nunca é vídeo novo', () => {
    expect(serieDoVideo(diario(addDays(HOJE, -3)), { ytId: 'v', publicadoEm: null, hoje: HOJE }).estado).not.toBe('video-novo')
  })
})
