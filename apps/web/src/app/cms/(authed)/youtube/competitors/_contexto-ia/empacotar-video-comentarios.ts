/**
 * A5 · E17 degrau 1, TG: a seção "Comentários de destaque" da página do vídeo de concorrente no pacote "Perguntar a uma IA". Puro. Recebe o que a
 * seção da tela leu e montou (`SecaoLida`: o MESMO caminho da página, com o nível decidido pelo leitor) e deixa só texto, como a tela o escreve.
 *
 * Privacidade (regra fixa, não é decisão aberta):
 *  - o nível é o do leitor: sem o direito ao texto (`contagem`) o pacote leva só a contagem ("excluido") e nenhum texto, mesmo que o dado traga;
 *  - o autor do comentário NUNCA entra (nome, foto e identidade ficam na tela; o tipo `Comentario` do pacote nem tem campo para eles);
 *  - comentário que saiu do YouTube (o texto foi apagado lá) não entra: o pacote só o conta, num aviso;
 *  - texto de comentário e de resposta do criador entra só pelas portas de `terceiros.ts` (a serialização cita cada linha).
 */
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, Comentario, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { Nivel } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { semMencoes } from '@/lib/youtube/observatorio/comentarios/leitor-mencao'
import { FRASES } from '../_chrome/comentarios/frases'
import type { CartaoView, PainelView, SecaoView } from '../_chrome/comentarios/model'
import type { SecaoLida } from '../_historico/comentarios-de-destaque'

export interface ComentariosVideoIa {
  /** `nao_carregou`: a seção da tela caiu no estado de erro. */
  estado: 'lido' | 'nao_carregou'
  erro: string | null
  nivel: Nivel
  faixa: string | null
  fonte: string
  abas: Array<{ rotulo: string; estado: string }>
  /** Os painéis sem lista (fecha em, a caminho, antes da coleta, desligados...). O corpo pode citar o nome do canal: texto de terceiros. */
  estados: Array<{ idade: string; titulo: string; corpo: string | null; selo: string | null; nota: string | null }>
  listas: Array<{
    idade: string; frase: string; barra: string; movimento: string; inscritosOcultos: string | null
    legenda: Array<{ rotulo: string; texto: string; zero: boolean }>
  }>
  /** Cada comentário uma vez só (ele pode estar nas três idades). Vazio no nível contagem. */
  itens: Comentario[]
  /** Quantos comentários distintos a tela lista (o que a linha "não incluídos" do pacote conta no nível contagem). */
  quantos: number
  /** Quantos saíram do YouTube e por isso não entram. */
  saidosDoYouTube: number
  /** A casa sem valor das tabelas. */
  sem: string
}

const ORDEM_DO_ID = /^cd-(?:1|7|30)-(\d+)$/
const fim = (n: PainelView): n is Extract<PainelView, { kind: 'lista' }> => n.kind === 'lista'

/**
 * As curtidas do marco mais recente que tem leitura (o número cru do modelo, não o texto formatado). `antigoDoDia` diz o dia quando o marco usado é
 * mais velho do que a idade mais nova em que o comentário aparece listado: a IA não pode ler um número velho como o de hoje (M-1 do portão Phil).
 */
function curtidasDe(v: CartaoView, listadoAte: number): { n: number | null; antigoDoDia: number | null } {
  for (const c of [...v.curtidas].sort((a, b) => b.marco - a.marco)) {
    if (c.tipo === 'n') return { n: c.n, antigoDoDia: c.marco < listadoAte ? c.marco : null }
  }
  return { n: null, antigoDoDia: null }
}

const SEM = '—'

export function comentariosDoVideoNaoCarregaram(titulo: string = FRASES.erroDeLeitura): ComentariosVideoIa {
  return { estado: 'nao_carregou', erro: titulo, nivel: 'contagem', faixa: null, fonte: '', abas: [], estados: [], listas: [], itens: [], quantos: 0, saidosDoYouTube: 0, sem: SEM }
}

export function projetarComentariosDoVideo(lida: SecaoLida, canalNome: string): ComentariosVideoIa {
  if (!lida.ok) return comentariosDoVideoNaoCarregaram(lida.titulo)
  const s: SecaoView = lida.secao
  const paineis = Object.values(s.paineis)
  const abas = s.abas.map((a) => ({ rotulo: a.rotulo, estado: a.estado }))
  const estados = paineis.flatMap((p) => (p.kind === 'estado'
    ? [{ idade: `${p.marco} ${p.marco === 1 ? 'dia' : 'dias'}`, titulo: p.titulo, corpo: p.corpo, selo: p.selo?.texto ?? null, nota: p.nota }] : []))
  const listas = paineis.filter(fim).map((p) => ({
    idade: `${p.marco} ${p.marco === 1 ? 'dia' : 'dias'}`, frase: p.frase, barra: p.barra.texto,
    movimento: `${p.movimento.texto}${p.movimento.saidas ? ` · ${p.movimento.saidas}` : ''}`, inscritosOcultos: p.inscritosOcultos,
    legenda: p.legenda.map((l) => ({ rotulo: l.rotulo, texto: l.texto, zero: l.zero })),
  }))
  // cada comentário uma vez, na ordem de aparição (a idade mais nova primeiro, como a tela abre)
  const vistos = new Map<number, CartaoView>()
  const listadoAte = new Map<number, number>()
  for (const p of paineis.filter(fim)) for (const c of p.cartoes) {
    const m = ORDEM_DO_ID.exec(c.id)
    if (!m) continue
    if (!vistos.has(Number(m[1]))) vistos.set(Number(m[1]), c)
    listadoAte.set(Number(m[1]), Math.max(listadoAte.get(Number(m[1])) ?? 0, p.marco))
  }
  const todos = [...vistos.values()]
  const saidos = todos.filter((c) => c.saiu !== null).length
  const itens: Comentario[] = s.nivel === 'contagem' ? [] : todos.flatMap((c): Comentario[] => {
    if (c.saiu !== null || c.texto === null) return []
    const r = c.resposta
    // as menções de terceiros saem em QUALQUER nível (I-2 do portão Phil): o pacote é anônimo mesmo quando a tela mostra o @handle
    const respostas = r && r.forma === 'respondeu' && r.textos ? r.textos.map((t) => semMencoes(t.texto).texto).filter((t) => t !== '') : []
    const cur = curtidasDe(c, listadoAte.get(Number(ORDEM_DO_ID.exec(c.id)?.[1])) ?? 0)
    return [{
      texto: semMencoes(c.texto.texto).texto, curtidas: cur.n, respostas: c.rodape.respostas?.n ?? null, idade: c.rodape.publicado ?? 'sem data',
      sinalizadores: [c.motivo, ...(cur.antigoDoDia !== null ? [`curtidas do dia ${cur.antigoDoDia}`] : []), ...(c.texto.cortado ? [FRASES.cortadoAos] : [])],
      respostaDoCriador: respostas.length ? { canal: canalNome, texto: respostas.join('\n') } : null,
    }]
  })
  return { estado: 'lido', erro: null, nivel: s.nivel, faixa: s.faixa, fonte: s.fonte, abas, estados, listas, itens, quantos: todos.length, saidosDoYouTube: saidos, sem: SEM }
}

// ───────────────────────── o inventário das folhas (prefixo `derivado.comentarios.`)
const CTRL = { descartado: 'controle de tela' } as const

export const INVENTARIO_COMENTARIOS_VIDEO: Inventario = {
  'derivado.comentarios.estado': CTRL, 'derivado.comentarios.erro': 'base', 'derivado.comentarios.nivel': CTRL, 'derivado.comentarios.faixa': 'base', 'derivado.comentarios.fonte': 'base',
  'derivado.comentarios.sem': 'rotulo', 'derivado.comentarios.quantos': CTRL, 'derivado.comentarios.saidosDoYouTube': CTRL,
  'derivado.comentarios.abas[].rotulo': 'rotulo', 'derivado.comentarios.abas[].estado': 'base',
  'derivado.comentarios.estados[].idade': 'rotulo', 'derivado.comentarios.estados[].titulo': 'base', 'derivado.comentarios.estados[].corpo': 'terceiros',
  'derivado.comentarios.estados[].selo': 'base', 'derivado.comentarios.estados[].nota': 'base',
  'derivado.comentarios.listas[].idade': 'rotulo', 'derivado.comentarios.listas[].frase': 'base', 'derivado.comentarios.listas[].barra': 'base',
  'derivado.comentarios.listas[].movimento': 'base', 'derivado.comentarios.listas[].inscritosOcultos': 'base',
  'derivado.comentarios.listas[].legenda[].rotulo': 'rotulo', 'derivado.comentarios.listas[].legenda[].texto': 'numero', 'derivado.comentarios.listas[].legenda[].zero': CTRL,
  // os itens saem pelo bloco "Comentários de destaque" do pacote (texto de terceiros, sem autor)
  'derivado.comentarios.itens[].texto': 'terceiros', 'derivado.comentarios.itens[].curtidas': 'numero', 'derivado.comentarios.itens[].respostas': 'numero',
  'derivado.comentarios.itens[].idade': 'rotulo', 'derivado.comentarios.itens[].sinalizadores[]': 'base',
  'derivado.comentarios.itens[].respostaDoCriador': CTRL, 'derivado.comentarios.itens[].respostaDoCriador.canal': 'terceiros', 'derivado.comentarios.itens[].respostaDoCriador.texto': 'terceiros',
}

// ───────────────────────── as tabelas e os avisos
const O = 'modelo.derivado.comentarios'
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string, zero: boolean): Celula => (zero ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const lista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

export function tabelasDeComentariosDoVideo(c: ComentariosVideoIa | null): { tabelas: Tabela[]; avisos: string[] } {
  if (c === null) return { tabelas: [], avisos: [] }
  if (c.estado === 'nao_carregou') return { tabelas: [], avisos: c.erro ? [c.erro] : [] }
  const sem = (): Celula => rotulo(c.sem, `${O}.sem`)
  const tabelas: Tabela[] = []
  if (c.abas.length) {
    tabelas.push({ id: 'video-comentarios-abas', titulo: 'Comentários de destaque: o estado de cada idade', tipo: 'fixa', nomeNoCorte: 'estado dos comentários por idade', privada: false, colunas: ['Idade', 'Estado'],
      linhas: c.abas.map((a, i) => [rotulo(a.rotulo, `${O}.abas[${i}].rotulo`), base(a.estado, `${O}.abas[${i}].estado`)]) })
  }
  if (c.estados.length) {
    tabelas.push(lista('video-comentarios-estados', 'Comentários de destaque: as idades sem lista', 'idades sem lista de comentários', ['Idade', 'Título', 'Corpo', 'Selo', 'Nota'],
      c.estados.map((e, i) => [rotulo(e.idade, `${O}.estados[${i}].idade`), base(e.titulo, `${O}.estados[${i}].titulo`),
        e.corpo !== null ? terceiros(e.corpo, `${O}.estados[${i}].corpo`) : sem(), e.selo !== null ? base(e.selo, `${O}.estados[${i}].selo`) : sem(), e.nota !== null ? base(e.nota, `${O}.estados[${i}].nota`) : sem()])))
  }
  if (c.listas.length) {
    tabelas.push(lista('video-comentarios-listas', 'Comentários de destaque: a frase, a barra e o movimento de cada idade', 'frases dos comentários por idade', ['Idade', 'Frase', 'Barra', 'Movimento', 'Inscritos ocultos'],
      c.listas.map((l, i) => [rotulo(l.idade, `${O}.listas[${i}].idade`), base(l.frase, `${O}.listas[${i}].frase`), base(l.barra, `${O}.listas[${i}].barra`), base(l.movimento, `${O}.listas[${i}].movimento`),
        l.inscritosOcultos !== null ? base(l.inscritosOcultos, `${O}.listas[${i}].inscritosOcultos`) : sem()])))
    tabelas.push(lista('video-comentarios-legenda', 'Comentários de destaque: quantos de cada motivo, por idade', 'motivos dos comentários por idade', ['Idade', 'Motivo', 'Quantos'],
      c.listas.flatMap((l, i) => l.legenda.map((g, k): Celula[] => [rotulo(l.idade, `${O}.listas[${i}].idade`), rotulo(g.rotulo, `${O}.listas[${i}].legenda[${k}].rotulo`), medido(g.texto, `${O}.listas[${i}].legenda[${k}].texto`, g.zero)]))))
  }
  const avisos = [
    ...(c.faixa ? [c.faixa] : []), c.fonte,
    ...(c.saidosDoYouTube > 0 ? [`${c.saidosDoYouTube === 1 ? '1 comentário saiu' : `${c.saidosDoYouTube} comentários saíram`} do YouTube e não entra${c.saidosDoYouTube === 1 ? '' : 'm'} no pacote: o autor apagou o texto lá.`] : []),
  ].filter((x) => x !== '')
  return { tabelas, avisos }
}

/** O campo `comentarios` do pacote: texto só no nível que o leitor liberou; sem o direito, só a contagem; sem leitura, "na". */
export function comentariosDoPacote(c: ComentariosVideoIa | null): { estado: 'na' } | { estado: 'nao_carregou' } | { estado: 'incluido'; itens: Comentario[] } | { estado: 'excluido'; quantos: number } {
  if (c === null) return { estado: 'na' }
  if (c.estado === 'nao_carregou') return { estado: 'nao_carregou' }
  return c.nivel === 'contagem' ? { estado: 'excluido', quantos: c.quantos } : { estado: 'incluido', itens: c.itens }
}
