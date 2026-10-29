// @vitest-environment node
/**
 * M9 Tarefa 2 (sem banco): ninguém recria as funções da E9 ou as do plano da M3b sem a captura da M9 (D-M9-21).
 * Rascunho ainda não é migration: enquanto não há `*_manutencao_m9_*`, o que se exige é que a ÚLTIMA definição de cada função da E9 tenha a âncora
 * em que a injeção da M9 se apoia (N-M9-1c); depois da migration da M9, qualquer recriação posterior tem de trazer a captura (ou o sufixo `_base`).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { M9_SQL } from '../helpers/m9'

const DIR = resolve(__dirname, '../../../../supabase/migrations')
const PLANO = 'docs/superpowers/plans/2026-10-14-manutencao-nas-m9-expurgo-enxuto.md'
const arquivos = readdirSync(DIR).filter(n => n.endsWith('.sql')).sort()
const texto = (n: string): string => readFileSync(resolve(DIR, n), 'utf8')
const m9 = arquivos.find(n => n.includes('_manutencao_m9_'))
const definem = (re: RegExp): string[] => arquivos.filter(n => re.test(texto(n)))

const ANCORAS: Record<string, string> = {
  competitor_video_purge: 'delete from public.competitor_videos v where v.id = p_video;',
  competitor_comments_purge: 'insert into public.competitor_removed_items as r',
  competitor_channel_purge: "if to_regprocedure('public.competitor_channel_remove(uuid,uuid,text,text,uuid)') is not null then",
}

describe('M9 guarda: as funções da E9 e do plano da M3b', () => {
  for (const [nome, ancora] of Object.entries(ANCORAS)) {
    it(`${nome}: a última definição em migration traz a âncora da injeção (conta uma vez)`, () => {
      const lista = definem(new RegExp(`create or replace function public\\.${nome}\\b`, 'i'))
      expect(lista.length, `nenhuma migration define ${nome}; ver ${PLANO}`).toBeGreaterThan(0)
      // a recusa da M3b/M9 injeta por DO sem recriar com `create or replace function`; a última definição "inteira" ainda tem a âncora
      const ultima = texto(lista[lista.length - 1]!)
      const n = ultima.split(ancora).length - 1
      expect(n, `${lista[lista.length - 1]} deve ter a âncora de ${nome} exatamente uma vez (D-M9-21; ${PLANO})`).toBe(1)
    })
  }

  it('depois da migration da M9, recriar vídeo/comentários sem a captura é proibido (D-M9-21)', () => {
    if (!m9) return                                   // rascunho: nada posterior a varrer
    for (const n of arquivos.filter(x => x > m9)) {
      const t = texto(n)
      for (const f of ['competitor_video_purge', 'competitor_comments_purge']) {
        if (new RegExp(`create or replace function public\\.${f}\\b`, 'i').test(t)) {
          expect(t, `${n} recria ${f} sem obs_archive_item_capture; ver ${PLANO}`).toContain('obs_archive_item_capture')
        }
      }
      for (const f of ['obs_archive_plan', 'obs_archive_b2_plan', 'obs_archive_removed_channel_list']) {
        const re = new RegExp(`create or replace function public\\.${f}\\b(?!_base)`, 'i')
        expect(re.test(t), `${n} recria ${f} sem o sufixo _base: mexa na ${f}_base (D-M9-21; ${PLANO})`).toBe(false)
      }
    }
  })

  it('o rascunho: competitor_channel_purge não declara o destino (só competitor_channel_remove declara)', () => {
    const sql = M9_SQL()
    // a injeção no canal só acrescenta a limpeza da watch; nenhum texto injetado grava obs_archive_channel_removals
    const injecao = sql.slice(sql.indexOf("('competitor_channel_purge', 'yt_watch_readings'"))
    expect(injecao).not.toMatch(/insert into public\.obs_archive_channel_removals/i)
    expect(sql).not.toMatch(/\('competitor_channel_purge', 'obs_archive_(?!m9)/)
  })

  it('o rascunho: o helper da recusa cita obs_archive_switch, é volatile e trava em share', () => {
    const sql = M9_SQL()
    const ini = sql.indexOf('create or replace function public.obs_archive_m9_pronto')
    const corpo = sql.slice(ini, sql.indexOf('revoke all on function public.obs_archive_m9_pronto'))
    expect(corpo).toContain('obs_archive_switch')
    expect(corpo).toContain('first_month_at')
    expect(corpo).toContain('armed_at')
    expect(corpo).not.toContain('disarmed_at is')   // não usar disarmed_at (Emenda 24/10)
    expect(corpo).toMatch(/volatile/)
    expect(corpo).toMatch(/lock table public\.obs_archive_switch in share mode/)
  })

  it.skipIf(!!m9)('o rascunho: nenhuma sobra de marcador de md5 depois da troca no helper', () => {
    expect(M9_SQL()).toContain('<<MD5_VIDEO>>')       // o texto cru carrega os marcadores; sqlM9Resolvido troca (a Tarefa 10 troca pelo md5 de produção)
  })
})
