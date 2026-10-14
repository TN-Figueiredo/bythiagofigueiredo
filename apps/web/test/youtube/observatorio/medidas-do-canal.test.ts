// @vitest-environment node
// A5 E4, Tarefa 14: o montador. Puro: nada de banco.
import { describe, it, expect } from 'vitest'
import { medidasDoCanal, type Insumos, type MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { MOTIVOS_NAO_MEDIDO, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { AGORA_CHEIA, HOJE_CHEIA, insumosCheios, videosDaFixture, viewsDaCurva, vfDoVideo, viewsDoRetrato } from './medidas-fixture'

const DAY = 864e5
const rodar = (i: Insumos): MedidasDoCanal => medidasDoCanal(i, { agoraMs: AGORA_CHEIA })
const cheio = (): MedidasDoCanal => rodar(insumosCheios())
const ehMedida = (x: unknown): x is Medida<unknown> => typeof x === 'object' && x !== null && 'estado' in x && ((x as { estado: unknown }).estado === 'medido' || (x as { estado: unknown }).estado === 'nao_medido')

/** Todas as folhas (as `Medida`) do resultado, com o caminho. Falha se achar nulo, indefinido ou número não finito FORA de uma folha. */
function folhas(x: unknown, caminho = 'r'): Array<{ caminho: string; m: Medida<unknown> }> {
  if (ehMedida(x)) return [{ caminho, m: x }]
  if (x instanceof Map) return [...x.entries()].flatMap(([k, v]) => folhas(v, caminho + '[' + String(k) + ']'))
  if (Array.isArray(x)) {
    // `falhas` é a única lista fora das folhas
    return x.flatMap((v, k) => folhas(v, caminho + '[' + k + ']'))
  }
  if (typeof x === 'object' && x !== null) return Object.entries(x).flatMap(([k, v]) => folhas(v, caminho + '.' + k))
  if (x === null || x === undefined || (typeof x === 'number' && !Number.isFinite(x))) throw new Error('folha inválida em ' + caminho)
  return []
}
const finitos = (x: unknown): boolean => (typeof x === 'number' ? Number.isFinite(x) : Array.isArray(x) ? x.every(finitos) : typeof x === 'object' && x !== null ? Object.values(x).every(finitos) : true)

function varrer(r: MedidasDoCanal): void {
  const fs = folhas({ porFormato: r.porFormato, m3a: r.m3a, m8: r.m8, porVideo: r.porVideo })
  expect(fs.length).toBeGreaterThan(0)
  for (const { caminho, m } of fs) {
    if (m.estado === 'nao_medido') expect(MOTIVOS_NAO_MEDIDO, caminho).toContain(m.motivo)
    else {
      expect(finitos(m.valor), caminho).toBe(true)
      expect(Number.isFinite(m.n), caminho).toBe(true)
      // zero por falta: um valor numérico zero só existe com pelo menos uma observação por trás
      if (m.valor === 0) expect(m.n, caminho).toBeGreaterThanOrEqual(1)
    }
  }
}

// ───── a retirada de dados por etapas ─────
const semMarcas = (i: Insumos): Insumos => ({ ...i, marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } } })
const semPrimeirasHoras = (i: Insumos): Insumos => {
  if (i.series === 'nao_pedida' || !i.series.lido || !i.videos.lido) return i
  const base = new Map(i.videos.dados.map((v) => [v.id, Date.parse(v.publishedAt as string)]))
  const series = new Map([...i.series.dados.series].map(([id, ls]) => [id, ls.filter((l) => l.t - (base.get(id) ?? 0) >= 4 * DAY)]))
  return { ...i, series: { lido: true, dados: { series, foraDoCanal: 0 } } }
}
const semSerie = (i: Insumos): Insumos => ({ ...i, series: { lido: true, dados: { series: new Map(), foraDoCanal: 0 } } })
const semRetratos = (i: Insumos): Insumos => ({ ...i, retratos: { lido: true, dados: [] } })
const semVideos = (i: Insumos): Insumos => ({ ...i, videos: { lido: true, dados: [] } })
const vazio = (i: Insumos): Insumos => ({
  ...semVideos(semRetratos(semSerie(semMarcas(i)))),
  mudancas: { lido: true, dados: { mudancas: new Map(), foraDoCanal: 0 } }, multiplos: new Map(),
  comentarios: { lido: true, dados: { coletaDesdeMs: null, porVideo: new Map() } },
})

describe('o banco vazio (item 28)', () => {
  it('a fixture cheia mede o que tem de medir', () => {
    const r = cheio()
    for (const m of [r.m3a, r.m8.estado, r.m8.parado, r.porFormato.long.m1[30], r.porFormato.long.m2, r.porFormato.long.m3b, r.porFormato.long.m3c, r.porFormato.long.m4,
      r.porFormato.long.m6, r.porFormato.long.m7, r.porFormato.long.m11, r.porFormato.long.m12[7], r.porFormato.short.m1[30], r.porVideo.get('v11')?.m10]) {
      expect(m?.estado).toBe('medido')
    }
    expect(r.falhas).toEqual([])
  })
  it('banco sem nenhuma linha nova: toda medida devolve nao_medido com motivo', () => {
    const r = rodar(vazio(insumosCheios()))
    const fs = folhas({ porFormato: r.porFormato, m3a: r.m3a, m8: r.m8, porVideo: r.porVideo })
    expect(fs.length).toBeGreaterThan(20)
    for (const { caminho, m } of fs) {
      expect(m.estado, caminho).toBe('nao_medido')
      if (m.estado === 'nao_medido') expect(MOTIVOS_NAO_MEDIDO, caminho).toContain(m.motivo)
    }
    expect(r.porVideo.size).toBe(0)
  })
  it('nenhuma folha é nula, indefinida, NaN ou Infinity, e nenhuma é zero por falta (os seis estágios)', () => {
    const etapas: Array<(i: Insumos) => Insumos> = [semMarcas, semPrimeirasHoras, semSerie, semRetratos, semVideos, vazio]
    for (const e of etapas) varrer(rodar(e(insumosCheios())))
    varrer(cheio())
  })
  it('sem marcas e sem motivos: as medidas que dependem delas dizem o que falta, nunca zero', () => {
    const r = rodar(semMarcas(insumosCheios()))
    const v = r.porVideo.get('v11')!
    // com a série pedida o mesmo número sai da série, e o motivo diz de onde veio
    expect(v.m1[30]).toMatchObject({ estado: 'medido', valor: { fonte: 'serie' } })
    const sem = rodar(semSerie(semMarcas(insumosCheios()))).porVideo.get('v11')!
    expect(sem.m1[30]).toMatchObject({ estado: 'nao_medido', motivo: 'aguardando_calculo' })
    expect(r.porFormato.long.m6.estado).toBe('medido')
  })
})

describe('parte não lida e parte não pedida', () => {
  const razoes = (r: MedidasDoCanal): string[] => folhas({ porFormato: r.porFormato, m3a: r.m3a, m8: r.m8, porVideo: r.porVideo })
    .filter((f) => f.m.estado === 'nao_medido' && f.m.motivo === 'leitura_falhou').map((f) => f.caminho)

  it('parte não lida vira leitura_falhou só nas medidas que dependem dela (marcas)', () => {
    const r = rodar({ ...insumosCheios(), marcas: { lido: false, causa: 'schema_ausente' } })
    for (const m of [r.porFormato.long.m1[1], r.porFormato.long.m1[30], r.porFormato.long.m2, r.porFormato.long.m3c, r.porFormato.long.m7, r.porFormato.long.m12[30], r.porVideo.get('v11')?.m9.cauda, r.porVideo.get('v11')?.m10]) {
      expect(m).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    }
    for (const m of [r.porFormato.long.m3b, r.porFormato.long.m4, r.porFormato.long.m6, r.porFormato.long.m11, r.m3a, r.m8.parado]) expect(m.estado).toBe('medido')
  })
  it('parte não lida: retratos', () => {
    const r = rodar({ ...insumosCheios(), retratos: { lido: false, causa: 'erro_do_banco' } })
    expect(r.m3a).toMatchObject({ motivo: 'leitura_falhou' })
    expect(r.m8.queda).toMatchObject({ motivo: 'leitura_falhou' })
    expect(r.m8.estado).toMatchObject({ motivo: 'leitura_falhou' })
    expect(r.m8.parado.estado).toBe('medido')
    expect(r.porFormato.long.m6.estado).toBe('medido')
    expect(r.porFormato.long.m1[30].estado).toBe('medido')
  })
  it('parte não lida: série pedida e não lida; vídeos; canal', () => {
    const a = rodar({ ...insumosCheios(), series: { lido: false, causa: 'cortado' } })
    expect(a.porFormato.long.m2).toMatchObject({ motivo: 'leitura_falhou' })
    expect(a.porVideo.get('v11')?.m5).toMatchObject({ motivo: 'leitura_falhou' })
    expect(a.porVideo.get('v11')?.m9.aindaRende).toMatchObject({ motivo: 'leitura_falhou' })
    expect(a.porVideo.get('v11')?.m9.cauda.estado).toBe('medido')
    expect(a.porFormato.long.m1[30].estado).toBe('medido')
    const b = rodar({ ...insumosCheios(), videos: { lido: false, causa: 'erro_do_banco' } })
    expect(razoes(b).length).toBeGreaterThan(15)
    expect(b.porVideo.size).toBe(0)
    const c = rodar({ ...insumosCheios(), canal: { lido: false, causa: 'canal_de_outro_site' } })
    expect(c.m3a).toMatchObject({ motivo: 'leitura_falhou' })
    expect(c.m8.estado).toMatchObject({ motivo: 'leitura_falhou' })
    expect(c.porFormato.long.m6).toMatchObject({ motivo: 'leitura_falhou' })
  })
  it('comentários: sem permissão e não lida são coisas diferentes', () => {
    const a = rodar({ ...insumosCheios(), comentarios: { lido: false, causa: 'sem_permissao' } })
    expect(a.porFormato.long.m11).toMatchObject({ motivo: 'sem_permissao' })
    expect(a.porFormato.long.m12[7]).toMatchObject({ motivo: 'sem_permissao' })
    expect(a.porVideo.get('v11')?.m12[30]).toMatchObject({ motivo: 'sem_permissao' })
    const b = rodar({ ...insumosCheios(), comentarios: { lido: false, causa: 'erro_do_banco' } })
    expect(b.porFormato.long.m11).toMatchObject({ motivo: 'leitura_falhou' })
    const c = rodar({ ...insumosCheios(), comentarios: 'nao_pedido' })
    expect(c.porFormato.long.m11).toMatchObject({ motivo: 'sem_permissao' })
  })
  it('série não pedida: 1, 7 e 30 pelas marcas; M2 nas outras idades, M5 e "ainda rende" dizem serie_nao_pedida', () => {
    const r = rodar({ ...insumosCheios(), series: 'nao_pedida' })
    expect(r.porFormato.long.m1[30].estado).toBe('medido')
    expect(r.porVideo.get('v11')?.m1[30].estado).toBe('medido')
    const curva = r.porFormato.long.m2
    expect(curva.estado).toBe('medido')
    if (curva.estado === 'medido') {
      const por = new Map(curva.valor.map((p) => [p.idadeDias, p]))
      for (const idade of [1, 7, 30]) expect(por.get(idade)?.ponto.estado).toBe('medido')
      for (const idade of [2, 3, 5, 14]) expect(por.get(idade)?.ponto).toMatchObject({ estado: 'nao_medido', motivo: 'serie_nao_pedida' })
    }
    expect(r.porVideo.get('v11')?.m5).toMatchObject({ motivo: 'serie_nao_pedida' })
    expect(r.porVideo.get('v11')?.m9.aindaRende).toMatchObject({ motivo: 'serie_nao_pedida' })
    expect(r.porVideo.get('v11')?.m10).toMatchObject({ motivo: 'serie_nao_pedida' })
  })
  it('múltiplos não pedidos: M4 diz sem_multiplo', () => {
    const r = rodar({ ...insumosCheios(), multiplos: 'nao_pedido' })
    expect(r.porFormato.long.m4).toMatchObject({ estado: 'nao_medido', motivo: 'sem_multiplo' })
    expect(r.porFormato.short.m4).toMatchObject({ motivo: 'sem_multiplo' })
  })
})

describe('canal com a coleta pausada', () => {
  it('lerCanal devolve collectionPausedAt e o montador o entrega a estadoDoCanal', () => {
    const i = insumosCheios()
    const r = rodar({ ...i, canal: { lido: true, dados: { id: 'c1', siteId: 's1', collectionPausedAt: new Date(AGORA_CHEIA - 3 * DAY).toISOString(), missingSince: null } } })
    expect(r.m8.estado).toMatchObject({ estado: 'medido', valor: 'pausado' })
    expect(r.m8.parado).toMatchObject({ motivo: 'coleta_pausada' })
    expect(r.m8.queda).toMatchObject({ motivo: 'coleta_pausada' })
    expect(r.m3a).toMatchObject({ motivo: 'coleta_pausada' })
  })
})

describe('uma medida que lança não derruba as outras', () => {
  it('retrato malformado: M3(a) sai calculo_falhou, falhas tem a classe sem a mensagem, e o resto continua medido', () => {
    const i = insumosCheios()
    const retratos = i.retratos.lido ? [...i.retratos.dados, { dia: 'zz-lixo', views: 5 }] : []
    const r = rodar({ ...i, retratos: { lido: true, dados: retratos } })
    expect(r.m3a).toMatchObject({ estado: 'nao_medido', motivo: 'calculo_falhou' })
    expect(r.falhas.some((f) => f.medida === 'm3a' && f.classe === 'Error')).toBe(true)
    expect(JSON.stringify(r.falhas)).not.toContain('dia_malformado')
    expect(r.porFormato.long.m1[30].estado).toBe('medido')
    expect(r.porFormato.long.m6.estado).toBe('medido')
  })
})

describe('vídeos agendados e no ar (emenda 1 d:C-1 e emenda 2 d:m-7)', () => {
  const extra = (c: Partial<VideoLido> & { id: string }): VideoLido => ({
    videoId: 'yt' + c.id, publishedAt: new Date(AGORA_CHEIA).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'upcoming', wasLive: null, isShort: false,
    durationSeconds: 600, viewCount: 0, likeCount: 0, commentCount: 0, likesHidden: false, commentsDisabled: false, viewsHidden: false, discoveredAt: null,
    missingSince: null, seriesTier: 'diaria', lastCheckedAt: null, ...c,
  })
  const comExtras = (...vs: VideoLido[]): Insumos => {
    const i = insumosCheios()
    return { ...i, videos: { lido: true, dados: [...(i.videos.lido ? i.videos.dados : []), ...vs] } }
  }
  const agendado = extra({ id: 'agendado' })
  const noAr = extra({ id: 'noar', liveBroadcastContent: 'live', publishedAt: new Date(AGORA_CHEIA - 10 * DAY).toISOString(), liveActualStartAt: new Date(AGORA_CHEIA - DAY).toISOString() })

  it('vídeo agendado: m1 diz fecha_em sem data e o vídeo não entra na mediana de M1', () => {
    const base = cheio(), r = rodar(comExtras(agendado))
    for (const idade of [1, 7, 30] as const) {
      const m = r.porVideo.get('vagendado'.replace('v', ''))?.m1[idade]
      expect(m).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em' })
      expect(m && m.estado === 'nao_medido' ? m.fechaEm : 'x').toBeUndefined()
      expect(r.porFormato.long.m1[idade]).toEqual(base.porFormato.long.m1[idade])
    }
  })
  it('agendado e no ar ficam fora de M3(b), M3(c) e M7, contados; o agendado não é publicação de M6 nem a última de M8; o que está no ar é', () => {
    const base = cheio()
    const dois = rodar(comExtras(agendado, noAr))
    for (const m of [dois.porFormato.long.m3b, dois.porFormato.long.m3c, dois.porFormato.long.m7]) {
      expect(m.notas).toContainEqual({ tipo: 'agendado_fora', n: 2 })
    }
    expect(dois.porFormato.long.m3b.estado === 'medido' && dois.porFormato.long.m3b.valor).toEqual(base.porFormato.long.m3b.estado === 'medido' && base.porFormato.long.m3b.valor)
    expect(dois.porFormato.long.m7.estado === 'medido' && dois.porFormato.long.m7.valor).toEqual(base.porFormato.long.m7.estado === 'medido' && base.porFormato.long.m7.valor)
    expect(dois.porFormato.long.m4.estado === 'medido' && dois.porFormato.long.m4.valor).toEqual(base.porFormato.long.m4.estado === 'medido' && base.porFormato.long.m4.valor)
    // só o agendado: ritmo e última publicação não mudam
    const so = rodar(comExtras(agendado))
    expect(so.porFormato.long.m6).toEqual(base.porFormato.long.m6)
    expect(so.m8.parado).toEqual(base.m8.parado)
    // o que está no ar conta no instante em que começou
    expect(dois.porFormato.long.m6).not.toEqual(base.porFormato.long.m6)
    expect(dois.m8.parado.estado === 'medido' && dois.m8.parado.valor.dias).toBe(1)
  })
})

describe('formatos', () => {
  it('canal misto: nenhum número de longo entra em Shorts (item 32, de ponta a ponta)', () => {
    const r = cheio()
    const vs = videosDaFixture()
    const v30 = (curtos: boolean): number[] => vs.filter((x) => x.short === curtos && x.idade <= 90 && x.marcas[30]).map((x) => x.marcas[30]!.views).sort((a, b) => a - b)
    const mediana = (a: number[]): number => (a.length % 2 ? a[a.length >> 1]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2)
    const curto = r.porFormato.short.m1[30], longo = r.porFormato.long.m1[30]
    expect(curto.estado === 'medido' && curto.valor).toBe(mediana(v30(true)))
    expect(longo.estado === 'medido' && longo.valor).toBe(mediana(v30(false)))
    expect(curto.estado === 'medido' && curto.valor).not.toBe(longo.estado === 'medido' && longo.valor)
    expect('m3b' in r.porFormato.short).toBe(false)
  })
})

describe('os números da fixture conferem à mão', () => {
  it('M1: a marca de 7 dias do primeiro vídeo é 20.000 × (1 − e^(−7/20)) = 5.906', () => {
    expect(vfDoVideo(0, false)).toBe(20000)
    expect(viewsDaCurva(20000, 7)).toBe(5906)
    // v0 (8 dias) ainda não tem a marca de 7 dias gravada na fixture: o mesmo número sai da série
    expect(cheio().porVideo.get('v0')?.m1[7]).toMatchObject({ estado: 'medido', valor: { views: 5906, fonte: 'serie' } })
    // v1 (15 dias, vf 26.000) tem a marca: 26.000 × 0,295312 = 7.678
    expect(viewsDaCurva(26000, 7)).toBe(7678)
    expect(cheio().porVideo.get('v1')?.m1[7]).toMatchObject({ estado: 'medido', valor: { views: 7678, fonte: 'marca' } })
  })
  it('M3(a): retratos 1.617.610, 1.446.810 e 1.291.690 dão ganhos 170.800 e 155.120 e variação +10,1%', () => {
    expect([viewsDoRetrato(119), viewsDoRetrato(91), viewsDoRetrato(63)]).toEqual([1_617_610, 1_446_810, 1_291_690])
    const m = cheio().m3a
    expect(m.estado).toBe('medido')
    if (m.estado === 'medido') {
      expect(m.valor.ganhoRecente).toBe(170_800)
      expect(m.valor.ganhoAnterior).toBe(155_120)
      expect(m.valor.variacao).toBeCloseTo(0.10108, 4)
      expect(m.valor.direcao).toBe('subindo')
      expect(m.janela.ate).toBe('2026-10-13')
    }
    expect(HOJE_CHEIA).toBe('2026-10-14')
  })
  it('M7: com 4% de curtidas e 0,4% de comentários a taxa do vídeo de 52 dias é 4,4%', () => {
    const m = cheio().porVideo.get('v6')?.m7
    expect(m?.estado).toBe('medido')
    if (m?.estado === 'medido') {
      expect(m.valor.base).toBe('idade_30')
      expect(m.valor.taxa).toBeCloseTo(0.044, 3)
    }
  })
})
