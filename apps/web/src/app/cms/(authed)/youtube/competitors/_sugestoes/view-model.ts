// View-model puro da lista "Sugestões" (F3 T3): sem React, sem banco, sem relógio (a hora vem de fora). Texto de terceiro passa como string.
// Os textos vêm do mockup M3 (index.html: h4txt, alvos, resumo, head, MOT, vazios) e das fontes únicas (`frases.ts`, `REGRA_SINAIS`).
import { DEFINICAO_SINAIS_DO_NICHO } from '@/lib/youtube/agenda/definicoes'
import type { AmostraDoVideo } from '@/lib/youtube/observatorio/sinais/amostra'
import { textoDoRotulo, textoDoVazio } from '@/lib/youtube/observatorio/sinais/frases'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import type { Evidence } from '@/lib/youtube/observatorio/sinais/oportunidades'
import { REGRA_SINAIS } from '@/lib/youtube/observatorio/sinais/regra'
import { nomeDoLugar } from './lugar'
import type { MotivoDaTela } from './tipos'

export type FamiliaDoVazio = 'resolvido' | 'calmo' | 'espera' | 'problema' | 'nm'
export type FiltroDaLista = 'todas' | 'destino' | 'parecido'

export interface LinhaDaVista {
  id: string; kind: 'destino' | 'parecido'
  chip: { rotulo: 'Destino esquentou' | 'Concorrente bombou'; simbolo: 'alfinete' | 'chama' }
  titulo: string
  /** Nome do lugar do destino ('' no parecido); usado na frase-resumo depois de uma resposta. */
  lugar: string
  puxadoPor: { titulo: string; canal: string | null; miniatura: string | null } | null
  regua: { valor: number; acimaDe20: boolean; limiar: number; texto: string } | null
  seus: { texto: string; naoMedido: boolean }
  primario: { texto: string; href: string; cheio: boolean }
  venceEm: string | null
  info: { mults: string; medida: string; regra: string; surgiu: string; vence: string }
  motivos: Array<{ valor: MotivoDaTela; rotulo: string; grupo: 'motivo' | 'feito' }>
}
export interface VistaDaLista {
  n: number | null; calculado: string | null; velho: boolean; resumo: string
  faixa: null | { tipo: 'velho' | 'sino-saiu' | 'erro-com-lista'; titulo: string; texto: string }
  filtro: null | { atual: FiltroDaLista; contagens: { todas: number; destino: number; parecido: number } }
  linhas: LinhaDaVista[]
  /** Todas as linhas, sem recorte: `filtrarVista` parte sempre daqui. */
  completas: LinhaDaVista[]
  totalAlemDoLimite: number | null
  vazio: null | { familia: FamiliaDoVazio; titulo: string; texto: string; topo: string }
}

const DIA_MS = 86_400_000
const HREF_OUTLIERS = '/cms/youtube/competitors/outliers'
const HREF_VIDEOS = '/cms/youtube/videos'
const f1 = (n: number): string => n.toFixed(1).replace('.', ',')

function partesSP(d: Date): { dd: string; mm: string; hh: string; mi: string; dia: string } {
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)) p[x.type] = x.value
  return { dd: p.day!, mm: p.month!, hh: p.hour!, mi: p.minute!, dia: `${p.year}-${p.month}-${p.day}` }
}
const dataSP = (iso: string): string => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—'; const p = partesSP(d); return `${p.dd}/${p.mm}` }

/** "hoje, 07:02" ou "19/10, 07:02" (fuso de São Paulo); `null` sem data. */
function quando(iso: string | null, agora: Date): { hoje: boolean; hora: string; data: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = partesSP(d)
  return { hoje: p.dia === partesSP(agora).dia, hora: `${p.hh}:${p.mi}`, data: `${p.dd}/${p.mm}` }
}

type Outlier = Evidence['outliers'][number]
/** Maior `mult_vpd7`, desempate por `video_id`. `null` se a evidência não traz outlier. */
export function outlierMaisForte(e: Evidence): Outlier | null {
  const lista = Array.isArray(e?.outliers) ? e.outliers.filter((o) => Number.isFinite(o.mult_vpd7)) : []
  if (lista.length === 0) return null
  return [...lista].sort((a, b) => b.mult_vpd7 - a.mult_vpd7 || a.video_id.localeCompare(b.video_id))[0]!
}

function lugarDoParecido(it: ItemDeSinal, forte: Outlier | null, amostra: ReadonlyMap<string, AmostraDoVideo>): { nome: string; mesmo: boolean } | null {
  if (!forte || it.proprios_agora === null || it.proprios_agora.length === 0) return null
  const chave = amostra.get(forte.video_id)?.chaves?.find((c) => c.startsWith('pais:'))
  if (!chave) return null
  const deles = it.proprios_agora.map((id) => amostra.get(id)?.chaves ?? null)
  if (deles.some((c) => c?.includes(chave))) return { nome: nomeDoLugar(chave), mesmo: true }
  if (deles.every((c) => c !== null)) return { nome: nomeDoLugar(chave), mesmo: false }
  return null
}

const MOTIVOS: Record<'destino' | 'parecido', LinhaDaVista['motivos']> = {
  destino: [
    { valor: 'lugar_errado', rotulo: 'Lugar errado', grupo: 'motivo' },
    { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' },
    { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' },
  ],
  parecido: [
    { valor: 'nao_e_parecido', rotulo: 'Não é parecido', grupo: 'motivo' },
    { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' },
    { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' },
  ],
}

function lista3(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** "5 sugestões: 5 destinos (Vietnã, Japão e +3), 2 concorrentes." Cita no máximo 2 nomes. */
export function resumoDaLista(itens: ReadonlyArray<{ kind: 'destino' | 'parecido'; lugar: string }>): string {
  const n = itens.length
  const d = itens.filter((x) => x.kind === 'destino')
  const p = n - d.length
  const nm = d.map((x) => x.lugar)
  const ln = d.length === 0 ? '' : d.length === 1 ? ` (${nm[0]})` : d.length === 2 ? ` (${nm[0]} e ${nm[1]})` : ` (${nm[0]}, ${nm[1]} e +${d.length - 2})`
  const partes: string[] = []
  if (d.length) partes.push(`${d.length} ${d.length === 1 ? 'destino' : 'destinos'}${ln}`)
  if (p) partes.push(`${p} ${p === 1 ? 'concorrente' : 'concorrentes'}`)
  return `${n} ${n === 1 ? 'sugestão' : 'sugestões'}: ${partes.join(', ')}.`
}

function seusDe(it: ItemDeSinal, lugar: string, calc: string, semVideoNenhum: boolean): { texto: string; naoMedido: boolean } {
  const n = it.n_proprios
  const cal = calc === '' ? '' : ` (cálculo de ${calc})`
  if (it.proprios_agora === null || n === null) {
    return { naoMedido: true, texto: it.kind === 'parecido' ? 'Não temos como confirmar quantos vídeos seus são parecidos com este.' : `Não temos como confirmar quantos vídeos seus citam ${lugar}.` }
  }
  if (it.kind === 'parecido') return { naoMedido: false, texto: `Parecido com ${n} ${n === 1 ? 'vídeo seu' : 'vídeos seus'}${cal}.` }
  if (n === 0) return { naoMedido: false, texto: semVideoNenhum ? `Seu canal não tinha vídeo no cálculo de ${calc}.`.replace(' de .', '.') : `Nenhum vídeo seu cita ${lugar}${cal}.` }
  return { naoMedido: false, texto: `Seus vídeos sobre ${lugar}: ${n}${cal}.` }
}

function hrefPrimario(it: ItemDeSinal, forte: Outlier | null): string {
  switch (it.rotulo_acao) {
    case 'abrir-concorrente': return forte ? `/cms/youtube/competitors/video/${encodeURIComponent(forte.video_id)}` : HREF_OUTLIERS
    case 'abrir-seus':
    case 'playlist':
      return it.proprios_agora && it.proprios_agora.length > 0 ? `${HREF_VIDEOS}?ids=${it.proprios_agora.map(encodeURIComponent).join(',')}&total=${it.n_proprios ?? it.proprios_agora.length}` : HREF_VIDEOS
    case 'generico': return HREF_VIDEOS
  }
}

function montarLinha(it: ItemDeSinal, amostra: ReadonlyMap<string, AmostraDoVideo>, calc: string, semVideoNenhum: boolean, agora: Date): LinhaDaVista {
  const forte = outlierMaisForte(it.evidence)
  const lim = REGRA_SINAIS.multSozinho
  const lugar = it.kind === 'destino' ? nomeDoLugar(it.subject_key) : ''
  const nv = it.evidence.outliers_total
  let titulo: string
  if (it.kind === 'destino') {
    titulo = nv === 1 ? `Um vídeo sobre ${lugar} passou de ${lim}× o normal do canal` : `${nv} vídeos sobre ${lugar}, de ${it.evidence.canais} canais, passaram do normal nos últimos 14 dias`
  } else {
    const l = lugarDoParecido(it, forte, amostra)
    titulo = `Um vídeo de tema parecido com um seu passou do normal${l === null ? '' : l.mesmo ? `, no mesmo lugar (${l.nome})` : ` (lugar diferente: ${l.nome})`}`
  }
  const am = forte ? amostra.get(forte.video_id) : undefined
  const mults = [...(it.evidence.outliers ?? [])].filter((o) => Number.isFinite(o.mult_vpd7)).map((o) => o.mult_vpd7).sort((a, b) => b - a).map((m) => `${f1(m)}×`)
  const dias = Math.max(1, Math.ceil((new Date(it.expires_at).getTime() - agora.getTime()) / DIA_MS))
  const venceEm = Number.isFinite(dias) && dias <= 3 ? `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}` : null
  return {
    id: it.id, kind: it.kind,
    chip: it.kind === 'destino' ? { rotulo: 'Destino esquentou', simbolo: 'alfinete' } : { rotulo: 'Concorrente bombou', simbolo: 'chama' },
    titulo, lugar,
    puxadoPor: am ? { titulo: am.titulo, canal: am.canal, miniatura: am.miniatura } : null,
    regua: forte ? { valor: forte.mult_vpd7, acimaDe20: forte.mult_vpd7 > 20, limiar: lim, texto: `${f1(forte.mult_vpd7)}× o normal do canal${nv > 1 ? `, o mais alto de ${nv}` : ''}` } : null,
    seus: seusDe(it, lugar, calc, semVideoNenhum),
    primario: { texto: textoDoRotulo(it.rotulo_acao, it.n_proprios, lugar || undefined, it.kind), href: hrefPrimario(it, forte), cheio: false },
    venceEm,
    info: {
      mults: mults.length === 0 ? '—' : lista3(mults),
      medida: 'views por dia na 1ª semana ÷ mediana do canal no mesmo formato',
      regra: `vídeos de ${REGRA_SINAIS.minCanais} canais acima do normal, ou um só acima de ${lim}× (regra sinais-v${REGRA_SINAIS.versao}, provisória).`,
      surgiu: dataSP(it.first_seen_at), vence: dataSP(it.expires_at),
    },
    motivos: MOTIVOS[it.kind].map((m) => ({ ...m })),
  }
}

const TOPO_NUNCA = 'As sugestões ainda não foram calculadas.'
const TOPO_AGORA = 'Nenhuma sugestão agora.'
function vazioDe(l: ListaDeSinais, agora: Date): NonNullable<VistaDaLista['vazio']> {
  // Sem data de cálculo e sem motivo: nunca rodou (nunca 0 inventado).
  const m = l.motivoVazio ?? (l.computado_em === null ? 'nunca-calculado' : null)
  const texto = textoDoVazio(m ?? '', l.contagens, agora, l.calculoLigado)
  switch (m) {
    case 'tudo-respondido': return { familia: 'resolvido', topo: 'Nenhuma sugestão aberta.', titulo: 'As últimas sugestões já saíram da lista.', texto }
    case 'nunca-calculado': {
      const topo = TOPO_NUNCA
      if (!l.calculoLigado) return { familia: 'espera', topo, titulo: texto, texto: `Quando for ligado, o 1º cálculo roda depois das ${String(DEFINICAO_SINAIS_DO_NICHO.aPartirDaHoraSP ?? 0).padStart(2, '0')}:00 (Brasília).` }
      return { familia: 'espera', topo, titulo: 'Ainda não houve cálculo.', texto }
    }
    case 'sem-historico': {
      // O título não pode negar o número do texto: com canais acompanhados, o que falta é histórico, não canal.
      const t = l.contagens.canais_total
      if (typeof t !== 'number') return { familia: 'espera', topo: TOPO_AGORA, titulo: 'Ainda não há canais acompanhados.', texto }
      return { familia: 'espera', topo: TOPO_AGORA, titulo: t > 0 ? 'Ainda não há histórico suficiente.' : 'Ainda não há canais acompanhados.', texto: `${t} ${t === 1 ? 'canal' : 'canais'} em Competidores. As sugestões nascem dos vídeos deles.` }
    }
    case 'sync-atrasado': return { familia: 'problema', topo: TOPO_AGORA, titulo: 'A coleta dos canais está atrasada.', texto }
    case 'sem-lugar': return { familia: 'nm', topo: TOPO_AGORA, titulo: 'Os vídeos acima do normal não citam um lugar que a gente reconheça.', texto }
    case 'sem-terceiro-outlier': return { familia: 'calmo', topo: TOPO_AGORA, titulo: 'Nenhum vídeo dos canais acompanhados passou do normal.', texto }
    case 'abaixo-do-minimo': return { familia: 'calmo', topo: TOPO_AGORA, titulo: 'Os vídeos acima do normal ainda não bastam para virar sugestão.', texto }
    case 'sem-grupo': return { familia: 'calmo', topo: TOPO_AGORA, titulo: 'Nenhum vídeo acima do normal forma sugestão agora.', texto }
    default: return { familia: 'nm', topo: TOPO_AGORA, titulo: 'Não foi possível dizer por que a lista está vazia.', texto }
  }
}

function comCheio(linhas: LinhaDaVista[], filtro: FiltroDaLista): LinhaDaVista[] {
  let achou = false
  return linhas.map((l) => {
    const bate = filtro === 'todas' || l.kind === filtro
    const cheio = bate && !achou
    if (cheio) achou = true
    return { ...l, primario: { ...l.primario, cheio } }
  })
}
const contar = (linhas: LinhaDaVista[]): { todas: number; destino: number; parecido: number } =>
  ({ todas: linhas.length, destino: linhas.filter((l) => l.kind === 'destino').length, parecido: linhas.filter((l) => l.kind === 'parecido').length })

export function montarVistaDaLista(e: {
  lista: ListaDeSinais; amostra: ReadonlyMap<string, AmostraDoVideo>; agora: Date; filtro: FiltroDaLista; saiuDoAviso: boolean; limite: number
}): VistaDaLista {
  const { lista, amostra, agora, filtro, limite } = e
  const q = quando(lista.computado_em, agora)
  const calc = q === null ? '' : q.hoje ? `hoje, ${q.hora}` : `${q.data}, ${q.hora}`
  const semVideoNenhum = lista.contagens.proprios === 0
  const itens = lista.itens.slice(0, limite)
  const linhas = comCheio(itens.map((it) => montarLinha(it, amostra, calc, semVideoNenhum, agora)), filtro)
  const velho = lista.desatualizado
  const vazio = lista.n === 0 || itens.length === 0 ? vazioDe(lista, agora) : null
  const resumo = vazio ? vazio.topo
    : lista.n === itens.length ? resumoDaLista(itens.map((it) => ({ kind: it.kind, lugar: it.kind === 'destino' ? nomeDoLugar(it.subject_key) : '' })))
    : `${lista.n} sugestões abertas. Mostrando as ${itens.length} mais fortes.`
  // Uma faixa só: dado velho vence o aviso do sino (é o que muda a leitura da lista inteira).
  let faixa: VistaDaLista['faixa'] = null
  if (velho && q) faixa = { tipo: 'velho', titulo: `As sugestões não são recalculadas desde ${q.data}, ${q.hora}.`, texto: 'A lista abaixo é a do último cálculo.' }
  else if (e.saiuDoAviso) faixa = { tipo: 'sino-saiu', titulo: 'Algumas sugestões do aviso já saíram da lista.', texto: 'Foram dispensadas ou venceram depois do aviso.' }
  // Filtro só com todas as linhas carregadas (N ≤ limite, C11).
  const comFiltro = lista.n <= limite && (lista.n > 8 || filtro !== 'todas')
  return {
    n: lista.n,
    calculado: vazio && vazio.topo === TOPO_NUNCA ? 'Nunca calculado' : q === null ? null : q.hoje ? `Calculado hoje às ${q.hora}` : `Calculado em ${q.data}, ${q.hora}`,
    velho, resumo, faixa,
    filtro: comFiltro ? { atual: filtro, contagens: contar(linhas) } : null,
    linhas, completas: linhas, totalAlemDoLimite: lista.n > limite ? lista.n : null, vazio,
  }
}

/** Recorte puro. Parte SEMPRE de `completas`, então encadear filtros funciona. Recalcula `cheio` e mantém as contagens. */
export function filtrarVista(vista: VistaDaLista, filtro: FiltroDaLista): VistaDaLista {
  if (vista.filtro === null) return vista
  const todas = vista.completas
  const recorte = comCheio(todas.filter((l) => filtro === 'todas' || l.kind === filtro), filtro === 'todas' ? 'todas' : filtro)
  let vazio = vista.vazio
  if (todas.length > 0) {
    vazio = recorte.length === 0
      ? { familia: 'calmo', topo: vista.resumo, titulo: filtro === 'destino' ? 'Nenhum destino aberto agora.' : 'Nenhum concorrente aberto agora.', texto: '' }
      : null
  }
  return { ...vista, linhas: recorte, filtro: { atual: filtro, contagens: vista.filtro.contagens }, vazio }
}

/** Leitura que falhou: n nulo ("?"), sem linhas; a página e o bloco do A/B Lab nunca lançam por causa dela. */
export const VISTA_COM_ERRO: VistaDaLista = { n: null, calculado: null, velho: false, resumo: '', faixa: null, filtro: null, linhas: [], completas: [], totalAlemDoLimite: null, vazio: null }
