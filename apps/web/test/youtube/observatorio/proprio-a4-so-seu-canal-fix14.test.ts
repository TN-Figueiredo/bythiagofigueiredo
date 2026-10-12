// @vitest-environment node
// A4 Tarefa 14, onda de consertos da revisão: I1 (7 dias do % assistido, o mesmo veredito do cabeçalho do canal), M1 (a frase só diz o que não foi
// medido), M2 (chave de lista pelo id) e M3 (guarda: o dado privado nunca entra em cache compartilhado). Dado ausente afirma o valor nulo E a frase.
import { afterEach, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiarioCanal, Privado, AlcanceCanal } from '@/lib/youtube/observatorio/proprio/tipos'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { MIN_DIAS_ASSISTIDO } from '@/app/cms/(authed)/youtube/competitors/_proprio/canal-agregados'
import { buildSoSeuCanal, montarSoSeuCanalDado, type SoSeuCanalView } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { alcanceCheio, alcanceVazio, proprioWorld } from './proprio-fixture'
import { comDiario, diarioComPct, ultimoVideoHa } from './proprio-assistido-fixture'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))
const w = proprioWorld({ mut: ultimoVideoHa(12) })
const { obs, canalId, ytIds, hoje, dm } = w
const ok = <T,>(dado: T): Privado<T> => ({ acesso: 'ok', dado })
const diarioDe = (dias: number): Privado<DiarioCanal> => ok(diarioComPct(canalId, ytIds, hoje, [{ dias, views: 40, pct: 61 }]))
const semDiario: Privado<DiarioCanal> = ok({ canalId, ultimoDia: null, linhas: [], descartados: 0 })
const alcOk = (): Privado<AlcanceCanal> => ok(alcanceCheio(canalId, ytIds, hoje))
const alcVazio = (): Privado<AlcanceCanal> => ok(alcanceVazio(canalId))

const viewDe = (alcance: Privado<AlcanceCanal>, diario: Privado<DiarioCanal>): SoSeuCanalView => {
  const dado = montarSoSeuCanalDado({ nome: 'tn', alcance, diario, longos: ytIds, dm, F: obs.fmt })
  if (!dado.view) throw new Error('sem view')
  return dado.view
}
const assistido = (v: SoSeuCanalView) => v.linhas.find(l => l.chave === 'assistido')!
const cabecalho = (dias: number) => {
  const dados = comDiario(w.dados, diarioComPct(canalId, ytIds, hoje, [{ dias, views: 40, pct: 61 }]))
  const h = buildProprioHeader(obs, canalId, dados, { hoje, dm, posicao: null, muitosProprios: false })!
  return [...h.faixa, ...h.todos].find(c => c.key === 'assistido')!
}

describe('I1: % assistido com menos de 7 dias de dado', () => {
  it('a constante é a mesma do cabeçalho do canal (7)', () => { expect(MIN_DIAS_ASSISTIDO).toBe(7) })

  it('6 dias: valor nulo e a nota "só 6 dias com dado; precisa de 7", nunca zero nem 61%', () => {
    const l = assistido(viewDe(alcOk(), diarioDe(6)))
    expect(l).toMatchObject({ valor: null, nota: 'só 6 dias com dado; precisa de 7', fraco: false })
  })
  it('1 dia: singular "só 1 dia com dado; precisa de 7"', () => {
    expect(assistido(viewDe(alcOk(), diarioDe(1))).nota).toBe('só 1 dia com dado; precisa de 7')
  })
  it('7 dias: já dá número (61%), sem a nota dos dias', () => {
    expect(assistido(viewDe(alcOk(), diarioDe(7)))).toMatchObject({ valor: '61%' })
    expect(assistido(viewDe(alcOk(), diarioDe(7))).nota ?? '').not.toMatch(/precisa de/)
  })
  it('o cartão e o cabeçalho do canal dão o MESMO veredito para o mesmo dado (6 e 7 dias)', () => {
    for (const dias of [1, 6, 7, 20]) {
      const c = cabecalho(dias)
      const l = assistido(viewDe(alcOk(), diarioDe(dias)))
      expect(l.valor === null, `${dias} dias`).toBe(c.value === null)
      if (c.value === null) expect(l.nota, `${dias} dias`).toBe(c.sub)
      else expect(l.valor, `${dias} dias`).toBe(c.value)
    }
  })
})

describe('M1: a frase de "Não medido" lista só o que não foi medido', () => {
  const frase = (alc: Privado<AlcanceCanal>, d: Privado<DiarioCanal>) => viewDe(alc, d).frase
  it('alcance ausente: a frase fala das impressões, dos cliques e da taxa de clique, e NUNCA do % assistido (com ou sem diário)', () => {
    for (const d of [diarioDe(20), semDiario]) {
      const v = viewDe(alcVazio(), d)
      expect(v.naoMedido).toBe(true)
      expect(v.frase.startsWith('Não medido. ')).toBe(true)
      expect(v.frase).toContain('falta medir, não é zero')
      expect(v.frase).toMatch(/impressões/)
      expect(v.frase).toMatch(/taxa de clique/)
      expect(v.frase).not.toMatch(/assistido/)
      for (const k of ['impressoes', 'cliques', 'taxa'] as const) expect(v.linhas.find(l => l.chave === k), k).toMatchObject({ valor: null, nota: null })
    }
  })
  it('só diário (alcance ausente): % assistido com o número dele', () => {
    expect(assistido(viewDe(alcVazio(), diarioDe(20)))).toMatchObject({ valor: '61%' })
  })
  it('nenhum dos dois: % assistido nulo com a nota do estado dele', () => {
    expect(assistido(viewDe(alcVazio(), semDiario))).toMatchObject({ valor: null, nota: 'a coleta diária ainda não gravou este canal' })
  })
  it('só alcance (diário ausente) e os dois presentes: a frase de abertura normal, sem "Não medido"', () => {
    for (const d of [semDiario, diarioDe(20)]) {
      const v = viewDe(alcOk(), d)
      expect(v.naoMedido).toBe(false)
      expect(v.frase).not.toMatch(/Não medido/)
    }
    expect(assistido(viewDe(alcOk(), semDiario)).valor).toBeNull()
    expect(assistido(viewDe(alcOk(), diarioDe(20))).valor).toBe('61%')
    expect(frase(alcOk(), diarioDe(20))).toBe('Impressões, taxa de clique e % assistido só chegam ao dono do canal.')
  })
})

describe('M2: a lista de cartões usa o id do canal, não o nome', () => {
  it('dois canais seus com o mesmo nome têm ids diferentes e chaves diferentes', () => {
    const dado = { acesso: 'ok' as const, view: viewDe(alcOk(), diarioDe(20)) }
    const vs = buildSoSeuCanal({ a: { id: 'x1', name: 'Mesmo', own: true }, b: { id: 'x2', name: 'Mesmo', own: true } }, { x1: dado, x2: dado })
    expect(vs.map(v => v.id)).toEqual(['x1', 'x2'])
  })
})

describe('M3: o dado privado nunca entra em cache compartilhado', () => {
  const raiz = join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors')
  const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')
  // existe porque o pacote da comparação leva o alcance privado do administrador: se a página deixar de ser dinâmica, ou se a leitura passar por
  // cache compartilhado (unstable_cache/cache), quem só lê poderia receber o número de quem edita.
  it('a página da comparação continua dinâmica (force-dynamic) e sem revalidate', () => {
    const src = ler('comparar/page.tsx')
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(src).not.toMatch(/export const revalidate/)
  })
  it('a leitura dos extras privados e o pacote não importam cache compartilhado', () => {
    for (const p of ['comparar/page.tsx', '_proprio/carregar-extras.ts', '_proprio/dados.ts', '_comparar/pack.ts', '_comparar/so-seu-canal-model.ts']) {
      const src = ler(p)
      expect(src, p).not.toMatch(/unstable_cache|next\/cache|use cache|cacheTag|cacheLife/)
      expect(src, p).not.toMatch(/import\s*\{[^}]*\bcache\b[^}]*\}\s*from\s*'react'/)
    }
  })
})
