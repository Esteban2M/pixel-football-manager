// Procedural pixel characters: a 16x16 portrait and a tiny 7x10 sprite for the pitch.
import { createGrid, setPx, getPx } from './grid.js'
import { SKIN_TONES, HAIR_COLORS } from './palette.js'

const EYE = '#1a1a1a'
const WHITE = '#f4f4f4'
const MOUTH = '#9c4a3a'
const BOOT = '#1b1b1b'

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

function hline(g, y, x0, x1, c) {
  for (let x = x0; x <= x1; x++) setPx(g, x, y, c)
}

// Shirt colour at (x, y) given the kit pattern, used by both sprite sizes.
function shirtColor(kit, x, y, w, h) {
  const p = kit.pattern ?? 0
  if (p === 1) return x % 2 === 0 ? kit.trim : kit.shirt // stripes
  if (p === 2) return y % 2 === 0 ? kit.trim : kit.shirt // hoops
  if (p === 3) return Math.abs(x - Math.round((y * w) / h)) <= 1 ? kit.trim : kit.shirt // sash
  if (p === 4) return x < w / 2 ? kit.shirt : kit.trim // halves
  return kit.shirt
}

export function portraitGrid(look, kit) {
  const g = createGrid(16, 16)
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[0]
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]

  // Shirt and shoulders
  for (let y = 13; y < 16; y++) {
    const x0 = y === 13 ? 2 : 1
    for (let x = x0; x <= 15 - x0; x++) setPx(g, x, y, shirtColor(kit, x, y - 13, 16, 3))
  }
  hline(g, 13, 5, 10, kit.trim)
  if ((kit.pattern ?? 0) === 0) {
    setPx(g, 2, 14, kit.trim)
    setPx(g, 13, 14, kit.trim)
  }
  // Neck
  hline(g, 12, 6, 9, skin.shade)
  hline(g, 13, 6, 9, skin.shade)
  // Head
  hline(g, 2, 5, 10, skin.base)
  for (let y = 3; y <= 10; y++) hline(g, y, 4, 11, skin.base)
  hline(g, 11, 5, 10, skin.base)
  for (let y = 4; y <= 10; y++) setPx(g, 11, y, skin.shade)
  // Ears
  setPx(g, 3, 7, skin.shade)
  setPx(g, 3, 8, skin.shade)
  setPx(g, 12, 7, skin.shade)
  setPx(g, 12, 8, skin.shade)
  // Face
  setPx(g, 5, 7, WHITE)
  setPx(g, 6, 7, EYE)
  setPx(g, 9, 7, EYE)
  setPx(g, 10, 7, WHITE)
  const brow = look.hair === 8 ? skin.shade : hair.shade
  hline(g, 6, 5, 6, brow)
  hline(g, 6, 9, 10, brow)
  setPx(g, 8, 8, skin.shade)
  setPx(g, 8, 9, skin.shade)
  hline(g, 10, 6, 9, MOUTH)

  drawHair(g, look.hair, hair)
  drawBeard(g, look.beard, hair, skin)
  return g
}

function drawHair(g, style, hair) {
  const c = hair.base
  const d = hair.shade
  switch (style) {
    case 0: // buzz
      hline(g, 2, 5, 10, d)
      hline(g, 3, 4, 11, d)
      break
    case 1: // short
      hline(g, 1, 5, 10, c)
      hline(g, 2, 4, 11, c)
      hline(g, 3, 4, 11, c)
      hline(g, 4, 4, 5, d)
      hline(g, 4, 10, 11, d)
      setPx(g, 4, 5, d)
      setPx(g, 11, 5, d)
      break
    case 2: // side part with fringe
      hline(g, 1, 4, 11, c)
      hline(g, 2, 3, 12, c)
      hline(g, 3, 4, 11, c)
      hline(g, 4, 4, 8, c)
      setPx(g, 9, 2, d)
      setPx(g, 4, 5, d)
      setPx(g, 11, 4, d)
      break
    case 3: // curly
      for (const x of [5, 7, 9]) setPx(g, x, 0, c)
      hline(g, 1, 4, 11, c)
      hline(g, 2, 3, 12, c)
      hline(g, 3, 3, 12, c)
      for (let x = 3; x <= 12; x += 2) {
        setPx(g, x, 2, d)
        setPx(g, x + 1, 3, d)
      }
      for (const x of [3, 4, 11, 12]) setPx(g, x, 4, c)
      break
    case 4: // afro
      hline(g, 0, 4, 11, c)
      hline(g, 1, 3, 12, c)
      for (let y = 2; y <= 4; y++) hline(g, y, 2, 13, c)
      for (const y of [5, 6]) {
        setPx(g, 2, y, c)
        setPx(g, 3, y, d)
        setPx(g, 12, y, d)
        setPx(g, 13, y, c)
      }
      for (let x = 3; x <= 12; x += 3) setPx(g, x, 1, d)
      break
    case 5: // long
      hline(g, 1, 4, 11, c)
      hline(g, 2, 3, 12, c)
      hline(g, 3, 3, 12, c)
      for (let y = 4; y <= 11; y++) {
        setPx(g, 3, y, y > 9 ? d : c)
        setPx(g, 12, y, y > 9 ? d : c)
      }
      setPx(g, 4, 4, c)
      setPx(g, 11, 4, c)
      break
    case 6: // mohawk
      for (let y = 0; y <= 3; y++) hline(g, y, 7, 8, c)
      hline(g, 3, 4, 6, d)
      hline(g, 3, 9, 11, d)
      break
    case 7: // spiky
      for (const x of [4, 6, 8, 10]) setPx(g, x, 0, c)
      hline(g, 1, 4, 11, c)
      hline(g, 2, 4, 11, c)
      hline(g, 3, 4, 11, d)
      break
    default: // bald
      break
  }
}

function drawBeard(g, style, hair, skin) {
  const c = hair.base
  if (style === 1) {
    for (let y = 9; y <= 11; y++) {
      for (let x = 4; x <= 11; x++) {
        if (getPx(g, x, y) === skin.base && (x + y) % 2 === 0) setPx(g, x, y, shade(skin.base, 0.72))
      }
    }
  } else if (style === 2) {
    hline(g, 9, 6, 9, c)
  } else if (style === 3) {
    hline(g, 9, 6, 9, c)
    for (const y of [8, 9, 10]) {
      setPx(g, 4, y, c)
      setPx(g, 11, y, c)
    }
    setPx(g, 5, 10, c)
    setPx(g, 10, 10, c)
    hline(g, 11, 5, 10, c)
  } else if (style === 4) {
    hline(g, 9, 6, 9, c)
    hline(g, 11, 6, 9, c)
  }
}

// 7x10 pitch sprite. frame: 0 or 1 (running legs). back: true when running away from the camera.
export function pitchSprite(look, kit, { frame = 0, back = false, gk = false } = {}) {
  const g = createGrid(7, 10)
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[0]
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]
  const bald = look.hair === 8 || look.hair === 0
  const hairC = look.hair === 8 ? skin.shade : look.hair === 0 ? hair.shade : hair.base
  const shirtKit = gk ? { shirt: kit.gk, trim: shade(kit.gk, 0.7), pattern: 0 } : kit

  hline(g, 0, 2, 4, hairC)
  if (back) {
    hline(g, 1, 2, 4, hairC)
    hline(g, 2, 2, 4, bald ? skin.base : hairC)
  } else {
    setPx(g, 2, 1, look.hair === 5 || look.hair === 4 ? hairC : skin.base)
    setPx(g, 3, 1, skin.base)
    setPx(g, 4, 1, look.hair === 5 || look.hair === 4 ? hairC : skin.base)
    hline(g, 2, 2, 4, skin.base)
    if (look.beard === 3) hline(g, 2, 2, 4, hair.base)
  }
  if (look.hair === 4) {
    setPx(g, 1, 0, hairC)
    setPx(g, 5, 0, hairC)
    setPx(g, 1, 1, hairC)
    setPx(g, 5, 1, hairC)
  }
  for (let x = 1; x <= 5; x++) setPx(g, x, 3, shirtColor(shirtKit, x, 0, 7, 3))
  for (let y = 4; y <= 5; y++) for (let x = 1; x <= 5; x++) setPx(g, x, y, shirtColor(shirtKit, x, y - 3, 7, 3))
  setPx(g, 0, 4, skin.base)
  setPx(g, 6, 4, skin.base)
  setPx(g, 0, 3, shirtKit.shirt)
  setPx(g, 6, 3, shirtKit.shirt)
  hline(g, 6, 1, 5, gk ? shade(kit.gk, 0.6) : kit.shorts)
  const legs = frame === 0 ? [2, 4] : [1, 5]
  for (const x of legs) {
    setPx(g, x, 7, skin.base)
    setPx(g, x, 8, gk ? shade(kit.gk, 0.8) : kit.socks)
    setPx(g, x, 9, BOOT)
  }
  return g
}
