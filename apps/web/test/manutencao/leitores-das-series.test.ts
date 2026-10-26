// apps/web/test/manutencao/leitores-das-series.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { LEITORES_DAS_SERIES, EXCECOES_DE_DATA_FIXA } from '@/lib/youtube/observatorio/arquivo-mensal/leitores-das-series'
import { JANELA_MINIMA_DIAS } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

const RAIZ = resolve(__dirname, '../../../..')
/** `git grep` sai com 1 quando não acha: isso é "lista vazia", não erro. Qualquer outro status propaga. */
function achar(padrao: string, dirs: string[], fora?: string): string[] {  // `fora`: diretório fora do repositório (teste do teste): git grep --no-index nele
  try {
    return execFileSync('git', ['grep', '-l', '-E', fora ? '--no-index' : '--untracked', padrao, '--', ...dirs], { cwd: fora ?? RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch (e) {
    if ((e as { status?: number }).status === 1) return []
    throw e
  }
}
/** Pathspec padrão do git: `*` atravessa `/`, então `dir/*.ts` pega a árvore inteira (conferido em 14/10; `**` não pega os filhos diretos). */
const SO_CODIGO = ['*.ts', '*.tsx']
const DIRS_DE_TELA = ['apps/web/src/app/cms/(authed)/youtube/competitors', 'apps/web/src/lib/youtube/observatorio/medidas-telas']

describe('quem lê as três séries (04 §14.1, item 82)', () => {
  it('todo arquivo que menciona uma das três tabelas está na lista, com o seu tratamento', () => {
    const achados = achar("competitor_video_(daily|early|hourly)", SO_CODIGO.map(g => 'apps/web/src/' + g))
    const lista = new Set(LEITORES_DAS_SERIES.map(l => l.arquivo))
    expect(achados.filter(a => !lista.has(a))).toEqual([])
  })
  it('a lista não cita arquivo que não existe mais', () => {
    for (const l of LEITORES_DAS_SERIES) expect(() => readFileSync(resolve(RAIZ, l.arquivo), 'utf8'), l.arquivo).not.toThrow()
  })
})

describe('janelas e datas fixas (item 83)', () => {
  let DIR_TEMP = '', ARQUIVO_TEMP = ''  // fora de src (Yannis r2 N-9): processo morto não deixa lixo na árvore; criado dentro do teste que usa
  afterEach(() => { if (DIR_TEMP) rmSync(DIR_TEMP, { recursive: true, force: true }); DIR_TEMP = '' })
  it('nenhum arquivo de código de tela escreve 365, 180 ou data de início de coleta, salvo a lista nomeada', () => {
    const achados = achar('\\b(365|180)\\b|2026-10-0[1-3]', DIRS_DE_TELA.flatMap(d => SO_CODIGO.map(g => d + '/' + g)))
    const permitidos = new Set(EXCECOES_DE_DATA_FIXA.map(e => e.arquivo))
    expect(achados.filter(a => !permitidos.has(a))).toEqual([])
  })
  it('toda exceção tem motivo escrito', () => { for (const e of EXCECOES_DE_DATA_FIXA) expect(e.motivo.length, e.arquivo).toBeGreaterThan(30) })
  it('o teste do teste: a busca enxerga um arquivo novo com a data de início', () => {
    DIR_TEMP = mkdtempSync(join(tmpdir(), 'item83-')); ARQUIVO_TEMP = join(DIR_TEMP, '__tmp_item83.ts')
    writeFileSync(ARQUIVO_TEMP, "export const X = '2026-10-02'\n")
    // a mesma função `achar`, com cwd no diretório temporário (fora do repositório, `--no-index`)
    const achados = achar('\\b(365|180)\\b|2026-10-0[1-3]', ['*.ts'], DIR_TEMP)
    expect(achados.some(a => a.endsWith('__tmp_item83.ts'))).toBe(true)
  })
  it('as telas de 180 dias dependem da janela online da política, lida e não escrita', () => {
    expect(JANELA_MINIMA_DIAS.competitor_video_daily).toBeGreaterThanOrEqual(181)
    expect(JANELA_MINIMA_DIAS.competitor_video_hourly).toBeGreaterThanOrEqual(89)
  })
})

describe('comoTrata é verificado, não só registrado (Yannis M-4)', () => {
  const MENCIONA_REGISTRO = /ONLINE_DESDE|onlineDesde|online_since|online_desde|obs_archive|horaria_desde|competitor_hourly_health|SERIES_START|archive_|horasDesde|registro/i
  it('todo valor de comoTrata é um dos quatro', () => {
    for (const l of LEITORES_DAS_SERIES) expect(['janela_por_construcao', 'registro', 'texto_online_desde', 'escritor'], l.arquivo).toContain(l.comoTrata)
  })
  it('quem diz "registro" ou "texto_online_desde" realmente consulta o registro ou o online desde', () => {
    for (const l of LEITORES_DAS_SERIES.filter(x => x.comoTrata === 'registro' || x.comoTrata === 'texto_online_desde')) {
      expect(MENCIONA_REGISTRO.test(readFileSync(resolve(RAIZ, l.arquivo), 'utf8')), l.arquivo).toBe(true)
    }
  })
  it('escritor nunca decide janela: não lê o online desde', () => {
    for (const l of LEITORES_DAS_SERIES.filter(x => x.comoTrata === 'escritor')) {
      expect(/ONLINE_DESDE|onlineDesde|online_since|obs_archive_online/.test(readFileSync(resolve(RAIZ, l.arquivo), 'utf8')), l.arquivo).toBe(false)
    }
  })
  it('as janelas de leitura de ler.ts (120 d da página do site, curva do canal) cabem na garantia da série diária', async () => {
    const { MEASURE_RULES } = await import('@/lib/youtube/observatorio/medidas/regras')
    expect(120).toBeLessThanOrEqual(JANELA_MINIMA_DIAS.competitor_video_daily)
    expect(MEASURE_RULES.curve.windowDays).toBeLessThanOrEqual(JANELA_MINIMA_DIAS.competitor_video_daily)
  })
})

