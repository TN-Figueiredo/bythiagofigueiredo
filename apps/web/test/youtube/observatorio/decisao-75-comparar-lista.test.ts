// Decisão 75, Task 5: o estado de ausência no Comparar e na lista de Canais. Só dado sintético.
import { describe, expect, it } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { privadoDaLista } from '@/app/cms/(authed)/youtube/competitors/_canais/montar'
import { numerosDoCanal, MOTIVOS, motivoTexto } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { buildSoSeuCanal, FRASE_ERRO_CARTAO, FRASE_NEGADO_CARTAO } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { medidasDoLado } from '@/app/cms/(authed)/youtube/competitors/_comparar/medidas-do-lado'
import { dmDia, type ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { MotivoSemVpd } from '@/lib/youtube/observatorio/proprio/vpd'
import type { NegativaPrivada } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'


const W = a3World()
const OWN = W.owns[0]!
const extrasCom = (motivo: MotivoSemVpd, negativa?: NegativaPrivada): ExtrasProprio => ({
  dm: dmDia, ...(negativa !== undefined ? { negativa } : {}),
  vpd: new Map(W.owns.map(id => [id, { valor: null, motivo, n: 0, janela: null, ultimoDia: null, foraDoTeto: 0 }])),
})

describe('Numero.ausencia (Comparar)', () => {
  it('vpd do canal próprio com sem-acesso → restrito; leitura-falhou → falhou; sem-diario → nao_medido', () => {
    expect(numerosDoCanal(W.obs, OWN, undefined, extrasCom('sem-acesso')).vpd.ausencia).toBe('restrito')
    expect(numerosDoCanal(W.obs, OWN, undefined, extrasCom('leitura-falhou')).vpd.ausencia).toBe('falhou')
    expect(numerosDoCanal(W.obs, OWN, undefined, extrasCom('sem-diario')).vpd.ausencia).toBe('nao_medido')
  })
  it('mapa sem o canal → falhou, nunca restrito nem nao_medido', () => {
    const vazio: ExtrasProprio = { dm: dmDia, vpd: new Map() }
    const n = numerosDoCanal(W.obs, OWN, undefined, vazio)
    expect(n.vpd.ausencia).toBe('falhou')
    expect(n.vpdPorMil.ausencia).toBe('falhou')
  })
  it('x != null ⇔ ausencia null; os demais motivos são nao_medido', () => {
    for (const id of W.obs.channels.map(c => c.id)) {
      for (const n of Object.values(numerosDoCanal(W.obs, id))) {
        if (n.x != null) expect(n.ausencia, id).toBeNull()
        else expect(n.ausencia === 'nao_medido' || n.ausencia === 'falhou' || n.ausencia === 'restrito', id).toBe(true)
      }
    }
    const concorrente = W.obs.channels.find(c => !c.own)!.id
    for (const n of Object.values(numerosDoCanal(W.obs, concorrente))) expect(n.ausencia).not.toBe('restrito')
  })
  it('todo motivo tem estado e frase; só semVpdProprio carrega o motivo do vpd', () => {
    for (const m of MOTIVOS) expect(motivoTexto(m).length).toBeGreaterThan(0)
    expect(MOTIVOS.filter(m => m.k === 'semVpdProprio').every(m => 'motivo' in m)).toBe(true)
  })
})

describe('cartão "Só o seu canal mede"', () => {
  const eu = { id: 'eu', name: 'Eu', own: true }, leo = { id: 'c1', name: 'Leo', own: false }
  it('negado → restrito com a frase do cartão; erro e chave ausente → falhou', () => {
    const [n] = buildSoSeuCanal({ a: eu, b: leo }, { eu: { acesso: 'negado', view: null } })
    expect(n!.ausencia).toBe('restrito'); expect(n!.frase).toBe(FRASE_NEGADO_CARTAO)
    const [e] = buildSoSeuCanal({ a: eu, b: leo }, { eu: { acesso: 'erro', view: null } })
    expect(e!.ausencia).toBe('falhou'); expect(e!.frase).toBe(FRASE_ERRO_CARTAO)
    const [s] = buildSoSeuCanal({ a: eu, b: leo }, {})
    expect(s!.ausencia).toBe('falhou')
  })
})

describe('Falta (medidas do lado)', () => {
  const lado = (motivo: Parameters<typeof naoMedido>[0]) => {
    const l = medidasDoLado({ id: 'c1', own: false, medidasDoLado: { m3a: naoMedido(motivo), m3b: naoMedido(motivo), m3c: naoMedido(motivo), m3d: naoMedido(motivo), m8: undefined, longos: { cobertura: { ok: false, desde: null }, recente: 0, anterior: 0 } } as never }, '2026-10-17')
    return l
  }
  it('sem_permissao no concorrente → nao_medido, nunca restrito; poucas_views → nao_medido', () => {
    const todas = JSON.stringify(lado('sem_permissao'))
    expect(todas).not.toContain('"restrito"')
    expect(JSON.stringify(lado('poucas_views'))).not.toContain('"falhou"')
  })
})

describe('lista de Canais', () => {
  const linha = (e: ExtrasProprio) => {
    const v = buildCanaisView(W.obs, { niche: 'todos', limit: 75, fmt: 'longos', scale: 'abs' }, e)
    return [...v.list.ranked, ...v.list.unranked].find(r => r.id === OWN)!
  }
  it('linha própria com sem-acesso e prova de sem_direito → restrito', () => {
    const c = linha(extrasCom('sem-acesso', 'sem_direito')).cells.vpd
    expect(c.kind).toBe('na'); if (c.kind === 'na') expect(c.ausencia).toBe('restrito')
  })
  it('guarda caída (nao_foi_possivel_conferir) ou negativa não preenchida → falhou, nunca restrito', () => {
    for (const neg of ['nao_foi_possivel_conferir', null] as const) {
      const c = linha(extrasCom('sem-acesso', neg)).cells.vpd
      if (c.kind === 'na') expect(c.ausencia, String(neg)).toBe('falhou')
    }
  })
  it('mapa sem o canal → falhou', () => {
    const c = linha({ dm: dmDia, vpd: new Map() }).cells.vpd
    if (c.kind === 'na') expect(c.ausencia).toBe('falhou')
  })
  it('concorrente nunca restrito', () => {
    const v = buildCanaisView(W.obs, { niche: 'todos', limit: 75, fmt: 'longos', scale: 'abs' }, extrasCom('sem-acesso', 'sem_direito'))
    for (const r of [...v.list.ranked, ...v.list.unranked].filter(r => !r.own)) if (r.cells.vpd.kind === 'na') expect(r.cells.vpd.ausencia).toBeUndefined()
  })
  it('privadoDaLista leva a negativa de extras.negativa', () => {
    expect(privadoDaLista(extrasCom('sem-acesso', 'nao_foi_possivel_conferir')).negativa).toBe('nao_foi_possivel_conferir')
    expect(privadoDaLista(extrasCom('sem-acesso', 'sem_direito')).negativa).toBe('sem_direito')
    expect(privadoDaLista(extrasCom('sem-acesso')).negativa).toBeNull()
  })
})
