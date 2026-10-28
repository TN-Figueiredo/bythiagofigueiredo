// apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts
/** Frases da peça 3 (tirar um mês). Puro: sem 'server-only', importado pelo componente cliente. Literais do mockup aprovado (arquivo.js). */
import type { CausaDaFalha, CodigoDaSaida, EstadoDoMes, Falta, RespostaSaida } from './saida'

/** O que a ação do servidor devolve à tela (acoes.ts). `causa` e `restantes` só vêm em ok:false; a tela monta a frase pela causa, o `error` é o reserva (guarda negada, por exemplo). */
export type RetornoDaAcao = { ok: boolean; error?: string; causa?: CausaDaFalha; restantes?: number; resposta?: RespostaSaida }
export type Operacao = 'tirar' | 'liberar' | 'trazer'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function nomeDoMes(mes: string): string { return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` }
const maiuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
/** 'AAAA-MM-DD' ou instante ISO → dd/mm/aaaa no dia de São Paulo. Data ausente ou torta devolve `null` (nunca lança, nunca string vazia): quem escreve a frase a escreve sem a data (Yannis I-3). */
export function ddmmaaaa(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string') return null
  let dia: string
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) dia = iso
  else { const t = Date.parse(iso); if (Number.isNaN(t)) return null; dia = new Date(t - 3 * 3_600_000).toISOString().slice(0, 10) }
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`
}
/** " em dd/mm/aaaa", ou nada quando a data não veio. */
const emData = (iso: string | null | undefined): string => { const d = ddmmaaaa(iso); return d === null ? '' : ` em ${d}` }
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const milhar = (x: number): string => x.toLocaleString('pt-BR')
const AVISE = 'avise quem cuida do site'
const comCodigo = (frase: string, codigo: string): string => `${frase} (código: ${codigo})`
const VERBO: Record<Operacao, string> = { tirar: 'tirar o mês', liberar: 'liberar o espaço', trazer: 'trazer o mês de volta' }
/** A leitura do estado do mês falhou (não é falha de escrita). Não afirma "nada foi tirado": o mês pode já ter saído antes. */
export const FRASE_NAO_LEU_O_MES = 'Não foi possível ler o estado deste mês. Recarregue a página; esta leitura não mudou nada.'
/** registro_diverge: o mesmo literal na falta (exit_check) e na recusa do servidor. */
export const FRASE_REGISTRO_DIVERGE = `Os registros do banco não batem com a cópia. Nada foi alterado; ${AVISE}.`
const FEITO: Record<Operacao, string> = { tirar: 'tirado', liberar: 'liberado', trazer: 'trazido' }
const INCERTA: Record<Operacao, string> = { tirar: 'se o mês saiu', liberar: 'se o espaço foi liberado', trazer: 'se o mês voltou ao banco online' }
/** Nulo é "não medido", nunca 0 (o reattach nem manda linhas). */
export const NAO_MEDIDO_TEXTO = 'não medido'

/** Código fora da lista fechada: nunca passa cru. O texto de `tirar` é o mesmo que o saida.ts exporta (o teste confere os dois). */
export const fraseCodigoDesconhecido = (op: Operacao): string => `O banco recusou por um motivo que esta tela não conhece; nada foi ${FEITO[op]}.`
export const FRASE_CODIGO_DESCONHECIDO = fraseCodigoDesconhecido('tirar')

/** Frase de cada causa de falha, por ação (a mesma que o servidor devolvia só em `error`). */
export function fraseDaFalha(causa: CausaDaFalha, op: Operacao, restantes?: number): string {
  const feito = FEITO[op]
  switch (causa) {
    case 'somente_leitura': return 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.'
    case 'prazo': return `Não foi possível confirmar ${INCERTA[op]}. Recarregue a página antes de tentar de novo.`
    case 'tempo_no_banco': return `O banco não terminou a tempo. Nada foi ${feito}; tente de novo em alguns minutos.`
    case 'conferencia_parcial': {
      const falta = typeof restantes === 'number' && restantes > 0 ? `${restantes === 1 ? 'falta 1 canal' : `faltam ${restantes} canais`}; ` : ''
      return `A conferência dos canais passou do tempo desta página. Nada foi ${feito}; ${falta}clique de novo para continuar de onde parou.`
    }
    case 'sem_tempo': return `Faltou tempo nesta página para chamar o banco. Nada foi ${feito}; clique de novo.`
    default: return `Não foi possível ${VERBO[op]} agora. Nada foi ${feito}; tente de novo em alguns minutos. Se repetir, ${AVISE}. (código: ${causa})`   // banco, forma: falha de ESCRITA, nunca "ler" (Logan U3)
  }
}

export const TEXTO_SAIDA_FORA_DE_ORDEM = (mes: string, antes: string): string =>
  `Antes de ${nomeDoMes(mes)}, ${nomeDoMes(antes)} ainda está no banco online. Tire os meses do mais antigo para o mais novo.`   // proposta; Logan revisa (Passo 6)

export function fraseDaFalta(f: Falta, ctx: { mes: string; janelaMeses: number }): string {
  switch (f.codigo) {
    case 'ainda_na_janela': { const d = ddmmaaaa(typeof f.pode_sair_em === 'string' ? f.pode_sair_em : null); return d === null ? `Ainda dentro dos ${ctx.janelaMeses} meses; a data em que pode sair não foi medida.` : `Ainda dentro dos ${ctx.janelaMeses} meses: pode sair em ${d}.` }
    case 'nas_sem_atestacao': return n(f.horas) === null
      ? 'A cópia na casa ainda não foi verificada. Nada se perde: o mês só sai quando a casa confirmar.'
      : `Cópia sem verificação há ${n(f.horas)} horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.`
    case 'b2_sem_atestacao':
      if (f.motivo === 'retirada') return `A última conferência do B2 falhou${emData(typeof f.em === 'string' ? f.em : null)}: nada foi tirado. A forja confere de novo amanhã; se quiser adiantar, rode a conferência no seu Mac.`
      if (n(f.dias_forja) !== null) return `A forja não confere o B2 há ${n(f.dias_forja)} dias.`
      return n(f.dias_dono) !== null ? `Falta conferir o B2 (última conferência há ${n(f.dias_dono)} dias).` : 'Falta conferir o B2.'
    case 'classe_nao_liberada': return 'Este tipo de dado ainda não pode sair do banco online.'
    case 'nao_selado': return 'A cópia deste mês ainda não terminou.'
    case 'canal_sem_unidade': return 'Há canal com registros deste mês ainda sem cópia. O mês só sai depois da próxima cópia.'
    case 'conteudo_mudou': return 'O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.'
    case 'restauracao_vencida': return 'O ensaio de restauração deste tipo de dado tem mais de 180 dias. Rode o ensaio antes de tirar.'
    case 'esquema_mudou': return 'A tabela mudou desde o último ensaio de restauração. Rode o ensaio antes de tirar.'
    case 'dia_nao_somado': return 'Ainda há dia de leitura de hora em hora sem a soma do dia. O mês sai depois da soma.'
    case 'marca_pendente': return 'Ainda há vídeo deste mês sem a marca de 30 dias. O mês sai depois dela.'
    case 'marcas_ausentes': return `Falta uma parte do banco que guarda as marcas de 30 dias; ${AVISE}.`
    case 'expurgo_pendente': return 'Há vídeo apagado deste mês esperando sair do arquivo. O mês sai depois disso.'
    case 'sem_direito': return 'Só quem administra o site tira um mês do banco.'
    case 'interruptor_desligado': return 'O automático está desligado.'
    case 'outro_site_na_particao': return 'Outro site tem registros neste mês que ainda não estão copiados.'
    case 'esquema_divergente': return 'A tabela deste mês mudou de forma desde a cópia. O mês será copiado de novo antes de sair.'
    case 'fora_do_mes': return 'Há registros fora deste mês na cópia. Nada foi tirado.'
    case 'registro_diverge': return comCodigo(FRASE_REGISTRO_DIVERGE, 'registro_diverge')
    case 'saida_fora_de_ordem': return TEXTO_SAIDA_FORA_DE_ORDEM(ctx.mes, String(f.antes))
    default: return comCodigo(`O banco recusou tirar este mês por um motivo que esta tela não conhece; ${AVISE}.`, String(f.codigo))
  }
}

export function fraseDaSimulacao(r: Extract<RespostaSaida, { tipo: 'simulado' }>, mes: string): string {
  const conta = r.canalSemUnidade ? 'Contado agora: há registro sem cópia; nada sairia.' : 'Contado agora: tudo bate.'
  const registros = r.linhas === null ? `registros: ${NAO_MEDIDO_TEXTO}` : `${milhar(r.linhas)} registros`
  return `Se você tirasse ${nomeDoMes(mes)} agora: ${r.canais} canais, ${registros}, ${Math.round(r.fracao * 100)}% do que este tipo de dado ocupa. ${conta}`
}

type Tom = 'ok' | 'aviso' | 'erro'
const TEXTO_PARTICAO_AUSENTE = 'A tabela deste mês não existe mais no banco online. Nada foi alterado; recarregue a página para ver o estado.'
export { TEXTO_PARTICAO_AUSENTE }
type Ctx = { mes: string; doisPassos: boolean; hoje?: string; liberarAPartir?: string; pctDoBanco?: number | null }
type Frase = { tom: Tom; texto: string }
/** Uma frase própria por código da lista fechada (Record: código novo sem frase não compila; o teste cruza a lista do saida.ts com isto). */
const FRASE_DO_CODIGO: Record<CodigoDaSaida, (op: Operacao, r: Extract<RespostaSaida, { tipo: 'recusado' }>, ctx: Ctx) => Frase> = {
  ocupado: () => ({ tom: 'aviso', texto: 'Ocupado: a coleta está gravando. Tente em alguns minutos.' }),
  conteudo_mudou: () => ({ tom: 'aviso', texto: 'O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.' }),
  gatilho_ausente: () => ({ tom: 'erro', texto: `A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; ${AVISE}.` }),
  ja_destacado: () => ({ tom: 'aviso', texto: 'Este mês já saiu das telas.' }),
  esquema_divergente: () => ({ tom: 'aviso', texto: 'A tabela deste mês mudou de forma desde a cópia: nada foi tirado; o mês será copiado de novo.' }),
  fora_do_mes: () => ({ tom: 'erro', texto: `Não foi possível trazer de volta: há registros fora deste mês. Nada foi alterado; o mês continua fora das telas. ${maiuscula(AVISE)}.` }),
  ja_descartado: (_op, r) => ({ tom: 'aviso', texto: `O espaço deste mês já foi liberado${emData(r.descartadoEm)}.` }),
  orfa_inesperada: () => ({ tom: 'erro', texto: `Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. ${maiuscula(AVISE)}.` }),
  cedo_demais: (_op, r) => ({ tom: 'aviso', texto: ddmmaaaa(r.liberarAPartir) === null ? 'O espaço ainda não pode ser liberado (a data não foi medida).' : `O espaço só pode ser liberado a partir de ${ddmmaaaa(r.liberarAPartir)}.` }),
  particao_ausente: () => ({ tom: 'aviso', texto: TEXTO_PARTICAO_AUSENTE }),
  nao_destacado: () => ({ tom: 'aviso', texto: 'Este mês não saiu das telas, então não há o que liberar nem trazer de volta. Nada foi alterado.' }),
  tabela_invalida: () => ({ tom: 'erro', texto: `Esta tela pediu uma tabela que o banco não aceita. Nada foi alterado; ${AVISE}.` }),
  sem_direito: (_op, _r, ctx) => ({ tom: 'aviso', texto: fraseDaFalta({ codigo: 'sem_direito' }, { mes: ctx.mes, janelaMeses: 6 }) }),
  dois_passos_obrigatorios: () => ({ tom: 'aviso', texto: 'Por enquanto a saída é em dois passos: primeiro sai das telas, depois você libera o espaço. Nada foi alterado; recarregue a página.' }),
  esquema_mudou: (_op, _r, ctx) => ({ tom: 'aviso', texto: fraseDaFalta({ codigo: 'esquema_mudou' }, { mes: ctx.mes, janelaMeses: 6 }) }),
  outro_site_na_particao: (_op, _r, ctx) => ({ tom: 'aviso', texto: fraseDaFalta({ codigo: 'outro_site_na_particao' }, { mes: ctx.mes, janelaMeses: 6 }) }),
  canal_sem_unidade: (_op, _r, ctx) => ({ tom: 'aviso', texto: fraseDaFalta({ codigo: 'canal_sem_unidade' }, { mes: ctx.mes, janelaMeses: 6 }) }),
  mudou_durante_a_leitura: () => ({ tom: 'aviso', texto: 'O dado mudou enquanto o banco conferia. Nada foi alterado; tente de novo em alguns minutos.' }),
  registro_diverge: () => ({ tom: 'erro', texto: comCodigo(FRASE_REGISTRO_DIVERGE, 'registro_diverge') }),
}

export function fraseDoRetorno(op: Operacao, r: RespostaSaida, ctx: Ctx): Frase {
  if (r.tipo === 'falhou') {
    const tom: Tom = r.causa === 'conferencia_parcial' || r.causa === 'sem_tempo' || r.causa === 'tempo_no_banco' ? 'aviso' : 'erro'
    return { tom, texto: fraseDaFalha(r.causa, op, r.restantes) }
  }
  if (r.tipo === 'recusado') {
    if (r.codigo === 'desconhecido') return { tom: 'erro', texto: fraseCodigoDesconhecido(op) }
    if (r.codigo !== null) return FRASE_DO_CODIGO[r.codigo](op, r, ctx)
    if (op === 'liberar' && r.faltam.some(f => f.codigo === 'b2_sem_atestacao' || f.codigo === 'nas_sem_atestacao'))
      return { tom: 'aviso', texto: 'A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). O espaço não foi liberado e o mês continua podendo voltar.' }
    const primeira = r.faltam[0]
    return { tom: 'aviso', texto: primeira ? fraseDaFalta(primeira, { mes: ctx.mes, janelaMeses: 6 }) : `O banco recusou; nada mudou. ${maiuscula(AVISE)}.` }
  }
  if (r.tipo === 'simulado') return { tom: 'ok', texto: fraseDaSimulacao(r, ctx.mes) }
  if (op === 'trazer') {
    if (r.protecaoFaltam && r.protecaoFaltam.length > 0) return { tom: 'erro', texto: `O mês voltou. A proteção contra remoção durante a saída não está instalada; ${AVISE} antes de tirar outro mês.` }
    const base = `${maiuscula(nomeDoMes(ctx.mes))} voltou ao banco online${emData(ctx.hoje)}.`
    return { tom: r.conteudoMudou ? 'aviso' : 'ok', texto: r.conteudoMudou ? `${base} O dado dele não bateu com a cópia: o mês será copiado de novo.` : base }
  }
  // tirar (ok) e liberar (ok): a linha relida mostra T7/T9; o retorno é curto
  return { tom: 'ok', texto: op === 'liberar' || !ctx.doisPassos ? `Saiu${emData(ctx.hoje)}.` : `Saiu das telas${emData(ctx.hoje)}.` }
}

const diasEntre = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
const diaSP = (iso: string): string | null => { const t = Date.parse(iso); return Number.isNaN(t) ? null : new Date(t - 3 * 3_600_000).toISOString().slice(0, 10) }
const diasDesde = (iso: string | null | undefined, hojeSP: string): number | null => { const d = typeof iso === 'string' ? diaSP(iso) : null; return d === null ? null : diasEntre(d, hojeSP) }

export function estadoDaLinha(e: EstadoDoMes, hojeSP: string): 'T1' | 'T3' | 'T7' | 'T7a' | 'T7b' | 'T9' {
  if (e.estado === 'descartado') return 'T9'
  if (e.estado === 'destacado') {
    const desde = diasDesde(e.destacado_em, hojeSP)
    if (desde !== null && desde > 15) return 'T7b'
    return e.liberar_a_partir && hojeSP >= e.liberar_a_partir ? 'T7a' : 'T7'
  }
  return e.faltam.length > 0 ? 'T1' : 'T3'
}

export function fraseDaLinhaDestacada(e: EstadoDoMes, hojeSP: string, pctDoBanco: number | null): string {
  const libera = pctDoBanco === null ? '' : ` Liberar o espaço devolve cerca de ${pctDoBanco}% do banco.`
  const s = estadoDaLinha(e, hojeSP)
  if (s === 'T7b') return `Saiu das telas há ${diasDesde(e.destacado_em, hojeSP)} dias e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta.`
  if (s === 'T7a') return `Pronto para liberar o espaço. Ainda dá para trazer de volta.${libera}`
  const aPartir = ddmmaaaa(e.liberar_a_partir)
  return `Saiu das telas${emData(e.destacado_em)}. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. ${aPartir === null ? 'A data em que o espaço pode ser liberado não foi medida.' : `A partir de ${aPartir} você pode liberar o espaço.`} Até lá não dá para remover canal nem apagar vídeo.${libera}`
}

/** O retorno completo da ação do servidor: com resposta, a frase da resposta; sem resposta, a da `causa`; sem causa (guarda negada), o `error` do servidor. */
export function fraseDoRetornoDaAcao(op: Operacao, ret: RetornoDaAcao, ctx: Ctx): Frase {
  if (ret.resposta) return fraseDoRetorno(op, ret.resposta, ctx)
  if (ret.causa) return fraseDoRetorno(op, { tipo: 'falhou', causa: ret.causa, restantes: ret.restantes }, ctx)
  return { tom: 'erro', texto: ret.error ?? fraseDaFalha('forma', op) }
}

/** T9: "Saiu em dd/mm/aaaa às hh:mm. Liberou N% do banco"; percentual nulo é "não medido", nunca 0%. */
export function fraseDaLinhaDescartada(e: EstadoDoMes, pctDoBanco: number | null): string {
  const t = Date.parse(e.descartado_em ?? '')
  const quando = Number.isNaN(t) ? '' : `${emData(e.descartado_em)} às ${new Date(t - 3 * 3_600_000).toISOString().slice(11, 16)}`
  return `Saiu${quando}. ${pctDoBanco === null ? `Liberou: ${NAO_MEDIDO_TEXTO}` : `Liberou ${pctDoBanco}% do banco`}`
}
