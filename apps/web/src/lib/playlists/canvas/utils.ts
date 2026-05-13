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
  const dx = target.x - source.x
  const dy = target.y - source.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    const cp = Math.max(Math.abs(dx) * 0.4, 50)
    const dir = dx >= 0 ? 1 : -1
    return `M ${source.x} ${source.y} C ${source.x + cp * dir} ${source.y}, ${target.x - cp * dir} ${target.y}, ${target.x} ${target.y}`
  }
  const cp = Math.max(Math.abs(dy) * 0.4, 50)
  const dir = dy >= 0 ? 1 : -1
  return `M ${source.x} ${source.y} C ${source.x} ${source.y + cp * dir}, ${target.x} ${target.y - cp * dir}, ${target.x} ${target.y}`
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

export function getConnectionPoints(
  source: { position_x: number; position_y: number },
  target: { position_x: number; position_y: number },
): { sourcePoint: Point; targetPoint: Point } {
  const sCx = source.position_x + NODE_WIDTH / 2
  const sCy = source.position_y + NODE_HEIGHT / 2
  const tCx = target.position_x + NODE_WIDTH / 2
  const tCy = target.position_y + NODE_HEIGHT / 2
  const dx = tCx - sCx
  const dy = tCy - sCy

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePoint: { x: source.position_x + NODE_WIDTH, y: sCy }, targetPoint: { x: target.position_x, y: tCy } }
      : { sourcePoint: { x: source.position_x, y: sCy }, targetPoint: { x: target.position_x + NODE_WIDTH, y: tCy } }
  }
  return dy >= 0
    ? { sourcePoint: { x: sCx, y: source.position_y + NODE_HEIGHT }, targetPoint: { x: tCx, y: target.position_y } }
    : { sourcePoint: { x: sCx, y: source.position_y }, targetPoint: { x: tCx, y: target.position_y + NODE_HEIGHT } }
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
