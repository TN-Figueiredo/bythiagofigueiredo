'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'cms:highlights-tip-dismissed'

export function HighlightsTip() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  if (dismissed) return null

  return (
    <div className="rounded-xl bg-amber-900/20 border border-amber-800/40 p-4">
      <p className="text-sm font-medium text-amber-200 mb-2">
        Adicionar aos Destaques?
      </p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Instagram não permite gerenciar Destaques via API. Para adicionar:
      </p>
      <ol className="text-xs text-gray-400 mt-2 space-y-1 list-decimal list-inside">
        <li>Abra o Instagram no celular</li>
        <li>Vá no seu perfil → Destaques</li>
        <li>Toque &quot;Novo&quot; ou edite um existente</li>
        <li>Selecione este story</li>
      </ol>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, 'true')
          setDismissed(true)
        }}
        className="mt-3 text-xs text-amber-400 hover:text-amber-300"
      >
        Entendi, não mostrar novamente
      </button>
    </div>
  )
}
