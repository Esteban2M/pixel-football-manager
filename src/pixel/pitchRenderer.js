// Draws the match on a low-resolution canvas that CSS scales up with crisp pixels.
import { W, H, CY, GOAL_HALF, BOX_DEPTH, BOX_HALF, SIX_DEPTH, SIX_HALF, PEN_SPOT } from '../game/engine/geometry.js'
import { drawGrid, withOutline } from './grid.js'
import { pitchSprite, bodyOf } from './sprites.js'
import { createRng } from '../game/rng.js'

export const SCALE = 4 // pixels per metre
export const MARGIN = 30 // room for the apron, ad boards and stands
export const CANVAS_W = Math.round(W * SCALE + MARGIN * 2)
export const CANVAS_H = Math.round(H * SCALE + MARGIN * 2)

const GRASS_A = '#4fb83d'
const GRASS_B = '#44a834'
const GRASS_DARK = '#3d9a2f'
const GRASS_LIGHT = '#5cc649'
const LINE = '#ffffff'
const BOARD_COLORS = ['#ff004d', '#ffec27', '#29adff', '#00e436', '#ff77a8', '#ffa300', '#7e2553', '#ffffff']

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

// Stands full of supporters in both teams' colours. Two frames so the crowd can "bounce".
function drawStands(ctx, kits, rng, frame) {
  const fans = [kits[0].shirt, kits[0].shirt, kits[0].trim, kits[0].shirt, kits[1].shirt, kits[1].trim]
  const misc = ['#f6d5b8', '#d39b6a', '#8a5a36', '#ffffff', '#ff004d', '#ffec27']
  ctx.fillStyle = '#20243f'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const inner = { x0: px(0) - 22, y0: py(0) - 22, x1: px(W) + 22, y1: py(H) + 22 }
  for (let y = 0; y < CANVAS_H; y += 2) {
    for (let x = 0; x < CANVAS_W; x += 2) {
      if (x >= inner.x0 && x <= inner.x1 && y >= inner.y0 && y <= inner.y1) continue
      // Tiers: every 6 px a darker concrete step
      if (Math.floor(y / 2) % 3 === 2 && (y < inner.y0 || y > inner.y1)) {
        ctx.fillStyle = '#2d3358'
        ctx.fillRect(x, y, 2, 1)
        continue
      }
      const r = rng.next()
      if (r < 0.12) continue
      // Away fans gather in one corner of the stadium.
      const awayZone = x > CANVAS_W * 0.78 && y < CANVAS_H * 0.5
      const pool = awayZone ? [kits[1].shirt, kits[1].trim, kits[1].shirt] : r < 0.85 ? fans.slice(0, 4) : misc
      ctx.fillStyle = pool[Math.floor(rng.next() * pool.length)]
      const jump = frame === 1 && rng.next() < 0.35 ? -1 : 0
      ctx.fillRect(x, y + jump, 1, 1)
      ctx.fillStyle = misc[Math.floor(rng.next() * 3)]
      ctx.fillRect(x, y + jump - 1, 1, 1)
    }
  }
}

function drawBoards(ctx, rng) {
  const y0 = py(0) - 14
  const y1 = py(H) + 10
  const x0 = px(0) - 14
  const x1 = px(W) + 10
  const seg = 24
  let i = Math.floor(rng.next() * BOARD_COLORS.length)
  const band = (x, y, w, h, vertical) => {
    const len = vertical ? h : w
    for (let o = 0; o < len; o += seg) {
      const c = BOARD_COLORS[i++ % BOARD_COLORS.length]
      ctx.fillStyle = c
      if (vertical) ctx.fillRect(x, y + o, w, Math.min(seg - 1, len - o))
      else ctx.fillRect(x + o, y, Math.min(seg - 1, len - o), h)
      // A tiny "logo" stripe in the middle of each panel
      ctx.fillStyle = c === '#ffffff' || c === '#ffec27' ? '#1d2b53' : '#ffffff'
      if (vertical) ctx.fillRect(x + 1, y + o + 8, w - 2, 6)
      else ctx.fillRect(x + o + 6, y + 1, 10, h - 2)
    }
  }
  band(x0, y0, x1 - x0 + 4, 4, false)
  band(x0, y1, x1 - x0 + 4, 4, false)
  band(x0, y0 + 6, 4, y1 - y0 - 8, true)
  band(x1, y0 + 6, 4, y1 - y0 - 8, true)
}

export function renderPitch(kits = [{ shirt: '#1352c9', trim: '#ffffff' }, { shirt: '#ffe11b', trim: '#00205b' }]) {
  return [0, 1].map((frame) => {
    const c = document.createElement('canvas')
    c.width = CANVAS_W
    c.height = CANVAS_H
    const ctx = c.getContext('2d')
    drawStands(ctx, kits, createRng(`crowd-${frame}`), frame)
    // Grass apron around the field
    ctx.fillStyle = GRASS_DARK
    ctx.fillRect(px(0) - 18, py(0) - 18, px(W) - px(0) + 36, py(H) - py(0) + 36)
    drawBoards(ctx, createRng('boards'))
    // Mowing stripes in a checker pattern, plus grass texture
    const stripes = 14
    const bands = 6
    for (let i = 0; i < stripes; i++) {
      for (let j = 0; j < bands; j++) {
        ctx.fillStyle = (i + (j % 2 ? 0 : 0)) % 2 === 0 ? (j % 2 ? GRASS_A : '#4bb33a') : j % 2 ? GRASS_B : '#41a232'
        const x0 = px((W / stripes) * i)
        const x1 = px((W / stripes) * (i + 1))
        const y0 = j === 0 ? py(0) - 6 : py((H / bands) * j)
        const y1 = j === bands - 1 ? py(H) + 6 : py((H / bands) * (j + 1))
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
    }
    const tex = createRng('grass')
    for (let k = 0; k < 900; k++) {
      ctx.fillStyle = tex.next() < 0.5 ? GRASS_LIGHT : GRASS_DARK
      ctx.fillRect(px(tex.range(0, W)), py(tex.range(0, H)), 1, 1)
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
      ctx.fillStyle = LINE
    }
    // Corner arcs and flags
    for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      ctx.fillStyle = LINE
      for (const [x, y] of circlePoints(px(cx), py(cy), 4)) {
        if (x >= px(0) && x <= px(W) && y >= py(0) && y <= py(H)) ctx.fillRect(x, y, 1, 1)
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(px(cx), py(cy) - 7, 1, 7)
      ctx.fillStyle = frame ? '#ff004d' : '#ffec27'
      ctx.fillRect(px(cx) + 1, py(cy) - 7, 3, 2)
    }
    return c
  })
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
      const g = withOutline(pitchSprite(agent.data.appearance, kit, { frame, back, gk: agent.isGK, body: bodyOf(agent.data) }))
      c = document.createElement('canvas')
      c.width = g.w
      c.height = g.h
      drawGrid(c.getContext('2d'), g)
      this.map.set(key, c)
    }
    return c
  }
}

const lerp = (a, b, t) => a + (b - a) * t

export function drawMatch(ctx, s, pitch, cache, alpha = 1, opts = {}) {
  // The crowd bounces faster after a goal.
  const beat = s.phase === 'goal' ? 0.12 : 0.6
  const frames = Array.isArray(pitch) ? pitch : [pitch]
  ctx.drawImage(frames[Math.floor((opts.now ?? 0) / 1000 / beat) % frames.length], 0, 0)
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
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  for (const it of items) {
    ctx.fillRect(it.x - 3, it.y, 7, 1)
    ctx.fillRect(it.x - 2, it.y + 1, 5, 1)
  }
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
    const spr = cache.get(a, kit, frame, back)
    ctx.drawImage(spr, it.x - 4, it.y - spr.height + 2)
    if (a === b.owner) {
      ctx.fillStyle = '#ffec27'
      ctx.fillRect(it.x - 1, it.y - 17, 3, 1)
      ctx.fillRect(it.x, it.y - 16, 1, 1)
    }
    if (opts.numbers) drawNumber(ctx, a.number, it.x, it.y - 22, a.team === opts.highlightTeam ? '#ffec27' : '#ffffff')
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
