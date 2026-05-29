import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'

interface EmptySectionProps {
  sectionLabel: string
  itemCode: string
  sectionKey: string
}

export function EmptySection({ sectionLabel, itemCode, sectionKey }: EmptySectionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-3xl mb-2.5 opacity-30">📝</div>
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--gem-muted)' }}>
        {sectionLabel} ainda não tem conteúdo
      </div>
      <div className="text-xs mb-4 max-w-xs" style={{ color: 'var(--gem-dim)' }}>
        Use o Cowork para gerar o conteúdo inicial ou comece a editar manualmente.
      </div>
      <CoworkDeepLink
        instruction={buildCoworkInstruction('pipeline-empty-section', { section: sectionKey, code: itemCode })}
        variant="button"
        label={`Gerar ${sectionLabel} com Cowork`}
      />
    </div>
  )
}
