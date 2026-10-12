// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarJanela, type DiaLido } from '@/lib/pipeline/leitura-janela'

const DESDE = '2026-10-13'
// (emenda do portão: S19-I2) 19/10/2026 é segunda-feira: o dia da tarefa semanal da fila da forja.
const seteDias = (): DiaLido[] => ['14', '15', '16', '17', '18', '19', '20'].map(d => ({ dia_sp: `2026-10-${d}`, controle: 12, sem_read: 0, linhas: 12, tarefas_forja: d === '19' ? 1 : 0 }))

describe('montarJanela', () => {
  it('7 dias completos (depois do dia do envio) com controle e nenhuma leitura sem read: fecha, e a recusa pode subir', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 3, sem_read: 0 }, ...seteDias()], { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(7)   // onda 3 (D): o dia de `desde` (parcial) tem linha de controle e mesmo assim não conta
    expect(j.fechada).toBe(true)
    expect(j.frase).toBe('7 dias medidos e nenhuma leitura sem read: a recusa pode subir')
  })
  it('APAGA as linhas de controle de um dos 7 dias: 6 dias medidos de 7, a recusa não sobe, e o dia sai como "não medido" (nunca "limpo")', () => {
    const lidos = seteDias().filter(d => d.dia_sp !== '2026-10-17')
    const j = montarJanela(lidos, { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(6)
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('6 dias medidos de 7: a recusa não sobe')
    expect(j.dias.find(d => d.dia === '2026-10-17')).toMatchObject({ estado: 'nao_medido', motivo: 'sem_linha_de_controle', controle: 0 })
  })
  it('dia só com linhas sem read e nenhuma de controle também é "não medido"', () => {
    const lidos = seteDias().map(d => (d.dia_sp === '2026-10-16' ? { ...d, controle: 0, sem_read: 4 } : d))
    const j = montarJanela(lidos, { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias.find(d => d.dia === '2026-10-16')!.estado).toBe('nao_medido')
    expect(j.fechada).toBe(false)
    expect(j.linhas_sem_read).toBe(4)
  })
  it('dia com falha de gravação no Sentry é "não medido", mesmo com linhas de controle', () => {
    const j = montarJanela(seteDias(), { desde: DESDE, hoje: '2026-10-21', diasComFalha: ['2026-10-18'] })
    expect(j.dias.find(d => d.dia === '2026-10-18')).toMatchObject({ estado: 'nao_medido', motivo: 'falha_de_gravacao' })
    expect(j.frase).toBe('6 dias medidos de 7: a recusa não sobe')
  })
  it('o dia de hoje é "em curso" e não conta, mesmo com controle', () => {
    const j = montarJanela([...seteDias().slice(0, 6), { dia_sp: '2026-10-20', controle: 9, sem_read: 0 }], { desde: DESDE, hoje: '2026-10-20' })
    expect(j.dias.at(-1)).toMatchObject({ dia: '2026-10-20', estado: 'em_curso' })
    expect(j.dias_medidos).toBe(6)
    expect(j.fechada).toBe(false)
  })
  it('7 dias medidos com leitura sem read: fecha, mas a frase manda decidir linha a linha', () => {
    const lidos = seteDias().map(d => (d.dia_sp === '2026-10-15' ? { ...d, sem_read: 2 } : d))
    const j = montarJanela(lidos, { desde: DESDE, hoje: '2026-10-21' })
    expect(j.fechada).toBe(true)
    expect(j.frase).toBe('7 dias medidos; 2 leitura(s) sem read: decidir linha a linha antes da recusa')
  })
  it('nenhuma linha: nada medido, nada concluído', () => {
    const j = montarJanela([], { desde: '2026-10-14', hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(0)
    expect(j.dias.filter(d => d.estado === 'nao_medido')).toHaveLength(7)
    expect(j.frase).toBe('0 dias medidos de 7: a recusa não sobe')
  })

  // (emenda do portão: S19-I2) A recusa nunca sobe sem uma execução real da fila observada dentro da janela.
  it('o cenário do revisor: a segunda-feira da tarefa não foi medida e os outros 7 dias foram: 7 dias medidos, a janela NÃO fecha', () => {
    const lidos: DiaLido[] = [
      { dia_sp: '2026-10-21', controle: 3, sem_read: 0, linhas: 3, tarefas_forja: 0 },
      ...seteDias().map(d => (d.dia_sp === '2026-10-19' ? { ...d, controle: 0, linhas: 0 } : d)),   // a forja rodou em 19/10, mas ninguém leu com read
    ]
    const j = montarJanela(lidos, { desde: DESDE, hoje: '2026-10-22' })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('7 dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe')
    expect(j.dias.find(d => d.dia === '2026-10-19')).toMatchObject({ estado: 'nao_medido', tarefas_forja: 1 })
  })
  it('7 dias medidos e a fila não rodou em nenhum deles: não fecha', () => {
    const j = montarJanela(seteDias().map(d => ({ ...d, tarefas_forja: 0 })), { desde: DESDE, hoje: '2026-10-21' })
    expect(j.fechada).toBe(false)
    expect(j.frase).toBe('7 dias medidos, nenhum com tarefa da forja concluída: a recusa não sobe')
  })
  it('consulta antiga, sem a coluna tarefas_forja: conta como zero, não fecha (dado ausente não é "teve tarefa")', () => {
    const semColuna: DiaLido[] = seteDias().map(({ dia_sp, controle, sem_read }) => ({ dia_sp, controle, sem_read }))
    const j = montarJanela(semColuna, { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
  })
  it('a tarefa caiu num dia com falha de gravação: aquele dia não conta, a janela não fecha', () => {
    const j = montarJanela([{ dia_sp: '2026-10-21', controle: 3, sem_read: 0, tarefas_forja: 0 }, ...seteDias()], { desde: DESDE, hoje: '2026-10-22', diasComFalha: ['2026-10-19'] })
    expect(j.dias_medidos).toBe(7)
    expect(j.dias_com_tarefa).toBe(0)
    expect(j.fechada).toBe(false)
  })
  it('basta um dia medido com tarefa: fecha, e o veredito conta os dois números', () => {
    const j = montarJanela(seteDias(), { desde: DESDE, hoje: '2026-10-21' })
    expect(j).toMatchObject({ dias_medidos: 7, dias_com_tarefa: 1, fechada: true })
  })
  // (emenda do portão: D-M10)
  it('dia que bateu no teto de linhas sai marcado; a decisão não muda', () => {
    const j = montarJanela(seteDias().map(d => (d.dia_sp === '2026-10-16' ? { ...d, linhas: 5000 } : d)), { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias.filter(d => d.teto).map(d => d.dia)).toEqual(['2026-10-16'])
    expect(j.fechada).toBe(true)
  })

  // Onda 3, D (software I2): o dia do envio é parcial por construção.
  it('o dia de desde nunca conta, mesmo com linha de controle: fica "não medido" com o motivo dia_do_envio, e a contagem começa no dia seguinte', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 40, sem_read: 0, linhas: 40, tarefas_forja: 1 }, ...seteDias().slice(0, 6).map(d => ({ ...d, tarefas_forja: 0 }))], { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias[0]).toMatchObject({ dia: DESDE, estado: 'nao_medido', motivo: 'dia_do_envio', controle: 40 })
    expect(j.dias_medidos).toBe(6)
    expect(j.dias_com_tarefa).toBe(0)   // a tarefa do dia do envio também não vale
    expect(j.fechada).toBe(false)
  })
  it('o dia do envio não fecha a janela um dia cedo: 6 dias completos + o dia parcial = 6 medidos, não 7', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 9, sem_read: 0 }, ...seteDias().slice(1)], { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(6)
    expect(j.frase).toBe('6 dias medidos de 7: a recusa não sobe')
  })
  it('leitura sem read no dia do envio ainda conta contra o veredito (só o "medido" é que não vale)', () => {
    const j = montarJanela([{ dia_sp: DESDE, controle: 9, sem_read: 3 }, ...seteDias()], { desde: DESDE, hoje: '2026-10-21' })
    expect(j.linhas_sem_read).toBe(3)
    expect(j.fechada).toBe(true)
    expect(j.frase).toBe('7 dias medidos; 3 leitura(s) sem read: decidir linha a linha antes da recusa')
  })

  // Onda 3, B (dados I-1b): o buraco do disjuntor, no dado.
  it('dia com linha que carrega leituras perdidas é "não medido", mesmo com controle', () => {
    const j = montarJanela(seteDias().map(d => (d.dia_sp === '2026-10-17' ? { ...d, perdidas: 12 } : d)), { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias.find(d => d.dia === '2026-10-17')).toMatchObject({ estado: 'nao_medido', motivo: 'leituras_perdidas', perdidas: 12 })
    expect(j.dias_medidos).toBe(6)
    expect(j.fechada).toBe(false)
  })
  it('perdidas = 0 ou ausente não marca nada', () => {
    const j = montarJanela(seteDias().map(d => ({ ...d, perdidas: 0 })), { desde: DESDE, hoje: '2026-10-21' })
    expect(j.dias_medidos).toBe(7)
  })

  // Onda 3, E (dados I-3 b): "não medido" nunca vira "limpo".
  it('leitura sem read em dia ANTERIOR a desde, mas a partir do envio, conta contra o veredito', () => {
    const j = montarJanela([{ dia_sp: '2026-10-12', controle: 0, sem_read: 9 }, { dia_sp: '2026-10-13', controle: 4, sem_read: 0 }, ...seteDias()], { desde: '2026-10-14', envio: '2026-10-12', hoje: '2026-10-22' })
    expect(j.linhas_sem_read).toBe(9)
    expect(j.sem_read_fora_da_janela).toEqual([{ dia: '2026-10-12', sem_read: 9 }])
    expect(j.frase).not.toMatch(/a recusa pode subir/)
  })
  it('desde posterior ao envio: a janela não fecha, nem com 7 dias medidos e nada sem read, e a frase diz por quê', () => {
    const j = montarJanela(seteDias(), { desde: '2026-10-14', envio: '2026-10-13', hoje: '2026-10-22' })
    expect(j.dias_medidos).toBe(6)   // o 14/10 agora é o dia de desde
    const k = montarJanela([...seteDias(), { dia_sp: '2026-10-21', controle: 3, sem_read: 0, linhas: 3 }], { desde: '2026-10-14', envio: '2026-10-13', hoje: '2026-10-22' })
    expect(k.dias_medidos).toBe(7)
    expect(k.fechada).toBe(false)
    expect(k.frase).toBe('desde (2026-10-14) é posterior ao envio (2026-10-13): as leituras de 2026-10-13 a 2026-10-14 não foram medidas; a recusa não sobe')
  })
  it('desde igual ao envio: nada muda', () => {
    const j = montarJanela(seteDias(), { desde: DESDE, envio: DESDE, hoje: '2026-10-21' })
    expect(j.fechada).toBe(true)
  })
  it('leitura sem read antes do envio é ignorada (o código ainda não estava no ar)', () => {
    const j = montarJanela([{ dia_sp: '2026-10-01', controle: 0, sem_read: 5 }, ...seteDias()], { desde: DESDE, envio: DESDE, hoje: '2026-10-21' })
    expect(j.linhas_sem_read).toBe(0)
  })
})
