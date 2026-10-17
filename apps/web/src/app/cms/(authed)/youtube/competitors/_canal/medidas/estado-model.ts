// E5a Tarefa 15: o estado da página do canal (M8 + sincronização). Puro: relógio e dados entram por parâmetro.
// Ordem do NOTAS 15: saiu do YouTube, erro, primeira busca, pausado, parado, em queda, ativo. M8 que não veio: não carregou.
import type { CanalLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { M8DoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import { dm, quando } from './formatos'

export type TipoDeEstadoDaPagina = 'saiu' | 'erro' | 'primeira_busca' | 'pausado' | 'parado' | 'em_queda' | 'ativo' | 'nao_carregou'

export interface SincDaPagina {
  state: 'ok' | 'atrasado' | 'erro' | 'backfill'
  /** A última sincronização boa (ms), nula = nunca. */
  last: number | null
  errorSince: number | null
}

export interface EstadoDaPagina {
  tipo: TipoDeEstadoDaPagina
  /** O texto da pastilha. */
  pastilha: string
  /** A linha de baixo da célula Estado. */
  base: string
  /** A data (AAAA-MM-DD) da última leitura boa, nos três primeiros tipos. */
  ate: string | null
}

export function estadoDaPagina(
  m8: M8DoCanal | null,
  sync: SincDaPagina,
  extras: { missingSince: string | null; doisFormatos: boolean },
  canal: Pick<CanalLido, 'collectionPausedAt' | 'missingSince'> | null,
  hojeSP: string,
  agoraMs: number,
): EstadoDaPagina {
  const ate = sync.last === null ? null : spDateOf(sync.last)
  const saiuEm = extras.missingSince?.slice(0, 10) ?? canal?.missingSince?.slice(0, 10) ?? null
  if (saiuEm !== null || (m8?.estado.estado === 'medido' && m8.estado.valor === 'fora_do_ar')) {
    return { tipo: 'saiu', pastilha: saiuEm ? `Saiu do YouTube em ${dm(saiuEm)}` : 'Saiu do YouTube', base: ate ? `números até ${dm(ate)}` : 'sem leitura boa', ate }
  }
  if (sync.state === 'erro') {
    const desde = sync.errorSince ?? sync.last
    const d = desde === null ? 0 : Math.max(0, Math.floor((agoraMs - desde) / DAY))
    return { tipo: 'erro', pastilha: `Em erro há ${d} ${d === 1 ? 'dia' : 'dias'}`, base: ate ? `sem leitura desde ${dm(ate)}` : 'nunca sincronizou com sucesso', ate }
  }
  if (sync.state === 'backfill') {
    return { tipo: 'primeira_busca', pastilha: 'Primeira busca', base: 'a primeira busca ainda não terminou', ate }
  }
  if (canal?.collectionPausedAt || (m8?.estado.estado === 'medido' && m8.estado.valor === 'pausado')) {
    return { tipo: 'pausado', pastilha: 'Coleta pausada', base: 'a coleta deste canal está pausada', ate }
  }
  if (m8 === null || m8.estado.estado !== 'medido') {
    return { tipo: 'nao_carregou', pastilha: 'Não carregou', base: 'não carregou', ate }
  }
  const quem = extras.doisFormatos ? 'último longo ou Short' : 'último vídeo'
  const ult = m8.parado.estado === 'medido' ? m8.parado.valor : null
  const ultimo = ult ? spDateOf(ult.ultimaEm) : null
  const e = m8.estado.valor
  if (e === 'parado') {
    return { tipo: 'parado', pastilha: 'Parado', base: ult && ultimo ? `${quem} ${quando(ultimo, hojeSP)}` : 'sem data do último vídeo', ate: null }
  }
  if (e === 'em_queda') {
    return { tipo: 'em_queda', pastilha: 'Em queda sustentada', base: ult && ultimo ? `${quem} ${quando(ultimo, hojeSP)}` : 'três janelas de 28 dias seguidas', ate: null }
  }
  return { tipo: 'ativo', pastilha: 'Ativo', base: ult && ultimo ? `${quem} ${quando(ultimo, hojeSP)}` : 'sem data do último vídeo', ate: null }
}
