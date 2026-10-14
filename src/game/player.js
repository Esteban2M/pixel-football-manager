import { createRng } from './rng.js'
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, BEARD_STYLES } from '../pixel/palette.js'

// Attributes use the classic manager-game 1-20 scale.
export const ATTRS = [
  { key: 'pace', label: 'Velocidad', short: 'VEL' },
  { key: 'stamina', label: 'Resistencia', short: 'RES' },
  { key: 'strength', label: 'Fuerza', short: 'FUE' },
  { key: 'passing', label: 'Pase', short: 'PAS' },
  { key: 'dribbling', label: 'Regate', short: 'REG' },
  { key: 'finishing', label: 'Remate', short: 'REM' },
  { key: 'tackling', label: 'Entradas', short: 'ENT' },
  { key: 'positioning', label: 'Colocación', short: 'COL' },
  { key: 'goalkeeping', label: 'Portería', short: 'POR' },
]

export const ROLES = {
  GK: { label: 'POR', name: 'Portero', line: 'GK' },
  CB: { label: 'DFC', name: 'Defensa central', line: 'DF' },
  LB: { label: 'LI', name: 'Lateral izquierdo', line: 'DF' },
  RB: { label: 'LD', name: 'Lateral derecho', line: 'DF' },
  DM: { label: 'MCD', name: 'Mediocentro defensivo', line: 'MF' },
  CM: { label: 'MC', name: 'Mediocentro', line: 'MF' },
  AM: { label: 'MCO', name: 'Mediapunta', line: 'MF' },
  LW: { label: 'EI', name: 'Extremo izquierdo', line: 'FW' },
  RW: { label: 'ED', name: 'Extremo derecho', line: 'FW' },
  ST: { label: 'DC', name: 'Delantero centro', line: 'FW' },
}

export const ROLE_KEYS = Object.keys(ROLES)

const ROLE_WEIGHTS = {
  GK: { goalkeeping: 6, positioning: 2, passing: 0.6, strength: 0.6, pace: 0.4 },
  CB: { tackling: 4, positioning: 3, strength: 2.5, pace: 1.5, passing: 1, stamina: 0.5 },
  LB: { tackling: 2.5, pace: 2.5, positioning: 2, stamina: 1.5, passing: 1.5, dribbling: 1 },
  RB: { tackling: 2.5, pace: 2.5, positioning: 2, stamina: 1.5, passing: 1.5, dribbling: 1 },
  DM: { tackling: 3, positioning: 2.5, passing: 2.5, stamina: 1.5, strength: 1.5 },
  CM: { passing: 3.5, stamina: 2, positioning: 1.5, dribbling: 1.5, tackling: 1.5, finishing: 0.5 },
  AM: { passing: 3, dribbling: 3, finishing: 2, pace: 1, positioning: 1 },
  LW: { pace: 3, dribbling: 3.5, passing: 1.5, finishing: 1.5, stamina: 1 },
  RW: { pace: 3, dribbling: 3.5, passing: 1.5, finishing: 1.5, stamina: 1 },
  ST: { finishing: 4.5, positioning: 2, pace: 2, strength: 1.5, dribbling: 1.5 },
}

// How comfortable a player of role A is when playing in slot role B.
const FAMILIARITY = {
  'CB-LB': 0.85, 'CB-RB': 0.85, 'LB-RB': 0.85, 'LB-LW': 0.8, 'RB-RW': 0.8, 'CB-DM': 0.8,
  'DM-CM': 0.9, 'CM-AM': 0.9, 'DM-AM': 0.75, 'AM-LW': 0.85, 'AM-RW': 0.85, 'LW-RW': 0.9,
  'AM-ST': 0.8, 'LW-ST': 0.8, 'RW-ST': 0.8, 'CM-LW': 0.75, 'CM-RW': 0.75, 'LB-CM': 0.65, 'RB-CM': 0.65,
}

export function familiarity(player, slotRole) {
  if (player.roles.includes(slotRole)) return 1
  if (slotRole === 'GK' || player.roles.includes('GK')) return 0.2
  let best = 0.55
  for (const r of player.roles) {
    const f = FAMILIARITY[`${r}-${slotRole}`] ?? FAMILIARITY[`${slotRole}-${r}`]
    if (f && f > best) best = f
  }
  return best
}

export function roleRating(attrs, role) {
  const w = ROLE_WEIGHTS[role]
  let sum = 0
  let total = 0
  for (const [k, v] of Object.entries(w)) {
    sum += (attrs[k] ?? 10) * v
    total += v
  }
  return Math.round((sum / total) * 5)
}

export function overall(player) {
  return roleRating(player.attrs, player.roles[0])
}

export function ratingInSlot(player, slotRole) {
  const fam = familiarity(player, slotRole)
  return Math.round(roleRating(player.attrs, slotRole) * (0.5 + 0.5 * fam))
}

export function primaryLine(player) {
  return ROLES[player.roles[0]].line
}

export function randomAppearance(seed) {
  const rng = createRng(`look-${seed}`)
  const hair = rng.int(0, HAIR_STYLES.length - 1)
  return {
    skin: rng.int(0, SKIN_TONES.length - 1),
    hair,
    hairColor: rng.next() < 0.75 ? rng.int(0, 2) : rng.int(0, HAIR_COLORS.length - 1),
    beard: rng.next() < 0.55 ? 0 : rng.int(1, BEARD_STYLES.length - 1),
  }
}

let idCounter = 0
export function newId(prefix = 'p') {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function emptySeasonStats() {
  return { apps: 0, goals: 0, assists: 0, ratingSum: 0, yellows: 0, reds: 0 }
}

export function makePlayer(p) {
  const id = p.id ?? newId('p')
  return {
    id,
    name: p.name,
    short: p.short ?? p.name.split(' ').slice(-1)[0],
    number: p.number ?? 0,
    nationality: p.nationality ?? 'MEX',
    age: p.age ?? 24,
    roles: p.roles ?? ['CM'],
    attrs: { ...defaultAttrs(), ...p.attrs },
    appearance: p.appearance ?? randomAppearance(id),
    portrait: p.portrait ?? null,
    condition: p.condition ?? 100,
    morale: p.morale ?? 0,
    injury: p.injury ?? 0,
    injuryNote: p.injuryNote ?? '',
    suspension: p.suspension ?? 0,
    stats: p.stats ?? emptySeasonStats(),
  }
}

export function defaultAttrs() {
  return Object.fromEntries(ATTRS.map((a) => [a.key, 10]))
}

const ROLE_PROFILE = {
  GK: { goalkeeping: 1, positioning: 0, strength: 0, pace: -3, finishing: -7, dribbling: -5, tackling: -6 },
  CB: { tackling: 3, positioning: 2, strength: 3, finishing: -4, dribbling: -3, goalkeeping: -8 },
  LB: { pace: 2, stamina: 2, tackling: 1, finishing: -3, goalkeeping: -8 },
  RB: { pace: 2, stamina: 2, tackling: 1, finishing: -3, goalkeeping: -8 },
  DM: { tackling: 2, positioning: 2, passing: 1, finishing: -3, goalkeeping: -8 },
  CM: { passing: 2, stamina: 2, goalkeeping: -8 },
  AM: { passing: 2, dribbling: 2, finishing: 1, tackling: -3, goalkeeping: -8 },
  LW: { pace: 3, dribbling: 3, tackling: -3, strength: -1, goalkeeping: -8 },
  RW: { pace: 3, dribbling: 3, tackling: -3, strength: -1, goalkeeping: -8 },
  ST: { finishing: 4, positioning: 1, tackling: -4, goalkeeping: -8 },
}

// Generates attributes for a role around a quality level (1-20).
export function generateAttrs(role, quality, rng) {
  const prof = ROLE_PROFILE[role]
  const attrs = {}
  for (const { key } of ATTRS) {
    const v = quality + (prof[key] ?? 0) + rng.gauss() * 1.6
    attrs[key] = clampAttr(Math.round(v))
  }
  return attrs
}

export function clampAttr(v) {
  return Math.max(1, Math.min(20, v))
}
