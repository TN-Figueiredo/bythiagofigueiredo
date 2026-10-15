// A5 E18 parte 2, Tarefa 4: fatos do dia pela cobertura (item 202). Puro: sem banco, sem `server-only`.
// Depois da dieta dos metadados diários, um dia coberto pode não ter linha em `yt_own_video_meta_daily` (a linha idêntica às
// vizinhas saiu). Para a derivação de versões, esse dia continua sendo um fato: a cópia da última linha guardada do vídeo.
// Dia sem linha e sem cobertura continua sendo ausência (não se inventa fato).

/** A linha diária que o passo de versões lê (as colunas de `COLUNAS_DIA` de `versoes-step.ts`). */
export interface LinhaDiaria {
  youtube_video_id: string
  day_pt: string
  video_id: string | null
  title_at_capture: string | null
  description_sha256: string | null
  thumbnail_dhash: string | null
  thumbnail_sha256_at_capture: string | null
  thumbnail_blob_url: string | null
  privacy_status: 'public' | 'unlisted' | 'private' | null
  captured_at: string
}

export interface IntervaloMeta {
  youtube_video_id: string
  metric_set: 'meta_texto' | 'meta_thumb'
  covered_from: string
  covered_to: string
}

export interface FatosDoDia {
  linhas: LinhaDiaria[]
  /** Ids (11 caracteres) dos vídeos cuja linha do dia é cópia, não linha real. */
  repetidos: ReadonlySet<string>
  /** Vídeos cobertos no dia, sem linha real e sem última linha para copiar (nunca entram nos fatos). */
  cobertos_sem_linha: number
}

interface Cobertura { texto: boolean; thumb: boolean }

/** `AAAA-MM-DD` comparado como texto: as duas pontas do intervalo contam. */
function coberturaPorVideo(dia: string, cobertura: readonly IntervaloMeta[]): Map<string, Cobertura> {
  const m = new Map<string, Cobertura>()
  for (const i of cobertura) {
    if (i.covered_from > dia || i.covered_to < dia) continue
    const c = m.get(i.youtube_video_id) ?? { texto: false, thumb: false }
    if (i.metric_set === 'meta_texto') c.texto = true
    else c.thumb = true
    m.set(i.youtube_video_id, c)
  }
  return m
}

/** Vídeos cobertos em `dia` (em qualquer dos dois conjuntos) que não têm linha em `dia`. Ordem estável (por id). */
export function videosCobertosSemLinha(dia: string, linhasDoDia: readonly LinhaDiaria[], cobertura: readonly IntervaloMeta[]): string[] {
  const comLinha = new Set(linhasDoDia.map(l => l.youtube_video_id))
  return [...coberturaPorVideo(dia, cobertura).keys()].filter(id => !comLinha.has(id)).sort()
}

/** `ultimas`: por vídeo, a linha mais recente com `day_pt` anterior a `dia`. */
export function fatosDoDia(
  dia: string,
  linhasDoDia: readonly LinhaDiaria[],
  ultimas: ReadonlyMap<string, LinhaDiaria>,
  cobertura: readonly IntervaloMeta[],
): FatosDoDia {
  const porVideo = coberturaPorVideo(dia, cobertura)
  const linhas: LinhaDiaria[] = [...linhasDoDia]
  const repetidos = new Set<string>()
  let coberto_sem_linha = 0
  for (const id of videosCobertosSemLinha(dia, linhasDoDia, cobertura)) {
    const ultima = ultimas.get(id)
    if (ultima === undefined || ultima.day_pt >= dia) { coberto_sem_linha++; continue }
    const c = porVideo.get(id)!
    linhas.push({
      ...ultima,
      day_pt: dia,
      captured_at: ultima.captured_at,
      privacy_status: c.texto ? ultima.privacy_status : null,
      thumbnail_dhash: c.thumb ? ultima.thumbnail_dhash : null,
      thumbnail_sha256_at_capture: c.thumb ? ultima.thumbnail_sha256_at_capture : null,
      thumbnail_blob_url: c.thumb ? ultima.thumbnail_blob_url : null,
    })
    repetidos.add(id)
  }
  return { linhas, repetidos, cobertos_sem_linha: coberto_sem_linha }
}
