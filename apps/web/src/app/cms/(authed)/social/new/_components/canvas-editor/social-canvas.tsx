'use client'
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Group } from 'react-konva'
import KonvaLib from 'konva'
import type Konva from 'konva'
import type { CardComposition, CardElement, VideoElement } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'

interface SocialCanvasProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  containerWidth: number
  containerHeight: number
  panX: number
  panY: number
  onPanChange: (panX: number, panY: number) => void
  playingVideos?: Set<string>
  onVideoDuration?: (elementId: string, duration: number) => void
}

export interface SocialCanvasHandle {
  getStage: () => Konva.Stage | null
}

type ImageLoadState = { image: HTMLImageElement | null; loading: boolean; error: boolean }

function useLoadedImage(src: string | null): ImageLoadState {
  const [state, setState] = useState<ImageLoadState>({ image: null, loading: false, error: false })
  useEffect(() => {
    if (!src) { setState({ image: null, loading: false, error: false }); return }
    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: false }))
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { if (!cancelled) setState({ image: img, loading: false, error: false }) }
    img.onerror = () => { if (!cancelled) setState({ image: null, loading: false, error: true }) }
    img.src = src
    return () => { cancelled = true }
  }, [src])
  return state
}

interface VideoLoadState {
  video: HTMLVideoElement | null
  loading: boolean
  error: boolean
  duration: number
}

interface UseVideoOpts {
  muted: boolean
  loop: boolean
  playing?: boolean
  startTime?: number
  endTime?: number | null
}

function useLoadedVideo(src: string | null, opts: UseVideoOpts): VideoLoadState {
  const [state, setState] = useState<VideoLoadState>({ video: null, loading: false, error: false, duration: 0 })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!src) {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }
      videoRef.current = null
      setState({ video: null, loading: false, error: false, duration: 0 })
      return
    }
    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: false }))
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = optsRef.current.muted
    video.loop = optsRef.current.loop

    video.onloadedmetadata = () => {
      if (cancelled) return
      videoRef.current = video
      const dur = isFinite(video.duration) ? video.duration : 0
      const st = optsRef.current.startTime ?? 0
      if (st > 0 && st < dur) video.currentTime = st
      setState({ video, loading: false, error: false, duration: dur })
      if (optsRef.current.playing !== false) {
        video.play().catch(() => {})
      }
    }
    video.onerror = () => {
      if (!cancelled) setState({ video: null, loading: false, error: true, duration: 0 })
    }
    video.src = src
    video.load()
    return () => {
      cancelled = true
      video.pause()
      video.removeAttribute('src')
      video.load()
      videoRef.current = null
    }
  }, [src])

  const { muted, loop, playing = true, startTime = 0, endTime = null } = opts

  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.loop = loop
  }, [loop])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) v.play().catch(() => {})
    else v.pause()
  }, [playing])

  const prevStartTimeRef = useRef(startTime)
  useEffect(() => {
    const v = videoRef.current
    if (!v || prevStartTimeRef.current === startTime) return
    prevStartTimeRef.current = startTime
    v.currentTime = startTime
  }, [startTime])

  useEffect(() => {
    const v = videoRef.current
    if (!v || (endTime == null && startTime === 0)) return
    const onTimeUpdate = () => {
      const end = endTime ?? v.duration
      if (v.currentTime >= end) {
        if (loop) {
          v.currentTime = startTime
          v.play().catch(() => {})
        } else {
          v.pause()
        }
      }
    }
    v.addEventListener('timeupdate', onTimeUpdate)
    return () => v.removeEventListener('timeupdate', onTimeUpdate)
  }, [startTime, endTime, loop])

  return state
}

function TextNode({
  element, onSelect, onDragMove, onDragEnd,
}: {
  element: CardElement & { type: 'text' }
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}) {
  const text = element.uppercase ? element.content.toUpperCase() : element.content
  const textRef = useRef<Konva.Text>(null)
  const [textHeight, setTextHeight] = useState(element.fontSize * element.lineHeight)

  useEffect(() => {
    if (textRef.current) setTextHeight(textRef.current.height())
  }, [text, element.fontSize, element.fontFamily, element.fontWeight, element.lineHeight, element.letterSpacing, element.width])

  const pad = element.backgroundColor ? (element.backgroundPadding ?? 8) : 0
  const radius = element.backgroundColor ? (element.backgroundRadius ?? 4) : 0

  return (
    <Group
      id={element.id}
      x={element.x - pad}
      y={element.y - pad}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {element.backgroundColor && (
        <Rect
          width={element.width + pad * 2}
          height={textHeight + pad * 2}
          fill={element.backgroundColor}
          cornerRadius={radius}
        />
      )}
      <KonvaText
        ref={textRef}
        text={text}
        x={pad}
        y={pad}
        width={element.width}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
        fill={element.color}
        align={element.align}
        lineHeight={element.lineHeight}
        letterSpacing={parseFloat(element.letterSpacing) * element.fontSize}
      />
    </Group>
  )
}

function ImageNode({
  element, onSelect, onDragMove, onDragEnd,
}: {
  element: CardElement & { type: 'image' }
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}) {
  const { image, error } = useLoadedImage(element.src)
  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {element.borderWidth > 0 && (
        <Rect
          x={-element.borderWidth}
          y={-element.borderWidth}
          width={element.width + element.borderWidth * 2}
          height={element.height + element.borderWidth * 2}
          fill={element.borderColor}
          cornerRadius={element.borderRadius + element.borderWidth}
        />
      )}
      {image ? (
        <KonvaImage image={image} width={element.width} height={element.height} cornerRadius={element.borderRadius} />
      ) : (
        <>
          <Rect width={element.width} height={element.height} fill={error ? '#331111' : '#1a1a2e'} cornerRadius={element.borderRadius} stroke={error ? '#662222' : '#2a2a4a'} strokeWidth={1} />
          <KonvaText text={error ? 'Failed to load' : 'Loading...'} x={0} y={element.height / 2 - 8} width={element.width} fontSize={13} fontFamily="Inter" fill={error ? '#cc4444' : '#6a6a9a'} align="center" />
        </>
      )}
    </Group>
  )
}

function VideoNode({
  element, playing, onSelect, onDragMove, onDragEnd, onDurationChange,
}: {
  element: VideoElement
  playing: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDurationChange?: (id: string, duration: number) => void
}) {
  const { video, error, duration } = useLoadedVideo(element.src, {
    muted: element.muted,
    loop: element.loop,
    playing,
    startTime: element.startTime ?? 0,
    endTime: element.endTime ?? null,
  })
  const imageRef = useRef<Konva.Image>(null)
  const animRef = useRef<KonvaLib.Animation | null>(null)

  useEffect(() => {
    if (duration > 0 && onDurationChange) onDurationChange(element.id, duration)
  }, [duration, element.id, onDurationChange])

  useEffect(() => {
    const node = imageRef.current
    if (!node || !video) return
    if (!playing) {
      if (animRef.current) { animRef.current.stop(); animRef.current = null }
      node.getLayer()?.batchDraw()
      return
    }
    const layer = node.getLayer()
    if (!layer) return
    const anim = new KonvaLib.Animation(() => {}, layer)
    anim.start()
    animRef.current = anim
    return () => { anim.stop(); animRef.current = null }
  }, [video, playing])

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {element.borderWidth > 0 && (
        <Rect
          x={-element.borderWidth}
          y={-element.borderWidth}
          width={element.width + element.borderWidth * 2}
          height={element.height + element.borderWidth * 2}
          fill={element.borderColor}
          cornerRadius={element.borderRadius + element.borderWidth}
        />
      )}
      {video ? (
        <>
          <KonvaImage
            ref={imageRef}
            image={video}
            width={element.width}
            height={element.height}
            cornerRadius={element.borderRadius}
          />
          {!playing && (
            <>
              <Rect
                x={element.width / 2 - 20}
                y={element.height / 2 - 20}
                width={40}
                height={40}
                fill="rgba(0,0,0,0.55)"
                cornerRadius={20}
              />
              <KonvaText
                text="▶"
                x={element.width / 2 - 20}
                y={element.height / 2 - 13}
                width={40}
                fontSize={18}
                fill="#ffffff"
                align="center"
              />
            </>
          )}
        </>
      ) : (
        <>
          <Rect width={element.width} height={element.height} fill={error ? '#331111' : '#1a1a2e'} cornerRadius={element.borderRadius} stroke={error ? '#662222' : '#2a2a4a'} strokeWidth={1} />
          <KonvaText text={error ? 'Failed to load' : 'Loading...'} x={0} y={element.height / 2 - 8} width={element.width} fontSize={13} fontFamily="Inter" fill={error ? '#cc4444' : '#6a6a9a'} align="center" />
        </>
      )}
    </Group>
  )
}

function BlurredBackgroundImage({ image, x, y, width, height, blur }: {
  image: HTMLImageElement | HTMLVideoElement
  x: number
  y: number
  width: number
  height: number
  blur: number
}) {
  const imgRef = useRef<Konva.Image>(null)
  const isVideo = image instanceof HTMLVideoElement

  useEffect(() => {
    const node = imgRef.current
    if (!node) return
    if (isVideo) {
      const layer = node.getLayer()
      if (!layer) return
      let lastCache = 0
      const anim = new KonvaLib.Animation((frame) => {
        if (frame && frame.time - lastCache > 42) {
          node.cache()
          lastCache = frame.time
        }
      }, layer)
      anim.start()
      return () => { anim.stop() }
    }
    node.cache()
    node.getLayer()?.batchDraw()
  }, [image, x, y, width, height, blur, isVideo])

  return (
    <KonvaImage
      ref={imgRef}
      image={image}
      x={x}
      y={y}
      width={width}
      height={height}
      filters={[KonvaLib.Filters.Blur]}
      blurRadius={blur}
    />
  )
}

function computeCoverDimensions(
  imgW: number, imgH: number, canvasW: number, canvasH: number, offsetY: number,
): { drawX: number; drawY: number; drawW: number; drawH: number } {
  const imgRatio = imgW / imgH
  const canvasRatio = canvasW / canvasH
  let drawW: number
  let drawH: number
  if (imgRatio > canvasRatio) {
    drawH = canvasH
    drawW = canvasH * imgRatio
  } else {
    drawW = canvasW
    drawH = canvasW / imgRatio
  }
  const drawX = (canvasW - drawW) / 2
  const drawY = (canvasH - drawH) / 2 + offsetY
  return { drawX, drawY, drawW, drawH }
}

function BackgroundRect({
  composition, onOffsetYChange,
}: {
  composition: CardComposition
  onOffsetYChange?: (offsetY: number) => void
}) {
  const { canvas, background } = composition
  const { image: bgImage } = useLoadedImage(
    background.type === 'image' && (background.mediaType ?? 'image') === 'image' ? background.url : null,
  )
  const bgStartTime = background.type === 'image' ? (background.startTime ?? 0) : 0
  const bgEndTime = background.type === 'image' ? (background.endTime ?? null) : null
  const { video: bgVideo } = useLoadedVideo(
    background.type === 'image' && background.mediaType === 'video' ? background.url : null,
    { muted: true, loop: true, startTime: bgStartTime, endTime: bgEndTime },
  )
  const bgVideoAnimRef = useRef<KonvaLib.Animation | null>(null)
  const bgVideoImageRef = useRef<Konva.Image>(null)

  useEffect(() => {
    const node = bgVideoImageRef.current
    if (!node || !bgVideo) return
    const anim = new KonvaLib.Animation(() => {}, node.getLayer()!)
    anim.start()
    bgVideoAnimRef.current = anim
    return () => { anim.stop(); bgVideoAnimRef.current = null }
  }, [bgVideo])

  // Expose onOffsetYChange for drag handling at stage level
  void onOffsetYChange

  if (background.type === 'solid') {
    return <Rect width={canvas.width} height={canvas.height} fill={background.color} />
  }
  if (background.type === 'image') {
    const blurRadius = background.blur ?? 0
    const offsetY = background.offsetY ?? 0
    const media = (background.mediaType ?? 'image') === 'video' ? bgVideo : bgImage

    if (!media) {
      return <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
    }

    const mediaW = media instanceof HTMLVideoElement ? media.videoWidth || canvas.width : media.naturalWidth
    const mediaH = media instanceof HTMLVideoElement ? media.videoHeight || canvas.height : media.naturalHeight
    const { drawX, drawY, drawW, drawH } = computeCoverDimensions(mediaW, mediaH, canvas.width, canvas.height, offsetY)

    return (
      <>
        <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
        {blurRadius > 0 ? (
          <BlurredBackgroundImage image={media} x={drawX} y={drawY} width={drawW} height={drawH} blur={blurRadius} />
        ) : media instanceof HTMLVideoElement ? (
          <KonvaImage ref={bgVideoImageRef} image={media} x={drawX} y={drawY} width={drawW} height={drawH} />
        ) : (
          <KonvaImage image={media} x={drawX} y={drawY} width={drawW} height={drawH} />
        )}
      </>
    )
  }
  // gradient
  const rad = (background.angle * Math.PI) / 180
  const hw = canvas.width / 2
  const hh = canvas.height / 2
  return (
    <Rect
      width={canvas.width}
      height={canvas.height}
      fillLinearGradientStartPoint={{ x: hw - Math.cos(rad) * hw, y: hh - Math.sin(rad) * hh }}
      fillLinearGradientEndPoint={{ x: hw + Math.cos(rad) * hw, y: hh + Math.sin(rad) * hh }}
      fillLinearGradientColorStops={background.stops.flatMap(s => [s.position, s.color])}
    />
  )
}

export const SocialCanvas = forwardRef<SocialCanvasHandle, SocialCanvasProps>(function SocialCanvas(
  { comp, interaction, containerWidth, containerHeight, panX, panY, onPanChange, playingVideos, onVideoDuration },
  ref,
) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { composition, updateElement } = comp
  const { selectedIds, select, multiSelect, deselectAll, zoom, clipOverflow, openContextMenu } = interaction

  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  // Background offsetY drag state
  const bgDragRef = useRef<{ startY: number; startOffsetY: number } | null>(null)

  useImperativeHandle(ref, () => ({
    getStage: () => stageRef.current,
  }), [])

  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const nodes = Array.from(selectedIds)
      .map(id => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => n !== null && n !== undefined)
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, composition.elements])

  // Space key tracking for pan mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault()
        setSpacePressed(true)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpacePressed(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true
    if ('shiftKey' in e.evt && e.evt.shiftKey) {
      multiSelect(id)
    } else {
      select(id)
    }
  }, [select, multiSelect])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) deselectAll()
  }, [deselectAll])

  const snapThreshold = 8
  const gridSize = 20

  const snapValue = useCallback((val: number, targets: number[]): number => {
    for (const t of targets) {
      if (Math.abs(val - t) < snapThreshold) return t
    }
    return val
  }, [])

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const cw = composition.canvas.width
    const ch = composition.canvas.height
    let x = node.x()
    let y = node.y()
    const w = node.width() * node.scaleX()
    const h = node.height() * node.scaleY()

    if (interaction.gridVisible) {
      x = Math.round(x / gridSize) * gridSize
      y = Math.round(y / gridSize) * gridSize
      node.x(x)
      node.y(y)
      return
    }

    if (interaction.guidesVisible) {
      const cx = x + w / 2
      const cy = y + h / 2
      const snapTargetsX = [0, cw / 2, cw, cw / 2 - w / 2]
      const snapTargetsY = [0, ch / 2, ch, ch / 2 - h / 2]
      const snappedX = snapValue(x, snapTargetsX)
      const snappedCx = snapValue(cx, [cw / 2])
      const snappedRight = snapValue(x + w, [cw])
      const snappedY = snapValue(y, snapTargetsY)
      const snappedCy = snapValue(cy, [ch / 2])
      const snappedBottom = snapValue(y + h, [ch])

      if (snappedCx !== cx) x = snappedCx - w / 2
      else if (snappedX !== x) x = snappedX
      else if (snappedRight !== x + w) x = snappedRight - w

      if (snappedCy !== cy) y = snappedCy - h / 2
      else if (snappedY !== y) y = snappedY
      else if (snappedBottom !== y + h) y = snappedBottom - h

      node.x(x)
      node.y(y)
    }
  }, [composition.canvas.width, composition.canvas.height, interaction.gridVisible, interaction.guidesVisible, snapValue])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    updateElement(id, { x: node.x(), y: node.y() })
  }, [updateElement])

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    updateElement(id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(10, node.width() * scaleX),
      height: Math.max(10, node.height() * scaleY),
      rotation: node.rotation(),
    })
  }, [updateElement])

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    let node: Konva.Node | null = e.target
    let elId: string | null = null
    while (node && node !== stage) {
      const id = node.id()
      if (id && composition.elements.some(el => el.id === id)) { elId = id; break }
      node = node.parent
    }
    if (elId && !selectedIds.has(elId)) select(elId)
    openContextMenu(pos.x, pos.y, elId)
  }, [selectedIds, select, openContextMenu, composition.elements])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    if (e.evt.ctrlKey) {
      // Pinch-to-zoom / ctrl+wheel: zoom toward cursor
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const oldZoom = zoom
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const factor = direction > 0 ? 1.03 : 0.97
      const newZoom = Math.max(0.1, Math.min(5, oldZoom * factor))

      const currentOffsetX = -(containerWidth / oldZoom - composition.canvas.width) / 2 + panX
      const currentOffsetY = -(containerHeight / oldZoom - composition.canvas.height) / 2 + panY

      // Point in canvas space under the cursor before zoom
      const mouseCanvasX = pointer.x / oldZoom + currentOffsetX
      const mouseCanvasY = pointer.y / oldZoom + currentOffsetY

      // After zoom, the new base offset changes; compute what panX/panY must be so the
      // same canvas point stays under the cursor
      const newBaseOffsetX = -(containerWidth / newZoom - composition.canvas.width) / 2
      const newBaseOffsetY = -(containerHeight / newZoom - composition.canvas.height) / 2
      const newPanX = mouseCanvasX - pointer.x / newZoom - newBaseOffsetX
      const newPanY = mouseCanvasY - pointer.y / newZoom - newBaseOffsetY

      interaction.setZoom(newZoom)
      onPanChange(newPanX, newPanY)
    } else if (e.evt.shiftKey) {
      onPanChange(panX + e.evt.deltaY / zoom, panY)
    } else {
      onPanChange(panX, panY + e.evt.deltaY / zoom)
    }
  }, [zoom, panX, panY, containerWidth, containerHeight, composition.canvas.width, composition.canvas.height, interaction, onPanChange])

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spacePressed) {
      setIsPanning(true)
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (pointer) {
        panStartRef.current = { x: pointer.x, y: pointer.y, panX, panY }
      }
      e.cancelBubble = true
      return
    }

    // Background offsetY drag: detect click on background (stage target, not on an element)
    const stage = stageRef.current
    if (!stage) return
    const target = e.target
    const isBackground = target === stage || target.getParent() === stage.findOne('Layer')
    if (isBackground && composition.background.type === 'image' && !spacePressed) {
      const pointer = stage.getPointerPosition()
      if (pointer) {
        bgDragRef.current = {
          startY: pointer.y,
          startOffsetY: composition.background.offsetY ?? 0,
        }
      }
    }
  }, [spacePressed, panX, panY, composition.background])

  const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning && panStartRef.current) {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const dx = (pointer.x - panStartRef.current.x) / zoom
      const dy = (pointer.y - panStartRef.current.y) / zoom
      onPanChange(panStartRef.current.panX - dx, panStartRef.current.panY - dy)
      return
    }

    if (bgDragRef.current) {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const deltaY = (pointer.y - bgDragRef.current.startY) / zoom
      const newOffsetY = bgDragRef.current.startOffsetY + deltaY
      if (composition.background.type === 'image') {
        comp.setBackground({ ...composition.background, offsetY: newOffsetY })
      }
    }
  }, [isPanning, zoom, onPanChange, composition.background, comp])

  const handleStageMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      panStartRef.current = null
    }
    bgDragRef.current = null
  }, [isPanning])

  const cursorClass = isPanning ? 'cursor-grabbing' : spacePressed ? 'cursor-grab' : ''

  const renderElement = (el: CardElement) => {
    switch (el.type) {
      case 'text':
        return <TextNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      case 'image':
        return <ImageNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      case 'video':
        return <VideoNode key={el.id} element={el} playing={playingVideos ? playingVideos.has(el.id) : true} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDurationChange={onVideoDuration} />
      default:
        return null
    }
  }

  return (
    <div
      className={`relative overflow-hidden ${cursorClass}`}
      style={{
        width: containerWidth,
        height: containerHeight,
        backgroundImage: 'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)',
        backgroundSize: '20px 20px',
      }}
    >
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={containerHeight}
        scaleX={zoom}
        scaleY={zoom}
        offsetX={-(containerWidth / zoom - composition.canvas.width) / 2 + panX}
        offsetY={-(containerHeight / zoom - composition.canvas.height) / 2 + panY}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          <Rect x={-2} y={-2} width={composition.canvas.width + 4} height={composition.canvas.height + 4} fill="rgba(0,0,0,0.3)" cornerRadius={2} />
          <Group clipFunc={(ctx: { rect: (x: number, y: number, w: number, h: number) => void }) => { ctx.rect(0, 0, composition.canvas.width, composition.canvas.height) }}>
            <BackgroundRect composition={composition} />
          </Group>
          {interaction.gridVisible && (
            <Group listening={false} opacity={0.15}>
              {Array.from({ length: Math.ceil(composition.canvas.width / gridSize) - 1 }, (_, i) => (
                <Rect key={`gv${i}`} x={(i + 1) * gridSize} y={0} width={0.5} height={composition.canvas.height} fill="#888" />
              ))}
              {Array.from({ length: Math.ceil(composition.canvas.height / gridSize) - 1 }, (_, i) => (
                <Rect key={`gh${i}`} x={0} y={(i + 1) * gridSize} width={composition.canvas.width} height={0.5} fill="#888" />
              ))}
            </Group>
          )}
          {interaction.guidesVisible && (
            <Group listening={false}>
              <Rect x={composition.canvas.width / 2} y={0} width={0.5} height={composition.canvas.height} fill="#f97316" opacity={0.3} />
              <Rect x={0} y={composition.canvas.height / 2} width={composition.canvas.width} height={0.5} fill="#f97316" opacity={0.3} />
            </Group>
          )}
          <Group clipFunc={clipOverflow ? (ctx: { rect: (x: number, y: number, w: number, h: number) => void }) => { ctx.rect(0, 0, composition.canvas.width, composition.canvas.height) } : undefined}>
            {composition.elements.map(renderElement)}
          </Group>
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox
              return newBox
            }}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
})
