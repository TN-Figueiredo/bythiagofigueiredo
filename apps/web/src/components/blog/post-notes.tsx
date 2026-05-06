import type { BlogStrings } from './_i18n/types'

interface PostNotesProps {
  notes: string[]
  t: BlogStrings
}

export function PostNotes({ notes, t }: PostNotesProps) {
  if (!notes || notes.length === 0) return null

  return (
    <div className="mt-8 pt-6 border-t border-dashed border-[--pb-line]">
      <div className="blog-sidebar-label">{t.notes}</div>
      <ol className="list-none p-0 m-0 space-y-3">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="font-jetbrains text-xs font-bold mt-0.5 w-5 text-center flex-shrink-0"
              style={{ color: 'var(--pb-marker, #FFE37A)' }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: 'var(--pb-ink)' }}>
              {note}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
