// @vitest-environment node
/** A5 · E9, Tarefa 3: rótulos das tabelas e o painel "o que some". */
import { describe, it, expect } from 'vitest'
import { ROTULO_DA_TABELA, linhasDoPainel, resumoGuardado, fraseDaVolta, fraseDoPainelDeComentarios } from '@/lib/youtube/observatorio/saiu/rotulos'

const V2 = [
  'competitor_video_versions', 'competitor_video_daily', 'competitor_changes', 'youtube_intelligence_tasks', 'competitor_readings',
  'competitor_field_versions', 'competitor_raw', 'competitor_video_early', 'competitor_video_tier_spans', 'competitor_video_hourly',
  'competitor_hour_fold_log', 'competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_authors',
  'competitor_video_comment_marks', 'competitor_missing_baseline',
]

describe('A5 E9 T3: rótulos', () => {
  it('toda tabela que a V2 lista tem rótulo', () => {
    for (const t of [...V2.filter(x => x !== 'competitor_video_comment_authors'), 'competitor_videos', 'competitor_channels', 'competitor_channel_snapshots', 'competitor_channel_hour_map']) {
      expect(ROTULO_DA_TABELA[t], t).toBeDefined()
    }
  })

  it('a tabela de identidade dos autores entra como registro interno, sem ser nomeada', () => {
    const l = linhasDoPainel({ competitor_video_comment_authors: 5 }, 0)
    expect(l).toHaveLength(1)
    expect(l[0]!.texto).toContain('identidades de autores de comentário')
    expect(l[0]!.texto).toContain('dado pessoal')
    expect(l[0]!.texto).not.toContain('registros internos')
  })

  it('zero é omitido; internas somam numa linha', () => {
    const l = linhasDoPainel({ competitor_videos: 1, competitor_video_daily: 41, competitor_changes: 0, competitor_raw: 4, competitor_field_versions: 3, competitor_missing_baseline: 1 }, 0)
    const textos = l.map(x => x.texto)
    expect(textos.some(t => t.includes('vídeo'))).toBe(true)
    expect(l.find(x => x.texto.includes('dias de views'))?.n).toBe(41)
    expect(textos.some(t => t.includes('mudanças'))).toBe(false)
    const internas = l.filter(x => x.texto.includes('registros internos'))
    expect(internas).toHaveLength(1)
    expect(internas[0].n).toBe(8)
  })

  it('tabela fora do catálogo aparece com o nome', () => {
    const l = linhasDoPainel({ tabela_nova_de_outra_etapa: 3 }, 0)
    expect(l).toEqual([{ n: 3, texto: '3 linhas em tabela_nova_de_outra_etapa' }])
    expect(linhasDoPainel({ tabela_nova_de_outra_etapa: 1 }, 0)[0].texto).toBe('1 linha em tabela_nova_de_outra_etapa')
  })

  it('miniaturas entram como arquivos', () => {
    const l = linhasDoPainel({ competitor_videos: 1 }, 2)
    expect(l.some(x => x.n === 2 && x.texto.includes('arquivo'))).toBe(true)
    expect(linhasDoPainel({ competitor_videos: 1 }, 0).some(x => x.texto.includes('arquivo'))).toBe(false)
  })

  it('resumo guardado em uma linha', () => {
    const s = resumoGuardado({ competitor_videos: 1, competitor_video_daily: 41, competitor_changes: 5 }, 2, { title: 3, thumb: 2, desc: 1 })
    expect(s).toBe('41 dias de views, 3 títulos, 2 miniaturas, 1 descrição, 5 mudanças')
    expect(resumoGuardado({}, 0)).toBe('')
  })

  it('painel de comentários: "3 comentários e 1 resposta do criador"; sem resposta, só "3 comentários"', () => {
    expect(fraseDoPainelDeComentarios(3, 1)).toBe('3 comentários e 1 resposta do criador')
    expect(fraseDoPainelDeComentarios(3, 0)).toBe('3 comentários')
    expect(fraseDoPainelDeComentarios(1, 2)).toBe('1 comentário e 2 respostas do criador')
  })

  it('a resposta "voltar" diz a condição ("se ainda estiver entre os vídeos mais recentes")', () => {
    expect(fraseDaVolta('video')).toContain('se ainda estiver entre os vídeos mais recentes')
    expect(fraseDaVolta('canal')).toBeTruthy()
  })

  it('Phil I-1 (portão 14/10): a frase de comentários que voltaram não promete que serão guardados de novo', () => {
    const f = fraseDaVolta('comentarios')
    expect(f).not.toMatch(/(?<!não )voltam a ser guardados/)
    expect(f).not.toContain('quando aparecerem de novo')
    expect(f).toContain('não voltam')
  })

  it('Phil M-1: competitor_video_marks tem rótulo e não aparece como "linhas em <tabela>"', () => {
    expect(ROTULO_DA_TABELA.competitor_video_marks).toBeDefined()
    expect(linhasDoPainel({ competitor_video_marks: 3 }, 0)[0]!.texto).not.toContain('competitor_video_marks')
  })
})
