// @vitest-environment node
/** A5 · E9, Tarefa 10b: o view model puro da tela. Um teste por caso do mockup aprovado e das divergências declaradas. */
import { describe, it, expect } from 'vitest'
import { buildFilaView, lerMostrar, type FilaViewOk } from '@/app/cms/(authed)/youtube/competitors/_saiu/view-model'
import { JANELA_FORJA_MIN } from '@/lib/youtube/observatorio/saiu/modelo'
import { AGORA, apagando, canal, fila, grupo, ha, respondidoApagado, respondidoMantido, video, voltouApagado } from './saiu-fixtures'
import type { LeituraDaFila } from '@/lib/youtube/observatorio/saiu/modelo'

const ok = (l: LeituraDaFila, mostrar = 10): FilaViewOk => {
  const v = buildFilaView(l, { agoraMs: AGORA, mostrar })
  if (v.estado !== 'ok') throw new Error(`esperava ok, veio ${v.estado}`)
  return v
}

describe('A5 E9 T10b: view model da fila', () => {
  it('cheia: "5 itens esperando você e 2 apagando", barra por tipo e contador', () => {
    const v = ok(fila({ esperando: [video(1), video(2), video(3), canal(), grupo()], apagando: [apagando(1), apagando(2)] }))
    expect(v.resumo.negrito).toBe('5 itens esperando você e 2 apagando.')
    expect(v.resumo.barra.map(b => [b.tipo, b.n])).toEqual([['video', 3], ['canal', 1], ['comentarios', 1]])
    expect(v.resumo.texto).toContain('3 vídeos, 1 canal inteiro e 1 grupo de comentários esperam sua resposta')
    expect(v.resumo.texto).toContain('sem resposta, o dado fica')
    expect(v.contador).toBe(7)
  })

  it('vazia: leitura recente e sem leitura recente dizem frases diferentes', () => {
    const recente = ok(fila({ esperando: [], ultimaLeituraDosCanais: ha(0, 2) }))
    expect(recente.resumo.vazia).toBe(true)
    expect(recente.resumo.texto).toMatch(/Tudo o que você acompanha continua vindo do YouTube.*Última leitura dos canais: hoje, às \d\d:\d\d\./)
    const velha = ok(fila({ esperando: [], ultimaLeituraDosCanais: ha(3) }))
    expect(velha.resumo.texto).toMatch(/última leitura dos canais foi em \d\d\/\d\d, às \d\d:\d\d: não dá para afirmar que nada saiu/)
    expect(velha.resumo.texto).not.toContain('continua vindo')
    const nunca = ok(fila({ esperando: [], ultimaLeituraDosCanais: null }))
    expect(nunca.resumo.texto).toContain('ainda não houve leitura dos canais')
  })

  it('sem canais: "Você ainda não acompanha nenhum canal."', () => {
    const l = fila({ esperando: [], canaisDoSite: 0, ultimaLeituraDosCanais: null })
    expect(ok(l).resumo.texto).toBe('Você ainda não acompanha nenhum canal.')
  })

  it('canal inteiro é um item só, com os vídeos dele no painel', () => {
    const v = ok(fila({ esperando: [canal()] }))
    expect(v.cartoes).toHaveLength(1)
    const c = v.cartoes[0]!
    expect(c.rotuloDoTipo).toBe('Canal inteiro')
    expect(c.linha2).toContain('um item só, não um por vídeo')
    expect(c.painel!.some.some(l => l.texto.includes('vídeos acompanhados') || l.texto.includes('vídeos'))).toBe(true)
    expect(c.painel!.titulo).toBe('Apagar este canal inteiro para sempre?')
  })

  it('comentários: "7 comentários de 2 vídeos" e os vídeos com a contagem', () => {
    const c = ok(fila({ esperando: [grupo()] })).cartoes[0]!
    expect(c.titulo).toBe('7 comentários de 2 vídeos')
    const vids = c.fatos.find(f => f.rotulo === 'Vídeos dos comentários')!
    expect(vids.valor).toBe('Vídeo X (4 comentários) · Vídeo Y (3 comentários)')
  })

  it('painel de comentários: "7 comentários e 1 resposta do criador"', () => {
    const c = ok(fila({ esperando: [grupo()] })).cartoes[0]!
    expect(c.painel!.some[0]).toEqual({ n: '7', texto: '7 comentários e 1 resposta do criador' })
    expect(c.painel!.alvo).toEqual({ tipo: 'comentarios', id: grupo().chave, ids: [11, 12, 13, 14, 15, 16, 17] })
  })

  it('painel do vídeo: linhas do mockup, zero omitido, tabela desconhecida com o nome', () => {
    const it = video(1)
    it.previa = { ...(it.previa as object), linhas: { competitor_videos: 1, competitor_changes: 0, competitor_video_daily: 41, tabela_nova_qualquer: 2 }, miniaturas: 0, forjaEmAndamento: false, respostasDoCriador: 0 }
    const p = ok(fila({ esperando: [it] })).cartoes[0]!.painel!
    const textos = p.some.map(l => l.texto)
    expect(textos.some(t => t.includes('mudanças'))).toBe(false)
    expect(textos).toContain('2 linhas em tabela_nova_qualquer')
    expect(textos[0]).toBe('1 vídeo')
  })

  it('painel: "o que fica" leva o código e não leva título; sem número nem imagem', () => {
    const p = ok(fila({ esperando: [video(1)] })).cartoes[0]!.painel!
    expect(p.fica[0]).toContain('COD00000001')
    expect(p.fica[0]).toContain('Nenhum título, número ou imagem')
    expect(p.fica.join(' ')).not.toContain('Vídeo sintético')
  })

  it('painel: leituras de nicho e NAS com o texto novo; canal tem a linha das notificações, vídeo não', () => {
    const v = ok(fila({ esperando: [video(1), canal()] }))
    const pv = v.cartoes[0]!.painel!.naoSai.join(' | ')
    const pc = v.cartoes[1]!.painel!.naoSai.join(' | ')
    expect(pv).toContain('Leituras e pacotes de nicho da forja que citem este vídeo: o sistema não reescreve')
    expect(pv).toContain('Cópias no arquivo do NAS: nenhuma (a exportação para o NAS ainda não existe)')
    expect(pv).not.toContain('Notificações antigas')
    expect(pc).toContain('Notificações antigas do sino que citam o nome do canal: ficam')
  })

  it('recusa: "até N minutos" vem da constante e a recusa já está escrita no painel', () => {
    const it = video(1)
    it.previa = { ...(it.previa as object), linhas: {}, miniaturas: 0, forjaEmAndamento: true, respostasDoCriador: 0 }
    const p = ok(fila({ esperando: [it] })).cartoes[0]!.painel!
    expect(p.recusa).toBe(`A forja está lendo este vídeo agora. Tente de novo em até ${JANELA_FORJA_MIN} minutos.`)
    const v45 = buildFilaView(fila({ esperando: [it] }), { agoraMs: AGORA, mostrar: 10, janelaMin: 45 })
    expect(v45.estado === 'ok' && v45.cartoes[0]!.painel!.recusa).toContain('até 45 minutos')
  })

  it('apagando: "faltam 3 miniaturas"; só pastas: "falta conferir 2 pastas"; sem botões de NAS', () => {
    const t = 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/'
    const pasta = (n: number) => `observatorio/thumbs/00000000-0000-4000-8000-00000000000${n}/`
    const a = ok(fila({ esperando: [], apagando: [apagando(1, { pendentes: [t + 'a.jpg', t + 'b.jpg', t + 'c.jpg'] }), apagando(2, { pendentes: [pasta(1), pasta(2)] })] })).apagando
    expect(a[0]!.falta).toBe('faltam 3 miniaturas no Blob')
    expect(a[1]!.falta).toBe('falta conferir 2 pastas de miniatura')
    expect(JSON.stringify(a)).not.toMatch(/Ver os comandos|Já rodei/)
  })

  it('item que está apagando e voltou: fica em "Apagando" com a linha "voltou ao ar em dd/mm", e o contador o conta uma vez', () => {
    const v = ok(fila({ esperando: [], apagando: [apagando(1, { voltouEm: ha(1) })] }))
    expect(v.apagando[0]!.voltou).toMatch(/^voltou ao ar em \d\d\/\d\d$/)
    expect(v.voltaram).toHaveLength(0)
    expect(v.contador).toBe(1)
  })

  it('voltou apagado: só o código e as duas datas, dois botões; comentário: um botão; mantido: sem botão', () => {
    const v = ok(fila({ esperando: [], voltaram: [
      voltouApagado(),
      voltouApagado({ tipo: 'comentarios', itemIds: [31, 32, 33], codigo: null, comentarios: 3 }),
      voltouApagado({ pedeResposta: false, itemIds: [], titulo: 'Mantido que voltou' }),
    ] })).voltaram
    expect(v[0]!.acoes.map(a => a.rotulo)).toEqual(['Voltar a acompanhar', 'Ignorar'])
    expect(v[0]!.dica).toContain('Entra de novo na próxima leitura do canal, se ainda estiver entre os vídeos mais recentes')
    expect(v[1]!.acoes.map(a => a.rotulo)).toEqual(['Não perguntar de novo'])
    expect(v[1]!.texto).toBe('3 comentários que você apagou voltaram a aparecer.')
    expect(v[2]!.acoes).toEqual([])
  })

  it('comentários que voltaram, 600 linhas: o botão leva 500 ids e o cartão diz que são 600', () => {
    const ids = Array.from({ length: 600 }, (_, i) => i + 1)
    const v = ok(fila({ esperando: [], voltaram: [voltouApagado({ tipo: 'comentarios', itemIds: ids, codigo: null, comentarios: 600 })] })).voltaram[0]!
    expect(v.acoes[0]!.itemIds).toHaveLength(500)
    expect(v.acoes[0]!.itemIds[0]).toBe(1)
    expect(v.texto).toContain('600 comentários')
    expect(v.dica).toContain('São 600; cada clique responde 500')
  })

  it('respondidos: mantido com a marca, apagado só com código e data; 51 apagados mostram 50 e "e mais 1"', () => {
    const itens = [respondidoMantido(), respondidoApagado()]
    const r = ok(fila({ esperando: [], respondidos: itens, respondidosTotal: 2 })).respondidos
    expect(r.itens[0]!.texto).toMatch(/mantido para análise/)
    expect(r.itens[1]!.titulo).toBeNull()
    expect(r.itens[1]!.texto).toBe('tudo removido, e os arquivos do Blob também')
    const muitos = Array.from({ length: 50 }, (_, i) => respondidoApagado({ itemId: i + 1, codigo: `UC${i}` }))
    const m = ok(fila({ esperando: [], respondidos: muitos, respondidosTotal: 51 })).respondidos
    expect(m.itens).toHaveLength(50)
    expect(m.eMais).toBe('e mais 1')
  })

  it('25 itens: mostra 10 e "Mostrar mais"; com mostrar=20 mostra 20 e sobram 5', () => {
    const itens = Array.from({ length: 25 }, (_, i) => video(i))
    const a = ok(fila({ esperando: itens }), 10)
    expect(a.cartoes).toHaveLength(10)
    expect(a.maisN).toEqual({ n: 15, mostrar: 20 })
    const b = ok(fila({ esperando: itens }), 20)
    expect(b.cartoes).toHaveLength(20)
    expect(b.maisN).toEqual({ n: 5, mostrar: 30 })
    expect(ok(fila({ esperando: itens }), 30).maisN).toBeNull()
  })

  it('"Manter todos" leva só os ids mostrados', () => {
    const itens = Array.from({ length: 12 }, (_, i) => video(i))
    const t = ok(fila({ esperando: itens }), 10).manterTodos!
    expect(t.rotulo).toBe('Manter todos para análise (10)')
    expect(t.grupos).toEqual([{ tipo: 'video', ids: itens.slice(0, 10).map(i => i.chave) }])
  })

  it('sem poder responder: a frase vem junto e "Manter todos" some', () => {
    const v = ok(fila({ podeResponder: false }))
    expect(v.podeResponder).toBe(false)
    expect(v.semPermissao).toBe('Só quem administra o site pode responder.')
    expect(v.manterTodos).toBeNull()
  })

  it('item com prévia em erro: sem "Guardado" e sem apagar, com a frase do erro', () => {
    const it = video(1, { previa: { erro: 'contagem_indisponivel' } })
    const c = ok(fila({ esperando: [it] })).cartoes[0]!
    expect(c.painel).toBeNull()
    expect(c.guardado).toBeNull()
    expect(c.fatos.some(f => f.rotulo === 'Guardado')).toBe(false)
    expect(c.erroDaPrevia).toBe('Não foi possível contar o que há guardado deste item.')
  })

  it('erro e schema ausente: a frase, e nenhum bloco de lista', () => {
    const e = buildFilaView({ estado: 'erro', codigo: 'erro_de_banco' }, { agoraMs: AGORA, mostrar: 10 })
    expect(e).toEqual({ estado: 'erro', frase: 'Não foi possível ler a fila agora.' })
    const s = buildFilaView({ estado: 'schema_ausente', texto: 'x' }, { agoraMs: AGORA, mostrar: 10 })
    expect(s).toEqual({ estado: 'erro', frase: 'A fila não pode ser lida: a migration desta etapa ainda não foi aplicada.' })
    expect(buildFilaView({ estado: 'sem_acesso' }, { agoraMs: AGORA, mostrar: 10 }).estado).toBe('sem_acesso')
  })

  it('dias esperando: 0 é "hoje", 1 é "1 dia"', () => {
    const c = ok(fila({ esperando: [video(1, { diasEsperando: 0 }), video(2, { diasEsperando: 1 })] })).cartoes
    expect(c[0]!.quando).toMatch(/\(hoje\)$/)
    expect(c[1]!.quando).toMatch(/\(1 dia\)$/)
  })

  it('nenhum campo nulo vira 0 ou texto vazio: "não registrado"; desde vazio vira "antes de 12/10"', () => {
    const it = video(1, { titulo: null, canal: null, views: null, curtidas: null, comentarios: null, desde: '', ultimaLeitura: null, canalNoAr: null })
    const c = ok(fila({ esperando: [it] })).cartoes[0]!
    expect(c.titulo).toBe('não registrado')
    expect(c.quando).toContain('antes de 12/10')
    const contagem = c.fatos.find(f => f.rotulo === 'Última contagem')!
    expect(contagem.valor).toBe('não registrado · não registrado · não registrado')
    expect(c.fatos.find(f => f.rotulo === 'O canal')!.valor).toBe('não registrado')
    expect(JSON.stringify(c)).not.toMatch(/"0 views"/)
  })

  it('ordem do mockup: "Guardado" resume dias, versões e mudanças', () => {
    const c = ok(fila({ esperando: [video(1)] })).cartoes[0]!
    expect(c.guardado).toBe('41 dias de views, 3 títulos, 2 miniaturas, 1 descrição, 5 mudanças')
  })

  it('lerMostrar: múltiplo de 10 entre 10 e 200; o resto vira 10', () => {
    expect([lerMostrar('20'), lerMostrar('200'), lerMostrar('10')]).toEqual([20, 200, 10])
    expect([lerMostrar(undefined), lerMostrar('abc'), lerMostrar('15'), lerMostrar('210'), lerMostrar('0'), lerMostrar('-10'), lerMostrar(['30', '40'])]).toEqual([10, 10, 10, 10, 10, 10, 30])
  })

  it('m-1 (portão 14/10): "Manter todos" fatia cada tipo em pedaços de 500 ids', () => {
    const ids = (a: number): number[] => Array.from({ length: 300 }, (_, i) => a + i)
    const itens = [grupo({ chave: 'c-a', idsDoGrupo: ids(1) }), grupo({ chave: 'c-b', idsDoGrupo: ids(1000) })]
    const t = ok(fila({ esperando: itens }), 10).manterTodos!
    const tam = t.grupos.filter(g => g.tipo === 'comentario').map(g => g.ids.length)
    expect(tam).toEqual([500, 100])
  })
})
