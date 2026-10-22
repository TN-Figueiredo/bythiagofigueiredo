// Coordenada padrão do canal (F2 T3): o par (canal, lat/lng a 0,1°) repetido em ≥ 5 vídeos
// é a localização cadastrada do canal, não o lugar do vídeo; a locationDescription dele é ignorada.

const MINIMO_PADRAO = 5

export function chaveDoPar(canal: string, lat: number, lng: number): string {
  return `${canal}|${lat.toFixed(1)}|${lng.toFixed(1)}`
}

export function paresPadrao(
  videos: ReadonlyArray<{ canal: string; lat: number | null; lng: number | null }>,
): Set<string> {
  const contagem = new Map<string, number>()
  for (const v of videos) {
    if (v.lat === null || v.lng === null) continue
    const k = chaveDoPar(v.canal, v.lat, v.lng)
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  const padrao = new Set<string>()
  for (const [k, n] of contagem) if (n >= MINIMO_PADRAO) padrao.add(k)
  return padrao
}
