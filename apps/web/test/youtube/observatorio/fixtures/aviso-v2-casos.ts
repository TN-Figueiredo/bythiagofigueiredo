/** Os estados V do mockup 18-v2 (bl2.js), com os mesmos números. O tamanho passa pelo `sinalDoBanco` real (28 linhas em reta). */
import { sinalDoBanco, type LinhaBruta, type SinalDoBanco } from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'
import type { AvisoLeve } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import type { Casa } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import type { AvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'

const MB = 1_048_576
const DIA = 86_400_000
const H1 = '2027-02-20'
const SPV = [41.3, 88.1, 86.6], GV = [2.9, 2.1, 1.7]
const SPA = [112.4, 131.0, 116.6], GA = [2.4, 1.9, 1.3]
const iso = (hoje: string, k: number): string => new Date(Date.parse(hoje + 'T00:00:00Z') + k * DIA).toISOString().slice(0, 10)
const somaN = (v: number[]): number => v.reduce((a, b) => a + b, 0)

function linhas(hoje: string, sp: number[], g: number[], ate = hoje): LinhaBruta[] {
  const inc = somaN(g) / 28
  const out: LinhaBruta[] = []
  for (let k = -27; k <= 0; k++) {
    const dia = iso(ate, k), f = inc * k
    const c = (sp[0]! + (g[0]! / 28) * k) * MB, o = (sp[1]! + (g[1]! / 28) * k) * MB, r = (sp[2]! + (g[2]! / 28) * k) * MB
    void f
    out.push({ day: dia, db_bytes: Math.round(c + o + r), competitor_bytes: Math.round(c), own_bytes: Math.round(o), measured_at: `${dia}T08:10:00Z` })
  }
  return out
}
const agoraDe = (hoje: string): number => Date.parse(hoje + 'T15:00:00Z')

type Copia = { k: 'ok' } | { k: 'nunca' } | { k: 'atrasada'; dias: number } | { k: 'nm' }
interface Def { hoje: string; sp: number[] | null; g: number[] | null; copia: Copia; pronto?: string; casaH?: number; nas?: 'fora' | 'cheio'; semPausa?: boolean; ult?: { dia: string; sp: number[] }; erro?: boolean; rem?: { n: number; forma: 'arquivo' | 'triangulo' | 'octogono' } | null }
const CP: Copia = { k: 'ok' }
const D: Record<string, Def> = {
  v0: { hoje: '2026-10-13', sp: SPV, g: GV, copia: { k: 'nunca' } },
  v1: { hoje: H1, sp: SPV, g: GV, copia: CP },
  v1a: { hoje: H1, sp: SPV, g: GV, copia: { k: 'atrasada', dias: 12 } },
  v1b: { hoje: H1, sp: SPV, g: GV, copia: { k: 'atrasada', dias: 34 } },
  v1n: { hoje: H1, sp: SPV, g: GV, copia: { k: 'nm' } },
  v2: { hoje: H1, sp: [75, 130, 125], g: [10, 9, 5], copia: CP, pronto: '2027-05-01' },
  v3: { hoje: H1, sp: [95, 150, 125], g: [4, 3, 2], copia: CP },
  v4: { hoje: H1, sp: [110, 130, 120], g: [14, 9, 5], copia: CP, pronto: '2027-05-16' },
  v5: { hoje: H1, sp: [190, 140, 110], g: [3, 2, 1], copia: CP, pronto: '2027-03-01' },
  v8: { hoje: H1, sp: SPA, g: GA, copia: CP, casaH: 64 },
  v8curta: { hoje: H1, sp: SPA, g: GA, copia: CP, casaH: 30 },
  v8a: { hoje: H1, sp: SPA, g: GA, copia: CP, casaH: 64, semPausa: true },
  v8b: { hoje: H1, sp: SPA, g: GA, copia: CP, nas: 'fora' },
  v8c: { hoje: H1, sp: SPA, g: GA, copia: CP, nas: 'cheio' },
  v9: { hoje: H1, sp: null, g: null, copia: CP, ult: { dia: '2027-02-19', sp: [214.8 - 0, 0, 0] } },
  v10: { hoje: H1, sp: null, g: null, copia: { k: 'nm' }, erro: true },
  v12a: { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 2, forma: 'arquivo' } },
  v12b: { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 2, forma: 'triangulo' } },
  v12c: { hoje: H1, sp: SPV, g: GV, copia: CP, rem: { n: 1, forma: 'octogono' } },
  v12n: { hoje: H1, sp: SPV, g: GV, copia: CP, rem: null },
}

export interface CasoV2 { aviso: { banco: { valor: SinalDoBanco } | { porque: 'erro_do_banco' } }; leve: AvisoLeve | null; agora: number; casa: Casa; marcaCanais: AvisoV2['marcas']['canaisRemovidos']; pausaExiste: boolean }

export function caso(id: string): CasoV2 {
  const d = D[id]!
  const agora = agoraDe(d.hoje)
  let banco: CasoV2['aviso']['banco']
  if (d.erro) banco = { porque: 'erro_do_banco' }
  else if (d.sp && d.g) banco = { valor: sinalDoBanco(linhas(d.hoje, d.sp, d.g), agora) }
  else banco = { valor: sinalDoBanco(linhas(d.hoje, [214.8, 0, 0], [0, 0, 0], d.ult!.dia), agora) }
  const atraso = d.copia.k === 'atrasada'
    ? { amarelos: d.copia.dias > 30 ? 0 : 1, vermelhos: d.copia.dias > 30 ? 1 : 0, mais_antiga: iso(d.hoje, -d.copia.dias), meses_sem_selo: 0 }
    : { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 }
  const leve: AvisoLeve | null = d.copia.k === 'nm' ? null : {
    versao: 1, lido_em: new Date(agora).toISOString(), hoje: d.hoje,
    proximo_mes: d.pronto ? { class: 'serie', month: '2026-11-01', pronto_em: d.pronto } : null,
    primeira_devida_em: '2026-11-28',
    ultima_copia: d.copia.k === 'nunca' ? null : '2027-02-01T12:00:00Z',
    casa: [], vermelhos_n: 0, atraso,
  }
  let casa: Casa = { estado: 'responde', desde: agora - 3_600_000, forma: 'visto', frase: 'A casa responde' }
  if (d.casaH) casa = { estado: 'nao_respondeu', desde: agora - d.casaH * 3_600_000, forma: d.casaH >= 36 ? 'octogono' : 'triangulo', frase: 'A casa não respondeu desde 17/02 22:10. Nada se perde: o mês só sai quando a casa voltar.' }
  if (d.nas === 'fora') casa = { estado: 'nas_fora', desde: agora - 59 * 3_600_000, forma: 'triangulo', frase: 'O NAS não está acessível pela forja desde 18/02 03:30.' }
  if (d.nas === 'cheio') casa = { estado: 'nas_cheio', desde: null, forma: 'triangulo', frase: 'O NAS está cheio: a cópia não coube.' }
  return { aviso: { banco }, leve, agora, casa, marcaCanais: d.rem ? { n: d.rem.n, forma: d.rem.forma } : null, pausaExiste: !d.semPausa }
}
