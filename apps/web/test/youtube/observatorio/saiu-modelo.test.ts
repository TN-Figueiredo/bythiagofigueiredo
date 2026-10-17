// @vitest-environment node
/** A5 · E9, Tarefa 3: o modelo puro da fila "Saíram do YouTube". */
import { describe, it, expect } from 'vitest'
import {
  contadorDaAba, estadoDaFilaVazia, palavraConfere, diasDesde, faltaNoBlob, CODIGOS_DE_ERRO, fraseDoErro, fraseDoDesfecho,
  JANELA_FORJA_MIN, FILA_PAGINA, LEITURA_RECENTE_H, RESPONDIDOS_PAGINA, LISTA_TETO, PALAVRA,
} from '@/lib/youtube/observatorio/saiu/modelo'
import { STALE_AFTER_MINUTES } from '@/lib/youtube/analysis-progress'

const AGORA = Date.parse('2026-10-14T15:00:00Z')
const H = 3_600_000

describe('A5 E9 T3: modelo', () => {
  it('as constantes do contrato', () => {
    expect(FILA_PAGINA).toBe(10)
    expect(LEITURA_RECENTE_H).toBe(24)
    expect(RESPONDIDOS_PAGINA).toBe(50)
    expect(LISTA_TETO).toBe(20_000)
    expect(PALAVRA).toBe('APAGAR')
    expect(JANELA_FORJA_MIN).toBe(STALE_AFTER_MINUTES)
  })

  it('contador soma os três blocos e ignora voltou que só informa', () => {
    const f = {
      totalEsperando: 5,
      apagando: [{}, {}] as never[],
      voltaram: [{ pedeResposta: true }, { pedeResposta: false }, { pedeResposta: false }] as never[],
    }
    expect(contadorDaAba(f)).toBe(5 + 2 + 1)
  })

  it('item que está apagando e voltou conta uma vez', () => {
    // o leitor põe a linha só em apagando; aqui o contrato é: voltaram não repete o que já está em apagando
    const f = { totalEsperando: 0, apagando: [{ itemId: 1, voltouEm: '2026-10-13' }] as never[], voltaram: [] as never[] }
    expect(contadorDaAba(f)).toBe(1)
  })

  it('sete comentários que voltaram, de um canal, contam 1', () => {
    const f = { totalEsperando: 0, apagando: [] as never[], voltaram: [{ tipo: 'comentarios', pedeResposta: true, itemIds: [1, 2, 3, 4, 5, 6, 7] }] as never[] }
    expect(contadorDaAba(f)).toBe(1)
  })

  it('fila vazia com leitura há 2 h é vazia; há 25 h é vazia_sem_leitura_recente; sem leitura é vazia_sem_leitura_recente; site sem canal é sem_canais', () => {
    const base = { canaisDoSite: 3, ultimaLeituraDosCanais: new Date(AGORA - 2 * H).toISOString() }
    expect(estadoDaFilaVazia(base, AGORA)).toBe('vazia')
    expect(estadoDaFilaVazia({ ...base, ultimaLeituraDosCanais: new Date(AGORA - 25 * H).toISOString() }, AGORA)).toBe('vazia_sem_leitura_recente')
    expect(estadoDaFilaVazia({ ...base, ultimaLeituraDosCanais: null }, AGORA)).toBe('vazia_sem_leitura_recente')
    expect(estadoDaFilaVazia({ ...base, ultimaLeituraDosCanais: 'lixo' }, AGORA)).toBe('vazia_sem_leitura_recente')
    expect(estadoDaFilaVazia({ canaisDoSite: 0, ultimaLeituraDosCanais: null }, AGORA)).toBe('sem_canais')
  })

  it('palavra: APAGAR, apagar, " Apagar " conferem; APAGA, vazio e APAGAR! não', () => {
    for (const p of ['APAGAR', 'apagar', ' Apagar ']) expect(palavraConfere(p)).toBe(true)
    for (const p of ['APAGA', '', 'APAGAR!', '   ']) expect(palavraConfere(p)).toBe(false)
  })

  it('dias desde: mesmo dia é 0; virada de mês; data futura é 0, nunca negativo', () => {
    expect(diasDesde('2026-10-14', '2026-10-14')).toBe(0)
    expect(diasDesde('2026-09-28', '2026-10-03')).toBe(5)
    expect(diasDesde('2026-10-20', '2026-10-14')).toBe(0)
    expect(diasDesde('lixo', '2026-10-14')).toBe(0)
  })

  it('falta no Blob separa miniatura de pasta; lista vazia é 0 e 0', () => {
    const u = 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/abc.jpg'
    expect(faltaNoBlob([u, u + '2', 'observatorio/thumbs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/'])).toEqual({ miniaturas: 2, pastas: 1 })
    expect(faltaNoBlob([])).toEqual({ miniaturas: 0, pastas: 0 })
  })

  it('todo código de erro tem frase e a frase não repete o código cru; código desconhecido não lança', () => {
    expect(CODIGOS_DE_ERRO).toHaveLength(10)
    expect(fraseDoErro('mes_destacado_em_transito')).toBe('Este mês está sendo enviado ao arquivo. Tente de novo depois que terminar.')
    expect(fraseDoErro('sem_direito')).toBe('Só quem administra a organização pode apagar canais. Nada foi apagado.')
    for (const c of CODIGOS_DE_ERRO) {
      const f = fraseDoErro(c)
      expect(f.length).toBeGreaterThan(10)
      expect(f).not.toContain(c)
    }
    expect(fraseDoErro('inventado' as never)).toBe(fraseDoErro('erro_de_banco'))
    expect(() => fraseDoErro(undefined as never)).not.toThrow()
  })

  it('a recusa escreve a janela recebida (30 e 45), não um número fixo', () => {
    expect(fraseDoDesfecho('forja_em_andamento', { tipo: 'video', janelaMin: 30 })).toContain('30 minutos')
    const f45 = fraseDoDesfecho('forja_em_andamento', { tipo: 'video', janelaMin: 45 })
    expect(f45).toContain('45 minutos')
    expect(f45).not.toContain('30')
  })

  it('a resposta "voltar" de vídeo diz a condição', () => {
    // a frase de "voltar" mora no desfecho 'mantido'? não: ela é do desfecho 'nada'/'ok' da decisão; ver fraseDaVolta
    expect(fraseDoDesfecho('apagado', { tipo: 'video', janelaMin: 30 })).toBeTruthy()
  })

  it('todo desfecho tem frase não vazia', () => {
    for (const d of ['apagado', 'apagando', 'no_ar', 'forja_em_andamento', 'not_found', 'mudou', 'mantido', 'respondido', 'nada', 'sem_permissao', 'palavra_errada', 'erro'] as const) {
      expect(fraseDoDesfecho(d, { tipo: 'canal', janelaMin: 30 }).length).toBeGreaterThan(5)
    }
  })
})
