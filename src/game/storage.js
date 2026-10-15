import { createBaseTeams } from '../data/teams.js'
import { createLigaMxTeams, LIGA_MX_IDS } from '../data/ligamx.js'
import { FORMAT_PRESETS } from './formats.js'
import { ensureEconomy } from './economy.js'
import { ensureCareer } from './season.js'

const KEY = 'pixel-football-manager/world-v1'

const VERSION = 6

export function defaultLeagues() {
  return [
    {
      id: 'liga-mx-a26',
      name: 'Liga MX · Apertura 2026',
      format: structuredClone(FORMAT_PRESETS['liga-mx']),
      teamIds: LIGA_MX_IDS.slice(),
      sim: 'quick',
      builtIn: true,
    },
    {
      id: 'copa-mx',
      name: 'Copa Pixel MX',
      format: structuredClone(FORMAT_PRESETS.cup),
      teamIds: LIGA_MX_IDS.slice(),
      sim: 'quick',
      builtIn: true,
    },
  ]
}

export function createWorld() {
  const world = { version: VERSION, teams: [...createBaseTeams(), ...createLigaMxTeams()], leagues: defaultLeagues(), career: null, gallery: [] }
  ensureEconomy(world)
  return world
}

export function migrateWorld(w) {
  if (w.version >= VERSION) return w
  if (w.version < 2) {
    // v1 → v2: real heights, looks and preferred roles for the base squads, role sheets for tactics.
    const base = createBaseTeams()
    for (const t of w.teams) {
      const bt = base.find((b) => b.id === t.id)
      if (bt && !t.tactics.roles) t.tactics.roles = bt.tactics.roles
      for (const p of t.players) {
        const bp = bt?.players.find((x) => x.id === p.id)
        p.height ??= bp?.height ?? 178
        p.weight ??= 74
        p.prefRole ??= bp?.prefRole ?? null
        if (bp) p.appearance = bp.appearance
      }
    }
  }
  // v2 → v3: the other 16 Liga MX clubs, the league library and the new career format.
  for (const t of createLigaMxTeams()) if (!w.teams.some((x) => x.id === t.id)) w.teams.push(t)
  w.leagues ??= []
  for (const l of defaultLeagues()) if (!w.leagues.some((x) => x.id === l.id)) w.leagues.push(l)
  if (w.career && !w.career.competition) w.career = null
  // v3 → v4: real Apertura 2026 squads for the 16 clubs that had generated ones (unless the user edited them).
  if (w.version < 4) {
    for (const fresh of createLigaMxTeams()) {
      const t = w.teams.find((x) => x.id === fresh.id)
      if (t && t.generated) {
        t.players = fresh.players
        t.lineup = null
        t.generated = false
        t.confidence = fresh.confidence
      }
    }
  }
  // v4 → v6: career mode and manager career (values, wages, contracts, potential, budgets, free agents).
  ensureEconomy(w)
  ensureCareer(w, w.career)
  w.version = VERSION
  return w
}

export function loadWorld() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const w = JSON.parse(raw)
      if (w && w.version >= 1 && Array.isArray(w.teams)) return migrateWorld(w)
    }
  } catch {
    // Storage blocked or corrupt: fall back to a fresh world.
  }
  return createWorld()
}

export function saveWorld(world) {
  try {
    localStorage.setItem(KEY, JSON.stringify(world))
    return true
  } catch {
    return false
  }
}

export function clearWorld() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
