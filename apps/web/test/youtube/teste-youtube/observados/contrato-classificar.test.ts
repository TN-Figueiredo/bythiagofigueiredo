// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { carregarExport, linhasDaFixture, type AlvoExport, type FixtureColunar } from '@/lib/youtube/teste-youtube/observados/ensaio'
import { decidirCampo, qualificadas, rodadasDoTitulo } from '@/lib/youtube/teste-youtube/observados/inferir'
import { normalizarTitulo } from '@/lib/youtube/teste-youtube/normalizar-titulo'
import { prepararLeituras } from '@/lib/youtube/teste-youtube/preparar'
import { classificarTitulo } from '@/lib/youtube/teste-youtube/titulo'
import { resolverOpcoes } from '@/lib/youtube/teste-youtube/tipos'

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/replay-23-10.json', import.meta.url)), 'utf8')) as FixtureColunar
const alvos = carregarExport(linhasDaFixture(fixture))
const agoraMs = Date.parse(fixture.agora)

/**
 * Limiares do concorrente (§9.4): o detector do dono com as exigências de "dono" relaxadas, porque aqui há leituras de uma rodada só a cada 6 h.
 * - minLeituras 18: 6 rodadas x 3 passadas (= MIN_RODADAS_TITULO da v2).
 * - minVotosPorVariante 2: o mesmo "vista em >= 2 rodadas" da v2, em votos.
 * - minRodadasMistas 2 / minFracaoRodadasMistas 0,1: a v2 exige 2 rodadas mistas no histórico, sem fração mínima forte.
 * - minJanelaMistaMs 0: a v2 não olha a duração da mistura.
 * - maxVariantes 8: W tem 8 rodadas.
 * - quarentenaEscritaMs 0: não há escrita própria no concorrente.
 */
const LIMIARES_CONCORRENTE = resolverOpcoes({ minLeituras: 18, minVotosPorVariante: 2, minRodadasMistas: 2, minJanelaMistaMs: 0, minFracaoRodadasMistas: 0.1, maxVariantes: 8, quarentenaEscritaMs: 0 })

/** Adaptador (só no teste): LeituraObs -> LeituraWatch cru do detector do dono. */
function adaptar(ytId: string, a: AlvoExport): unknown[] {
  return a.leituras.filter(l => l.http === 200 && l.erro === null && l.tituloExibido !== null && l.idioma !== null).map(l => ({
    youtubeVideoId: ytId, lidaEm: l.lidaEm, rodadaId: l.rodadaId, origemRede: null, idioma: l.idioma, erro: null,
    tituloOficial: null, titulo_oficial_fonte: null, rendicoesSqp: null,
    titulosExibidos: [{ renderer: 'videoPrimaryInfoRenderer', texto: l.tituloExibido }], miniaturas: [],
  }))
}

describe('contrato da regra v2 com classificarTitulo (detector do dono)', () => {
  const emAndamento = [...alvos].filter(([, a]) =>
    decidirCampo('titulo', rodadasDoTitulo(a.leituras).rodadas, { publicadoMs: a.publicadoEm!.getTime(), agoraMs }).estado === 'em_andamento')

  it('há 15 alvos em andamento na v2', () => {
    expect(emAndamento).toHaveLength(15)
  })
  it('todos os 15 são provavel_teste no detector do dono, e as versões de W da v2 estão nas variantes dele', () => {
    const falhas: string[] = []
    for (const [id, a] of emAndamento) {
      const r = classificarTitulo(prepararLeituras(adaptar(id, a)).leituras, LIMIARES_CONCORRENTE)
      if (r.estado !== 'provavel_teste') { falhas.push(`${id}: ${r.estado}`); continue }
      const variantes = new Set(r.variantes.map(normalizarTitulo))
      const w = rodadasDoTitulo(a.leituras).rodadas.slice(-8)
      for (const v of qualificadas(w)) if (!variantes.has(v)) falhas.push(`${id}: ${v} fora das variantes`)
    }
    expect(falhas).toEqual([])
  })
})
