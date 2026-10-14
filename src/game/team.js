import { FORMATIONS } from './formations.js'
import { ratingInSlot, overall } from './player.js'

export function isAvailable(p) {
  return p.injury === 0 && p.suspension === 0
}

// Order in which slots are filled: scarce positions first.
const FILL_ORDER = ['GK', 'CB', 'LB', 'RB', 'DM', 'ST', 'CM', 'AM', 'LW', 'RW']

function pickScore(p, role) {
  return ratingInSlot(p, role) * (0.55 + 0.45 * (p.condition / 100))
}

// Greedy assignment: for each slot (scarcest first) take the best remaining player.
export function autoLineup(team, formation = team.tactics.formation, keep = []) {
  const slots = FORMATIONS[formation]
  const result = new Array(slots.length).fill(null)
  const used = new Set()
  keep.forEach((id, i) => {
    const p = id && team.players.find((pl) => pl.id === id)
    if (p && isAvailable(p) && i < slots.length && !used.has(id)) {
      result[i] = id
      used.add(id)
    }
  })
  const order = slots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.s.role) - FILL_ORDER.indexOf(b.s.role))
  for (const { s, i } of order) {
    if (result[i]) continue
    let best = null
    let bestScore = -1
    for (const p of team.players) {
      if (used.has(p.id) || !isAvailable(p)) continue
      const sc = pickScore(p, s.role)
      if (sc > bestScore) {
        bestScore = sc
        best = p
      }
    }
    if (best) {
      result[i] = best.id
      used.add(best.id)
    }
  }
  return result
}

// The lineup actually used: the saved one, with unavailable players auto-replaced.
export function resolveLineup(team) {
  const slots = FORMATIONS[team.tactics.formation]
  const saved = team.lineup && team.lineup.length === slots.length ? team.lineup : []
  return autoLineup(team, team.tactics.formation, saved)
}

export function benchFor(team, lineup, size = 9) {
  const inXI = new Set(lineup)
  return team.players
    .filter((p) => !inXI.has(p.id) && isAvailable(p))
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, size)
    .map((p) => p.id)
}

export function teamStrength(team) {
  const lineup = resolveLineup(team)
  const slots = FORMATIONS[team.tactics.formation]
  let sum = 0
  lineup.forEach((id, i) => {
    const p = team.players.find((pl) => pl.id === id)
    if (p) sum += ratingInSlot(p, slots[i].role)
  })
  return Math.round(sum / slots.length)
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function colorDistance(a, b) {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

// The away team switches to its second kit when the shirts look too similar.
export function pickKits(home, away) {
  const h = home.kits.home
  let a = away.kits.home
  if (colorDistance(h.shirt, a.shirt) < 120) a = away.kits.away
  return [{ ...h, gk: home.kits.gk }, { ...a, gk: away.kits.gk }]
}

// Keeps the same eleven when switching formation, re-seating them in the best slots.
export function reassignLineup(team, lineup, formation) {
  const current = new Set(lineup.filter(Boolean))
  const sub = { ...team, players: team.players.filter((p) => current.has(p.id)) }
  const placed = autoLineup(sub, formation)
  return autoLineup(team, formation, placed)
}
