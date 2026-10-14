import { createRng } from './rng.js'
import { simulateMatch } from './engine/match.js'

// Round-robin scheduling with the "circle method": fix one team, rotate the rest.
export function roundRobin(ids) {
  const list = ids.slice()
  if (list.length % 2) list.push(null) // odd number of teams: someone rests each round
  const n = list.length
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const matches = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a && b) matches.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a })
    }
    rounds.push(matches)
    list.splice(1, 0, list.pop())
  }
  return rounds
}

// Double round robin, repeated until there are at least `minRounds` matchdays.
export function buildFixtures(ids, minRounds = 6) {
  const single = roundRobin(ids)
  const double = [...single, ...single.map((r) => r.map((m) => ({ home: m.away, away: m.home })))]
  const cycles = Math.max(1, Math.ceil(minRounds / double.length))
  const rounds = []
  for (let c = 0; c < cycles; c++) rounds.push(...double.map((r) => r.map((m) => ({ ...m }))))
  return rounds.map((r, i) => r.map((m, j) => ({ id: `r${i}-m${j}`, ...m, result: null })))
}

export function createCareer(world, userTeamId) {
  const ids = world.teams.map((t) => t.id)
  // Fresh season: reset stats and fitness for everyone.
  for (const t of world.teams) {
    for (const p of t.players) {
      p.stats = { apps: 0, goals: 0, assists: 0, ratingSum: 0, yellows: 0, reds: 0 }
      p.condition = 100
      p.morale = 0
      p.suspension = 0
    }
  }
  return {
    userTeamId,
    name: 'Liga Pixel MX · Apertura 2026',
    rounds: buildFixtures(ids),
    current: 0,
    news: [{ round: 0, text: `¡Bienvenido! Tomas el mando de ${world.teams.find((t) => t.id === userTeamId).name}.` }],
    lastResult: null,
    finished: false,
  }
}

export function nextUserFixture(career) {
  const round = career.rounds[career.current]
  if (!round) return null
  return round.find((m) => m.home === career.userTeamId || m.away === career.userTeamId) ?? null
}

export function standings(world, career) {
  const rows = new Map(world.teams.map((t) => [t.id, { id: t.id, name: t.name, short: t.short, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]))
  for (const round of career.rounds) {
    for (const m of round) {
      if (!m.result) continue
      const [hg, ag] = m.result.score
      const h = rows.get(m.home)
      const a = rows.get(m.away)
      if (!h || !a) continue
      h.p++
      a.p++
      h.gf += hg
      h.ga += ag
      a.gf += ag
      a.ga += hg
      if (hg > ag) {
        h.w++
        a.l++
        h.pts += 3
        h.form.push('V')
        a.form.push('D')
      } else if (hg < ag) {
        a.w++
        h.l++
        a.pts += 3
        h.form.push('D')
        a.form.push('V')
      } else {
        h.d++
        a.d++
        h.pts++
        a.pts++
        h.form.push('E')
        a.form.push('E')
      }
    }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name))
}

const INJURY_NOTES = ['Lesión muscular', 'Esguince de tobillo', 'Golpe en la rodilla', 'Sobrecarga en el aductor']

// Writes a finished match into the world: player stats, fitness, injuries, suspensions, morale.
export function applyResult(world, career, fixture, result) {
  const rng = createRng(`apply-${fixture.id}-${result.score.join('-')}`)
  fixture.result = {
    score: result.score,
    goals: result.goals.map((g) => ({ ...g })),
    motm: result.motm,
    stats: result.stats.map((s) => ({ shots: s.shots, onTarget: s.onTarget, possessionPct: s.possessionPct, corners: s.corners })),
  }
  const teamIds = [fixture.home, fixture.away]
  teamIds.forEach((tid, side) => {
    const team = world.teams.find((t) => t.id === tid)
    if (!team) return
    const diff = result.score[side] - result.score[1 - side]
    for (const p of team.players) {
      const r = result.players[p.id]
      if (!r) {
        if (p.suspension > 0) p.suspension--
        if (p.injury > 0) p.injury--
        continue
      }
      if (p.injury > 0) p.injury--
      p.stats.apps++
      p.stats.goals += r.goals
      p.stats.assists += r.assists
      p.stats.ratingSum += r.rating
      p.stats.yellows += r.yellow
      if (r.red) {
        p.stats.reds++
        p.suspension = 1
        career.news.push({ round: career.current, text: `${p.name} (${team.short}) suspendido 1 partido por expulsión.` })
      }
      p.condition = r.energy
      if (r.injured) {
        p.injury = rng.int(1, 3)
        p.injuryNote = rng.pick(INJURY_NOTES)
        career.news.push({ round: career.current, text: `${p.name} (${team.short}): ${p.injuryNote.toLowerCase()}, baja ${p.injury} partido(s).` })
      }
      p.morale = Math.max(-2, Math.min(2, p.morale + (diff > 0 ? 1 : diff < 0 ? -1 : 0) + (r.rating >= 7.5 ? 1 : r.rating < 5.8 ? -1 : 0)))
    }
  })
}

// Between matchdays everybody recovers some fitness.
export function recoverTeams(world) {
  for (const t of world.teams) {
    for (const p of t.players) {
      p.condition = Math.min(100, Math.round(p.condition + 18 + p.attrs.stamina * 0.6))
    }
  }
}

// Finishes the current round: simulates the matches the user did not play and advances.
export function completeRound(world, career) {
  const round = career.rounds[career.current]
  for (const m of round) {
    if (m.result) continue
    const home = world.teams.find((t) => t.id === m.home)
    const away = world.teams.find((t) => t.id === m.away)
    if (!home || !away) continue
    const { result } = simulateMatch(home, away, `${m.id}-${career.name}`)
    applyResult(world, career, m, result)
  }
  recoverTeams(world)
  career.current++
  if (career.current >= career.rounds.length) {
    career.finished = true
    const table = standings(world, career)
    const champ = world.teams.find((t) => t.id === table[0].id)
    career.news.push({ round: career.current, text: `🏆 ¡${champ.name} es campeón de la ${career.name}!` })
  }
}

export function topScorers(world, limit = 5) {
  const list = []
  for (const t of world.teams) for (const p of t.players) if (p.stats.goals > 0) list.push({ name: p.name, team: t.short, goals: p.stats.goals, assists: p.stats.assists })
  return list.sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, limit)
}
