// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PecaTirarMes } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes'
import { PecaInterruptor } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor'

const ONLINE = { estado: 'online' as const, faltam: [], descartes: 0, dois_passos: true }
const acoes = () => ({ simular: vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: 10, bytes: null, canais: 1, fracao: 0.1, canalSemUnidade: false } })),
  tirar: vi.fn(async () => ({ ok: true, resposta: { tipo: 'ok' as const, linhas: 10, bytes: null } })), liberar: vi.fn(), trazer: vi.fn() })

describe('peça 3', () => {
  it('94: tirar pede confirmação com foco em Cancelar; só depois chama a ação', async () => {
    const a = acoes()
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }))
    expect(screen.getByRole('dialog', { name: 'Tirar outubro de 2027 do banco online?' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Cancelar')
    expect(a.tirar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco' }))
    await waitFor(() => expect(a.tirar).toHaveBeenCalledWith('competitor_video_daily', '2027-10-01'))
  })
  it('com faltas, o botão de tirar fica desabilitado e as frases aparecem; editor não vê botão', () => {
    const { rerender } = render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={{ ...ONLINE, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 9 }] }} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={acoes()} />)
    expect((screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A forja não confere o B2 há 9 dias.')).toBeTruthy()
    rerender(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin={false} acoes={acoes()} />)
    expect(screen.queryByRole('button', { name: /Tirar/ })).toBeNull()
  })
  it('estado não lido: diz que não leu, sem botão (nunca "pode sair")', () => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={null} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(screen.getByText('Não foi possível ler o estado deste mês. Recarregue a página; esta leitura não mudou nada.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tirar/ })).toBeNull()
  })
})
describe('peça 4 (mínima, M6a)', () => {
  it('não medido: frase de não medido e nenhum botão de ligar', () => {
    render(<PecaInterruptor classe="serie" estado={null} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('Automático: não medido')).toBeTruthy()
    expect(screen.getByText('Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ligar/ })).toBeNull()
  })
  it('nao_pode: mostra o que falta e nenhum botão; com os contadores cheios, diz que o automático chega na próxima etapa', () => {
    const { rerender } = render(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 1, simulacoes: 0 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('Falta: 2 saídas feitas por você (1 de 3) e 2 simulações vistas (0 de 2).')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 3, simulacoes: 2 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('O automático chega na próxima etapa.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('T12: causa, não medido, partição ausente, nota dos descartes', () => {
  const props = { tabela: 'competitor_video_daily', mes: '2027-10-01', hojeSP: '2028-05-02', pctDoBanco: 4, ehAdmin: true as boolean }
  it('falha com causa: a tela mostra a frase da causa e quantos canais faltam; role status para o que não mudou nada', async () => {
    const a = acoes()
    a.tirar = vi.fn(async () => ({ ok: false, error: 'texto do servidor', causa: 'conferencia_parcial' as const, restantes: 3 })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco' }))
    const msg = await screen.findByText(/faltam 3 canais; clique de novo/)
    expect(msg.closest('[role="status"]')).toBeTruthy()
  })
  it('falha de prazo é alerta', async () => {
    const a = acoes()
    a.tirar = vi.fn(async () => ({ ok: false, error: 'x', causa: 'prazo' as const })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco' }))
    const msg = await screen.findByText(/Não foi possível confirmar se o mês saiu/)
    expect(msg.closest('[role="alert"]')).toBeTruthy()
  })
  it('simulação com linhas nulas diz "não medido" e nunca "0 registros"', async () => {
    const a = acoes()
    a.simular = vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: null, bytes: null, canais: 2, fracao: 0.1, canalSemUnidade: false } })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver o que sairia' }))
    const t = await screen.findByText(/registros: não medido/)
    expect(t.textContent).not.toMatch(/\b0 registros/)
    expect(screen.getByText('simulação, nada foi tirado')).toBeTruthy()
  })
  it('partição ausente: frase própria e nenhum botão', () => {
    render(<PecaTirarMes {...props} estado={{ ...ONLINE, particao_ausente: true }} acoes={acoes()} />)
    expect(screen.getByText('A tabela deste mês não existe mais no banco online. Nada foi alterado; recarregue a página para ver o estado.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tirar/ })).toBeNull()
  })
  it('destacado: trazer de volta e liberar (só depois da data); mês descartado com percentual nulo diz não medido', async () => {
    const a = acoes()
    const DEST = { estado: 'destacado' as const, faltam: [], descartes: 1, dois_passos: true, destacado_em: '2028-05-02T15:00:00Z', liberar_a_partir: '2028-05-09' }
    const { rerender } = render(<PecaTirarMes {...props} hojeSP="2028-05-05" estado={DEST} acoes={a} />)
    expect(screen.getByRole('button', { name: 'Trazer de volta' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Liberar o espaço' })).toBeNull()
    expect(screen.getByRole('button', { name: /Liberar o espaço \(disponível em 09\/05\/2028\)/ })).toBeTruthy()
    rerender(<PecaTirarMes {...props} hojeSP="2028-05-09" estado={DEST} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Liberar o espaço' }))
    expect(screen.getByRole('dialog', { name: 'Liberar o espaço de outubro de 2027?' })).toBeTruthy()
    rerender(<PecaTirarMes {...props} pctDoBanco={null} hojeSP="2028-05-20" estado={{ ...DEST, estado: 'descartado', descartado_em: '2028-05-03T17:32:00Z' }} acoes={a} />)
    expect(screen.getByText('Saiu em 03/05/2028 às 14:32. Liberou: não medido')).toBeTruthy()
  })
  it('peça 4: a nota diz "descartes feitos à mão nesta classe" no estado nao_pode', () => {
    render(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 1, simulacoes: 0 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText(/descartes feitos à mão nesta classe/)).toBeTruthy()
  })
})

describe('T12b: o diálogo de tirar', () => {
  const abrir = (extra: Record<string, unknown>) => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} {...extra} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }))
    return screen.getByRole('dialog').textContent ?? ''
  }
  it('sem contagem: "Contado agora, no banco" diz não medido, nunca 0', () => {
    const t = abrir({ contado: null })
    expect(t).toContain('Contado agora, no banco:'); expect(t).toContain('não medido'); expect(t).not.toMatch(/ 0 (canais|registros)/)
  })
  it('com contagem: mostra canais e registros', () => {
    const t = abrir({ contado: { canais: 45, registros: 1234567 } })
    expect(t).toContain('45 canais'); expect(t).toContain('1.234.567 registros')
  })
  it('a data de liberar vem da espera da política; sem espera, não inventa data', () => {
    expect(abrir({ esperaDias: 9 })).toContain('a partir de 11/05/2028')
  })
  it('sem espera conhecida, o diálogo não traz data', () => {
    const t = abrir({ esperaDias: null })
    expect(t).not.toContain('a partir de'); expect(t).toContain('depois da espera da política')
  })
})

describe('M6a T12 r1 (Yannis I-3): data ausente não derruba a peça', () => {
  it('destacado sem liberar_a_partir: renderiza, sem "undefined" nem parênteses vazios', () => {
    const dest = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: null, liberar_a_partir: null }
    const { container } = render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={dest} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(container.textContent).not.toMatch(/undefined|NaN|\(disponível em \)|\/\//)
    expect(screen.getByRole('button', { name: /Liberar o espaço/ })).toBeTruthy()
  })
  it('leitura do mês falhou: diz "ler" e que a leitura não mudou nada', () => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={null} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(screen.getByText('Não foi possível ler o estado deste mês. Recarregue a página; esta leitura não mudou nada.')).toBeTruthy()
  })
})
