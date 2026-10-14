import { FORMATIONS, FORMATION_ROLES } from './formations.js'
import { validRole, bestRoleFor, roleSuitability } from './roles.js'
import { ratingInSlot, overall } from './player.js'

export function isAvailable(p) {
  return p.injury === 0 && p.suspension === 0
}

// Order in which slots are filled: scarce positions first.
const FILL_ORDER = ['GK', 'CB', 'LB', 'RB', 'DM', 'ST', 'CM', 'AM', 'LW', 'RW']

// Position rating, adjusted by fitness and by how well he suits the slot's tactical role.
function pickScore(p, role, roleKey) {
  const base = ratingInSlot(p, role) * (0.55 + 0.45 * (p.condition / 100))
  return roleKey ? base * 0.8 + roleSuitability(p, roleKey) * 0.2 : base
}

function slotRoles(team, formation) {
  if (formation === team.tactics.formation) return resolveRoles(team)
  return FORMATIONS[formation].map((s, i) => validRole(FORMATION_ROLES[formation][i], s.role))
}

// Greedy assignment: for each slot (scarcest first) take the best remaining player.
export function autoLineup(team, formation = team.tactics.formation, keep = []) {
  const slots = FORMATIONS[formation]
  const roleKeys = slotRoles(team, formation)
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
      const sc = pickScore(p, s.role, roleKeys[i])
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
  // Local search (pairwise swaps): fixes greedy choices such as the better centre-back
  // taking the ball-playing slot meant for his partner.
  const kept = new Set(keep.filter(Boolean))
  const byId = (id) => team.players.find((p) => p.id === id)
  const score = (id, i) => (id ? pickScore(byId(id), slots[i].role, roleKeys[i]) : 0)
  for (let pass = 0, improved = true; improved && pass < 4; pass++) {
    improved = false
    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        const pa = result[a]
        const pb = result[b]
        if (!pa || !pb || kept.has(pa) || kept.has(pb) || slots[a].role === 'GK' || slots[b].role === 'GK') continue
        if (score(pb, a) + score(pa, b) > score(pa, a) + score(pb, b) + 0.01) {
          result[a] = pb
          result[b] = pa
          improved = true
        }
      }
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

// Tactical role of each slot: the saved choice when it fits the slot, else the formation default.
export function resolveRoles(team, formation = team.tactics.formation) {
  const slots = FORMATIONS[formation]
  const saved = team.tactics.roles && team.tactics.roles.length === slots.length ? team.tactics.roles : FORMATION_ROLES[formation]
  return slots.map((s, i) => validRole(saved[i], s.role))
}

// Gives every starter the role he plays best from his slot.
export function autoRoles(team, lineup = resolveLineup(team)) {
  const slots = FORMATIONS[team.tactics.formation]
  return slots.map((s, i) => {
    const p = team.players.find((pl) => pl.id === lineup[i])
    return p ? bestRoleFor(p, s.role) : validRole(null, s.role)
  })
}
