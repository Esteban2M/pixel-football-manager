// Competition engine: runs any format from formats.js as a sequence of stages and matchdays.
import { createRng } from './rng.js'
import { shootout } from './quicksim.js'

// ---------- scheduling ----------

// Round robin with the "circle method": fix one team, rotate the rest.
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

function leagueSchedule(teams, rounds) {
  const single = roundRobin(teams)
  const out = []
  for (let r = 0; r < rounds; r++) out.push(...single.map((md) => md.map((m) => (r % 2 ? { home: m.away, away: m.home } : { ...m }))))
  return out
}

// Standard bracket order so that seeds 1 and 2 can only meet in the final: 8 → [1,8,4,5,2,7,3,6].
export function bracketOrder(size) {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

function roundName(teams) {
  return { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final', 16: 'Octavos de final', 32: 'Dieciseisavos' }[teams] ?? `Ronda de ${teams}`
}

// ---------- creation ----------

export function createCompetition(format, teamIds, seed = 'comp') {
  const comp = { format, teamIds: teamIds.slice(), stages: [], stage: 0, md: 0, finished: false, champion: null, seed: String(seed), seq: 0 }
  startStage(comp, 0, teamIds.slice())
  settle(comp, () => null, [])
  return comp
}

function fixture(comp, m, extra = {}) {
  comp.seq++
  return { id: `f${comp.seq}`, home: m.home, away: m.away, result: null, ...extra }
}

function makeGroups(def, entrants) {
  const n = entrants.length
  if (def.split) {
    const groups = []
    let at = 0
    def.split.forEach((g, i) => {
      const size = g.half ? Math.ceil(n / 2) : g.size == null || i === def.split.length - 1 ? n - at : g.size
      const teams = entrants.slice(at, at + size)
      at += teams.length
      if (teams.length) groups.push({ name: g.name, teams })
    })
    return groups
  }
  let count = def.groupSize ? Math.round(n / def.groupSize) : def.groups ?? 1
  count = Math.max(1, Math.min(count, Math.floor(n / 2)))
  const groups = Array.from({ length: count }, (_, k) => ({
    name: def.groupNames?.[k] ?? (count > 1 ? `Grupo ${String.fromCharCode(65 + k)}` : def.name),
    teams: [],
  }))
  // Snake seeding: 1→A, 2→B, 3→B, 4→A… keeps the groups balanced.
  entrants.forEach((id, i) => {
    const r = Math.floor(i / count)
    const k = r % 2 === 0 ? i % count : count - 1 - (i % count)
    groups[k].teams.push(id)
  })
  return groups
}

function startStage(comp, i, entrants) {
  const def = comp.format.stages[i]
  const st = { type: def.type, name: def.name, def, teams: entrants, groups: [], matchdays: [], done: false, carry: null, ko: null }
  comp.stages[i] = st
  comp.stage = i
  comp.md = 0
  if (def.type === 'league') {
    st.groups = makeGroups(def, entrants)
    if (def.carryPoints && i > 0) st.carry = carryFrom(comp, comp.stages[i - 1], def.halvePoints)
    const per = st.groups.map((g) => leagueSchedule(g.teams, def.rounds))
    const n = Math.max(0, ...per.map((x) => x.length))
    for (let k = 0; k < n; k++) st.matchdays.push(per.flatMap((md) => md[k] ?? []).map((m) => fixture(comp, m)))
  } else if (def.type === 'swiss') {
    st.groups = [{ name: def.name, teams: entrants }]
    st.met = []
    st.homes = {}
    st.matchdays.push(swissMatchday(comp, st))
  } else {
    st.groups = []
    st.ko = { seeds: entrants, rounds: [] }
    if (entrants.length < 2) {
      st.done = true
      st.winner = entrants[0]
    } else startKoRound(comp, st, null)
  }
}

function carryFrom(comp, prev, halve) {
  const carry = {}
  for (let g = 0; g < prev.groups.length; g++) {
    for (const r of groupTable(comp, prev, g)) {
      carry[r.id] = halve
        ? { pts: Math.ceil(r.pts / 2), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, agf: 0 }
        : { pts: r.pts, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, agf: r.agf }
    }
  }
  return carry
}

// ---------- tables ----------

export function stageFixtures(st) {
  return st.matchdays.flat()
}

export function groupTable(comp, st, g) {
  const teams = st.groups[g]?.teams ?? []
  const set = new Set(teams)
  const pts = comp.format.points
  const rows = new Map(
    teams.map((id) => {
      const c = st.carry?.[id]
      return [id, { id, p: c?.p ?? 0, w: c?.w ?? 0, d: c?.d ?? 0, l: c?.l ?? 0, gf: c?.gf ?? 0, ga: c?.ga ?? 0, agf: c?.agf ?? 0, pts: c?.pts ?? 0, form: [] }]
    }),
  )
  const played = stageFixtures(st).filter((f) => f.result && set.has(f.home) && set.has(f.away))
  for (const f of played) {
    const [hg, ag] = f.result.score
    const h = rows.get(f.home)
    const a = rows.get(f.away)
    h.p++
    a.p++
    h.gf += hg
    h.ga += ag
    a.gf += ag
    a.ga += hg
    a.agf += ag
    if (hg > ag) {
      h.w++
      a.l++
      h.pts += pts.win
      a.pts += pts.loss
      h.form.push('V')
      a.form.push('D')
    } else if (hg < ag) {
      a.w++
      h.l++
      a.pts += pts.win
      h.pts += pts.loss
      h.form.push('D')
      a.form.push('V')
    } else {
      h.d++
      a.d++
      h.pts += pts.draw
      a.pts += pts.draw
      h.form.push('E')
      a.form.push('E')
    }
  }
  const h2h = (x, y) => {
    let px = 0
    let py = 0
    for (const f of played) {
      if (!((f.home === x && f.away === y) || (f.home === y && f.away === x))) continue
      const [hg, ag] = f.result.score
      const xg = f.home === x ? hg : ag
      const yg = f.home === x ? ag : hg
      px += xg > yg ? 3 : xg === yg ? 1 : 0
      py += yg > xg ? 3 : xg === yg ? 1 : 0
    }
    return py - px
  }
  const cmp = (x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts
    for (const tb of comp.format.tiebreakers) {
      let d = 0
      if (tb === 'goalDiff') d = y.gf - y.ga - (x.gf - x.ga)
      else if (tb === 'goalsFor') d = y.gf - x.gf
      else if (tb === 'wins') d = y.w - x.w
      else if (tb === 'awayGoals') d = y.agf - x.agf
      else if (tb === 'headToHead') d = h2h(x.id, y.id)
      if (d) return d
    }
    return comp.teamIds.indexOf(x.id) - comp.teamIds.indexOf(y.id)
  }
  return [...rows.values()].sort(cmp).map((r, i) => ({ ...r, pos: i + 1, cmp }))
}

// One ranking across groups: all group winners first (best first), then all runners-up, ...
export function overallRanking(comp, st, perGroup = Infinity) {
  if (st.type === 'knockout') return st.ko.seeds
  const tables = st.groups.map((_, g) => groupTable(comp, st, g))
  if (tables.length === 1) return tables[0].slice(0, perGroup).map((r) => r.id)
  const out = []
  const max = Math.max(...tables.map((t) => t.length))
  for (let pos = 0; pos < Math.min(max, perGroup); pos++) {
    const tier = tables.map((t) => t[pos]).filter(Boolean)
    if (!tier.length) continue
    tier.sort((x, y) => x.cmp(x, y))
    out.push(...tier.map((r) => r.id))
  }
  return out
}

function qualifiers(comp, prev, q) {
  if (!q) return overallRanking(comp, prev)
  if (q.perGroup) return overallRanking(comp, prev, q.perGroup)
  const rank = overallRanking(comp, prev)
  if (q.top) return rank.slice(0, q.top)
  return rank.slice((q.from ?? 1) - 1, q.to ?? rank.length)
}

// ---------- swiss ----------

function swissMatchday(comp, st) {
  const order = st.matchdays.length ? groupTable(comp, st, 0).map((r) => r.id) : st.teams.slice()
  const met = new Set(st.met)
  const key = (a, b) => [a, b].sort().join('|')
  const pool = order.slice()
  const out = []
  while (pool.length > 1) {
    const a = pool.shift()
    let j = pool.findIndex((b) => !met.has(key(a, b)))
    if (j < 0) j = 0
    const b = pool.splice(j, 1)[0]
    st.met.push(key(a, b))
    const ha = st.homes[a] ?? 0
    const hb = st.homes[b] ?? 0
    const [home, away] = ha <= hb ? [a, b] : [b, a]
    st.homes[home] = (st.homes[home] ?? 0) + 1
    out.push(fixture(comp, { home, away }))
  }
  return out
}

// ---------- knockout ----------

function startKoRound(comp, st, winners) {
  const def = st.def
  const ko = st.ko
  const r = ko.rounds.length
  let pairs = []
  let byes = []
  // slots keep the bracket order: { pair: index } or { team } for a bye.
  const slots = []
  if (r === 0) {
    const seeds = ko.seeds
    const size = nextPow2(seeds.length)
    const order = bracketOrder(size).map((s) => seeds[s - 1] ?? null)
    for (let k = 0; k < order.length; k += 2) {
      const [x, y] = [order[k], order[k + 1]]
      if (x && y) {
        slots.push({ pair: pairs.length })
        pairs.push([x, y])
      } else if (x || y) {
        slots.push({ team: x || y })
        byes.push(x || y)
      }
    }
  } else if (def.reseed) {
    const alive = winners.slice().sort((x, y) => ko.seeds.indexOf(x) - ko.seeds.indexOf(y))
    while (alive.length > 1) pairs.push([alive.shift(), alive.pop()])
  } else {
    for (let k = 0; k + 1 < winners.length; k += 2) pairs.push([winners[k], winners[k + 1]])
  }
  const remaining = pairs.length * 2 + byes.length
  const final = remaining === 2 && pairs.length === 1
  const mode = final ? def.finalTies : r === 0 && def.firstRoundTies ? def.firstRoundTies : def.ties
  const tieBreak = final ? def.finalTieBreak : def.tieBreak
  const name = r === 0 && byes.length ? 'Ronda previa' : roundName(nextPow2(remaining))
  // The better seed is "a": it hosts the second leg and wins seed-based tie-breaks.
  const ties = pairs.map(([x, y], k) => {
    const [a, b] = ko.seeds.indexOf(x) <= ko.seeds.indexOf(y) ? [x, y] : [y, x]
    return { id: `t${r}-${k}`, a, b, mode, tieBreak, games: [], wins: [0, 0], winner: null, pens: null, agg: null }
  })
  if (!slots.length) pairs.forEach((_, k) => slots.push({ pair: k }))
  ko.rounds.push({ name, ties, byes, slots })
  const md = []
  for (const t of ties) md.push(addGame(comp, t))
  st.matchdays.push(md)
}

function addGame(comp, tie) {
  const n = tie.games.length
  // single: better seed hosts; double: worse seed hosts the first leg; bo3: a, b, a.
  const aHome = tie.mode === 'double' ? n === 1 : n % 2 === 0
  const f = fixture(comp, aHome ? { home: tie.a, away: tie.b } : { home: tie.b, away: tie.a }, { tie: tie.id, leg: n + 1 })
  tie.games.push(f.id)
  return f
}

function findFx(st, id) {
  return stageFixtures(st).find((f) => f.id === id)
}

function goalsFor(f, team) {
  return f.home === team ? f.result.score[0] : f.result.score[1]
}

function decideTie(comp, st, tie, getTeam, news) {
  const games = tie.games.map((id) => findFx(st, id))
  if (games.some((g) => !g.result)) return null
  const pens = (f) => {
    if (!f.result.pens) f.result.pens = shootout(getTeam(f.home), getTeam(f.away), `${comp.seed}-${f.id}`)
    const [ph, pa] = f.result.pens
    return ph > pa ? f.home : f.away
  }
  if (tie.mode === 'bo3') {
    const last = games[games.length - 1]
    const [hg, ag] = last.result.score
    const w = hg > ag ? last.home : hg < ag ? last.away : pens(last)
    tie.wins[w === tie.a ? 0 : 1]++
    if (tie.wins[0] === 2 || tie.wins[1] === 2) return tie.wins[0] === 2 ? tie.a : tie.b
    return 'more'
  }
  if (tie.mode === 'double' && games.length < 2) return 'more'
  const ga = games.reduce((s, f) => s + goalsFor(f, tie.a), 0)
  const gb = games.reduce((s, f) => s + goalsFor(f, tie.b), 0)
  tie.agg = [ga, gb]
  if (ga !== gb) return ga > gb ? tie.a : tie.b
  const last = games[games.length - 1]
  if (tie.tieBreak === 'seed') {
    news?.push(`Empate global ${ga}-${gb}: avanza ${getTeam(tie.a)?.name} por mejor posición en la tabla.`)
    return tie.a
  }
  if (tie.tieBreak === 'awayGoals' && tie.mode === 'double') {
    const awayA = games.filter((f) => f.away === tie.a).reduce((s, f) => s + goalsFor(f, tie.a), 0)
    const awayB = games.filter((f) => f.away === tie.b).reduce((s, f) => s + goalsFor(f, tie.b), 0)
    if (awayA !== awayB) return awayA > awayB ? tie.a : tie.b
  }
  const w = pens(last)
  const [ph, pa] = last.result.pens
  news?.push(`${getTeam(w)?.name} gana en penales (${Math.max(ph, pa)}-${Math.min(ph, pa)}).`)
  return w
}

// ---------- progression ----------

export function currentStage(comp) {
  return comp.stages[comp.stage]
}

export function currentMatchday(comp) {
  if (comp.finished) return null
  return currentStage(comp)?.matchdays[comp.md] ?? null
}

// Moves the competition forward once every fixture of the current matchday has a result.
// Returns human-readable news lines.
export function advance(comp, getTeam) {
  const news = []
  const md = currentMatchday(comp)
  if (!md || md.some((f) => !f.result)) return news
  const st = currentStage(comp)
  if (st.type === 'knockout') {
    const round = st.ko.rounds[st.ko.rounds.length - 1]
    const extra = []
    for (const tie of round.ties) {
      if (tie.winner) continue
      const w = decideTie(comp, st, tie, getTeam, news)
      if (w === 'more') extra.push(addGame(comp, tie))
      else if (w) tie.winner = w
    }
    if (extra.length) st.matchdays.push(extra)
    else if (round.ties.every((t) => t.winner)) {
      const winners = round.slots.map((sl) => sl.team ?? round.ties[sl.pair].winner)
      if (winners.length >= 2) startKoRound(comp, st, winners)
      else {
        st.done = true
        st.winner = winners[0] ?? round.ties[0]?.winner
      }
    }
  } else if (st.type === 'swiss' && st.matchdays.length < st.def.matches) {
    st.matchdays.push(swissMatchday(comp, st))
  }
  comp.md++
  settle(comp, getTeam, news)
  return news
}

function stageComplete(comp, st) {
  if (st.type === 'knockout') return st.done
  if (comp.md < st.matchdays.length) return false
  return st.type !== 'swiss' || st.matchdays.length >= st.def.matches || st.teams.length < 2
}

// Closes finished stages, opens the next one and crowns the champion.
function settle(comp, getTeam, news) {
  for (let guard = 0; guard < 20; guard++) {
    const st = currentStage(comp)
    if (!st || comp.finished || !stageComplete(comp, st)) return
    st.done = true
    const next = comp.format.stages[comp.stage + 1]
    if (next) {
      const entrants = qualifiers(comp, st, next.qualify)
      if (entrants.length >= 2) {
        news.push(`Termina ${st.name}. Comienza ${next.name} con ${entrants.length} equipos.`)
        startStage(comp, comp.stage + 1, entrants)
        continue
      }
    }
    comp.finished = true
    comp.champion = st.type === 'knockout' ? st.winner : st.def.split ? groupTable(comp, st, 0)[0]?.id : overallRanking(comp, st)[0]
    return
  }
}

// Every fixture of the competition, with its stage index.
export function allFixtures(comp) {
  return comp.stages.flatMap((st, i) => (st ? stageFixtures(st).map((f) => ({ ...f, stageIndex: i })) : []))
}

export function findFixture(comp, id) {
  for (const st of comp.stages) {
    const f = st && findFx(st, id)
    if (f) return f
  }
  return null
}

// Is the team still alive? (in the current stage's draw)
export function teamStatus(comp, id) {
  if (comp.finished) return comp.champion === id ? 'champion' : 'done'
  const st = currentStage(comp)
  if (!st.teams.includes(id)) return 'out'
  if (st.type === 'knockout') {
    for (const r of st.ko.rounds) for (const t of r.ties) if (t.winner && (t.a === id || t.b === id) && t.winner !== id) return 'out'
  }
  return 'alive'
}

export function rngFor(comp, tag) {
  return createRng(`${comp.seed}-${tag}`)
}

// Plays a format with random scores to describe how long it is and how it unfolds.
export function dryRun(format, n) {
  const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`)
  const comp = createCompetition(format, ids, 'dry-run')
  const rng = createRng('dry-run')
  const getTeam = (id) => ({ id, name: id, players: [{ attrs: { finishing: 12, goalkeeping: 12 }, roles: ['GK'] }] })
  let matchdays = 0
  let matches = 0
  while (!comp.finished && matchdays < 400) {
    for (const f of currentMatchday(comp) ?? []) {
      f.result = { score: [rng.int(0, 3), rng.int(0, 3)] }
      matches++
    }
    advance(comp, getTeam)
    matchdays++
  }
  return {
    matchdays,
    matches,
    stages: comp.stages.map((st) =>
      st.type === 'knockout'
        ? `${st.name}: ${st.ko.seeds.length} equipos · ${st.ko.rounds.map((r) => r.name).join(' › ')}`
        : `${st.name}: ${st.teams.length} equipos, ${st.groups.length > 1 ? `${st.groups.length} grupos (${st.groups.map((g) => g.teams.length).join('/')})` : '1 tabla'}, ${st.matchdays.length} jornadas${st.carry ? ' (con puntos arrastrados)' : ''}`,
    ),
  }
}
