'use client'
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Group } from 'react-konva'
import KonvaLib from 'konva'
import type Konva from 'konva'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'

interface SocialCanvasProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  containerWidth: number
  containerHeight: number
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

function BlurredBackgroundImage({ image, width, height, blur }: {
  image: HTMLImageElement
  width: number
  height: number
  blur: number
}) {
  const imgRef = useRef<Konva.Image>(null)

  useEffect(() => {
    const node = imgRef.current
    if (!node) return
    node.cache()
    node.getLayer()?.batchDraw()
  }, [image, width, height, blur])

  return (
    <KonvaImage
      ref={imgRef}
      image={image}
      width={width}
      height={height}
      filters={[KonvaLib.Filters.Blur]}
      blurRadius={blur}
    />
  )
}

function BackgroundRect({ composition }: { composition: CardComposition }) {
  const { canvas, background } = composition
  const { image: bgImage } = useLoadedImage(background.type === 'image' ? background.url : null)

  if (background.type === 'solid') {
    return <Rect width={canvas.width} height={canvas.height} fill={background.color} />
  }
  if (background.type === 'image') {
    const blurRadius = background.blur ?? 0
    return (
      <>
        <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
        {bgImage && blurRadius > 0 ? (
          <BlurredBackgroundImage image={bgImage} width={canvas.width} height={canvas.height} blur={blurRadius} />
        ) : bgImage ? (
          <KonvaImage image={bgImage} width={canvas.width} height={canvas.height} />
        ) : null}
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
  { comp, interaction, containerWidth, containerHeight },
  ref,
) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { composition, updateElement } = comp
  const { selectedIds, select, multiSelect, deselectAll, zoom, clipOverflow, openContextMenu } = interaction

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

  const renderElement = (el: CardElement) => {
    switch (el.type) {
      case 'text':
        return <TextNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      case 'image':
        return <ImageNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      default:
        return null
    }
  }

  return (
    <div
      className="relative overflow-hidden"
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
        offsetX={-(containerWidth / zoom - composition.canvas.width) / 2}
        offsetY={-(containerHeight / zoom - composition.canvas.height) / 2}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          <Rect x={-2} y={-2} width={composition.canvas.width + 4} height={composition.canvas.height + 4} fill="rgba(0,0,0,0.3)" cornerRadius={2} />
          <BackgroundRect composition={composition} />
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
