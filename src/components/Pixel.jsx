import { useEffect, useMemo, useRef } from 'react'
import { drawGrid } from '../pixel/grid.js'
import { portraitGrid, pitchSprite } from '../pixel/sprites.js'

// Renders a pixel grid as a crisp canvas at an integer scale.
export function PixelCanvas({ grid, scale = 4, className = '', title, style }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !grid) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    drawGrid(ctx, grid, 0, 0, scale)
  }, [grid, scale])
  if (!grid) return null
  return (
    <canvas
      ref={ref}
      width={grid.w * scale}
      height={grid.h * scale}
      className={`pixel ${className}`}
      title={title}
      style={style}
      aria-label={title}
      role="img"
    />
  )
}

export function Crest({ team, size = 32 }) {
  if (!team?.crest) return null
  return <PixelCanvas grid={team.crest} scale={Math.max(1, Math.round(size / team.crest.w))} title={team.name} />
}

export function playerPortraitGrid(player, team) {
  if (player.portrait) return player.portrait
  return portraitGrid(player.appearance, team?.kits?.home ?? { shirt: '#888888', trim: '#ffffff', pattern: 0 })
}

export function Portrait({ player, team, size = 32 }) {
  const grid = useMemo(() => playerPortraitGrid(player, team), [player, team])
  return <PixelCanvas grid={grid} scale={Math.max(1, Math.round(size / grid.w))} title={player.name} />
}

export function PitchSpritePreview({ appearance, kit, gk = false, scale = 6, body }) {
  const grids = useMemo(
    () => [0, 1].map((frame) => pitchSprite(appearance, kit, { frame, gk, body })).concat([pitchSprite(appearance, kit, { back: true, gk, body })]),
    [appearance, kit, gk, body],
  )
  return (
    <div className="row" style={{ gap: 6, alignItems: 'end' }}>
      {grids.map((g, i) => (
        <PixelCanvas key={i} grid={g} scale={scale} />
      ))}
    </div>
  )
}

const OVR_COLORS = [
  [80, '#00e436'],
  [70, '#a8e61d'],
  [60, '#ffec27'],
  [50, '#ffa300'],
  [0, '#ff6b6b'],
]

export function Ovr({ value }) {
  const bg = OVR_COLORS.find(([min]) => value >= min)[1]
  return (
    <span className="ovr" style={{ background: bg }}>
      {value}
    </span>
  )
}

export function Bar({ value, max = 100, color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const c = color ?? (pct > 75 ? 'var(--good)' : pct > 50 ? 'var(--accent)' : pct > 30 ? 'var(--warn)' : 'var(--bad)')
  return (
    <div className="bar" title={`${Math.round(value)}%`}>
      <i style={{ width: `${pct}%`, background: c }} />
    </div>
  )
}

export function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

const MORALE = { '-2': '😣', '-1': '😕', 0: '😐', 1: '🙂', 2: '😄' }
export function MoraleIcon({ value }) {
  return <span title={`Moral ${value}`}>{MORALE[value] ?? '😐'}</span>
}
