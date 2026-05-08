'use client'
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import QRCode from 'qrcode'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from './use-card-composition'
import type { UseCanvasInteractionReturn } from './use-canvas-interaction'

interface CanvasEditorProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  shortUrl: string
  containerWidth: number
  containerHeight: number
}

export interface CanvasEditorHandle {
  getStage: () => Konva.Stage | null
}

function useLoadedImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src
    return () => { img.onload = null; img.onerror = null }
  }, [src])
  return image
}

function useQrImage(
  url: string,
  fg: string,
  bg: string,
  ec: 'L' | 'M' | 'Q' | 'H',
): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const svg = await QRCode.toString(url, {
          type: 'svg', width: 512, margin: 2,
          color: { dark: fg, light: bg },
          errorCorrectionLevel: ec,
        })
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const blobUrl = URL.createObjectURL(blob)
        const img = new window.Image()
        img.onload = () => {
          if (!cancelled) setImage(img)
          URL.revokeObjectURL(blobUrl)
        }
        img.src = blobUrl
      } catch { /* ignore QR generation errors */ }
    }
    generate()
    return () => { cancelled = true }
  }, [url, fg, bg, ec])
  return image
}

function QrNode({
  element, shortUrl, isSelected, onSelect,
}: {
  element: CardElement & { type: 'qr' }
  shortUrl: string
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const image = useQrImage(shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection)
  return (
    <KonvaImage
      id={element.id}
      image={image ?? undefined}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
    />
  )
}

function TextNode({
  element, onSelect,
}: {
  element: CardElement & { type: 'text' }
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const text = element.uppercase ? element.content.toUpperCase() : element.content
  return (
    <KonvaText
      id={element.id}
      text={text}
      x={element.x}
      y={element.y}
      width={element.width}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
      fill={element.color}
      align={element.align}
      lineHeight={element.lineHeight}
      letterSpacing={parseFloat(element.letterSpacing) * element.fontSize}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
    />
  )
}

function ImageNode({
  element, onSelect,
}: {
  element: CardElement & { type: 'image' }
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const image = useLoadedImage(element.src)
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
      <KonvaImage
        image={image ?? undefined}
        width={element.width}
        height={element.height}
        cornerRadius={element.borderRadius}
      />
    </Group>
  )
}

function BackgroundRect({ composition }: { composition: CardComposition }) {
  const { canvas, background } = composition
  const bgImage = useLoadedImage(background.type === 'image' ? background.url : null)

  if (background.type === 'solid') {
    return <Rect width={canvas.width} height={canvas.height} fill={background.color} />
  }
  if (background.type === 'image') {
    return (
      <>
        <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
        {bgImage && <KonvaImage image={bgImage} width={canvas.width} height={canvas.height} />}
      </>
    )
  }
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

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(function CanvasEditor(
  { comp, interaction, shortUrl, containerWidth, containerHeight },
  ref,
) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { composition, updateElement } = comp
  const { selectedIds, select, multiSelect, deselectAll, zoom, openContextMenu } = interaction

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

  const handleSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if ((e.evt as MouseEvent).shiftKey) {
      multiSelect(id)
    } else {
      select(id)
    }
  }, [select, multiSelect])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) deselectAll()
  }, [deselectAll])

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
    const target = e.target
    const elId = target === stage ? null : target.id() || null
    if (elId && !selectedIds.has(elId)) select(elId)
    openContextMenu(pos.x, pos.y, elId)
  }, [selectedIds, select, openContextMenu])

  const stageWidth = containerWidth
  const stageHeight = containerHeight

  const renderElement = (el: CardElement) => {
    const isSelected = selectedIds.has(el.id)
    switch (el.type) {
      case 'qr':
        return <QrNode key={el.id} element={el} shortUrl={shortUrl} isSelected={isSelected} onSelect={handleSelect} />
      case 'text':
        return <TextNode key={el.id} element={el} isSelected={isSelected} onSelect={handleSelect} />
      case 'image':
        return <ImageNode key={el.id} element={el} isSelected={isSelected} onSelect={handleSelect} />
    }
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: stageWidth,
        height: stageHeight,
        backgroundImage: 'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)',
        backgroundSize: '20px 20px',
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={zoom}
        scaleY={zoom}
        offsetX={-(stageWidth / zoom - composition.canvas.width) / 2}
        offsetY={-(stageHeight / zoom - composition.canvas.height) / 2}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          <Rect
            x={-2}
            y={-2}
            width={composition.canvas.width + 4}
            height={composition.canvas.height + 4}
            fill="rgba(0,0,0,0.3)"
            cornerRadius={2}
          />
          <BackgroundRect composition={composition} />
          {composition.elements.map(renderElement)}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox
              return newBox
            }}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
})
