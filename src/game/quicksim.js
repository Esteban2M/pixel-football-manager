// Fast statistical match simulation for matches the user does not watch.
// Goals follow a Poisson distribution whose mean depends on attack vs defence strength;
// the result has the same shape as the full engine's, so it feeds stats, injuries and morale.
import { createRng } from './rng.js'
import { FORMATIONS } from './formations.js'
import { ratingInSlot } from './player.js'
import { resolveLineup, resolveRoles, benchFor } from './team.js'
import { getRole } from './roles.js'

function lineupOf(team) {
  const ids = resolveLineup(team)
  const slots = FORMATIONS[team.tactics.formation]
  const roles = resolveRoles(team)
  return ids
    .map((id, i) => ({ p: team.players.find((x) => x.id === id), slot: slots[i], role: getRole(roles[i]) }))
    .filter((x) => x.p)
}

function strength(xi) {
  let att = 0
  let na = 0
  let def = 0
  let nd = 0
  for (const { p, slot } of xi) {
    const r = ratingInSlot(p, slot.role) * (0.85 + 0.15 * (p.condition / 100)) * (1 + (p.morale ?? 0) * 0.015)
    if (['ST', 'LW', 'RW', 'AM', 'CM'].includes(slot.role)) {
      att += r
      na++
    }
    if (['GK', 'CB', 'LB', 'RB', 'DM', 'CM'].includes(slot.role)) {
      def += r * (slot.role === 'GK' ? 1.5 : 1)
      nd += slot.role === 'GK' ? 1.5 : 1
    }
  }
  return { att: att / (na || 1), def: def / (nd || 1) }
}

function poisson(rng, lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng.next()
  } while (p > L && k < 12)
  return k - 1
}

function weightedPick(rng, items, weight) {
  const total = items.reduce((s, x) => s + weight(x), 0)
  let r = rng.next() * total
  for (const x of items) {
    r -= weight(x)
    if (r <= 0) return x
  }
  return items[items.length - 1]
}

const SCORER_WEIGHT = { ST: 2.6, LW: 1.8, RW: 1.8, AM: 1.8, CM: 0.9, DM: 0.4, LB: 0.35, RB: 0.35, CB: 0.4, GK: 0.01 }

export function quickSim(home, away, seed) {
  const rng = createRng(`quick-${seed}`)
  const teams = [home, away]
  const xis = teams.map(lineupOf)
  const st = xis.map(strength)
  const lambdas = [0, 1].map((t) => {
    const o = 1 - t
    const ment = teams[t].tactics.mentality * 0.06 - teams[o].tactics.mentality * 0.02
    const base = t === 0 ? 1.45 : 1.18
    return Math.min(3.4, Math.max(0.2, base * Math.exp((st[t].att - st[o].def) / 20 + ment)))
  })
  const score = lambdas.map((l) => poisson(rng, l))
  const players = {}
  const goals = []
  const minutesOf = {}

  teams.forEach((team, t) => {
    const xi = xis[t]
    // Three substitutions around the hour mark.
    const bench = benchFor(team, xi.map((x) => x.p.id))
    const subs = rng.int(2, 4)
    const outs = xi
      .filter((x) => x.slot.role !== 'GK')
      .sort((a, b) => a.p.attrs.stamina - b.p.attrs.stamina)
      .slice(0, subs)
    for (const x of xi) minutesOf[x.p.id] = 90
    outs.forEach((x, i) => {
      const inId = bench.find((id) => {
        const bp = team.players.find((p) => p.id === id)
        return bp && !bp.roles.includes('GK') && minutesOf[id] === undefined
      })
      if (!inId) return
      const m = rng.int(55, 80)
      minutesOf[x.p.id] = m
      minutesOf[inId] = 90 - m
      if (i === 0) xi.push({ p: team.players.find((p) => p.id === inId), slot: x.slot, role: x.role, sub: true })
    })
  })

  teams.forEach((team, t) => {
    const xi = xis[t]
    for (let g = 0; g < score[t]; g++) {
      const scorer = weightedPick(rng, xi, (x) => (SCORER_WEIGHT[x.slot.role] ?? 1) * x.role.shoot * (x.p.attrs.finishing + 2) * (x.sub ? 0.4 : 1))
      const assist = rng.chance(0.72)
        ? weightedPick(
            rng,
            xi.filter((x) => x !== scorer),
            (x) => (x.p.attrs.passing + 2) * x.role.pass * (['GK'].includes(x.slot.role) ? 0.05 : 1),
          )
        : null
      goals.push({ team: t, playerId: scorer.p.id, name: scorer.p.short, minute: rng.int(1, 90), own: false, assistId: assist?.p.id ?? null, penalty: rng.chance(0.08) })
    }
  })
  goals.sort((a, b) => a.minute - b.minute)

  let motm = null
  teams.forEach((team, t) => {
    const diff = score[t] - score[1 - t]
    for (const [id, minutes] of Object.entries(minutesOf)) {
      const p = team.players.find((x) => x.id === id)
      if (!p) continue
      const xiEntry = xis[t].find((x) => x.p.id === id)
      const role = xiEntry?.slot.role ?? p.roles[0]
      const g = goals.filter((x) => x.team === t && x.playerId === id).length
      const a = goals.filter((x) => x.team === t && x.assistId === id).length
      let rating = 6.4 + rng.gauss() * 0.35 + g * 0.9 + a * 0.5 + (diff > 0 ? 0.3 : diff < 0 ? -0.3 : 0)
      if (['GK', 'CB', 'LB', 'RB'].includes(role)) rating -= score[1 - t] * 0.22
      if (role === 'GK' && score[1 - t] === 0) rating += 0.5
      rating = Math.round(Math.max(4, Math.min(10, rating)) * 10) / 10
      const yellow = rng.chance(0.09) ? 1 : 0
      const red = rng.chance(0.006)
      players[id] = {
        team: t,
        rating,
        minutes,
        goals: g,
        assists: a,
        yellow,
        red,
        injured: rng.chance(0.012),
        energy: Math.round(Math.max(35, p.condition - minutes * (0.42 - p.attrs.stamina * 0.012) - rng.range(0, 6))),
      }
      if (!motm || rating > motm.rating) motm = { id, name: p.short, team: t, rating }
    }
  })

  const shots = score.map((s, t) => s * 2 + Math.round(lambdas[t] * 6 + rng.range(2, 6)))
  const poss = Math.round(50 + (st[0].att - st[1].att) * 0.8 + rng.range(-6, 6))
  return {
    homeId: home.id,
    awayId: away.id,
    score,
    goals,
    stats: [0, 1].map((t) => ({
      shots: shots[t],
      onTarget: Math.min(shots[t], score[t] + rng.int(1, 5)),
      possessionPct: t === 0 ? Math.max(25, Math.min(75, poss)) : 100 - Math.max(25, Math.min(75, poss)),
      corners: rng.int(1, 8),
    })),
    players,
    motm,
    quick: true,
  }
}

// Penalty shootout: five each, then sudden death. Returns [home, away].
export function shootout(home, away, seed) {
  const rng = createRng(`pens-${seed}`)
  const taker = (team) => {
    const fs = team.players.map((p) => p.attrs.finishing).sort((a, b) => b - a)
    return fs.slice(0, 5).reduce((s, v) => s + v, 0) / 5
  }
  const keeper = (team) => Math.max(...team.players.filter((p) => p.roles.includes('GK')).map((p) => p.attrs.goalkeeping), 8)
  const pScore = [0.72 + (taker(home) - keeper(away)) * 0.01, 0.72 + (taker(away) - keeper(home)) * 0.01]
  const s = [0, 0]
  for (let i = 0; i < 5; i++) {
    for (const t of [0, 1]) if (rng.chance(pScore[t])) s[t]++
    const left = 4 - i
    if (s[0] > s[1] + left + (0) || s[1] > s[0] + left) break
  }
  let guard = 0
  while (s[0] === s[1] && guard++ < 30) {
    const a = rng.chance(pScore[0])
    const b = rng.chance(pScore[1])
    if (a) s[0]++
    if (b) s[1]++
  }
  if (s[0] === s[1]) s[rng.int(0, 1)]++
  return s
}
