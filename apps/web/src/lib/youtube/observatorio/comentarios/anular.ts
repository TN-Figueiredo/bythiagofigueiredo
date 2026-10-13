// A5 · E14: a tarefa `anular_identidade`. É a obrigação de LGPD desta etapa: aos 28 dias a identidade do autor de um comentário
// (nome, id de canal, foto) é apagada. Roda uma vez por dia, ANTES e independente da coleta, e roda mesmo com a agenda desligada
// (a tarefa é `nuncaDesliga` no catálogo; este módulo não lê interruptor nenhum).
//
// A função do banco é um `DELETE` só: é idempotente (a segunda execução apaga 0) e segura com duas execuções ao mesmo tempo
// (a segunda espera a trava de linha e apaga 0). "Apaguei N" não é prova de nada: depois de apagar, LÊ a prova e
// confere que não sobrou identidade vencida. Apagou e não sabe se sobrou = vermelho.
//
// Nada que sai daqui leva nome, id de autor, texto de comentário nem texto do Postgres: só código de catálogo e número.
import { anular, ehSchemaAusente, lerProva } from './gravar'
import { codigoDe } from './erro'
import { veredito } from './prova'
import { relatarComentarios } from './relato'
import type { TarefaCtx, TarefaSaida } from './tipos'

export async function runAnularIdentidade(ctx: Pick<TarefaCtx, 'sb' | 'now' | 'siteId'>): Promise<TarefaSaida> {
  // 1. Apaga. Falha aqui = nada foi apagado (uma instrução) e a prova de depois não diria nada de novo.
  let resultado: Awaited<ReturnType<typeof anular>>
  try {
    resultado = await anular(ctx.sb, ctx.siteId)
  } catch (err) {
    if (ehSchemaAusente(err)) return { status: 'erro', feitos: 0, ficaram: 0, motivo: 'schema_ausente', numeros: {} }
    relatarComentarios('anular', codigoDe(err), {})
    return { status: 'erro', feitos: 0, ficaram: 0, motivo: 'banco', numeros: {} }
  }

  const feitos = resultado.apagadas
  const numerosDaAnulacao: Record<string, number> = {
    apagadas: resultado.apagadas,
    comentarios_carimbados: resultado.comentarios_carimbados,
    vencidas_ha_mais_de_1_dia: resultado.vencidas_ha_mais_de_1_dia,
    restantes: resultado.restantes,
  }

  // Vencida há mais de 1 dia = a rotina ficou sem rodar. Ela acabou de consertar: não é erro, mas é sinal.
  if (resultado.vencidas_ha_mais_de_1_dia > 0) {
    relatarComentarios('anular', 'rotina_atrasada', { vencidas_ha_mais_de_1_dia: resultado.vencidas_ha_mais_de_1_dia, apagadas: resultado.apagadas })
  }

  // 2. A prova de DEPOIS de apagar. O corte de início (`since`) não entra: a identidade não depende dele.
  const prova = await lerProva(ctx.sb, { siteId: ctx.siteId ?? null, nowIso: new Date(ctx.now()).toISOString(), since: null })
  if (!prova.ok && prova.motivo === 'schema_ausente') {
    return { status: 'erro', feitos, ficaram: 0, motivo: 'schema_ausente', numeros: numerosDaAnulacao }
  }

  const v = veredito(prova.ok ? prova.prova : null, { filaZerada: false, so: 'identidade' })
  const numeros = { ...numerosDaAnulacao, ...v.numeros }
  const primeiro = v.vermelhos[0]
  if (primeiro !== undefined) {
    relatarComentarios('anular', primeiro.codigo, numeros)
    return { status: 'erro', feitos, ficaram: 0, motivo: primeiro.codigo, numeros }
  }
  return { status: 'ok', feitos, ficaram: 0, numeros }
}
