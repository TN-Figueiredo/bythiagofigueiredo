'use client'
import { useState, useEffect, useRef } from 'react'

export interface ClickStreamState {
  clicks: number
  rate: number
  isConnected: boolean
}

export function useClickStream(linkId: string, streamUrl: string): ClickStreamState {
  const [clicks, setClicks] = useState(0)
  const [rate, setRate] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const clickTimestamps = useRef<number[]>([])

  useEffect(() => {
    const url = `${streamUrl}?linkId=${linkId}`
    const es = new EventSource(url)

    es.onopen = () => {
      setIsConnected(true)
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'click') {
          setClicks((prev) => prev + 1)
          clickTimestamps.current.push(Date.now())
          // Calculate rate: clicks in last 60 seconds
          const cutoff = Date.now() - 60000
          clickTimestamps.current = clickTimestamps.current.filter((t) => t > cutoff)
          setRate(clickTimestamps.current.length)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    es.onerror = () => {
      setIsConnected(false)
    }

    return () => {
      es.close()
    }
  }, [linkId, streamUrl])

  return { clicks, rate, isConnected }
}
