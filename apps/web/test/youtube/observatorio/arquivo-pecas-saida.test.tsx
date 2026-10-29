// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { PecaTirarMes } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes'
import { PecaInterruptor } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor'

const ONLINE = { estado: 'online' as const, faltam: [], descartes: 0, dois_passos: true }
const acoes = () => ({ simular: vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: 10, bytes: null, canais: 1, fracao: 0.1, canalSemUnidade: false } })),
  tirar: vi.fn(async () => ({ ok: true, resposta: { tipo: 'ok' as const, linhas: 10, bytes: null } })), liberar: vi.fn(), trazer: vi.fn() })

describe('peça 3', () => {
  it('94: tirar pede confirmação com foco em Cancelar; só depois chama a ação', async () => {
    const a = acoes()
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    expect(screen.getByRole('dialog', { name: 'Esconder outubro de 2027 das telas?' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Cancelar')
    expect(a.tirar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Esconder outubro de 2027 das telas' }))
    await waitFor(() => expect(a.tirar).toHaveBeenCalledWith('competitor_video_daily', '2027-10-01'))
  })
  it('com faltas, o botão de tirar fica desabilitado e as frases aparecem; editor não vê botão', () => {
    const { rerender } = render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={{ ...ONLINE, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 9 }] }} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={acoes()} />)
    expect(screen.getByRole('button', { name: 'Esconder das telas' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('A forja não confere o B2 há 9 dias.')).toBeTruthy()
    rerender(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin={false} acoes={acoes()} />)
    expect(screen.queryByRole('button', { name: /Esconder das telas/ })).toBeNull()
  })
  it('estado não lido: diz que não leu, sem botão (nunca "pode sair")', () => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={null} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(screen.getByText('Não foi possível ler o estado deste mês. Recarregue a página; esta leitura não mudou nada.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Esconder das telas/ })).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esconder outubro de 2027 das telas' }))
    const msg = await screen.findByText(/faltam 3 canais; clique de novo/)
    expect(msg.closest('[role="status"]')).toBeTruthy()
  })
  it('falha de prazo é alerta', async () => {
    const a = acoes()
    a.tirar = vi.fn(async () => ({ ok: false, error: 'x', causa: 'prazo' as const })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esconder outubro de 2027 das telas' }))
    const msg = await screen.findByText(/Não foi possível confirmar se o mês foi escondido/)
    expect(msg.closest('[role="alert"]')).toBeTruthy()
  })
  it('simulação com linhas nulas diz "não medido" e nunca "0 registros"', async () => {
    const a = acoes()
    a.simular = vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: null, bytes: null, canais: 2, fracao: 0.1, canalSemUnidade: false } })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver o que sairia' }))
    const t = await screen.findByText(/registros: não medido/)
    expect(t.textContent).not.toMatch(/\b0 registros/)
    expect(screen.getByText('simulação, nada mudou')).toBeTruthy()
  })
  it('partição ausente: frase própria e nenhum botão', () => {
    render(<PecaTirarMes {...props} estado={{ ...ONLINE, particao_ausente: true }} acoes={acoes()} />)
    expect(screen.getByText('A tabela deste mês não existe mais no banco do site. Nada foi alterado; recarregue a página para ver o estado.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Esconder das telas/ })).toBeNull()
  })
  it('destacado: trazer de volta e liberar (só depois da data); mês descartado com percentual nulo diz não medido', async () => {
    const a = acoes()
    const DEST = { estado: 'destacado' as const, faltam: [], descartes: 1, dois_passos: true, destacado_em: '2028-05-02T15:00:00Z', liberar_a_partir: '2028-05-09' }
    const { rerender } = render(<PecaTirarMes {...props} hojeSP="2028-05-05" estado={DEST} acoes={a} />)
    expect(screen.getByRole('button', { name: 'Mostrar de novo' })).toBeTruthy()
    const antes = screen.getByRole('button', { name: 'Apagar do banco' })
    expect(antes.getAttribute('aria-disabled')).toBe('true')
    expect(document.getElementById(antes.getAttribute('aria-describedby')!)!.textContent).toContain('Disponível a partir de 09/05/2028')
    fireEvent.click(antes)
    expect(screen.queryByRole('dialog')).toBeNull()   // desabilitado não abre o diálogo
    rerender(<PecaTirarMes {...props} hojeSP="2028-05-09" estado={DEST} acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do banco' }))
    expect(screen.getByRole('dialog', { name: 'Apagar outubro de 2027 do banco do site?' })).toBeTruthy()
    rerender(<PecaTirarMes {...props} pctDoBanco={null} hojeSP="2028-05-20" estado={{ ...DEST, estado: 'descartado', descartado_em: '2028-05-03T17:32:00Z' }} acoes={a} />)
    expect(screen.getByText('Apagado do banco em 03/05/2028 às 14:32. Liberou: não medido')).toBeTruthy()
  })
  it('peça 4: a nota diz "descartes feitos à mão nesta classe" no estado nao_pode', () => {
    render(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 1, simulacoes: 0 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText(/descartes feitos à mão nesta classe/)).toBeTruthy()
  })
})

describe('T12b: o diálogo de tirar', () => {
  const abrir = (extra: Record<string, unknown>) => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} {...extra} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    return screen.getByRole('dialog').textContent ?? ''
  }
  it('sem contagem: "Contado agora, no banco" diz não medido, nunca 0', () => {
    const t = abrir({ contado: null })
    expect(t).toContain('Quanto sai'); expect(t).toContain('Nada sai do banco agora'); expect(t).not.toMatch(/ 0 (canais|registros)/)
  })
  it('com contagem: mostra canais e registros', () => {
    const t = abrir({ contado: { canais: 45, registros: 1234567 } })
    expect(t).toContain('45 canais'); expect(t).toContain('1.234.567 registros')
  })
  it('a data de liberar vem da espera da política; sem espera, não inventa data', () => {
    expect(abrir({ esperaDias: 9 })).toContain('A partir de 11/05/2028')
  })
  it('sem espera conhecida, o diálogo não traz data', () => {
    const t = abrir({ esperaDias: null })
    expect(t).not.toContain('A partir de'); expect(t).toContain('depois da espera da política')
  })
})

describe('M6a T12 r1 (Yannis I-3): data ausente não derruba a peça', () => {
  it('destacado sem liberar_a_partir: renderiza, sem "undefined" nem parênteses vazios', () => {
    const dest = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: null, liberar_a_partir: null }
    const { container } = render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={dest} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(container.textContent).not.toMatch(/undefined|NaN|\(disponível em \)|\/\//)
    expect(screen.getByRole('button', { name: /Apagar do banco/ }).getAttribute('aria-disabled')).toBe('true')
  })
  it('leitura do mês falhou: diz "ler" e que a leitura não mudou nada', () => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={null} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(screen.getByText('Não foi possível ler o estado deste mês. Recarregue a página; esta leitura não mudou nada.')).toBeTruthy()
  })
})

describe('M6a T12 layout r4 (mockup 19 B aprovado em 28/10)', () => {
  const props = { tabela: 'competitor_video_early', mes: '2028-01-01', hojeSP: '2028-05-03', pctDoBanco: 4, ehAdmin: true as boolean, nome: 'Primeiras horas' }
  const DEST = { estado: 'destacado' as const, faltam: [], descartes: 1, dois_passos: true, destacado_em: '2028-05-03T15:00:00Z', liberar_a_partir: '2028-05-10' }
  const efeitoDe = (b: HTMLElement): string => document.getElementById(b.getAttribute('aria-describedby')!)!.textContent ?? ''
  it('bloco por tabela: nome no título e código pequeno; passo 1 de 2; cada botão com a linha de efeito ligada por aria-describedby', () => {
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={acoes()} />)
    expect(screen.getByRole('heading', { name: 'Primeiras horas' })).toBeTruthy()
    expect(screen.getByText('competitor_video_early')).toBeTruthy()
    expect(screen.getByText(/Passo 1 de 2:/)).toBeTruthy()
    expect(efeitoDe(screen.getByRole('button', { name: 'Esconder das telas' }))).toContain('Janeiro de 2028 some das telas')
    expect(efeitoDe(screen.getByRole('button', { name: 'Ver o que sairia' }))).toBe('Só calcula canais, registros e % do banco. Nada muda.')
    expect(screen.getByRole('button', { name: 'Esconder das telas' }).className).toContain('pesado')
  })
  it('escondido: passo 2 de 2, aviso ▲ fixo, régua com os dois nomes, ⓘ só junto de "Apagar do banco"', () => {
    render(<PecaTirarMes {...props} estado={DEST} acoes={acoes()} />)
    expect(screen.getByText(/Passo 2 de 2:/)).toBeTruthy()
    expect(screen.getByText(/Escondido, ainda não apagado \(desde 03\/05\/2028\)/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Escondido das telas: feito; Apagado do banco: ainda não/ })).toBeTruthy()
    const infos = screen.getAllByRole('button', { name: 'Como recuperar um mês apagado' })
    expect(infos).toHaveLength(1)
    const apagar = screen.getByRole('button', { name: 'Apagar do banco' })
    expect(apagar.closest('.arq-acao')!.contains(infos[0]!)).toBe(true)
    expect(screen.getByRole('button', { name: 'Mostrar de novo' }).closest('.arq-acao')!.querySelector('.dica-i')).toBeNull()
    expect(apagar.className).not.toContain('pesado')   // desabilitado: mudo, sem peso
  })
  it('foco volta ao botão que abriu o diálogo ao cancelar (botão e Esc)', () => {
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={acoes()} />)
    const b = screen.getByRole('button', { name: 'Esconder das telas' })
    fireEvent.click(b)
    expect(document.activeElement?.textContent).toBe('Cancelar')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(document.activeElement).toBe(b)
    fireEvent.click(b)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(document.activeElement).toBe(b)
  })
  it('diálogo: mês no título e no OK; blocos com título; "banco do site", nunca "banco online"', () => {
    render(<PecaTirarMes {...props} estado={ONLINE} esperaDias={7} acoes={acoes()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    const d = screen.getByRole('dialog', { name: 'Esconder janeiro de 2028 das telas de “Primeiras horas”?' })
    for (const t of ['O que acontece', 'O que continua', 'Como desfazer', 'Enquanto estiver escondido', 'Quanto sai']) expect(d.textContent).toContain(t)
    expect(d.textContent).toContain('A partir de 10/05/2028 o botão “Apagar do banco” fica disponível.')
    expect(screen.getByRole('button', { name: 'Esconder janeiro de 2028 das telas' })).toBeTruthy()
    expect(d.textContent).not.toMatch(/banco online/)
  })
  it('retorno com símbolo: ✓ ok, ▲ aviso, ✕ erro; o erro é alert; a mensagem recebe o foco', async () => {
    const a = acoes()
    a.simular = vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: 1, bytes: null, canais: 1, fracao: 0.01, canalSemUnidade: false } })) as never
    a.tirar = vi.fn(async () => ({ ok: false, error: 'x', causa: 'banco' as const })) as never
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={a} simulacoesExigidas={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver o que sairia' }))
    const sim = await screen.findByText(/Se você apagasse janeiro de 2028 de “Primeiras horas” do banco agora: 1 canal, 1 registro, 1%/)
    expect(sim.closest('[role="status"]')!.textContent).toContain('Conta como 1 das 2 simulações antes do automático.')
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esconder janeiro de 2028 das telas' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toContain('✕')
    expect(msg.textContent).toContain('Não foi possível esconder janeiro de 2028 agora. Nada foi escondido; tente de novo em alguns minutos.')
    await waitFor(() => expect(document.activeElement).toBe(msg))
  })
  it('sucesso de esconder: ✓ com o mês e o nome do dado', async () => {
    render(<PecaTirarMes {...props} estado={ONLINE} acoes={acoes()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Esconder janeiro de 2028 das telas' }))
    const msg = await screen.findByText('Janeiro de 2028 foi escondido das telas de “Primeiras horas”. Ainda não foi apagado do banco.')
    expect(msg.closest('p')!.textContent!.startsWith('✓')).toBe(true)
  })
  it('vocabulário: nenhum nome antigo nas telas (Tirar, Trazer de volta, Liberar o espaço, banco online)', async () => {
    const velho = /Tirar|Trazer de volta|Liberar o espaço|banco online/
    const { container, rerender } = render(<PecaTirarMes {...props} estado={ONLINE} acoes={acoes()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esconder das telas' }))
    expect(container.textContent).not.toMatch(velho)
    rerender(<PecaTirarMes {...props} hojeSP="2028-05-12" estado={DEST} acoes={acoes()} />)
    expect(container.textContent).not.toMatch(velho)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do banco' }))
    expect(container.textContent).not.toMatch(velho)
  })
  it('peça 4: trilho "N de T", ✓ quando cheio e plural certo', () => {
    const { container, rerender } = render(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 1, simulacoes: 2 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByRole('progressbar', { name: 'Saídas feitas por você' }).getAttribute('aria-valuenow')).toBe('1')
    expect(container.querySelectorAll('.arq-trilho.cheio')).toHaveLength(1)   // só as simulações estão cheias
    expect(container.textContent).toContain('✓')
    rerender(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 2, simulacoes: 1 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(container.textContent).toContain('Falta: 1 saída feita por você (2 de 3) e 1 simulação vista (1 de 2).')
  })
})
