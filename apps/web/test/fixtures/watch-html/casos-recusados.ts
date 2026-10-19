// Tabela única do que o banco recusa (Apêndice A.1). A T7 prova que o espelho recusa; a T10 prova que o Postgres recusa.
import type { LinhaLeitura, LinhaThumb } from '@/lib/youtube/watch/expansor'

export const SITE_TESTE = '11111111-1111-4111-8111-111111111111'
export const RODADA_TESTE = '22222222-2222-4222-8222-222222222222'

export function leituraValida(): LinhaLeitura {
  return {
    site_id: SITE_TESTE, youtube_video_id: 'qIg9a7vqcNo', lida_em: '2026-10-18T12:00:00.000Z', rodada_id: RODADA_TESTE,
    origem_rede: 'vercel', versao_leitor: 1, http: 200, erro: null, idioma: 'pt-BR',
    titulo_oficial: 'Título', titulo_oficial_fonte: 'videoDetails', titulo_exibido: 'Título',
    renderers_presentes: 7, titulos_divergentes: null, rendicoes_sqp: 3, jogador_bloqueado: false, thumb_k: null,
  }
}

export function thumbValida(): LinhaThumb {
  return {
    k: 1, site_id: SITE_TESTE, youtube_video_id: 'qIg9a7vqcNo', host: 'i.ytimg.com', variante: 'hqdefault', http: 200,
    etag: 'abc', sha16: '0123456789abcdef', dhash: '0123456789abcdef', largura: 480, altura: 360, vista_em: '2026-10-18T12:00:00.000Z',
  }
}

export interface CasoRecusado { nome: string; alvo: 'leitura' | 'thumb'; linha: unknown }

const L = leituraValida()
const T = thumbValida()
const erroSemDado = { ...L, erro: 'timeout', titulo_oficial: null, titulo_oficial_fonte: null, titulo_exibido: null, renderers_presentes: 0, jogador_bloqueado: false }

export const CASOS_RECUSADOS: readonly CasoRecusado[] = [
  { nome: "titulo_exibido ''", alvo: 'leitura', linha: { ...L, titulo_exibido: '' } },
  { nome: "titulo_exibido '   '", alvo: 'leitura', linha: { ...L, titulo_exibido: '   ' } },
  { nome: "titulo_oficial ''", alvo: 'leitura', linha: { ...L, titulo_oficial: '' } },
  { nome: 'titulo_exibido com 501 caracteres', alvo: 'leitura', linha: { ...L, titulo_exibido: 'a'.repeat(501) } },
  { nome: 'dHash maiúsculo', alvo: 'thumb', linha: { ...T, dhash: '0123456789ABCDEF' } },
  { nome: 'dHash de 15', alvo: 'thumb', linha: { ...T, dhash: '0123456789abcde' } },
  { nome: 'erro com título', alvo: 'leitura', linha: { ...erroSemDado, titulo_exibido: 'Título', renderers_presentes: 1 } },
  { nome: 'erro com título oficial', alvo: 'leitura', linha: { ...erroSemDado, titulo_oficial: 'Título', titulo_oficial_fonte: 'og_title' } },
  { nome: 'largura sem altura', alvo: 'thumb', linha: { ...T, altura: null } },
  { nome: 'dhash sem http 200', alvo: 'thumb', linha: { ...T, http: 404 } },
  { nome: 'titulos_divergentes sem texto', alvo: 'leitura', linha: { ...L, titulo_exibido: null, titulos_divergentes: [{ renderer: 'videoPrimaryInfoRenderer' }] } },
  { nome: "titulos_divergentes com elemento 'null' (string)", alvo: 'leitura', linha: { ...L, titulo_exibido: null, titulos_divergentes: ['null'] } },
  { nome: 'titulos_divergentes com renderer vazio', alvo: 'leitura', linha: { ...L, titulo_exibido: null, titulos_divergentes: [{ renderer: '', texto: 'x' }] } },
  { nome: 'exibido e divergentes juntos', alvo: 'leitura', linha: { ...L, titulos_divergentes: [{ renderer: 'r', texto: 'x' }] } },
  { nome: 'jogador_bloqueado com erro', alvo: 'leitura', linha: { ...erroSemDado, jogador_bloqueado: true } },
  { nome: 'oficial sem fonte', alvo: 'leitura', linha: { ...L, titulo_oficial_fonte: null } },
  { nome: 'idioma pt_BR', alvo: 'leitura', linha: { ...L, idioma: 'pt_BR' } },
  { nome: 'título sem idioma', alvo: 'leitura', linha: { ...L, idioma: null } },
  { nome: 'renderers_presentes 8', alvo: 'leitura', linha: { ...L, renderers_presentes: 8 } },
  { nome: 'rendicoes_sqp 201', alvo: 'leitura', linha: { ...L, rendicoes_sqp: 201 } },
  { nome: "etag ''", alvo: 'thumb', linha: { ...T, etag: '' } },
  { nome: 'etag de 201', alvo: 'thumb', linha: { ...T, etag: 'e'.repeat(201) } },
  { nome: "variante 'HQ'", alvo: 'thumb', linha: { ...T, variante: 'HQ' } },
  { nome: 'host fora do ytimg', alvo: 'thumb', linha: { ...T, host: 'example.com' } },
  { nome: 'origem_rede desconhecida', alvo: 'leitura', linha: { ...L, origem_rede: 'nuvem' } },
]
