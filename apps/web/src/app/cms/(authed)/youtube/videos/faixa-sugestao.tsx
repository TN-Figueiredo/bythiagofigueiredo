import Link from 'next/link'

export function FaixaSugestao({ mostrados, total }: { mostrados: number; total: number }) {
  const texto =
    mostrados === 0
      ? 'Nenhum destes vídeos está neste site'
      : mostrados < total
        ? `Mostrando ${mostrados} de ${total} vídeos da sugestão`
        : `Mostrando ${mostrados} ${mostrados === 1 ? 'vídeo' : 'vídeos'} da sugestão`
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text">
      <span>{texto}</span>
      <Link href="/cms/youtube/videos" className="font-medium underline">
        Ver todos
      </Link>
    </div>
  )
}
