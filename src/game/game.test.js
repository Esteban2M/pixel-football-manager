import { describe, it, expect } from 'vitest'
import { createRng } from './rng.js'
import { roundRobin, buildFixtures, createCareer, completeRound, standings, nextUserFixture, applyResult } from './season.js'
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

  it('two teams get a 6-match series alternating home and away', () => {
    const rounds = buildFixtures(['caz', 'ame'])
    expect(rounds).toHaveLength(6)
    const homes = rounds.map((r) => r[0].home)
    expect(homes.filter((h) => h === 'caz')).toHaveLength(3)
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
  it('plays a whole season and updates the table and player stats', () => {
    const w = createWorld()
    w.career = createCareer(w, 'cruz-azul')
    let guard = 0
    while (!w.career.finished && guard++ < 20) {
      const fx = nextUserFixture(w.career)
      const h = w.teams.find((t) => t.id === fx.home)
      const a = w.teams.find((t) => t.id === fx.away)
      applyResult(w, w.career, fx, simulateMatch(h, a, fx.id).result)
      completeRound(w, w.career)
    }
    expect(w.career.finished).toBe(true)
    const table = standings(w, w.career)
    expect(table[0].p).toBe(6)
    const apps = w.teams[0].players.reduce((n, p) => n + p.stats.apps, 0)
    expect(apps).toBeGreaterThanOrEqual(66)
    const goals = table.reduce((n, r) => n + r.gf, 0)
    const scored = w.teams.flatMap((t) => t.players).reduce((n, p) => n + p.stats.goals, 0)
    expect(scored).toBeLessThanOrEqual(goals)
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
