import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { telaV2DoTeste, type EntradaTelaV2, type TelaV2, type VarianteDaTela } from '@/lib/youtube/ab-gravacao/tela-v2'
import { ctrDosValidos, estatisticaV2, type DiaDaDecisao, type CicloComNumero } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const AGORA = new Date('2026-10-25T20:00:00Z') // 13:00 PT; ontem = 2026-10-24
const ENC = '2026-10-24'
const O = 'o', B = 'b', C = 'c'
const VAR2: VarianteDaTela[] = [
  { id: O, letra: 'A', titulo: 'Original', is_original: true },
  { id: B, letra: 'B', titulo: 'Nova', is_original: false },
]
const VAR3: VarianteDaTela[] = [...VAR2, { id: C, letra: 'C', titulo: 'Outra', is_original: false }]

const dia = (day: string, v: string | null, imp: number | null = 1000, ctr: number | null = 0.05, over: Partial<DiaDaDecisao> = {}): DiaDaDecisao =>
  ({ day_pt: day, variant_id: v, alcance_estado: 'medido', impressoes: imp, ctr, final: true, bloco: 0, ...over })

/** `n` dias por variante terminando em `ate`, variantes em rodízio. */
function dias(vars: string[], porVariante: number, imp = 1000, ctrs: Record<string, number> = {}, ate = ENC): DiaDaDecisao[] {
  const out: DiaDaDecisao[] = []
  let k = 0
  for (let i = porVariante * vars.length - 1; i >= 0; i--) {
    const v = vars[k++ % vars.length]!
    out.push(dia(addDays(ate, -i), v, imp, ctrs[v] ?? 0.05))
  }
  return out
}

const OK = (extra: object = {}) => ({ estado: 'ok', destino: 'original', em: '2026-10-25T10:00:00Z', forcado: false, escreveu: true, attempts: 1, ...extra })

function ciclo(diasAtras: number): CicloComNumero {
  return { id: 'c1', test_id: 't', variant_id: O, started_at: new Date(AGORA.getTime() - diasAtras * 86_400_000).toISOString(), ended_at: null, applied_metadata: null, cycle_number: 1 }
}

function ativo(over: { dia?: number; v2?: unknown; dias?: DiaDaDecisao[]; vars?: VarianteDaTela[]; status?: string; config?: unknown } = {}): EntradaTelaV2 {
  const meta = over.v2 === undefined ? {} : { v2: over.v2 }
  return {
    teste: { id: 't', status: over.status ?? 'active', regra: 'v2', config: over.config ?? { max_duration_days: 15, teto_explicito: true }, paused_at: null, completed_at: null,
      completed_reason: null, winner_variant_id: null, winner_applied_at: null, revert_expires_at: null, restore_status: null, result_metadata: meta, original_title: 'T', test_type: 'thumbnail' },
    variantes: over.vars ?? VAR2, ciclos: [ciclo(over.dia ?? 6)], dias: over.dias ?? [], agora: AGORA, outroTesteAberto: false,
  }
}

function concluido(o: {
  desfecho?: string | null; provisorio?: boolean; sugerido?: string | null; reason?: string; winner?: string | null; applied?: string | null; revert?: string | null
  dias?: DiaDaDecisao[]; vars?: VarianteDaTela[]; n?: number | null; v2?: unknown; enc?: string | null; restore?: unknown; agora?: Date; semSugerido?: boolean
} = {}): EntradaTelaV2 {
  const vars = o.vars ?? VAR2
  const v2 = o.v2 !== undefined ? o.v2 : {
    ...(o.n === null ? {} : { n: o.n ?? 100 }),
    ...(o.desfecho === null ? {} : { desfecho: o.desfecho ?? 'vencedor_provavel' }),
    provisorio: o.provisorio ?? false,
    ...(o.enc === null ? {} : { encerrado_em_dia: o.enc ?? ENC }),
    ...(o.semSugerido ? {} : { vencedor_sugerido: o.sugerido === undefined ? B : o.sugerido }),
  }
  return {
    teste: { id: 't', status: 'completed', regra: 'v2', config: {}, paused_at: null, completed_at: '2026-10-25T08:00:00Z',
      completed_reason: o.reason ?? 'regra_v2', winner_variant_id: o.winner ?? null, winner_applied_at: o.applied ?? null, revert_expires_at: o.revert ?? null,
      restore_status: o.restore ?? null, result_metadata: { v2 }, original_title: 'T', test_type: 'thumbnail' },
    variantes: vars, ciclos: [], dias: o.dias ?? dias(vars.map(v => v.id), 5, 1000, { [B]: 0.054, [O]: 0.046, [C]: 0.05 }),
    agora: o.agora ?? AGORA, outroTesteAberto: false,
  }
}

const at = (e: EntradaTelaV2): TelaV2 => {
  const r = telaV2DoTeste(e)
  if (!r) throw new Error('tela nula')
  return r
}
const ativoDe = (e: EntradaTelaV2) => { const r = at(e); if (r.fase !== 'ativo') throw new Error('não ativo'); return r }
const concDe = (e: EntradaTelaV2) => { const r = at(e); if (r.fase !== 'concluido') throw new Error('não concluído'); return r }

describe('telaV2DoTeste: ativo', () => {
  it('ativo-antes-pisos: sem linhas => dias e volume null, nunca 0', () => {
    const r = ativoDe(ativo())
    expect(r.pisos.every(p => p.dias_validos === null && p.volume === null)).toBe(true)
    expect(r.frase.principal).toBe('Ainda não decide: o YouTube ainda não fechou nenhum dia.')
    expect(r.frase.apoio).toBe('O YouTube fecha cada dia com até 11 dias de atraso. O Lab confere uma vez por dia.')
    expect(r.dia).toBe(6); expect(r.teto).toBe(15)
  })
  it('◆T 1: dias abertos, volume fechado', () => {
    const r = ativoDe(ativo({ v2: { n: 100 }, dias: [...dias([O, B], 3).slice(0, 5)] }))
    expect(r.frase.principal).toBe('Ainda não decide: faltam dias válidos.')
    expect(r.frase.apoio).toBe('Cada versão precisa de 4; A tem 3 e B tem 2.')
  })
  it('V = 3: lista "A tem 3, B tem 2 e C tem 4"', () => {
    const d = [dia('2026-10-20', O), dia('2026-10-21', O), dia('2026-10-22', O), dia('2026-10-17', B), dia('2026-10-18', B),
      dia('2026-10-10', C), dia('2026-10-11', C), dia('2026-10-12', C), dia('2026-10-13', C)]
    const r = ativoDe(ativo({ v2: { n: 100 }, dias: d, vars: VAR3 }))
    expect(r.frase.apoio).toBe('Cada versão precisa de 4; A tem 3, B tem 2 e C tem 4.')
  })
  it('◆T 1: variante sem linha => "B ainda não tem dia medido"', () => {
    const r = ativoDe(ativo({ v2: { n: 100 }, dias: [dia('2026-10-20', O), dia('2026-10-21', O), dia('2026-10-22', O)] }))
    expect(r.frase.apoio).toBe('Cada versão precisa de 4; A tem 3 e B ainda não tem dia medido.')
  })
  it('ativo-sem-volume (412/388 de 10.315, 4 dias válidos)', () => {
    const d = [...[1, 2, 3, 4].map(i => dia(`2026-10-0${i}`, O, 103, 0.04)), ...[5, 6, 7, 8].map(i => dia(`2026-10-0${i}`, B, 97, 0.05))]
    const r = ativoDe(ativo({ v2: { n: 10315, vencedor_sugerido: B }, dias: d, dia: 8 }))
    expect(r.sinal).toBeNull()
    expect(r.frase.principal).toBe('Ainda não decide: faltam impressões.')
    expect(r.frase.apoio).toBe('Cada versão precisa de 10.315; A tem 412 e B tem 388.')
  })
  it('◆T 1a: dias e volume abertos', () => {
    const d = [dia('2026-10-01', O, 200), dia('2026-10-02', O, 212), dia('2026-10-03', O, 0, null, { alcance_estado: 'aguardando' }),
      dia('2026-10-04', B, 388)]
    const r = ativoDe(ativo({ v2: { n: 10315 }, dias: d }))
    expect(r.frase.principal).toBe('Ainda não decide: faltam dias válidos e impressões.')
    expect(r.frase.apoio).toBe('Cada versão precisa de 4 dias e 10.315 impressões; A tem 2 dias e 412, B tem 1 e 388.')
  })
  it('ativo-teto-sem-volume (dia 14 de 15)', () => {
    const r = ativoDe(ativo({ dia: 14, v2: { n: 10315 }, dias: dias([O, B], 4, 100) }))
    expect(r.frase.principal).toBe('Faltam impressões; o teste encerra amanhã.')
    expect(r.frase.apoio).toBe('Amanhã a original volta ao ar. Cada versão precisa de 10.315; A tem 400 e B tem 400.')
  })
  it('◆T 4: pausado com volume faltando', () => {
    const r = ativoDe(ativo({ status: 'paused', dia: 14, v2: { n: 10315 }, dias: dias([O, B], 4, 100) }))
    expect(r.pausado).toBe(true)
    expect(r.frase.principal).toBe('Faltam impressões; o teste está pausado.')
    expect(r.frase.apoio).toBe('Cada versão precisa de 10.315; A tem 400 e B tem 400.')
    expect(JSON.stringify(r.frase)).not.toContain('amanhã')
  })
  it('◆T 5/5a: n nulo com dias', () => {
    const r = ativoDe(ativo({ v2: {}, dias: dias([O, B], 2) }))
    expect(r.n).toBeNull()
    expect(r.frase.principal).toBe('Ainda não decide: falta calcular quantas impressões cada versão precisa.')
    expect(r.frase.apoio).toBe('A conta roda uma vez por dia.')
    expect(JSON.stringify(r.frase)).not.toContain('—')
  })
  it('ativo-sinal: pisos fechados e sugerido B', () => {
    const r = ativoDe(ativo({ v2: { n: 100, vencedor_sugerido: B }, dias: dias([O, B], 5) }))
    expect(r.sinal).toBe('B')
    expect(r.frase.principal).toBe('Há um sinal de B, mas ainda não decide.')
    expect(r.frase.apoio).toBe('Os pisos fecharam. O teste segue até o fim para o resultado valer.')
  })
  it('◆T 2: chave presente e nula => sem sinal', () => {
    const r = ativoDe(ativo({ v2: { n: 100, vencedor_sugerido: null }, dias: dias([O, B], 5) }))
    expect(r.sinal).toBeNull()
    expect(r.frase.principal).toBe('Os pisos fecharam; nenhuma versão está à frente da original.')
    expect(r.frase.apoio).toBe('O teste segue até o fim para o resultado valer.')
  })
  it('◆T 3 (Foco 3): sugerido = original no ativo => sem sinal', () => {
    const r = ativoDe(ativo({ v2: { n: 100, vencedor_sugerido: O }, dias: dias([O, B], 5) }))
    expect(r.sinal).toBeNull()
    expect(r.frase.principal).toBe('Os pisos fecharam; nenhuma versão está à frente da original.')
  })
  it('P4: chave ausente + pisos fechados => ◆T 11, sem sinal', () => {
    const r = ativoDe(ativo({ v2: { n: 100 }, dias: dias([O, B], 5) }))
    expect(r.sinal).toBeNull()
    expect(r.frase.principal).toBe('Os dias mínimos já foram atingidos; o resultado sai amanhã.')
    expect(r.frase.apoio).toBe('Volte amanhã.')
  })
  it('P5: dia = teto + 2 => passouDoFim, nunca "-2"', () => {
    const r = ativoDe(ativo({ dia: 17, v2: { n: 10315 }, dias: dias([O, B], 4, 100) }))
    expect(r.passouDoFim).toBe(true)
    expect(r.frase.principal).toBe('O encerramento atrasou; o teste tenta encerrar de novo na próxima avaliação diária.')
    expect(JSON.stringify(r)).not.toContain('-2')
  })
  it('P5: v2 ilegível no ativo => ilegivel', () => {
    const r = ativoDe(ativo({ v2: { n: 'x' }, dias: dias([O, B], 3) }))
    expect(r.ilegivel).toBe(true)
    expect(r.frase.principal).toBe('Não consegui ler a avaliação; este teste não encerra sozinho.')
    expect(r.frase.apoio).toBe('Para decidir agora, use Encerrar.')
  })
  it('P5/N2: dia = teto + 2 com v2 ilegível => ◆T 13, não 12', () => {
    const r = ativoDe(ativo({ dia: 17, v2: { n: 'x' } }))
    expect(r.ilegivel).toBe(true)
    expect(r.frase.principal).toBe('Não consegui ler a avaliação; este teste não encerra sozinho.')
  })
})

describe('telaV2DoTeste: nulos', () => {
  it('v1 => null', () => {
    const e = ativo(); e.teste.regra = 'v1'
    expect(telaV2DoTeste(e)).toBeNull()
  })
  it('draft e queued => null', () => {
    expect(telaV2DoTeste(ativo({ status: 'draft' }))).toBeNull()
    expect(telaV2DoTeste(ativo({ status: 'queued' }))).toBeNull()
  })
  it('manual_archive v2 => null', () => {
    expect(telaV2DoTeste(concluido({ reason: 'manual_archive' }))).toBeNull()
  })
  it('manual_winner sem encerrado_em_dia => null', () => {
    expect(telaV2DoTeste(concluido({ reason: 'manual_winner', enc: null, winner: B, applied: '2026-10-25T10:00:00Z' }))).toBeNull()
  })
})

describe('telaV2DoTeste: concluído, um por estado', () => {
  it('vencedor provisório: ate 04/11, aplicar B, CTR e lift', () => {
    const r = concDe(concluido({ provisorio: true }))
    expect(r.selo).toEqual({ tipo: 'vence', provisorio: true, letra: 'B' })
    expect(r.frase.principal).toBe('B provavelmente vence.')
    expect(r.frase.apoio).toBe('CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).')
    expect(r.prazo).toEqual({ tipo: 'provisorio', ate: '04/11' })
    expect(r.aplicar).toEqual({ variant_id: B, letra: 'B' })
    expect(r.noAr).toEqual({ tipo: 'original' })
    expect(r.voltar).toBe(false)
  })
  it('vencedor final: prazo final, "B vence."', () => {
    const r = concDe(concluido({ provisorio: false }))
    expect(r.frase.principal).toBe('B vence.')
    expect(r.prazo).toEqual({ tipo: 'final' })
  })
  it('aplicado: noAr aplicada B, voltar na janela e não depois', () => {
    const dentro = concDe(concluido({ reason: 'manual_winner', winner: B, applied: '2026-10-25T10:00:00Z', revert: '2026-11-01T10:00:00Z' }))
    expect(dentro.noAr).toEqual({ tipo: 'aplicada', letra: 'B', desfechoMudou: false })
    expect(dentro.voltar).toBe(true); expect(dentro.aplicar).toBeNull()
    const fora = concDe(concluido({ reason: 'manual_winner', winner: B, applied: '2026-10-10T10:00:00Z', revert: '2026-10-17T10:00:00Z' }))
    expect(fora.voltar).toBe(false)
  })
  it('aplicado-mudou (Foco 2): sugerido nulo => desfechoMudou, voltar, sem aplicar', () => {
    const r = concDe(concluido({ desfecho: 'sem_diferenca_detectavel', sugerido: null, reason: 'manual_winner', winner: B, applied: '2026-10-25T10:00:00Z', revert: '2026-11-01T10:00:00Z' }))
    expect(r.noAr).toEqual({ tipo: 'aplicada', letra: 'B', desfechoMudou: true })
    expect(r.selo).toEqual({ tipo: 'sem_diferenca' })
    expect(r.frase.principal).toBe('Agora não há diferença clara; ao encerrar, B parecia melhor.')
    expect(r.voltar).toBe(true); expect(r.aplicar).toBeNull()
  })
  it('aplicado-outra (Y3/◆T 7b): aplicada B e sugerido passou a C', () => {
    const r = concDe(concluido({ vars: VAR3, sugerido: C, reason: 'manual_winner', winner: B, applied: '2026-10-25T10:00:00Z', revert: '2026-11-01T10:00:00Z' }))
    expect(r.noAr).toEqual({ tipo: 'aplicada', letra: 'B', desfechoMudou: true })
    expect(r.frase.principal).toBe('Agora C parece melhor; ao encerrar, B parecia melhor.')
    expect(r.voltar).toBe(true); expect(r.aplicar).toBeNull()
  })
  it('aplicado B e a original passou a vencer (Logan a): "Agora a original parece melhor; ao encerrar, B parecia melhor."', () => {
    const r = concDe(concluido({ sugerido: O, reason: 'manual_winner', winner: B, applied: '2026-10-25T10:00:00Z', revert: '2026-11-01T10:00:00Z' }))
    expect(r.frase.principal).toBe('Agora a original parece melhor; ao encerrar, B parecia melhor.')
  })
  it('M2 (Phil): provisório "vence" com lift <= 0 nas linhas atuais não mostra o CTR contraditório', () => {
    const r = concDe(concluido({ provisorio: true, dias: dias([O, B], 5, 1000, { [B]: 0.04, [O]: 0.046 }) }))
    expect(r.frase.principal).toBe('B provavelmente vence.')
    expect(r.frase.apoio).toBe('Os números mudaram desde a última avaliação; o desfecho é revisto no próximo cron.')
    expect(JSON.stringify(r.frase)).not.toMatch(/vs A|CTR ≈/)
  })
  it('original-vence: sem aplicar, sem lift na frase', () => {
    const r = concDe(concluido({ sugerido: O }))
    expect(r.selo).toEqual({ tipo: 'original' })
    expect(r.frase.principal).toBe('A original se saiu melhor; nada a aplicar.')
    expect(r.frase.apoio).toBe('A original segue no ar.')
    expect(r.aplicar).toBeNull()
  })
  it('sem-diferença', () => {
    const r = concDe(concluido({ desfecho: 'sem_diferenca_detectavel', sugerido: null }))
    expect(r.selo).toEqual({ tipo: 'sem_diferenca' })
    expect(r.frase.principal).toBe('Sem diferença clara entre A e B.')
    expect(r.frase.apoio).toBe('A original segue no ar.')
    expect(r.prazo).toEqual({ tipo: 'final' })
  })
  it('V = 3: "Sem diferença clara entre A, B e C."', () => {
    const r = concDe(concluido({ vars: VAR3, desfecho: 'sem_diferenca_detectavel', sugerido: null }))
    expect(r.frase.principal).toBe('Sem diferença clara entre A, B e C.')
  })
  it('inconclusivo-volume: cita a de menor volume (empate: menor letra)', () => {
    const d = [dia('2026-10-20', O, 300), dia('2026-10-21', O, 100), dia('2026-10-22', B, 400), dia('2026-10-23', B, 400)]
    const r = concDe(concluido({ desfecho: 'inconclusivo_por_volume', sugerido: null, n: 10315, dias: d }))
    expect(r.selo).toEqual({ tipo: 'volume' })
    expect(r.frase.principal).toBe('Faltou volume: A teve 400 de 10.315 impressões.')
    expect(r.frase.apoio).toBe('Este vídeo recebe poucas impressões para decidir. A original segue no ar.')
  })
  it('inconclusivo-dado: variante com menos dias válidos', () => {
    const d = [dia('2026-10-20', O), dia('2026-10-21', O), dia('2026-10-22', O), dia('2026-10-23', O), dia('2026-10-19', B), dia('2026-10-18', B)]
    const r = concDe(concluido({ desfecho: 'inconclusivo_por_dado', sugerido: null, dias: d }))
    expect(r.selo).toEqual({ tipo: 'dado' })
    expect(r.frase.principal).toBe('Faltaram dias medidos: B tem 2 de 4.')
    expect(r.frase.apoio).toBe('O YouTube não enviou o CTR de alguns dias. A original segue no ar.')
  })
  it('inconclusivo-falha: sem prazo', () => {
    const r = concDe(concluido({ desfecho: 'inconclusivo_por_falha', sugerido: null }))
    expect(r.selo).toEqual({ tipo: 'falha' }); expect(r.prazo).toBeNull()
    expect(r.frase.principal).toBe('O teste foi encerrado por segurança, não por resultado.')
    expect(r.frase.apoio).toBe('A original voltou ao ar.')
  })
  it('aguardando', () => {
    const r = concDe(concluido({ desfecho: 'aguardando_alcance', sugerido: null }))
    expect(r.selo).toEqual({ tipo: 'aguardando' }); expect(r.prazo).toBeNull()
    expect(r.frase.principal).toBe('O YouTube ainda não enviou o alcance dos últimos dias.')
    expect(r.frase.apoio).toBe('O desfecho pode mudar quando chegar.')
  })
  it('pendente: sem desfecho', () => {
    const r = concDe(concluido({ desfecho: null, sugerido: null }))
    expect(r.selo).toEqual({ tipo: 'pendente' })
    expect(r.frase.principal).toBe('Calculando o desfecho.')
    expect(r.frase.apoio).toBe('A conta roda uma vez por dia. Volte amanhã.')
  })
  it('pendente: v2 ausente', () => {
    const e = concluido(); e.teste.result_metadata = {}
    expect(concDe(e).selo).toEqual({ tipo: 'pendente' })
  })
  it('ilegível: tentarDeNovo', () => {
    const r = concDe(concluido({ v2: { n: 'x' } }))
    expect(r.selo).toEqual({ tipo: 'ilegivel' }); expect(r.tentarDeNovo).toBe(true)
    expect(r.frase.principal).toBe('Não consegui ler o desfecho deste teste.')
    expect(r.frase.apoio).toBe('Os números abaixo são os gravados. Nada foi alterado.')
    expect(r.pisos).toBeNull(); expect(r.aplicar).toBeNull()
  })
  it('ilegível (Y3): aplicada mantém o texto próprio, sem "parecia melhor"', () => {
    const r = concDe(concluido({ v2: { n: 'x' }, reason: 'regra_v2', winner: B, applied: '2026-10-25T10:00:00Z' }))
    expect(r.frase.principal).toBe('Não consegui ler o desfecho deste teste.')
  })
})

describe('telaV2DoTeste: regras do Phil e do Yannis', () => {
  it('P1: linha de B em enc+1 não entra em régua nem frase', () => {
    const base = [dia('2026-10-20', O), dia('2026-10-21', O), dia('2026-10-22', O), dia('2026-10-23', O),
      dia('2026-10-21', B), dia('2026-10-22', B), dia('2026-10-23', B), dia('2026-10-25', B)]
    const r = concDe(concluido({ desfecho: 'inconclusivo_por_dado', sugerido: null, dias: base, enc: '2026-10-24' }))
    expect(r.pisos?.find(p => p.variant_id === B)?.dias_validos).toBe(3)
    expect(r.frase.principal).toBe('Faltaram dias medidos: B tem 3 de 4.')
  })
  it('P1: volume da régua = o do desfecho (mesmas linhas)', () => {
    const base = [dia('2026-10-23', B, 700), dia('2026-10-25', B, 5000), dia('2026-10-23', O, 900)]
    const r = concDe(concluido({ desfecho: 'inconclusivo_por_volume', sugerido: null, dias: base, n: 10000 }))
    expect(r.pisos?.find(p => p.variant_id === B)?.volume).toBe(700)
  })
  it('P2: lift da frase = ctrDosValidos, e ≈ lift gravado em 3 fixtures', () => {
    for (const [cb, co] of [[0.054, 0.046], [0.07, 0.04], [0.061, 0.05]] as const) {
      const d = dias([O, B], 8, 2000, { [B]: cb, [O]: co })
      const est = estatisticaV2(d, O, [O, B])
      if (est.estado !== 'calculada') throw new Error('sem estatística')
      const gravado = est.por_variante[0]!.lift
      const x = ctrDosValidos(d, [O, B], O)
      expect(Math.round((x[B]!.ctr! / x[O]!.ctr! - 1) * 1000)).toBe(Math.round(gravado * 1000))
      const r = concDe(concluido({ dias: d }))
      const lift = ((x[B]!.lift as number) * 100).toFixed(1).replace('.', ',')
      expect(r.frase.apoio).toContain(`(+${lift}% vs A)`)
    }
  })
  it('◆T 6: lift nulo / CTR nulo / ambos nulos', () => {
    // só B com dia válido: original sem CTR => lift nulo e ctrA nulo
    const soB = [dia('2026-10-20', B, 1000, 0.054)]
    const r1 = concDe(concluido({ dias: soB }))
    expect(r1.frase.apoio).toBeNull()
    const soAB = [dia('2026-10-20', B, 1000, 0.054), dia('2026-10-21', O, 1000, 0)]
    const r2 = concDe(concluido({ dias: soAB }))
    // ctrA = 0 => lift nulo, CTR presente
    expect(r2.frase.apoio).toBe('CTR ≈ 5,4% contra 0,0% de A.')
  })
  it('P3: pulado_drift => desconhecido; em_andamento => desconhecido; tudo ok => desfeita', () => {
    const base = { reason: 'manual_winner', winner: B, applied: null }
    const drift = concDe(concluido({ ...base, restore: { thumbnail: OK({ estado: 'pulado_drift' }) } }))
    expect(drift.noAr).toEqual({ tipo: 'desconhecido' })
    const and = concDe(concluido({ ...base, restore: { thumbnail: OK({ estado: 'em_andamento' }) } }))
    expect(and.noAr).toEqual({ tipo: 'desconhecido' })
    const ok = concDe(concluido({ ...base, restore: { thumbnail: OK() } }))
    expect(ok.noAr).toEqual({ tipo: 'desfeita', letra: 'B', desfechoMudou: false })
  })
  it('Foco 1: aplicada x desfeita só muda com winner_applied_at', () => {
    const b = { reason: 'manual_winner', winner: B, restore: { thumbnail: OK() }, revert: '2026-11-01T00:00:00Z' }
    expect(concDe(concluido({ ...b, applied: '2026-10-25T10:00:00Z' })).noAr.tipo).toBe('aplicada')
    expect(concDe(concluido({ ...b, applied: null })).noAr.tipo).toBe('desfeita')
  })
  it('combo: desfeita exige título e thumbnail ok', () => {
    const e = concluido({ reason: 'manual_winner', winner: B, applied: null, restore: { thumbnail: OK() } })
    e.teste.test_type = 'combo'
    expect(concDe(e).noAr.tipo).toBe('desconhecido')
  })
  it('P6: provisório vencido (enc + 12) => ate null', () => {
    const r = concDe(concluido({ provisorio: true, agora: new Date('2026-11-05T20:00:00Z') }))
    expect(r.prazo).toEqual({ tipo: 'provisorio', ate: null })
    const ultimo = concDe(concluido({ provisorio: true, agora: new Date('2026-11-04T20:00:00Z') }))
    expect(ultimo.prazo).toEqual({ tipo: 'provisorio', ate: '04/11' })
  })
  it('Y5: winner = original, applied nulo => noAr.original, nunca desfeita', () => {
    const r = concDe(concluido({ reason: 'manual_winner', winner: O, applied: null }))
    expect(r.noAr).toEqual({ tipo: 'original' })
  })
  it('M7 T14 D1: sugerida por aplicar + outro teste aberto => bloqueio outro_teste; sem leitura => sem_leitura; sem outro => nulo', () => {
    const com = (outro: boolean | 'sem_leitura') => { const e = concluido(); e.outroTesteAberto = outro; return concDe(e) }
    expect(com(true).bloqueio).toBe('outro_teste')
    expect(com('sem_leitura').bloqueio).toBe('sem_leitura')
    expect(com(false).bloqueio).toBeNull()
  })
  it('M7 T14 D1: aplicada com prazo de voltar aberto + outro teste aberto => bloqueio', () => {
    const e = concluido({ reason: 'manual_winner', winner: B, applied: '2026-10-25T09:00:00Z', revert: '2026-11-25T09:00:00Z' })
    e.outroTesteAberto = true
    const r = concDe(e)
    expect(r.voltar).toBe(true)
    expect(r.bloqueio).toBe('outro_teste')
  })
  describe('selo depois do Voltar (desfeita)', () => {
    const desf = (o: Parameters<typeof concluido>[0] = {}, outro?: boolean | 'sem_leitura') => {
      const e = concluido({ reason: 'manual_winner', winner: B, applied: null, restore: { thumbnail: OK() }, ...o })
      if (outro !== undefined) e.outroTesteAberto = outro
      return concDe(e)
    }
    it('provisório: oferece aplicarDeNovo, frase nova com complemento e CTR no apoio', () => {
      const r = desf({ provisorio: true })
      expect(r.aplicarDeNovo).toEqual({ variant_id: B, letra: 'B' })
      expect(r.bloqueio).toBeNull()
      expect(r.aplicar).toBeNull()
      expect(r.frase.principal).toBe('B ainda parece melhor, mas a original está no ar.')
      expect(r.frase.apoio).toMatch(/^CTR ≈/)
      expect(r.frase.complemento).toBe('Você voltou à original. Pode aplicar B de novo.')
      expect(r.prazo?.tipo).toBe('provisorio')
    })
    it('final: mesmo botão, prazo final', () => {
      const r = desf({ provisorio: false })
      expect(r.aplicarDeNovo).toEqual({ variant_id: B, letra: 'B' })
      expect(r.prazo).toEqual({ tipo: 'final' })
    })
    it('o desfecho mudou de letra: selo atual, sem botão e sem frase nova', () => {
      const r = desf({ desfecho: 'sem_diferenca_detectavel', sugerido: null })
      expect(r.noAr).toEqual({ tipo: 'desfeita', letra: 'B', desfechoMudou: true })
      expect(r.aplicarDeNovo).toBeNull(); expect(r.bloqueio).toBeNull()
      expect(r.frase.complemento).toBeUndefined()
      expect(r.frase.principal).toBe('Sem diferença clara entre A e B.')
    })
    it('o desfecho é outra letra (C): sem botão', () => {
      const r = desf({ vars: VAR3, sugerido: C })
      expect(r.aplicarDeNovo).toBeNull()
    })
    it('outro teste aberto no vídeo: sem botão, bloqueio e apoio sem "Pode aplicar"', () => {
      const r = desf({}, true)
      expect(r.aplicarDeNovo).toBeNull()
      expect(r.bloqueio).toBe('outro_teste')
      expect(r.frase.complemento).toBe('Você voltou à original.')
    })
    it('restore_status não ok: continua desconhecido, sem botão', () => {
      const r = desf({ restore: { thumbnail: OK({ estado: 'pulado_drift' }) } })
      expect(r.noAr.tipo).toBe('desconhecido'); expect(r.aplicarDeNovo).toBeNull()
    })
    it('a consulta falhou (sem_leitura): sem botão, bloqueio próprio e apoio sem "Pode aplicar"', () => {
      const r = desf({}, 'sem_leitura')
      expect(r.aplicarDeNovo).toBeNull()
      expect(r.bloqueio).toBe('sem_leitura')
      expect(r.frase.complemento).toBe('Você voltou à original.')
    })
    it('P5: volta com destino que não é a original: desconhecido, sem botão', () => {
      const r = desf({ restore: { thumbnail: OK({ destino: 'v-b' }) } })
      expect(r.noAr.tipo).toBe('desconhecido'); expect(r.aplicarDeNovo).toBeNull()
    })
    it('aplicada e original: nunca têm aplicarDeNovo', () => {
      expect(concDe(concluido({ reason: 'manual_winner', winner: B, applied: '2026-10-25T10:00:00Z' })).aplicarDeNovo).toBeNull()
      expect(concDe(concluido()).aplicarDeNovo).toBeNull()
    })
  })
  it('aplicar some quando já há winner', () => {
    expect(concDe(concluido({ winner: B })).aplicar).toBeNull()
  })
})

describe('telaV2DoTeste: guarda de fonte', () => {
  it('o módulo não recalcula estatística nem lê ultima_avaliacao', () => {
    const src = fs.readFileSync('src/lib/youtube/ab-gravacao/tela-v2.ts', 'utf8')
    for (const proibido of ['estatisticaV2(', 'decidirV2(', 'desfechoProvisorio(', 'sugeridoV2(', 'ultima_avaliacao']) {
      expect(src).not.toContain(proibido)
    }
  })
})

describe('telaV2DoTeste: escolha do dono (M7b T7)', () => {
  const comEscolha = (o: Parameters<typeof concluido>[0], restore: unknown, historico: import('@/lib/youtube/ab-no-ar').TentativaNoAr[] = []): EntradaTelaV2 => {
    const e = concluido({ vars: VAR3, ...o, restore })
    e.teste.escolha_em = '2026-10-25T10:00:00Z'; e.teste.test_type = 'title'; e.historico = historico
    return e
  }
  const ok = (destino: string) => ({ title: { estado: 'ok', destino, em: '2026-10-25T10:00:00Z', forcado: false, escreveu: true, erro: null, attempts: 0 } })
  it('C escolhida com o vencedor parado em B: no ar = C (aplicada), sem aplicar, sem voltar, sem frase de "ao encerrar"', () => {
    const r = concDe(comEscolha({ winner: B, applied: '2026-10-25T09:00:00Z', revert: '2026-11-01T09:00:00Z', reason: 'manual_winner' }, ok(C)))
    expect(r.noAr).toEqual({ tipo: 'aplicada', letra: 'C', desfechoMudou: true })
    expect(r.aplicar).toBeNull(); expect(r.aplicarDeNovo).toBeNull(); expect(r.voltar).toBe(false)
    expect(r.frase.principal).not.toContain('ao encerrar')
  })
  it('escolha = original: noAr original; sugerida pendente não oferece aplicar', () => {
    const r = concDe(comEscolha({}, ok('o')))
    expect(r.noAr).toEqual({ tipo: 'original' }); expect(r.aplicar).toBeNull()
  })
  it('escolha gravada mas o registro não confirma: desconhecido', () => {
    const r = concDe(comEscolha({}, { title: { estado: 'falhou', destino: C, em: '2026-10-25T10:00:00Z', forcado: false, escreveu: null, erro: null, attempts: 1 } }))
    expect(r.noAr).toEqual({ tipo: 'desconhecido' })
  })
  it('sem escolha, nada muda: sugerida B ainda oferece aplicar', () => {
    const r = concDe(concluido({}))
    expect(r.aplicar).toEqual({ variant_id: B, letra: 'B' })
  })
})
