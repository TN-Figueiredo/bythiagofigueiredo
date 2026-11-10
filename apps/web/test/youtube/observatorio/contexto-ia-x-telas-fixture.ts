// A5 F0.5a-T2/T3: fixtures do `x` na origem para Destaques (outliers) e Mudanças. Pacotes pelo empacotador REAL, sem desenhar a tela.
// A matriz é a das provas de paridade (`contexto-ia-outliers.test.tsx`, `contexto-ia-mudancas.test.tsx`): os mesmos estados da tela.
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { empacotarOutliers, modeloDeOutliers, type ModeloOutliers } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-outliers'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { empacotarMudancas, modeloDeMudancas, type ModeloMudancas } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-mudancas'

type Params = Record<string, string>
export interface CasoTela<M> { nome: string; modelo: M; pacote: PacoteModelo }

const OBS = createObservatory(datasetFromOracle(loadOracle()))

const MATRIZ_OUTLIERS: Array<[string, Params]> = [
  ['padrão', {}],
  ['Viagem, longos', { niche: 'viagem' }],
  ['IA, Shorts, 181–365 dias (vazio)', { age: '181-365', niche: 'ia', fmt: 'short' }],
  ['múltiplo mínimo 0', { formula: 'preco', min: '0' }],
  ['todas as idades, base fraca', { age: 'all', min: '0' }],
  ['IA, por views', { niche: 'ia', sort: 'views' }],
  ['Viagem, assunto antigo que ainda rende', { niche: 'viagem', age: 'all', min: '0' }],
  ['IA, assunto antigo com a mediana do canal', { niche: 'ia', age: 'all', min: '0', sort: 'views' }],
  ['leitura da forja de IA', { reading: 'padroes-titulo-ia-20-10', niche: 'viagem', min: '50' }],
]
export function casosDeOutliers(): Array<CasoTela<ModeloOutliers>> {
  return MATRIZ_OUTLIERS.map(([nome, params]) => {
    const view = buildOutliersView(OBS, params)
    const modelo = modeloDeOutliers(view, OBS.nicheLabel(view.query.niche))
    return { nome, modelo, pacote: empacotarOutliers(modelo) }
  })
}

const BASE = buildMudancasView(OBS, { win: '90' }, new Set())
const CANAL = BASE.controls.channels[0]!.options[0]!.id
const MATRIZ_MUDANCAS: Array<[string, Params]> = [
  ['um canal', { channel: CANAL, win: '90' }],
  ['Shorts, 90 dias', { fmt: 'short', win: '90' }],
  ['um vídeo', { video: BASE.heroes[0]!.video.id }],
  ['padrão', {}],
  ['90 dias', { win: '90' }],
  ['7 dias', { win: '7' }],
  ['30 dias, só títulos', { win: '30', type: 'title' }],
  ['90 dias, só descrições', { win: '90', type: 'desc' }],
  ['IA, 90 dias', { niche: 'ia', win: '90' }],
  ['só medidas, 90 dias', { measured: '1', win: '90' }],
]
export function casosDeMudancas(): Array<CasoTela<ModeloMudancas>> {
  return MATRIZ_MUDANCAS.map(([nome, params]) => {
    const view = buildMudancasView(OBS, params, new Set())
    const modelo = modeloDeMudancas(view, OBS.nicheLabel(view.filters.niche))
    return { nome, modelo, pacote: empacotarMudancas(modelo) }
  })
}
export const OBS_DAS_TELAS = OBS
