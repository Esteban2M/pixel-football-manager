import { createRng } from './rng.js'
import { makePlayer, generateAttrs, newId } from './player.js'
import { FIRST_NAMES, LAST_NAMES, NATIONALITIES } from '../data/names.js'
import { DEFAULT_TACTICS } from './formations.js'
import { shieldCrest } from '../data/crests.js'

// A balanced 23-man squad template.
const SQUAD_TEMPLATE = [
  'GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB',
  'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM', 'LW', 'RW', 'ST', 'ST', 'ST',
]

const SECOND_ROLE = { CB: 'DM', LB: 'LW', RB: 'RW', DM: 'CM', CM: 'AM', AM: 'CM', LW: 'RW', RW: 'LW', ST: 'AM' }

export function randomPlayer(role, quality, seed = Math.random(), takenNumbers = new Set()) {
  const rng = createRng(seed)
  const first = rng.pick(FIRST_NAMES)
  const last = rng.pick(LAST_NAMES)
  const roles = role !== 'GK' && rng.chance(0.5) ? [role, SECOND_ROLE[role]] : [role]
  let number = role === 'GK' ? rng.pick([1, 12, 13, 25, 30]) : rng.int(2, 35)
  while (takenNumbers.has(number)) number = (number % 99) + 1
  takenNumbers.add(number)
  return makePlayer({
    id: newId('p'),
    name: `${first} ${last}`,
    short: last,
    number,
    nationality: rng.chance(0.7) ? 'MEX' : rng.pick(NATIONALITIES),
    age: rng.int(18, 34),
    roles,
    attrs: generateAttrs(role, quality + rng.int(-2, 2), rng),
  })
}

export function generateSquad(quality = 12, seed = Math.random()) {
  const rng = createRng(seed)
  const taken = new Set()
  return SQUAD_TEMPLATE.map((role, i) => {
    // Starters get a small bump so the squad has a clear first XI.
    const q = quality + (i % 2 === 0 ? 1 : -1)
    return randomPlayer(role, q, `${seed}-${i}-${rng.next()}`, taken)
  })
}

export function createCustomTeam({ name, short, primary, secondary, quality = 12 }) {
  const id = newId('team')
  return {
    id,
    name,
    short: (short || name.slice(0, 3)).toUpperCase().slice(0, 3),
    nickname: '',
    coach: 'Tú',
    custom: true,
    kits: {
      home: { shirt: primary, trim: secondary, pattern: 0, shorts: secondary, socks: primary },
      away: { shirt: secondary, trim: primary, pattern: 0, shorts: primary, socks: secondary },
      gk: '#7a3db8',
    },
    crest: shieldCrest(primary, secondary, name.trim()[0] || 'P'),
    tactics: { ...DEFAULT_TACTICS },
    lineup: null,
    players: generateSquad(quality, id),
  }
}
