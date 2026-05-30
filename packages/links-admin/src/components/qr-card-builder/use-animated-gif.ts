'use client'
import { useEffect, useRef, useState } from 'react'
import { parseGIF, decompressFrames } from 'gifuct-js'

interface GifFrameData {
  patch: ImageData
  dims: { top: number; left: number; width: number; height: number }
  delay: number
  disposalType: number
}

interface UseAnimatedGifReturn {
  canvas: HTMLCanvasElement | null
  loading: boolean
  error: boolean
  frameCount: number
  gifWidth: number
  gifHeight: number
}

export function useAnimatedGif(
  src: string | null,
  onFrameChange?: () => void,
): UseAnimatedGifReturn {
  const [state, setState] = useState<{ loading: boolean; error: boolean; frameCount: number; gifWidth: number; gifHeight: number }>({
    loading: false, error: false, frameCount: 0, gifWidth: 0, gifHeight: 0,
  })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const framesRef = useRef<GifFrameData[]>([])
  const frameIdxRef = useRef(0)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const compCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const onFrameChangeRef = useRef(onFrameChange)
  onFrameChangeRef.current = onFrameChange

  useEffect(() => {
    if (!src) {
      canvasRef.current = null
      setState({ loading: false, error: false, frameCount: 0, gifWidth: 0, gifHeight: 0 })
      return
    }

    // Only animate GIFs
    const isGif = src.toLowerCase().endsWith('.gif') || src.includes('image/gif')
    if (!isGif) {
      canvasRef.current = null
      setState({ loading: false, error: false, frameCount: 0, gifWidth: 0, gifHeight: 0 })
      return
    }

    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: false }))

    async function load() {
      try {
        const resp = await fetch(src!, { mode: 'cors' })
        const buff = await resp.arrayBuffer()
        const gif = parseGIF(buff)
        const frames = decompressFrames(gif, true)

        if (cancelled || !frames.length) return

        const gifWidth = gif.lsd.width
        const gifHeight = gif.lsd.height

        // Create compositing canvas
        const compCanvas = document.createElement('canvas')
        compCanvas.width = gifWidth
        compCanvas.height = gifHeight
        compCanvasRef.current = compCanvas

        // Save canvas for disposal type 3
        const prevCanvas = document.createElement('canvas')
        prevCanvas.width = gifWidth
        prevCanvas.height = gifHeight
        prevCanvasRef.current = prevCanvas

        // Reusable scratch canvas for frame patches (avoids per-frame allocation)
        const tempCanvas = document.createElement('canvas')
        tempCanvasRef.current = tempCanvas

        // The canvas Konva reads from
        const drawCanvas = document.createElement('canvas')
        drawCanvas.width = gifWidth
        drawCanvas.height = gifHeight
        canvasRef.current = drawCanvas

        // Store frames
        framesRef.current = frames.map(f => ({
          patch: new ImageData(
            new Uint8ClampedArray(f.patch),
            f.dims.width,
            f.dims.height,
          ),
          dims: f.dims,
          delay: f.delay,
          disposalType: f.disposalType,
        }))

        setState({
          loading: false, error: false,
          frameCount: frames.length,
          gifWidth, gifHeight,
        })

        // Start animation
        frameIdxRef.current = 0
        lastTimeRef.current = performance.now()
        renderFrame(0)
        tick()
      } catch (err) {
        if (!cancelled) {
          console.error('[GIF] Failed to load:', err)
          setState({ loading: false, error: true, frameCount: 0, gifWidth: 0, gifHeight: 0 })
        }
      }
    }

    function tick() {
      if (cancelled) return
      rafRef.current = requestAnimationFrame(tick)

      const frames = framesRef.current
      if (!frames.length) return

      const now = performance.now()
      const frame = frames[frameIdxRef.current]
      if (!frame) return
      const delay = Math.max(frame.delay * 10, 20) // GIF delay is centiseconds

      if (now - lastTimeRef.current < delay) return
      lastTimeRef.current = now

      frameIdxRef.current = (frameIdxRef.current + 1) % frames.length
      renderFrame(frameIdxRef.current)
      onFrameChangeRef.current?.()
    }

    function renderFrame(idx: number) {
      const frame = framesRef.current[idx]
      if (!frame) return
      const compCanvas = compCanvasRef.current!
      const compCtx = compCanvas.getContext('2d')!
      const drawCanvas = canvasRef.current!
      const drawCtx = drawCanvas.getContext('2d')!
      const prevCanvas = prevCanvasRef.current!
      const prevCtx = prevCanvas.getContext('2d')!

      // First frame: clear
      if (idx === 0) {
        compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height)
      }

      // Save for disposal type 3
      if (frame.disposalType === 3) {
        prevCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height)
        prevCtx.drawImage(compCanvas, 0, 0)
      }

      // Draw frame patch (reuse scratch canvas to avoid per-frame allocation)
      const tempCanvas = tempCanvasRef.current!
      if (tempCanvas.width !== frame.dims.width) tempCanvas.width = frame.dims.width
      if (tempCanvas.height !== frame.dims.height) tempCanvas.height = frame.dims.height
      const tempCtx = tempCanvas.getContext('2d')!
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      tempCtx.putImageData(frame.patch, 0, 0)
      compCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top)

      // Copy to draw canvas
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height)
      drawCtx.drawImage(compCanvas, 0, 0)

      // Handle disposal for next frame
      if (frame.disposalType === 2) {
        compCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
      } else if (frame.disposalType === 3) {
        compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height)
        compCtx.drawImage(prevCanvas, 0, 0)
      }
    }

    load()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [src]) // Note: onFrameChange intentionally excluded to avoid re-loading

  return {
    canvas: canvasRef.current,
    loading: state.loading,
    error: state.error,
    frameCount: state.frameCount,
    gifWidth: state.gifWidth,
    gifHeight: state.gifHeight,
  }
}
