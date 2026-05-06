'use client'

interface StructuredFieldsProps {
  keyPoints: string[]
  onKeyPointsChange: (points: string[]) => void
  pullQuote: string
  onPullQuoteChange: (quote: string) => void
  notes: string[]
  onNotesChange: (notes: string[]) => void
  colophon: string
  onColophonChange: (colophon: string) => void
}

function OrderedListField({
  label,
  hint,
  items,
  onChange,
  indexColor = '#818cf8',
}: {
  label: string
  hint?: string
  items: string[]
  onChange: (items: string[]) => void
  indexColor?: string
}) {
  const addItem = () => onChange([...items, ''])
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, val: string) => {
    const next = [...items]
    next[i] = val
    onChange(next)
  }

  return (
    <div className="mb-6">
      <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal font-normal text-neutral-500">{hint}</span>}
      </label>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full border border-dashed border-neutral-700 rounded-lg py-3 text-xs text-neutral-400 hover:border-indigo-500 transition-colors"
        >
          + Adicionar
        </button>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="font-mono text-xs font-bold mt-2 w-5 text-center flex-shrink-0"
                style={{ color: indexColor }}
              >
                {i + 1}
              </span>
              <input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="flex-1 bg-transparent border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-red-400/60 hover:text-red-400 text-xs mt-2"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-xs text-neutral-400 hover:text-indigo-400 transition-colors"
          >
            + Adicionar item
          </button>
        </div>
      )}
    </div>
  )
}

export function StructuredFields(props: StructuredFieldsProps) {
  return (
    <div className="mt-8 pt-8 border-t border-neutral-800">
      <OrderedListField
        label="Pontos-chave"
        items={props.keyPoints}
        onChange={props.onKeyPointsChange}
        indexColor="#818cf8"
      />

      <div className="mb-6">
        <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
          Citação
        </label>
        <input
          value={props.pullQuote}
          onChange={(e) => props.onPullQuoteChange(e.target.value)}
          placeholder="Uma frase marcante do post..."
          className="w-full bg-transparent border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 italic outline-none focus:border-indigo-500"
        />
      </div>

      <OrderedListField
        label="Notas"
        items={props.notes}
        onChange={props.onNotesChange}
        indexColor="#FFE37A"
      />

      <div className="mb-6">
        <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
          Colofão
          <span className="ml-2 normal-case tracking-normal font-normal text-neutral-500">
            ferramentas, processo, créditos
          </span>
        </label>
        <input
          value={props.colophon}
          onChange={(e) => props.onColophonChange(e.target.value)}
          className="w-full bg-transparent border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  )
}
