// @vitest-environment node
/**
 * A5 · E9, Tarefa 11b: "sem resposta o dado fica", parte estática (roda na CI). Varre o código-fonte e as migrations atrás de tudo que apaga
 * de tabela `competitor_*` e exige lista fechada, cada item com a razão ao lado. Quem apaga algo novo muda a lista de propósito.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../../../', import.meta.url))
const MIGRATIONS = join(WEB, '../../supabase/migrations')

function arquivos(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) arquivos(p, ext, acc)
    else if (ext.test(nome)) acc.push(p)
  }
  return acc
}

/** Função SQL → tabelas `competitor_*` de que ela apaga, achadas no texto de todas as migrations. */
export function deletesEmSql(textos: Array<{ arquivo: string; texto: string }>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const { texto } of textos) {
    for (const m of texto.matchAll(/delete\s+from\s+(?:only\s+)?(?:public\.)?(competitor_[a-z_0-9]+)/gi)) {
      const funcoes = [...texto.slice(0, m.index).matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)/gi)]
      const nome = funcoes.length ? funcoes[funcoes.length - 1]![1]! : '(fora de função)'
      if (!out.has(nome)) out.set(nome, new Set())
      out.get(nome)!.add(m[1]!.toLowerCase())
    }
  }
  return out
}

/** `.from('competitor_x')` seguido de `.delete(` em até 6 linhas (a chamada é quebrada em linhas). */
export function deletesEmTs(texto: string): string[] {
  const achados: string[] = []
  for (const m of texto.matchAll(/\.from\(\s*'(competitor_[a-z_0-9]+)'\s*\)/g)) {
    const adiante = texto.slice(m.index! + m[0].length).split('\n').slice(0, 7).join('\n')
    if (/\.delete\(/.test(adiante)) achados.push(m[1]!)
  }
  return achados
}

/** Funções SQL que apagam de `competitor_*`, cada uma com a linha de 9.2 do spec (ou o motivo) que a autoriza. */
const FUNCOES_QUE_APAGAM: Record<string, string> = {
  competitor_video_purge: '9.2 · E9: o dono mandou apagar o vídeo que saiu do YouTube',
  competitor_channel_purge: '9.2 · E9: o dono mandou apagar o canal que saiu do YouTube',
  competitor_comments_purge: '9.2 · E9: o dono mandou apagar comentários listados de um vídeo que saiu do YouTube',
  competitor_comment_identity_purge: '9.2 linha 3/6: a identidade do autor vence em 30 dias (LGPD); não apaga texto nem série',
  competitor_agenda_lease_release: '9.2 linha 3: estado de execução da agenda (MG10); solta o arrendamento',
  competitor_channel_remove_archived: '9.2 linha 2 · E10 MG6: remoção de canal com lote de arquivo confirmado',
  competitor_channel_remove: 'M3b: o dono removeu o canal pelo botão (guardar ou apagar o arquivo); o destino é declarado na mesma transação e o gatilho obs_archive_z_destino_declarado confere',
  obs_archive_channel_archive_impact: 'M3b (falso positivo da varredura): ela não apaga; o delete achado é o do bloco DO que reescreve competitor_channel_remove_archived (declara o destino antes do delete), que vem logo depois dela na migration',
  competitor_channel_delete_unarchived: 'F1 Remover canal: o dono apagou sem guardar um canal com até 30 dias (entrou por engano), com nome digitado e contagens conferidas',
  apply_competitor_comment_snap: 'A5 F2-coleta 7d: resposta de espectador ausente, ou de fio sem resposta do criador, é apagada na mesma transação (nunca passa pela fila nem por competitor_removed_items)',
  competitor_marks_apply: '9.2 · E4 MG4: apaga só de competitor_video_marks e competitor_video_mark_misses, regravando a decisão da própria tarefa',
}

/** Caminhos relativos a `apps/web/`, cada um com a tabela e a razão. */
const TS_QUE_APAGAM: Array<{ arquivo: string; tabela: string; vezes: number; linha: string }> = [
  { arquivo: 'src/lib/youtube/competitor-snapshot-prune.ts', tabela: 'competitor_channel_snapshots', vezes: 1, linha: '9.2 · E9 11a / E10 R-A: retrato diário de canal com mais de 365 dias, menos os de canal ausente' },
  { arquivo: 'src/lib/pipeline/services/forja-queue.ts', tabela: 'competitor_readings', vezes: 2, linha: '9.2: leitura órfã ou incompleta da forja (desfaz gravação)' },
]

const migrations = () => arquivos(MIGRATIONS, /\.sql$/).sort().map(arquivo => ({ arquivo, texto: readFileSync(arquivo, 'utf8') }))

describe('A5 E9 T11b: a varredura enxerga o que procura', () => {
  it('acha as três funções de apagar no arquivo da migration e o del( em saiu/blob.ts', () => {
    const mig = migrations().find(m => m.arquivo.endsWith('_observatorio_a5_e9_apagar_o_que_saiu.sql'))
    expect(mig).toBeDefined()
    const achadas = deletesEmSql([mig!])
    for (const f of ['competitor_video_purge', 'competitor_channel_purge', 'competitor_comments_purge']) expect(achadas.has(f)).toBe(true)
    expect(readFileSync(join(WEB, 'src/lib/youtube/observatorio/saiu/blob.ts'), 'utf8')).toMatch(/\bdel\(/)
  })
  it('um exemplo ruim inventado é pego (SQL e TypeScript)', () => {
    const ruim = deletesEmSql([{ arquivo: 'x.sql', texto: 'create or replace function public.competitor_inventada() returns void as $$ begin delete from public.competitor_video_daily where true; end $$;' }])
    expect([...ruim.keys()]).toEqual(['competitor_inventada'])
    expect(deletesEmTs("await sb\n  .from('competitor_video_daily')\n  .delete()\n  .lt('x', 1)")).toEqual(['competitor_video_daily'])
    expect(deletesEmTs("await sb.from('competitor_videos').select('id')")).toEqual([])
  })
})

describe('A5 E9 T11b: lista fechada do que apaga', () => {
  it('funções SQL que apagam de tabela competitor_*: lista fechada, cada uma com a razão', () => {
    const achadas = [...deletesEmSql(migrations()).keys()].sort()
    expect(achadas).toEqual(Object.keys(FUNCOES_QUE_APAGAM).sort())
    for (const razao of Object.values(FUNCOES_QUE_APAGAM)) expect(razao.length).toBeGreaterThan(10)
  })

  it('todo .delete( sobre tabela competitor_* no TypeScript: lista fechada, cada um com a razão', () => {
    const achados: Record<string, string[]> = {}
    const raiz = join(WEB, 'src')
    for (const arquivo of arquivos(raiz, /\.(ts|tsx)$/)) {
      const tabelas = deletesEmTs(readFileSync(arquivo, 'utf8'))
      if (tabelas.length) achados[relative(WEB, arquivo)] = tabelas.sort()
    }
    const esperado: Record<string, string[]> = {}
    for (const t of TS_QUE_APAGAM) esperado[t.arquivo] = [...(esperado[t.arquivo] ?? []), ...Array(t.vezes).fill(t.tabela)].sort()
    expect(achados).toEqual(esperado)
    for (const t of TS_QUE_APAGAM) expect(existsSync(join(WEB, t.arquivo))).toBe(true)
  })

  it('no TypeScript desta etapa, só blob.ts apaga, e só do Blob', () => {
    const alvos = [
      ...arquivos(join(WEB, 'src/lib/youtube/observatorio/saiu'), /\.(ts|tsx)$/),
      ...arquivos(join(WEB, 'src/app/cms/(authed)/youtube/competitors'), /\.(ts|tsx)$/).filter(a => a.includes('_saiu') || a.includes('/saiu')),
      join(WEB, 'src/lib/youtube/competitor-removed.ts'),
      join(WEB, 'src/lib/youtube/competitor-missing-proof.ts'),
    ]
    expect(alvos.length).toBeGreaterThanOrEqual(8)
    for (const a of alvos) {
      const texto = readFileSync(a, 'utf8')
      expect(texto, relative(WEB, a)).not.toMatch(/\.delete\(/)
      if (!a.endsWith('saiu/blob.ts')) expect(texto, relative(WEB, a)).not.toMatch(/\bdel\(/)
    }
  })

  it('a sincronização e o cron de concorrentes não ganharam delete', () => {
    const alvos = [
      join(WEB, 'src/lib/youtube/competitor-sync.ts'),
      join(WEB, 'src/app/api/cron/sync-youtube/route.ts'),
      ...arquivos(join(WEB, 'src/lib/youtube/agenda'), /\.(ts|tsx)$/),
    ]
    expect(alvos.length).toBeGreaterThan(10)
    for (const a of alvos) expect(readFileSync(a, 'utf8'), relative(WEB, a)).not.toMatch(/\.delete\(/)
  })
})
