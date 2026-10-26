/** Junta o modelo da página do Lab (M7 T4). Puro: o `agora` vem na entrada. */
import { linhasConcluidas, CONCLUIDOS_VISIVEIS } from './concluidos'
import { painelDoConcluido } from './painel-decisao'
import { cartoesEmTeste, fraseDoTopo, itensComVoce, proximaDecisao } from './com-voce'
import { diaMesSp } from '../ab-data-curta'
import type { EntradaPagina, PaginaDoLab } from './tipos'

export function montarPaginaDoLab(e: EntradaPagina): PaginaDoLab {
  const itens = itensComVoce(e)
  const emTeste = cartoesEmTeste(e)
  const lab = emTeste.filter(c => c.tipo === 'lab').length
  const studio = emTeste.length - lab
  const temHistorico = e.ativos.length + e.concluidos.length + e.pausados.length + e.rascunhos.length > 0
    || e.linhas.some(l => l.registro !== null || l.nosso !== null)

  let vazio: string | null = null
  if (itens.length === 0) {
    if (lab + studio === 0) vazio = temHistorico ? 'Nenhum teste rodando; crie um quando quiser.' : null
    else {
      const prox = proximaDecisao(e)
      vazio = prox ? `Próxima decisão: ${diaMesSp(prox.toISOString())}.` : null
    }
  }

  const todas = linhasConcluidas({
    testes: e.concluidos.map(c => ({
      card: c.card, bruto: c.bruto, tela: c.tela,
      painel: c.tela ? painelDoConcluido(c.card, c.tela, { ctrs: c.ctrs, sugeridaId: c.tela.aplicar?.variant_id ?? null, revertExpiresAt: c.bruto.revert_expires_at, agora: e.agora }) : null,
    })),
    linhasStudio: e.linhas,
    agora: e.agora,
  })
  const feitos = e.concluidos.filter(c => c.card.roundNumber <= 1).length
  return {
    topo: { frase: fraseDoTopo({ lab, studio, itens, temHistorico }) },
    comVoce: { itens, vazio },
    emTeste,
    concluidos: { linhas: todas.slice(0, CONCLUIDOS_VISIVEIS), total: todas.length, regua: feitos < 3 ? { feitos, meta: 3 } : null },
    temHistorico,
  }
}
