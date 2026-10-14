// Draws the match on a low-resolution canvas that CSS scales up with crisp pixels.
import { W, H, CY, GOAL_HALF, BOX_DEPTH, BOX_HALF, SIX_DEPTH, SIX_HALF, PEN_SPOT } from '../game/engine/geometry.js'
import { drawGrid } from './grid.js'
import { pitchSprite } from './sprites.js'

export const SCALE = 4 // pixels per metre
export const MARGIN = 14
export const CANVAS_W = Math.round(W * SCALE + MARGIN * 2)
export const CANVAS_H = Math.round(H * SCALE + MARGIN * 2)

const GRASS_A = '#3a7d2c'
const GRASS_B = '#347126'
const LINE = '#e9f5e1'

const px = (x) => Math.round(MARGIN + x * SCALE)
const py = (y) => Math.round(MARGIN + y * SCALE)
export const toCanvas = (x, y) => ({ x: MARGIN + x * SCALE, y: MARGIN + y * SCALE })

// Midpoint circle algorithm: plots a pixel-perfect circle using only integer steps.
function circlePoints(cx, cy, r) {
  const pts = []
  let x = r
  let y = 0
  let err = 1 - r
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) pts.push([cx + a, cy + b])
    y++
    if (err < 0) err += 2 * y + 1
    else {
      x--
      err += 2 * (y - x) + 1
    }
  }
  return pts
}

function rectLine(ctx, x0, y0, x1, y1) {
  ctx.fillRect(px(x0), py(y0), px(x1) - px(x0) + 1, 1)
  ctx.fillRect(px(x0), py(y1), px(x1) - px(x0) + 1, 1)
  ctx.fillRect(px(x0), py(y0), 1, py(y1) - py(y0) + 1)
  ctx.fillRect(px(x1), py(y0), 1, py(y1) - py(y0) + 1)
}

function drawGoal(ctx, left) {
  const depth = 8
  const y0 = py(CY - GOAL_HALF)
  const y1 = py(CY + GOAL_HALF)
  const x = left ? px(0) - depth : px(W)
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = 0; xx < depth; xx++) {
      if ((xx + yy) % 2 === 0) {
        ctx.fillStyle = '#c9d6c3'
        ctx.fillRect(x + xx, yy, 1, 1)
      }
    }
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y0 - 1, depth + 1, 2)
  ctx.fillRect(x, y1, depth + 1, 2)
  ctx.fillRect(left ? x : x + depth, y0 - 1, 2, y1 - y0 + 3)
}

export function renderPitch() {
  const c = document.createElement('canvas')
  c.width = CANVAS_W
  c.height = CANVAS_H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2b5f20'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const stripes = 12
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? GRASS_A : GRASS_B
    const x0 = px((W / stripes) * i)
    const x1 = px((W / stripes) * (i + 1))
    ctx.fillRect(x0, py(0) - 6, x1 - x0, py(H) - py(0) + 12)
  }
  ctx.fillStyle = LINE
  rectLine(ctx, 0, 0, W, H)
  ctx.fillRect(px(W / 2), py(0), 1, py(H) - py(0))
  for (const [x, y] of circlePoints(px(W / 2), py(CY), Math.round(9.15 * SCALE))) ctx.fillRect(x, y, 1, 1)
  ctx.fillRect(px(W / 2) - 1, py(CY) - 1, 3, 3)
  for (const left of [true, false]) {
    const gx = left ? 0 : W
    const dir = left ? 1 : -1
    const bx = gx + dir * BOX_DEPTH
    const sx = gx + dir * SIX_DEPTH
    rectLine(ctx, Math.min(gx, bx), CY - BOX_HALF, Math.max(gx, bx), CY + BOX_HALF)
    rectLine(ctx, Math.min(gx, sx), CY - SIX_HALF, Math.max(gx, sx), CY + SIX_HALF)
    const spot = gx + dir * PEN_SPOT
    ctx.fillRect(px(spot) - 1, py(CY), 2, 1)
    // The "D": the part of the 9.15 m circle around the spot that lies outside the box.
    for (const [x, y] of circlePoints(px(spot), py(CY), Math.round(9.15 * SCALE))) {
      if (left ? x > px(bx) : x < px(bx)) ctx.fillRect(x, y, 1, 1)
    }
    drawGoal(ctx, left)
  }
  // Corner arcs
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    for (const [x, y] of circlePoints(px(cx), py(cy), 4)) {
      if (x >= px(0) && x <= px(W) && y >= py(0) && y <= py(H)) ctx.fillRect(x, y, 1, 1)
    }
  }
  return c
}

const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
}

function drawNumber(ctx, n, cx, top, color) {
  const s = String(n)
  const w = s.length * 4 - 1
  let x = cx - Math.floor(w / 2)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x - 1, top - 1, w + 2, 7)
  ctx.fillStyle = color
  for (const ch of s) {
    const rows = DIGITS[ch]
    rows.forEach((row, y) => {
      for (let i = 0; i < 3; i++) if (row[i] === '1') ctx.fillRect(x + i, top + y, 1, 1)
    })
    x += 4
  }
}

export class SpriteCache {
  constructor() {
    this.map = new Map()
  }
  get(agent, kit, frame, back) {
    const key = `${agent.id}|${frame}|${back ? 1 : 0}|${agent.isGK ? 1 : 0}|${kit.shirt}`
    let c = this.map.get(key)
    if (!c) {
      c = document.createElement('canvas')
      c.width = 7
      c.height = 10
      drawGrid(c.getContext('2d'), pitchSprite(agent.data.appearance, kit, { frame, back, gk: agent.isGK }))
      this.map.set(key, c)
    }
    return c
  }
}

const lerp = (a, b, t) => a + (b - a) * t

export function drawMatch(ctx, s, pitch, cache, alpha = 1, opts = {}) {
  ctx.drawImage(pitch, 0, 0)
  const items = s.agents.map((a) => ({
    a,
    x: px(lerp(a.px, a.x, alpha)),
    y: py(lerp(a.py, a.y, alpha)),
  }))
  items.sort((p, q) => p.y - q.y)
  const b = s.ball
  const bx = px(lerp(b.px, b.x, alpha))
  const by = py(lerp(b.py, b.y, alpha))
  const bz = Math.round(lerp(b.pz, b.z, alpha) * SCALE)

  // Shadows first
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  for (const it of items) ctx.fillRect(it.x - 2, it.y, 5, 1)
  ctx.fillRect(bx - 1, by + 1, 3, 1)

  let ballDrawn = false
  const drawBall = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx - 1, by - 1 - bz, 3, 2)
    ctx.fillRect(bx, by - 2 - bz, 1, 1)
    ctx.fillStyle = '#222222'
    ctx.fillRect(bx, by - 1 - bz, 1, 1)
    ballDrawn = true
  }
  for (const it of items) {
    if (!ballDrawn && it.y > by) drawBall()
    const a = it.a
    const kit = s.teams[a.team].kit
    const moving = Math.abs(a.vx) + Math.abs(a.vy) > 0.6
    const frame = moving ? Math.floor(a.anim * 1.6) % 2 : 0
    const back = a.vy < -1.2 && Math.abs(a.vy) > Math.abs(a.vx)
    ctx.drawImage(cache.get(a, kit, frame, back), it.x - 3, it.y - 9)
    if (a === b.owner) {
      ctx.fillStyle = '#ffec27'
      ctx.fillRect(it.x - 1, it.y - 13, 3, 1)
      ctx.fillRect(it.x, it.y - 12, 1, 1)
    }
    if (opts.numbers) drawNumber(ctx, a.number, it.x, it.y - 18, a.team === opts.highlightTeam ? '#ffec27' : '#ffffff')
  }
  if (!ballDrawn) drawBall()
}

// Copies a zoomed window of the full frame, centred on the camera, onto the visible canvas.
export function blitCamera(ctx, frame, cam, zoom) {
  if (zoom <= 1) {
    ctx.drawImage(frame, 0, 0)
    return
  }
  const w = CANVAS_W / zoom
  const h = CANVAS_H / zoom
  const sx = Math.round(Math.max(0, Math.min(CANVAS_W - w, cam.x - w / 2)))
  const sy = Math.round(Math.max(0, Math.min(CANVAS_H - h, cam.y - h / 2)))
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(frame, sx, sy, w, h, 0, 0, CANVAS_W, CANVAS_H)
}
