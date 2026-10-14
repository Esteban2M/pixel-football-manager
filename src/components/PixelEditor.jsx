import { useCallback, useEffect, useRef, useState } from 'react'
import { cloneGrid, createGrid, floodFill, getPx, linePoints, rectPoints, resizeGrid, gridToDataUrl } from '../pixel/grid.js'
import { EDITOR_PALETTE } from '../pixel/palette.js'
import { PixelCanvas } from './Pixel.jsx'

const TOOLS = [
  { id: 'pencil', label: 'Lápiz', key: 'p' },
  { id: 'eraser', label: 'Borrar', key: 'e' },
  { id: 'fill', label: 'Cubeta', key: 'f' },
  { id: 'picker', label: 'Gotero', key: 'i' },
  { id: 'line', label: 'Línea', key: 'l' },
  { id: 'rect', label: 'Rect.', key: 'r' },
]

const VIEW = 384 // editor canvas size in CSS pixels

export default function PixelEditor({ initial, onSave, onCancel, onChange, saveLabel = 'Guardar', title = 'Editor de pixel art', extraActions }) {
  const [grid, setGrid] = useState(() => cloneGrid(initial ?? createGrid(16, 16)))
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState('#1352c9')
  const [mirror, setMirror] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const canvasRef = useRef(null)
  const gridRef = useRef(grid)
  const drag = useRef(null)
  gridRef.current = grid

  const cell = Math.floor(VIEW / grid.w)

  useEffect(() => {
    onChange?.(grid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid])

  // Draw the editing canvas: checkerboard for transparency, pixels, then grid lines.
  useEffect(() => {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const v = grid.px[y * grid.w + x]
        ctx.fillStyle = v ?? ((x + y) % 2 ? '#2a2f3a' : '#353b48')
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
    if (showGrid) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      for (let i = 0; i <= grid.w; i++) ctx.fillRect(i * cell, 0, 1, grid.h * cell)
      for (let i = 0; i <= grid.h; i++) ctx.fillRect(0, i * cell, grid.w * cell, 1)
    }
    if (mirror) {
      ctx.fillStyle = 'rgba(255,236,39,0.7)'
      ctx.fillRect((grid.w * cell) / 2 - 1, 0, 2, grid.h * cell)
    }
  }, [grid, cell, showGrid, mirror])

  const commit = useCallback((next) => {
    setPast((p) => [...p.slice(-49), gridRef.current])
    setFuture([])
    setGrid(next)
  }, [])

  const undo = () => {
    if (!past.length) return
    setFuture([grid, ...future])
    setGrid(past[past.length - 1])
    setPast(past.slice(0, -1))
  }

  const redo = () => {
    if (!future.length) return
    setPast([...past, grid])
    setGrid(future[0])
    setFuture(future.slice(1))
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase())
      if (t) setTool(t.id)
      if (e.key.toLowerCase() === 'm') setMirror((m) => !m)
      if (e.key.toLowerCase() === 'g') setShowGrid((g) => !g)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toCell = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * grid.w)
    const y = Math.floor(((e.clientY - r.top) / r.height) * grid.h)
    return [Math.max(0, Math.min(grid.w - 1, x)), Math.max(0, Math.min(grid.h - 1, y))]
  }

  const paint = (base, pts, c) => {
    const g = cloneGrid(base)
    for (const [x, y] of pts) {
      g.px[y * g.w + x] = c
      if (mirror) g.px[y * g.w + (g.w - 1 - x)] = c
    }
    return g
  }

  const onDown = (e) => {
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    const [x, y] = toCell(e)
    const c = tool === 'eraser' || e.button === 2 ? null : color
    if (tool === 'picker') {
      const v = getPx(grid, x, y)
      if (v) setColor(v)
      setTool('pencil')
      return
    }
    if (tool === 'fill') {
      let g = floodFill(grid, x, y, c)
      if (mirror) g = floodFill(g, grid.w - 1 - x, y, c)
      commit(g)
      return
    }
    drag.current = { start: [x, y], last: [x, y], base: grid, color: c }
    if (tool === 'pencil' || tool === 'eraser' || e.button === 2) {
      setPast((p) => [...p.slice(-49), grid])
      setFuture([])
      setGrid(paint(grid, [[x, y]], c))
      drag.current.freehand = true
    }
  }

  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const [x, y] = toCell(e)
    if (d.freehand) {
      // Bresenham between samples so fast strokes have no gaps.
      setGrid((g) => paint(g, linePoints(d.last[0], d.last[1], x, y), d.color))
      d.last = [x, y]
    } else if (tool === 'line') {
      setGrid(paint(d.base, linePoints(d.start[0], d.start[1], x, y), d.color))
    } else if (tool === 'rect') {
      setGrid(paint(d.base, rectPoints(d.start[0], d.start[1], x, y, e.shiftKey), d.color))
    }
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.freehand) {
      setPast((p) => [...p.slice(-49), d.base])
      setFuture([])
    }
  }

  const changeSize = (size) => {
    if (size === grid.w) return
    commit(resizeGrid(grid, size, size))
  }

  const exportPng = () => {
    const a = document.createElement('a')
    a.href = gridToDataUrl(grid, 16)
    a.download = 'pixel-art.png'
    a.click()
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="spacer" />
        {extraActions}
        {onCancel && (
          <button className="btn ghost sm" onClick={onCancel}>
            Cancelar
          </button>
        )}
        {onSave && (
          <button className="btn primary sm" onClick={() => onSave(grid)}>
            {saveLabel}
          </button>
        )}
      </div>
      <div className="editor">
        <div>
          <canvas
            ref={canvasRef}
            width={grid.w * cell}
            height={grid.h * cell}
            className="editor-canvas pixel"
            style={{ width: grid.w * cell }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Lienzo de pixel art"
          />
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Clic derecho borra · Mayús + Rect. = relleno · Ctrl+Z deshacer
          </p>
        </div>
        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <div>
            <h3>Herramientas</h3>
            <div className="tools">
              {TOOLS.map((t) => (
                <button key={t.id} className={`btn sm ${tool === t.id ? 'active' : 'ghost'}`} onClick={() => setTool(t.id)} title={`Atajo: ${t.key.toUpperCase()}`}>
                  {t.label}
                </button>
              ))}
              <button className={`btn sm ${mirror ? 'active' : 'ghost'}`} onClick={() => setMirror(!mirror)} title="Atajo: M">
                Espejo
              </button>
              <button className={`btn sm ${showGrid ? 'active' : 'ghost'}`} onClick={() => setShowGrid(!showGrid)} title="Atajo: G">
                Rejilla
              </button>
            </div>
          </div>
          <div className="row">
            <button className="btn ghost sm" onClick={undo} disabled={!past.length}>
              ↶ Deshacer
            </button>
            <button className="btn ghost sm" onClick={redo} disabled={!future.length}>
              ↷ Rehacer
            </button>
            <button className="btn ghost sm" onClick={() => commit(createGrid(grid.w, grid.h))}>
              Limpiar
            </button>
          </div>
          <div>
            <h3>Color</h3>
            <div className="row" style={{ marginBottom: 8 }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color personalizado" />
              <span className="chip">{color}</span>
            </div>
            <div className="swatches">
              {EDITOR_PALETTE.map((c) => (
                <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="row">
            <h3 style={{ margin: 0 }}>Tamaño</h3>
            {[16, 24, 32].map((s) => (
              <button key={s} className={`btn sm ${grid.w === s ? 'active' : 'ghost'}`} onClick={() => changeSize(s)}>
                {s}×{s}
              </button>
            ))}
          </div>
          <div>
            <h3>Vista previa</h3>
            <div className="row" style={{ alignItems: 'end' }}>
              <PixelCanvas grid={grid} scale={1} />
              <PixelCanvas grid={grid} scale={2} />
              <PixelCanvas grid={grid} scale={4} />
              <button className="btn ghost sm" onClick={exportPng}>
                Exportar PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
