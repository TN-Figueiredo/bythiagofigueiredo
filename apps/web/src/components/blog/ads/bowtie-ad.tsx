'use client'

import { useState, type FormEvent } from 'react'
import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function BowtieAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  const [submitted, setSubmitted] = useState(false)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)
  const isForm = creative.interaction === 'form'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        background: creative.brandColor,
        color: '#1A140C',
        transform: 'rotate(-0.25deg)',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          top: -10,
          left: '40%',
          transform: 'rotate(3deg)',
          width: 80,
          height: 18,
          background: 'rgba(255,180,120,0.85)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      />

      <div className="absolute right-3 top-3">
        <DismissButton
          onClick={dismiss}
          color="#1A140C"
          label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        />
      </div>

      <div
        className="font-jetbrains mb-2.5 uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          fontWeight: 600,
          opacity: 0.7,
        }}
      >
        {label}
      </div>

      <div
        className="font-fraunces mb-2.5"
        style={{
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.15,
          textWrap: 'balance',
          letterSpacing: '-0.012em',
        }}
      >
        {creative.title}
      </div>

      <div
        className="font-source-serif"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.85,
          marginBottom: 18,
        }}
      >
        {creative.body}
      </div>

      {isForm && !submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            placeholder={locale === 'pt-BR' ? 'voce@email.com' : 'you@email.com'}
            className="min-w-[200px] flex-1"
            style={{
              padding: '12px 14px',
              fontSize: 14,
              border: '1px solid #1A140C',
              background: '#FFFCEE',
              color: '#1A140C',
              fontFamily: '"Inter", sans-serif',
            }}
          />
          <button
            type="submit"
            className="font-jetbrains cursor-pointer border-none uppercase"
            style={{
              padding: '12px 20px',
              background: '#1A140C',
              color: creative.brandColor,
              fontSize: 11,
              letterSpacing: '0.14em',
              fontWeight: 600,
            }}
          >
            {creative.ctaText}
          </button>
        </form>
      ) : isForm && submitted ? (
        <div
          className="font-source-serif italic"
          style={{
            padding: '12px 16px',
            background: 'rgba(26,20,12,0.08)',
            fontSize: 14,
          }}
        >
          {locale === 'pt-BR'
            ? 'Recebido. Confira sua caixa.'
            : 'Got it. Check your inbox.'}
        </div>
      ) : (
        <a
          href={creative.ctaUrl}
          className="font-jetbrains inline-block uppercase no-underline"
          style={{
            padding: '12px 22px',
            background: '#1A140C',
            color: creative.brandColor,
            fontSize: 11,
            letterSpacing: '0.14em',
            fontWeight: 600,
          }}
        >
          {creative.ctaText}
        </a>
      )}
    </div>
  )
}
