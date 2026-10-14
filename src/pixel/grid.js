// Pixel grids are { w, h, px } where px is a flat array of '#rrggbb' or null (transparent).

export function createGrid(w, h, fill = null) {
  return { w, h, px: new Array(w * h).fill(fill) }
}

export function cloneGrid(g) {
  return { w: g.w, h: g.h, px: g.px.slice() }
}

export function getPx(g, x, y) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return undefined
  return g.px[y * g.w + x]
}

export function setPx(g, x, y, c) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return
  g.px[y * g.w + x] = c
}

// Builds a grid from rows of characters and a legend { char: color }.
export function fromRows(rows, legend) {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const g = createGrid(w, h)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = legend[row[x]]
      if (c) setPx(g, x, y, c)
    }
  })
  return g
}

// Stamps a character bitmap onto a grid.
export function stamp(g, rows, ox, oy, color) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.' && row[x] !== ' ') setPx(g, ox + x, oy + y, color)
  })
}

// Flood fill (breadth-first search): repaints the connected region of the
// clicked colour. A classic graph algorithm; each pixel is a node with 4 neighbours.
export function floodFill(g, x, y, color) {
  const target = getPx(g, x, y)
  if (target === undefined || target === color) return g
  const out = cloneGrid(g)
  const queue = [[x, y]]
  const seen = new Uint8Array(g.w * g.h)
  for (let head = 0; head < queue.length; head++) {
    const [cx, cy] = queue[head]
    const i = cy * g.w + cx
    if (seen[i]) continue
    seen[i] = 1
    if (out.px[i] !== target) continue
    out.px[i] = color
    if (cx > 0) queue.push([cx - 1, cy])
    if (cx < g.w - 1) queue.push([cx + 1, cy])
    if (cy > 0) queue.push([cx, cy - 1])
    if (cy < g.h - 1) queue.push([cx, cy + 1])
  }
  return out
}

// Bresenham's line algorithm: the integer-only way to rasterise a line.
export function linePoints(x0, y0, x1, y1) {
  const pts = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    pts.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
  return pts
}

export function rectPoints(x0, y0, x1, y1, filled) {
  const pts = []
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)]
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      if (filled || x === ax || x === bx || y === ay || y === by) pts.push([x, y])
    }
  }
  return pts
}

// Nearest-neighbour resize, used when loading art of a different size.
export function resizeGrid(g, w, h) {
  const out = createGrid(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.px[y * w + x] = getPx(g, Math.floor((x * g.w) / w), Math.floor((y * g.h) / h)) ?? null
    }
  }
  return out
}

export function drawGrid(ctx, g, ox = 0, oy = 0, scale = 1) {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.px[y * g.w + x]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale)
    }
  }
}

export function gridToDataUrl(g, scale = 8) {
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = g.w * scale
  c.height = g.h * scale
  drawGrid(c.getContext('2d'), g, 0, 0, scale)
  return c.toDataURL('image/png')
}

// Adds a 1-pixel outline around the opaque pixels (grid grows by 2 in each dimension).
export function withOutline(g, color = '#0b0f14') {
  const out = createGrid(g.w + 2, g.h + 2)
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (!g.px[y * g.w + x]) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (!getPx(g, nx, ny)) setPx(out, nx + 1, ny + 1, color)
      }
    }
  }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x]) setPx(out, x + 1, y + 1, g.px[y * g.w + x])
  return out
}
