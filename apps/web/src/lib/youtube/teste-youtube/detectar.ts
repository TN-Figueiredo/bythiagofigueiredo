import { classificarMiniatura, sinaisFracos } from './miniatura'
import { prepararLeituras } from './preparar'
import { classificarTitulo, tituloOficialMaisFrequente } from './titulo'
import {
  REGRA_TESTE_YOUTUBE_VERSAO,
  resolverOpcoes,
  type ContagemLeituras,
  type EstadoCampoTitulo,
  type LeituraWatch,
  type OpcoesDeteccao,
  type VereditoTesteYoutube,
} from './tipos'

/**
 * §4.3 p.1 e p.8: validação, junção do título com a miniatura e o diagnóstico. Pura; aceita entrada não validada.
 * Lança `Error` com leituras de mais de um vídeo (erro de quem chama).
 */
export function detectarTesteYoutube(leituras: readonly LeituraWatch[], opts?: OpcoesDeteccao): VereditoTesteYoutube {
  const o = resolverOpcoes(opts)
  const prep = prepararLeituras(leituras)
  const titulo = classificarTitulo(prep.leituras, o)
  const mini = classificarMiniatura(prep.leituras, o)
  const { contagem: ct } = titulo

  const contagem: ContagemLeituras = {
    recebidas: prep.recebidas,
    invalidas: prep.invalidas,
    comErro: prep.comErro,
    validasTitulo: ct.validasTitulo,
    validasMiniatura: mini.validasMiniatura,
    rodadas: ct.rodadas,
    rodadasLongas: ct.rodadasLongas,
    rodadasMistasTitulo: ct.rodadasMistasTitulo,
    rodadasEmQuarentena: ct.rodadasEmQuarentena,
    textosDistintosTitulo: ct.textosDistintosTitulo,
    primeiraMistura: ct.primeiraMistura,
  }
  const sinais = sinaisFracos(prep.leituras, o)
  const tituloOficial = tituloOficialMaisFrequente(prep.leituras)

  let porTitulo: EstadoCampoTitulo
  switch (titulo.estado) {
    case 'nao_lido':
      porTitulo = { estado: 'nao_lido' }
      break
    case 'insuficiente':
      porTitulo = { estado: 'insuficiente', motivo: titulo.detalhe.motivo }
      break
    case 'nada_visivel':
      porTitulo = { estado: 'nada_visivel', motivo: titulo.motivo }
      break
    case 'provavel_teste':
      porTitulo = { estado: 'provavel_teste' }
      break
  }
  const base = { versaoRegra: REGRA_TESTE_YOUTUBE_VERSAO, contagem, sinaisFracos: sinais, tituloOficial, porCampo: { titulo: porTitulo, miniatura: mini.estado } }

  switch (titulo.estado) {
    case 'provavel_teste':
      return {
        ...base,
        estado: 'provavel_teste',
        campos: ['titulo'],
        variantes: { titulo: titulo.variantes },
        proporcao: { titulo: titulo.proporcao },
        votos: { titulo: titulo.votos },
        primeiraVista: titulo.primeiraVista,
        ultimaVista: titulo.ultimaVista,
        janela: titulo.janela,
      }
    case 'nada_visivel':
      return {
        ...base,
        estado: 'nada_visivel',
        campos: ['titulo'],
        motivo: titulo.motivo,
        ...(titulo.valorUnico ? { valorUnico: titulo.valorUnico } : {}),
        janela: titulo.janela,
      }
    case 'insuficiente':
      return { ...base, estado: 'insuficiente', detalhe: titulo.detalhe }
    case 'nao_lido':
      if (ct.validasTitulo === 0 && mini.validasMiniatura === 0) return { ...base, estado: 'sem_leitura' }
      return { ...base, estado: 'insuficiente', detalhe: { motivo: 'titulo_nao_lido' } }
  }
}
