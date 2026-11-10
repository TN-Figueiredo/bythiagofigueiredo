// @vitest-environment node
/**
 * A5 F0.5a, commit 0: a REDE da regra "a F0.5 não muda estado de célula" (Yannis I1, Phil) e a linha de base do portão do JSON do diálogo (D3).
 * Gravado contra o código de ANTES do conserto; depois dele tem de continuar verde sem regravar o arquivo de estados.
 */
import { describe, it, expect } from 'vitest'
import { casosDeCanais, mundoComCanais, pacoteDe, privadoDe, extrasDe } from './contexto-ia-x-fixture'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import type { Celula, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'

const LETRA: Record<string, string> = { medido: 'M', zero_medido: 'Z', nao_medido: 'n', falhou: 'f', restrito: 'r' }
const letra = (c: Celula): string => (c.papel === 'numero' ? LETRA[c.estado]! : '.')

/** tabela/coluna → uma letra por linha (M medido, Z zero medido, n não medido, f falhou, r restrito, . não é número). Texto de célula medida entra junto (muda-se o estado ou o texto, cai). */
export function mapaDeEstados(p: PacoteModelo): string[] {
  return p.tabelas.flatMap((t) => t.colunas.map((col, j) => {
    const letras = t.linhas.map((l) => letra(l[j]!)).join('')
    const textos = t.linhas.map((l) => { const c = l[j]!; return c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') ? c.texto : '' }).join('|')
    return `${t.id}/${col}: ${letras} ${textos}`
  }))
}

describe('canais: estados iguais (rede da F0.5a)', () => {
  it('o mapa tabela/coluna/linha → estado e texto das fixtures é o de antes do conserto', async () => {
    const saida = casosDeCanais().map((c) => `## ${c.nome}\n${mapaDeEstados(pacoteDe(c)).join('\n')}`).join('\n\n') + '\n'
    await expect(saida).toMatchFileSnapshot('__snapshots__/contexto-ia-x-estados-canais.txt')
  })
  it('a rede enxerga: trocar o estado de uma célula muda o mapa', () => {
    const c = casosDeCanais()[0]!
    const p = pacoteDe(c)
    const antes = mapaDeEstados(p).join('\n')
    const cel = p.tabelas.find((t) => t.id === 'canais')!.linhas[0]!.find((x) => x.papel === 'numero')!
    ;(cel as { estado: string }).estado = cel.estado === 'medido' ? 'zero_medido' : 'medido'
    expect(mapaDeEstados(p).join('\n')).not.toBe(antes)
  })
})

describe('portão do JSON do diálogo (D3): linhas da principal que ficam no diálogo `todos`', () => {
  const PERGUNTA = ''
  /** Linhas da tabela principal `canais` que sobram no texto da cópia (degrau do corte e linhas de fato no bloco estruturado). */
  const medir = (n: number) => {
    const w = mundoComCanais(n)
    const pacote = pacoteDe({ nome: `${n}`, obs: w.obs, sp: {}, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') })
    const seg = segmentar(pacote, CONTEXTO)
    const t = montarTexto(seg, PERGUNTA, CONTEXTO_IA_RULES.limiteCopia, 'todos')
    const linhasNoJson = (t.texto.match(/"tabela":\s*"canais"/g) ?? []).length
    const tabelaCanais = pacote.tabelas.find((x) => x.id === 'canais')!
    return { canais: w.obs.channels.length, linhasDaPrincipal: tabelaCanais.linhas.length, degrau: t.degrau, linhasNoJson, caracteres: t.caracteres, totalSemCorte: t.totalSemCorte }
  }
  it('linha de base com 60 e com 200 canais (medida ANTES do conserto)', () => {
    const r = { n60: medir(60), n200: medir(200) }
    console.info('portao', JSON.stringify(r))
    expect(r.n60.canais).toBeGreaterThanOrEqual(60)
    expect(r).toMatchInlineSnapshot(`
      {
        "n200": {
          "canais": 200,
          "caracteres": 23193,
          "degrau": 3,
          "linhasDaPrincipal": 198,
          "linhasNoJson": 3,
          "totalSemCorte": 1161863,
        },
        "n60": {
          "canais": 60,
          "caracteres": 23127,
          "degrau": 3,
          "linhasDaPrincipal": 58,
          "linhasNoJson": 3,
          "totalSemCorte": 350817,
        },
      }
    `)
  })
})
