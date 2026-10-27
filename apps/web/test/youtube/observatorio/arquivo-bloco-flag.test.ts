// apps/web/test/youtube/observatorio/arquivo-bloco-flag.test.ts  (a variável com padrão, Passo 6)
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { montarBloco, marcaAoLadoDaPastilha } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
vi.mock('server-only', () => ({}))
const AGORA = Date.parse('2028-05-03T15:00:00Z')
const casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' } as const
const um = [{ versao: 2, channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', estado: 'pedido', decided_at: new Date(AGORA - 5 * 86_400_000).toISOString(), nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null, blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'N', removido_em: null, removido_via: 'botao', primeiro_mes: null, ultimo_mes: null, meses: null, registros: null, classes: [] }]
describe('OBS_ARQUIVO_LIMPEZA_CANAL: só "on" liga o comando de limpeza (com o bloco já entregue)', () => {
  beforeEach(() => { delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL })
  it('variável apagada: bloco na forma "espera o comando", marca nula', () => {
    const cap = lerCapacidades()
    expect(cap).toMatchObject({ comandoDeLimpeza: false, blocoCanaisRemovidos: true })
    expect(montarBloco(um as never, { agora: AGORA, casa, cap }).linhas[0]!.frase).toMatch(/Espera o comando/)
    expect(marcaAoLadoDaPastilha(um as never, { agora: AGORA, casa, cap })).toBeNull()
  })
  it.each(['ON', '1', 'true', ''])('valor %j: o mesmo que apagada', v => {
    process.env.OBS_ARQUIVO_LIMPEZA_CANAL = v
    expect(lerCapacidades().comandoDeLimpeza).toBe(false)
  })
  it("'on': a marca é desenhada", () => {
    process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'on'
    const cap = lerCapacidades()
    expect(cap.comandoDeLimpeza).toBe(true)
    expect(marcaAoLadoDaPastilha(um as never, { agora: AGORA, casa, cap })).not.toBeNull()
  })
})
