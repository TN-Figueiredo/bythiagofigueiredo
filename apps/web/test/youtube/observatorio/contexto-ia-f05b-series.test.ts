// @vitest-environment node
/**
 * A5 F0.5b: `x`, `dias`, `fuso` e `semana` declarados nas séries. (1) x finito e igual ao número do modelo; (2) inventário de `semana`/`fuso`;
 * (3) `dias` paralelo a `linhas`; (5) fuso no aviso da semana. O caso (4) (semana com o empacotador real) fica em acesso-ia-semana-empacotador-real.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: {} }))

import { tabelaDeDiaADia } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio'
import { projetarMedidas, tabelasDeMedidas } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-medidas'
import { buildImpressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { estadoCedo } from '@/lib/youtube/observatorio/proprio/cedo'
import { SEMANA_FECHADA, type Celula, type Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { ContextoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado'
import { medidasDoCanal, type Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { AGORA_CHEIA, HOJE_CHEIA, insumosCheios } from './medidas-fixture'

const d = (n: number): DiaYt => `2026-10-${String(n).padStart(2, '0')}`
const diasCom: DiaAlcance[] = Array.from({ length: 12 }, (_, i) => ({ dia: d(i + 1), situacao: 'com-impressoes', motivo: null, imp: 1000 + i * 37, cliques: 3.5 + i }))
const OPC = { escopo: 'canal' as const, alturaArea: 180, dm: dmDia, acesso: 'ok' as const, hoje: d(14) }
const grafico = (unidade?: 'views') => buildImpressoes(diasCom, { de: d(1), ate: d(12), dias: 12 }, { ...OPC, ...(unidade ? { unidade } : {}) })

function canalDe(ins: Insumos): CanalInteiro {
  const naoLido = { lido: false, causa: 'erro_do_banco' } as const
  return {
    medidas: medidasDoCanal(ins, { agoraMs: AGORA_CHEIA }),
    videos: ins.videos.lido ? { lido: true, dados: ins.videos.dados } : naoLido,
    retratos: ins.retratos.lido ? { lido: true, dados: ins.retratos.dados } : naoLido,
    marcas: ins.marcas.lido ? { lido: true, dados: ins.marcas.dados } : naoLido,
    serie: ins.series !== 'nao_pedida' && ins.series.lido ? { lido: true, dados: ins.series.dados.series } : 'nao_pedida',
    mudancas: ins.mudancas !== 'nao_pedida' && ins.mudancas.lido ? { lido: true, dados: ins.mudancas.dados.mudancas } : 'nao_pedida',
    horas: 'nao_pedida', falhas: [], esgotou: [],
  }
}
const contexto = (): ContextoDoCanal => ({
  F: { num: (v: number | null) => (v === null ? '—' : String(Math.round(v))), subs: (v: number) => String(v) } as unknown as ContextoDoCanal['F'],
  subs: 84_000, sync: { state: 'ok', last: AGORA_CHEIA - 3_600_000, errorSince: null }, hojeSP: HOJE_CHEIA, agoraMs: AGORA_CHEIA, primeiraBusca: false, semVideos: false,
  titulos: [], trocas: [], thumbs: [], criador: { nome: 'Matt Wolfe', avatar: null, ini: 'MW', color: '#336699' },
})
const medidasReais = () => tabelasDeMedidas(projetarMedidas(canalDe(insumosCheios()), contexto(), null)).tabelas

const numeroMedido = (c: Celula): boolean => c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido')

describe('F0.5b (1): x finito nas séries', () => {
  it('impressões e views por dia do próprio: x = impN / cliquesN do modelo, sem passar pelo texto', () => {
    const g = grafico()
    const [t] = tabelaDeDiaADia(g, 'modelo.grafico', 'id', 'T', 'n', true, 'soma')
    g.colunas.forEach((c, i) => {
      const imp = t!.linhas[i]![1]!, cli = t!.linhas[i]![2]!
      expect(imp.papel === 'numero' && imp.estado === 'medido' ? imp.x : 'x').toBe(c.impN)
      expect(cli.papel === 'numero' && cli.estado === 'medido' ? cli.x : 'x').toBe(c.cliquesN)
    })
    // clique fracionado (3,5) não é arredondado pelo texto
    expect(g.colunas[0]!.cliquesN).toBe(3.5)
    const [v] = tabelaDeDiaADia(grafico('views'), 'modelo.graficoViews', 'id', 'T', 'n', false, 'soma')
    for (const l of v!.linhas) expect(l[1]!.papel === 'numero' && l[1]!.estado === 'medido' && Number.isFinite(l[1]!.x)).toBe(true)
  })

  it('faixa dos 7 dias: x das casas medidas é o valor do modelo; id próprio <id>-cedo', () => {
    const HJ = d(14)
    const dias: DiaAlcance[] = [d(12), d(13)].map((x, i) => ({ dia: x, situacao: i === 0 ? 'zero-medido' : 'com-impressoes', motivo: null, imp: i === 0 ? 0 : 400, cliques: null }))
    const cedo = estadoCedo({ publicadoEm: d(12), hojePt: HJ, dias })
    expect(cedo.tipo).toBe('video-novo')
    const g = buildImpressoes(dias, { de: d(12), ate: HJ, dias: 3 }, { ...OPC, escopo: 'video', hoje: HJ, cedo, viewsDoVideo: 12 })
    expect(g.cedo).not.toBeNull()
    const ts = tabelaDeDiaADia(g, 'modelo.grafico', 'privado-impressoes-por-dia', 'T', 'n', true, 'soma')
    expect(ts[0]!.id).toBe('privado-impressoes-por-dia-cedo')
    expect(ts[0]!.semana).toBeUndefined()
    const casas = g.cedo!.casas
    ts[0]!.linhas.forEach((l, i) => {
      const c = l[1]!
      if (casas[i]!.valorN !== null) expect(c.papel === 'numero' && numeroMedido(c) && (c as { x: number | null }).x).toBe(casas[i]!.valorN)
      else expect(numeroMedido(c)).toBe(false)
    })
    expect(casas.some((c) => c.valorN !== null && c.valorN > 0)).toBe(true)
  })

  it('canal-ritmo-semanas: x = publicações da casa, finito em toda célula medida', () => {
    const t = medidasReais().find((x) => x.id === 'canal-ritmo-semanas')!
    const medidas = t.linhas.map((l) => l[2]!).filter(numeroMedido)
    expect(medidas.length).toBeGreaterThan(0)
    for (const c of medidas) {
      expect(c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && Number.isFinite(c.x)).toBe(true)
      if (c.papel === 'numero' && c.estado === 'medido') expect(String(c.x)).toBe(c.texto)
    }
  })
})

describe('F0.5b (2) e (3): inventário de semana/fuso e dias', () => {
  const tabelas: Tabela[] = [
    ...medidasReais(),
    ...tabelaDeDiaADia(grafico(), 'modelo.grafico', 'privado-impressoes-por-dia', 'T', 'n', true, 'soma'),
    ...tabelaDeDiaADia(grafico('views'), 'modelo.graficoViews', 'privado-views-por-dia', 'T', 'n', false, 'soma'),
  ]
  const diaADia = tabelas.filter((t) => t.tipo === 'dia_a_dia')
  it('toda dia_a_dia declara semana ou está em SEMANA_FECHADA; toda com semana declara fuso', () => {
    expect(diaADia.length).toBeGreaterThanOrEqual(3)
    for (const t of diaADia) {
      expect(t.semana !== undefined || SEMANA_FECHADA[t.id] !== undefined, t.id).toBe(true)
      if (t.semana) expect(t.fuso, t.id).toBeDefined()
    }
    expect(medidasReais().find((x) => x.id === 'canal-linha-do-tempo')!.fuso).toBe('sao_paulo')
    expect(diaADia.find((t) => t.id === 'privado-views-por-dia')!.fuso).toBe('pacifico')
  })
  it('SEMANA_FECHADA cobre as faixas dos 7 dias e os mapas sem data', () => {
    for (const id of ['privado-views-por-dia-cedo', 'privado-impressoes-por-dia-cedo', 'privado-views-por-dia-do-video-cedo', 'privado-impressoes-por-dia-do-video-cedo', 'mapa-uploads', 'mapa-multiplicador']) expect(SEMANA_FECHADA[id], id).toBeTruthy()
  })
  it('toda dia_a_dia com semana declara dias, do tamanho de linhas, e dias[i] corresponde ao rótulo dd/mm da linha i', () => {
    for (const t of diaADia.filter((x) => x.semana)) {
      expect(t.dias, t.id).toBeDefined()
      expect(t.dias!.length, t.id).toBe(t.linhas.length)
      t.linhas.forEach((l, i) => {
        const iso = t.dias![i]!
        expect(iso, t.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        const rot = l[0]!.papel === 'numero' ? '' : l[0]!.texto
        expect(rot, t.id).toContain(`${iso.slice(8, 10)}/${iso.slice(5, 7)}`)
      })
    }
  })
  it('canal-linha-do-tempo: o dia diminuiu sai nao_medido com causa (pela situação do modelo), nunca medido com x null; sem registro não leva causa', () => {
    const real = projetarMedidas(canalDe(insumosCheios()), contexto(), null)!
    const dias = real.tempo.dias.map((x, i) => (i === 2 ? { ...x, views: 'sem registro', ganho: null, situacao: 'o total diminuiu', situacaoN: 'diminuiu' as const }
      : i === 3 ? { ...x, views: 'sem registro', ganho: null, situacao: 'sem registro', situacaoN: 'sem_registro' as const } : x))
    const t = tabelasDeMedidas({ ...real, tempo: { ...real.tempo, dias } }).tabelas.find((x) => x.id === 'canal-linha-do-tempo')!
    const c2 = t.linhas[2]![1]!, c3 = t.linhas[3]![1]!
    expect(c2.papel === 'numero' && c2.estado === 'nao_medido' && c2.causa).toBe('diminuiu')
    expect(c3.papel === 'numero' && c3.estado === 'nao_medido' && c3.causa).toBeUndefined()
    for (const l of t.linhas) {
      const v = l[1]!
      if (v.papel === 'numero' && v.estado === 'medido') expect(Number.isFinite(v.x)).toBe(true)
    }
    expect(t.dias).toHaveLength(t.linhas.length)
    expect(t.dias![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
