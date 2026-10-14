import { createGrid, setPx, stamp } from '../pixel/grid.js'

// Simple 16x16 pixel crests inspired by each club's colours.
// Users can repaint them in the Pixel Art Studio.

function disc(g, rings) {
  const c = (g.w - 1) / 2
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const r = Math.hypot(x - c, y - c)
      for (const [maxR, color] of rings) {
        if (r <= maxR) {
          setPx(g, x, y, color)
          break
        }
      }
    }
  }
}

export function cruzAzulCrest() {
  const g = createGrid(16, 16)
  const blue = '#1352c9'
  disc(g, [
    [5.6, '#ffffff'],
    [7.0, blue],
    [7.8, '#0b2e8a'],
  ])
  // The blue cross.
  for (let i = 3; i <= 12; i++) {
    setPx(g, 7, i, blue)
    setPx(g, 8, i, blue)
    setPx(g, i, 7, blue)
    setPx(g, i, 8, blue)
  }
  for (const x of [3, 12]) for (const y of [7, 8]) setPx(g, x, y, '#ffffff')
  for (const y of [3, 12]) for (const x of [7, 8]) setPx(g, x, y, '#ffffff')
  return g
}

export function americaCrest() {
  const g = createGrid(16, 16)
  const navy = '#00205b'
  const yellow = '#ffe11b'
  disc(g, [
    [5.9, navy],
    [6.9, yellow],
    [7.8, navy],
  ])
  stamp(g, ['.YYY', 'Y...', 'Y...', 'Y...', 'Y...', '.YYY'], 3, 5, yellow)
  stamp(g, ['..R..', '.R.R.', 'R...R', 'RRRRR', 'R...R', 'R...R'], 8, 5, '#c8102e')
  return g
}

// Generic crest for user-created teams: a shield in the team colours with an initial.
const LETTERS = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  C: ['.XX', 'X..', 'X..', 'X..', '.XX'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  F: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  J: ['..X', '..X', '..X', 'X.X', '.X.'],
  K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  N: ['XX.', 'X.X', 'X.X', 'X.X', 'X.X'],
  O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  Q: ['.X.', 'X.X', 'X.X', 'XX.', '.XX'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
  W: ['X.X', 'X.X', 'XXX', 'XXX', 'X.X'],
  X: ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
}

export function shieldCrest(primary, secondary, letter = 'P') {
  const g = createGrid(16, 16)
  for (let y = 1; y < 15; y++) {
    // Shield outline narrows towards the bottom.
    const inset = y < 9 ? 1 : Math.min(7, 1 + Math.floor((y - 8) * 1.2))
    for (let x = inset; x < 16 - inset; x++) {
      const edge = x === inset || x === 15 - inset || y === 1 || y === 14
      setPx(g, x, y, edge ? '#111111' : x < 8 ? primary : secondary)
    }
  }
  const glyph = LETTERS[letter.toUpperCase()] ?? LETTERS.P
  const big = glyph.map((row) => [...row].map((c) => c + c).join(''))
  const tall = big.flatMap((row) => [row, row])
  stamp(g, tall, 5, 3, '#ffffff')
  return g
}
