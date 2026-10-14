// Player AI: where to stand without the ball, and what to do with it.
import {
  W, H, CY, clamp, lerp, dist, dist2, len, toWorld, toTeam, oppGoal, ownGoal, inOppBox, goalAngle, segmentDistance,
} from './geometry.js'

// Effective attribute: base value scaled by fitness, morale and position familiarity.
export const attr = (p, k) => p.attrs[k] * p.form

export function maxSpeed(p) {
  return (5.2 + p.attrs.pace * 0.12) * (0.78 + 0.22 * (p.energy / 100)) * (p.injured ? 0.55 : 1)
}

export function opponents(s, p) {
  return s.teams[1 - p.team].agents
}

export function nearestOpponent(s, p, x = p.x, y = p.y) {
  let best = null
  let bd = Infinity
  for (const o of opponents(s, p)) {
    const d = dist2(o.x, o.y, x, y)
    if (d < bd) {
      bd = d
      best = o
    }
  }
  return { o: best, d: bd }
}

// Team t's attackers are offside beyond this line (team-relative x): the second-last defender.
export function offsideLine(s, t) {
  const xs = s.teams[1 - t].agents.map((o) => toTeam(s, t, o.x, o.y).fx).sort((a, b) => b - a)
  const second = xs.length > 1 ? xs[1] : 1
  return Math.max(second, 0.5)
}

export function isOffside(s, q, line = offsideLine(s, q.team)) {
  const { fx } = toTeam(s, q.team, q.x, q.y)
  const ballFx = toTeam(s, q.team, s.ball.x, s.ball.y).fx
  return fx > 0.5 && fx > line + 0.004 && fx > ballFx
}

// How dangerous a spot is for team t (a rough "expected threat").
export function posValue(s, t, x, y) {
  const g = oppGoal(s, t)
  const dg = dist2(x, y, g.x, g.y)
  const { fx } = toTeam(s, t, x, y)
  return 0.03 + 0.5 * Math.exp(-dg / 13) + 0.3 * fx
}

function lossCost(s, t, x, y) {
  const { fx } = toTeam(s, t, x, y)
  return 0.05 + 0.22 * (1 - fx) ** 2
}

// Simple expected-goals estimate from distance, angle, blockers and finishing.
export function shotXg(s, p) {
  const g = oppGoal(s, p.team)
  const d = dist(p, g)
  const ang = goalAngle(p.x, p.y, g.x)
  let logit = -1.15 + 1.6 * ang - 0.085 * d + (attr(p, 'finishing') - 10) * 0.07
  let blockers = 0
  for (const o of opponents(s, p)) {
    if (o.isGK) continue
    const sd = segmentDistance(o.x, o.y, p.x, p.y, g.x, g.y)
    if (sd.t > 0.04 && sd.t < 0.95 && sd.d < 1.1 + sd.t * 1.4) blockers++
  }
  logit -= blockers * 0.45
  if (nearestOpponent(s, p).d < 1.5) logit -= 0.4
  return 1 / (1 + Math.exp(-logit))
}

function passSuccess(s, p, pt, d, lofted, press) {
  let base = (lofted ? 0.9 : 0.97) - d * (lofted ? 0.007 : 0.0055) + (attr(p, 'passing') - 10) * 0.012
  if (press < 1.5) base -= 0.14
  else if (press < 3) base -= 0.05
  // Ground passes travel at roughly v0 = 0.55 d + 8.5 m/s and slow down on the way.
  const avg = lofted ? d / (0.55 + d / 22) : (0.55 * d + 17) / 2
  let lane = 1
  for (const o of opponents(s, p)) {
    const sd = segmentDistance(o.x, o.y, p.x, p.y, pt.x, pt.y)
    if (lofted && sd.t < 0.8) continue
    const tReach = (sd.t * d) / avg
    const reach = 0.9 + Math.max(0, tReach - 0.2) * 4.2
    if (sd.d < reach) lane *= 1 - 0.85 * (1 - sd.d / reach)
  }
  const near = nearestOpponent(s, p, pt.x, pt.y).d
  const open = near < 1.5 ? 0.65 : near < 3 ? 0.85 : 1
  return clamp(base, 0.05, 0.98) * lane * open
}

// Crosses are aerial duels: what matters is how crowded the landing zone is.
function crossSuccess(s, p, pt) {
  let near = 0
  for (const o of opponents(s, p)) if (dist2(o.x, o.y, pt.x, pt.y) < 2.5) near++
  return clamp(0.55 + (attr(p, 'passing') - 10) * 0.02 - near * 0.12, 0.1, 0.8)
}

function leadPoint(p, q) {
  const d = dist(p, q)
  const tt = 0.25 + d / 16
  let x = q.x + q.vx * tt * 0.8
  let y = q.y + q.vy * tt * 0.8
  if (q.runTimer > 0 && q.runTarget) {
    x = lerp(x, q.runTarget.x, 0.45)
    y = lerp(y, q.runTarget.y, 0.45)
  }
  return { x: clamp(x, 1, W - 1), y: clamp(y, 1, H - 1) }
}

function dribbleDir(s, p) {
  const g = oppGoal(s, p.team)
  const own = toTeam(s, p.team, p.x, p.y)
  const wide = ['LW', 'RW', 'LB', 'RB'].includes(p.role) && Math.abs(own.fy - 0.5) > 0.25 && own.fx < 0.86
  let dx = g.x - p.x
  let dy = (g.y - p.y) * (wide ? 0.15 : 0.6)
  let l = len(dx, dy) || 1
  dx /= l
  dy /= l
  for (const o of opponents(s, p)) {
    const ox = o.x - p.x
    const oy = o.y - p.y
    const d = len(ox, oy)
    if (d < 8 && d > 0.01 && ox * dx + oy * dy > -1) {
      const w = (8 - d) / 8
      dx -= (ox / d) * w * 1.1
      dy -= (oy / d) * w * 1.1
    }
  }
  if (p.y < 4) dy += 0.6
  if (p.y > H - 4) dy -= 0.6
  const fwd = Math.sign(g.x - p.x)
  if (dx * fwd < -0.2) dx = -0.2 * fwd
  l = len(dx, dy) || 1
  return { x: dx / l, y: dy / l }
}

// Decision for the ball carrier: the option with the best expected value wins.
export function chooseAction(s, p, opts = {}) {
  const t = p.team
  const tac = s.teams[t].tactics
  const rng = s.rng
  const press = nearestOpponent(s, p).d
  const { fx, fy } = toTeam(s, t, p.x, p.y)
  const g = oppGoal(s, t)
  const dGoal = dist(p, g)
  const noise = 0.03 * (1.5 - (attr(p, 'passing') + attr(p, 'positioning')) / 40)
  const riskMul = 1 - tac.mentality * 0.12 + (tac.tempo === 0 ? 0.15 : 0)
  const line = offsideLine(s, t)
  const options = []

  if (!p.isGK && !opts.passOnly && dGoal < 32 && fx > 0.6) {
    const xg = shotXg(s, p)
    const bias = 1.2 + tac.mentality * 0.1 + (attr(p, 'finishing') - 10) * 0.03
    options.push({ type: 'shoot', u: xg * bias * 2.4 + (dGoal < 9 ? 0.15 : 0), xg })
  }

  for (const q of s.teams[t].agents) {
    if (q === p) continue
    const pt = leadPoint(p, q)
    const d = dist(p, pt)
    if (d < 5 || d > (opts.maxDist ?? 50)) continue
    if (q.isGK && press > 3) continue
    if (isOffside(s, q, line) && !rng.chance(0.04)) continue
    const qfx = toTeam(s, t, pt.x, pt.y).fx
    const cross = inOppBox(s, t, pt.x, pt.y) && Math.abs(fy - 0.5) > 0.28 && fx > 0.72
    const lofted = !opts.noLoft && (d > 30 || cross)
    const pS = cross ? crossSuccess(s, p, pt) : passSuccess(s, p, pt, d, lofted, press)
    let v = posValue(s, t, pt.x, pt.y) * (cross ? 1.05 : 1)
    v += (qfx - fx) * (tac.tempo - 1) * 0.05
    if (p.isGK && d > 35) v += 0.02 * tac.tempo
    const u = pS * v - (1 - pS) * lossCost(s, t, pt.x, pt.y) * riskMul
    options.push({ type: 'pass', to: q, x: pt.x, y: pt.y, lofted, cross, u })
  }

  // Wide in the final third: whip a cross towards the far post area.
  if (!p.isGK && fx > 0.74 && Math.abs(fy - 0.5) > 0.27) {
    const zone = toWorld(s, t, rng.range(0.9, 0.95), fy < 0.5 ? rng.range(0.5, 0.6) : rng.range(0.4, 0.5))
    let target = null
    let bd = Infinity
    for (const q of s.teams[t].agents) {
      if (q === p || q.isGK) continue
      const d = dist(q, zone)
      if (d < bd) {
        bd = d
        target = q
      }
    }
    if (target && bd < 12) {
      const pS = crossSuccess(s, p, zone) * (bd < 4 ? 1 : 0.8)
      const u = pS * posValue(s, t, zone.x, zone.y) * 0.9 - (1 - pS) * lossCost(s, t, zone.x, zone.y) * riskMul
      options.push({ type: 'pass', to: target, x: zone.x, y: zone.y, lofted: true, cross: true, u })
    }
  }

  if (!p.isGK && !opts.passOnly) {
    const dir = dribbleDir(s, p)
    const ax = clamp(p.x + dir.x * 6, 0.5, W - 0.5)
    const ay = clamp(p.y + dir.y * 6, 0.5, H - 0.5)
    const space = nearestOpponent(s, p, ax, ay).d
    const pKeep = clamp(0.25 + space * 0.07 + (attr(p, 'dribbling') - 10) * 0.025 - (press < 1.8 ? 0.2 : 0), 0.05, 0.95)
    options.push({
      type: 'dribble',
      x: ax,
      y: ay,
      u: pKeep * posValue(s, t, ax, ay) - (1 - pKeep) * lossCost(s, t, p.x, p.y) * riskMul + (space > 8 ? 0.03 : 0),
    })
    if (fx < 0.3 && press < 2.5) options.push({ type: 'clear', u: 0.05 })
  }

  if (!options.length) return { type: 'clear' }
  let best = options[0]
  let bu = -Infinity
  for (const o of options) {
    const u = o.u + rng.gauss() * noise
    if (u > bu) {
      bu = u
      best = o
    }
  }
  return best
}

// ----- Off-ball positioning -----

export function shapeTarget(s, a, ctx) {
  const T = s.teams[a.team]
  const slot = T.slots[a.slot]
  const tac = T.tactics
  const b = ctx.ballTeam[a.team]
  const inPoss = ctx.possTeam === a.team
  const line = ROLE_LINE[slot.role]
  let fx = slot.x
  let fy = slot.y
  const ment = tac.mentality * 0.025
  if (inPoss) {
    fx += 0.1 + (b.fx - 0.5) * 0.5 + ment + (line === 'DF' && slot.role !== 'CB' ? tac.mentality * 0.03 : 0)
    fy = 0.5 + (fy - 0.5) * (1 + (tac.width - 1) * 0.18)
    fy += (b.fy - 0.5) * 0.22
    if (a.runTimer <= 0) fx = Math.min(fx, ctx.offsideLine[a.team] - 0.008)
  } else {
    fx += 0.06 + (b.fx - 0.5) * 0.45 + ment * 0.6 + (tac.pressing - 1) * 0.03
    fy = 0.5 + (fy - 0.5) * 0.78
    fy += (b.fy - 0.5) * 0.32
    if (line === 'DF') fx = Math.min(fx, b.fx - 0.03)
  }
  return toWorld(s, a.team, clamp(fx, 0.03, 0.97), clamp(fy, 0.03, 0.97))
}

const ROLE_LINE = { GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', DM: 'MF', CM: 'MF', AM: 'MF', LW: 'FW', RW: 'FW', ST: 'FW' }

export function gkTarget(s, a, ctx) {
  const g = ownGoal(s, a.team)
  const b = ctx.ballTeam[a.team]
  if (ctx.possTeam === a.team && b.fx > 0.35) {
    return toWorld(s, a.team, 0.04 + (b.fx - 0.35) * 0.12, 0.5)
  }
  const d = dist(s.ball, g)
  const off = clamp(d * 0.09, 0.6, 5)
  const ang = Math.atan2(s.ball.y - g.y, s.ball.x - g.x)
  return { x: g.x + Math.cos(ang) * off, y: clamp(g.y + Math.sin(ang) * off, CY - 4.5, CY + 4.5) }
}

function choosePressers(s, t, ctx) {
  const c = ctx.carrier
  const tac = s.teams[t].tactics
  const bfx = ctx.ballTeam[t].fx
  const engaged = tac.pressing === 2 || (tac.pressing === 1 ? bfx < 0.7 : bfx < 0.45)
  const sorted = s.teams[t].agents.filter((a) => !a.isGK).sort((a, b) => dist(a, c) - dist(b, c))
  const n = !engaged ? 1 : tac.pressing === 2 || bfx < 0.3 ? 2 : 1
  return { first: sorted[0], second: n > 1 ? sorted[1] : null, engaged: engaged && !c.holding }
}

// Greedy man-marking: pair each defender with the closest free attacker near his zone.
function assignMarks(s, t, ctx, shape, press) {
  const pairs = []
  const opps = s.teams[1 - t].agents.filter((o) => !o.isGK && o !== ctx.carrier)
  for (const a of s.teams[t].agents) {
    if (a.isGK || (press && (a === press.first || a === press.second))) continue
    const st = shape.get(a)
    for (const o of opps) {
      const d = dist(st, o)
      if (d < 14) pairs.push({ a, o, d })
    }
  }
  pairs.sort((x, y) => x.d - y.d)
  const marks = new Map()
  const taken = new Set()
  for (const { a, o } of pairs) {
    if (marks.has(a) || taken.has(o)) continue
    marks.set(a, o)
    taken.add(o)
  }
  return marks
}

export function planOffBall(s, ctx) {
  const plans = new Map()
  const rng = s.rng
  for (const t of [0, 1]) {
    const T = s.teams[t]
    const tac = T.tactics
    const inPoss = ctx.possTeam === t
    const shape = new Map()
    for (const a of T.agents) if (!a.isGK) shape.set(a, shapeTarget(s, a, ctx))
    const press = ctx.carrier && ctx.carrier.team !== t ? choosePressers(s, t, ctx) : null
    const marks = !inPoss ? assignMarks(s, t, ctx, shape, press) : null
    const og = ownGoal(s, t)

    for (const a of T.agents) {
      if (a === ctx.carrier) continue
      let target
      let urg
      if (a.dive) {
        target = a.dive
        urg = 1.4
      } else if (ctx.chasers[t] === a) {
        target = ctx.intercepts[t]
        urg = 1
      } else if (a.isGK) {
        target = gkTarget(s, a, ctx)
        urg = 0.85
      } else if (press && press.first === a) {
        const c = ctx.carrier
        const gap = c.holding ? 7 : press.engaged ? 0.6 : 3.5
        const ang = Math.atan2(og.y - c.y, og.x - c.x)
        target = { x: c.x + Math.cos(ang) * gap, y: c.y + Math.sin(ang) * gap }
        urg = press.engaged ? 1 : 0.8
      } else if (press && press.second === a) {
        const c = ctx.carrier
        const st = shape.get(a)
        target = { x: lerp(st.x, c.x, 0.6), y: lerp(st.y, c.y, 0.6) }
        urg = 0.9
      } else {
        target = shape.get(a)
        if (inPoss && ctx.carrier) {
          // Forward runs in behind the defensive line.
          if (a.runTimer > 0 && a.runTarget) {
            target = a.runTarget
            urg = 1
          } else if (['ST', 'LW', 'RW', 'AM'].includes(a.role)) {
            const afx = toTeam(s, t, a.x, a.y).fx
            const rate = 0.18 + tac.tempo * 0.06 + tac.mentality * 0.04
            if (ctx.ballTeam[t].fx > 0.35 && afx > ctx.offsideLine[t] - 0.07 && rng.chance(rate * ctx.dt)) {
              const rfx = Math.min(0.96, ctx.offsideLine[t] + rng.range(0.08, 0.16))
              const afy = toTeam(s, t, a.x, a.y).fy
              a.runTarget = toWorld(s, t, rfx, afy + (0.5 - afy) * 0.3)
              a.runTimer = 2.2
              if (ctx.carrier.decide > 0.15) ctx.carrier.decide = 0.15
            }
          }
          // Offer a short option near the carrier.
          const dc = dist(target, ctx.carrier)
          if (dc < 25 && a.runTimer <= 0) {
            target = { x: lerp(target.x, ctx.carrier.x, 0.12), y: lerp(target.y, ctx.carrier.y, 0.12) }
            const d2 = dist(target, ctx.carrier)
            if (d2 < 8) {
              const k = 8 / (d2 || 1)
              target = { x: ctx.carrier.x + (target.x - ctx.carrier.x) * k, y: ctx.carrier.y + (target.y - ctx.carrier.y) * k }
            }
          }
        } else if (marks && marks.has(a)) {
          const o = marks.get(a)
          const ang = Math.atan2(og.y - o.y, og.x - o.x)
          const gx = o.x + Math.cos(ang) * 1.5
          const gy = o.y + Math.sin(ang) * 1.5
          const ofx = toTeam(s, t, o.x, o.y).fx
          const line = ROLE_LINE[a.role]
          const wgt = (line === 'DF' ? 0.65 : line === 'MF' ? 0.45 : 0.2) + (ofx < 0.35 ? 0.15 : 0)
          target = { x: lerp(target.x, gx, wgt), y: lerp(target.y, gy, wgt) }
        }
        if (urg === undefined) {
          const dd = dist(a, target)
          urg = dd > 10 ? 0.9 : dd > 4 ? 0.7 : 0.5
        }
      }
      plans.set(a, { x: clamp(target.x, -1, W + 1), y: clamp(target.y, -1, H + 1), urg })
    }
  }
  return plans
}
