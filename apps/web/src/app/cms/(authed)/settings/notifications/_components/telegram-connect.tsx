'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react'

interface TelegramConnectProps {
  userId: string
  isConnected: boolean
  chatId: string | null
}

export function TelegramConnect({
  userId,
  isConnected: initialConnected,
}: TelegramConnectProps) {
  const [connected, setConnected] = useState(initialConnected)
  const botUsername =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'BTFStoryBot'
  // TODO: Replace raw UUID with HMAC-signed token from telegram_connection_tokens table
  // See spec Section 1.1 telegram_connection_tokens and Section 5.5 Security
  const deepLink = `https://t.me/${botUsername}?start=${userId}`

  // Poll for connection status after user clicks the link
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!polling || connected) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/social/telegram-status')
        if (res.ok) {
          const data = await res.json()
          if (data.connected) {
            setConnected(true)
            setPolling(false)
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [polling, connected])

  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-800/40 bg-green-950/20 px-4 py-3">
        <CheckCircle2 size={20} className="shrink-0 text-green-500" />
        <div>
          <p className="text-sm font-medium text-green-300">
            Telegram connected
          </p>
          <p className="text-[11px] text-green-500/70">
            Story notifications will be sent via Telegram
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h4 className="mb-2 text-sm font-medium text-cms-text">
        Connect Telegram
      </h4>
      <p className="mb-3 text-[12px] text-cms-text-muted">
        Receive Instagram Story notifications directly in Telegram. Click the
        button below to open Telegram and connect your account.
      </p>
      <a
        href={deepLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setPolling(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0088cc] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077b5]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        Open in Telegram
        <ExternalLink size={14} />
      </a>
      {polling && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-cms-text-muted">
          <RefreshCw size={12} className="animate-spin" />
          Waiting for connection...
        </p>
      )}
    </div>
  )
}
