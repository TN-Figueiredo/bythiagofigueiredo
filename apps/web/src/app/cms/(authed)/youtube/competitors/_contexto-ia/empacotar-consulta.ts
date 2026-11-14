/**
 * A4 R3, T6: o empacotador da ação `consultar`. Puro: nada de banco, de relógio nem de conta; cada número vem do campo do resultado
 * (linhas do conjunto, agregados do bloco) com o `x` igual ao texto. Cabeçalho e agregados são tabelas `fixa` (nunca cortadas);
 * as linhas, tabelas `lista` por formato. Título do vídeo e nome do canal são `terceiros`.
 */
import type { Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { AgregadoDoBloco } from '@/lib/youtube/observatorio/consulta/agregados'
import { METRICAS_DA_CONSULTA } from '@/lib/youtube/observatorio/consulta/catalogo'
import type { CelulaDaConsulta, LinhaDaConsulta, PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { spDmHm } from '@/lib/youtube/observatorio/time'

export const CHAVES_DA_CONSULTA = ['titulo', 'canal', 'video_id', 'publicado_em', 'idade_em_dias', 'formato', 'estado', 'medido_em', 'lugares',
  'views', 'likes', 'comentarios', 'vpd7', 'vpd_base', 'multiplicador', 'mult_n', 'mult_metodo', 'base_fraca', 'engajamento_por_mil', 'engajamento_base', 'inscritos', 'motivos'] as const

const COLUNAS = ['Título', 'Canal', 'Código do vídeo', 'Publicado em', 'Idade (dias de 24 h)', 'Formato', 'Estado', 'Medido em', 'Lugares',
  'Visualizações', 'Curtidas', 'Comentários', 'Visualizações por dia (7 dias)', 'Base das visualizações por dia', 'Multiplicador (×)', 'Vídeos na base do multiplicador', 'Método do multiplicador',
  'Base fraca', 'Engajamento (por mil visualizações)', 'Base do engajamento', 'Inscritos do canal', 'Motivos']

export interface ResultadoDaConsulta {
  pedido: PedidoDaConsulta
  /** `cortadasPorTamanho`: linhas que o limite de caracteres da resposta tirou do fim do bloco (depois do corte por `limite`). */
  blocos: Array<{ formato: 'longos' | 'shorts'; linhas: LinhaDaConsulta[]; agregado: AgregadoDoBloco; cortadasPorLimite: number; cortadasPorTamanho?: number }>
  /** `desligado`: a tarefa de lugares está desligada, mas há cálculo: o mapa serve e a frase diz isso (decisão Phil M-3, A4 R5). */
  lugar?: { estado: 'marcado' | 'sem_lugar' | 'sem_calculo'; calculadoEm: string | null; atrasado: boolean; emRecalculo: boolean; semLugarCalculado: number; maisDeUmLugar: number; maisDeUmLugarSobre: 'marcados' | 'linhas'; desligado?: boolean }
  /** ISO de cada fonte; nulo = "não lido" (nunca a hora do pedido). */
  dadosDe: { motor: string | null; medidas: string | null; lugares: string | null }
  canaisSemMedida: Array<{ nome: string; causa: string }>
  canaisNaoEncontrados: string[]
  /** `canal_ids` com id que não existe: quantos entre os pedidos (só quando há algum). */
  naoEncontrados?: { quantos: number; de: number }
  /** Canais do conjunto sem `sync.last` (nenhuma sincronização boa): a hora do motor não os inclui e nunca vira a do pedido. */
  canaisSemSync?: string[]
  /** Sem filtro de lugar: a frase do estado dos lugares quando a coluna `lugares` não pôde ser lida (nunca calculados, tarefa desligada, não carregaram). */
  lugaresNota?: string
  /** ISO da mais velha das leituras (motor, medidas, `lidoEm` do mapa de lugares); é o que o registro guarda em `dados_de`. Não aparece no texto. */
  leituraMaisAntiga?: string | null
}

// ───────────────────────── células
const num = (x: number): string => x.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const numero = (x: number, origem: string, sufixo = ''): Celula => ({ papel: 'numero', estado: x === 0 ? 'zero_medido' : 'medido', texto: num(x) + sufixo, x, origem })
const ausente = (c: CelulaDaConsulta | undefined, origem: string): Celula => {
  if (c?.estado === 'falhou') return { papel: 'numero', estado: 'falhou', motivo: c.causa ?? 'a leitura falhou', origem }
  return { papel: 'numero', estado: 'nao_medido', motivo: c?.causa ?? 'não pedido', origem }
}
const celulaNumerica = (c: CelulaDaConsulta | undefined, origem: string, sufixo = ''): Celula =>
  c && c.x !== null && (c.estado === 'medido' || c.estado === 'zero_medido') ? numero(c.x, origem, sufixo) : ausente(c, origem)

const BASE_VPD: Record<string, string> = { '7d': '7 dias', desde_publicacao: 'desde a publicação' }
const BASE_ENG: Record<string, string> = { idade_30: 'primeiros 30 dias', total_de_hoje: 'total de hoje' }

function linhaDaTabela(l: LinhaDaConsulta, p: string): Celula[] {
  const c = l.celulas
  const mult = c.multiplicador
  const multOk = mult && mult.x !== null
  return [
    terceiros(l.titulo, `${p}.titulo`), terceiros(l.canal, `${p}.canal`), base(l.ytId, `${p}.ytId`), base(l.publicadoEm, `${p}.publicadoEm`),
    numero(l.idadeDias, `${p}.idadeDias`), rotulo(l.formato === 'shorts' ? 'Short' : 'longo', `${p}.formato`),
    rotulo(l.estado === 'ativo' ? 'ativo' : l.estado === 'leitura_mensal' ? 'leitura mensal' : 'só no arquivo', `${p}.estado`),
    { ...base(dh(l.medidoEm), `${p}.medidoEm`), ...(l.medidoEm !== null && !Number.isNaN(Date.parse(l.medidoEm)) ? { maquina: l.medidoEm } : {}) }, base(l.lugares === null ? 'não lido' : l.lugares.length ? l.lugares.join(', ') : 'nenhum', `${p}.lugares`),
    celulaNumerica(c.views, `${p}.celulas.views`), celulaNumerica(c.likes, `${p}.celulas.likes`), celulaNumerica(c.comentarios, `${p}.celulas.comentarios`),
    celulaNumerica(c.vpd7, `${p}.celulas.vpd7`), rotulo(c.vpd7?.vpdBase ? BASE_VPD[c.vpd7.vpdBase]! : 'não medido', `${p}.celulas.vpd7.vpdBase`),
    celulaNumerica(mult, `${p}.celulas.multiplicador`, '×'),
    multOk && l.multN !== null ? numero(l.multN, `${p}.multN`) : { papel: 'numero', estado: 'nao_medido', motivo: 'sem multiplicador', origem: `${p}.multN` },
    rotulo(multOk && l.multMetodo ? l.multMetodo : 'não medido', `${p}.multMetodo`), rotulo(multOk ? (l.baseFraca ? 'sim' : 'não') : 'não medido', `${p}.baseFraca`),
    celulaNumerica(c.engajamento, `${p}.celulas.engajamento`), rotulo(c.engajamento?.base ? BASE_ENG[c.engajamento.base]! : 'não medido', `${p}.celulas.engajamento.base`),
    celulaNumerica(c.inscritos, `${p}.celulas.inscritos`), base(l.motivos.length ? l.motivos.join('; ') : 'nenhum', `${p}.motivos`),
  ]
}

// ───────────────────────── agregados
function tabelaDoAgregado(b: ResultadoDaConsulta['blocos'][number], i: number, pedido: PedidoDaConsulta): Tabela | null {
  const metricas = pedido.metricas
  const a = b.agregado
  const linhas: Celula[][] = []
  const raiz = `consulta.blocos[${i}].agregado`
  const estat = (rot: string, v: { mediana: number | null; q1: number | null; q3: number | null; n: number }, p: string, nota: string, suf = '', semQuartil = 'sem medida'): Celula[] => [
    rotulo(rot, `${p}.rotulo`),
    v.mediana === null ? { papel: 'numero', estado: 'nao_medido', motivo: 'sem medida', origem: `${p}.mediana` } : numero(v.mediana, `${p}.mediana`, suf),
    v.q1 === null ? { papel: 'numero', estado: 'nao_medido', motivo: semQuartil, origem: `${p}.q1` } : numero(v.q1, `${p}.q1`, suf),
    v.q3 === null ? { papel: 'numero', estado: 'nao_medido', motivo: semQuartil, origem: `${p}.q3` } : numero(v.q3, `${p}.q3`, suf),
    numero(v.n, `${p}.n`), base(nota, `${p}.nota`),
  ]
  for (const m of metricas) {
    const v = a.porMetrica[m]
    if (!v) continue
    const p = `${raiz}.porMetrica.${m}`
    const notas: string[] = []
    if (v.semOsCanais.length) notas.push('sem os canais ' + v.semOsCanais.join(', '))
    if (v.semOsVideos.length) notas.push('sem os vídeos ' + v.semOsVideos.join(', '))
    if (m === 'multiplicador') notas.push(a.baseFraca > 0 ? `${a.baseFraca} de base fraca ${pedido.incluirBaseFraca ? 'dentro' : 'fora'} deste agregado` : v.n === 0 ? 'sem medida' : 'sem vídeo de base fraca')
    if (m === 'vpd7') notas.push('só vídeos com 7 dias de série')
    if (m === 'engajamento' && a.engajamento) {
      const r = a.engajamento.resultado
      notas.push(r.estado === 'medido' ? `grupo único: ${a.engajamento.grupo === 'componente' ? 'só um componente (curtidas ou comentários)' : 'curtidas e comentários'}, ${r.notas.some((x) => x.tipo === 'total_de_hoje') ? 'total de hoje' : 'primeiros 30 dias'}` : `menos de ${RULES.weakBase} vídeos medidos no mesmo grupo (${r.motivo})`)
    }
    if (m === 'views' || m === 'likes' || m === 'comentarios') {
      if (v.porFaixa) {
        if (v.mediana !== null) linhas.push(estat(METRICAS_DA_CONSULTA[m].rotulo, v, p, notas.join('; ') || 'uma faixa de idade'))
        else for (const f of v.porFaixa) linhas.push(estat(`${METRICAS_DA_CONSULTA[m].rotulo}, ${f.faixa} dias`, { mediana: f.mediana, q1: null, q3: null, n: f.n }, `${p}.porFaixa.${f.faixa}`, 'mediana por faixa de idade; nunca misturada', '', f.mediana === null ? 'sem medida' : 'quartis não calculados por faixa'))
        if (!v.porFaixa.length) linhas.push(estat(METRICAS_DA_CONSULTA[m].rotulo, v, p, 'sem medida'))
      }
      continue
    }
    linhas.push(estat(METRICAS_DA_CONSULTA[m].rotulo, v, p, notas.join('; ') || 'todas as elegíveis', m === 'multiplicador' ? '×' : ''))
  }
  if (linhas.length === 0) return null
  const nome = b.formato === 'shorts' ? 'Shorts' : 'longos'
  return {
    id: `consulta-agregados-${b.formato}`, titulo: `Mediana e quartis de todas as elegíveis (${nome}); não é só das linhas devolvidas`, tipo: 'fixa', nomeNoCorte: `tabela de agregados dos ${nome}`, privada: false,
    colunas: ['Medida', 'Mediana', '1º quartil', '3º quartil', 'Vídeos medidos', 'Nota'], chaves: ['medida', 'mediana', 'q1', 'q3', 'n', 'nota'], linhas,
  }
}

// ───────────────────────── cabeçalho
/** O mais recente entre motor, medidas e o `Medido em` de cada linha, na hora de São Paulo; nulo se nenhum foi lido.
 *  As linhas entram porque a medida de um vídeo pode ser mais nova que o `Dados de` (prova em prod de 11/11: 06:01 x 00:22). */
export const maisRecenteDosDados = (r: Pick<ResultadoDaConsulta, 'dadosDe' | 'blocos'>): string | null => {
  const d = r.dadosDe
  const isos = [d.motor, d.medidas, ...r.blocos.flatMap((b) => b.linhas.map((l) => l.medidoEm))]
  const ms = isos.flatMap((x) => (x === null ? [] : [Date.parse(x)])).filter((n) => !Number.isNaN(n))
  return ms.length ? spDmHm(Math.max(...ms)) : null
}
const dh = (iso: string | null): string => {
  if (iso === null) return 'não lido'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return 'não lido'
  return spDmHm(ms)
}
// Nota de código (não vai para a resposta): se niche_signals_gravar falhar depois de gravarLugares, o aviso de lugares desatualizados sai mesmo com os lugares em dia (é conservador).

const dm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** O recorte de publicação em frase (C1 R1): o que de fato foi aplicado, para a IA e o dono lerem sem conta de data. */
export function recorteDePublicacao(p: PedidoDaConsulta): string {
  if (p.publicadoDe || p.publicadoAte) {
    const quando = p.publicadoDe && p.publicadoAte ? `de ${dm(p.publicadoDe)} a ${dm(p.publicadoAte)}` : p.publicadoDe ? `a partir de ${dm(p.publicadoDe)}` : `até ${dm(p.publicadoAte!)}`
    return `Publicados ${quando} (${p.ultimosDias !== undefined ? `últimos ${p.ultimosDias} ${p.ultimosDias === 1 ? 'dia' : 'dias'}, ` : ''}horário de Brasília)`
  }
  if (p.janelaIdade === 'todas') return 'Publicados em qualquer data (janela_idade todas)'
  if (p.janelaIdade.length === 1 && p.janelaIdade[0] === '0-30') return 'Publicados nos últimos 30 dias (faixa 0-30)'
  return `Publicados com idade nas faixas ${p.janelaIdade.join(', ')} (idade do vídeo em dias)`
}

function cabecalho(r: ResultadoDaConsulta): Tabela {
  const p = r.pedido
  const L: Array<[string, string, ('terceiros' | 'base')?]> = []
  L.push(['Recorte de publicação', recorteDePublicacao(p)])
  const janela = p.janelaIdade === 'todas' ? 'todas' : p.janelaIdade.join(', ')
  const pedido = [`formato ${p.formato}`, `janela_idade ${janela}`, ...(p.canalIds?.length ? [`canais ${p.canalIds.length}`] : []), ...(p.nicho ? [`nicho ${p.nicho}`] : []), ...(p.lugar ? [`lugar ${p.lugar}`] : []),
    ...(p.ultimosDias !== undefined ? [`publicado_nos_ultimos_dias ${p.ultimosDias}`] : []), ...(p.publicadoDe ? [`publicado de ${p.publicadoDe}`] : []), ...(p.publicadoAte ? [`publicado até ${p.publicadoAte}`] : []), `métricas ${p.metricas.join(', ')}`, `limite ${p.limite}`, `incluir_base_fraca ${p.incluirBaseFraca ? 'sim' : 'não'}`]
  L.push(['Pedido', pedido.join('; ')])
  L.push(['Ordenado por', `${p.ordenarPor === 'vpd7' ? 'crescimento de views: views por dia nos últimos 7 dias (vpd7)' : `${METRICAS_DA_CONSULTA[p.ordenarPor].rotulo}${METRICAS_DA_CONSULTA[p.ordenarPor].rotulo === p.ordenarPor ? '' : ` (${p.ordenarPor})`}`}, ${p.direcao === 'desc' ? 'do maior para o menor' : 'do menor para o maior'}`])
  L.push(['Janela usada', `${janela}; idade = dias de 24 h desde a publicação`])
  const eleg = r.blocos.reduce((s, b) => s + b.agregado.elegiveis, 0), sel = r.blocos.reduce((s, b) => s + b.linhas.length, 0), cort = r.blocos.reduce((s, b) => s + b.cortadasPorLimite, 0)
  const tam = r.blocos.reduce((s, b) => s + (b.cortadasPorTamanho ?? 0), 0)
  L.push(['Elegíveis', `${eleg}; selecionados pelo limite: ${sel + tam}; cortados por limite: ${cort}${tam > 0 ? `; cortados por tamanho: ${tam}` : ''}`])
  L.push(['Linhas por bloco', r.blocos.map((b) => `${b.formato === 'shorts' ? 'Shorts' : 'longos'}: ${b.linhas.length} de ${b.agregado.elegiveis}`).join('; ')])

  const todas = r.blocos.flatMap((b) => b.linhas)
  const naoMedidos = p.metricas.map((m) => [m, todas.filter((l) => l.celulas[m]?.estado === 'nao_medido').length] as const).filter(([, n]) => n > 0)
  const falhou = todas.reduce((s, l) => s + Object.values(l.celulas).filter((c) => c?.estado === 'falhou').length, 0)
  if (naoMedidos.length || falhou) L.push([`Não medidos (nas ${sel} linhas devolvidas)`, `${naoMedidos.map(([m, n]) => `${m} ${n}`).join(', ') || 'nenhum'}; falhou: ${falhou}`])
  const agendados = r.blocos.reduce((s, b) => s + (b.agregado.engajamento?.agendadosFora ?? 0), 0)
  if (agendados > 0) L.push(['Agendados fora do engajamento', `${agendados} entre as elegíveis`])

  if (r.lugar) {
    const g = r.lugar
    const f: string[] = []
    if (g.estado === 'sem_calculo') f.push('lugares nunca calculados para este site')
    else {
      f.push(g.estado === 'marcado' ? `marcado com ${p.lugar ?? ''} (título, tags, início da descrição ou local de gravação)` : 'calculado, sem lugar')
      f.push(g.desligado ? `tarefa de lugares desligada; lugares calculados em ${dh(g.calculadoEm)}` : `lugares calculados em ${dh(g.calculadoEm)}`)
      if (g.atrasado) f.push('atrasado (mais de 36 h desde o último cálculo)')
      if (g.emRecalculo) f.push('lugares em recálculo agora')
      if (g.semLugarCalculado > 0) f.push(`${g.semLugarCalculado} ${g.semLugarCalculado === 1 ? 'vídeo do conjunto chegou' : 'vídeos do conjunto chegaram'} depois do cálculo de lugares e ${g.semLugarCalculado === 1 ? 'não entra' : 'não entram'} neste filtro`)
    }
    L.push(['Lugar', f.join('; ')])
    L.push(['Vídeos com mais de um lugar', `${g.maisDeUmLugar} (sobre ${g.maisDeUmLugarSobre === 'marcados' ? 'os marcados' : 'as linhas devolvidas'})`])
  }
  if (p.metricas.includes('multiplicador')) {
    const fraca = r.blocos.reduce((s, b) => s + b.agregado.baseFraca, 0)
    L.push(['Base fraca', `${fraca} entre as elegíveis (${p.incluirBaseFraca ? 'dentro' : 'fora'} do agregado do multiplicador)`])
  }
  const nulos = todas.filter((l) => !l.formatoConfirmado).length
  if (nulos > 0) L.push([`Formato não confirmado (nas ${sel} linhas devolvidas)`, `${nulos} (o multiplicador os conta como longos; a M7 os deixa de fora)`])
  const atr = r.blocos.map((b) => b.agregado.sincAtrasado)
  if (r.blocos.length === 1) L.push(['Canais com sync atrasado', String(atr[0]!)])
  else if (r.blocos.length > 1) L.push(['Canais com sync atrasado', r.blocos.map((b) => `${b.agregado.sincAtrasado} entre os ${b.formato === 'shorts' ? 'Shorts' : 'longos'}`).join(', ')])
  const semNenhum = r.blocos.every((b) => b.agregado.elegiveis === 0)
  L.push(['Dados de', semNenhum ? `nenhum vídeo no recorte (a lista está vazia; vazio não é zero), lugares ${dh(r.dadosDe.lugares)}` : `motor ${dh(r.dadosDe.motor)}, medidas ${dh(r.dadosDe.medidas)}, lugares ${dh(r.dadosDe.lugares)}`])
  if (r.canaisSemMedida.length) L.push(['Sem os canais', r.canaisSemMedida.map((c) => `${c.nome} (${c.causa})`).join(', '), 'terceiros'])
  if (r.canaisSemSync?.length) L.push(['Sem sincronização boa', r.canaisSemSync.join(', '), 'terceiros'])
  if (r.canaisNaoEncontrados.length) L.push(['Canais não encontrados', r.canaisNaoEncontrados.join(', ')])
  if (r.lugaresNota) L.push(['Lugares', r.lugaresNota])
  return {
    id: 'consulta-cabecalho', titulo: 'Como esta consulta foi lida', tipo: 'fixa', nomeNoCorte: 'tabela do cabeçalho da consulta', privada: false,
    colunas: ['Item', 'Valor'], chaves: ['item', 'valor'], linhas: L.map(([k, v, papel], i) => [rotulo(k, `consulta.cabecalho[${i}].item`), (papel === 'terceiros' ? terceiros : base)(v, `consulta.cabecalho[${i}].valor`)]),
  }
}

// ───────────────────────── o pacote
export function empacotarConsulta(r: ResultadoDaConsulta): PacoteModelo {
  const tabelas: Tabela[] = [cabecalho(r)]
  r.blocos.forEach((b, i) => {
    const ag = tabelaDoAgregado(b, i, r.pedido)
    if (ag) tabelas.push(ag)
  })
  r.blocos.forEach((b, i) => {
    if (b.linhas.length === 0) return
    const nome = b.formato === 'shorts' ? 'Shorts' : 'longos'
    tabelas.push({
      id: `consulta-${b.formato}`, titulo: `Vídeos ${b.formato === 'shorts' ? 'Shorts' : 'longos'} da consulta`, tipo: 'lista', nomeNoCorte: `tabela de vídeos ${nome} da consulta`, privada: false,
      colunas: COLUNAS, chaves: [...CHAVES_DA_CONSULTA], linhas: b.linhas.map((l, j) => linhaDaTabela(l, `consulta.blocos[${i}].linhas[${j}]`)),
    })
  })
  const vazio = r.blocos.every((b) => b.linhas.length === 0)
  return {
    tela: 'consultar',
    janela: 'Consulta ao Observatório (pedido na ação, sem tela)',
    foco: [],
    tabelas,
    citados: [],
    definicoes: [
      { medida: 'Multiplicador', frase: 'Quantas vezes o vídeo passa do normal do próprio canal no mesmo dia de vida (ou por aproximação de faixa); só vídeos acompanhados.', limiares: [] },
      { medida: 'Engajamento', frase: 'Curtidas e comentários por mil visualizações, pelo mesmo cálculo da tela do canal; nunca mistura os primeiros 30 dias com o total de hoje.', limiares: [] },
    ],
    avisos: [],
    naoMede: ['Não mede quem comenta nem o conteúdo dos comentários; não lê dado privado de canal.'],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: vazio ? (r.lugar?.estado === 'marcado' && r.pedido.lugar ? `Nenhum vídeo marcado com ${r.pedido.lugar} neste pedido.` : 'Nenhum vídeo no conjunto pedido.') : null,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}
