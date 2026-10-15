// Career mode: the user manages one club through a competition (see competition.js).
import { createRng } from './rng.js'
import { simulateMatch } from './engine/match.js'
import { quickSim } from './quicksim.js'
import { normalizeFormat } from './formats.js'
import { createCompetition, currentMatchday, advance, allFixtures, groupTable, currentStage, overallRanking } from './competition.js'
import { overall } from './player.js'
import { ensureEconomy, develop, youthIntake, shouldRetire, wageBill, generateFreeAgents, formatMoney, wageFor } from './economy.js'
import { generateOffers, aiTransfers, ensureSquad, transferPlayer, WINDOW_MATCHDAYS } from './market.js'

export { roundRobin } from './competition.js'

const FIRST_YEAR = 2026

// Short tournaments (Apertura/Clausura) mean two seasons per football year.
export function seasonsPerYear(league) {
  if (league.seasonsPerYear) return league.seasonsPerYear
  return /apertura|clausura/i.test(league.name) || /^liga-mx/.test(league.format?.id ?? '') ? 2 : 1
}

export function seasonLabel(spy, year, half) {
  if (spy === 2) return `${half === 0 ? 'Apertura' : 'Clausura'} ${year + half}`
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`
}

function baseLeagueName(name) {
  return name.replace(/\s*·?\s*(apertura|clausura)?\s*\d{4}(\/\d{2,4})?\s*$/i, '').trim() || name
}

function resetSeasonStats(world, ids) {
  for (const t of world.teams) {
    if (ids && !ids.includes(t.id)) continue
    for (const p of t.players) {
      p.stats = { apps: 0, goals: 0, assists: 0, ratingSum: 0, yellows: 0, reds: 0 }
      p.condition = 100
      p.morale = 0
      p.suspension = 0
      p.seasonStartOvr = overall(p)
    }
  }
}

export function createCareer(world, leagueId, userTeamId) {
  const league = world.leagues.find((l) => l.id === leagueId)
  const { format } = normalizeFormat(league.format)
  const teamIds = league.teamIds.filter((id) => world.teams.some((t) => t.id === id))
  ensureEconomy(world, `economy-${leagueId}`)
  // Fresh season: reset stats and fitness for everyone in the competition.
  resetSeasonStats(world, teamIds)
  const team = world.teams.find((t) => t.id === userTeamId)
  const spy = seasonsPerYear(league)
  const label = seasonLabel(spy, FIRST_YEAR, 0)
  return {
    userTeamId,
    leagueId,
    name: `${baseLeagueName(league.name)} · ${label}`,
    sim: league.sim ?? 'quick',
    competition: createCompetition(format, teamIds, `${leagueId}-${Date.now()}`),
    news: [{ round: 0, text: `¡Bienvenido! Tomas el mando de ${team.name} en ${league.name}. Presupuesto: ${formatMoney(team.finances.budget)}.` }],
    lastResult: null,
    matchdayNo: 1,
    finished: false,
    ...careerDefaults(spy, label),
  }
}

export function careerDefaults(spy = 1, label = seasonLabel(spy, FIRST_YEAR, 0)) {
  return { season: 1, year: FIRST_YEAR, half: 0, seasonsPerYear: spy, seasonLabel: label, transfers: [], offers: [], negotiations: {}, history: [], summary: null }
}

// Older saves started before career mode: add the missing fields.
export function ensureCareer(world, career) {
  if (!career) return career
  ensureEconomy(world, `economy-${career.leagueId}`)
  if (career.season == null) {
    const league = world.leagues.find((l) => l.id === career.leagueId)
    Object.assign(career, careerDefaults(league ? seasonsPerYear(league) : 1))
  }
  return career
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
  developRound(world, career)
  const news = advance(comp, getTeam)
  for (const text of news) career.news.push({ round: career.matchdayNo, text })
  recoverTeams(world, comp.teamIds)
  career.matchdayNo++
  if (career.offers) generateOffers(world, career, createRng(`offers-${comp.seed}-${career.matchdayNo}`))
  if (comp.stage !== stageBefore || comp.finished) {
    const alive = currentStage(comp)?.teams.includes(career.userTeamId)
    if (!comp.finished && !alive) career.news.push({ round: career.matchdayNo, text: `Tu equipo quedó fuera de ${currentStage(comp).name}. Puedes seguir simulando el torneo.` })
  }
  if (comp.finished) {
    career.finished = true
    const champ = getTeam(comp.champion)
    career.news.push({ round: career.matchdayNo, text: `🏆 ¡${champ?.name ?? '?'} es campeón de ${career.name}!` })
    if (career.offers) generateOffers(world, career, createRng(`offers-${comp.seed}-end`))
  }
}

// Growth happens during the regular phase, spread over its matchdays; playing time speeds it up.
function developRound(world, career) {
  if (career.seasonsPerYear == null) return
  const comp = career.competition
  const first = comp.stages[0]
  if (comp.stage !== 0 || !first) return
  const fraction = 1 / career.seasonsPerYear / Math.max(6, first.matchdays.length)
  const rng = createRng(`dev-${comp.seed}-${career.matchdayNo}`)
  for (const t of world.teams) {
    if (!comp.teamIds.includes(t.id)) continue
    for (const p of t.players) develop(p, fraction, Math.min(1, p.stats.apps / Math.max(1, career.matchdayNo)), rng)
  }
}

// Final regular-phase position of every team (1-based), plus the champion.
export function finalPositions(career) {
  const comp = career.competition
  const st = comp.stages.find((s) => s && s.type !== 'knockout') ?? comp.stages[0]
  const order = st ? overallRanking(comp, st) : comp.teamIds
  const pos = {}
  order.forEach((id, i) => (pos[id] = i + 1))
  return pos
}

function prizeMoney(pos, n, champion) {
  return (champion ? 2.5 : 0) + Math.max(0, (n - pos + 1) / n) * 2
}

// Closes the finished season and sets up the next one: finances, ageing, contracts, retirements,
// youth intake, AI transfers and a new competition with the same league.
export function startNextSeason(world, career) {
  if (!career.finished) return career
  ensureCareer(world, career)
  const league = world.leagues.find((l) => l.id === career.leagueId)
  const comp = career.competition
  const rng = createRng(`season-${comp.seed}-${career.season}`)
  const user = world.teams.find((t) => t.id === career.userTeamId)
  const spy = career.seasonsPerYear
  const pos = finalPositions(career)
  const n = comp.teamIds.length
  const summary = { label: career.seasonLabel, risers: [], decliners: [], retired: [], youth: [], expired: [], aiMoves: 0 }

  // Season review for the user's club.
  const top = user.players.slice().sort((a, b) => b.stats.goals - a.stats.goals)[0]
  career.history.push({
    season: career.season,
    label: career.seasonLabel,
    name: career.name,
    position: pos[user.id] ?? null,
    teams: n,
    champion: comp.champion,
    won: comp.champion === user.id,
    topScorer: top && top.stats.goals ? { name: top.name, goals: top.stats.goals } : null,
    budget: user.finances.budget,
  })
  for (const p of user.players) {
    const d = overall(p) - (p.seasonStartOvr ?? overall(p))
    if (d >= 2) summary.risers.push({ name: p.name, from: p.seasonStartOvr, to: overall(p) })
    if (d <= -2) summary.decliners.push({ name: p.name, from: p.seasonStartOvr, to: overall(p) })
  }

  // Money: income scales with the club's size, plus prize money; wages are paid per season.
  for (const t of world.teams) {
    if (!t.finances) continue
    t.finances.baseIncome ??= Math.round((wageBill(t) * 1.02 + 0.4) * 100) / 100
    const prize = pos[t.id] ? prizeMoney(pos[t.id], n, comp.champion === t.id) : 0
    const income = t.finances.baseIncome / spy + prize / spy
    const wages = wageBill(t) / spy
    t.finances.lastIncome = Math.round(income * 100) / 100
    t.finances.lastWages = Math.round(wages * 100) / 100
    t.finances.budget = Math.round((t.finances.budget + income - wages) * 100) / 100
  }

  // Clubs outside this competition keep developing as if they had played a season.
  for (const t of world.teams) {
    if (comp.teamIds.includes(t.id)) continue
    for (const p of t.players) develop(p, 1 / spy, 0.7, rng)
  }

  // Next season's label.
  career.season++
  if (spy === 2) {
    career.half = 1 - career.half
    if (career.half === 0) career.year++
  } else career.year++
  const newYear = spy === 1 || career.half === 0
  career.seasonLabel = seasonLabel(spy, career.year, career.half)

  if (newYear) yearRollover(world, career, rng, summary)

  // AI clubs do their business; the user's club gets bids during the window.
  summary.aiMoves = aiTransfers(world, career, rng).length
  for (const t of world.teams) {
    ensureSquad(world, t, `squad-${t.id}-${career.season}`)
    if (t.id !== career.userTeamId) t.lineup = null
  }
  if (world.freeAgents.length < 20) world.freeAgents.push(...generateFreeAgents(`fa-${career.season}`, 20))

  // Accumulate career totals and reset the season.
  for (const t of world.teams) {
    for (const p of t.players) {
      p.totals ??= { apps: 0, goals: 0, assists: 0, seasons: 0 }
      p.totals.apps += p.stats.apps
      p.totals.goals += p.stats.goals
      p.totals.assists += p.stats.assists
      if (p.stats.apps) p.totals.seasons++
      p.injury = 0
    }
  }
  const { format } = normalizeFormat(league?.format ?? comp.format)
  const teamIds = (league?.teamIds ?? comp.teamIds).filter((id) => world.teams.some((t) => t.id === id))
  resetSeasonStats(world)
  career.name = `${baseLeagueName(league?.name ?? career.name)} · ${career.seasonLabel}`
  career.competition = createCompetition(format, teamIds, `${career.leagueId}-${career.season}-${Date.now()}`)
  career.matchdayNo = 1
  career.finished = false
  career.lastResult = null
  career.negotiations = {}
  career.offers = []
  career.summary = summary
  career.news.push({ round: 0, text: `📅 Comienza ${career.name}. Presupuesto: ${formatMoney(user.finances.budget)}. El mercado sigue abierto ${WINDOW_MATCHDAYS} jornadas.` })
  generateOffers(world, career, createRng(`offers-${career.season}-start`))
  return career
}

function yearRollover(world, career, rng, summary) {
  const userId = career.userTeamId
  for (const t of world.teams) {
    for (const p of t.players.slice()) {
      p.age++
      p.contract = (p.contract ?? 1) - 1
      if (shouldRetire(p, rng)) {
        t.players.splice(t.players.indexOf(p), 1)
        if (t.id === userId) summary.retired.push({ name: p.name, age: p.age })
        continue
      }
      if (p.contract > 0) continue
      if (t.id === userId) {
        // Contracts the user did not renew run out.
        transferPlayer(world, career, { playerId: p.id, fromId: t.id, toId: null })
        summary.expired.push({ name: p.name, age: p.age })
      } else if (p.age <= 32 || overall(p) >= 68) {
        p.contract = rng.int(1, p.age >= 30 ? 2 : 4)
        p.wage = wageFor(p)
      } else transferPlayer(world, career, { playerId: p.id, fromId: t.id, toId: null })
    }
    if (t.players.length < 28) {
      const kids = youthIntake(t, `youth-${t.id}-${career.year}`)
      t.players.push(...kids)
      if (t.id === userId) summary.youth.push(...kids.map((k) => ({ name: k.name, role: k.roles[0], ovr: overall(k), potential: k.potential })))
    }
  }
  world.freeAgents = (world.freeAgents ?? []).filter((p) => {
    p.age++
    return !shouldRetire(p, rng)
  })
  // Keep the pool from growing without limit.
  world.freeAgents.sort((a, b) => overall(b) - overall(a))
  world.freeAgents.length = Math.min(world.freeAgents.length, 60)
  for (const p of summary.retired) career.news.push({ round: 0, text: `👋 ${p.name} se retira a los ${p.age} años.` })
  for (const p of summary.expired) career.news.push({ round: 0, text: `${p.name} termina contrato y se va libre.` })
  for (const p of summary.youth) career.news.push({ round: 0, text: `🌱 Cantera: sube ${p.name} (${p.role}, ${p.ovr}).` })
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
