/**
 * A5 · E9, Tarefa 10b: o view model PURO da tela "Saíram do YouTube". Tudo o que a tela escreve sai daqui; o componente só desenha.
 * Sem relógio próprio (o instante vem por parâmetro), sem banco, sem ações. Datas em São Paulo, `dd/mm`.
 * TEXTO-A-REVISAR: as frases daqui seguem o mockup aprovado (13/10) e a seção 8 do plano; o plano não as fixa letra a letra.
 */
import {
  DATA_MG1, FILA_PAGINA, JANELA_FORJA_MIN, PALAVRA, RESPONDIDOS_PAGINA, estadoDaFilaVazia, faltaNoBlob, fraseDoErro,
  type ItemApagando, type ItemEsperando, type ItemRespondido, type ItemVoltou, type LeituraDaFila, type Previa, type TipoDeItem,
} from '@/lib/youtube/observatorio/saiu/modelo'
import { fraseDaVolta, fraseDoPainelDeComentarios, linhasDoPainel, resumoGuardado } from '@/lib/youtube/observatorio/saiu/rotulos'

const nf = new Intl.NumberFormat('pt-BR')
const fmtN = (n: number): string => nf.format(n)
const pl = (n: number, a: string, b: string): string => `${fmtN(n)} ${n === 1 ? a : b}`
const NAO_REGISTRADO = 'não registrado'
export const SEM_PERMISSAO_FRASE = 'Só quem administra o site pode responder.'

const fmtDM = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const fmtHM = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** `dd/mm` em São Paulo; vazio ou inválido = `null` (a tela escreve "não registrado", nunca uma data inventada). */
export function dm(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso) : NaN
  return Number.isFinite(t) ? fmtDM.format(t) : null
}
const hm = (iso: string): string => fmtHM.format(Date.parse(iso))
const diaSP = (ms: number): string => fmtDia.format(ms)

/** "184 mil", "2,1 mi", "412": número compacto, sempre com o valor real por baixo (o `title` da tela leva o exato). */
export function compacto(n: number): string {
  if (n < 1000) return fmtN(n)
  if (n < 1_000_000) { const v = n / 1000; return `${(v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toString().replace('.', ',')} mil` }
  const v = n / 1_000_000
  return `${(v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toString().replace('.', ',')} mi`
}
const dado = (n: number | null, uni?: string): string => (n == null ? NAO_REGISTRADO : uni ? `${compacto(n)} ${uni}` : compacto(n))
const diasTxt = (n: number): string => (n <= 0 ? 'hoje' : pl(n, 'dia', 'dias'))
const duracao = (s: number | null): string | null => (s == null || s < 0 ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

export type TipoDeBarra = TipoDeItem
export interface Fato { rotulo: string; nota?: string; valor: string; largo?: boolean }
export interface LinhaDoPainel { n: string; texto: string }
export interface PainelView {
  /** "Apagar este vídeo para sempre?" */
  titulo: string
  aviso: string
  some: LinhaDoPainel[]
  efeito: string
  fica: string[]
  naoSai: string[]
  /** Forja lendo agora: o campo nasce desabilitado e a recusa já está escrita. */
  recusa: string | null
  palavra: string
  /** O que a ação precisa; o painel nunca monta isto sozinho. */
  alvo: { tipo: TipoDeItem; id: string; ids: number[] | null }
}
export interface CartaoView {
  chave: string
  tipo: TipoDeItem
  rotuloDoTipo: string
  quando: string
  titulo: string
  linha2: string
  fatos: Fato[]
  /** `null` = a prévia falhou: o cartão sai sem "Guardado" e sem apagar. */
  guardado: string | null
  erroDaPrevia: string | null
  apagarRotulo: string
  painel: PainelView | null
  manter: { tipo: 'video' | 'canal' | 'comentario'; ids: Array<string | number> }
}
export interface VoltaView {
  chave: string
  tipo: TipoDeItem
  rotuloDoTipo: string
  quando: string
  titulo: string | null
  codigo: string | null
  texto: string
  /** `voltar`/`ignorar` por item; comentários só têm "Não perguntar de novo" (`grupo`). */
  acoes: Array<{ rotulo: string; acao: 'voltar' | 'ignorar' | 'ignorar_grupo'; itemIds: number[] }>
  dica: string | null
}
export interface ApagandoView {
  chave: string
  itemId: number
  tipo: TipoDeItem
  codigo: string
  desde: string
  falta: string
  voltou: string | null
  podeTentar: boolean
}
export interface RespondidoView {
  chave: string
  tipo: TipoDeItem
  rotuloDoTipo: string
  codigo: string
  titulo: string | null
  situacao: 'mantido' | 'apagado'
  quando: string
  texto: string
}
export interface FilaViewOk {
  estado: 'ok'
  podeResponder: boolean
  semPermissao: string | null
  contador: number
  resumo: {
    vazia: boolean
    negrito: string
    texto: string
    barra: Array<{ tipo: TipoDeBarra; n: number; texto: string }>
  }
  cartoes: CartaoView[]
  maisN: { n: number; mostrar: number } | null
  manterTodos: { rotulo: string; grupos: Array<{ tipo: 'video' | 'canal' | 'comentario'; ids: Array<string | number> }> } | null
  voltaram: VoltaView[]
  apagando: ApagandoView[]
  respondidos: { itens: RespondidoView[]; total: number; eMais: string | null }
  ajuda: string[]
}
export type FilaView =
  | FilaViewOk
  | { estado: 'sem_acesso'; frase: string }
  | { estado: 'erro'; frase: string }

const ROTULO: Record<TipoDeItem, string> = { video: 'Vídeo', canal: 'Canal inteiro', comentarios: 'Comentários' }

const AJUDA = [
  'Quando entra aqui: o vídeo, o canal ou o comentário não veio do YouTube em duas leituras seguidas. Uma leitura só não basta: falha de rede não é sumiço.',
  'Sem resposta, nada acontece: nenhuma rotina apaga por prazo. O dado fica até você decidir.',
  'O motivo: o YouTube devolve a mesma ausência para algo apagado pelo autor, privado, denunciado ou removido por ordem judicial. A tela não adivinha.',
  'Manter: continua em todas as telas com a marca "saiu do YouTube em dd/mm, mantido para análise".',
  'Apagar: não dá para desfazer. Pede a palavra APAGAR e mostra antes a contagem do que some e do que fica.',
  'Apagando: falta apagar miniaturas ou arquivos. O item conta no número da aba até acabar.',
  'Um vídeo apagado e antigo que volte ao ar fora das páginas lidas do canal não é percebido.',
]

function estaNaMensagemDeErro(l: LeituraDaFila): FilaView | null {
  if (l.estado === 'ok') return null
  if (l.estado === 'sem_acesso') return { estado: 'sem_acesso', frase: 'Você não tem acesso a esta fila.' }
  if (l.estado === 'schema_ausente') return { estado: 'erro', frase: 'A fila não pode ser lida: a migration desta etapa ainda não foi aplicada.' }
  return { estado: 'erro', frase: l.codigo === 'tempo_esgotado' ? 'Não foi possível ler a fila agora. Recarregue a página.' : 'Não foi possível ler a fila agora.' }
}

function previaOk(p: ItemEsperando['previa']): p is Previa { return !('erro' in p) }

function painelDe(i: ItemEsperando, p: Previa, janelaMin: number): PainelView {
  const canal = i.tipo === 'canal', com = i.tipo === 'comentarios'
  const some: LinhaDoPainel[] = linhasDoPainel(p.linhas, p.miniaturas).map(l => ({ n: fmtN(l.n), texto: l.texto }))
  if (com) {
    const n = i.comentarios ?? 0
    some.unshift({ n: fmtN(n), texto: fraseDoPainelDeComentarios(n, p.respostasDoCriador) })
  }
  const efeito = canal ? 'Este canal deixa de contar nas medidas do nicho.' : com ? 'Estes comentários deixam de contar nas medidas dos vídeos.' : 'Este vídeo deixa de contar nas medidas do canal.'
  const fica: string[] = []
  fica.push(com
    ? 'O código de cada comentário no YouTube e a data desta decisão. Nenhum texto, nome ou contagem.'
    : `O código ${canal ? 'do canal' : 'do vídeo'} no YouTube${i.codigo ? ` (${i.codigo})` : ''} e a data desta decisão. Nenhum título, número ou imagem.`)
  fica.push(canal ? 'Os seus outros canais e tudo o que é deles.' : com ? `Os vídeos e o canal${i.canal ? ` ${i.canal}` : ''}.` : `O canal${i.canal ? ` ${i.canal}` : ''} e os outros vídeos dele.`)
  const naoSai = ['Texto copiado ou enviado para uma IA fora daqui: o sistema não alcança.']
  if (!com) naoSai.push('Leituras e pacotes de nicho da forja que citem este vídeo: o sistema não reescreve.'.replace('este vídeo', canal ? 'este canal' : 'este vídeo'))
  if (canal) naoSai.push('Notificações antigas do sino que citam o nome do canal: ficam.')
  naoSai.push(`Cópias no arquivo do NAS: nenhuma (a exportação para o NAS ainda não existe).`)
  const que = canal ? 'este canal inteiro' : com ? `estes ${pl(i.comentarios ?? 0, 'comentário', 'comentários')}` : 'este vídeo'
  const volta = com ? 'voltarem ao YouTube, entram de novo como novos' : `${canal ? 'ele' : 'o vídeo'} voltar ao YouTube, entra de novo como novo`
  return {
    titulo: `Apagar ${que} para sempre?`,
    aviso: `Não dá para desfazer. Se ${volta}, sem este histórico.`,
    some, efeito, fica, naoSai,
    recusa: p.forjaEmAndamento ? `A forja está lendo este vídeo agora. Tente de novo em até ${janelaMin} minutos.` : null,
    palavra: PALAVRA,
    alvo: { tipo: i.tipo, id: i.chave, ids: i.idsDoGrupo ? i.idsDoGrupo.slice(0, 500) : null },
  }
}

function cartaoDe(i: ItemEsperando, janelaMin: number): CartaoView {
  const canal = i.tipo === 'canal', com = i.tipo === 'comentarios'
  const desde = dm(i.desde) ?? `antes de ${dm(DATA_MG1) ?? DATA_MG1}`
  const quando = `Não veio mais do YouTube desde ${desde} (${diasTxt(i.diasEsperando)})`
  const ok = previaOk(i.previa)
  const prev = ok ? (i.previa as Previa) : null
  const leitura = dm(i.ultimaLeitura)
  const fatos: Fato[] = []
  let linha2: string
  if (i.tipo === 'video') {
    linha2 = [i.canal ?? NAO_REGISTRADO, i.formato === 'short' ? 'Short' : i.formato === 'longo' ? 'vídeo longo' : null, duracao(i.duracaoSeg),
      i.publicadoEm ? `publicado em ${dm(i.publicadoEm)}` : null, i.vistoPrimeiro ? `visto pela 1ª vez em ${dm(i.vistoPrimeiro)}` : null].filter(Boolean).join(' · ')
    fatos.push({ rotulo: 'Última contagem', nota: leitura ? `(leitura de ${leitura})` : undefined, valor: `${dado(i.views, 'views')} · ${dado(i.curtidas, 'curtidas')} · ${dado(i.comentarios, 'comentários')}` })
    fatos.push({ rotulo: 'O canal', valor: i.canalNoAr == null ? NAO_REGISTRADO : i.canalNoAr ? 'continua no ar' : 'também saiu' })
  } else if (canal) {
    linha2 = `${i.inscritos != null ? `${compacto(i.inscritos)} inscritos · ` : ''}um item só, não um por vídeo`
    fatos.push({ rotulo: 'Última contagem', nota: leitura ? `(leitura de ${leitura})` : undefined, valor: `${dado(i.inscritos, 'inscritos')} · ${dado(i.views, 'views')} no total` })
    fatos.push({ rotulo: 'O canal', valor: 'saiu inteiro, com os vídeos dele' })
  } else {
    linha2 = `${i.canal ?? NAO_REGISTRADO} · comentários de terceiros, agrupados por canal`
    fatos.push({
      rotulo: 'Vídeos dos comentários', largo: true,
      valor: (i.videosDoGrupo ?? []).map(v => `${v.titulo ?? NAO_REGISTRADO} (${pl(v.comentarios, 'comentário', 'comentários')})`).join(' · ') || NAO_REGISTRADO,
    })
    fatos.push({ rotulo: 'Última conferência', valor: leitura ?? NAO_REGISTRADO })
  }
  let guardado: string | null = null
  if (prev) {
    guardado = com ? fraseDoPainelDeComentarios(i.comentarios ?? 0, prev.respostasDoCriador) : (resumoGuardado(prev.linhas, prev.miniaturas, prev.versoes) || null)
    if (guardado) fatos.push({ rotulo: 'Guardado', valor: guardado, largo: !com })
  }
  const tipoManter: 'video' | 'canal' | 'comentario' = com ? 'comentario' : canal ? 'canal' : 'video'
  return {
    chave: `${i.tipo}-${i.chave}`, tipo: i.tipo, rotuloDoTipo: ROTULO[i.tipo], quando,
    titulo: i.titulo ?? NAO_REGISTRADO, linha2, fatos, guardado,
    erroDaPrevia: prev ? null : fraseDoErro('contagem_indisponivel'),
    apagarRotulo: canal ? 'Apagar o canal…' : com ? 'Apagar os textos…' : 'Apagar o vídeo…',
    painel: prev ? painelDe(i, prev, janelaMin) : null,
    manter: { tipo: tipoManter, ids: com ? (i.idsDoGrupo ?? []).slice(0, 500) : [i.chave] },
  }
}

function voltaDe(v: ItemVoltou, idx: number): VoltaView {
  const quando = v.voltouEm ? `Voltou ao ar em ${dm(v.voltouEm) ?? NAO_REGISTRADO}` : 'Voltou ao ar'
  const base = { chave: `${v.tipo}-${v.codigo ?? 'g'}-${v.itemIds[0] ?? idx}-${idx}`, tipo: v.tipo, rotuloDoTipo: ROTULO[v.tipo], titulo: v.titulo, codigo: v.codigo }
  if (!v.pedeResposta) {
    return { ...base, quando: `${quando} · você tinha mantido`, texto: 'Continua com o histórico inteiro; a marca "saiu do YouTube" saiu das telas. Nada a fazer.', acoes: [], dica: null }
  }
  if (v.tipo === 'comentarios') {
    const n = v.comentarios ?? v.itemIds.length
    return {
      ...base, quando: `${quando} · você apagou`, texto: `${pl(n, 'comentário que você apagou voltou', 'comentários que você apagou voltaram')} a aparecer.`,
      acoes: [{ rotulo: 'Não perguntar de novo', acao: 'ignorar_grupo', itemIds: v.itemIds.slice(0, 500) }],
      dica: `${n > 500 ? `São ${fmtN(n)}; cada clique responde 500. ` : ''}${fraseDaVolta('comentarios')}`,
    }
  }
  return {
    ...base, quando: `${quando} · você apagou`,
    texto: 'Só o código do YouTube e as datas: o título, os números e as imagens foram apagados e não voltam.',
    acoes: [{ rotulo: 'Voltar a acompanhar', acao: 'voltar', itemIds: v.itemIds }, { rotulo: 'Ignorar', acao: 'ignorar', itemIds: v.itemIds }],
    dica: `"Voltar" começa um histórico novo, do zero. ${fraseDaVolta(v.tipo)} "Ignorar" não pergunta de novo.`,
  }
}

function apagandoDe(a: ItemApagando, idx: number): ApagandoView {
  const f = faltaNoBlob(a.pendentes)
  const partes: string[] = []
  if (f.miniaturas > 0) partes.push(`faltam ${pl(f.miniaturas, 'miniatura', 'miniaturas')} no Blob`)
  if (f.pastas > 0) partes.push(f.miniaturas > 0 ? `${pl(f.pastas, 'pasta', 'pastas')} a conferir` : `falta conferir ${pl(f.pastas, 'pasta', 'pastas')} de miniatura`)
  if (a.arquivoPendente) partes.push('arquivo no NAS esperando')
  const voltou = a.voltouEm ? `voltou ao ar em ${dm(a.voltouEm) ?? NAO_REGISTRADO}` : null
  return {
    chave: `${a.itemId}-${idx}`, itemId: a.itemId, tipo: a.tipo, codigo: a.codigo ?? NAO_REGISTRADO, desde: dm(a.decididoEm) ?? NAO_REGISTRADO,
    falta: partes.length ? partes.join('; ') : 'falta concluir', voltou, podeTentar: a.pendentes.length > 0,
  }
}

function respondidoDe(r: ItemRespondido, idx: number): RespondidoView {
  const quando = dm(r.quando) ?? NAO_REGISTRADO
  if (r.tipo === 'comentarios') {
    const n = r.comentarios ?? 0
    return {
      chave: `c-${idx}`, tipo: 'comentarios', rotuloDoTipo: ROTULO.comentarios, codigo: r.titulo ?? NAO_REGISTRADO, titulo: null, situacao: r.situacao, quando,
      texto: r.situacao === 'mantido' ? `${pl(n, 'comentário mantido', 'comentários mantidos')} para análise` : `${pl(n, 'comentário apagado', 'comentários apagados')}; ficam só os códigos e a data`,
    }
  }
  return {
    chave: `${r.itemId ?? 'm'}-${r.codigo ?? idx}-${idx}`, tipo: r.tipo, rotuloDoTipo: ROTULO[r.tipo], codigo: r.codigo ?? NAO_REGISTRADO, titulo: r.situacao === 'mantido' ? r.titulo : null,
    situacao: r.situacao, quando,
    texto: r.situacao === 'mantido' ? `continua em todas as telas, com a marca "saiu do YouTube em ${quando} · mantido para análise"` : 'tudo removido, e os arquivos do Blob também',
  }
}

export function buildFilaView(leitura: LeituraDaFila, o: { agoraMs: number; mostrar: number; janelaMin?: number }): FilaView {
  const erro = estaNaMensagemDeErro(leitura)
  if (erro) return erro
  if (leitura.estado !== 'ok') return { estado: 'erro', frase: 'Não foi possível ler a fila agora.' }
  const f = leitura.fila
  const janelaMin = o.janelaMin ?? JANELA_FORJA_MIN
  const mostrar = Math.max(FILA_PAGINA, o.mostrar)
  const qtd = f.totalEsperando
  const apagandoN = f.apagando.length
  const voltaPend = f.voltaram.filter(v => v.pedeResposta).length
  const contador = qtd + apagandoN + voltaPend

  const nV = f.esperando.filter(i => i.tipo === 'video').length
  const nC = f.esperando.filter(i => i.tipo === 'canal').length
  const nM = f.esperando.filter(i => i.tipo === 'comentarios').length

  const cartoes = f.esperando.slice(0, mostrar).map(i => cartaoDe(i, janelaMin))
  const restam = Math.max(0, qtd - cartoes.length)

  let resumo: FilaViewOk['resumo']
  if (contador === 0) {
    const estado = estadoDaFilaVazia(f, o.agoraMs)
    const ult = f.ultimaLeituraDosCanais
    let texto: string
    if (estado === 'sem_canais') texto = 'Você ainda não acompanha nenhum canal.'
    else if (estado === 'vazia') {
      const quando = ult && diaSP(Date.parse(ult)) === diaSP(o.agoraMs) ? `hoje, às ${hm(ult)}` : `em ${dm(ult)}, às ${ult ? hm(ult) : ''}`
      texto = `Tudo o que você acompanha continua vindo do YouTube. A fila só enche quando algo some. Última leitura dos canais: ${quando}.`
    } else {
      texto = ult
        ? `Mas a última leitura dos canais foi em ${dm(ult)}, às ${hm(ult)}: não dá para afirmar que nada saiu.`
        : 'Mas ainda não houve leitura dos canais: não dá para afirmar que nada saiu.'
    }
    resumo = { vazia: true, negrito: estado === 'sem_canais' ? 'Nenhum item esperando.' : estado === 'vazia' ? 'Nenhum item esperando.' : 'Nenhum item na fila.', texto, barra: [] }
  } else {
    const partes: string[] = []
    if (nV) partes.push(pl(nV, 'vídeo', 'vídeos'))
    if (nC) partes.push(pl(nC, 'canal inteiro', 'canais inteiros'))
    if (nM) partes.push(pl(nM, 'grupo de comentários', 'grupos de comentários'))
    const negrito = `${qtd ? pl(qtd, 'item esperando você', 'itens esperando você') : 'Nenhum item esperando você'}${apagandoN ? ` e ${apagandoN} apagando` : ''}.`
    let texto = ''
    if (qtd) texto += `${partes.join(', ').replace(/, ([^,]*)$/, ' e $1')} ${qtd > 1 ? 'esperam' : 'espera'} sua resposta. Nenhum destes itens foi apagado; sem resposta, o dado fica. O YouTube não diz por que sumiram.`
    if (voltaPend) texto += ` ${pl(voltaPend, 'voltou ao ar e espera', 'voltaram ao ar e esperam')} você decidir se volta a acompanhar.`
    const barra: FilaViewOk['resumo']['barra'] = []
    if (nV) barra.push({ tipo: 'video', n: nV, texto: nV === 1 ? 'vídeo' : 'vídeos' })
    if (nC) barra.push({ tipo: 'canal', n: nC, texto: nC === 1 ? 'canal' : 'canais' })
    if (nM) barra.push({ tipo: 'comentarios', n: nM, texto: nM === 1 ? 'grupo de comentários' : 'grupos de comentários' })
    resumo = { vazia: false, negrito, texto: texto.trim(), barra }
  }

  const manterTodos = cartoes.length > 1 && f.podeResponder
    ? {
      rotulo: `Manter todos para análise (${cartoes.length})`,
      // a ação recusa mais de 500 ids por chamada: cada tipo sai em pedaços de 500 (m-1 do portão 14/10)
      grupos: (['video', 'canal', 'comentario'] as const).flatMap(tipo => {
        const todos = cartoes.filter(c => c.manter.tipo === tipo).flatMap(c => c.manter.ids)
        const pedacos: Array<{ tipo: typeof tipo; ids: Array<string | number> }> = []
        for (let i = 0; i < todos.length; i += 500) pedacos.push({ tipo, ids: todos.slice(i, i + 500) })
        return pedacos
      }),
    }
    : null

  const ids = f.respondidos
  return {
    estado: 'ok', podeResponder: f.podeResponder, semPermissao: f.podeResponder ? null : SEM_PERMISSAO_FRASE, contador, resumo, cartoes,
    maisN: restam > 0 ? { n: restam, mostrar: Math.min(200, mostrar + FILA_PAGINA) } : null,
    manterTodos,
    voltaram: f.voltaram.map(voltaDe),
    apagando: f.apagando.map(apagandoDe),
    respondidos: {
      itens: ids.map(respondidoDe),
      total: f.respondidosTotal,
      eMais: f.respondidosTotal > RESPONDIDOS_PAGINA ? `e mais ${fmtN(f.respondidosTotal - ids.length)}` : null,
    },
    ajuda: AJUDA,
  }
}

/** `?mostrar=`: inteiro, múltiplo de 10, de 10 a 200; qualquer outra coisa vira 10. */
export function lerMostrar(v: string | string[] | undefined): number {
  const t = Array.isArray(v) ? v[0] : v
  if (typeof t !== 'string' || !/^\d{1,3}$/.test(t)) return 10
  const n = Number(t)
  return n >= 10 && n <= 200 && n % 10 === 0 ? n : 10
}
