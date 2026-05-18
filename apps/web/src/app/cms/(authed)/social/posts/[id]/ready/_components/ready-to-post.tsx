'use client'

import React, { useState, useCallback } from 'react'
import { Copy, Check, CheckCircle2 } from 'lucide-react'

interface ReadyToPostProps {
  postId: string
  title: string
  imageUrl: string
  shortUrl: string
  status: 'publishing' | 'completed' | string
  onMarkAsPosted: (postId: string) => Promise<{ ok: boolean }>
}

export function ReadyToPost({
  postId,
  title,
  imageUrl,
  shortUrl,
  status,
  onMarkAsPosted,
}: ReadyToPostProps) {
  const [copied, setCopied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(status === 'completed')

  // Strip protocol for display
  const displayUrl = shortUrl.replace(/^https?:\/\//, '')

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }, [shortUrl])

  const handleMarkAsPosted = useCallback(async () => {
    setMarking(true)
    try {
      const result = await onMarkAsPosted(postId)
      if (result.ok) {
        setMarked(true)
      }
    } finally {
      setMarking(false)
    }
  }, [postId, onMarkAsPosted])

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center">
      {/* Minimal header */}
      <div className="w-full max-w-md px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-neutral-400 font-medium">Story Ready</span>
        {marked && (
          <span className="flex items-center gap-1 text-[12px] text-green-400">
            <CheckCircle2 size={14} />Posted
          </span>
        )}
      </div>

      {/* Story preview */}
      <div className="w-full max-w-[270px] mx-auto px-4 mb-6">
        <img
          src={imageUrl}
          alt="Story preview"
          className="w-full rounded-xl shadow-2xl"
          style={{ aspectRatio: '9/16', objectFit: 'cover' }}
        />
      </div>

      {/* Title */}
      <p className="text-sm text-neutral-300 font-medium text-center px-4 mb-4 max-w-md">
        {title}
      </p>

      {/* Short URL copy section */}
      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="flex-1 text-sm font-mono text-cyan-400 truncate">{displayUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-[12px] text-neutral-300 hover:bg-neutral-700 transition-colors"
            aria-label={copied ? 'Copied' : 'Copy URL'}
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-md px-4 mb-8">
        <ol className="space-y-3">
          {[
            { step: 1, text: 'Open Instagram and create a new Story' },
            { step: 2, text: 'Upload the image from your gallery' },
            { step: 3, text: 'Add a Link Sticker and paste the URL' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 text-[12px] font-bold flex items-center justify-center">
                {step}
              </span>
              <span className="text-[13px] text-neutral-400 pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Action button */}
      {!marked ? (
        <div className="w-full max-w-md px-4 pb-8">
          <button
            type="button"
            onClick={handleMarkAsPosted}
            disabled={marking}
            className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
            aria-label="Mark as posted"
          >
            {marking ? 'Updating...' : 'Mark as Posted'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
