import { createBaseTeams } from '../data/teams.js'

const KEY = 'pixel-football-manager/world-v1'

const VERSION = 2

export function createWorld() {
  return { version: VERSION, teams: createBaseTeams(), career: null, gallery: [] }
}

// v1 → v2: real heights, looks and preferred roles for the base squads, role sheets for tactics.
export function migrateWorld(w) {
  if (w.version >= VERSION) return w
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
