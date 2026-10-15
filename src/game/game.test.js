import { describe, it, expect } from 'vitest'
import { createRng } from './rng.js'
import { roundRobin, createCareer, completeRound, standings, nextUserFixture, applyResult, startNextSeason, takeJob } from './season.js'
import { develop, playerValue } from './economy.js'
import { rivalryName, answerPress } from './narrative.js'
import { askingPrice, evaluateOffer, completePurchase, windowOpen } from './market.js'
import { makePlayer, generateAttrs, overall } from './player.js'
import { createCompetition, currentMatchday, advance, bracketOrder } from './competition.js'
import { FORMAT_PRESETS, normalizeFormat } from './formats.js'
import { importData, exportTeam, exportLeague, exportWorld, EXAMPLE_TEAM, EXAMPLE_LEAGUE } from './io.js'
import { autoLineup, resolveLineup, pickKits } from './team.js'
import { FORMATIONS, FORMATION_KEYS } from './formations.js'
import { simulateMatch, createMatch, step, setTactics, substitute } from './engine/match.js'
import { createBaseTeams } from '../data/teams.js'
import { createCustomTeam } from './generate.js'
import { createWorld } from './storage.js'
import { createGrid, floodFill, linePoints, setPx, getPx } from '../pixel/grid.js'
import { portraitGrid, pitchSprite } from '../pixel/sprites.js'

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('x')
    const b = createRng('x')
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })
})

describe('fixtures', () => {
  it('round robin: every pair meets once and nobody plays twice per round', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const rounds = roundRobin(ids)
    expect(rounds).toHaveLength(5)
    const pairs = new Set()
    for (const r of rounds) {
      const seen = new Set()
      for (const m of r) {
        expect(seen.has(m.home) || seen.has(m.away)).toBe(false)
        seen.add(m.home)
        seen.add(m.away)
        pairs.add([m.home, m.away].sort().join('-'))
      }
    }
    expect(pairs.size).toBe(15)
  })

  it('handles an odd number of teams with a bye', () => {
    const rounds = roundRobin(['a', 'b', 'c'])
    expect(rounds).toHaveLength(3)
    expect(rounds.every((r) => r.length === 1)).toBe(true)
  })

  it('bracket order keeps the top seeds apart', () => {
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
})

describe('base teams', () => {
  const [caz, ame] = createBaseTeams()
  it('loads the current Cruz Azul and América squads', () => {
    expect(caz.name).toBe('Cruz Azul')
    expect(ame.name).toBe('América')
    expect(caz.players.length).toBeGreaterThanOrEqual(23)
    expect(ame.players.length).toBeGreaterThanOrEqual(23)
    expect(caz.players.map((p) => p.name)).toContain('José Paradela')
    expect(ame.players.map((p) => p.name)).toContain('Raphael Veiga')
  })

  it('has unique shirt numbers per team', () => {
    for (const t of [caz, ame]) {
      const nums = t.players.map((p) => p.number)
      expect(new Set(nums).size).toBe(nums.length)
    }
  })

  it('auto lineup picks 11 different available players with a keeper in goal', () => {
    for (const t of [caz, ame]) {
      for (const f of FORMATION_KEYS) {
        const xi = autoLineup(t, f)
        expect(xi).toHaveLength(11)
        expect(new Set(xi).size).toBe(11)
        const gk = t.players.find((p) => p.id === xi[0])
        expect(gk.roles).toContain('GK')
        expect(FORMATIONS[f][0].role).toBe('GK')
      }
    }
    // Malagón is injured, so América starts Cota.
    expect(resolveLineup(ame)[0]).toBe('america-30')
  })

  it('uses the away kit when shirts clash', () => {
    const t = createCustomTeam({ name: 'Azules', primary: '#1352d0', secondary: '#ffffff' })
    const [, awayKit] = pickKits(caz, t)
    expect(awayKit.shirt).toBe(t.kits.away.shirt)
  })
})

describe('match engine', () => {
  const [caz, ame] = createBaseTeams()

  it('plays a full match deterministically', () => {
    const a = simulateMatch(caz, ame, 'seed-1').result
    const b = simulateMatch(caz, ame, 'seed-1').result
    expect(a.score).toEqual(b.score)
    expect(a.score.every((g) => g >= 0 && g < 15)).toBe(true)
    expect(a.stats[0].possessionPct + a.stats[1].possessionPct).toBe(100)
    expect(a.stats[0].shots + a.stats[1].shots).toBeGreaterThan(3)
    expect(a.motm).toBeTruthy()
  })

  it('accepts tactic changes and substitutions mid-match', () => {
    const s = createMatch({ home: caz, away: ame, seed: 'subs', userSide: 0 })
    for (let i = 0; i < 400; i++) step(s)
    setTactics(s, 0, { formation: '3-5-2', mentality: 2 })
    expect(s.teams[0].slots).toBe(FORMATIONS['3-5-2'])
    expect(s.teams[0].agents.filter((a) => a.isGK)).toHaveLength(1)
    const out = s.teams[0].agents.find((a) => !a.isGK)
    const inn = s.teams[0].bench[0]
    const before = s.teams[0].subsLeft
    expect(substitute(s, 0, out.id, inn)).toBe(true)
    expect(s.teams[0].subsLeft).toBe(before - 1)
    expect(s.teams[0].agents.some((a) => a.id === inn)).toBe(true)
    for (let i = 0; i < 400; i++) step(s)
  })

  it('better squads win more often', () => {
    const strong = createCustomTeam({ name: 'Fuertes', primary: '#ff0000', secondary: '#ffffff', quality: 16 })
    const weak = createCustomTeam({ name: 'Débiles', primary: '#00aa00', secondary: '#000000', quality: 8 })
    let points = 0
    for (let i = 0; i < 6; i++) {
      const [h, a] = simulateMatch(strong, weak, `sw-${i}`).result.score
      points += h > a ? 3 : h === a ? 1 : 0
    }
    expect(points).toBeGreaterThanOrEqual(13)
  })
})

describe('season', () => {
  it('plays a whole Liga MX Apertura with Liguilla', () => {
    const w = createWorld()
    expect(w.teams.length).toBe(18)
    w.career = createCareer(w, 'liga-mx-a26', 'cruz-azul')
    let guard = 0
    while (!w.career.finished && guard++ < 40) {
      const fx = nextUserFixture(w.career)
      if (fx) {
        const h = w.teams.find((t) => t.id === fx.home)
        const a = w.teams.find((t) => t.id === fx.away)
        applyResult(w, w.career, fx, simulateMatch(h, a, fx.id).result)
      }
      completeRound(w, w.career)
    }
    expect(w.career.finished).toBe(true)
    expect(w.career.competition.champion).toBeTruthy()
    const table = standings(w, w.career)
    expect(table).toHaveLength(18)
    expect(table.every((r) => r.p === 17)).toBe(true)
    const ko = w.career.competition.stages[1]
    expect(ko.ko.rounds.map((r) => r.ties.length)).toEqual([4, 2, 1])
    // Liguilla pairs 1 vs 8 in the quarter-finals.
    const order = ko.ko.seeds
    expect(ko.ko.rounds[0].ties.some((t) => t.a === order[0] && t.b === order[7])).toBe(true)
  }, 60000)
})

describe('competition formats', () => {
  const run = (key, n) => {
    const { format, errors } = normalizeFormat(FORMAT_PRESETS[key])
    expect(errors).toEqual([])
    const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`)
    const comp = createCompetition(format, ids, key)
    const rng = createRng(key)
    const getTeam = (id) => ({ id, name: id, players: [{ attrs: { finishing: 12, goalkeeping: 12 }, roles: ['GK'] }] })
    let matchdays = 0
    while (!comp.finished && matchdays < 300) {
      for (const f of currentMatchday(comp)) f.result = { score: [rng.int(0, 3), rng.int(0, 3)] }
      advance(comp, getTeam)
      matchdays++
    }
    expect(comp.champion).toBeTruthy()
    return { comp, matchdays }
  }
  it('Liga MX: 17 matchdays + 3 two-legged knockout rounds', () => expect(run('liga-mx', 18).matchdays).toBe(23))
  it('Premier League: 38 matchdays', () => expect(run('premier-league', 20).matchdays).toBe(38))
  it('Scotland: 33 + 5 after the split', () => expect(run('scotland', 12).matchdays).toBe(38))
  it('Champions League: 8 league-phase games, then knockouts with byes for the top 8', () => {
    const { comp } = run('champions-league', 36)
    expect(comp.stages[1].ko.rounds[0].ties).toHaveLength(8)
  })
  it('every preset finishes with odd team counts too', () => {
    for (const key of Object.keys(FORMAT_PRESETS)) run(key, 13)
  })
  it('reports errors in a broken format', () => {
    const { errors } = normalizeFormat({ stages: [{ type: 'knockout', ties: 'triple' }], tiebreakers: ['luck'] })
    expect(errors.length).toBe(2)
  })
})

describe('json import / export', () => {
  it('imports the example team and fills the squad', () => {
    const w = createWorld()
    const r = importData(w, JSON.stringify(EXAMPLE_TEAM))
    expect(r.errors).toEqual([])
    const t = w.teams.find((x) => x.id === 'pixel-fc')
    expect(t.players.length).toBeGreaterThanOrEqual(16)
    expect(t.players.find((p) => p.name === 'El Diez').roles).toEqual(['AM'])
    expect(t.crest.w).toBe(8)
  })

  it('imports a league referencing teams by id, name or short name', () => {
    const w = createWorld()
    importData(w, EXAMPLE_TEAM)
    const r = importData(w, EXAMPLE_LEAGUE)
    expect(r.errors).toEqual([])
    const l = w.leagues.find((x) => x.name === 'Mi Superliga')
    expect(l.teamIds).toEqual(['america', 'cruz-azul', 'toluca', 'tigres', 'pixel-fc'])
  })

  it('round-trips teams, leagues and the whole world', () => {
    const w = createWorld()
    const caz = w.teams.find((t) => t.id === 'cruz-azul')
    const w2 = createWorld()
    w2.teams = w2.teams.filter((t) => t.id !== 'cruz-azul')
    importData(w2, JSON.parse(JSON.stringify(exportTeam(caz))))
    const back = w2.teams.find((t) => t.id === 'cruz-azul')
    expect(back.players.map((p) => p.name)).toEqual(caz.players.map((p) => p.name))
    expect(back.players[0].appearance).toEqual(caz.players[0].appearance)
    const w3 = { teams: [], leagues: [] }
    const r = importData(w3, JSON.stringify(exportWorld(w)))
    expect(r.errors).toEqual([])
    expect(w3.teams).toHaveLength(18)
    expect(w3.leagues.map((l) => l.id)).toEqual(w.leagues.map((l) => l.id))
    const lr = importData(createWorld(), exportLeague(w, w.leagues[0]))
    expect(lr.errors).toEqual([])
  })

  it('explains what is wrong', () => {
    const r = importData(createWorld(), { type: 'pfm-team', team: { players: [{ number: 5 }] } })
    expect(r.errors[0]).toMatch(/falta "name"/)
    expect(importData(createWorld(), '{oops').errors[0]).toMatch(/JSON inválido/)
  })
})

describe('pixel tools', () => {
  it('flood fill only repaints the connected region', () => {
    const g = createGrid(5, 5)
    for (let y = 0; y < 5; y++) setPx(g, 2, y, '#000000')
    const out = floodFill(g, 0, 0, '#ff0000')
    expect(getPx(out, 1, 4)).toBe('#ff0000')
    expect(getPx(out, 3, 0)).toBe(null)
    expect(getPx(g, 0, 0)).toBe(null)
  })

  it('bresenham lines include both ends without gaps', () => {
    const pts = linePoints(0, 0, 7, 3)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[pts.length - 1]).toEqual([7, 3])
    expect(pts).toHaveLength(8)
  })

  it('generates portraits and pitch sprites for every look', () => {
    const kit = { shirt: '#1352c9', trim: '#ffffff', pattern: 1, shorts: '#1352c9', socks: '#1352c9', gk: '#333333' }
    for (let hair = 0; hair < 9; hair++) {
      const p = portraitGrid({ skin: 2, hair, hairColor: 1, beard: hair % 5 }, kit)
      expect(p.px.filter(Boolean).length).toBeGreaterThan(80)
      const s = pitchSprite({ skin: 2, hair, hairColor: 1, beard: 0 }, kit, { frame: 1 })
      expect(s.w).toBe(7)
    }
  })
})

describe('tactical roles', () => {
  it('every formation default role fits its slot', async () => {
    const { FORMATION_ROLES } = await import('./formations.js')
    const { rolesForSlot } = await import('./roles.js')
    for (const f of FORMATION_KEYS) {
      FORMATIONS[f].forEach((slot, i) => expect(rolesForSlot(slot.role)).toContain(FORMATION_ROLES[f][i]))
    }
  })

  it('base squads have real heights, looks and a preferred role', () => {
    for (const t of createBaseTeams()) {
      for (const p of t.players) {
        expect(p.height).toBeGreaterThan(160)
        expect(p.prefRole).toBeTruthy()
      }
    }
  })

  it('a wing-back plays higher up the pitch than a defensive full-back', () => {
    const avgX = (role) => {
      const [caz, ame] = createBaseTeams()
      caz.tactics.formation = '4-3-3'
      caz.tactics.roles = ['GK_STD', role, 'CB_STD', 'CB_STD', role, 'CM_B2B', 'DM_ANCHOR', 'CM_B2B', 'W_WINGER', 'ST_ADV', 'W_WINGER']
      const s = createMatch({ home: caz, away: ame, seed: 'roles' })
      let sum = 0
      let n = 0
      for (let i = 0; i < 2400; i++) {
        step(s)
        for (const a of s.teams[0].agents) if (a.slot === 1 || a.slot === 4) {
          sum += a.x
          n++
        }
      }
      return sum / n
    }
    expect(avgX('FB_WB')).toBeGreaterThan(avgX('FB_DEF') + 3)
  })
})

describe('json report', () => {
  it('keeps info messages as a list', () => {
    const r = importData(createWorld(), { type: 'pfm-team', team: { name: 'Sin Jugadores' } })
    expect(Array.isArray(r.info)).toBe(true)
    expect(r.info[0]).toMatch(/se generó una plantilla/)
  })
})

describe('real Liga MX squads', () => {
  it('imports every roster without errors and keeps club identity', async () => {
    const { LIGA_MX_ROSTERS } = await import('../data/ligamx-rosters.js')
    const w = createWorld()
    const before = structuredClone(w.teams.find((t) => t.id === 'toluca'))
    const r = importData(w, LIGA_MX_ROSTERS)
    expect(r.errors).toEqual([])
    expect(r.added).toHaveLength(16)
    const tol = w.teams.find((t) => t.id === 'toluca')
    expect(tol.crest).toEqual(before.crest)
    expect(tol.coach).toBe('Antonio Mohamed')
    expect(tol.players.map((p) => p.name)).toContain('Paulinho')
  })

  it('real players start ahead of generated fillers', () => {
    const w = createWorld()
    const pumas = w.teams.find((t) => t.id === 'pumas')
    const xi = resolveLineup(pumas).map((id) => pumas.players.find((p) => p.id === id).name)
    expect(xi).toContain('Keylor Navas')
    for (const t of w.teams) {
      expect(t.players.length).toBeGreaterThanOrEqual(22)
      expect(t.players.filter((p) => p.roles.includes('GK')).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('rating sets the overall of the position', () => {
    const r = importData(createWorld(), { type: 'pfm-team', team: { name: 'Prueba', players: [{ name: 'Nueve', position: 'DC', rating: 80 }] } })
    expect(r.errors).toEqual([])
  })
})

describe('career mode', () => {
  const playSeason = (w, c) => {
    for (let g = 0; g < 80 && !c.finished; g++) completeRound(w, c)
  }

  it('young players with potential grow, veterans decline', () => {
    const rng = createRng('dev')
    const kid = makePlayer({ id: 'k', name: 'Kid', short: 'Kid', number: 9, age: 18, roles: ['ST'], attrs: generateAttrs('ST', 9, rng) })
    kid.potential = overall(kid) + 20
    const vet = makePlayer({ id: 'v', name: 'Vet', short: 'Vet', number: 10, age: 34, roles: ['CM'], attrs: generateAttrs('CM', 15, rng) })
    vet.potential = overall(vet)
    const k0 = overall(kid)
    const v0 = overall(vet)
    for (let i = 0; i < 40; i++) {
      develop(kid, 1 / 20, 1, rng)
      develop(vet, 1 / 20, 1, rng)
    }
    expect(overall(kid)).toBeGreaterThan(k0 + 8)
    expect(overall(kid)).toBeLessThanOrEqual(kid.potential)
    expect(overall(vet)).toBeLessThan(v0)
  })

  it('values and wages grow with quality', () => {
    const w = createWorld()
    const all = w.teams.flatMap((t) => t.players)
    const best = all.reduce((a, b) => (overall(b) > overall(a) ? b : a))
    const worst = all.reduce((a, b) => (overall(b) < overall(a) ? b : a))
    expect(playerValue(best)).toBeGreaterThan(playerValue(worst) * 5)
    expect(w.teams.every((t) => t.finances.budget > 0)).toBe(true)
    expect(w.freeAgents.length).toBeGreaterThan(10)
  })

  it('buys a player: counter-offer, acceptance, budgets and squads update', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'cruz-azul')
    const user = w.teams.find((t) => t.id === 'cruz-azul')
    user.finances.budget = 200
    const seller = w.teams.find((t) => t.id === 'necaxa')
    const target = seller.players.find((p) => p.roles[0] === 'ST')
    const ask = askingPrice(seller, target)
    expect(evaluateOffer(w, c, { playerId: target.id, fee: ask * 0.5 }).status).toBe('rejected')
    expect(evaluateOffer(w, c, { playerId: target.id, fee: ask * 0.9 }).status).toBe('counter')
    const n = user.players.length
    const sellerBudget = seller.finances.budget
    expect(completePurchase(w, c, target.id, ask).status).toBe('accepted')
    expect(user.players.some((p) => p.id === target.id)).toBe(true)
    expect(seller.players.some((p) => p.id === target.id)).toBe(false)
    expect(user.players.length).toBe(n + 1)
    expect(user.finances.budget).toBeCloseTo(200 - ask, 1)
    expect(seller.finances.budget).toBeCloseTo(sellerBudget + ask, 1)
    expect(new Set(user.players.map((p) => p.number)).size).toBe(user.players.length)
    expect(c.transfers.at(-1)).toMatchObject({ playerId: target.id, from: 'necaxa', to: 'cruz-azul' })
  })

  it('refuses when the window is closed or the budget is short', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'cruz-azul')
    const target = w.teams.find((t) => t.id === 'toluca').players[0]
    w.teams.find((t) => t.id === 'cruz-azul').finances.budget = 0.01
    expect(evaluateOffer(w, c, { playerId: target.id, fee: 50 }).status).toBe('refused')
    c.matchdayNo = 8
    expect(windowOpen(c)).toBe(false)
  })

  it('chains seasons: ageing, history, new competition, valid squads', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'cruz-azul')
    const someone = w.teams.find((t) => t.id === 'america').players[0]
    const age0 = someone.age
    playSeason(w, c)
    expect(c.finished).toBe(true)
    startNextSeason(w, c)
    expect(c.seasonLabel).toBe('Clausura 2027')
    expect(c.name).toBe('Liga MX · Clausura 2027')
    expect(c.finished).toBe(false)
    expect(c.history).toHaveLength(1)
    playSeason(w, c)
    startNextSeason(w, c)
    expect(c.seasonLabel).toBe('Apertura 2027')
    const found = w.teams.flatMap((t) => t.players).find((p) => p.id === someone.id) ?? w.freeAgents.find((p) => p.id === someone.id)
    if (found) expect(found.age).toBe(age0 + 1)
    for (const t of w.teams) {
      expect(t.players.length).toBeGreaterThanOrEqual(18)
      expect(t.players.filter((p) => p.roles[0] === 'GK').length).toBeGreaterThanOrEqual(2)
      expect(new Set(t.players.map((p) => p.id)).size).toBe(t.players.length)
    }
    // Every player id exists only once in the world.
    const ids = [...w.teams.flatMap((t) => t.players), ...w.freeAgents].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(c.transfers.length).toBeGreaterThan(0)
    playSeason(w, c)
    expect(c.finished).toBe(true)
  })
})

describe('manager career', () => {
  it('sets a reachable objective that depends on squad strength', () => {
    const w = createWorld()
    const strong = createCareer(w, 'liga-mx-a26', 'toluca')
    const weak = createCareer(w, 'liga-mx-a26', 'puebla')
    expect(strong.board.objective.target).toBeLessThan(weak.board.objective.target)
    expect(weak.board.objective.target).toBeLessThan(18)
    expect(strong.manager.reputation).toBeGreaterThan(weak.manager.reputation)
  })

  it('a terrible run gets the manager sacked, and he can take another job', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'cruz-azul')
    c.board.confidence = 9
    // Make the club awful so the board loses patience.
    for (const p of w.teams.find((t) => t.id === 'cruz-azul').players) for (const k in p.attrs) p.attrs[k] = 3
    for (let g = 0; g < 80 && !c.sacked && !c.finished; g++) completeRound(w, c)
    expect(c.sacked).toBeTruthy()
    expect(c.manager.sackings).toBe(1)
    expect(c.jobOffers.length).toBeGreaterThan(0)
    expect(startNextSeason(w, c).sacked).toBeTruthy()
    const target = c.jobOffers[0].teamId
    expect(takeJob(w, c, target)).toBe(true)
    expect(c.userTeamId).toBe(target)
    expect(c.sacked).toBe(null)
    expect(c.manager.stints).toHaveLength(2)
    expect(c.manager.stints[0].sacked).toBe(true)
  })

  it('reviews the season against the objective', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'toluca')
    for (let g = 0; g < 80 && !c.finished; g++) completeRound(w, c)
    expect(c.review).toBeTruthy()
    expect(typeof c.review.met).toBe('boolean')
    expect(c.history.at(-1).teamId).toBe('toluca')
  })
})

describe('narrative', () => {
  it('knows the derbies, including custom ones from JSON', () => {
    const w = createWorld()
    expect(rivalryName(w, 'cruz-azul', 'america')).toBe('Clásico Joven')
    expect(rivalryName(w, 'america', 'guadalajara')).toBe('Clásico Nacional')
    expect(rivalryName(w, 'necaxa', 'tijuana')).toBe(null)
    w.teams.find((t) => t.id === 'necaxa').rivals = [{ id: 'tijuana', name: 'Clásico de prueba' }]
    expect(rivalryName(w, 'tijuana', 'necaxa')).toBe('Clásico de prueba')
  })

  it('press conference answers change morale and promises are settled', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'america')
    expect(c.press).toBeTruthy() // matchday 1 is the Clásico del Centro
    const team = w.teams.find((t) => t.id === 'america')
    const before = team.players[0].morale
    answerPress(w, c, 1)
    expect(team.players[0].morale).toBe(Math.min(2, before + 1))
    expect(c.promise).toBeTruthy()
    completeRound(w, c)
    expect(c.promise).toBe(null)
    expect(c.news.some((n) => n.text.includes('prometió') || n.text.includes('cumplió su palabra'))).toBe(true)
  })

  it('writes headlines during a season', () => {
    const w = createWorld()
    const c = createCareer(w, 'liga-mx-a26', 'america')
    for (let g = 0; g < 80 && !c.finished; g++) completeRound(w, c)
    expect(c.news.filter((n) => n.text.startsWith('📰')).length).toBeGreaterThan(2)
  })

  it('imports rivals from JSON', () => {
    const w = createWorld()
    const rep = importData(w, { type: 'pfm-team', team: { ...EXAMPLE_TEAM.team, id: 'rival-test', rivals: ['cruz-azul', { id: 'america', name: 'Derbi Pixel' }] } })
    expect(rep.errors).toHaveLength(0)
    const t = w.teams.find((x) => x.id === 'rival-test')
    expect(t.rivals).toEqual([
      { id: 'cruz-azul', name: 'Clásico' },
      { id: 'america', name: 'Derbi Pixel' },
    ])
  })
})
