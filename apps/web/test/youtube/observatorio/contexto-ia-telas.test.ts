// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 1: o registro das onze telas do botão "Perguntar a uma IA", as regras do pacote e a porta que fecha o
 * "passa em vazio" (página nova em competitors/ sem empacotador). As funções de conferência recebem as listas por parâmetro, para os
 * controles negativos não criarem pasta no disco.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { TELAS_IA, telaExiste } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const WEB = resolve(__dirname, '../../..')
const COMPETITORS = join(WEB, 'src/app/cms/(authed)/youtube/competitors')
const MOCKUP = resolve(WEB, '../../docs/superpowers/mockups/2026-10-13-a5-lote-2/22-perguntar-a-uma-ia')
const PI_DADOS = join(MOCKUP, 'pi-dados.js')

/** Os onze ids da lista do spec (07, 8.1.5), escritos aqui de propósito: o registro não pode redefinir a lista que o confere. */
const ONZE_IDS = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo'] as const

/**
 * Página que existe no disco e ainda não tem empacotador. Nasce vazia (S-I6): quem criar página nova em competitors/ entrega a Tarefa 16
 * no mesmo lote OU acrescenta uma linha aqui, com a pasta, a etapa e a data.
 */
interface PaginaSemEmpacotador { tela: TelaId; pasta: string; etapa: string; desde: string }
// Vazia desde a Tarefa 16 (17/10): a página `saiu/` (Saíram do YouTube, E9) ganhou o empacotador da fila e saiu da lista.
const PAGINA_SEM_EMPACOTADOR: readonly PaginaSemEmpacotador[] = []

type Registro = typeof TELAS_IA

function pastasComPagina(dir: string, base = ''): string[] {
  const saida: string[] = []
  if (!existsSync(dir)) return saida
  if (existsSync(join(dir, 'page.tsx'))) saida.push(base)
  for (const nome of readdirSync(dir).sort()) {
    const caminho = join(dir, nome)
    if (!statSync(caminho).isDirectory()) continue
    saida.push(...pastasComPagina(caminho, base ? `${base}/${nome}` : nome))
  }
  return saida
}

/** (b) toda pasta com page.tsx pertence a uma rota do registro ou é a pasta de uma entrada da lista. */
function pastasSemDono(pastas: readonly string[], entradas: readonly PaginaSemEmpacotador[], registro: Registro): string[] {
  const rotas = new Set(Object.values(registro).map((t) => t.rota).filter((r): r is string => r !== null))
  const daLista = new Set(entradas.map((e) => e.pasta))
  return pastas.filter((p) => !rotas.has(p) && !daLista.has(p))
}

/** Página no disco cuja tela está em espera_a_tela só passa se o id estiver na lista. As duas próprias dividem a rota com tela que existe e não contam. */
function paginasSemSaida(pastas: readonly string[], entradas: readonly PaginaSemEmpacotador[], registro: Registro): string[] {
  const problemas: string[] = []
  const emUso = (rota: string) => Object.values(registro).some((t) => t.rota === rota && t.estado === 'existe')
  for (const [id, t] of Object.entries(registro)) {
    if (t.estado !== 'espera_a_tela' || t.rota === null) continue
    if (emUso(t.rota)) continue
    if (!pastas.includes(t.rota)) continue
    if (entradas.some((e) => e.tela === id && e.pasta === t.rota)) continue
    problemas.push(`${id}: a página existe em competitors/${t.rota} e a tela está em espera_a_tela; entregue a Tarefa 16 ou acrescente uma linha a PAGINA_SEM_EMPACOTADOR`)
  }
  const dono = new Set(Object.values(registro).map((t) => t.rota))
  for (const p of pastas) {
    if (dono.has(p)) continue
    if (entradas.some((e) => e.pasta === p)) continue
    problemas.push(`competitors/${p}: página sem tela no registro e fora de PAGINA_SEM_EMPACOTADOR; entregue a Tarefa 16 ou acrescente uma linha a PAGINA_SEM_EMPACOTADOR`)
  }
  return problemas
}

function entradasInvalidas(pastas: readonly string[], entradas: readonly PaginaSemEmpacotador[], registro: Registro): string[] {
  const problemas: string[] = []
  for (const e of entradas) {
    if (!e.pasta || !e.etapa || !e.desde) problemas.push(`${e.tela}: a entrada precisa de pasta, etapa e data`)
    if (!pastas.includes(e.pasta)) problemas.push(`${e.tela}: a pasta competitors/${e.pasta} não tem page.tsx no disco; tire a entrada`)
    if (registro[e.tela]?.estado === 'existe') problemas.push(`${e.tela}: a tela já está em existe; tire a entrada`)
  }
  return problemas
}

// M5 Tarefa 9: `arquivo/` é página de operação do arquivo mensal (estado de cópia e de limpeza), não leitura de dado de canal: não tem tela no botão
// "Perguntar a uma IA" nem empacotador. Fica fora da conferência de propósito, por nome; página nova de dado continua obrigada a ter dono.
const PAGINAS_FORA_DO_BOTAO: readonly string[] = ['arquivo']
const noDisco = pastasComPagina(COMPETITORS).filter((p) => !PAGINAS_FORA_DO_BOTAO.includes(p))

describe('registro de telas (TELAS_IA)', () => {
  it('os onze ids são os da lista do spec', () => {
    // F2 T8: a décima segunda, `sugestoes`, não vem do mockup 22 (nasce pelo Cowork e pelo Claude Code; a página chegou na F3 T6)
    expect(Object.keys(TELAS_IA).sort()).toEqual([...ONZE_IDS, 'sugestoes'].sort())
    expect(ONZE_IDS).toHaveLength(11)
    expect(TELAS_IA.sugestoes).toMatchObject({ estado: 'existe', rota: 'sugestoes', pedeId: false })
  })

  it('ritmo segue em espera_a_tela e sem rota; a fila saiu com a Tarefa 16 e as duas próprias com as Tarefas 7a e 7b', () => {
    expect(TELAS_IA.ritmo.estado).toBe('espera_a_tela')
    expect(TELAS_IA.ritmo.rota).toBeNull()
    expect(TELAS_IA.fila.estado).toBe('existe')
    expect(TELAS_IA.fila.rota).toBe('saiu')
    expect(TELAS_IA['canal-proprio'].estado).toBe('existe')
    expect(TELAS_IA['video-proprio'].estado).toBe('existe')
    expect(TELAS_IA['canal-proprio'].rota).toBe('canal/[id]')
    expect(TELAS_IA['video-proprio'].rota).toBe('video/[id]')
    for (const id of ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila'] as const) expect(TELAS_IA[id].estado).toBe('existe')
  })

  it('as rotas das telas que existem são as pastas de competitors/', () => {
    const rotas = Object.fromEntries(ONZE_IDS.map((id) => [id, TELAS_IA[id].rota]))
    expect(rotas).toMatchObject({ canais: '', canal: 'canal/[id]', video: 'video/[id]', comparar: 'comparar', outliers: 'outliers', insights: 'insights', mudancas: 'mudancas', fila: 'saiu' })
  })

  it('pedeId só nas telas de canal e de vídeo', () => {
    const pedem = ONZE_IDS.filter((id) => TELAS_IA[id].pedeId).sort()
    expect(pedem).toEqual(['canal', 'canal-proprio', 'video', 'video-proprio'])
  })

  it('o mockup versionado existe (arquivo ausente é falha, não pulo)', () => {
    expect(existsSync(PI_DADOS)).toBe(true)
  })

  it('os nomes e os exemplos batem com pi-dados.js do mockup versionado', () => {
    const fonte = readFileSync(PI_DADOS, 'utf8')
    const janela: { PI?: { TELAS: Record<string, { nome: string; sug: string[] }> } } = {}
    new Function('window', fonte)(janela)
    const telas = janela.PI?.TELAS
    expect(telas, 'pi-dados.js não montou window.PI.TELAS').toBeDefined()
    for (const id of ONZE_IDS) {
      const m = telas?.[id]
      expect(m, `pi-dados.js não tem a tela ${id}`).toBeDefined()
      expect(TELAS_IA[id].nome).toBe(m?.nome)
      expect([...TELAS_IA[id].exemplos]).toEqual(m?.sug)
    }
  })
})

// os controles negativos partem do disco SEM a pasta saiu/ (que existe de verdade e agora é a rota da tela `fila`)
const semSaiu = noDisco.filter((p) => p !== 'saiu')
// o registro de antes da Tarefa 16: a fila sem rota e em espera, para os controles negativos do caso da E9
const REGISTRO_ANTES: Registro = { ...TELAS_IA, fila: { ...TELAS_IA.fila, rota: null, estado: 'espera_a_tela' } }

describe('registro de páginas (S-I6, S-N3)', () => {
  it('toda pasta com page.tsx em competitors/ pertence a uma rota do registro ou é a pasta de uma entrada de PAGINA_SEM_EMPACOTADOR', () => {
    expect(noDisco.length).toBeGreaterThanOrEqual(7) // controle de que o glob olha para alguma coisa
    expect(pastasSemDono(noDisco, PAGINA_SEM_EMPACOTADOR, TELAS_IA)).toEqual([])
  })

  it('controle negativo: uma pasta inventada falha', () => {
    expect(pastasSemDono([...noDisco, 'pasta-inventada'], [], TELAS_IA)).toEqual(['pasta-inventada'])
  })

  it('página no disco com a tela em espera_a_tela só passa se o id estiver em PAGINA_SEM_EMPACOTADOR, com pasta, etapa e data', () => {
    expect(paginasSemSaida(noDisco, PAGINA_SEM_EMPACOTADOR, TELAS_IA)).toEqual([])
    expect(entradasInvalidas(noDisco, PAGINA_SEM_EMPACOTADOR, TELAS_IA)).toEqual([])
  })

  it('controle negativo: uma pasta saiu/ de mentira, fora da lista, falha com a mensagem das duas saídas', () => {
    const msgs = paginasSemSaida([...semSaiu, 'saiu'], [], REGISTRO_ANTES)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('Tarefa 16')
    expect(msgs[0]).toContain('PAGINA_SEM_EMPACOTADOR')
  })

  it('o caso da E9: com a pasta saiu/ de mentira e a entrada de fila, os testes passam sem tocar em L/telas.ts', () => {
    const pastas = [...semSaiu, 'saiu']
    const entradas: PaginaSemEmpacotador[] = [{ tela: 'fila', pasta: 'saiu', etapa: 'E9', desde: '2026-10-13' }]
    expect(pastasSemDono(pastas, entradas, REGISTRO_ANTES)).toEqual([])
    expect(paginasSemSaida(pastas, entradas, REGISTRO_ANTES)).toEqual([])
    expect(entradasInvalidas(pastas, entradas, REGISTRO_ANTES)).toEqual([])
  })

  it('tela em espera_a_tela com rota própria (sem dividir com tela que existe) e página no disco: falha sem a entrada', () => {
    const registro: Registro = { ...TELAS_IA, ritmo: { ...TELAS_IA.ritmo, rota: 'ritmo' } }
    expect(paginasSemSaida([...semSaiu, 'ritmo'], [], registro)).toHaveLength(1)
    expect(paginasSemSaida([...semSaiu, 'ritmo'], [{ tela: 'ritmo', pasta: 'ritmo', etapa: 'E16', desde: '2026-10-13' }], registro)).toEqual([])
  })

  it('entrada em PAGINA_SEM_EMPACOTADOR cuja pasta não tem page.tsx no disco: falha', () => {
    const msgs = entradasInvalidas(semSaiu, [{ tela: 'fila', pasta: 'saiu', etapa: 'E9', desde: '2026-10-13' }], REGISTRO_ANTES)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('não tem page.tsx')
  })

  it('entrada com tela que já está em existe: falha', () => {
    const msgs = entradasInvalidas([...noDisco], [{ tela: 'comparar', pasta: 'comparar', etapa: 'E9', desde: '2026-10-13' }], TELAS_IA)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('já está em existe')
  })

  it('entrada sem etapa ou sem data: falha', () => {
    expect(entradasInvalidas([...noDisco, 'saiu'], [{ tela: 'fila', pasta: 'saiu', etapa: '', desde: '' }], REGISTRO_ANTES)).toHaveLength(1)
  })

  it('PAGINA_SEM_EMPACOTADOR está vazia (a Tarefa 16 tirou a página saiu/ da E9)', () => {
    expect(PAGINA_SEM_EMPACOTADOR).toEqual([])
  })
})

describe('regras e porta de entrada', () => {
  it('RULES.contextoIa é o mesmo objeto de CONTEXTO_IA_RULES', () => {
    expect(RULES.contextoIa).toBe(CONTEXTO_IA_RULES)
  })

  it('os números do plano: 30.000, 200.000, 1.000, 25 e o degrau de linhas', () => {
    expect(CONTEXTO_IA_RULES).toMatchObject({ versaoDoFormato: 1, limiteCopia: 30_000, limiteCompleto: 200_000, perguntaMax: 1_000, linhasPorLista: 25, magroAPartirDe: 0.75, consultaMax: 2_000 })
    expect([...CONTEXTO_IA_RULES.degrausDeLinhas]).toEqual([25, 10, 5, 3, 1, 0])
  })

  it('ligado nasce false (vira true só no commit do envio, Tarefa 15)', () => {
    expect(CONTEXTO_IA_RULES.ligado).toBe(false)
  })

  it('L/regras.ts não importa rules.ts (ciclo)', () => {
    const fonte = readFileSync(join(WEB, 'src/lib/youtube/observatorio/contexto-ia/regras.ts'), 'utf8')
    expect(fonte).not.toMatch(/from\s+['"][^'"]*rules['"]/)
    expect(fonte).not.toMatch(/import\s+['"][^'"]*rules['"]/)
  })

  it('telaExiste recusa null, número, "", "__proto__" e "Canais"; aceita os onze', () => {
    for (const ruim of [null, undefined, 3, '', '__proto__', 'constructor', 'toString', 'Canais', {}, []]) expect(telaExiste(ruim)).toBe(false)
    for (const id of ONZE_IDS) expect(telaExiste(id)).toBe(true)
  })
})
