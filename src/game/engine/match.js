// Match engine: a fixed-timestep 2D simulation of 22 agents and a ball.
// The same code drives the live pixel view and instant (headless) results.
import { createRng } from '../rng.js'
import { FORMATIONS } from '../formations.js'
import { familiarity, ratingInSlot } from '../player.js'
import { resolveLineup, benchFor, pickKits } from '../team.js'
import {
  W, H, CY, GOAL_TOP, GOAL_BOT, CROSSBAR, PEN_SPOT, clamp, dist, dist2, len, attackDir, toWorld, toTeam,
  oppGoal, ownGoal, inOwnBox, inOppBox, goalAngle,
} from './geometry.js'
import { attr, maxSpeed, chooseAction, planOffBall, shapeTarget, nearestOpponent, isOffside, shotXg } from './ai.js'
import { line } from './commentary.js'

export const HALF_SECONDS = 300 // simulated seconds per half (the clock is scaled to 45')
export const DT = 0.05
export const MAX_SUBS = 5
const GRAV = 9.8
const ROLL_FRICTION = 0.55

// ---------- setup ----------

function newStats() {
  return { shots: 0, onTarget: 0, xg: 0, possession: 0, passes: 0, passesOk: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, offsides: 0, saves: 0, tackles: 0 }
}

function makeAgent(player, team, slot, role) {
  const a = {
    id: player.id,
    data: player,
    team,
    slot,
    role,
    name: player.name,
    short: player.short,
    number: player.number,
    attrs: player.attrs,
    isGK: role === 'GK',
    fam: familiarity(player, role),
    morale: player.morale ?? 0,
    energy: player.condition ?? 100,
    form: 1,
    x: W / 2,
    y: CY,
    vx: 0,
    vy: 0,
    px: W / 2,
    py: CY,
    faceX: 1,
    faceY: 0,
    cooldown: 0,
    noTouch: 0,
    touchTry: 0,
    decide: 0,
    dribbleTarget: null,
    runTimer: 0,
    runTarget: null,
    receiving: 0,
    holding: false,
    dive: null,
    diveDelay: 0,
    yellow: 0,
    sentOff: false,
    injured: false,
    enteredAt: 0,
    leftAt: null,
    anim: 0,
    perf: { passes: 0, passesOk: 0, shots: 0, onTarget: 0, goals: 0, assists: 0, tackles: 0, interceptions: 0, saves: 0, fouls: 0, keyPasses: 0, conceded: 0 },
  }
  updateForm(a)
  return a
}

function updateForm(a) {
  a.form = (0.7 + 0.3 * a.fam) * (1 + a.morale * 0.02) * (0.82 + 0.18 * (a.energy / 100))
}

export function createMatch({ home, away, seed = Date.now(), userSide = null, autoSubs = [true, true] }) {
  const rng = createRng(seed)
  const kits = pickKits(home, away)
  const s = {
    rng,
    seed,
    time: 0,
    totalTime: 0,
    half: 1,
    phase: 'restart',
    timer: 0,
    teams: [],
    agents: [],
    ball: { x: W / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, px: W / 2, py: CY, pz: 0, owner: null, lastTouch: null, pass: null, shot: null },
    restart: null,
    score: [0, 0],
    stats: [newStats(), newStats()],
    events: [],
    goals: [],
    possession: 0,
    lastPass: null,
    firstKickoff: 0,
    userSide,
    autoSubs,
    aiChecks: [{}, {}],
    result: null,
    diag: {},
  }
  ;[home, away].forEach((team, t) => {
    const lineup = resolveLineup(team)
    const slots = FORMATIONS[team.tactics.formation]
    const agents = []
    lineup.forEach((id, i) => {
      const p = team.players.find((pl) => pl.id === id)
      if (p) agents.push(makeAgent(p, t, i, slots[i].role))
    })
    s.teams.push({
      def: team,
      tactics: { ...team.tactics },
      slots,
      agents,
      bench: benchFor(team, lineup),
      subsLeft: MAX_SUBS,
      used: [],
      kit: kits[t],
    })
  })
  refreshAgents(s)
  setupKickoff(s, 0, true)
  addEvent(s, 'kickoff', null)
  return s
}

function refreshAgents(s) {
  s.agents = s.teams[0].agents.concat(s.teams[1].agents)
}

// ---------- clock & events ----------

export function minuteOf(s) {
  const m = Math.floor((Math.min(s.time, HALF_SECONDS) / HALF_SECONDS) * 45) + 1
  return Math.min(45, m) + (s.half - 1) * 45
}

export function clockLabel(s) {
  if (s.phase === 'fulltime') return "90'"
  if (s.phase === 'halftime') return 'MT'
  const base = (s.half - 1) * 45
  if (s.time > HALF_SECONDS) return `${base + 45}+${Math.ceil(((s.time - HALF_SECONDS) / HALF_SECONDS) * 45)}'`
  return `${minuteOf(s)}'`
}

function diag(s, key) {
  s.diag[key] = (s.diag[key] ?? 0) + 1
}

function addEvent(s, type, team, vars = {}, extra = {}) {
  s.events.push({ minute: minuteOf(s), type, team, text: line(s.rng, type, vars), ...extra })
}

// ---------- restarts ----------

function kickoffPosition(s, a, kicking) {
  const slot = s.teams[a.team].slots[a.slot]
  let fx = slot.role === 'GK' ? 0.03 : Math.min(0.46, slot.x * 0.85 + 0.05)
  const fy = 0.5 + (slot.y - 0.5) * 0.85
  const p = toWorld(s, a.team, fx, fy)
  if (!kicking && dist2(p.x, p.y, W / 2, CY) < 10) {
    const k = 10 / (dist2(p.x, p.y, W / 2, CY) || 1)
    p.x = W / 2 + (p.x - W / 2) * k
    p.y = CY + (p.y - CY) * k
    const own = toTeam(s, a.team, p.x, p.y)
    if (own.fx > 0.49) p.x = toWorld(s, a.team, 0.4, own.fy).x
  }
  return p
}

function setupKickoff(s, team, teleport) {
  const b = s.ball
  Object.assign(b, { x: W / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, pass: null, shot: null })
  for (const a of s.agents) {
    a.dive = null
    a.holding = false
    a.runTimer = 0
    a.dribbleTarget = null
    if (teleport) {
      const p = kickoffPosition(s, a, a.team === team)
      a.x = a.px = p.x
      a.y = a.py = p.y
      a.vx = a.vy = 0
    }
  }
  const order = ['ST', 'AM', 'LW', 'RW', 'CM']
  const mates = s.teams[team].agents.filter((a) => !a.isGK)
  const taker = order.map((r) => mates.find((a) => a.role === r)).find(Boolean) ?? mates[0]
  if (teleport && taker) {
    taker.x = W / 2 - attackDir(s, team) * 0.5
    taker.y = CY
  }
  s.possession = team
  s.restart = { type: 'kickoff', team, x: W / 2, y: CY, taker, timer: 0.8 }
  s.phase = 'restart'
}

function pickTaker(s, team, type, x, y) {
  const mates = s.teams[team].agents.filter((a) => !a.isGK && !a.injured)
  if (!mates.length) return s.teams[team].agents[0]
  if (type === 'goalkick') return s.teams[team].agents.find((a) => a.isGK) ?? mates[0]
  if (type === 'penalty') return mates.reduce((b, a) => (attr(a, 'finishing') > attr(b, 'finishing') ? a : b))
  if (type === 'corner' || type === 'freekick') {
    const d = dist2(x, y, oppGoal(s, team).x, CY)
    if (type === 'freekick' && d > 32) return mates.reduce((b, a) => (dist2(a.x, a.y, x, y) < dist2(b.x, b.y, x, y) ? a : b))
    return mates.reduce((b, a) => (attr(a, 'passing') + attr(a, 'finishing') * 0.5 > attr(b, 'passing') + attr(b, 'finishing') * 0.5 ? a : b))
  }
  return mates.reduce((b, a) => (dist2(a.x, a.y, x, y) < dist2(b.x, b.y, x, y) ? a : b))
}

const BOX_SPOTS = [[0.95, 0.45], [0.95, 0.57], [0.9, 0.5], [0.86, 0.4], [0.87, 0.62]]
const DEF_ZONES = [[0.015, 0.45], [0.02, 0.56], [0.08, 0.5], [0.14, 0.5]]

function setRestart(s, type, team, x, y) {
  const b = s.ball
  Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, pass: null, shot: null })
  for (const a of s.agents) {
    a.dive = null
    a.holding = false
    a.runTimer = 0
    a.dribbleTarget = null
  }
  const taker = pickTaker(s, team, type, x, y)
  const r = { type, team, x, y, taker, timer: type === 'throw' ? 0.6 : type === 'penalty' ? 1.6 : 1.2, setPiece: false }
  const fx = toTeam(s, team, x, y).fx
  if (type === 'corner' || (type === 'freekick' && fx > 0.68)) {
    r.setPiece = true
    const att = s.teams[team].agents
      .filter((a) => !a.isGK && a !== taker)
      .sort((a, c) => attr(c, 'strength') + attr(c, 'finishing') - attr(a, 'strength') - attr(a, 'finishing'))
      .slice(0, 5)
    r.boxAtt = att
    const defs = s.teams[1 - team].agents
      .filter((a) => !a.isGK)
      .sort((a, c) => attr(c, 'strength') + attr(c, 'tackling') - attr(a, 'strength') - attr(a, 'tackling'))
    r.markers = new Map()
    att.forEach((o, i) => defs[i] && r.markers.set(defs[i], o))
  }
  s.restart = r
  s.phase = 'restart'
  s.possession = team
}

function restartTarget(s, a, r, ctx) {
  const b = s.ball
  if (a === r.taker) {
    const back = attackDir(s, r.team)
    return { x: clamp(b.x - back * 0.5, -0.5, W + 0.5), y: clamp(b.y, -0.5, H + 0.5), urg: 1 }
  }
  if (r.type === 'penalty') {
    if (a.isGK && a.team !== r.team) return { ...ownGoal(s, a.team), urg: 1 }
    const p = shapeTarget(s, a, ctx)
    // Everyone else waits outside the box.
    const fx = toTeam(s, r.team, p.x, p.y).fx
    return { ...toWorld(s, r.team, Math.min(fx, 0.8), toTeam(s, r.team, p.x, p.y).fy), urg: 0.9 }
  }
  if (r.setPiece) {
    if (a.team === r.team) {
      const i = r.boxAtt.indexOf(a)
      if (i >= 0) return { ...toWorld(s, r.team, BOX_SPOTS[i][0], BOX_SPOTS[i][1]), urg: 0.9 }
    } else if (!a.isGK) {
      const o = r.markers.get(a)
      if (o) {
        const og = ownGoal(s, a.team)
        const ang = Math.atan2(og.y - o.y, og.x - o.x)
        return { x: o.x + Math.cos(ang) * 0.9, y: o.y + Math.sin(ang) * 0.9, urg: 1 }
      }
      const zones = s.teams[a.team].agents.filter((d) => !d.isGK && !r.markers.has(d))
      const zi = zones.indexOf(a)
      if (zi >= 0 && zi < DEF_ZONES.length) return { ...toWorld(s, a.team, DEF_ZONES[zi][0], DEF_ZONES[zi][1]), urg: 0.9 }
    } else {
      return { ...toWorld(s, a.team, 0.01, 0.5), urg: 0.8 }
    }
  }
  let p = a.isGK ? toWorld(s, a.team, 0.04, 0.5) : shapeTarget(s, a, ctx)
  if (a.team !== r.team) {
    const minD = r.type === 'throw' ? 3 : 9.15
    const d = dist2(p.x, p.y, b.x, b.y)
    if (d < minD) {
      const k = minD / (d || 1)
      p = { x: b.x + (p.x - b.x) * k, y: b.y + (p.y - b.y) * k }
    }
    if (r.type === 'goalkick' && !a.isGK) {
      const t = toTeam(s, r.team, p.x, p.y)
      if (t.fx < 0.18) p = toWorld(s, r.team, 0.18, t.fy)
    }
  }
  return { x: p.x, y: p.y, urg: 0.75 }
}

function executeRestart(s) {
  const r = s.restart
  const p = r.taker
  s.restart = null
  s.phase = 'play'
  giveBall(s, p)
  const t = r.team
  const rng = s.rng
  if (r.type === 'kickoff') {
    const mates = s.teams[t].agents.filter((a) => a !== p && !a.isGK)
    const back = mates.sort((a, b) => dist(a, p) - dist(b, p))[0]
    if (back) kickPass(s, p, back.x, back.y, { to: back })
    return
  }
  if (r.type === 'penalty') {
    shoot(s, p, { penalty: true })
    return
  }
  if (r.type === 'corner' || (r.setPiece && r.type === 'freekick' && !directFreeKick(s, p))) {
    const target = rng.pick(r.boxAtt.length ? r.boxAtt : s.teams[t].agents)
    kickPass(s, p, target.x + rng.range(-1, 1), target.y + rng.range(-1, 1), { to: target, lofted: true, cross: true })
    return
  }
  if (r.type === 'freekick' && directFreeKick(s, p)) {
    addEvent(s, 'freekickShot', t, { p: p.short })
    shoot(s, p, { freekick: true })
    return
  }
  if (r.type === 'goalkick') {
    const T = s.teams[t]
    if (rng.chance(0.3 + T.tactics.tempo * 0.15)) {
      const fwd = T.agents.filter((a) => ['ST', 'LW', 'RW', 'AM'].includes(a.role))
      const tgt = fwd.length ? rng.pick(fwd) : rng.pick(T.agents)
      kickPass(s, p, tgt.x, tgt.y, { to: tgt, lofted: true })
      return
    }
  }
  const act = chooseAction(s, p, { passOnly: true, maxDist: r.type === 'throw' ? 22 : 45, noLoft: r.type === 'throw' })
  executeAction(s, p, act, { throwIn: r.type === 'throw' })
}

function directFreeKick(s, p) {
  const g = oppGoal(s, p.team)
  return dist(p, g) < 30 && goalAngle(p.x, p.y, g.x) > 0.22
}

// ---------- ball actions ----------

function giveBall(s, a) {
  const b = s.ball
  b.owner = a
  b.lastTouch = a
  b.pass = null
  b.shot = null
  b.z = 0
  b.vz = 0
  s.possession = a.team
  a.dribbleTarget = null
  a.runTimer = 0
  for (const q of s.agents) {
    q.receiving = 0
    q.dive = null
  }
}

function kickPass(s, p, x, y, opts = {}) {
  const rng = s.rng
  const b = s.ball
  const d = dist2(p.x, p.y, x, y)
  const press = nearestOpponent(s, p).d
  const sigma =
    0.018 + (20 - attr(p, 'passing')) * 0.0032 + (press < 1.5 ? 0.04 : press < 3 ? 0.015 : 0) + (opts.lofted ? 0.015 : 0) + (opts.throwIn ? 0.01 : 0)
  const ang = Math.atan2(y - p.y, x - p.x) + rng.gauss() * sigma
  const dd = Math.max(2, d * (1 + rng.gauss() * sigma * 0.7))
  b.owner = null
  b.lastTouch = p
  b.shot = null
  if (opts.lofted) {
    const T = 0.55 + dd / 22
    const v = dd / T
    b.vx = Math.cos(ang) * v
    b.vy = Math.sin(ang) * v
    b.vz = 0.5 * GRAV * T
    b.z = 0.05
  } else {
    const v = Math.min(ROLL_FRICTION * dd + 8.5, opts.throwIn ? 15 : 32)
    b.vx = Math.cos(ang) * v
    b.vy = Math.sin(ang) * v
    b.vz = 0
    b.z = 0
  }
  const to = opts.to ?? null
  b.pass = { from: p, to, team: p.team, lofted: !!opts.lofted, cross: !!opts.cross, offside: to && !opts.noOffside && isOffside(s, to) ? to : null }
  p.noTouch = 0.3
  p.dribbleTarget = null
  p.holding = false
  if (to) to.receiving = 3
  if (!opts.clearance) {
    s.stats[p.team].passes++
    p.perf.passes++
  }
}

function clearBall(s, p) {
  const rng = s.rng
  const t = p.team
  const own = toTeam(s, t, p.x, p.y)
  if (own.fx < 0.3 && nearestOpponent(s, p).d < 2.5 && rng.chance(0.35)) {
    // Safety first: boot it out of play.
    const behind = own.fx < 0.12 && rng.chance(0.4)
    const tgt = behind ? toWorld(s, t, -0.05, own.fy < 0.5 ? 0.2 : 0.8) : toWorld(s, t, own.fx + 0.08, own.fy < 0.5 ? -0.08 : 1.08)
    kickPass(s, p, tgt.x, tgt.y, { lofted: true, clearance: true, noOffside: true })
    return
  }
  const fx = Math.min(0.85, toTeam(s, t, p.x, p.y).fx + rng.range(0.3, 0.45))
  const tgt = toWorld(s, t, fx, rng.pick([0.2, 0.35, 0.65, 0.8]))
  kickPass(s, p, tgt.x, tgt.y, { lofted: true, clearance: true, noOffside: true })
}

function shoot(s, p, opts = {}) {
  const rng = s.rng
  const b = s.ball
  const t = p.team
  const g = oppGoal(s, t)
  const gk = s.teams[1 - t].agents.find((a) => a.isGK)
  const fin = attr(p, 'finishing')
  const d = dist(p, g)
  const press = nearestOpponent(s, p).d
  const xg = opts.penalty ? 0.76 : shotXg(s, p)
  let forced = null
  let aimY
  const side = gk ? (gk.y < CY ? 1 : -1) : rng.chance(0.5) ? 1 : -1
  if (opts.penalty) {
    const roll = rng.next()
    const pGoal = clamp(0.72 + (fin - 10) * 0.012 - ((gk ? attr(gk, 'goalkeeping') : 5) - 12) * 0.012, 0.5, 0.9)
    forced = roll < pGoal ? 'goal' : roll < pGoal + 0.07 ? 'miss' : 'save'
    const dir = rng.chance(0.5) ? 1 : -1
    aimY = forced === 'miss' ? CY + dir * 4.4 : CY + dir * rng.range(1.4, 2.8)
  } else {
    aimY = CY + (rng.chance(0.7) ? side : -side) * rng.range(1.8, 3.3)
  }
  const sigma = forced
    ? 0
    : 0.07 + (20 - fin) * 0.0075 + (press < 1.5 ? 0.05 : press < 3 ? 0.025 : 0) + (opts.header ? 0.06 : 0) + (opts.freekick ? 0.03 : 0)
  const ang = Math.atan2(aimY - p.y, g.x - p.x) + rng.gauss() * sigma
  const speed = (opts.header ? 13 : 21) + fin * 0.35 + attr(p, 'strength') * 0.2 + rng.range(-2, 2)
  b.owner = null
  b.lastTouch = p
  b.pass = null
  b.vx = Math.cos(ang) * speed
  b.vy = Math.sin(ang) * speed
  if (opts.header) {
    b.z = 1.8
    b.vz = rng.range(-1, 2.5)
  } else if (forced) {
    b.z = 0.05
    b.vz = forced === 'miss' && rng.chance(0.4) ? 6 : rng.range(0.5, 2.5)
  } else {
    b.z = 0.05
    b.vz = Math.max(0.3, 1.2 + d * 0.07 + rng.gauss() * (1.6 + sigma * 25))
  }
  b.shot = { by: p, team: t, tried: new Set(), xg, forced, header: !!opts.header, penalty: !!opts.penalty, counted: false }
  s.lastShot = { by: p, team: t, time: s.totalTime }
  p.noTouch = 0.5
  p.dribbleTarget = null
  s.stats[t].shots++
  s.stats[t].xg += xg
  p.perf.shots++
  if (s.lastPass && s.lastPass.to === p && s.totalTime - s.lastPass.time < 6) s.lastPass.from.perf.keyPasses++
  if (gk) {
    // The keeper reads the shot after a short reaction delay and dives towards it.
    const tc = Math.abs(b.vx) > 0.1 ? (gk.x - b.x) / b.vx : 0
    let yc = clamp(b.y + b.vy * Math.max(0, tc), GOAL_TOP - 1.5, GOAL_BOT + 1.5)
    if (forced === 'goal') yc = CY - Math.sign(aimY - CY) * 2
    gk.diveDelay = Math.max(0.05, 0.16 - attr(gk, 'goalkeeping') * 0.004)
    gk.dive = { x: gk.x, y: yc }
  }
}

function executeAction(s, p, act, opts = {}) {
  diag(s, `act_${act.type}${act.cross ? '_cross' : ''}${act.lofted ? '_lofted' : ''}`)
  const z = toTeam(s, p.team, p.x, p.y)
  diag(s, `zone_${z.fx > 0.74 ? 'F' : z.fx > 0.5 ? 'M' : 'D'}${Math.abs(z.fy - 0.5) > 0.27 ? 'W' : 'C'}`)
  const tempo = s.teams[p.team].tactics.tempo
  if (act.type === 'shoot') shoot(s, p)
  else if (act.type === 'pass') kickPass(s, p, act.x, act.y, { to: act.to, lofted: act.lofted, cross: act.cross, throwIn: opts.throwIn })
  else if (act.type === 'clear') clearBall(s, p)
  else if (act.type === 'dribble') {
    p.dribbleTarget = { x: act.x, y: act.y }
    p.decide = (tempo === 2 ? 0.3 : tempo === 0 ? 0.6 : 0.45) + s.rng.range(0, 0.15)
  }
}

// ---------- rules: fouls, cards, goals, out of play ----------

function foul(s, fouler, victim) {
  const rng = s.rng
  const t = fouler.team
  fouler.perf.fouls++
  s.stats[t].fouls++
  const vfx = toTeam(s, victim.team, victim.x, victim.y).fx
  const tactical = vfx > 0.55
  const roll = rng.next()
  if (roll < 0.012) sendOff(s, fouler, 'red')
  else if (roll < 0.012 + 0.16 + (tactical ? 0.12 : 0)) {
    fouler.yellow++
    s.stats[t].yellows++
    if (fouler.yellow >= 2) sendOff(s, fouler, 'secondYellow')
    else addEvent(s, 'yellow', t, { p: fouler.short }, { playerId: fouler.id })
  }
  if (rng.chance(0.015)) injure(s, victim)
  if (inOwnBox(s, t, victim.x, victim.y)) {
    addEvent(s, 'penalty', victim.team, { p: fouler.short })
    const spot = toWorld(s, victim.team, 1 - PEN_SPOT / W, 0.5)
    setRestart(s, 'penalty', victim.team, spot.x, spot.y)
  } else {
    setRestart(s, 'freekick', victim.team, clamp(victim.x, 1, W - 1), clamp(victim.y, 1, H - 1))
  }
}

function sendOff(s, a, type) {
  const T = s.teams[a.team]
  a.sentOff = true
  a.leftAt = minuteOf(s)
  s.stats[a.team].reds++
  addEvent(s, type, a.team, { p: a.short }, { playerId: a.id })
  T.agents = T.agents.filter((x) => x !== a)
  T.used.push(a)
  if (s.ball.owner === a) s.ball.owner = null
  if (a.isGK) {
    const benchGK = T.bench.map((id) => T.def.players.find((p) => p.id === id)).find((p) => p && p.roles.includes('GK'))
    if (T.subsLeft > 0 && benchGK && T.agents.length) {
      const out = T.agents.filter((x) => !x.isGK).sort((x, y) => ratingInSlot(x.data, x.role) - ratingInSlot(y.data, y.role))[0]
      if (out) {
        out.slot = a.slot
        out.role = 'GK'
        substitute(s, a.team, out.id, benchGK.id)
      }
    } else if (T.agents.length) {
      const stand = T.agents.reduce((b, x) => (x.attrs.goalkeeping > b.attrs.goalkeeping ? x : b))
      stand.slot = a.slot
      stand.role = 'GK'
      stand.isGK = true
      stand.fam = familiarity(stand.data, 'GK')
    }
  }
  refreshAgents(s)
}

function injure(s, a) {
  if (a.injured) return
  a.injured = true
  addEvent(s, 'injury', a.team, { p: a.short }, { playerId: a.id })
  const T = s.teams[a.team]
  if (s.autoSubs[a.team] && T.subsLeft > 0) {
    const inId = bestBenchFor(T, a.role)
    if (inId) substitute(s, a.team, a.id, inId)
  }
}

function bestBenchFor(T, role) {
  let best = null
  let bs = -1
  for (const id of T.bench) {
    const p = T.def.players.find((pl) => pl.id === id)
    if (!p) continue
    const sc = ratingInSlot(p, role) * (0.6 + 0.4 * (p.condition / 100))
    if (sc > bs) {
      bs = sc
      best = id
    }
  }
  return best
}

export function substitute(s, t, outId, inId) {
  const T = s.teams[t]
  if (T.subsLeft <= 0 || s.phase === 'fulltime') return false
  const out = T.agents.find((a) => a.id === outId)
  const pl = T.def.players.find((p) => p.id === inId)
  if (!out || !pl || !T.bench.includes(inId)) return false
  const a = makeAgent(pl, t, out.slot, out.role)
  a.x = a.px = W / 2 + (t === 0 ? -3 : 3)
  a.y = a.py = -0.5
  a.enteredAt = minuteOf(s)
  out.leftAt = minuteOf(s)
  T.agents[T.agents.indexOf(out)] = a
  T.used.push(out)
  T.bench = T.bench.filter((id) => id !== inId)
  T.subsLeft--
  if (s.ball.owner === out) s.ball.owner = null
  if (s.restart && s.restart.taker === out) s.restart.taker = a
  refreshAgents(s)
  addEvent(s, 'sub', t, { p: a.short, q: out.short, t: T.def.short })
  return true
}

export function setTactics(s, t, tactics) {
  const T = s.teams[t]
  const changed = tactics.formation && tactics.formation !== T.tactics.formation
  T.tactics = { ...T.tactics, ...tactics }
  if (changed) {
    T.slots = FORMATIONS[T.tactics.formation]
    // Re-assign the players on the pitch to the new slots (keeper stays in goal).
    const free = T.agents.slice()
    const assign = new Array(T.slots.length).fill(null)
    const gk = free.find((a) => a.isGK)
    if (gk) {
      assign[0] = gk
      free.splice(free.indexOf(gk), 1)
    }
    for (let i = 1; i < T.slots.length && free.length; i++) {
      let best = 0
      for (let j = 1; j < free.length; j++) {
        if (ratingInSlot(free[j].data, T.slots[i].role) > ratingInSlot(free[best].data, T.slots[i].role)) best = j
      }
      assign[i] = free.splice(best, 1)[0]
    }
    assign.forEach((a, i) => {
      if (!a) return
      a.slot = i
      a.role = T.slots[i].role
      a.isGK = a.role === 'GK'
      a.fam = familiarity(a.data, a.role)
    })
  }
}

function scoreGoal(s, t) {
  const b = s.ball
  const shot = b.shot
  let scorer = shot && shot.team === t ? shot.by : b.lastTouch && b.lastTouch.team === t ? b.lastTouch : null
  // A deflected shot still counts for the shooter.
  if (!scorer && s.lastShot && s.lastShot.team === t && s.totalTime - s.lastShot.time < 2.5) scorer = s.lastShot.by
  const own = !scorer
  if (own) scorer = b.lastTouch
  s.score[t]++
  if (shot && !shot.counted) {
    s.stats[shot.team].onTarget++
    shot.by.perf.onTarget++
  }
  let assister = null
  if (!own && s.lastPass && s.lastPass.to === scorer && s.lastPass.from.team === t && s.totalTime - s.lastPass.time < 10) {
    assister = s.lastPass.from
    assister.perf.assists++
  }
  if (!own) scorer.perf.goals++
  for (const a of s.teams[1 - t].agents) if (a.isGK || ['CB', 'LB', 'RB'].includes(a.role)) a.perf.conceded++
  const minute = minuteOf(s)
  s.goals.push({ team: t, playerId: scorer?.id, name: scorer?.short ?? '?', minute, own, assistId: assister?.id ?? null, penalty: !!shot?.penalty })
  const type = own ? 'ownGoal' : shot?.penalty ? 'penaltyGoal' : shot?.header ? 'header' : assister ? 'goalAssist' : 'goal'
  addEvent(s, type, t, { p: scorer?.short, q: assister?.short }, { playerId: scorer?.id, goal: true })
  b.shot = null
  b.pass = null
  b.vx *= 0.15
  b.vy *= 0.15
  b.x = clamp(b.x, -1.5, W + 1.5)
  s.phase = 'goal'
  s.timer = 3
  s.nextKickoff = 1 - t
  s.celebrate = scorer && !own ? scorer : null
}

function checkOut(s) {
  const b = s.ball
  if (b.x < 0 || b.x > W) {
    const goalX = b.x < 0 ? 0 : W
    const defTeam = ownGoal(s, 0).x === goalX ? 0 : 1
    const attTeam = 1 - defTeam
    if (b.y > GOAL_TOP && b.y < GOAL_BOT && b.z < CROSSBAR) {
      scoreGoal(s, attTeam)
      return
    }
    diag(s, b.lastTouch && b.lastTouch.team === defTeam ? 'outGoalLineDef' : 'outGoalLineAtt')
    if (b.shot && !b.shot.reported) {
      addEvent(s, b.shot.penalty ? 'penaltyMiss' : 'miss', b.shot.team, { p: b.shot.by.short })
    }
    if (b.lastTouch && b.lastTouch.team === defTeam) {
      s.stats[attTeam].corners++
      addEvent(s, 'corner', attTeam, { t: s.teams[attTeam].def.short }, { minor: true })
      setRestart(s, 'corner', attTeam, goalX === 0 ? 0.3 : W - 0.3, b.y < CY ? 0.3 : H - 0.3)
    } else {
      const p = toWorld(s, defTeam, 0.05, b.y < CY === (attackDir(s, defTeam) > 0) ? 0.42 : 0.58)
      setRestart(s, 'goalkick', defTeam, p.x, p.y)
    }
    return
  }
  if (b.y < 0 || b.y > H) {
    diag(s, 'throwIn')
    const team = b.lastTouch ? 1 - b.lastTouch.team : 1 - s.possession
    setRestart(s, 'throw', team, clamp(b.x, 1, W - 1), b.y < 0 ? 0 : H)
  }
}

// ---------- contact: control, saves, blocks, tackles ----------

function willBeOnTarget(s, gkTeam) {
  const b = s.ball
  const gx = ownGoal(s, gkTeam).x
  if (Math.abs(b.vx) < 0.5 || Math.sign(gx - b.x) !== Math.sign(b.vx)) return false
  const tc = (gx - b.x) / b.vx
  const yc = b.y + b.vy * tc
  let zc = b.z + b.vz * tc - 0.5 * GRAV * tc * tc
  if (zc < 0) zc = 0.3
  return yc > GOAL_TOP && yc < GOAL_BOT && zc < CROSSBAR
}

function trySave(s, gk) {
  const rng = s.rng
  const b = s.ball
  const shot = b.shot
  if (!willBeOnTarget(s, gk.team) && shot.forced !== 'save') return false
  if (!shot.counted) {
    shot.counted = true
    s.stats[shot.team].onTarget++
    shot.by.perf.onTarget++
  }
  const speed = len(b.vx, b.vy)
  // Harder to save when the ball is fast and at the edge of the keeper's reach.
  const reach = 0.9 + gk.attrs.goalkeeping * 0.05 + 0.35
  const stretch = clamp(dist(gk, b) / reach, 0, 1)
  let pSave = clamp(
    0.46 + attr(gk, 'goalkeeping') * 0.03 + attr(gk, 'positioning') * 0.006 - (speed - 24) * 0.03 - stretch * 0.3,
    0.08,
    0.92,
  )
  if (shot.forced === 'goal') pSave = 0
  if (shot.forced === 'save') pSave = 1
  if (shot.forced === 'miss') return false
  if (!rng.chance(pSave)) return false
  gk.perf.saves++
  s.stats[gk.team].saves++
  shot.reported = true
  addEvent(s, shot.penalty ? 'penaltySaved' : 'save', shot.team, { p: shot.by.short, q: gk.short })
  if (rng.chance(clamp(0.45 + attr(gk, 'goalkeeping') * 0.02 - (speed - 20) * 0.02, 0.1, 0.9))) {
    giveBall(s, gk)
    gk.holding = true
    gk.decide = rng.range(1.0, 2.0)
  } else if (rng.chance(0.5)) {
    // Pushed round the post: heads out over the goal line for a corner.
    const out = Math.sign(ownGoal(s, gk.team).x - W / 2)
    b.vx = out * rng.range(3, 6)
    b.vy = (b.y < CY ? -1 : 1) * rng.range(4, 8)
    b.vz = rng.range(1, 3)
    b.shot = null
    b.lastTouch = gk
    gk.noTouch = 0.6
  } else {
    b.vx = -b.vx * 0.25 + rng.range(-3, 3)
    b.vy = rng.range(-8, 8)
    b.vz = rng.range(1, 4)
    b.shot = null
    b.lastTouch = gk
    gk.noTouch = 0.6
  }
  gk.dive = null
  return true
}

function handleLooseBall(s) {
  const b = s.ball
  const rng = s.rng
  const cands = []
  for (const a of s.agents) {
    if (a.noTouch > 0 || a.cooldown > 0.5 || a.injured) continue
    const gkZone = a.isGK && inOwnBox(s, a.team, b.x, b.y)
    const reach = gkZone ? 0.9 + a.attrs.goalkeeping * 0.05 + (a.dive ? 0.35 : 0) : 0.9
    const zMax = gkZone ? 2.7 : 2.3
    const d = dist2(a.x, a.y, b.x, b.y)
    if (d <= reach && b.z <= zMax) cands.push({ a, d, gkZone })
  }
  if (!cands.length) return
  cands.sort((x, y) => x.d - y.d)
  for (const { a, gkZone } of cands) {
    if (b.shot) {
      if (a.team === b.shot.team || b.shot.tried.has(a)) continue
      b.shot.tried.add(a)
      if (gkZone) {
        if (trySave(s, a)) return
        continue
      }
      if (!a.isGK && b.z < 1.9 && rng.chance(0.5)) {
        b.shot.reported = true
        addEvent(s, 'blocked', b.shot.team, { p: b.shot.by.short }, { minor: true })
        const sp = len(b.vx, b.vy) * 0.35
        // Deflections often keep going towards the goal line (corner), otherwise anywhere.
        const ang = rng.chance(0.45) ? Math.atan2(b.vy, b.vx) + rng.range(-0.9, 0.9) : rng.range(0, Math.PI * 2)
        b.vx = Math.cos(ang) * sp
        b.vy = Math.sin(ang) * sp
        b.vz = rng.range(0, 3)
        b.shot = null
        b.lastTouch = a
        a.noTouch = 0.3
        return
      }
      continue
    }
    if (a.touchTry > 0) continue
    // Airborne ball: headers in the box.
    if (b.z > 0.9 && !gkZone) {
      if (inOppBox(s, a.team, b.x, b.y)) {
        if (rng.chance(clamp(0.45 + (attr(a, 'strength') - 10) * 0.03, 0.2, 0.8))) {
          b.lastTouch = a
          a.touchTry = 0.3
          const g = oppGoal(s, a.team)
          if (goalAngle(a.x, a.y, g.x) > 0.25) {
            shoot(s, a, { header: true })
            return
          }
        } else {
          a.touchTry = 0.4
          continue
        }
      } else if (inOwnBox(s, a.team, b.x, b.y)) {
        if (rng.chance(clamp(0.5 + (attr(a, 'strength') - 10) * 0.03, 0.25, 0.85))) {
          b.lastTouch = a
          if (rng.chance(0.3)) {
            // Glancing header behind the goal line.
            const out = Math.sign(ownGoal(s, a.team).x - W / 2)
            b.vx = out * rng.range(6, 10)
            b.vy = rng.range(-4, 4)
            b.vz = rng.range(2, 4)
            b.pass = null
            a.noTouch = 0.4
            return
          }
          clearBall(s, a)
          return
        }
        a.touchTry = 0.4
        continue
      }
    }
    const speed = len(b.vx, b.vy)
    let pc = gkZone
      ? 0.85 + a.attrs.goalkeeping * 0.008 - Math.max(0, speed - 12) * 0.02
      : 1.12 - Math.max(0, speed - 8) * 0.045 - (b.z > 0.6 ? 0.15 : 0) + (attr(a, 'dribbling') - 10) * 0.012
    pc = clamp(pc, 0.25, 0.98)
    if (rng.chance(pc)) {
      receive(s, a, gkZone)
      return
    }
    a.touchTry = 0.35
    b.lastTouch = a
    diag(s, 'badTouch')
    const ang = Math.atan2(b.vy, b.vx) + rng.gauss() * 0.8
    b.vx = Math.cos(ang) * speed * 0.45
    b.vy = Math.sin(ang) * speed * 0.45
    return
  }
}

function receive(s, a, gkZone) {
  const b = s.ball
  const pass = b.pass
  if (pass && pass.team === a.team && pass.from !== a) {
    if (pass.offside === a) {
      s.stats[a.team].offsides++
      addEvent(s, 'offside', a.team, { p: a.short }, { minor: true })
      setRestart(s, 'freekick', 1 - a.team, clamp(a.x, 1, W - 1), clamp(a.y, 1, H - 1))
      return
    }
    s.stats[a.team].passesOk++
    pass.from.perf.passesOk++
    s.lastPass = { from: pass.from, to: a, time: s.totalTime }
    diag(s, pass.to === a ? 'passToTarget' : 'passToOther')
  } else if (pass && pass.team !== a.team) {
    a.perf.interceptions++
    diag(s, 'passIntercepted')
  } else diag(s, 'looseRecovered')
  giveBall(s, a)
  a.decide = 0.15 + (20 - a.attrs.dribbling) * 0.008
  if (gkZone && a.isGK && !(pass && pass.team === a.team)) {
    a.holding = true
    a.decide = s.rng.range(0.9, 1.8)
  }
}

function handleTackles(s, ctx) {
  const c = s.ball.owner
  if (!c || c.holding) return
  const rng = s.rng
  const T = s.teams[1 - c.team]
  for (const d of T.agents) {
    if (d.cooldown > 0 || d.injured) continue
    const dd = dist(d, c)
    if (dd > 1.7) continue
    const presser = ctx.plans.get(d)?.urg >= 1
    const rate = presser ? 2.2 + T.tactics.pressing * 0.6 : 1.0
    if (!rng.chance(rate * DT)) continue
    d.cooldown = 0.7
    const tk = attr(d, 'tackling')
    const pFoul = 0.12 + T.tactics.pressing * 0.02 - (tk - 10) * 0.005
    if (rng.chance(pFoul)) {
      foul(s, d, c)
      return
    }
    const pWin = clamp(0.42 + (tk - attr(c, 'dribbling')) * 0.03 + (attr(d, 'strength') - attr(c, 'strength')) * 0.01, 0.12, 0.85)
    if (rng.chance(pWin)) {
      d.perf.tackles++
      s.stats[d.team].tackles++
      if (rng.chance(0.55)) {
        giveBall(s, d)
        d.decide = 0.25
      } else {
        const b = s.ball
        b.owner = null
        b.pass = null
        b.lastTouch = d
        const ang = rng.range(0, Math.PI * 2)
        const sp = rng.range(4, 7)
        b.vx = Math.cos(ang) * sp
        b.vy = Math.sin(ang) * sp
        d.noTouch = 0.15
        c.noTouch = 0.25
      }
      if (rng.chance(0.004)) injure(s, c)
    } else {
      d.cooldown = 1.1
    }
    return
  }
}

// ---------- movement & physics ----------

function moveAgent(a, tx, ty, urg, dt) {
  const vmax = maxSpeed(a) * urg
  const dx = tx - a.x
  const dy = ty - a.y
  const d = len(dx, dy)
  let dvx = 0
  let dvy = 0
  if (d > 0.05) {
    const sp = d < 2 ? vmax * (d / 2) : vmax
    dvx = (dx / d) * sp
    dvy = (dy / d) * sp
  }
  const acc = (4 + a.attrs.pace * 0.18) * dt * (urg > 1 ? 1.6 : 1)
  let ax = dvx - a.vx
  let ay = dvy - a.vy
  const al = len(ax, ay)
  if (al > acc) {
    ax = (ax / al) * acc
    ay = (ay / al) * acc
  }
  a.vx += ax
  a.vy += ay
  a.x += a.vx * dt
  a.y += a.vy * dt
  const sp = len(a.vx, a.vy)
  if (sp > 0.3) {
    a.faceX = a.vx / sp
    a.faceY = a.vy / sp
  }
  a.anim += sp * dt
  const full = maxSpeed(a) || 1
  const frac = Math.min(1, sp / full)
  a.energy = Math.max(5, a.energy - dt * (0.02 + frac * frac * 0.1) * (1.35 - a.attrs.stamina * 0.0175))
}

// Keepers launch themselves at full speed instead of accelerating like a runner.
function diveTowards(a, tgt, dt) {
  const dx = tgt.x - a.x
  const dy = tgt.y - a.y
  const d = len(dx, dy)
  const sp = Math.min(d / dt, 5.5 + a.attrs.goalkeeping * 0.1)
  a.vx = d > 0.01 ? (dx / d) * sp : 0
  a.vy = d > 0.01 ? (dy / d) * sp : 0
  a.x += a.vx * dt
  a.y += a.vy * dt
}

function separate(s) {
  const ag = s.agents
  for (let i = 0; i < ag.length; i++) {
    for (let j = i + 1; j < ag.length; j++) {
      const a = ag[i]
      const b = ag[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const min = a.team === b.team ? 1.4 : 0.8
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2)
      if (d > 0.001) {
        const push = (min - d) * 0.25
        a.x -= (dx / d) * push
        a.y -= (dy / d) * push
        b.x += (dx / d) * push
        b.y += (dy / d) * push
      }
    }
  }
}

function updateBall(s, dt) {
  const b = s.ball
  if (b.owner) {
    const o = b.owner
    b.x = clamp(o.x + o.faceX * 0.55, 0.05, W - 0.05)
    b.y = clamp(o.y + o.faceY * 0.55, 0.05, H - 0.05)
    b.z = 0
    b.vx = o.vx
    b.vy = o.vy
    b.vz = 0
    return
  }
  b.x += b.vx * dt
  b.y += b.vy * dt
  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAV * dt
    b.z += b.vz * dt
    b.vx *= 1 - 0.02 * dt
    b.vy *= 1 - 0.02 * dt
    if (b.z <= 0) {
      b.z = 0
      if (b.vz < -1.5) {
        b.vz = -b.vz * 0.45
        b.vx *= 0.75
        b.vy *= 0.75
      } else b.vz = 0
    }
  } else {
    const f = Math.exp(-ROLL_FRICTION * dt)
    b.vx *= f
    b.vy *= f
    if (len(b.vx, b.vy) < 0.15) b.vx = b.vy = 0
  }
}

// Predicts where the free ball will be over the next 3 s and who gets there first.
function findChasers(s) {
  const b = s.ball
  const chasers = [null, null]
  const intercepts = [null, null]
  if (b.owner || (b.shot && len(b.vx, b.vy) > 12)) return { chasers, intercepts }
  const traj = []
  const sim = { ...b }
  for (let i = 1; i <= 30; i++) {
    const step = 0.1
    sim.x += sim.vx * step
    sim.y += sim.vy * step
    if (sim.z > 0 || sim.vz > 0) {
      sim.vz -= GRAV * step
      sim.z += sim.vz * step
      if (sim.z <= 0) {
        sim.z = 0
        sim.vz = sim.vz < -1.5 ? -sim.vz * 0.45 : 0
        sim.vx *= 0.75
        sim.vy *= 0.75
      }
    } else {
      const f = Math.exp(-ROLL_FRICTION * step)
      sim.vx *= f
      sim.vy *= f
    }
    traj.push({ x: clamp(sim.x, 0, W), y: clamp(sim.y, 0, H), z: sim.z, t: i * step })
  }
  for (const t of [0, 1]) {
    let best = null
    let bt = Infinity
    let bp = null
    for (const a of s.teams[t].agents) {
      if (a.injured) continue
      const sp = maxSpeed(a)
      let hit = null
      for (const pt of traj) {
        if (pt.z > 2.2) continue
        const need = dist2(a.x, a.y, pt.x, pt.y) / sp + 0.15
        if (need <= pt.t) {
          hit = { t: pt.t, x: pt.x, y: pt.y }
          break
        }
      }
      if (!hit) {
        const last = traj[traj.length - 1]
        hit = { t: 3 + dist2(a.x, a.y, last.x, last.y) / sp, x: last.x, y: last.y }
      }
      if (a.isGK && !inOwnBox(s, t, hit.x, hit.y)) continue
      let tt = hit.t
      if (a.receiving > 0) tt -= 0.6
      if (tt < bt) {
        bt = tt
        best = a
        bp = hit
      }
    }
    chasers[t] = best
    intercepts[t] = bp
  }
  return { chasers, intercepts }
}

function buildContext(s) {
  const b = s.ball
  const carrier = b.owner
  const { chasers, intercepts } = findChasers(s)
  return {
    dt: DT,
    carrier,
    possTeam: carrier ? carrier.team : s.possession,
    ballTeam: [toTeam(s, 0, b.x, b.y), toTeam(s, 1, b.x, b.y)],
    offsideLine: [0, 1].map((t) => {
      const xs = s.teams[1 - t].agents.map((o) => toTeam(s, t, o.x, o.y).fx).sort((x, y) => y - x)
      return Math.max(xs.length > 1 ? xs[1] : 1, 0.5)
    }),
    chasers,
    intercepts,
  }
}

function tickTimers(s, dt) {
  for (const a of s.agents) {
    if (a.cooldown > 0) a.cooldown -= dt
    if (a.noTouch > 0) a.noTouch -= dt
    if (a.touchTry > 0) a.touchTry -= dt
    if (a.receiving > 0) a.receiving -= dt
    if (a.runTimer > 0) a.runTimer -= dt
    if (a.diveDelay > 0) a.diveDelay -= dt
    if (a.dive && !s.ball.shot) a.dive = null
  }
}

// ---------- AI managers ----------

function aiManager(s, t) {
  const T = s.teams[t]
  const m = minuteOf(s)
  const checks = s.aiChecks[t]
  const diff = s.score[t] - s.score[1 - t]
  for (const at of [58, 68, 78]) {
    if (m >= at && !checks[at]) {
      checks[at] = true
      if (T.subsLeft <= 0) break
      const tired = T.agents.filter((a) => !a.isGK && a.energy < 72).sort((a, b) => a.energy - b.energy)
      for (const a of tired.slice(0, 2)) {
        const inId = bestBenchFor(T, a.role)
        if (inId && T.subsLeft > 0) substitute(s, t, a.id, inId)
      }
    }
  }
  if (m >= 70 && !checks.chase && diff < 0) {
    checks.chase = true
    setTactics(s, t, { mentality: Math.min(2, T.tactics.mentality + 1) })
  }
  if (m >= 80 && !checks.protect && diff === 1) {
    checks.protect = true
    setTactics(s, t, { mentality: Math.max(-1, T.tactics.mentality - 1) })
  }
}

// ---------- main step ----------

export function step(s) {
  if (s.phase === 'halftime' || s.phase === 'fulltime') return
  const dt = DT
  const b = s.ball
  for (const a of s.agents) {
    a.px = a.x
    a.py = a.y
  }
  b.px = b.x
  b.py = b.y
  b.pz = b.z
  s.time += dt
  s.totalTime += dt
  for (const a of s.agents) updateForm(a)

  if (s.time >= HALF_SECONDS && (s.phase === 'restart' || (s.phase === 'play' && !b.shot) || s.time > HALF_SECONDS + 20)) {
    endHalf(s)
    return
  }

  if (s.phase === 'goal') {
    s.timer -= dt
    for (const a of s.agents) {
      const tgt = s.celebrate && a.team === s.celebrate.team ? s.celebrate : kickoffPosition(s, a, a.team === s.nextKickoff)
      moveAgent(a, tgt.x, tgt.y, 0.7, dt)
    }
    updateBall(s, dt)
    if (s.timer <= 0) setupKickoff(s, s.nextKickoff, true)
    return
  }

  tickTimers(s, dt)
  const ctx = buildContext(s)

  if (s.phase === 'restart') {
    const r = s.restart
    for (const a of s.agents) {
      const tg = restartTarget(s, a, r, ctx)
      moveAgent(a, tg.x, tg.y, tg.urg, dt)
    }
    separate(s)
    r.timer -= dt
    const near = dist(r.taker, b) < 1.0
    if (r.timer < -4) {
      r.taker.x = b.x - attackDir(s, r.team) * 0.5
      r.taker.y = b.y
    }
    if ((near && r.timer <= 0) || r.timer < -4) executeRestart(s)
    return
  }

  // Ball carrier decides.
  const c = b.owner
  if (c) {
    c.decide -= dt
    const pressure = nearestOpponent(s, c).d
    if (!c.holding && pressure < 1.6 && c.decide > 0.12) c.decide = 0.12
    if (c.dribbleTarget && dist(c, c.dribbleTarget) < 1) c.decide = Math.min(c.decide, 0)
    if (c.decide <= 0) {
      c.holding = false
      executeAction(s, c, chooseAction(s, c))
    }
  }

  ctx.carrier = b.owner
  ctx.plans = planOffBall(s, ctx)
  for (const a of s.agents) {
    if (a === b.owner) {
      if (a.holding) moveAgent(a, a.x, a.y, 0.3, dt)
      else if (a.dribbleTarget) {
        const f = 0.72 + attr(a, 'dribbling') * 0.008
        moveAgent(a, clamp(a.dribbleTarget.x, 0.4, W - 0.4), clamp(a.dribbleTarget.y, 0.4, H - 0.4), f, dt)
      } else moveAgent(a, a.x + a.vx * 0.3, a.y + a.vy * 0.3, 0.5, dt)
      a.x = clamp(a.x, 0.3, W - 0.3)
      a.y = clamp(a.y, 0.3, H - 0.3)
      continue
    }
    const plan = ctx.plans.get(a)
    if (!plan) continue
    if (a.dive && a.diveDelay > 0) moveAgent(a, a.x, a.y, 0.5, dt)
    else if (a.dive) diveTowards(a, a.dive, dt)
    else moveAgent(a, plan.x, plan.y, plan.urg, dt)
  }
  separate(s)
  updateBall(s, dt)
  if (b.shot && len(b.vx, b.vy) < 9) b.shot = null
  if (!b.owner) handleLooseBall(s)
  if (s.phase === 'play') handleTackles(s, ctx)
  if (s.phase === 'play') checkOut(s)
  if (s.phase === 'play' || s.phase === 'restart') s.stats[s.possession].possession++
  for (const t of [0, 1]) if (s.userSide !== t) aiManager(s, t)
}

function endHalf(s) {
  if (s.half === 1) {
    s.phase = 'halftime'
    addEvent(s, 'halftime', null)
  } else {
    s.phase = 'fulltime'
    addEvent(s, 'fulltime', null)
    s.result = finalize(s)
  }
}

export function startSecondHalf(s) {
  if (s.phase !== 'halftime') return
  s.half = 2
  s.time = 0
  for (const a of s.agents) a.energy = Math.min(100, a.energy + 4)
  setupKickoff(s, 1 - s.firstKickoff, true)
  addEvent(s, 'secondHalf', null)
}

// ---------- ratings & results ----------

export function playerRating(a, s) {
  const p = a.perf
  let r = 6.0
  r += p.passesOk * 0.015 - (p.passes - p.passesOk) * 0.04
  r += p.keyPasses * 0.2 + p.assists * 0.8 + p.goals * 1.0 + p.onTarget * 0.1
  r += p.tackles * 0.12 + p.interceptions * 0.06 + p.saves * 0.3 - p.fouls * 0.05
  r -= a.yellow * 0.3 + (a.sentOff ? 2 : 0)
  r -= p.conceded * (a.isGK ? 0.3 : 0.12)
  if (s && s.phase === 'fulltime') {
    const diff = s.score[a.team] - s.score[1 - a.team]
    r += diff > 0 ? 0.3 : diff < 0 ? -0.3 : 0
  }
  return Math.round(clamp(r, 3, 10) * 10) / 10
}

function finalize(s) {
  const players = {}
  let motm = null
  for (const T of s.teams) {
    for (const a of [...T.agents, ...T.used]) {
      const rating = playerRating(a, s)
      const minutes = (a.leftAt ?? 90) - a.enteredAt
      players[a.id] = {
        team: a.team,
        rating,
        minutes,
        goals: a.perf.goals,
        assists: a.perf.assists,
        yellow: a.yellow,
        red: a.sentOff,
        injured: a.injured,
        energy: Math.round(a.energy),
      }
      if (!motm || rating > motm.rating) motm = { id: a.id, name: a.short, team: a.team, rating }
    }
  }
  const total = s.stats[0].possession + s.stats[1].possession || 1
  return {
    homeId: s.teams[0].def.id,
    awayId: s.teams[1].def.id,
    score: [...s.score],
    goals: s.goals,
    stats: s.stats.map((st) => ({ ...st, possessionPct: Math.round((st.possession / total) * 100) })),
    players,
    motm,
  }
}

export function possessionPct(s) {
  const total = s.stats[0].possession + s.stats[1].possession || 1
  const p0 = Math.round((s.stats[0].possession / total) * 100)
  return [p0, 100 - p0]
}

// Runs a full match without rendering.
export function simulateMatch(home, away, seed, opts = {}) {
  const s = createMatch({ home, away, seed, ...opts })
  let guard = 0
  while (s.phase !== 'fulltime' && guard < 40000) {
    if (s.phase === 'halftime') startSecondHalf(s)
    step(s)
    guard++
  }
  return { result: s.result, state: s }
}
