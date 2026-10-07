'use client'
import { useState } from 'react'

/**
 * Plano B do convite: quando o e-mail não chega, o org_admin copia o link e
 * manda por outro canal. Se o navegador recusar a área de transferência
 * (contexto não seguro, permissão negada), o link aparece num campo para
 * copiar à mão — nunca um "copiado" falso.
 */
export function CopyInviteLink({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('manual')
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copy} className="text-blue-600 hover:underline">
        Copiar link do convite
      </button>
      {state === 'copied' && (
        <span role="status" className="text-xs text-green-700">
          Link copiado.
        </span>
      )}
      {state === 'manual' && (
        <input
          readOnly
          aria-label="Link do convite"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-72 rounded border border-gray-300 px-2 py-1 text-xs"
        />
      )}
    </span>
  )
}
