// F4 T4: a linha de tráfego no view-model. Estados e textos do mockup 2026-10-29-f4-trafego-e-titulos; nao_medido nunca vira "0" nem "não".
import { describe, expect, it } from 'vitest'
import { montarVistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import { montarTrafego } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/trafego'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import type { TrafegoDoTerceiro } from '@/lib/youtube/observatorio/sinais/trafego-terceiro/regra'

const HOJE = '2026-10-29'
const base: TrafegoDoTerceiro = {
  estado: 'nao_medido', motivo: 'sem_cobertura', terceiro_video_id: 't', videos_com_trafego: 0, videos_medidos: 0, videos_total: 36,
  views: null, ate: null, desde: '2026-10-25', coberto_ate: '2026-10-27', regra: 'f4-trafego-v1',
}
const t = (o: Partial<TrafegoDoTerceiro>): TrafegoDoTerceiro => ({ ...base, ...o })
const m = (o: Partial<TrafegoDoTerceiro>) => montarTrafego(t(o), HOJE)

describe('montarTrafego', () => {
  it('D2: singular com 1 vídeo ("1 de 1 vídeo seu", "o seu vídeo")', () => {
    expect(m({ estado: 'sim', motivo: null, views: 120, videos_com_trafego: 1, videos_medidos: 1, videos_total: 1 })!.texto).toBe('Já te manda visitas: 120 em 1 de 1 vídeo seu, até 27/10.')
    expect(m({ estado: 'nao', motivo: null, videos_medidos: 1, videos_total: 1, ate: '2026-10-27' })!.texto).not.toMatch(/1 vídeos|seus 1/)
  })
  it('sim com número: peso, total, vídeos e "até"', () => {
    expect(m({ estado: 'sim', motivo: null, views: 1234, videos_com_trafego: 2, videos_medidos: 36 })).toMatchObject({
      estado: 'sim', texto: 'Já te manda visitas: 1.234 em 2 de 36 vídeos seus, até 27/10.',
    })
  })
  it('sim sem número (views nulo) e views 0 nunca dizem "0 visitas"', () => {
    for (const views of [null, 0]) {
      const r = m({ estado: 'sim', motivo: null, views, videos_com_trafego: 2, videos_medidos: 36 })!
      expect(r.texto).toBe('Já te manda visitas para 2 de 36 vídeos seus (o YouTube não disse quantas), até 27/10.')
      expect(r.texto).not.toMatch(/\b0 visitas|: 0\b/)
    }
  })
  it('sim parcial mostra "x de y"', () => {
    expect(m({ estado: 'sim', motivo: null, views: 87, videos_com_trafego: 2, videos_medidos: 30 })!.texto)
      .toBe('Já te manda visitas: 87 em 2 de 36 vídeos seus, até 27/10. Medido em 30 de 36 vídeos seus.')
  })
  it('não: frase do mockup com "até dd/mm" e permite pedir títulos', () => {
    expect(m({ estado: 'nao', motivo: null, videos_medidos: 36, ate: '2026-10-27' })).toMatchObject({
      estado: 'nao', texto: 'Não te manda visitas: nenhum dos seus 36 vídeos recebeu visita dele, até 27/10.', curto: 'Não te manda visitas · até 27/10', podePedir: true,
    })
  })
  it('nao_se_aplica e ausente: sem linha', () => {
    expect(m({ estado: 'nao_se_aplica', motivo: null })).toBeNull()
    expect(montarTrafego(undefined, HOJE)).toBeNull()
  })
  it('erro_de_leitura e schema_ausente são "erro", não "não medido"', () => {
    for (const motivo of ['erro_de_leitura', 'schema_ausente'] as const) {
      expect(m({ motivo })).toMatchObject({ estado: 'erro', texto: 'Não deu para ler este dado agora. A sugestão continua valendo.' })
    }
  })
  it('cada motivo de nao_medido tem frase própria, sem "0" e sem "não" como veredito', () => {
    const casos: Array<[Partial<TrafegoDoTerceiro>, string]> = [
      [{ motivo: 'origem_nao_informada' }, 'O YouTube informou visitas sem dizer de qual vídeo vieram; não dá para afirmar sim nem não.'],
      [{ motivo: 'pouca_cobertura' }, 'Ainda cedo: ele saiu em 25/10; dá para medir a partir de 03/11.'],
      [{ motivo: 'ainda_nao_coletado' }, 'Ainda cedo: ele saiu em 25/10; dá para medir a partir de 03/11.'],
      [{ motivo: 'lista_truncada', videos_medidos: 20 }, 'Conferimos 20 dos seus 36 vídeos; nenhum dos 20 recebeu visita dele.'],
      [{ motivo: 'sem_proprios_medidos' }, 'Ainda não sabemos quais vídeos seus comparar.'],
      [{ motivo: 'sem_terceiro' }, 'Sem o vídeo do concorrente para medir.'],
      [{ motivo: 'sem_id' }, 'Sem o vídeo do concorrente para medir.'],
      [{ motivo: 'cobertura_velha' }, 'Coleta parada desde 27/10.'],
      [{ motivo: 'sem_cobertura' }, 'Coleta ainda sem dados.'],
      [{ motivo: 'nao_conferido' }, 'Acesso não conferido agora.'],
      [{ motivo: 'coleta_desligada' }, 'Coleta desligada.'],
    ]
    for (const [o, texto] of casos) {
      const r = m(o)!
      expect(r.estado).toBe('nao_medido')
      expect(r.texto).toBe(texto)
      expect(r.podePedir).toBe(false)
      expect(r.texto).not.toMatch(/^Não te manda|\b0 visitas/)
    }
  })
  it('"ainda cedo" com data de medir já passada não promete data no passado', () => {
    const r = montarTrafego(t({ motivo: 'pouca_cobertura', desde: '2026-09-01' }), HOJE)!
    expect(r.texto).toBe('Ainda faltam dias de coleta dos seus vídeos desde que ele saiu.')
  })
  it('info do ⓘ traz a data de publicação e o fim da cobertura', () => {
    expect(m({ estado: 'nao', motivo: null, ate: '2026-10-27' })!.info).toContain('(25/10) até 27/10')
  })
})

function item(id: string, tr: TrafegoDoTerceiro | undefined): ItemDeSinal {
  const o = { video_id: 'v-' + id, canal_id: 'c', published_at: '2026-10-20T00:00:00Z', mult_vpd7: 8, mult_tela: 8, vpd7: 100, formato: 'long' as const }
  return {
    id, kind: 'destino', subject_key: 'pais:vn', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'titulo_descricao', forca: 1,
    motivo: 'm', rule_version: 'x', first_seen_at: '2026-10-18T10:00:00Z', expires_at: '2026-11-17T10:00:00Z', proprios_agora: ['p1'], proprios_agora_n: 1,
    evidence: { outliers: [o], outliers_total: 1, canais: 1, proprios: [] }, adiada_em: null, ...(tr ? { trafego_do_terceiro: tr } : {}),
  } as ItemDeSinal
}

describe('montarVistaDaLista com tráfego', () => {
  it('cada linha leva o seu estado; nao_se_aplica vira null', () => {
    const itens = [item('a', t({ estado: 'nao', motivo: null, ate: '2026-10-27', videos_medidos: 36 })), item('b', t({ estado: 'nao_se_aplica', motivo: null })), item('c', t({ motivo: 'origem_nao_informada' }))]
    const lista = { n: 3, itens, computado_em: '2026-10-29T10:00:00Z', desatualizado: false, motivoVazio: null, contagens: {}, calculoLigado: true } as ListaDeSinais
    const v = montarVistaDaLista({ lista, amostra: new Map(), agora: new Date('2026-10-29T15:00:00-03:00'), filtro: 'todas', saiuDoAviso: false, limite: 100 })
    expect(v.linhas.map((l) => l.trafego?.estado ?? null)).toEqual(['nao', null, 'nao_medido'])
  })
})
