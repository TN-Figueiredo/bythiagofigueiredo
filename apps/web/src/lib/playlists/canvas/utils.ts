export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

export function screenToCanvas(
  screenX: number,
  screenY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  camera: Camera,
): Point {
  return {
    x: (screenX - rect.left - camera.x) / camera.zoom,
    y: (screenY - rect.top - camera.y) / camera.zoom,
  }
}

export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  camera: Camera,
): Point {
  return {
    x: canvasX * camera.zoom + camera.x + rect.left,
    y: canvasY * camera.zoom + camera.y + rect.top,
  }
}

export function edgePath(source: Point, target: Point): string {
  const dx = Math.abs(target.x - source.x)
  const cp = Math.max(dx * 0.4, 50)
  return `M ${source.x} ${source.y} C ${source.x + cp} ${source.y}, ${target.x - cp} ${target.y}, ${target.x} ${target.y}`
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function zoomTowardPoint(
  camera: Camera,
  screenX: number,
  screenY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  delta: number,
): Camera {
  const zoomFactor = delta > 0 ? 0.9 : 1.1
  const newZoom = clampZoom(camera.zoom * zoomFactor)
  const ratio = newZoom / camera.zoom

  const mouseX = screenX - rect.left
  const mouseY = screenY - rect.top

  return {
    zoom: newZoom,
    x: mouseX - (mouseX - camera.x) * ratio,
    y: mouseY - (mouseY - camera.y) * ratio,
  }
}

export function fitAllNodes(
  items: Array<{ position_x: number; position_y: number }>,
  viewportWidth: number,
  viewportHeight: number,
  padding = 60,
  nodeWidth = 180,
  nodeHeight = 80,
): Camera {
  if (items.length === 0) return { x: 0, y: 0, zoom: 1 }

  const minX = Math.min(...items.map(i => i.position_x))
  const maxX = Math.max(...items.map(i => i.position_x)) + nodeWidth
  const minY = Math.min(...items.map(i => i.position_y))
  const maxY = Math.max(...items.map(i => i.position_y)) + nodeHeight

  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2

  const zoom = clampZoom(
    Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight),
  )

  return {
    zoom,
    x: (viewportWidth - contentWidth * zoom) / 2 - minX * zoom + padding * zoom,
    y: (viewportHeight - contentHeight * zoom) / 2 - minY * zoom + padding * zoom,
  }
}
