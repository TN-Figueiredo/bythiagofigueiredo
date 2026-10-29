// @vitest-environment node
/** Emenda da peça 7 (M3b, D-F24): o script impresso confere antes de apagar, é idempotente e não roda cortado. */
import { describe, it, expect, beforeEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scriptDasPendencias, FRASE_DA_FALTA, FRASE_DO_MOTIVO, type CopiaPreparada } from '@/lib/youtube/observatorio/arquivo/pendencias-script'
import { lerPendencias, FALTAS, MOTIVOS } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const sha = (t: string) => createHash('sha256').update(t).digest('hex')
let raiz: string, M: string, bin: string
function falso(nome: string, corpo: string) { const p = join(bin, nome); writeFileSync(p, `#!/bin/bash\n${corpo}\n`); chmodSync(p, 0o755) }
beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'obs-pend-')); M = join(raiz, 'escrita'); bin = join(raiz, 'bin')
  mkdirSync(join(M, 'texto', 'texto', '2026-10'), { recursive: true }); mkdirSync(bin)
  writeFileSync(join(M, 'texto', '.arquivo-vivo'), '')
  writeFileSync(join(M, 'texto', 'texto', '2026-10', 'v1.csv.gz'), 'ANTIGA')
  writeFileSync(join(M, 'texto', 'texto', '2026-10', 'v2.csv.gz'), 'NOVA')
  falso('hostname', 'echo "${HOST_FALSO:-forja}"')
  falso('mountpoint', '[ -z "${SEM_MONTAGEM:-}" ] && [ -d "$2" ]')
  falso('sha256sum', 'command -p shasum -a 256 "$@" 2>/dev/null || command -p sha256sum "$@"')
  falso('flock', '[ -z "${TRAVA_OCUPADA:-}" ]')   // o flock de verdade é da forja (Linux); aqui só a decisão
  writeFileSync(join(raiz, 'copiador.lock'), '')
})
const leitura = (sha1 = sha('ANTIGA'), sha2 = sha('NOVA')) => lerPendencias({ versao: 2, lido_em: '2026-12-01T10:00:00Z', total: 1, itens: [{
  item_id: 'item:42', kind: 'comentario', tempo: 'apagar_antigas', desde: '2026-10-25T12:00:00Z', mes: '2026-10', channel_ref: null, youtube_id: null,
  marcado_rodado_em: null, b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null,
  apagar: [{ filho: 'texto', caminho: 'texto/2026-10/v1.csv.gz', sha256: sha1, nova: { caminho: 'texto/2026-10/v2.csv.gz', sha256: sha2 } }] }] })
function rodarNaForja(linhas: string[], env: Record<string, string> = {}) {
  return spawnSync('bash', ['-s'], { input: linhas.join('\n') + '\n', encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: raiz, ARQ_MONTAGEM_ESCRITA: M, ARQ_TRAVA_COPIADOR: join(raiz, 'copiador.lock'), ...env } })
}
const gerar = (l = leitura()) => { if (!l.ok) throw new Error(l.porque); const s = scriptDasPendencias(l, { versao: 't' }); if (!s.ok) throw new Error(s.porque); return s.linhas }
const beforeCorte = () => writeFileSync(join(M, 'texto', 'texto', '2026-10', 'v1.csv.gz'), 'ANTIGA')
const antiga = () => existsSync(join(M, 'texto', 'texto', '2026-10', 'v1.csv.gz'))
const dito = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr   // invariante do dono: toda execução diz OBS-ARQUIVO:
const espera = (n: number) => lerPendencias({ versao: 2, lido_em: '2026-12-01T10:00:00Z', total: n, itens: ['sem_comando', 'conferir_b2', 'bloqueado'].slice(0, n).map((tempo, i) => ({
  item_id: `canal:6f1c1b9e-0000-4000-8000-00000000000${i + 1}`, kind: 'canal', tempo, desde: '2026-10-01T12:00:00Z', mes: null,
  channel_ref: `6f1c1b9e-0000-4000-8000-00000000000${i + 1}`, youtube_id: null, marcado_rodado_em: null, apagar: [], b2_nomes: tempo === 'conferir_b2' ? ['site/texto/x.csv.gz.bin'] : [], falta: tempo === 'sem_comando' ? 'snapshots' : null, motivo: tempo === 'bloqueado' ? 'depende_m10b' : null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null })) })

/** Leitura montada à mão, sem passar pelo leitor: prova que o SCRIPT sozinho barra o que o leitor também barra (defesa em profundidade). */
const crua = (antigaCam: string, novaCam: string, shaAntiga = sha('NOVA'), shaNova = sha('NOVA')) => ({ ok: true as const, lidoEm: new Date('2026-12-01T10:00:00Z'), itens: [{
  itemId: 'item:42', kind: 'comentario' as const, tempo: 'apagar_antigas' as const, desde: new Date('2026-10-25T12:00:00Z'), mes: '2026-10', channelRef: null, youtubeId: null,
  marcadoRodadoEm: null, b2Nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshotMaisAntigo: null, apagar: [{ filho: 'texto' as const, caminho: antigaCam, sha256: shaAntiga, nova: { caminho: novaCam, sha256: shaNova } }] }] })
const nova = () => existsSync(join(M, 'texto', 'texto', '2026-10', 'v2.csv.gz'))

describe('o script impresso, na forja', () => {
  it.each([['mesmo caminho', 'texto/2026-10/v2.csv.gz'], ['variante com //', 'texto//2026-10/v2.csv.gz']])('antiga e nova são o mesmo arquivo (%s): PULADO, status 1, a única cópia fica (Phil I1)', (_, antigaCam) => {
    const r = rodarNaForja(gerar(crua(antigaCam, 'texto/2026-10/v2.csv.gz')))
    expect(r.stderr).toContain('PULADO')
    expect(r.stderr).toContain('o mesmo arquivo')
    expect(r.stdout).not.toContain('APAGADO')
    expect(r.status).toBe(1)
    expect(nova()).toBe(true)
  })
  it('caminho antigo ausente em pasta que existe: JA-APAGADO; em pasta que nunca existiu: PULADO, caminho errado (Phil M4)', () => {
    const ok = rodarNaForja(gerar(crua('texto/2026-10/v0.csv.gz', 'texto/2026-10/v2.csv.gz')))
    expect(ok.stdout).toContain('JA-APAGADO texto/texto/2026-10/v0.csv.gz')
    expect(ok.status).toBe(0)
    const errado = rodarNaForja(gerar(crua('texto/2099-01/v1.csv.gz', 'texto/2026-10/v2.csv.gz')))
    expect(errado.stdout).not.toContain('JA-APAGADO')
    expect(errado.stderr).toContain('PULADO texto/texto/2099-01/v1.csv.gz: a pasta não existe')
    expect(errado.status).toBe(1)
  })
  it('corta o script em bytes: nenhum corte sai 0 calado, e nenhum apaga pela metade (Phil M2, Yannis M1)', () => {
    const txt = gerar().join('\n') + '\n'
    const saida: string[] = []
    const inicio = '#!/bin/bash\ntrap '.length   // até aqui o prefixo é só o shebang ou "trap"/"trap " (lista os traps, nada roda): único trecho que sai 0 calado
    for (let k = 0; k <= txt.length; k += k < 600 ? 1 : 7) {
      beforeCorte()
      const r = spawnSync('bash', ['-s'], { input: txt.slice(0, k), encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin`, HOME: raiz, ARQ_MONTAGEM_ESCRITA: M, ARQ_TRAVA_COPIADOR: join(raiz, 'copiador.lock') } })
      const calado = r.status === 0 && !/OBS-ARQUIVO/.test(r.stdout + r.stderr)
      if (calado && k > inicio) saida.push(`k=${k} rc=0 calado`)
      if (k < txt.length - 30 && !antiga()) saida.push(`k=${k} apagou antes do fim`)
    }
    expect(saida).toEqual([])
  }, 120_000)

  it('apaga a antiga conferida e rodar de novo não faz mal', () => {
    const r1 = rodarNaForja(gerar())
    expect(r1.status).toBe(0)
    expect(r1.stdout).toContain('APAGADO texto/texto/2026-10/v1.csv.gz')
    expect(antiga()).toBe(false)
    const r2 = rodarNaForja(gerar())
    expect(r2.status).toBe(0)
    expect(r2.stdout).toContain('JA-APAGADO texto/texto/2026-10/v1.csv.gz')
    expect(dito(r1)).toContain('OBS-ARQUIVO: FEITO')
  })
  it('rm que falha (arquivo continua lá) é PULADO e sai 1, nunca FEITO (Phil I2)', () => {
    falso('rm', 'exit 1')
    const r = rodarNaForja(gerar())
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('PULADO texto/texto/2026-10/v1.csv.gz: o rm falhou')
    expect(dito(r)).not.toContain('FEITO')
    expect(antiga()).toBe(true)
  })
  it('copiador rodando (trava ocupada) ou trava ausente: nada apagado, sai 1, com OBS-ARQUIVO (Phil I8, Yannis M1)', () => {
    const r = rodarNaForja(gerar(), { TRAVA_OCUPADA: '1' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('OBS-ARQUIVO: NÃO RODOU: o copiador está rodando')
    expect(antiga()).toBe(true)
    const r2 = rodarNaForja(gerar(), { ARQ_TRAVA_COPIADOR: join(raiz, 'nao-existe.lock') })
    expect(r2.status).toBe(1)
    expect(r2.stderr).toContain('OBS-ARQUIVO: NÃO RODOU')
    expect(antiga()).toBe(true)
  })
  it('só esperando: não pede a trava, não apaga, status 0, NADA A RODAR AGORA (3 esperando) (Phil M5)', () => {
    const r = rodarNaForja(gerar(espera(3)), { TRAVA_OCUPADA: '1', ARQ_TRAVA_COPIADOR: join(raiz, 'nao-existe.lock') })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('OBS-ARQUIVO: NADA A RODAR AGORA (3 esperando)')
    expect(r.stdout).not.toContain('APAGADO')
  })
  it('os valores vêm entre aspas simples: um item válido não cria arquivo nenhum além dos do beforeEach (Yannis I4)', () => {
    const antes = readdirSync(raiz).sort()
    const l = gerar(espera(1))
    expect(l.join('\n')).toMatch(/echo 'ESPERA canal:/)
    rodarNaForja(l)
    expect(readdirSync(raiz).sort()).toEqual(antes)
  })
  it.each([
    ['antiga com outro conteúdo', () => leitura(sha('OUTRA')), {}],
    ['nova com outro conteúdo', () => leitura(sha('ANTIGA'), sha('OUTRA')), {}],
    ['filho desmontado', () => leitura(), { SEM_MONTAGEM: '1' }],
  ])('%s: PULADO, nada apagado, sai 1', (_, l, env) => {
    const r = rodarNaForja(gerar(l()), env as Record<string, string>)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('PULADO')
    expect(r.stderr).toContain('OBS-ARQUIVO: NÃO TERMINOU')
    expect(antiga()).toBe(true)
  })
  it('sem a sentinela: PULADO', () => {
    spawnSync('rm', [join(M, 'texto', '.arquivo-vivo')])
    expect(rodarNaForja(gerar()).status).toBe(1)
    expect(antiga()).toBe(true)
  })
  it('fora da forja: sai 3 e não apaga', () => {
    const r = rodarNaForja(gerar(), { HOST_FALSO: 'mac-do-dono' })
    expect(r.status).toBe(3)
    expect(r.stderr).toContain('OBS-ARQUIVO: NÃO RODOU: este script roda na forja')
    expect(antiga()).toBe(true)
  })
  it('sem ARQ_MONTAGEM_ESCRITA usa /mnt/arquivo/escrita (aqui ausente): PULADO, nada apagado', () => {
    const r = spawnSync('bash', ['-s'], { input: gerar().join('\n') + '\n', encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin`, HOME: raiz } })
    expect(gerar().join('\n')).toContain('${ARQ_MONTAGEM_ESCRITA:-/mnt/arquivo/escrita}')
    expect(r.status).toBe(1)
    expect(antiga()).toBe(true)
  })
  it.each([1, 2, 5])('cortado %i linha(s) antes do fim: nada roda, sai ≠ 0 e diz incompleto (Phil I1, Yannis I3)', corte => {
    const l = gerar()
    expect(l[l.length - 1]).toBe('}; obs_arquivo_main; exit $?')   // a chamada na mesma linha do }
    const r = rodarNaForja(l.slice(0, l.length - corte))
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('incompleto')   // vem do trap EXIT; se o bash não rodar o trap num erro de sintaxe, este teste acusa
    expect(antiga()).toBe(true)
  })
  it('cortado no meio da última linha: o corpo roda inteiro ou não roda, nunca pela metade', () => {
    const l = gerar()
    const meio = [...l.slice(0, -1), '}; obs_arquivo_main;']   // perdeu só o "exit $?"
    const r = rodarNaForja(meio)
    expect(dito(r)).toContain('OBS-ARQUIVO: FEITO')
    expect(antiga()).toBe(false)
  })
})

// ---- M9 Tarefa 7: versao 2 (copiar, conferir B2, canal, frases) ----
const REF = '6f1c1b9e-0000-4000-8000-000000000001'
const it2 = (o: Record<string, unknown>) => ({ item_id: 'item:42', kind: 'comentario', tempo: 'sem_comando', desde: '2026-10-25T12:00:00Z', mes: '2026-10', channel_ref: null, youtube_id: null,
  marcado_rodado_em: null, apagar: [], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o })
const ler2 = (itens: unknown[]) => { const l = lerPendencias({ versao: 2, lido_em: '2026-12-01T10:00:00Z', total: itens.length, itens }); if (!l.ok) throw new Error(l.porque); return l }
const gerar2 = (itens: unknown[], copias: CopiaPreparada[] = []) => { const s = scriptDasPendencias(ler2(itens), { versao: 't', copias }); if (!s.ok) throw new Error(s.porque); return s.linhas }
const CONTEUDO = 'VERSAO-NOVA-v3\n'.repeat(40)
const copia = (o: Partial<CopiaPreparada> = {}): CopiaPreparada => ({ itemId: 'item:42', filho: 'texto', caminho: 'texto/2026-10/v3.csv.gz', sha256: sha(CONTEUDO), base64: Buffer.from(CONTEUDO).toString('base64'), ...o })
const recebido = () => join(M, 'texto', '_recebendo', 'texto', '2026-10', 'v3.csv.gz')

describe('M9 T7: copiar, apagar e conferir B2 na versao 2', () => {
  const copiar = it2({ tempo: 'copiar' })
  it('copiar grava em _recebendo via .m9-tmp, com o sha conferido', () => {
    const l = gerar2([copiar], [copia()])
    const txt = l.join('\n')
    expect(txt).toContain("grava_recebendo 'texto' 'texto/2026-10/v3.csv.gz' '" + sha(CONTEUDO) + "' <<'OBS-B64'")
    expect(txt).toContain('\nOBS-B64\n')
    expect(txt).toContain('/.m9-tmp/')
    expect(txt).toContain('mv -n')
    const r = rodarNaForja(l)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('GRAVADO texto/_recebendo/texto/2026-10/v3.csv.gz')
    expect(readFileSync(recebido(), 'utf8')).toBe(CONTEUDO)
    expect(readdirSync(join(M, 'texto', '.m9-tmp'))).toEqual([])
    expect(dito(r)).toContain('OBS-ARQUIVO: FEITO (1 gravado(s)')
  })
  it('copiar sem cópia preparada: ESPERA-COPIA, nada gravado, sai 0', () => {
    const r = rodarNaForja(gerar2([copiar]))
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('ESPERA-COPIA item:42')
    expect(existsSync(recebido())).toBe(false)
    expect(dito(r)).toContain('OBS-ARQUIVO: NADA A RODAR AGORA (1 esperando)')
  })
  it('cópia que chega diferente do sha registrado: PULADO, nada em _recebendo, sai 1', () => {
    const r = rodarNaForja(gerar2([copiar], [copia({ sha256: sha('OUTRO') })]))
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('o arquivo chegou diferente')
    expect(existsSync(recebido())).toBe(false)
    expect(readdirSync(join(M, 'texto', '.m9-tmp'))).toEqual([])
  })
  it('script_duas_vezes_idempotente: GRAVADO+APAGADO, depois JA-GRAVADO+JA-APAGADO, código 0, versão nova intacta', () => {
    const apagar = it2({ item_id: 'item:43', tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'texto/2026-10/v1.csv.gz', sha256: sha('ANTIGA'), nova: { caminho: 'texto/2026-10/v2.csv.gz', sha256: sha('NOVA') } }] })
    const l = gerar2([copiar, apagar], [copia()])
    const r1 = rodarNaForja(l)
    expect(r1.status).toBe(0)
    expect(r1.stdout).toContain('GRAVADO texto/_recebendo')
    expect(r1.stdout).toContain('APAGADO texto/texto/2026-10/v1.csv.gz')
    const r2 = rodarNaForja(l)
    expect(r2.status).toBe(0)
    expect(r2.stdout).toContain('JA-GRAVADO texto/_recebendo/texto/2026-10/v3.csv.gz')
    expect(r2.stdout).toContain('JA-APAGADO texto/texto/2026-10/v1.csv.gz')
    expect(sha(readFileSync(recebido(), 'utf8'))).toBe(sha(CONTEUDO))
    expect(sha(readFileSync(join(M, 'texto', 'texto', '2026-10', 'v2.csv.gz'), 'utf8'))).toBe(sha('NOVA'))
  })
  it('arquivo já no caminho final com o mesmo sha: JA-GRAVADO, sem regravar', () => {
    mkdirSync(join(M, 'texto', 'texto', '2026-10'), { recursive: true })
    writeFileSync(join(M, 'texto', 'texto', '2026-10', 'v3.csv.gz'), CONTEUDO)
    const r = rodarNaForja(gerar2([copiar], [copia()]))
    expect(r.stdout).toContain('JA-GRAVADO texto/texto/2026-10/v3.csv.gz')
    expect(existsSync(recebido())).toBe(false)
  })
  it('outro arquivo em _recebendo com nome igual e sha diferente: PULADO, não sobrescreve', () => {
    mkdirSync(join(M, 'texto', '_recebendo', 'texto', '2026-10'), { recursive: true })
    writeFileSync(recebido(), 'OUTRO-CONTEUDO')
    const r = rodarNaForja(gerar2([copiar], [copia()]))
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('já havia outro arquivo')
    expect(readFileSync(recebido(), 'utf8')).toBe('OUTRO-CONTEUDO')
  })
  it('conferir_b2 imprime o painel com o nome do site e a frase fixa, sem nome_b2.py', () => {
    const l = gerar2([it2({ tempo: 'conferir_b2', b2_nomes: ['texto/texto/2026-10/v1.csv.gz', 'numerico/serie/x.csv.gz'] })])
    const r = rodarNaForja(l)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('B2-PAINEL: texto/texto/2026-10/v1.csv.gz')
    expect(r.stdout).toContain('B2-PAINEL: numerico/serie/x.csv.gz')
    expect(r.stdout).toContain('no painel do B2: Buckets > <bucket> > Browse Files, com "mostrar versões" ligado, procure o nome')
    expect(l.join('\n')).not.toContain('nome_b2')
  })
  describe('canal: apaga arquivo a arquivo e o diretório vazio', () => {
    const canalItem = (prefixos: string[]) => it2({ item_id: 'canal:' + REF, kind: 'canal', channel_ref: REF, tempo: 'apagar_antigas', mes: null, prefixos,
      apagar: [{ filho: 'texto', caminho: 'c1/a.csv', sha256: sha('A'), nova: null }, { filho: 'texto', caminho: 'c1/sub/b.csv', sha256: sha('B'), nova: null }] })
    it('arquivos conhecidos apagados e a pasta vazia removida', () => {
      mkdirSync(join(M, 'texto', 'c1', 'sub'), { recursive: true })
      writeFileSync(join(M, 'texto', 'c1', 'a.csv'), 'A'); writeFileSync(join(M, 'texto', 'c1', 'sub', 'b.csv'), 'B')
      const l = gerar2([canalItem(['c1'])])
      expect(l.join('\n')).toContain('find "$d" -xdev -depth -type d -empty -delete')
      const r = rodarNaForja(l)
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('APAGADO texto/c1/a.csv')
      expect(existsSync(join(M, 'texto', 'c1'))).toBe(false)
      expect(r.stdout).not.toContain('RESTA')
    })
    it('arquivo que o site não conhece: a pasta fica e diz RESTA', () => {
      mkdirSync(join(M, 'texto', 'c1', 'sub'), { recursive: true })
      writeFileSync(join(M, 'texto', 'c1', 'a.csv'), 'A'); writeFileSync(join(M, 'texto', 'c1', 'sub', 'b.csv'), 'B'); writeFileSync(join(M, 'texto', 'c1', 'estranho.csv'), 'X')
      const r = rodarNaForja(gerar2([canalItem(['c1'])]))
      expect(r.stdout).toContain('RESTA c1: há arquivo que o site não conhece; use "Ver os comandos" na página do Arquivo')
      expect(existsSync(join(M, 'texto', 'c1', 'estranho.csv'))).toBe(true)
    })
    it('sem montagem: a pasta não é tocada', () => {
      mkdirSync(join(M, 'texto', 'c1', 'vazia'), { recursive: true })
      const r = rodarNaForja(gerar2([canalItem(['c1'])]), { SEM_MONTAGEM: '1' })
      expect(r.status).toBe(1)
      expect(existsSync(join(M, 'texto', 'c1', 'vazia'))).toBe(true)
    })
  })
  it('sem_comando diz o que falta: uma frase própria e não vazia por valor de FALTAS', () => {
    const frases = FALTAS.map(f => {
      const r = rodarNaForja(gerar2([it2({ falta: f })]))
      const linha = r.stdout.split('\n').find(x => x.startsWith('ESPERA item:42: '))
      expect(linha, f).toBeTruthy()
      return linha!.slice('ESPERA item:42: '.length)
    })
    expect(frases.every(f => f.length > 0)).toBe(true)
    expect(new Set(frases).size).toBe(FALTAS.length)
    expect(Object.keys(FRASE_DA_FALTA).sort()).toEqual([...FALTAS].sort())
  })
  it('snapshots acrescenta a data do mais antigo', () => {
    const r = rodarNaForja(gerar2([it2({ falta: 'snapshots', snapshot_mais_antigo: '2026-11-03T15:00:00Z' })]))
    expect(r.stdout).toMatch(/mais antigo: 03\/11 12:00/)
  })
  it('bloqueado diz o motivo: uma frase por valor de MOTIVOS', () => {
    const frases = MOTIVOS.map(m => {
      const r = rodarNaForja(gerar2([it2({ tempo: 'bloqueado', motivo: m })]))
      const linha = r.stdout.split('\n').find(x => x.startsWith('BLOQUEADO item:42: '))
      expect(linha, m).toBeTruthy()
      return linha!
    })
    expect(new Set(frases).size).toBe(MOTIVOS.length)
    expect(Object.keys(FRASE_DO_MOTIVO).sort()).toEqual([...MOTIVOS].sort())
  })
  it('item antiga: (versão superada) apaga a antiga com o mesmo apaga_conferido', () => {
    const v = it2({ item_id: 'antiga:5', kind: 'versao', tempo: 'apagar_antigas', apagar: [{ filho: 'texto', caminho: 'texto/2026-10/v1.csv.gz', sha256: sha('ANTIGA'), nova: { caminho: 'texto/2026-10/v2.csv.gz', sha256: sha('NOVA') } }] })
    const r = rodarNaForja(gerar2([v]))
    expect(r.stdout).toContain('APAGADO texto/texto/2026-10/v1.csv.gz')
  })
})
