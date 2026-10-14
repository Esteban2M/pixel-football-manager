// Pitch geometry in metres. x runs along the length, y across the width.
export const W = 105
export const H = 68
export const CY = H / 2
export const GOAL_HALF = 3.66
export const GOAL_TOP = CY - GOAL_HALF
export const GOAL_BOT = CY + GOAL_HALF
export const CROSSBAR = 2.44
export const BOX_DEPTH = 16.5
export const BOX_HALF = 20.16
export const SIX_DEPTH = 5.5
export const SIX_HALF = 9.16
export const PEN_SPOT = 11

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
// Math.sqrt is much faster than Math.hypot in V8, and these run millions of times per match.
export const dist = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}
export const len = (x, y) => Math.sqrt(x * x + y * y)

// Team t attacks +x in the first half when t === 0.
export function attackDir(s, t) {
  return (t === 0) === (s.half === 1) ? 1 : -1
}

// Team-relative (fx: 0 own goal .. 1 opponent goal, fy: 0 left .. 1 right) to world.
export function toWorld(s, t, fx, fy) {
  return attackDir(s, t) > 0 ? { x: fx * W, y: fy * H } : { x: (1 - fx) * W, y: (1 - fy) * H }
}

export function toTeam(s, t, x, y) {
  return attackDir(s, t) > 0 ? { fx: x / W, fy: y / H } : { fx: 1 - x / W, fy: 1 - y / H }
}

export function oppGoal(s, t) {
  return { x: attackDir(s, t) > 0 ? W : 0, y: CY }
}

export function ownGoal(s, t) {
  return { x: attackDir(s, t) > 0 ? 0 : W, y: CY }
}

// Is (x,y) inside the penalty box that team t defends?
export function inOwnBox(s, t, x, y) {
  const g = ownGoal(s, t)
  return Math.abs(x - g.x) <= BOX_DEPTH && Math.abs(y - CY) <= BOX_HALF
}

export function inOppBox(s, t, x, y) {
  const g = oppGoal(s, t)
  return Math.abs(x - g.x) <= BOX_DEPTH && Math.abs(y - CY) <= BOX_HALF
}

// Angle (radians) the goal mouth covers from a point: the bigger, the easier the shot.
export function goalAngle(px, py, goalX) {
  const a1 = Math.atan2(GOAL_TOP - py, goalX - px)
  const a2 = Math.atan2(GOAL_BOT - py, goalX - px)
  let d = Math.abs(a1 - a2)
  if (d > Math.PI) d = 2 * Math.PI - d
  return d
}

// Distance from point P to segment AB and the projection parameter t in [0,1].
export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1)
  return { d: dist2(px, py, ax + t * dx, ay + t * dy), t }
}
