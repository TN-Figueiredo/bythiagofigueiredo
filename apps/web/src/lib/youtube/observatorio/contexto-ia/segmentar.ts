// A5 · E17 degrau 1, Tarefa 3: do modelo do pacote (`PacoteModelo`) às partes 1 a 6 do texto, em segmentos que o corte (Tarefa 4) sabe tirar.
// Função pura: o instante entra por parâmetro (`ContextoDoPacote.geradoEm`), nada lê relógio, banco nem rede.
//
// Um segmento é um trecho de linhas do texto. A montagem junta os segmentos com '\n'; um segmento que termina em '\n' deixa uma linha em
// branco depois de si. O que o corte pode tirar leva `corte`; o resto leva `corte: null`. `linhaDoJson` é o que o bloco estruturado
// (parte 8) escreve para o segmento, e some do JSON junto com ele.
//
// Todo texto fixo vem de `frases.ts`; todo texto que veio de fora (título, descrição, comentário, nome) passa por `terceiros.ts`.
import { CONTEXTO_IA_RULES } from './regras'
import * as F from './frases'
import { TELAS_IA } from './telas'
import { citar, naCelula } from './terceiros'
import type { BlocoCitado, Celula, ContextoDoPacote, PacoteModelo, Tabela, TelaId } from './tipos'

export type ClasseDeCorte =
  | { classe: 'dia_a_dia'; tabela: string }
  | { classe: 'linha_de_lista'; tabela: string; posicao: number }
  | { classe: 'bloco_sem_linha'; ordem: number } // bloco citado sem linha de lista: o último a sair. Bloco COM linha usa 'linha_de_lista'

export interface Segmento {
  parte: 1 | 2 | 3 | 4 | 5 | 6
  texto: string
  corte: ClasseDeCorte | null
  linhaDoJson: { tabela: string; valores: Record<string, unknown> } | null
}

export interface PacoteSerializado {
  versao: 1
  tela: TelaId
  nomeDaTela: string
  arquivo: string
  geradoEm: string
  janela: string
  segmentos: Segmento[]
  tabelas: Array<{ id: string; titulo: string; nomeNoCorte: string; tipo: Tabela['tipo'] }>
  numeros: {
    medidos: number
    zerosMedidos: number
    naoMedidos: number
    /** Células medidas ou de zero medido em tabela privada; vai a `params.privado_medidos` do registro de acesso. */
    privadosMedidos: number
  }
  privado: PacoteModelo['privado']
  comentarios: { estado: 'na' } | { estado: 'incluido' | 'excluido'; quantos: number }
  primeiraLinhaDeAviso: string | null
  vazio: boolean
}

export type RespostaDePacote =
  | { ok: true; pacote: PacoteSerializado }
  | { ok: false; motivo: 'pedido_invalido' | 'sem_acesso' | 'nao_encontrado' | 'registro_falhou' | 'falhou' }

// ───────────────────────── instante em São Paulo
interface HoraLocal { dia: string; hora: string; arquivo: string; iso: string }

function emSaoPaulo(ms: number): HoraLocal {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms))
  const p = (tipo: string): string => partes.find((x) => x.type === tipo)?.value ?? '00'
  const [aaaa, mm, dd, hh, mi, ss] = [p('year'), p('month'), p('day'), p('hour'), p('minute'), p('second')]
  const comoUtc = Date.UTC(Number(aaaa), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss))
  const deslocamento = Math.round((comoUtc - Math.floor(ms / 1000) * 1000) / 60_000)
  const sinal = deslocamento < 0 ? '-' : '+'
  const abs = Math.abs(deslocamento)
  const zz = `${sinal}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return { dia: `${dd}/${mm}/${aaaa}`, hora: `${hh}:${mi}`, arquivo: `${aaaa}-${mm}-${dd}`, iso: `${aaaa}-${mm}-${dd}T${hh}:${mi}:${ss}${zz}` }
}

// ───────────────────────── células
const motivoDe = (motivo: string | null | undefined): string => {
  const m = naCelula(motivo)
  return m === '(sem texto)' ? F.A_TELA_NAO_INFORMA_O_MOTIVO : m
}

/** O texto que a célula tem na tabela do pacote. Nenhuma célula sai vazia, com traço nem com "undefined". */
function textoDaCelula(c: Celula): string {
  if (c.papel === 'numero') {
    if (c.estado === 'nao_medido') return F.naoMedido(motivoDe(c.motivo))
    const t = naCelula(c.texto)
    return c.estado === 'zero_medido' ? F.zeroMedido(t) : t
  }
  return naCelula(c.texto)
}

/** O que a célula escreve no bloco estruturado: o mesmo texto, estado e motivo da tabela. */
function valorDoJson(c: Celula): Record<string, unknown> {
  if (c.papel !== 'numero') return { texto: naCelula(c.texto) }
  if (c.estado === 'nao_medido') return { estado: 'nao_medido', motivo: motivoDe(c.motivo) }
  return typeof c.x === 'number' && Number.isFinite(c.x) ? { estado: c.estado, texto: naCelula(c.texto), x: c.x } : { estado: c.estado, texto: naCelula(c.texto) }
}

function chavesUnicas(colunas: readonly string[]): string[] {
  const vistas = new Map<string, number>()
  return colunas.map((c) => {
    const base = naCelula(c)
    const n = (vistas.get(base) ?? 0) + 1
    vistas.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

const linhaDaTabela = (celulas: readonly string[]): string => `| ${celulas.join(' | ')} |`

// ───────────────────────── contagens
interface Contagem { medidos: number; zerosMedidos: number; naoMedidos: number; privadosMedidos: number }

function contar(tabelas: readonly Tabela[]): Contagem {
  const n: Contagem = { medidos: 0, zerosMedidos: 0, naoMedidos: 0, privadosMedidos: 0 }
  for (const t of tabelas) {
    for (const linha of t.linhas) {
      for (const c of linha) {
        if (c.papel !== 'numero') continue
        if (c.estado === 'nao_medido') n.naoMedidos += 1
        else {
          if (c.estado === 'medido') n.medidos += 1
          else n.zerosMedidos += 1
          if (t.privada) n.privadosMedidos += 1
        }
      }
    }
  }
  return n
}

// ───────────────────────── validação do modelo (defeito do empacotador lança)
function validar(m: PacoteModelo): void {
  const ids = new Set<string>()
  const privadas = m.tabelas.filter((t) => t.privada)
  for (const t of m.tabelas) {
    if (ids.has(t.id)) throw new Error(`contexto-ia: duas tabelas com o id "${t.id}"`)
    ids.add(t.id)
    for (const [i, linha] of t.linhas.entries()) {
      if (linha.length !== t.colunas.length) throw new Error(`contexto-ia: a linha ${i + 1} da tabela "${t.id}" tem ${linha.length} células e a tabela tem ${t.colunas.length} colunas`)
    }
  }
  if (m.privado.estado === 'excluido' && privadas.length > 0) {
    throw new Error(`contexto-ia: privado excluído, mas o modelo tem tabela privada ("${privadas[0]?.id}"); é defeito do empacotador`)
  }
  if (m.privado.estado === 'na' && privadas.length > 0) {
    throw new Error(`contexto-ia: privado "na", mas o modelo tem tabela privada ("${privadas[0]?.id}"); é defeito do empacotador`)
  }
  if (m.privado.estado === 'incluido' && privadas.length === 0) {
    throw new Error('contexto-ia: privado incluído, mas o modelo não tem nenhuma tabela privada; é defeito do empacotador')
  }
  if (m.privado.estado !== 'incluido') {
    // Dado privado fora das tabelas (foco, bloco citado, definição, aviso): a bandeira existe para o defeito do empacotador não passar em silêncio.
    const onde = m.foco.some((f) => f.privado) ? 'foco'
      : m.citados.some((b) => b.privado) ? 'citados'
        : m.definicoes.some((d) => d.privado) ? 'definicoes'
          : (m.avisosPrivados?.length ?? 0) > 0 ? 'avisosPrivados' : null
    if (onde) throw new Error(`contexto-ia: privado "${m.privado.estado}", mas o modelo tem ${onde} com dado privado; é defeito do empacotador`)
  }
  for (const b of m.citados) {
    if (!b.linha) continue
    const t = m.tabelas.find((x) => x.id === b.linha?.tabela)
    if (!t) throw new Error(`contexto-ia: o bloco "${b.rotulo}" aponta para a tabela "${b.linha.tabela}", que não existe`)
    if (t.tipo !== 'lista') throw new Error(`contexto-ia: o bloco "${b.rotulo}" aponta para a tabela "${t.id}", que não é uma lista`)
    if (!Number.isInteger(b.linha.posicao) || b.linha.posicao < 1 || b.linha.posicao > t.linhas.length) {
      throw new Error(`contexto-ia: o bloco "${b.rotulo}" aponta para a posição ${b.linha.posicao} da tabela "${t.id}", que tem ${t.linhas.length} linhas`)
    }
  }
}

// ───────────────────────── as partes
const seg = (parte: Segmento['parte'], texto: string, corte: ClasseDeCorte | null = null, linhaDoJson: Segmento['linhaDoJson'] = null): Segmento => ({ parte, texto, corte, linhaDoJson })
const bloco = (linhas: readonly string[]): string => `${linhas.join('\n')}\n` // termina em linha em branco
/** Texto de terceiros em várias linhas: cada uma com a marca e nunca com três crases seguidas (o pacote não tem cerca de código de ninguém). */
const citarSemCerca = (texto: string): string[] => citar(texto).map((l) => l.replace(/`{3,}/g, (c) => "'".repeat(c.length)))

function blocoCitado(b: BlocoCitado, corte: ClasseDeCorte): Segmento {
  const texto = bloco([F.citado(`${naCelula(b.rotulo)}${b.privado ? F.MARCA_PRIVADO : ''}`), ...citarSemCerca(b.texto)])
  const valores: Record<string, unknown> = b.linha ? { bloco: naCelula(b.rotulo), posicao: b.linha.posicao, texto: b.texto } : { bloco: naCelula(b.rotulo), texto: b.texto }
  return seg(4, texto, corte, { tabela: b.linha?.tabela ?? 'citados', valores })
}

function segmentosDaTabela(t: Tabela, citados: readonly BlocoCitado[]): Segmento[] {
  const titulo = `### ${naCelula(t.titulo)}${t.privada ? F.MARCA_PRIVADO : ''}`
  const cabecalho = [titulo, linhaDaTabela(t.colunas.map((c) => naCelula(c))), linhaDaTabela(t.colunas.map(() => '---'))]
  const chaves = chavesUnicas(t.colunas)
  const linhaTexto = (linha: readonly Celula[]) => linhaDaTabela(linha.map(textoDaCelula))
  const linhaJson = (linha: readonly Celula[]): Record<string, unknown> => Object.fromEntries(linha.map((c, i) => [chaves[i] ?? String(i), valorDoJson(c)]))

  if (t.tipo === 'dia_a_dia') {
    return [seg(4, bloco([...cabecalho, ...t.linhas.map(linhaTexto)]), { classe: 'dia_a_dia', tabela: t.id }, { tabela: t.id, valores: { linhas: t.linhas.map(linhaJson) } })]
  }
  const saida: Segmento[] = [seg(4, cabecalho.join('\n'))]
  t.linhas.forEach((linha, i) => {
    const corte: ClasseDeCorte | null = t.tipo === 'lista' ? { classe: 'linha_de_lista', tabela: t.id, posicao: i + 1 } : null
    saida.push(seg(4, linhaTexto(linha), corte, { tabela: t.id, valores: linhaJson(linha) }))
  })
  saida.push(seg(4, '')) // a linha em branco que fecha a tabela; sem ela o bloco que vem depois seria lido como mais uma linha da tabela
  const meus = citados.filter((b) => b.linha?.tabela === t.id).sort((a, b) => (a.linha?.posicao ?? 0) - (b.linha?.posicao ?? 0))
  for (const b of meus) saida.push(blocoCitado(b, { classe: 'linha_de_lista', tabela: t.id, posicao: b.linha?.posicao ?? 0 }))
  return saida
}

function textoDoPrivadoExcluido(p: Extract<PacoteModelo['privado'], { estado: 'excluido' }>): string {
  const itens = naCelula(p.itens)
  if (p.motivo === 'sem_direito') return F.NAO_INCLUIDO_SEM_DIREITO(itens)
  if (p.motivo === 'nao_conferido') return F.NAO_INCLUIDO_NAO_CONFERIDO(itens)
  return F.NAO_INCLUIDO_LEITURA_FALHOU(itens)
}

function textoDosComentarios(c: PacoteModelo['comentarios']): string | null {
  if (c.estado === 'na') return null
  if (c.estado === 'excluido') return bloco([F.COMENTARIOS_TITULO_SEM_TEXTO, F.comentariosFora(c.quantos)])
  if (c.itens.length === 0) return bloco([F.COMENTARIOS_TITULO, F.COMENTARIOS_NENHUM])
  const linhas: string[] = [F.COMENTARIOS_TITULO]
  c.itens.forEach((x, i) => {
    const extras = [...x.sinalizadores.map((s) => naCelula(s)), ...(x.respostas === null ? [] : [F.comentarioRespostas(x.respostas)])]
    linhas.push(F.comentarioCabecalho(i + 1, x.curtidas, naCelula(x.idade), extras), ...citarSemCerca(x.texto))
    if (x.respostaDoCriador) linhas.push(F.respostaDoCriador(naCelula(x.respostaDoCriador.canal)), ...citarSemCerca(x.respostaDoCriador.texto))
    if (i < c.itens.length - 1) linhas.push('')
  })
  return bloco(linhas)
}

export function segmentar(m: PacoteModelo, c: ContextoDoPacote): PacoteSerializado {
  const tela = TELAS_IA[m.tela]
  if (!tela) throw new Error(`contexto-ia: tela desconhecida "${String(m.tela)}"`)
  validar(m)

  const n = contar(m.tabelas)
  const total = n.medidos + n.zerosMedidos + n.naoMedidos
  const hora = emSaoPaulo(c.geradoEm)

  // A primeira linha do pacote: tela vazia, ou "magra" (quase tudo não medido). "Medidos" aqui inclui o zero medido, que é resultado.
  let primeiraLinhaDeAviso: string | null = null
  if (m.vazio !== null) primeiraLinhaDeAviso = F.avisoVazio(motivoDe(m.vazio))
  else if (total >= 1 && n.naoMedidos / total >= CONTEXTO_IA_RULES.magroAPartirDe) {
    primeiraLinhaDeAviso = F.avisoMagro(n.medidos + n.zerosMedidos, total, m.motivoDoMagro ? naCelula(m.motivoDoMagro) : null)
  }

  const segmentos: Segmento[] = []

  // 1. cabeçalho
  segmentos.push(seg(1, bloco([
    ...(primeiraLinhaDeAviso ? [primeiraLinhaDeAviso, ''] : []),
    F.tituloDaTela(tela.nome),
    F.janelaEFormato(naCelula(m.janela)),
    ...(m.listasCompletas ? [F.LISTAS_COMPLETAS] : []),
    F.geradoEm(`${hora.dia} ${hora.hora}`),
    F.dadoMaisRecente(c.recente === null ? null : naCelula(c.recente)),
    F.versaoDoFormato(CONTEXTO_IA_RULES.versaoDoFormato),
  ])))

  // 2. como ler
  segmentos.push(seg(2, bloco([F.COMO_LER_TITULO, ...F.COMO_LER_LINHAS])))

  // 3. foco
  segmentos.push(seg(3, bloco([F.FOCO_TITULO, ...(m.foco.length ? m.foco.map((f) => `- ${naCelula(f.nome)} (${f.oQueE})${f.privado ? F.MARCA_PRIVADO : ''}: ${naCelula(f.detalhe)}`) : [F.FOCO_VAZIO])])))

  // 4. os números
  segmentos.push(seg(4, F.NUMEROS_TITULO))
  if (m.tabelas.length === 0) segmentos.push(seg(4, bloco([F.nenhumaTabela(m.vazio === null ? F.A_TELA_NAO_INFORMA_O_MOTIVO : motivoDe(m.vazio))])))
  for (const t of m.tabelas) segmentos.push(...segmentosDaTabela(t, m.citados))
  let ordem = 0
  for (const b of m.citados) if (!b.linha) segmentos.push(blocoCitado(b, { classe: 'bloco_sem_linha', ordem: (ordem += 1) }))
  if (m.privado.estado === 'excluido') segmentos.push(seg(4, bloco([textoDoPrivadoExcluido(m.privado)])))
  const comentarios = textoDosComentarios(m.comentarios)
  if (comentarios !== null) segmentos.push(seg(4, comentarios))

  // 5. definições
  const defs = m.definicoes.flatMap((d) => [`- ${naCelula(d.medida)}${d.privado ? F.MARCA_PRIVADO : ''}: ${naCelula(d.frase)}`, ...d.limiares.map((l) => `  - ${naCelula(l)}`)])
  segmentos.push(seg(5, bloco([F.DEFINICOES_TITULO, ...(defs.length ? defs : [F.DEFINICOES_VAZIO])])))

  // 6. avisos, e o que a tela não mede
  segmentos.push(seg(6, bloco([
    F.AVISOS_TITULO,
    ...(m.avisos.length || m.avisosPrivados?.length
      ? [...m.avisos.map((a) => `- ${naCelula(a)}`), ...(m.avisosPrivados ?? []).map((a) => `- ${naCelula(a)}${F.MARCA_PRIVADO}`)]
      : [F.AVISOS_VAZIO]),
    ...(m.naoMede.length ? ['', F.NAO_MEDE_TITULO, ...m.naoMede.map((x) => `- ${naCelula(x)}`)] : []),
  ])))

  return {
    versao: 1,
    tela: m.tela,
    nomeDaTela: tela.nome,
    arquivo: `pacote-${m.tela}-${hora.arquivo}.md`,
    geradoEm: hora.iso,
    janela: naCelula(m.janela),
    segmentos,
    tabelas: m.tabelas.map((t) => ({ id: t.id, titulo: naCelula(t.titulo), nomeNoCorte: t.nomeNoCorte, tipo: t.tipo })),
    numeros: { medidos: n.medidos, zerosMedidos: n.zerosMedidos, naoMedidos: n.naoMedidos, privadosMedidos: n.privadosMedidos },
    privado: m.privado,
    comentarios: m.comentarios.estado === 'na'
      ? { estado: 'na' }
      : m.comentarios.estado === 'incluido'
        ? { estado: 'incluido', quantos: m.comentarios.itens.length }
        : { estado: 'excluido', quantos: m.comentarios.quantos },
    primeiraLinhaDeAviso,
    vazio: m.vazio !== null,
  }
}
