// Player economy and development: market value, wages, contracts, potential, growth and decline,
// ageing, retirements and youth intake. Money is in millions (M).
import { createRng } from './rng.js'
import { overall, roleWeights, clampAttr, ATTRS, newId } from './player.js'
import { teamStrength } from './team.js'
import { randomPlayer } from './generate.js'
import { calibrateAttrs } from './io.js'

const round = (v, step = 0.05) => Math.max(step, Math.round(v / step) * step)

export function playerValue(p) {
  const o = overall(p)
  let v = 0.25 * Math.pow(1.17, o - 55)
  const pot = p.potential ?? o
  if (p.age <= 21) v *= 1 + Math.max(0, pot - o) * 0.05
  else if (p.age <= 24) v *= 1 + Math.max(0, pot - o) * 0.025
  if (p.age >= 30) v *= 0.8
  if (p.age >= 32) v *= 0.65
  if (p.age >= 34) v *= 0.5
  if (p.injury > 3) v *= 0.85
  return Math.round(round(v) * 100) / 100
}

// Yearly salary in millions.
export function wageFor(p) {
  return Math.round(Math.max(0.05, playerValue(p) * 0.12) * 100) / 100
}

export function formatMoney(m) {
  if (m == null) return '—'
  if (Math.abs(m) >= 1) return `$${m.toFixed(m >= 10 ? 1 : 2)}M`
  return `$${Math.round(m * 1000)}K`
}

// Potential in "stars" (0.5–5), like the classic manager games.
export function potentialStars(p) {
  return Math.max(0.5, Math.min(5, Math.round(((p.potential ?? overall(p)) - 45) / 9 * 2) / 2))
}

function derivePotential(p, rng) {
  const o = overall(p)
  const gap = p.age <= 18 ? rng.int(10, 25) : p.age <= 21 ? rng.int(6, 18) : p.age <= 24 ? rng.int(2, 10) : p.age <= 27 ? rng.int(0, 4) : 0
  return Math.min(95, o + gap)
}

export function initialBudget(team) {
  return Math.round(Math.max(1.5, 3 + (teamStrength(team) - 60) * 0.9) * 10) / 10
}

// Adds the economy fields to every team and player that does not have them yet.
export function ensureEconomy(world, seed = 'economy') {
  const rng = createRng(seed)
  for (const t of world.teams) {
    t.finances ??= { budget: initialBudget(t), lastIncome: 0, lastWages: 0 }
    for (const p of t.players) ensurePlayer(p, rng)
  }
  world.freeAgents ??= generateFreeAgents(`${seed}-fa`, 24)
  for (const p of world.freeAgents) ensurePlayer(p, rng)
}

export function ensurePlayer(p, rng = createRng(p.id)) {
  p.potential ??= derivePotential(p, rng)
  p.contract ??= rng.int(1, 4)
  p.wage ??= wageFor(p)
  p.xp ??= {}
  p.totals ??= { apps: 0, goals: 0, assists: 0, seasons: 0 }
  p.seasonStartOvr ??= overall(p)
  return p
}

export function generateFreeAgents(seed, n) {
  const rng = createRng(seed)
  const roles = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST']
  const taken = new Set()
  return Array.from({ length: n }, (_, i) => {
    const role = roles[i % roles.length]
    const p = randomPlayer(role, 11, `${seed}-${i}`, taken)
    p.age = rng.int(19, 34)
    calibrateAttrs(p.attrs, role, rng.int(54, 70))
    p.id = `fa-${seed}-${i}`
    return ensurePlayer(p, rng)
  })
}

// Growth or decline for a fraction of a year. `share` = share of the team's matches he played (0–1).
export function develop(p, fraction, share, rng) {
  ensurePlayer(p, rng)
  const o = overall(p)
  const gap = Math.max(0, p.potential - o)
  let perYear
  if (p.age <= 20) perYear = gap * 0.45
  else if (p.age <= 23) perYear = gap * 0.32
  else if (p.age <= 27) perYear = gap * 0.2
  else if (p.age <= 30) perYear = -0.4
  else if (p.age <= 32) perYear = -1.4
  else perYear = -2.8
  if (perYear > 0) perYear *= 0.45 + 0.75 * Math.min(1, share)
  // A little randomness: good and bad spells.
  perYear += rng.gauss() * 0.6
  const delta = perYear * fraction
  if (Math.abs(delta) < 0.001) return 0
  const w = roleWeights(p.roles[0])
  const keys = ATTRS.map((a) => a.key)
  for (const k of keys) {
    // Each attribute moves at its own pace (random step and starting offset), so the
    // overall changes a point at a time instead of every attribute jumping together.
    let d = (delta / 5) * (w[k] ? 1 : 0.35) * rng.range(0.3, 1.7)
    // Ageing hits the legs first.
    if (delta < 0 && (k === 'pace' || k === 'stamina')) d *= 1.6
    if (k === 'goalkeeping' && p.roles[0] !== 'GK') continue
    p.xp[k] = (p.xp[k] ?? rng.range(-0.7, 0.7)) + d
    while (p.xp[k] >= 1) {
      p.attrs[k] = clampAttr(p.attrs[k] + 1)
      p.xp[k] -= 1
    }
    while (p.xp[k] <= -1) {
      p.attrs[k] = clampAttr(p.attrs[k] - 1)
      p.xp[k] += 1
    }
  }
  if (overall(p) > p.potential) p.potential = overall(p)
  return delta
}

// Youth academy: two teenagers per club and year, a few with real star potential.
export function youthIntake(team, seed) {
  const rng = createRng(seed)
  const roles = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
  const taken = new Set(team.players.map((p) => p.number))
  return [0, 1].map((i) => {
    const role = rng.pick(roles)
    const p = randomPlayer(role, 9, `${seed}-${i}`, taken)
    p.id = newId('youth')
    p.age = rng.int(16, 18)
    calibrateAttrs(p.attrs, role, rng.int(44, 56))
    p.potential = Math.min(92, overall(p) + rng.int(12, rng.chance(0.15) ? 40 : 28))
    p.contract = 3
    ensurePlayer(p, rng)
    p.wage = 0.05
    return p
  })
}

export function shouldRetire(p, rng) {
  if (p.age >= 39) return true
  if (p.age < 34) return false
  return rng.chance(0.15 + (p.age - 34) * 0.18 + (overall(p) < 62 ? 0.15 : 0))
}

export function squadValue(team) {
  return team.players.reduce((s, p) => s + playerValue(p), 0)
}

export function wageBill(team) {
  return team.players.reduce((s, p) => s + (p.wage ?? wageFor(p)), 0)
}

export { clampAttr }
