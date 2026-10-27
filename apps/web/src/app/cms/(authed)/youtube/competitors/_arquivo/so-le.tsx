'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { OBS_BASE } from '@/lib/youtube/observatorio/links'

/** Quem só lê o site chegou à URL do Arquivo: uma frase e o caminho de volta (mockup A5 da revisão 19-1). Nenhuma leitura do arquivo aconteceu. */
export function SoLe(): ReactElement {
  return (
    <main data-obs-screen="arquivo" className="arq-sole">
      <p>Esta página é de quem edita o site.</p>
      <Link href={OBS_BASE} className="arq-btn">Voltar para Canais</Link>
    </main>
  )
}
