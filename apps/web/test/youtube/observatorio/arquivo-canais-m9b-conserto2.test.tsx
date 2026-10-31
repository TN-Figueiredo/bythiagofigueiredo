// @vitest-environment jsdom
// M9b T7 conserto 2: incerto na peça 7, diálogo (ordem, código, campo), CSS do botão perigo.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { BlocoCanaisRemovidosView } from '@/app/cms/(authed)/youtube/competitors/_arquivo/bloco-canais-removidos'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { montarBloco, type ListaRemovidosV2 } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias, pendenciasParaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

vi.mock('server-only', () => ({}))
const AGORA = Date.parse('2026-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const casa = { estado: 'responde' as const, desde: null, forma: 'visto' as const, frase: '' }
const cap = { comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null, blobsLigados: true }
const iso = (d: number): string => new Date(AGORA - d * D).toISOString()
const linha = (o: Record<string, unknown> = {}): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: REF, estado: 'guardado', decided_at: null,
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: iso(5), removido_via: 'botao',
  primeiro_mes: '2024-10', ultimo_mes: '2025-11', meses: 14, registros: 1, classes: [], ...o }) as ListaRemovidosV2[number]
const pend = { ok: true as const, canais: new Map([[REF, { tempo: 'copiar' as const, falta: null, snapLiberaEm: null, snapBloqueio: null, marcadoRodadoEm: null, b2Nomes: 0 }]]) }
const montar = (ls: ListaRemovidosV2[number][]) => montarBloco(ls, { agora: AGORA, casa, cap, administra: true, pend })
afterEach(cleanup)

describe('diálogo Apagar do arquivo', () => {
  it('Cancelar à esquerda, Apagar à direita; campo sem autocapitalizar nem corrigir', () => {
    render(<BlocoCanaisRemovidosView bloco={montar([linha()])} onApagar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
    const dlg = screen.getByRole('dialog')
    const botoes = Array.from(dlg.querySelectorAll('button')).map(b => b.textContent)
    expect(botoes).toEqual(['Cancelar', 'Apagar do arquivo'])
    const campo = screen.getByLabelText('Nome do canal')
    expect(campo.getAttribute('autocapitalize')).toBe('off')
    expect(campo.getAttribute('spellcheck')).toBe('false')
  })
  it('por nome: diz "Nome confirmado."', () => {
    render(<BlocoCanaisRemovidosView bloco={montar([linha()])} onApagar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
    fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: 'viagem lenta' } })
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toBe('Nome confirmado.')
  })
  it('por código: em minúsculas libera e diz "Código confirmado."', () => {
    render(<BlocoCanaisRemovidosView bloco={montar([linha({ nome: null })])} onApagar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
    const campo = screen.getByLabelText('Código do arquivo')
    fireEvent.change(campo, { target: { value: REF.slice(0, 8).toLowerCase() } })
    const dlg = screen.getByRole('dialog')
    expect(within(dlg).getByRole('status').textContent).toBe('Código confirmado.')
    expect(within(dlg).getAllByRole('button').at(-1)!.getAttribute('aria-disabled')).toBe('false')
  })
})

describe('peça 7: marca velha sem batimento lido', () => {
  it('mostra o texto neutro, sem culpar a forja', () => {
    const l = lerPendencias({ versao: 2, lido_em: new Date(AGORA).toISOString(), total: 1, itens: [{ item_id: `canal:${REF}`, kind: 'canal', tempo: 'apagar_antigas', desde: iso(5), mes: null, channel_ref: REF, youtube_id: null, marcado_rodado_em: iso(2),
      apagar: [{ filho: 'numerico', caminho: 'a/b.csv', sha256: 'a'.repeat(64), nova: null }], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null }] })
    const t = pendenciasParaTela(l, { podeVerComandos: true, agora: new Date(AGORA) })
    if (t.estado !== 'com_itens') throw new Error('fixture')
    const { container } = render(<EsperamComandos t={t} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    const p = container.querySelector('[data-incerto]')
    expect(p?.textContent).toContain('Não sabemos se este item já foi verificado')
    expect(container.textContent).not.toMatch(/forja não responde/)
    expect(container.querySelector('[data-atrasado]')).toBeNull()
  })
})

describe('CSS do botão perigo', () => {
  const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_arquivo/arquivo.css', 'utf8')
  it('hex literal escuro e claro; desabilitado tracejado; sem a regra antiga de opacidade', () => {
    expect(css).toContain('background:#F26B6B')
    expect(css).toContain('[data-theme="light"] .arq-mdl .btn.danger{background:#B42318')
    expect(css).toContain('border:1px dashed var(--border-strong)')
    expect(css).not.toContain('opacity:.8')
  })
})
