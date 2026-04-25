'use client'

import { useState, type FormEvent } from 'react'
import type { AdProps, AdLocaleKey } from './types'
import { useDismissable } from './use-dismissable'
import { DismissButton } from './dismiss-button'

/**
 * Bowtie — newsletter-style inline card.
 * Brand-color solid background, slightly rotated, tape decoration.
 * House ads with kind='newsletter' get an email form; sponsors get a CTA link.
 */
export function BowtieAd({ ad, locale, onDismiss }: AdProps) {
  const [dismissed, dismiss] = useDismissable('bw_' + ad.id, onDismiss)
  const [submitted, setSubmitted] = useState(false)
  if (dismissed) return null

  const L: AdLocaleKey = locale === 'pt-BR' ? 'pt' : 'en'
  const label = L === 'pt' ? ad.label_pt : ad.label_en
  const headline = L === 'pt' ? ad.headline_pt : ad.headline_en
  const body = L === 'pt' ? ad.body_pt : ad.body_en
  const cta = L === 'pt' ? ad.cta_pt : ad.cta_en

  const isHouse = ad.label_pt === 'DA CASA' || ad.label_pt.startsWith('DA CASA')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        background: ad.brandColor,
        color: '#1A140C',
        transform: 'rotate(-0.25deg)',
      }}
    >
      {/* Tape decoration */}
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

      {/* Dismiss */}
      <div className="absolute right-3 top-3">
        <DismissButton
          onClick={dismiss}
          color="#1A140C"
          label={L === 'pt' ? 'Fechar' : 'Close'}
        />
      </div>

      {/* Label */}
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

      {/* Headline */}
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
        {headline}
      </div>

      {/* Body */}
      <div
        className="font-source-serif mb-4.5"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.85,
          marginBottom: 18,
        }}
      >
        {body}
      </div>

      {/* Form or CTA */}
      {isHouse && !submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            placeholder={L === 'pt' ? 'voce@email.com' : 'you@email.com'}
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
              color: ad.brandColor,
              fontSize: 11,
              letterSpacing: '0.14em',
              fontWeight: 600,
            }}
          >
            {cta}
          </button>
        </form>
      ) : isHouse && submitted ? (
        <div
          className="font-source-serif italic"
          style={{
            padding: '12px 16px',
            background: 'rgba(26,20,12,0.08)',
            fontSize: 14,
          }}
        >
          {L === 'pt'
            ? 'Recebido. Confira sua caixa.'
            : 'Got it. Check your inbox.'}
        </div>
      ) : (
        <a
          href={ad.url}
          className="font-jetbrains inline-block uppercase no-underline"
          style={{
            padding: '12px 22px',
            background: '#1A140C',
            color: ad.brandColor,
            fontSize: 11,
            letterSpacing: '0.14em',
            fontWeight: 600,
          }}
        >
          {cta}
        </a>
      )}
    </div>
  )
}
