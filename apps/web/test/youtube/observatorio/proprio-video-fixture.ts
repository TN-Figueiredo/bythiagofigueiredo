// O mundo da tela do VÍDEO próprio (A4 13.4): o canal próprio do preset com dado privado sintético, e as SENTINELAS: números privados
// improváveis, escolhidos para não colidirem com nenhum número público da tela (os testes de segurança procuram esses textos no HTML).
//  - o vídeo em foco (`foco`) é o mais novo dos longos acompanhados com 20 dias de vida ou mais (o mais novo de todos tem 2 dias: é o "vídeo novo");
//  - alcance dele: 7.919 impressões num dia só (CTR 0,2 = 1.584 cliques estimados), mais o dos outros vídeos;
//  - diário dele: 1.234 views por dia em 20 dias (24.680 no total), % assistido 77,7 (= 78%);
//  - nenhuma data fixa: tudo relativo a `hoje` (dia do YouTube de `obs.NOW`).
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, DiaYt, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { proprioWorld } from './proprio-fixture'

export const SENTINELAS = {
  imp: '7.919', cliques: '1.584', viewsDia: '1.234', views28: '24.680', pct: '78%',
} as const
export const TEXTOS_PRIVADOS = Object.values(SENTINELAS)

export type MundoVideo = ReturnType<typeof proprioWorld> & { foco: { id: string; ytId: string }; outros: string[] }

const rel = (dia: DiaYt, status: RelatorioDia['status'] = 'baixado'): RelatorioDia => ({ dia, status, normalizado: true })

/** Alcance do canal: 19 relatórios lidos (hoje-21 a hoje-3); o vídeo em foco tem impressão em UM dia (hoje-5); os outros em vários. */
export function alcanceDoFoco(canalId: string, foco: string, outros: readonly string[], hoje: DiaYt, o: { impFoco?: number; ctrFoco?: number | null } = {}): AlcanceCanal {
  const d = (n: number) => addDays(hoje, -n)
  const relatorios: RelatorioDia[] = []
  for (let n = 3; n <= 21; n++) relatorios.push(rel(d(n)))
  const linhas: AlcanceLinha[] = []
  const impFoco = o.impFoco ?? 7919
  if (impFoco > 0) linhas.push({ ytId: foco, dia: d(5), imp: impFoco, ctr: o.ctrFoco === undefined ? 0.2 : o.ctrFoco })
  outros.slice(0, 4).forEach((y, j) => { for (const n of [4, 6, 9, 12]) linhas.push({ ytId: y, dia: d(n), imp: 200 + 10 * j, ctr: 0.05 }) })
  return { canalId, relatorios, linhas, ultimoRelatorio: d(3), descartados: 0 }
}

/**
 * Diário do canal: 30 dias que terminam em hoje-2. O foco: `viewsFoco` por dia nos dias `diasFoco` (de hoje-2 para trás), % assistido `pctFoco`.
 * Os outros: views 2, 4, 6… por dia e % assistido 40, 43, 46…
 */
export function diarioDoFoco(canalId: string, foco: string, outros: readonly string[], hoje: DiaYt, o: { viewsFoco?: number; diasFoco?: number; pctFoco?: number | null; semLinhaEm?: number[]; pctOutros?: number } = {}): DiarioCanal {
  const ultimo = addDays(hoje, -2)
  const linhas: DiarioLinha[] = []
  const diasFoco = o.diasFoco ?? 20, viewsFoco = o.viewsFoco ?? 1234
  const pctFoco = o.pctFoco === undefined ? 77.7 : o.pctFoco
  for (let n = 0; n < diasFoco; n++) {
    if (o.semLinhaEm?.includes(n)) continue
    linhas.push({ ytId: foco, dia: addDays(ultimo, -n), views: viewsFoco, pctAssistido: viewsFoco > 0 ? pctFoco : null, duracaoMediaSeg: null })
  }
  outros.forEach((y, j) => { for (let n = 0; n < 30; n++) linhas.push({ ytId: y, dia: addDays(ultimo, -n), views: (j + 1) * 2, pctAssistido: o.pctOutros ?? 40 + 3 * j, duracaoMediaSeg: null }) })
  return { canalId, ultimoDia: ultimo, linhas, descartados: 0 }
}

/** O mundo com as sentinelas; `dados` troca peças do dado privado já pronto. */
export function mundoVideo(o: { dados?: Partial<DadosDoCanal>; agora?: number; alcance?: Parameters<typeof alcanceDoFoco>[4]; diario?: Parameters<typeof diarioDoFoco>[4]; mut?: (ds: Dataset) => void } = {}): MundoVideo {
  const w = proprioWorld({ mut: o.mut, agora: o.agora })
  const v = w.obs.videos.filter(x => x.ch === w.canalId && x.fmt === 'long' && x.tracked && x.ageDays >= 20).sort((a, b) => b.pub - a.pub)[0]
  if (!v) throw new Error('a fixture esperava um longo acompanhado com 20 dias de vida')
  const foco = v.ytId, outros = w.ytIds.filter(y => y !== foco)
  const dados: DadosDoCanal = {
    alcance: { acesso: 'ok', dado: alcanceDoFoco(w.canalId, foco, outros, w.hoje, o.alcance) },
    diario: { acesso: 'ok', dado: diarioDoFoco(w.canalId, foco, outros, w.hoje, o.diario) },
    ...o.dados,
  }
  return { ...w, dados, foco: { id: v.id, ytId: foco }, outros }
}
