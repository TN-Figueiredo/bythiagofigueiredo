// A5 F0.5a: fixtures compartilhadas pelos testes do `x` na origem (Canais). Constrói os pacotes com o empacotador REAL, sem desenhar a tela.
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { Celula, EstadoDoPrivado, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { a3World } from './a3-fixture'
import { medidasDoOraculo, medidasDoMotor } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { dmDia, type ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { empacotarCanais, modeloDeCanais, type ModeloCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'

export interface CasoCanais { nome: string; obs: Observatory; sp: Partial<CanaisParams>; extras?: ExtrasProprio; privado: EstadoDoPrivado }

export const extrasDe = (obs: Observatory, motivo: 'ok' | 'sem-acesso' | 'leitura-falhou' = 'ok'): ExtrasProprio => ({
  dm: dmDia,
  vpd: new Map(obs.channels.filter((c) => c.own).map((c) => [c.id, motivo === 'ok'
    ? { valor: 4300, motivo: null, n: 20, janela: { de: '2026-10-01', ate: '2026-10-20' }, ultimoDia: '2026-10-20', foraDoTeto: 0 }
    : { valor: null, motivo, n: 0, janela: null, ultimoDia: null, foraDoTeto: 0 }] as never)),
})
export const privadoDe = (obs: Observatory, diario: 'ok' | 'negado' | 'erro', negativa: EstadoDoPrivado['negativa'] = null): EstadoDoPrivado => ({
  acessoPorCanal: Object.fromEntries(obs.channels.filter((c) => c.own).map((c) => [c.id, { diario }])), negativa,
})

/** Multiplica os concorrentes até a lista ter `n` canais (clona o canal e os vídeos com id novo). */
export function mundoComCanais(n: number): ReturnType<typeof a3World> {
  return a3World((ds: Dataset) => {
    const alvos = ds.channels.filter((c) => !c.own)
    const novos = [] as typeof ds.channels
    const videos = [] as typeof ds.videos
    for (let i = 0; ds.channels.length + novos.length < n; i += 1) {
      const c = alvos[i % alvos.length]!
      const id = `${c.id}-x${i}`
      novos.push({ ...c, id, name: `${c.name} ${i + 1}`, fullName: `${c.fullName} ${i + 1}`, handle: `${c.handle}${i + 1}` })
      for (const v of ds.videos.filter((x) => x.ch === c.id)) videos.push({ ...v, id: `${v.id}-x${i}`, ch: id })
    }
    ds.channels = [...ds.channels, ...novos]
    ds.videos = [...ds.videos, ...videos]
  })
}

export function modeloDe(c: CasoCanais): ModeloCanais {
  const view = buildCanaisView(c.obs, { niche: 'todos', limit: 250, fmt: 'longos', medidas: medidasDoOraculo(c.obs), ...c.sp }, c.extras)
  const ri = buildRiView(c.obs, { agoraMs: c.obs.NOW, niche: c.sp.niche ?? 'todos', fmt: view.fmt === 'shorts' ? 'short' : 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
  return modeloDeCanais(view, ri)
}
export const pacoteDe = (c: CasoCanais): PacoteModelo => empacotarCanais(modeloDe(c), c.privado)

/** Os casos cujo estado das células a F0.5a não pode mudar. */
export function casosDeCanais(): CasoCanais[] {
  const w = a3World()
  const semOculto = a3World((ds) => { const c = ds.channels.find((x) => !x.own); if (c) c.subs = null })
  const lido = (nome: string, sp: Partial<CanaisParams> = {}): CasoCanais => ({ nome, obs: w.obs, sp, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') })
  return [
    lido('longos'), lido('shorts', { fmt: 'shorts' }), lido('todos', { fmt: 'todos' }), lido('por crescimento', { sort: 'growth' }),
    lido('sem medidas do site', { medidas: null }),
    { nome: 'diario negado', obs: w.obs, sp: {}, extras: extrasDe(w.obs, 'sem-acesso'), privado: privadoDe(w.obs, 'negado', 'sem_direito') },
    { nome: 'diario com falha', obs: w.obs, sp: {}, extras: extrasDe(w.obs, 'leitura-falhou'), privado: privadoDe(w.obs, 'erro') },
    { nome: 'inscritos ocultos', obs: semOculto.obs, sp: {}, extras: extrasDe(semOculto.obs), privado: privadoDe(semOculto.obs, 'ok') },
  ]
}

/**
 * Cobertura NOVA da rede de estados (Yannis M1 e M7), em arquivo de instantâneo próprio: o de `casosDeCanais` (commit 0) não é regravado.
 * `restrito`: com `extras.negativa = sem_direito` a ausência do diário vira `r`. `canais-resumo-base`: um canal sem o estado lido dá base ("de N") ao filtro.
 */
export function casosNovosDeCanais(): CasoCanais[] {
  const w = a3World()
  const primeiro = w.obs.channels.find((c) => !c.own)!.id
  return [
    { nome: 'diario restrito', obs: w.obs, sp: {}, extras: { ...extrasDe(w.obs, 'sem-acesso'), negativa: 'sem_direito' }, privado: privadoDe(w.obs, 'negado', 'sem_direito') },
    { nome: 'estado lido em parte', obs: w.obs, sp: { medidas: medidasDoMotor(w.obs, { [primeiro]: 'nao_carregou' }) }, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') },
    // Yannis N2: `scale: 'abs'` faz a coluna `Views/dia, mediana dos vídeos` existir e passar pelo formatador do teste.
    { nome: 'views por dia absoluto', obs: w.obs, sp: { scale: 'abs' }, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') },
  ]
}

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

/** Todas as células numéricas medidas, com o caminho `tabela/coluna/linha`. */
export function medidas(p: PacoteModelo) {
  return p.tabelas.flatMap((t) => t.linhas.flatMap((l, i) => l.flatMap((c, j) => (c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') ? [{ t, tabela: t.id.replace(/^privado-/, ''), coluna: t.colunas[j]!, i, j, c, caminho: `${t.id}/${t.colunas[j]}/${i + 1}` }] : []))))
}
export const semX = (c: Celula) => c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && 'semXMotivo' in c && typeof c.semXMotivo === 'string'
