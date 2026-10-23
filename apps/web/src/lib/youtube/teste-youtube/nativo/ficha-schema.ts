// Schema de uma versão da ficha. Módulo puro (só zod + helpers sem servidor): o bundle do cliente importa daqui sem arrastar Sentry nem notificações.
import { z } from 'zod'
import { eUrlDaFicha } from './ficha-url'
import { contarCaracteresDoTitulo, LIMITE_TITULO } from './titulo'

export const ORIGENS_IMAGEM = ['teste_nosso', 'retrato_diario', 'ytimg'] as const
export type OrigemImagem = (typeof ORIGENS_IMAGEM)[number]

export const VarianteFichaSchema = z.object({
  n: z.number().int().min(1).max(3),
  tipo: z.enum(['titulo', 'miniatura', 'combo']),
  titulo: z.string().trim().min(1).refine((t) => contarCaracteresDoTitulo(t) <= LIMITE_TITULO, `título acima de ${LIMITE_TITULO} caracteres`).optional(),
  imagem: z.object({
    url: z.string().url().refine(eUrlDaFicha, 'a imagem precisa ser uma cópia da ficha no Blob'),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    largura: z.number().int().positive(),
    altura: z.number().int().positive(),
    origem: z.enum(ORIGENS_IMAGEM).optional(),
    capturada_em: z.string().datetime({ offset: true }).optional(),
  }).strict().optional(),
}).strict()
export type VarianteFicha = z.infer<typeof VarianteFichaSchema>
