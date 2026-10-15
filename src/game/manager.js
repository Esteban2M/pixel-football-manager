// The manager's own career: board objectives, board confidence, sackings, reputation and job offers.
import { createRng } from './rng.js'
import { teamStrength } from './team.js'
import { overallRanking } from './competition.js'

export const START_CONFIDENCE = 65
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

// Rank (1 = strongest) of a team among a list of ids, by current squad strength.
function strengthRank(world, ids, teamId) {
  const list = ids
    .map((id) => world.teams.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => ({ id: t.id, s: teamStrength(t) }))
    .sort((a, b) => b.s - a.s)
  return { rank: list.findIndex((x) => x.id === teamId) + 1, n: list.length }
}

function leagueStage(comp) {
  return comp.stages.find((s) => s && s.type !== 'knockout') ?? null
}

// Positions of the regular phase (1-based).
export function regularPositions(comp) {
  const st = leagueStage(comp)
  if (!st) return {}
  const pos = {}
  overallRanking(comp, st).forEach((id, i) => (pos[id] = i + 1))
  return pos
}

// The board's goal for the season, depending on how strong the squad is compared to the rivals.
export function makeObjective(world, comp, teamId) {
  const def = comp.format.stages[0]
  if (!def || def.type === 'knockout') return { kind: 'cup', text: 'Llegar lo más lejos posible en el torneo', target: null }
  const { rank, n } = strengthRank(world, comp.teamIds, teamId)
  const next = comp.format.stages[1]
  const qualifySpots = next?.qualify?.top ?? null
  if (rank <= 2) return { kind: 'title', text: 'Pelear el título: top 2 de la fase regular o campeón', target: 2 }
  if (rank <= 4) return { kind: 'top', text: 'Terminar entre los 4 primeros', target: 4 }
  if (qualifySpots && rank <= qualifySpots + 2) return { kind: 'qualify', text: `Clasificar a ${next.name} (top ${qualifySpots})`, target: qualifySpots }
  // Weaker squads get a goal a few places below where their squad ranks: demanding but reachable.
  const target = Math.min(n - 1, rank + 3)
  if (target >= n - 1) return { kind: 'survive', text: 'No terminar en el último lugar', target }
  return { kind: 'mid', text: `Terminar en el puesto ${target} o mejor`, target }
}

export function createManager(world, career, name = 'Tú') {
  const { rank, n } = strengthRank(world, career.competition.teamIds, career.userTeamId)
  return {
    name,
    reputation: Math.round(25 + (1 - (rank - 1) / Math.max(1, n - 1)) * 40),
    titles: 0,
    sackings: 0,
    stints: [{ teamId: career.userTeamId, from: career.seasonLabel, to: null, seasons: 0, titles: 0, w: 0, d: 0, l: 0 }],
  }
}

export function currentStint(career) {
  return career.manager.stints[career.manager.stints.length - 1]
}

// Prestige 0–100 of a club among every club in the world.
export function prestige(world, teamId) {
  const ids = world.teams.map((t) => t.id)
  const { rank, n } = strengthRank(world, ids, teamId)
  return Math.round(100 * (1 - (rank - 1) / Math.max(1, n - 1)))
}

// After each matchday: results move the board's mood, and so does the table compared to the goal.
export function updateConfidence(career, userFixtures) {
  const id = career.userTeamId
  const stint = currentStint(career)
  for (const f of userFixtures) {
    if (!f.result) continue
    const side = f.home === id ? 0 : 1
    const diff = f.result.score[side] - f.result.score[1 - side]
    const d = diff > 0 ? 2 : diff < 0 ? -2.5 : 0.3
    career.board.confidence = clamp(career.board.confidence + d)
    if (diff > 0) stint.w++
    else if (diff < 0) stint.l++
    else stint.d++
  }
  const obj = career.board.objective
  if (obj?.target && career.competition.stage === 0) {
    const pos = regularPositions(career.competition)[id]
    if (pos && career.matchdayNo >= 4) {
      const gap = pos - obj.target
      if (gap >= 4) career.board.confidence = clamp(career.board.confidence - 1.5)
      else if (gap <= -2) career.board.confidence = clamp(career.board.confidence + 0.5)
    }
  }
  career.board.confidence = Math.round(career.board.confidence * 10) / 10
}

export function boardMood(confidence) {
  if (confidence >= 80) return { label: 'Encantada', color: 'var(--good)' }
  if (confidence >= 60) return { label: 'Satisfecha', color: 'var(--good)' }
  if (confidence >= 40) return { label: 'Inquieta', color: 'var(--accent)' }
  if (confidence >= 20) return { label: 'Molesta', color: 'var(--warn)' }
  return { label: 'Tu puesto peligra', color: 'var(--bad)' }
}

// Mid-season sacking: only after a few matchdays and when the board has run out of patience.
export function shouldSackNow(career) {
  return !career.sacked && career.matchdayNo >= 7 && career.board.confidence <= 8 && !career.competition.finished
}

// End of season: was the goal met? Updates confidence and reputation and decides the manager's fate.
export function reviewSeason(world, career) {
  const comp = career.competition
  const id = career.userTeamId
  const obj = career.board.objective
  const pos = regularPositions(comp)[id] ?? null
  const champion = comp.champion === id
  let met
  if (!obj?.target) met = champion || null
  else met = champion || (pos != null && pos <= obj.target)
  const gap = obj?.target && pos ? pos - obj.target : 0
  const confDelta = met === null ? 0 : met ? (champion ? 30 : 18) : -15 - Math.min(15, gap * 2)
  const repDelta = (champion ? 10 : 0) + (met === null ? 0 : met ? 4 : -5)
  career.board.confidence = Math.round(clamp(career.board.confidence + confDelta) * 10) / 10
  career.manager.reputation = clamp(career.manager.reputation + repDelta)
  const stint = currentStint(career)
  stint.seasons++
  if (champion) {
    stint.titles++
    career.manager.titles++
  }
  const sacked = !champion && career.board.confidence < 25
  const review = { objective: obj, position: pos, champion, met, confDelta, repDelta, sacked }
  career.review = review
  if (sacked) sack(world, career, 'Fin de temporada')
  else career.news.push({ round: career.matchdayNo, text: met === false ? `La directiva está decepcionada: no se cumplió el objetivo (${obj.text.toLowerCase()}).` : met ? `✅ Objetivo cumplido: ${obj.text.toLowerCase()}.` : 'Temporada terminada.' })
  career.jobOffers = jobOffers(world, career, createRng(`jobs-${comp.seed}-${career.season}`), { sacked })
  return review
}

export function sack(world, career, when) {
  const team = world.teams.find((t) => t.id === career.userTeamId)
  career.sacked = { teamId: team.id, when, label: career.seasonLabel }
  career.manager.sackings++
  career.manager.reputation = clamp(career.manager.reputation - 8)
  currentStint(career).to = career.seasonLabel
  currentStint(career).sacked = true
  career.offers = []
  career.news.push({ round: career.matchdayNo, text: `❌ ${team.name} te ha destituido. La directiva perdió la confianza.` })
}

// Clubs that want to hire the manager. Mid-season only clubs of the running competition (so the
// career goes on); between seasons any club that belongs to a league.
export function jobOffers(world, career, rng, { sacked = false, midSeason = false } = {}) {
  const rep = career.manager.reputation
  const inLeague = new Set(world.leagues.flatMap((l) => l.teamIds))
  const pool = midSeason ? new Set(career.competition.teamIds) : inLeague
  const pos = regularPositions(career.competition)
  const n = career.competition.teamIds.length
  const candidates = world.teams.filter((t) => pool.has(t.id) && t.id !== career.userTeamId && t.id !== career.sacked?.teamId)
  const offers = []
  for (const t of candidates.sort(() => rng.next() - 0.5)) {
    const pr = prestige(world, t.id)
    if (pr > rep + 15) continue
    // Clubs doing badly are the ones looking for a new coach.
    const struggling = pos[t.id] ? pos[t.id] > n / 2 : false
    const chance = (sacked ? 0.25 : 0.1) + (struggling ? 0.25 : 0)
    if (rng.chance(chance)) offers.push({ teamId: t.id, prestige: pr })
    if (offers.length >= 3) break
  }
  // A sacked manager always gets at least one way back in, from a smaller club.
  if (sacked && !offers.length) {
    const fallback = candidates.map((t) => ({ teamId: t.id, prestige: prestige(world, t.id) })).sort((a, b) => a.prestige - b.prestige)
    offers.push(...fallback.slice(0, 2))
  }
  return offers.sort((a, b) => b.prestige - a.prestige)
}
