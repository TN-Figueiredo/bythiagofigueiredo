'use client'

import type { SourceContentResult } from '@/lib/social/actions/stories'

export type SlideCount = 1 | 3 | 5
export type TemplateStyle = 'gradient' | 'overlay' | 'bold'

interface GenerationOptionsProps {
  selectedContent: SourceContentResult | null
  defaultLocale: string
  supportedLocales: string[]
  locale: string
  slideCount: SlideCount
  templateStyle: TemplateStyle
  isGenerating: boolean
  onLocaleChange: (locale: string) => void
  onSlideCountChange: (count: SlideCount) => void
  onTemplateStyleChange: (style: TemplateStyle) => void
  onGenerate: () => void
  onBack: () => void
}

const SLIDE_COUNT_OPTIONS: Array<{ value: SlideCount; label: string; description: string }> = [
  { value: 1, label: '1 slide', description: 'Apenas capa' },
  { value: 3, label: '3 slides', description: 'Capa + conteúdo + CTA' },
  { value: 5, label: '5 slides', description: 'Capa + 3 conteúdo + CTA' },
]

const TEMPLATE_STYLE_OPTIONS: Array<{ value: TemplateStyle; label: string; description: string }> = [
  { value: 'gradient', label: 'Gradiente', description: 'Fundo em gradiente com a cor primária' },
  { value: 'overlay', label: 'Overlay', description: 'Imagem de capa com overlay escuro' },
  { value: 'bold', label: 'Bold', description: 'Tipografia grande, fundo sólido' },
]

export function GenerationOptions({
  selectedContent,
  defaultLocale,
  supportedLocales,
  locale,
  slideCount,
  templateStyle,
  isGenerating,
  onLocaleChange,
  onSlideCountChange,
  onTemplateStyleChange,
  onGenerate,
  onBack,
}: GenerationOptionsProps) {
  const hasMultipleLocales = supportedLocales.length > 1

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      {/* Selected content summary */}
      {selectedContent && (
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Conteúdo selecionado</p>
          <p className="text-sm font-medium text-neutral-100 line-clamp-2">{selectedContent.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5 capitalize">{selectedContent.type}</p>
        </div>
      )}

      {/* Locale selector (only if multi-locale) */}
      {hasMultipleLocales && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Idioma dos slides
          </label>
          <div className="flex gap-2 flex-wrap">
            {supportedLocales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => onLocaleChange(loc)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  locale === loc
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
                }`}
              >
                {loc}
                {loc === defaultLocale && (
                  <span className="ml-1.5 text-[10px] opacity-60">padrao</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide count selector */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Quantidade de slides
        </label>
        <div className="flex gap-2 flex-wrap">
          {SLIDE_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSlideCountChange(opt.value)}
              className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-colors flex-1 min-w-[100px] ${
                slideCount === opt.value
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-neutral-400 mt-0.5">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Template style selector */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Estilo do template
        </label>
        <div className="flex flex-col gap-2">
          {TEMPLATE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTemplateStyleChange(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                templateStyle === opt.value
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                  templateStyle === opt.value ? 'border-blue-400 bg-blue-400' : 'border-neutral-500'
                }`}
              />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-[11px] text-neutral-400 mt-0.5">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isGenerating}
          className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-700 text-sm font-medium text-neutral-300 hover:border-neutral-500 disabled:opacity-50 transition-colors"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Gerando...
            </>
          ) : (
            'Gerar e Editar'
          )}
        </button>
      </div>
    </div>
  )
}
