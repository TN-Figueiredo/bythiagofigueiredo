// @vitest-environment node
/**
 * A5 F1c T8: `saida: "tabela"` na `consultar`. `montarConsulta` é dobrado (como em acesso-ia-responder-consultar): o que se prova é o CSV das duas tabelas
 * (consulta-longos, consulta-shorts), o cabeçalho = CHAVES_DA_CONSULTA, `limite` no total, hora ISO, célula vazia e o vazio em texto.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ montar: vi.fn(), empacotar: {} as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/montar', () => ({ montarConsulta: m.montar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { CHAVES_DA_CONSULTA, type ResultadoDaConsulta } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta'
import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { CAMPOS_DA_ACAO, EXEMPLO_DA_ACAO, FORMATO_DA_ACAO } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { SEM_CSV_LISTA_VAZIA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import type { CelulaDaConsulta, LinhaDaConsulta, PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'

const AGORA = Date.UTC(2026, 10, 11, 15)
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const PEDIDO: PedidoDaConsulta = {
  formato: 'todos', janelaIdade: ['0-30', '31-90'], metricas: ['views', 'likes', 'comentarios', 'multiplicador'],
  ordenarPor: 'multiplicador', direcao: 'desc', limite: 20, incluirBaseFraca: false,
}
const med = (x: number): CelulaDaConsulta => ({ x, estado: 'medido' })
const nao = (causa: string): CelulaDaConsulta => ({ x: null, estado: 'nao_medido', causa })
const MEDIDO_EM = '2026-11-11T11:05:00.000Z'

function linha(i: number, formato: 'longos' | 'shorts', semLikes = false): LinhaDaConsulta {
  const sigla = formato === 'shorts' ? 'SH' : 'LG'
  return {
    id: uuid(i + (formato === 'shorts' ? 5000 : 0)), ytId: sigla + String(i).padStart(9, '0'), titulo: `Vídeo ${formato} ${i}`, canal: `Canal ${i % 3}`, canalId: uuid(9000 + (i % 3)),
    publicadoEm: '2026-10-20', idadeDias: 22, formato, formatoConfirmado: true, estado: 'ativo', medidoEm: MEDIDO_EM, lugares: ['local:vn-hanoi'],
    celulas: { views: med(1000 + i), likes: semLikes ? nao('curtidas ocultas pelo canal') : med(50 + i), comentarios: med(5 + i), multiplicador: med(9 - i / 100) },
    multN: 20, multMetodo: 'mesmo dia de vida', baseFraca: false, motivos: [],
  }
}
function bloco(formato: 'longos' | 'shorts', n: number, semLikes = false): ResultadoDaConsulta['blocos'][number] {
  return {
    formato, linhas: Array.from({ length: n }, (_, i) => linha(i + 1, formato, semLikes)), cortadasPorLimite: 0,
    agregado: { n, elegiveis: n, baseFraca: 0, sincAtrasado: 0, porMetrica: { multiplicador: { mediana: 3.2, q1: 2.1, q3: 4.8, n, semOsVideos: [], semOsCanais: [] } } },
  }
}
const resultado = (blocos: ResultadoDaConsulta['blocos'], pedido: Partial<PedidoDaConsulta> = {}): ResultadoDaConsulta => ({
  pedido: { ...PEDIDO, ...pedido }, blocos, dadosDe: { motor: MEDIDO_EM, medidas: MEDIDO_EM, lugares: null }, canaisSemMedida: [], canaisNaoEncontrados: [], leituraMaisAntiga: MEDIDO_EM,
})
const pedir = (e: Record<string, unknown> = {}) => responder({ acao: 'consultar', saida: 'tabela', ...e }, ABRIDOR_DE_SESSAO, AGORA)
const csvs = (t: string): string[][] => [...t.split('## Cobertura')[0]!.matchAll(/```csv\n([\s\S]*?)\n```/g)].map((x) => x[1]!.split('\n'))
const dosVideos = (t: string): string[][] => csvs(t).filter((b) => b[0]!.startsWith('titulo,'))
const itens = (t: string): number => dosVideos(t).reduce((s, b) => s + b.length - 1, 0)

beforeEach(() => { m.montar.mockReset() })

describe('consultar: saida no esquema, no formato e nos exemplos', () => {
  it('aceita saida texto e tabela; o tradutor entrega Pedido.saida; sem saida é texto', () => {
    for (const s of ['texto', 'tabela'] as const) {
      const lida = ENTRADA.safeParse({ acao: 'consultar', saida: s })
      expect(lida.success).toBe(true)
      const t = lida.success ? traduzir(lida.data) : null
      expect(t?.ok && t.pedido.saida).toBe(s)
    }
    const t = traduzir(ENTRADA.parse({ acao: 'consultar' }))
    expect(t.ok && t.pedido.saida).toBe('texto')
  })
  it('saida "planilha" é recusada; campos, formato e exemplo citam saida', () => {
    expect(ENTRADA.safeParse({ acao: 'consultar', saida: 'planilha' }).success).toBe(false)
    expect(CAMPOS_DA_ACAO.consultar).toContain('saida')
    expect(FORMATO_DA_ACAO.consultar).toContain('saida (texto ou tabela')
    expect(FORMATO_DA_ACAO.consultar).toContain('limite vale no total')
    expect(ENTRADA.safeParse(JSON.parse(EXEMPLO_DA_ACAO.consultar)).success).toBe(true)
  })
})

describe('consultar em tabela', () => {
  it('duas tabelas de vídeos, cada uma com o cabeçalho = CHAVES_DA_CONSULTA, sem nome repetido (uma só motivos)', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 3), bloco('shorts', 2)]))
    const r = await pedir()
    expect(r.desfecho).toBe('ok')
    const v = dosVideos(r.texto)
    expect(v).toHaveLength(2)
    for (const b of v) {
      expect(b[0]).toBe([...CHAVES_DA_CONSULTA].join(','))
      expect(new Set(b[0]!.split(',')).size).toBe(CHAVES_DA_CONSULTA.length)
      expect(b[0]!.split(',').filter((c) => c === 'motivos')).toHaveLength(1)
    }
    expect(v[0]).toHaveLength(4)
    expect(v[1]).toHaveLength(3)
    expect(r.texto).toContain('## Vídeos longos da consulta')
    expect(r.texto).toContain('## Vídeos Shorts da consulta')
    expect(r.params.saida).toBe('tabela')
    expect(r.params.sem_x).toBe(0)
  })
  it('limite 3 com 2 longos + 2 shorts: 3 itens no total, longos primeiro', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 2), bloco('shorts', 2)], { limite: 3 }))
    const r = await pedir({ limite: 3 })
    expect(itens(r.texto)).toBe(3)
    const v = dosVideos(r.texto)
    expect(v[0]).toHaveLength(3)
    expect(v[1]).toHaveLength(2)
    expect(r.params.linhas).toBe(3)
    expect(r.params.cortadas).toBe(1)
    expect(r.texto).toContain('"limite":50') // o corte foi do limite, então a próxima chamada oferece mais linhas
    expect(r.texto).toMatch(/Shorts: 0 de 2|"Shorts" \(0 de 2 linhas\)|"Shorts" \(1 de 2/)
  })
  it('hora em ISO de máquina e célula vazia (nunca 0) com o motivo na legenda', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 2, true)]))
    const r = await pedir()
    const [cab, l1] = dosVideos(r.texto)[0]!
    const cols = cab!.split(',')
    const campos = l1!.split(',')
    expect(campos[cols.indexOf('medido_em')]).toBe(MEDIDO_EM)
    expect(campos[cols.indexOf('likes')]).toBe('')
    expect(campos[cols.indexOf('views')]).toBe('1001')
    expect(r.texto).toMatch(/likes:m\d/)
  })
  it('sem saida o texto continua sem CSV', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 2)]))
    const r = await responder({ acao: 'consultar' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.texto).not.toContain('```csv')
    expect(r.params.saida).toBeUndefined()
  })
  it('lista vazia: responde em texto, com a linha fixa no topo, e o registro grava saida texto', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 0), bloco('shorts', 0)]))
    const r = await pedir()
    expect(r.texto.split('\n')[0]).toBe(SEM_CSV_LISTA_VAZIA)
    expect(r.texto).not.toContain('```csv')
    expect(r.params.saida).toBe('texto')
    expect(r.params).not.toHaveProperty('sem_x')
  })
})
