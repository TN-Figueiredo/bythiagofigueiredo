/** Manutenção M5, Tarefa 9: modelos da página Arquivo montados pelo código de produção (montarPagina e montarBloco), nunca à mão. */
import { montarPagina, modeloDesligado, type ModeloPagina, type Casa } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { montarBloco, type BlocoCanaisRemovidos, type ListaRemovidosV2 } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { AGORA, mesCom, paginaVazia } from './arquivo-pagina'

const D = 86_400_000
export const CASA_OK: Casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' }
const CAP = { comandoDeLimpeza: false, blocoCanaisRemovidos: true, dataDoComando: null }

/** Um mês da série com tudo copiado e verificado e outro atrasado (o que precisa de quem administra), mais um mês da classe horária. */
export function modeloCheio(): ModeloPagina {
  return montarPagina(paginaVazia({
    meses: [mesCom({ nasHorasAtras: 3 }), mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 2 }), mesCom({ classe: 'horaria', nasHorasAtras: 3 })],
    teste: { aberto: true, meses: [], encerrado_em: null },
  }), { arquivoLigado: true })
}
/** Nenhum mês ainda: o caso comum antes da primeira unidade mensal. */
export function modeloVazio(): ModeloPagina { return montarPagina(paginaVazia(), { arquivoLigado: true }) }
export { modeloDesligado }

const removido = (o: Record<string, unknown>): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', estado: 'sem_destino', decided_at: new Date(AGORA - 5 * D).toISOString(),
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: null, removido_em: null, removido_via: 'sem_registro', primeiro_mes: '2026-10', ultimo_mes: '2027-06', meses: 9, registros: 1000, classes: ['serie'], ...o }) as ListaRemovidosV2[number]
export function blocoComSemDestino(): BlocoCanaisRemovidos { return montarBloco([removido({})], { agora: AGORA, casa: CASA_OK, cap: CAP }) }
export function blocoSoPedido(): BlocoCanaisRemovidos { return montarBloco([removido({ estado: 'pedido', nome: 'Viagem Lenta', removido_em: new Date(AGORA - 5 * D).toISOString(), removido_via: 'botao' })], { agora: AGORA, casa: CASA_OK, cap: CAP }) }
