// @vitest-environment node
/** F1 do Remover canal, Tarefa 6: o subcomando `pedidos` e a linha "remoções pedidas" do `estado`. exportarCanal e conferirLote são falsos. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exportarCanal = vi.fn()
const conferirLote = vi.fn()
vi.mock('@/lib/youtube/observatorio/arquivo/exportar', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/observatorio/arquivo/exportar')>()), exportarCanal: (...a: unknown[]) => exportarCanal(...a) }))
vi.mock('@/lib/youtube/observatorio/arquivo/conferir', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/observatorio/arquivo/conferir')>()), conferirLote: (...a: unknown[]) => conferirLote(...a) }))

import { interpretar, rodar, type Comando, type DepsDoComando } from '@/lib/youtube/observatorio/arquivo/cli'
import type { ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { SITE, CANAL, LOTE, AGORA, discoFalso, baixarFalso } from './arquivo-fakes'

const ENV = { OBS_ARQUIVO_DB_URL: 'postgresql://x:y@db.example.test:5432/postgres', HOME: '/home/dono' }
const USUARIO = '11111111-2222-4333-8444-555555555555'
const CANAL2 = 'bbbbbbbb-2222-4333-8444-555555555555'
const cmd = (s: string): Comando => { const c = interpretar(s.split(' ').filter(Boolean), ENV); if ('erro' in c) throw new Error(c.erro); return c }
const ago = (min: number): string => new Date(AGORA.getTime() - min * 60_000).toISOString()

type Rota = [RegExp, (p: unknown[]) => Array<Record<string, unknown>> | Error]
function banco(rotas: Rota[]) {
  const chamadas: string[] = []
  const sql: ClienteSql = {
    async query(texto, parametros = []) {
      chamadas.push(texto.trim())
      for (const [re, f] of rotas) if (re.test(texto)) { const r = f(parametros); if (r instanceof Error) throw r; return { rows: r } }
      if (/^\s*(begin|commit|rollback|set local)/i.test(texto) || /pg_advisory_unlock/.test(texto)) return { rows: [] }
      throw new Error('consulta sem rota: ' + texto.slice(0, 80))
    },
  }
  return { sql, chamadas }
}
const base = (pedidos: Array<Record<string, unknown>>, lote: Record<string, unknown> | null, extra: Rota[] = []): Rota[] => [
  ...extra,
  [/select distinct site_id/, () => [{ site_id: SITE }]],
  [/from auth\.users/, () => [{ id: USUARIO }]],
  [/obs_archive_is_site_admin/, () => [{ ok: true }]],
  [/pg_try_advisory_lock/, () => [{ ok: true }]],
  [/where site_id = \$1 and removal_requested_at is not null/, () => pedidos],
  [/from public\.obs_archive_batches b\s+where b\.site_id/, () => (lote ? [lote] : [])],
  [/removal_requested_at from public\.competitor_channels where id/, () => [{ removal_requested_at: ago(30) }]],
]
const pedido = (o: Record<string, unknown> = {}) => ({ id: CANAL, channel_name: 'Canal Um', pedida_em: ago(30), pausada_em: ago(20), ...o })
const loteDe = (o: Record<string, unknown> = {}) => ({ batch: LOTE, exportado_em: ago(10), conferido: false, confirmado: false, ...o })
const deps = (sql: ClienteSql, o: Partial<DepsDoComando> = {}): DepsDoComando => ({
  sql, disco: discoFalso().disco, baixar: baixarFalso().baixar, agora: () => AGORA, ehTerminal: true, perguntar: async () => LOTE, versaoDoScript: 't', ...o,
})
const txt = (s: { saida: string[] }) => s.saida.join('\n')

beforeEach(() => {
  exportarCanal.mockReset().mockResolvedValue({ ok: true, lote: LOTE, arquivos: 30, linhas: 10, miniaturas: 0, miniaturasAusentes: 0 })
  conferirLote.mockReset().mockResolvedValue({ ok: true, arquivos: 30, miniaturas: 0 })
})

describe('pedidos', () => {
  it('C6.6 sem --por: erro', () => { expect('erro' in interpretar(['pedidos'], ENV) && (interpretar(['pedidos'], ENV) as { erro: string }).erro).toContain('--por') })

  it('C6.1 estado lista remoções pedidas com o passo', async () => {
    const { sql } = banco([
      ...base([pedido()], loteDe({ conferido: true }), [[/collection_paused_at::text as desde/, () => []], [/from public\.obs_archive_batches b where b\.site_id/, () => []], [/obs_db_size_daily/, () => []]]),
    ])
    const r = await rodar(cmd('estado'), deps(sql))
    expect(txt(r)).toContain('remoções pedidas: 1')
    expect(txt(r)).toMatch(new RegExp(`  ${CANAL}  Canal Um  pedida em .+: falta copiar para o NAS e confirmar`))
  })

  it('C6.2 nenhum pedido', async () => {
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([], null)).sql))
    expect(r.codigo).toBe(0); expect(txt(r)).toBe('nenhuma remoção pedida')
  })

  it('C6.3 esperar: 5 min de pausa manda esperar e não chama nada', async () => {
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido({ pausada_em: ago(5) })], null)).sql))
    expect(txt(r)).toBe('canal Canal Um: espere 1 min para exportar')
    expect(exportarCanal).not.toHaveBeenCalled(); expect(conferirLote).not.toHaveBeenCalled()
  })

  it('C6.3 sem lote: exporta e confere; com --destino imprime os 2 comandos do NAS; sem ele, o próximo passo', async () => {
    const com = await rodar(cmd('pedidos --por d@e.co --destino u@nas:/vol/a'), deps(banco(base([pedido()], null)).sql))
    expect(com.codigo).toBe(0); expect(exportarCanal).toHaveBeenCalledTimes(1); expect(conferirLote).toHaveBeenCalledTimes(1)
    expect(txt(com)).toContain('rsync -av'); expect(txt(com)).toContain('sha256sum -c')
    const sem = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], null)).sql))
    expect(txt(sem)).toContain('próximo passo: copiar para o NAS (rode de novo com --destino)')
  })

  it('C6.3 exportado e não conferido: só confere', async () => {
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], loteDe())).sql))
    expect(r.codigo).toBe(0); expect(exportarCanal).not.toHaveBeenCalled(); expect(conferirLote).toHaveBeenCalledTimes(1)
  })

  it('C6.3 conferido: pergunta o nome e confirma o NAS dentro da transação, com for update', async () => {
    const b = banco(base([pedido()], loteDe({ conferido: true }), [
      [/removal_requested_at from public\.competitor_channels where id = \$1 and site_id = \$2 for update/, () => [{ removal_requested_at: ago(30) }]],
      [/obs_archive_confirm_nas/, () => [{ r: { arquivos: 30 } }]],
    ]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(r.codigo).toBe(0); expect(txt(r)).toContain('cópia no NAS confirmada')
    const i = b.chamadas.findIndex(x => x === 'begin'), j = b.chamadas.findIndex(x => /for update/.test(x)), k = b.chamadas.findIndex(x => /obs_archive_confirm_nas/.test(x))
    expect(i).toBeGreaterThanOrEqual(0); expect(j).toBeGreaterThan(i); expect(k).toBeGreaterThan(j)
  })

  it('C6.3 confirmado: remove (remove_archived) com for update antes', async () => {
    const b = banco(base([pedido()], loteDe({ conferido: true, confirmado: true }), [
      [/for update/, () => [{ removal_requested_at: ago(30) }]],
      [/select channel_name from public\.competitor_channels/, () => [{ channel_name: 'Canal Um' }]],
      [/select batch from public\.obs_archive_batches/, () => [{ batch: LOTE }]],
      [/competitor_channel_remove_archived/, () => [{ r: { status: 'removido', batch: LOTE, linhas: 5, arquivos: 30, blob_urls: [] } }]],
    ]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(r.codigo).toBe(0); expect(txt(r)).toContain('canal removido')
    expect(b.chamadas.findIndex(x => /for update/.test(x))).toBeLessThan(b.chamadas.findIndex(x => /remove_archived/.test(x)))
  })

  it('C6.3b lote morto: lote fechado e pausa nova depois dele chama exportarCanal e não conferirLote', async () => {
    // o filtro closed_at is null no SQL já exclui o lote fechado: a consulta devolve vazio
    const b = banco(base([pedido()], null))
    await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(exportarCanal).toHaveBeenCalledTimes(1)
    const lote = b.chamadas.find(x => /from public\.obs_archive_batches b\s+where/.test(x))!
    expect(lote).toMatch(/b\.deleted_at is null and b\.closed_at is null and b\.exported_at >= \$3/)
  })

  it('C6.4 sem terminal: os passos que pedem nome dizem o que falta, código 1', async () => {
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], loteDe({ conferido: true }))).sql, { ehTerminal: false }))
    expect(r.codigo).toBe(1); expect(txt(r)).toContain('falta digitar: rode num terminal')
  })

  it('C6.5 falha no pedido 1 não impede o 2; cada saída começa por canal <nome>:; código 1', async () => {
    conferirLote.mockResolvedValueOnce({ ok: false, frase: 'diferença', diferencas: [] })
    const b = banco(base([pedido(), pedido({ id: CANAL2, channel_name: 'Canal Dois' })], loteDe()))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(r.codigo).toBe(1)
    expect(conferirLote).toHaveBeenCalledTimes(2)
    expect(r.saida.filter(l => l.startsWith('canal '))).toHaveLength(2)
  })

  it('C6.7 pedido desfeito antes de remover: nada é apagado, rollback e a frase do pedido desfeito', async () => {
    const b = banco(base([pedido()], loteDe({ conferido: true, confirmado: true }), [
      [/for update/, () => [{ removal_requested_at: null }]],
      [/select channel_name from public\.competitor_channels/, () => [{ channel_name: 'Canal Um' }]],
      [/select batch from public\.obs_archive_batches/, () => [{ batch: LOTE }]],
    ]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(r.codigo).toBe(1)
    expect(txt(r)).toBe('canal Canal Um: o pedido foi desfeito no CMS; nada foi apagado')
    expect(b.chamadas.some(x => /remove_archived/.test(x))).toBe(false)
    expect(b.chamadas).toContain('rollback')
  })

  it('C6.8 o mesmo para confirm_nas; e um código de estado (lote_nao_confirmado) com o pedido já desfeito troca a frase', async () => {
    const b = banco(base([pedido()], loteDe({ conferido: true }), [
      [/for update/, () => [{ removal_requested_at: null }]],
    ]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(txt(r)).toBe('canal Canal Um: o pedido foi desfeito no CMS; nada foi apagado')
    expect(b.chamadas.some(x => /obs_archive_confirm_nas/.test(x))).toBe(false)

    let lido = 0
    const b2 = banco(base([pedido()], loteDe({ conferido: true }), [
      [/removal_requested_at from public\.competitor_channels where id = \$1 and site_id = \$2 for update/, () => [{ removal_requested_at: ago(30) }]],
      [/obs_archive_confirm_nas/, () => new Error('E10:lote_nao_confirmado: x')],
      [/removal_requested_at from public\.competitor_channels where id = \$1 and site_id = \$2$/, () => { lido++; return [{ removal_requested_at: null }] }],
    ]))
    const r2 = await rodar(cmd('pedidos --por d@e.co'), deps(b2.sql))
    expect(lido).toBe(1); expect(txt(r2)).toBe('canal Canal Um: o pedido foi desfeito no CMS; nada foi apagado')
  })

  it('C6.9 dois terminais: o lock de sessão negado recusa', async () => {
    const b = banco(base([pedido()], null, [[/pg_try_advisory_lock/, () => [{ ok: false }]]]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(r.codigo).toBe(1); expect(txt(r)).toBe('outro terminal está processando os pedidos deste site')
    expect(b.chamadas.some(x => /where site_id = \$1 and removal_requested_at/.test(x))).toBe(false)
  })

  it('libera o lock no fim', async () => {
    const b = banco(base([], null))
    await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(b.chamadas.some(x => /pg_advisory_unlock/.test(x))).toBe(true)
  })

  it('C6.10 (Yannis I-1) exportar recusado com pasta_nao_vazia: imprime o comando pronto com --refazer e o uuid do canal', async () => {
    exportarCanal.mockResolvedValue({ ok: false, codigo: 'pasta_nao_vazia', frase: 'A pasta da exportação já existe e não está vazia. Use --refazer para exportar de novo.' })
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], null)).sql))
    expect(r.codigo).toBe(1)
    expect(txt(r)).toContain(`rode: npx tsx scripts/obs-arquivo.ts exportar --canal ${CANAL} --pasta /home/dono/Workspace/arquivo-observatorio --refazer`)
    expect(conferirLote).not.toHaveBeenCalled()
  })

  it('C6.11 (Yannis I-1) miniaturas_ausentes leva --aceitar-miniaturas-ausentes; outro código não leva opção nenhuma', async () => {
    exportarCanal.mockResolvedValueOnce({ ok: false, codigo: 'miniaturas_ausentes', frase: 'Há miniaturas que não existem mais.' })
    const a = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], null)).sql))
    expect(txt(a)).toMatch(new RegExp(`exportar --canal ${CANAL} --pasta \\S+ --aceitar-miniaturas-ausentes$`, 'm'))
    exportarCanal.mockResolvedValueOnce({ ok: false, codigo: 'forja_em_andamento', frase: 'A forja está em andamento.' })
    const b = await rodar(cmd('pedidos --por d@e.co'), deps(banco(base([pedido()], null)).sql))
    expect(txt(b)).toMatch(new RegExp(`exportar --canal ${CANAL} --pasta \\S+$`, 'm'))
    expect(txt(b)).not.toContain('--refazer')
  })

  it('C6.12 (Yannis M-2) canal que sumiu no meio do comando: a frase diz que foi apagado pelo CMS, não que o pedido foi desfeito', async () => {
    const b = banco(base([pedido()], loteDe({ conferido: true, confirmado: true }), [
      [/for update/, () => []],
      [/select channel_name from public\.competitor_channels/, () => [{ channel_name: 'Canal Um' }]],
      [/select batch from public\.obs_archive_batches/, () => [{ batch: LOTE }]],
      [/removal_requested_at from public\.competitor_channels where id = \$1 and site_id = \$2$/, () => []],
    ]))
    const r = await rodar(cmd('pedidos --por d@e.co'), deps(b.sql))
    expect(txt(r)).toContain('já foi apagado')
    expect(b.chamadas.some(x => /remove_archived/.test(x))).toBe(false)
  })
})
