import { DHASH_MAX_SAME, hamming, sameThumb } from './dhash'
import type { ComparacaoImagem, ImagemComparavel } from './tipos'

/** Corpo cinza que o YouTube devolve em 404 (F9): nunca é prova de nada. */
export const IMAGEM_PADRAO_YT = '400e716969691648'

const HEX16 = /^[0-9a-f]{16}$/

/** Classe de comparação `variante|largura×altura` (F11); null com dimensão nula. */
export function classeDe(m: ImagemComparavel): string | null {
  if (m.largura === null || m.altura === null) return null
  return `${m.variante}|${m.largura}x${m.altura}`
}

/**
 * Invólucro de `sameThumb` (não alias): guarda a classe, o hex minúsculo de 16 caracteres e o cinza do 404 antes de delegar.
 * Com limiar diferente do padrão compara por `hamming` direto (a fonte do limiar e do hamming continua única).
 */
export function mesmaImagem(a: ImagemComparavel, b: ImagemComparavel, dhashMaxSame: number = DHASH_MAX_SAME): ComparacaoImagem {
  const ca = classeDe(a)
  const cb = classeDe(b)
  if (ca === null || cb === null || ca !== cb) return 'incomparavel'
  const da = a.dhash
  const db = b.dhash
  if (da === null || db === null || !HEX16.test(da) || !HEX16.test(db)) return 'incomparavel'
  if (hamming(da, IMAGEM_PADRAO_YT) <= dhashMaxSame || hamming(db, IMAGEM_PADRAO_YT) <= dhashMaxSame) return 'incomparavel'
  const mesma = dhashMaxSame === DHASH_MAX_SAME ? sameThumb(da, db) : hamming(da, db) <= dhashMaxSame
  return mesma ? 'mesma' : 'diferente'
}

/** ETag numérico de 9–11 dígitos = instante de envio (segundos); senão null. */
export function instanteDoEtag(etag: string | null): string | null {
  if (etag === null) return null
  const v = etag.replace(/^W\//, '').replace(/^"|"$/g, '')
  if (!/^\d{9,11}$/.test(v)) return null
  const n = Number(v)
  if (!(n > 0)) return null
  return new Date(n * 1000).toISOString()
}
