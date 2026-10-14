import { createBaseTeams } from '../data/teams.js'

const KEY = 'pixel-football-manager/world-v1'

export function createWorld() {
  return { version: 1, teams: createBaseTeams(), career: null, gallery: [] }
}

export function loadWorld() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const w = JSON.parse(raw)
      if (w && w.version === 1 && Array.isArray(w.teams)) return w
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
