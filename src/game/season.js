// Career mode: the user manages one club through a competition (see competition.js).
import { createRng } from './rng.js'
import { simulateMatch } from './engine/match.js'
import { quickSim } from './quicksim.js'
import { normalizeFormat } from './formats.js'
import { createCompetition, currentMatchday, advance, allFixtures, groupTable, currentStage } from './competition.js'

export { roundRobin } from './competition.js'

export function createCareer(world, leagueId, userTeamId) {
  const league = world.leagues.find((l) => l.id === leagueId)
  const { format } = normalizeFormat(league.format)
  const teamIds = league.teamIds.filter((id) => world.teams.some((t) => t.id === id))
  // Fresh season: reset stats and fitness for everyone in the competition.
  for (const t of world.teams) {
    if (!teamIds.includes(t.id)) continue
    for (const p of t.players) {
      p.stats = { apps: 0, goals: 0, assists: 0, ratingSum: 0, yellows: 0, reds: 0 }
      p.condition = 100
      p.morale = 0
      p.suspension = 0
    }
  }
  const team = world.teams.find((t) => t.id === userTeamId)
  return {
    userTeamId,
    leagueId,
    name: league.name,
    sim: league.sim ?? 'quick',
    competition: createCompetition(format, teamIds, `${leagueId}-${Date.now()}`),
    news: [{ round: 0, text: `¡Bienvenido! Tomas el mando de ${team.name} en ${league.name}.` }],
    lastResult: null,
    matchdayNo: 1,
    finished: false,
  }
}

export function currentFixtures(career) {
  return currentMatchday(career.competition) ?? []
}

export function nextUserFixture(career) {
  return currentFixtures(career).find((m) => !m.result && (m.home === career.userTeamId || m.away === career.userTeamId)) ?? null
}

// Table of the group that contains the team (or the first group).
export function standings(world, career, teamId = career.userTeamId) {
  const comp = career.competition
  const st = [...comp.stages].reverse().find((s) => s && s.type !== 'knockout') ?? null
  if (!st) return []
  const g = Math.max(0, st.groups.findIndex((gr) => gr.teams.includes(teamId)))
  return groupTable(comp, st, g).map((r) => ({ ...r, name: world.teams.find((t) => t.id === r.id)?.name ?? r.id, short: world.teams.find((t) => t.id === r.id)?.short ?? r.id }))
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
  ;[fixture.home, fixture.away].forEach((tid, side) => {
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
        if (tid === career.userTeamId) career.news.push({ round: career.matchdayNo, text: `${p.name} suspendido 1 partido por expulsión.` })
      }
      p.condition = r.energy
      if (r.injured) {
        p.injury = rng.int(1, 3)
        p.injuryNote = rng.pick(INJURY_NOTES)
        if (tid === career.userTeamId) career.news.push({ round: career.matchdayNo, text: `${p.name}: ${p.injuryNote.toLowerCase()}, baja ${p.injury} partido(s).` })
      }
      p.morale = Math.max(-2, Math.min(2, p.morale + (diff > 0 ? 1 : diff < 0 ? -1 : 0) + (r.rating >= 7.5 ? 1 : r.rating < 5.8 ? -1 : 0)))
    }
  })
}

// Between matchdays everybody recovers some fitness.
export function recoverTeams(world, ids) {
  for (const t of world.teams) {
    if (ids && !ids.includes(t.id)) continue
    for (const p of t.players) p.condition = Math.min(100, Math.round(p.condition + 18 + p.attrs.stamina * 0.6))
  }
}

// Plays out the current matchday (everything except fixtures that already have a result) and advances.
export function completeRound(world, career) {
  const comp = career.competition
  const getTeam = (id) => world.teams.find((t) => t.id === id)
  for (const m of currentFixtures(career)) {
    if (m.result) continue
    const home = getTeam(m.home)
    const away = getTeam(m.away)
    if (!home || !away) continue
    const seed = `${comp.seed}-${m.id}`
    const result = career.sim === 'engine' ? simulateMatch(home, away, seed).result : quickSim(home, away, seed)
    applyResult(world, career, m, result)
  }
  const stageBefore = comp.stage
  const news = advance(comp, getTeam)
  for (const text of news) career.news.push({ round: career.matchdayNo, text })
  recoverTeams(world, comp.teamIds)
  career.matchdayNo++
  if (comp.stage !== stageBefore || comp.finished) {
    const alive = currentStage(comp)?.teams.includes(career.userTeamId)
    if (!comp.finished && !alive) career.news.push({ round: career.matchdayNo, text: `Tu equipo quedó fuera de ${currentStage(comp).name}. Puedes seguir simulando el torneo.` })
  }
  if (comp.finished) {
    career.finished = true
    const champ = getTeam(comp.champion)
    career.news.push({ round: career.matchdayNo, text: `🏆 ¡${champ?.name ?? '?'} es campeón de ${career.name}!` })
  }
}

export function topScorers(world, career, limit = 8) {
  const ids = new Set(career.competition.teamIds)
  const list = []
  for (const t of world.teams) {
    if (!ids.has(t.id)) continue
    for (const p of t.players) if (p.stats.goals > 0) list.push({ name: p.name, team: t.short, goals: p.stats.goals, assists: p.stats.assists })
  }
  return list.sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, limit)
}

export function userResults(career) {
  return allFixtures(career.competition).filter((m) => m.result && (m.home === career.userTeamId || m.away === career.userTeamId))
}
