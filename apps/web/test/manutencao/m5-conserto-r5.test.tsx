// @vitest-environment jsdom
// Manutenção M5, conserto r5 (27/10): pontos pequenos de Logan r2 e Naksu r2.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { PainelAvisoBanco } from '@/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco/painel'
import { LINHA_DO_DONO, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { montarPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { descreverVermelho } from '@/lib/youtube/observatorio/arquivo-mensal/vermelhos'
import { montarAvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'
import { caso } from '../youtube/observatorio/fixtures/aviso-v2-casos'
import { paginaVazia, mesCom } from '../youtube/observatorio/fixtures/arquivo-pagina'

const liga = { arquivoLigado: true }
const LIDO = new Date('2025-05-03T15:00:00Z')
const itens = [{ item_id: 'item:1', kind: 'video', tempo: 'sem_comando' as const, idadeDias: 3, titulo: null as string | null, desde: LIDO, codigo: 'vid12345' as string | null }]
const t: PendenciasDaTela = { estado: 'com_itens', lidoEm: LIDO, n: 6, maisAntigoDias: 3, itens, linha: LINHA_DO_DONO }
const velho = <T extends { linha: { sealed_at: string | null } }>(m: T): T => { m.linha.sealed_at = new Date(Date.parse('2025-05-03T15:00:00Z') - 10 * 86_400_000).toISOString(); return m }
const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_arquivo/arquivo.css', 'utf8')

describe('1: peça 7 para quem só edita', () => {
  it('sem botão, o resumo diz quem administra o site', () => {
    render(<EsperamComandos t={{ ...t, linha: null }} />)
    expect(screen.getByText(/6 itens esperam quem administra o site; o mais antigo/)).toBeTruthy()
    expect(screen.queryByText(/esperam você rodar/)).toBeNull()
  })
  it('com botão, continua "você rodar os comandos"', () => {
    render(<EsperamComandos t={t} />)
    expect(screen.getByText(/6 itens esperam você rodar os comandos/)).toBeTruthy()
  })
})
describe('2: b2_atrasado diz qual mês e a classe', () => {
  it('um mês selado sem B2 há mais de 7 dias é nomeado', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['b2_atrasado: 1 meses selados não descartados com algum arquivo sem b2_ok_at há mais de 7 dias'], meses: [velho(mesCom({ mesNum: 2, classe: 'horaria' }))] }), liga)
    const f = m.problemas[0]!.frase
    expect(f).toContain('Views por hora')
    expect(f).toMatch(/novembro de 2027/)
    expect(f).toContain('ainda não chegou ao B2')
  })
  it('sem dado para apontar, a frase genérica fica', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['b2_atrasado: 2 meses selados'] }), liga)
    expect(m.problemas[0]!.frase).toBe('Um mês copiado ainda não chegou ao B2 depois de 7 dias. Nada se perde: a cópia do NAS continua. Veja a linha marcada.')
  })
})
describe('3: "o lugar dos dados de" nunca vazio', () => {
  it.each(['tabela_ausente:', 'tabela_ausente:   ', 'tabela_ausente:competitor_raw', 'tabela_ausente:competitor_video_comments', 'tabela_ausente:xyz'])('%s', (b) => {
    const f = descreverVermelho(b).frase
    expect(f).toMatch(/o lugar dos dados de [^\s,][^,]*, que o arquivo copia/)
    expect(f).not.toMatch(/dados de ,|dados de undefined/)
  })
  it('comentários e dado antigo têm o nome que o dono conhece', () => {
    expect(descreverVermelho('tabela_ausente:competitor_raw').frase).toContain('Comentários e dados antigos do YouTube')
  })
})
describe('4: ⓘ com 44 px em toque', () => {
  it('pointer:coarse', () => { expect(css).toMatch(/@media \(pointer:coarse\),\(max-width:600px\)\{[^}]*\.arq-info summary\{[^}]*min-width:44px[^}]*min-height:44px/) })
})
describe('5: vazio com duas linhas dos mesmos meses', () => {
  it('"atraso de cópia" e "mês sem selo" juntos viram uma linha', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['atraso de cópia: 495 arquivos', 'mês sem selo há mais de 30 dias: 50'] }), liga)
    expect(m.problemas.map(p => p.frase)).toEqual(['50 meses estão sem a cópia concluída há mais de 30 dias.'])
  })
  it('sozinho, o atraso de cópia fica', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['atraso de cópia: 3 arquivos'] }), liga)
    expect(m.problemas).toHaveLength(1)
  })
})
describe('6: painel do banco sem <details> dentro de <p>', () => {
  it.each(['v12b', 'v12n'])('%s', (id) => {
    const { container } = render(<PainelAvisoBanco aviso={montarAvisoV2(caso(id))} arquivoHref="/x" />)
    container.querySelectorAll('details').forEach(el => expect(el.closest('p')).toBeNull())
  })
})

describe('M6a T12 r1 (Gio 2, Logan U2): saida_particao_ausente com mês e tabela, agrupado', () => {
  it('um mês: nomeia mês e tabela, não manda liberar nem trazer, cita o código', async () => {
    const { descreverVermelho: d } = await import('@/lib/youtube/observatorio/arquivo-mensal/vermelhos')
    const f = d('saida_particao_ausente:competitor_video_early:2026-10')
    expect(f.frase).toContain('outubro de 2026'); expect(f.frase).toContain('Primeiras horas'); expect(f.frase).toContain('(código: saida_particao_ausente)')
    expect(f.frase).not.toMatch(/ainda não descreve/); expect(f.forma).toBe('octogono')
  })
  it('vários meses da mesma tabela viram uma linha; tabelas diferentes, linhas diferentes', async () => {
    const { agruparVermelhos, descreverVermelho: d } = await import('@/lib/youtube/observatorio/arquivo-mensal/vermelhos')
    const g = agruparVermelhos(['saida_particao_ausente:competitor_video_daily:2026-09', 'saida_particao_ausente:competitor_video_daily:2026-10', 'saida_particao_ausente:competitor_video_hourly:2026-10', 'nas_80: 3'])
    expect(g.length).toBe(3)
    const f = d(g.find(x => x.includes('competitor_video_daily'))!)
    expect(f.frase).toContain('Views por dia'); expect(f.frase).toContain('2 meses'); expect(f.frase).toContain('setembro de 2026'); expect(f.frase).toContain('outubro de 2026')
    expect(g).toContain('nas_80: 3')
  })
})
