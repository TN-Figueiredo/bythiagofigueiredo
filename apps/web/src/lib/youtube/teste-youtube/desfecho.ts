import { detectarTesteYoutube } from './detectar'
import { normalizarTitulo } from './normalizar-titulo'
import { prepararLeituras } from './preparar'
import { tituloOficialMaisFrequente } from './titulo'
import {
  exigirLimiar,
  PADROES_DESFECHO,
  resolverOpcoes,
  REGRA_TESTE_YOUTUBE_VERSAO,
  type Desfecho,
  type LeituraWatch,
  type OpcoesDesfecho,
  type VereditoTesteYoutube,
} from './tipos'

type MotivoSemDado = Extract<Desfecho, { estado: 'sem_dado' }>['motivo']

/** §4.4: o que aconteceu depois de um `provavel_teste`. Pura; `opts.agora` é obrigatório (lança sem ele, antes de qualquer ramo). */
export function inferirDesfecho(antes: VereditoTesteYoutube, leiturasDepois: readonly LeituraWatch[], opts: OpcoesDesfecho): Desfecho {
  const agoraMs = typeof opts?.agora === 'string' ? Date.parse(opts.agora) : Number.NaN
  if (!Number.isFinite(agoraMs)) throw new Error('inferirDesfecho: opts.agora é obrigatório (ISO 8601)')
  resolverOpcoes(opts) // valida escritasConhecidas e limiares antes de qualquer ramo
  exigirLimiar('minLeiturasEstavel', opts.minLeiturasEstavel)
  exigirLimiar('minJanelaEstavelMs', opts.minJanelaEstavelMs)
  exigirLimiar('maxIdadeColetaMs', opts.maxIdadeColetaMs)
  const minLeiturasEstavel = opts.minLeiturasEstavel ?? PADROES_DESFECHO.minLeiturasEstavel
  const minJanelaEstavelMs = opts.minJanelaEstavelMs ?? PADROES_DESFECHO.minJanelaEstavelMs
  const maxIdadeColetaMs = opts.maxIdadeColetaMs ?? PADROES_DESFECHO.maxIdadeColetaMs

  const versaoRegra = REGRA_TESTE_YOUTUBE_VERSAO
  const semDado = (motivo: MotivoSemDado): Desfecho => ({ estado: 'sem_dado', motivo, versaoRegra })

  // 1
  if (antes.estado !== 'provavel_teste' || !antes.campos.includes('titulo')) return semDado('antes_sem_teste')

  // 2
  const prep = prepararLeituras(leiturasDepois)
  const comVoto = prep.leituras.filter(p => p.voto !== null)
  if (comVoto.length === 0) return semDado('depois_sem_leitura')
  // §4.4 p.4: leitura de outro idioma não vota; o de referência é o mais frequente entre os votantes (empate: o da 1ª pelo desempate)
  const porIdioma = new Map<string | null, number>()
  for (const p of comVoto) porIdioma.set(p.l.idioma, (porIdioma.get(p.l.idioma) ?? 0) + 1)
  let idiomaRef = comVoto[0]!.l.idioma
  for (const [idioma, n] of porIdioma) if (n > (porIdioma.get(idiomaRef) ?? 0)) idiomaRef = idioma
  const votantes = comVoto.filter(p => p.l.idioma === idiomaRef)

  // 3
  if (prep.leituras[0]!.ms <= Date.parse(antes.ultimaVista)) return semDado('janelas_sobrepostas')

  // 4: o sufixo final de leituras com o voto final; leitura sem voto é ignorada, voto diferente quebra
  const votoFinal = votantes[votantes.length - 1]!.voto as string
  let inicio = votantes.length - 1
  while (inicio > 0 && votantes[inicio - 1]!.voto === votoFinal) inicio--
  const sufixo = votantes.slice(inicio)
  const leiturasDescartadas = inicio
  const janelaSufixo = sufixo[sufixo.length - 1]!.ms - sufixo[0]!.ms

  // 5
  if (sufixo.length >= minLeiturasEstavel && janelaSufixo >= minJanelaEstavelMs) {
    if (!antes.variantes.titulo.some(t => normalizarTitulo(t) === votoFinal)) return semDado('valor_fora_do_teste')
    const oficial = tituloOficialMaisFrequente(sufixo)
    if (oficial === null) return semDado('oficial_nao_lido')
    if (normalizarTitulo(oficial) !== votoFinal) return semDado('oficial_diverge')
    return { estado: 'vencedor_provavel', vencedor: sufixo[0]!.votoCru as string, leiturasDescartadas, versaoRegra }
  }

  // 6
  const ultimaMs = prep.leituras[prep.leituras.length - 1]!.ms
  if (agoraMs - ultimaMs > maxIdadeColetaMs) return semDado('coleta_encerrada')

  // 7
  const d = detectarTesteYoutube(leiturasDepois, opts)
  if (d.estado === 'provavel_teste') return { estado: 'em_andamento', motivo: 'teste_visivel', versaoRegra }
  if (d.estado === 'insuficiente' || (d.estado === 'nada_visivel' && d.motivo === 'um_valor_so')) {
    return { estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra }
  }
  return semDado('depois_ambiguo')
}
