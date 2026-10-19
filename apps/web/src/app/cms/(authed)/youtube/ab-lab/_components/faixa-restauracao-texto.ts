import {
  camposPendentes, lerCampoDeRestauracao, MAX_TENTATIVAS, podeDispensar, simAindaVale,
  type CampoNome, type CampoRestauracao, type RestoreStatus,
} from '@/lib/youtube/ab-restore'
import { proximaVerificacao, vigiaAtrasado } from '@/lib/youtube/ab-vigia-horario'

export type Tom = 'busy' | 'warn' | 'err' | 'ok' | 'none'
export interface LinhaFaixa { campo: CampoNome; rotulo: 'Título' | 'Thumbnail'; tom: Tom; /** Forma do ícone quando difere da do tom (A3: círculo tracejado em âmbar). */ icone?: Tom; texto: string; hora?: string }
export interface FaixaCompleta {
  tom: Exclude<Tom, 'ok'>
  /** Forma do ícone da faixa, separada do tom (que dá a cor). */
  icone?: Tom
  lbl: string
  resumo: string
  linhas: LinhaFaixa[]
  linkStudio: string | null
  linkRotulo: string | null
  /** Frase de ajuda antes do link (só J1). */
  ajuda: string | null
  /** Sempre nulo desde a P4b (o aviso agora se dispensa); o campo fica para o componente. */
  fine: string | null
  papel: 'region' | 'status' | 'alert'
  /** Botões que a faixa oferece (P4b). */
  acoes: AcoesFaixa
}
export interface AcoesFaixa {
  tentar: boolean
  dispensar: CampoNome[]
  /** Por que não há botão quando o motivo é falta de permissão (mockup I); nulo nos demais casos. */
  motivoSemBotao: string | null
}
export interface FaixaOk { tom: 'ok'; okline: string }
export type Faixa = FaixaCompleta | FaixaOk

export interface CtxFaixa {
  agora: Date
  /** Rótulo curto da variante ("B"). */
  rotulo: (variantId: string) => string
  /** Rótulo da variante do último ciclo fechado ("C"): a que estava no ar quando o teste saiu. */
  noArAntes: string
  /** Hora em que a variante `noArAntes` entrou no ar (início do último ciclo fechado); nulo = desconhecida. */
  noArDesde: string | null
  /** Nulo = vídeo não achado: a faixa sai sem link do Studio. */
  youtubeId: string | null
  /** Última execução do vigia (`cron_health`); nulo = nunca rodou ou desconhecida (conta como atrasado). */
  vigiaUltimaExecucao: string | null
  /** Pode administrar o site (necessário para destino variante). */
  podeAdministrar: boolean
  /** Por que o vigia não vai tentar sozinho (F4/Y-4); nulo = vai. */
  bloqueio: 'outro_teste' | 'pausado_variante' | null
  /** Início do "sim" por campo (R-1): `inicioDoSim(linhas do histórico)`; ausente = o `em` do campo. */
  inicioDoSim: Partial<Record<CampoNome, string | null>>
}

const PESO: Record<Tom, number> = { err: 4, warn: 3, none: 2, busy: 1, ok: 0 }
const ROTULO: Record<CampoNome, 'Título' | 'Thumbnail'> = { title: 'Título', thumbnail: 'Thumbnail' }

export function horaSP(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 'horário desconhecido'
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t))
  const g = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`
}

interface Item {
  linha: LinhaFaixa
  /** Resumo (lbl + resumo) que este campo imporia à faixa. */
  lbl: string
  resumo: string
  papel: 'region' | 'status'
  linkRotulo: string | null
  ajuda: string | null
  /** Tom que este campo impõe à faixa quando difere do da linha (F: linha cinza, faixa âmbar). */
  tomFaixa?: Exclude<Tom, 'ok' | 'none'>
}

const ESCRITA = new Set(['videos.update', 'thumbnails.set'])
function erroDeEscrita(c: CampoRestauracao): boolean {
  const e = c.erro
  return typeof e === 'object' && e !== null && 'status' in e && e.chamada !== undefined && ESCRITA.has(e.chamada)
}

const STUDIO = 'Abrir no YouTube Studio'

function horaMinutoSP(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

/** Frase de nova tentativa do vigia (C, D, D2 e bloqueio). */
function fraseNovaTentativa(campo: CampoNome, c: CampoRestauracao, ctx: CtxFaixa): string {
  if (ctx.bloqueio === 'outro_teste') return 'Sem nova tentativa automática enquanto outro teste estiver em andamento neste vídeo.'
  if (ctx.bloqueio === 'pausado_variante') return 'Sem nova tentativa automática enquanto este teste estiver pausado.'
  const quando = vigiaAtrasado(ctx.vigiaUltimaExecucao, ctx.agora)
    ? 'na próxima verificação'
    : `por volta das ${horaMinutoSP(proximaVerificacao(ctx.agora))} (horário de São Paulo)`
  if (simAindaVale(c, ctx.agora, ctx.inicioDoSim[campo])) return `Nova tentativa automática ${quando}, sem perguntar de novo: ela repete a troca que você confirmou.`
  return `Nova tentativa automática ${quando}, tentativa ${c.attempts + 1} de ${MAX_TENTATIVAS}.`
}

function itemDoCampo(campo: CampoNome, c: CampoRestauracao, ctx: CtxFaixa): Item {
  const f = ROTULO[campo]
  const leitura = lerCampoDeRestauracao(c, ctx.agora)
  const eTitulo = campo === 'title'
  const o = eTitulo ? 'o' : 'a'
  const nome = eTitulo ? 'título' : 'thumbnail'
  const variante = c.destino === 'original' ? null : ctx.rotulo(c.destino)
  const base = { linkRotulo: null, ajuda: null, papel: 'region' as const }
  const mk = (tom: Tom, texto: string, hora: string | undefined, rest: Partial<Item> & Pick<Item, 'lbl' | 'resumo'>, icone?: Tom): Item =>
    ({ ...base, ...rest, linha: { campo, rotulo: f, tom, ...(icone ? { icone } : {}), texto, ...(hora ? { hora } : {}) } })

  if (leitura.tipo === 'em_andamento') {
    const h = horaSP(leitura.desde)
    return mk('busy', `Trocando desde ${h}.`, h, {
      lbl: variante ? `Trocando pela variante ${variante}…` : 'Voltando ao original…',
      resumo: '',
    })
  }

  const semResposta = (desde: string): Item => {
    const h = horaSP(desde)
    return mk('warn', `Sem resposta desde ${h}. Não sabemos se a troca foi feita. Confira ${o} ${nome} no YouTube Studio.`, h, {
      lbl: 'Atenção:',
      resumo: variante ? `Não sabemos se a variante ${variante} foi aplicada.` : 'Não sabemos se voltou ao original.',
      linkRotulo: STUDIO,
    }, 'none')
  }

  if (leitura.tipo === 'sem_resposta') {
    const sr = semResposta(leitura.desde)
    if (c.estado !== 'falhou') return sr
    return { ...sr, linha: { ...sr.linha, texto: `${sr.linha.texto} ${fraseNovaTentativa(campo, c, ctx)}` } }
  }

  const h = horaSP(c.em)
  switch (c.estado) {
    case 'ok':
      return mk('ok', variante ? `Variante ${variante} aplicada em ${h}.` : `Voltou ao original em ${h}.`, h, { lbl: '', resumo: '' })
    case 'falhou': {
      const nova = fraseNovaTentativa(campo, c, ctx)
      if (!erroDeEscrita(c)) return semResposta(c.em) // inalcançável: `lerCampoDeRestauracao` já devolve sem_resposta
      const cap = eTitulo ? 'O título' : 'A thumbnail'
      const linha = `O YouTube recusou em ${h}. ${nova}`
      if (!variante) {
        return mk('err', linha, h, {
          lbl: 'Erro:',
          resumo: `${o} ${nome} não voltou ao original. ${cap} no ar ainda é ${o} da variante ${ctx.noArAntes}.`,
          linkRotulo: STUDIO,
        })
      }
      return mk('err', linha, h, {
        lbl: 'Erro:',
        resumo: c.forcado
          ? `${o} ${nome} da variante ${variante} não foi aplicad${eTitulo ? 'o' : 'a'}. No ar continua ${o} ${nome} editad${eTitulo ? 'o' : 'a'} por fora.`
          : `${o} ${nome} da variante ${variante} não foi aplicad${eTitulo ? 'o' : 'a'}. No ar continua ${o} da variante ${ctx.noArAntes}.`,
        linkRotulo: STUDIO,
      })
    }
    case 'pulado_teste_youtube':
      // Só leitura (F10): quem escreve é a fase 2 da S6/S7. Texto neutro, sem botão.
      return mk('none', `Mantid${o} como está no YouTube desde ${h}.`, h, {
        lbl: 'Atenção:', resumo: `o teste do próprio YouTube cuida d${o} ${nome}. O Lab não alterou nada.`, papel: 'status',
      })
    case 'pulado_drift':
      if (c.motivo === 'sem_base_de_comparacao') {
        return mk('none', 'Não medida: sem imagem de referência para comparar.', undefined, {
          lbl: 'Atenção:', resumo: 'não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado.', papel: 'status', linkRotulo: STUDIO,
          tomFaixa: 'warn',
        })
      }
      return mk('warn', `Mantida como está no YouTube desde ${h}.`, h, {
        lbl: 'Atenção:', resumo: 'a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado.',
        papel: 'status', linkRotulo: STUDIO,
      })
    case 'pulado_sem_original': {
      // A hora é a de quando a variante entrou no ar, nunca a do campo; sem ela, a frase sai sem hora.
      const hNoAr = ctx.noArDesde ? horaSP(ctx.noArDesde) : undefined
      return mk('warn', hNoAr ? `Continua ${o} da variante ${ctx.noArAntes}, no ar desde ${hNoAr}.` : `Continua ${o} da variante ${ctx.noArAntes}.`, hNoAr, {
        lbl: 'Atenção:', resumo: 'o título original não foi guardado quando o teste começou. Nada foi alterado.',
        papel: 'status', linkRotulo: 'Abrir no YouTube Studio para conferir',
      })
    }
    case 'desistiu':
      if (c.motivo === 'video_inexistente') {
        return mk('none', `Não foi restaurado. Parou em ${h}.`, h, {
          lbl: 'Sem nova tentativa:',
          resumo: 'o Lab parou de restaurar este vídeo porque ele não foi encontrado no YouTube. Se você o apagou, não há nada a fazer.',
          ajuda: 'Se não foi você quem apagou, confira no YouTube Studio.', linkRotulo: STUDIO,
        })
      }
      if (c.motivo === 'tres_falhas') {
        const cap = eTitulo ? 'O título' : 'A thumbnail'
        return mk('err', `Última recusa do YouTube em ${h}. Não haverá nova tentativa automática.`, h, {
          lbl: 'Erro:', resumo: `a restauração falhou ${MAX_TENTATIVAS} vezes e parou. ${cap} no ar ainda é ${o} da variante ${ctx.noArAntes}.`,
          linkRotulo: STUDIO,
        })
      }
      if (c.motivo === 'antes_da_nova_tentativa') {
        return mk('warn', `Parou em ${h}. Não haverá nova tentativa automática.`, h, {
          lbl: 'Sem nova tentativa:', resumo: `a restauração d${o} ${nome} falhou e o Lab não vai tentar de novo. Confira no YouTube Studio.`,
          linkRotulo: STUDIO,
        })
      }
      if (c.motivo === 'destino_invalido') {
        return mk('warn', `Parou em ${h}. Não haverá nova tentativa automática.`, h, {
          lbl: 'Sem nova tentativa:', resumo: `o Lab não soube para qual versão devolver ${o} ${nome}. Confira no YouTube Studio e corrija se precisar.`,
          linkRotulo: STUDIO,
        })
      }
      if (c.motivo === 'novo_teste') {
        return mk('none', `Não foi restaurado antes de o novo teste começar. Parou em ${h}.`, h, {
          lbl: 'Sem nova tentativa:',
          resumo: 'o Lab parou de restaurar este vídeo porque outro teste começou nele. O que está no ar agora segue o novo teste.',
        })
      }
      return semResposta(c.em) // motivo desconhecido: não afirmamos nada além de "não sabemos"
    default:
      return semResposta(c.em)
  }
}

function frasesBusy(campos: CampoNome[]): string {
  if (campos.length > 1) return 'Título e thumbnail estão sendo trocados no YouTube.'
  return campos[0] === 'title' ? 'O título está sendo trocado no YouTube.' : 'A thumbnail está sendo trocada no YouTube.'
}

export function montarFaixa(rs: RestoreStatus | null, ctx: CtxFaixa): Faixa | null {
  if (rs === null) return null
  const campos = (['title', 'thumbnail'] as const).filter(k => rs[k] !== undefined)
  if (campos.length === 0) return null
  const itens = campos.map(k => ({ k, i: itemDoCampo(k, rs[k] as CampoRestauracao, ctx) }))

  if (itens.every(x => x.i.linha.tom === 'ok')) {
    const destinos = new Set(campos.map(k => (rs[k] as CampoRestauracao).destino))
    if (destinos.size > 1) return { tom: 'ok', okline: itens.map(x => `${x.i.linha.rotulo}: ${x.i.linha.texto}`).join(' ') }
    const k0 = campos.includes('title') ? 'title' : 'thumbnail'
    const primeiro = rs[k0] as CampoRestauracao
    const ultima = campos.map(k => (rs[k] as CampoRestauracao).em).sort().at(-1) as string
    const h = horaSP(ultima)
    const variante = primeiro.destino === 'original' ? null : ctx.rotulo(primeiro.destino)
    if (variante) return { tom: 'ok', okline: `Variante ${variante} no ar desde ${h}.` }
    if (campos.length > 1) return { tom: 'ok', okline: `Título e thumbnail voltaram ao original em ${h}.` }
    return { tom: 'ok', okline: `${k0 === 'title' ? 'O título voltou' : 'A thumbnail voltou'} ao original em ${h}.` }
  }

  const tomDe = (x: (typeof itens)[number]): Tom => x.i.tomFaixa ?? x.i.linha.tom
  const pior = itens.reduce((a, b) => (PESO[tomDe(b)] > PESO[tomDe(a)] ? b : a))
  const comLink = itens.find(x => x.i.linkRotulo !== null)
  const tom = tomDe(pior) as Exclude<Tom, 'ok'>
  // Com tomFaixa, o ícone da faixa mantém a forma da linha (F: círculo tracejado em âmbar).
  const icone = pior.i.linha.icone ?? (pior.i.tomFaixa ? pior.i.linha.tom : undefined)
  const resumo = tom === 'busy' ? frasesBusy(campos) : pior.i.resumo
  return {
    tom,
    ...(icone ? { icone } : {}),
    lbl: pior.i.lbl,
    resumo,
    linhas: itens.map(x => x.i.linha),
    linkStudio: comLink && ctx.youtubeId ? `https://studio.youtube.com/video/${ctx.youtubeId}/edit` : null,
    linkRotulo: comLink?.i.linkRotulo ?? null,
    ajuda: pior.i.ajuda,
    fine: null,
    papel: pior.i.papel,
    acoes: acoesDaFaixa(rs, ctx),
  }
}

const SEM_PERMISSAO = 'Só quem administra o site pode tentar de novo ou dispensar este aviso.'

function acoesDaFaixa(rs: RestoreStatus, ctx: CtxFaixa): AcoesFaixa {
  const pendentes = camposPendentes(rs, 'humano')
  const dispensar = (['title', 'thumbnail'] as const).filter(k => { const c = rs[k]; return c !== undefined && podeDispensar(c) })
  const comAcao = new Set<CampoNome>([...pendentes, ...dispensar])
  const exigeAdmin = [...comAcao].some(k => rs[k]?.destino !== 'original')
  // motivoSemBotao: texto do mockup I, mantido aqui literal
  if (exigeAdmin && !ctx.podeAdministrar) return { tentar: false, dispensar: [], motivoSemBotao: SEM_PERMISSAO }
  return { tentar: pendentes.length > 0, dispensar, motivoSemBotao: null }
}

/** A faixa enquanto "Tentar agora" corre (P4b-E1): os campos pendentes viram `em_andamento` agora. */
export function faixaTentando(rs: RestoreStatus, ctx: CtxFaixa): Faixa | null {
  const agora = ctx.agora.toISOString()
  const pendentes = camposPendentes(rs, 'humano')
  if (pendentes.length === 0) return montarFaixa(rs, ctx)
  const tentando: RestoreStatus = { ...rs }
  for (const k of pendentes) {
    const c = rs[k]
    if (c) tentando[k] = { ...c, estado: 'em_andamento', em: agora, escreveu: null, erro: null }
  }
  return montarFaixa(tentando, ctx)
}

/**
 * Retrato gravado que não passa pela validação (`restoreStatusIlegivel`): não afirmamos nada além de
 * "não sabemos" (texto de A3, F-D10 — o YouTube não recusou nada), com o link do Studio.
 */
export function faixaIlegivel(ctx: Pick<CtxFaixa, 'youtubeId'>): FaixaCompleta {
  return {
    tom: 'warn', icone: 'none', lbl: 'Atenção:',
    resumo: 'Não sabemos se o vídeo voltou ao original. O registro da restauração não pôde ser lido. Confira o título e a thumbnail no YouTube Studio.',
    linhas: [],
    linkStudio: ctx.youtubeId ? `https://studio.youtube.com/video/${ctx.youtubeId}/edit` : null,
    linkRotulo: ctx.youtubeId ? 'Abrir no YouTube Studio' : null,
    ajuda: null, fine: null, papel: 'status',
    acoes: { tentar: false, dispensar: [], motivoSemBotao: null },
  }
}
